"use client";

import { Search, ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { systemCopy } from "@/lib/copy";
import { isTypingTarget, keyboardShortcuts } from "@/lib/keyboard";
import { useLiveAgents, useLiveAnomalies, useLiveEscalations } from "@/lib/live-data";
import { motionTransition } from "@/lib/motion";
import { MotionButton, MotionDiv } from "@/lib/motion-elements";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type Density = "comfortable" | "compact" | "ultra";

type RuntimeContextValue = Readonly<{
  commandOpen: boolean;
  density: Density;
  presentationMode: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openShortcutHelp: () => void;
  closeShortcutHelp: () => void;
  cycleDensity: () => void;
  setDensity: (density: Density) => void;
  togglePresentationMode: () => void;
}>;

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined);

const densityOrder: Density[] = ["comfortable", "compact", "ultra"];

const navigationCommands = [
  { label: "Go to Overview", href: "/dashboard", shortcut: "G O" },
  { label: "Go to Agents", href: "/agents", shortcut: "G A" },
  { label: "Go to Vendors", href: "/vendors", shortcut: "G V" },
  { label: "Go to Ledger", href: "/ledger", shortcut: "G L" },
  { label: "Go to Escalations", href: "/escalations", shortcut: "G E" },
  { label: "Go to Anomalies", href: "/anomalies", shortcut: "G N" },
  { label: "Go to Settings", href: "/settings", shortcut: "G S" },
  { label: "Go to Docs", href: "/docs", shortcut: "" },
] as const;

function readStoredDensity(): Density {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const storedDensity = window.localStorage.getItem("arcanum:density");

  if (storedDensity === "compact" || storedDensity === "ultra") {
    return storedDensity;
  }

  return "comfortable";
}

export function ArcanumRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [density, setDensityState] = useState<Density>("comfortable");
  const [presentationMode, setPresentationMode] = useState(false);
  const [sequenceKey, setSequenceKey] = useState<string | undefined>();
  const { data: agents } = useLiveAgents();
  const { data: anomalies } = useLiveAnomalies();
  const { data: escalations } = useLiveEscalations("PENDING");

  useEffect(() => {
    setDensityState(readStoredDensity());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    window.localStorage.setItem("arcanum:density", density);
  }, [density]);

  useEffect(() => {
    document.documentElement.dataset.presentation = presentationMode ? "true" : "false";
  }, [presentationMode]);

  const navigate = useCallback(
    (href: string) => {
      setCommandOpen(false);
      setCommandQuery("");
      setHelpOpen(false);
      router.push(href);
    },
    [router],
  );

  const cycleDensity = useCallback(() => {
    setDensityState((currentDensity) => {
      const currentIndex = densityOrder.indexOf(currentDensity);
      const nextDensity = densityOrder[(currentIndex + 1) % densityOrder.length] ?? "comfortable";
      toast.message(`Density set to ${nextDensity.toUpperCase()}`);

      return nextDensity;
    });
  }, []);

  const setDensity = useCallback((nextDensity: Density) => {
    setDensityState(nextDensity);
    toast.message(`Density set to ${nextDensity.toUpperCase()}`);
  }, []);

  const togglePresentationMode = useCallback(() => {
    setPresentationMode((current) => {
      const next = !current;
      toast.message(next ? "Presentation mode engaged" : "Presentation mode disengaged");

      return next;
    });
  }, []);

  useEffect(() => {
    const sequenceRoutes: Record<string, string> = {
      o: "/dashboard",
      a: "/agents",
      v: "/vendors",
      l: "/ledger",
      e: "/escalations",
      n: "/anomalies",
      s: "/settings",
    };

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        togglePresentationMode();
        return;
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
        setCommandQuery("");
        setHelpOpen(false);
        setSequenceKey(undefined);
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "?" || event.code === "Slash") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const key = event.key.toLowerCase();

      if (sequenceKey === "g") {
        const href = sequenceRoutes[key];
        setSequenceKey(undefined);

        if (href !== undefined) {
          event.preventDefault();
          navigate(href);
        }

        return;
      }

      if (key === "g") {
        setSequenceKey("g");
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, sequenceKey, togglePresentationMode]);

  useEffect(() => {
    if (sequenceKey === undefined) {
      return;
    }

    const timer = window.setTimeout(() => setSequenceKey(undefined), 900);

    return () => window.clearTimeout(timer);
  }, [sequenceKey]);

  const runtime = useMemo<RuntimeContextValue>(
    () => ({
      commandOpen,
      density,
      presentationMode,
      openCommandPalette: () => setCommandOpen(true),
      closeCommandPalette: () => setCommandOpen(false),
      openShortcutHelp: () => setHelpOpen(true),
      closeShortcutHelp: () => setHelpOpen(false),
      cycleDensity,
      setDensity,
      togglePresentationMode,
    }),
    [commandOpen, cycleDensity, density, presentationMode, setDensity, togglePresentationMode],
  );

  const highestDeviationAgent = [...anomalies].sort((left, right) => right.score - left.score)[0];
  const nextEscalation = escalations[0];

  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-2xl p-0">
          <Command shouldFilter>
            <div className="flex items-center gap-2 border-line-subtle border-b px-3">
              <Search className="size-4 text-ash-muted" />
              <CommandInput
                value={commandQuery}
                onValueChange={setCommandQuery}
                placeholder="Search / CTRL K"
              />
            </div>
            <CommandList className="max-h-[520px] overflow-y-auto py-2">
              <CommandEmpty className="px-4 py-8 text-center font-mono-arcanum text-[11px] text-ash-muted tracking-[0.14em]">
                NO COMMAND MATCHES CURRENT FILTER
              </CommandEmpty>
              <CommandGroup
                heading="QUICK ACTIONS"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono-arcanum [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-hazard [&_[cmdk-group-heading]]:tracking-[0.16em]"
              >
                <PaletteItem
                  label="Approve next pending escalation"
                  query={commandQuery}
                  onSelect={() =>
                    navigate(`/escalations${nextEscalation ? `?focus=${nextEscalation.id}` : ""}`)
                  }
                />
                <PaletteItem
                  label="View highest-deviation agent"
                  query={commandQuery}
                  onSelect={() =>
                    navigate(
                      highestDeviationAgent
                        ? `/agents/${highestDeviationAgent.agentId}`
                        : "/anomalies",
                    )
                  }
                />
                <PaletteItem
                  label="Freeze an agent..."
                  query={commandQuery}
                  onSelect={() => navigate("/agents")}
                />
                <PaletteItem
                  label="Add vendor to whitelist"
                  query={commandQuery}
                  onSelect={() => navigate("/vendors?action=add")}
                />
                <PaletteItem
                  label="Open Restraint Queue"
                  query={commandQuery}
                  onSelect={() => navigate("/escalations")}
                />
                <PaletteItem
                  label="Toggle compact density"
                  query={commandQuery}
                  onSelect={cycleDensity}
                  shortcut={density.toUpperCase()}
                />
              </CommandGroup>
              <CommandGroup
                heading="NAVIGATION"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono-arcanum [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ash-muted [&_[cmdk-group-heading]]:tracking-[0.16em]"
              >
                {navigationCommands.map((command) => (
                  <PaletteItem
                    key={command.href}
                    label={command.label}
                    query={commandQuery}
                    shortcut={command.shortcut}
                    onSelect={() => navigate(command.href)}
                    active={pathname === command.href}
                  />
                ))}
              </CommandGroup>
              <CommandGroup
                heading="RECENT"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono-arcanum [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-ash-muted [&_[cmdk-group-heading]]:tracking-[0.16em]"
              >
                {agents.slice(0, 5).map((agent) => (
                  <PaletteItem
                    key={agent.id}
                    label={`Agent / ${agent.name}`}
                    query={commandQuery}
                    shortcut={agent.status.toUpperCase()}
                    onSelect={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
                {escalations.slice(0, 3).map((escalation) => (
                  <PaletteItem
                    key={escalation.id}
                    label={`Escalation / ${escalation.counterparty} / $${escalation.amount.toFixed(2)}`}
                    query={commandQuery}
                    shortcut={`${escalation.quorumCurrent}/${escalation.quorumRequired}`}
                    onSelect={() => navigate(`/escalations?focus=${escalation.id}`)}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{systemCopy.shortcuts.title}</DialogTitle>
            <DialogDescription>{systemCopy.shortcuts.description}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            {["NAVIGATION", "ACTIONS"].map((section) => (
              <section key={section}>
                <div className="font-mono-arcanum text-[10px] text-hazard tracking-[0.16em]">
                  {section}
                </div>
                <div className="mt-2 divide-y divide-line-subtle border border-line-subtle">
                  {keyboardShortcuts
                    .filter((shortcut) => shortcut.section === section)
                    .map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="font-body text-[13px] text-ash-soft">
                          {shortcut.label}
                        </span>
                        <span className="border border-line-subtle bg-panel-raised px-2 py-0.5 font-mono-arcanum text-[10px] text-ash-bright tracking-[0.12em]">
                          {shortcut.keys}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {sequenceKey === "g" && !reducedMotion ? (
        <MotionDiv
          className="fixed right-4 bottom-14 z-50 border border-line-subtle bg-foundry-panel px-3 py-1.5 font-mono-arcanum text-[10px] text-hazard tracking-[0.16em]"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={motionTransition("micro", "standard")}
        >
          G / awaiting route key
        </MotionDiv>
      ) : null}
      <MotionButton
        type="button"
        className="fixed right-4 bottom-4 z-50 grid size-8 place-items-center border border-line-subtle bg-foundry-panel font-mono-arcanum text-[13px] text-ash-muted transition-colors hover:border-hazard hover:text-hazard"
        aria-label={systemCopy.shortcuts.title}
        onClick={() => setHelpOpen(true)}
        whileTap={reducedMotion ? undefined : { y: 1 }}
        transition={motionTransition("instant", "standard")}
      >
        ?
      </MotionButton>
    </RuntimeContext.Provider>
  );
}

function PaletteItem({
  label,
  query,
  shortcut,
  active,
  onSelect,
}: Readonly<{
  label: string;
  query: string;
  shortcut?: string;
  active?: boolean;
  onSelect: () => void;
}>) {
  return (
    <CommandItem
      value={label}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 font-body text-[13px] text-ash-soft aria-selected:text-ash-bright",
        active && "text-hazard",
      )}
    >
      <ShieldAlert className="size-3 text-ash-muted" />
      <span>{highlightMatch(label, query)}</span>
      {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}

function highlightMatch(label: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return label;
  }

  const index = label.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) {
    return label;
  }

  return (
    <>
      {label.slice(0, index)}
      <span className="text-hazard">{label.slice(index, index + normalizedQuery.length)}</span>
      {label.slice(index + normalizedQuery.length)}
    </>
  );
}

export function useArcanumRuntime() {
  const runtime = useContext(RuntimeContext);

  if (runtime === undefined) {
    throw new Error("useArcanumRuntime must be used inside ArcanumRuntimeProvider.");
  }

  return runtime;
}
