"use client";

import { Command as CommandPrimitive } from "cmdk";
import {
  FileText,
  LayoutDashboard,
  ListChecks,
  Printer,
  Rows2,
  Rows3,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { agentRows, escalations, vendors } from "@/components/arcanum/canvas/data";
import {
  CLOSE_ARCANUM_OVERLAYS_EVENT,
  OPEN_COMMAND_PALETTE_EVENT,
  togglePresentationMode,
  useArcanumDensity,
  usePresentationMode,
} from "@/lib/arcanum-preferences";
import { useLiveAgents, useLiveEscalations, useLiveVendors } from "@/lib/live-data";
import { cn } from "@/lib/utils";

const navigationItems = [
  ["Dashboard", "/dashboard", "G O"],
  ["Agents", "/agents", "G A"],
  ["Vendors", "/vendors", "G V"],
  ["Ledger", "/ledger", "G L"],
  ["Escalations", "/escalations", "G E"],
  ["Anomalies", "/anomalies", "G N"],
  ["Settings", "/settings", "G S"],
  ["Docs", "/docs", "G D"],
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { density, toggleDensity } = useArcanumDensity();
  const { presentationMode } = usePresentationMode();
  const liveAgents = useLiveAgents();
  const liveVendors = useLiveVendors();
  const liveEscalations = useLiveEscalations("PENDING");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const openPalette = () => setOpen(true);
    const closePalette = () => setOpen(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
    window.addEventListener(CLOSE_ARCANUM_OVERLAYS_EVENT, closePalette);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
      window.removeEventListener(CLOSE_ARCANUM_OVERLAYS_EVENT, closePalette);
    };
  }, []);

  const escalationItems = useMemo(
    () =>
      liveEscalations.data.length > 0
        ? liveEscalations.data.map((item) => ({
            href: `/approve/${item.id}`,
            label: `${item.agentName} / $${item.amount.toFixed(2)} / ${item.counterparty}`,
            search: `${item.agentName} ${item.wallet} ${item.amount} ${item.counterparty} ${item.reason}`,
          }))
        : escalations.map((item) => ({
            href: "/escalations",
            label: `${item[0]} / ${item[2]} / ${item[3]}`,
            search: `${item[0]} ${item[1]} ${item[2]} ${item[3]} ${item[4]}`,
          })),
    [liveEscalations.data],
  );

  const agentItems =
    liveAgents.data.length > 0
      ? liveAgents.data
      : agentRows.map((agent) => ({ id: agent.wallet, name: agent.name, wallet: agent.wallet }));
  const vendorItems =
    liveVendors.data.length > 0
      ? liveVendors.data
      : vendors.map((vendor) => ({
          address: String(vendor[2]),
          id: String(vendor[2]),
          name: String(vendor[1]),
        }));

  const run = (action: () => void) => {
    action();
    setOpen(false);
  };

  const navigate = (href: string) => run(() => router.push(href));

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close command palette"
        className="fixed inset-0 z-[70] cursor-default bg-[#0a0b0e]/72"
        onClick={() => setOpen(false)}
      />
      <CommandPrimitive
        label="ARCANUM command palette"
        className="arcanum-command-palette fixed left-1/2 top-[92px] z-[80] w-[720px] max-w-[calc(100vw-40px)] -translate-x-1/2 border border-[#282C34] bg-[#15171B] font-mono text-[#D7DBE0] shadow-[0_24px_80px_rgba(0,0,0,0.72)]"
      >
        <div className="flex h-12 items-center gap-3 border-b border-[#282C34] px-4">
          <Search className="h-4 w-4 text-[#5B626C]" strokeWidth={1.75} />
          <CommandPrimitive.Input
            autoFocus
            className="h-full flex-1 bg-transparent text-[13px] text-[#EDF0F3] outline-none placeholder:text-[#5B626C]"
            placeholder="Search agents, vendors, escalations, actions..."
          />
          <KeyHint>ESC</KeyHint>
        </div>
        <CommandPrimitive.List className="max-h-[520px] overflow-y-auto p-2">
          <CommandPrimitive.Empty className="px-3 py-8 text-center font-cond text-[18px] tracking-[0.1em] text-[#FF5A1F]">
            NO COMMAND MATCH
          </CommandPrimitive.Empty>

          <PaletteGroup heading="NAVIGATE">
            {navigationItems.map(([label, href, shortcut]) => (
              <PaletteItem key={href} value={`${label} ${href}`} onSelect={() => navigate(href)}>
                <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{label}</span>
                <KeyHint>{shortcut}</KeyHint>
              </PaletteItem>
            ))}
          </PaletteGroup>

          <PaletteGroup heading="AGENTS">
            {agentItems.map((agent) => (
              <PaletteItem
                key={agent.id}
                value={`${agent.name} ${agent.wallet}`}
                onSelect={() => navigate(`/agents/${agent.wallet}`)}
              >
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{agent.name}</span>
                <span className="ml-auto text-[10px] text-[#5B626C]">{agent.wallet}</span>
              </PaletteItem>
            ))}
          </PaletteGroup>

          <PaletteGroup heading="VENDORS">
            {vendorItems.map((vendor) => (
              <PaletteItem
                key={vendor.id}
                value={`${vendor.name} ${vendor.address}`}
                onSelect={() => navigate("/vendors")}
              >
                <ListChecks className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>{vendor.name}</span>
                <span className="ml-auto text-[10px] text-[#5B626C]">{vendor.address}</span>
              </PaletteItem>
            ))}
          </PaletteGroup>

          <PaletteGroup heading="ESCALATIONS">
            {escalationItems.map((item) => (
              <PaletteItem key={item.href} value={item.search} onSelect={() => navigate(item.href)}>
                <ShieldAlert className="h-3.5 w-3.5 text-[#FF5A1F]" strokeWidth={1.75} />
                <span>{item.label}</span>
              </PaletteItem>
            ))}
          </PaletteGroup>

          <PaletteGroup heading="ACTIONS">
            <PaletteItem
              value={`toggle density ${density}`}
              onSelect={() =>
                run(() => {
                  const next = toggleDensity();
                  toast.success(`DENSITY ${next.toUpperCase()}`);
                })
              }
            >
              {density === "compact" ? (
                <Rows3 className="h-3.5 w-3.5" />
              ) : (
                <Rows2 className="h-3.5 w-3.5" />
              )}
              <span>Toggle density</span>
              <KeyHint>{density.toUpperCase()}</KeyHint>
            </PaletteItem>
            <PaletteItem
              value={`toggle presentation mode ${presentationMode ? "on" : "off"}`}
              onSelect={() =>
                run(() => {
                  const next = togglePresentationMode();
                  toast.success(next ? "PRESENTATION MODE ACTIVE" : "PRESENTATION MODE OFF");
                })
              }
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Toggle presentation mode</span>
              <KeyHint>CTRL SHIFT P</KeyHint>
            </PaletteItem>
            <PaletteItem value="print page" onSelect={() => run(() => window.print())}>
              <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Print page</span>
              <KeyHint>PRINT</KeyHint>
            </PaletteItem>
          </PaletteGroup>
        </CommandPrimitive.List>
      </CommandPrimitive>
    </>
  );
}

function PaletteGroup({ heading, children }: Readonly<{ heading: string; children: ReactNode }>) {
  return (
    <CommandPrimitive.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-cond [&_[cmdk-group-heading]]:text-[13px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-[#8A909B]"
    >
      {children}
    </CommandPrimitive.Group>
  );
}

function PaletteItem({
  children,
  value,
  onSelect,
}: Readonly<{ children: ReactNode; value: string; onSelect: () => void }>) {
  return (
    <CommandPrimitive.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 px-3 text-[12px] outline-none",
        "aria-selected:bg-[#1B1F26] aria-selected:text-[#EDF0F3] text-[#D7DBE0]",
      )}
    >
      {children}
    </CommandPrimitive.Item>
  );
}

function KeyHint({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="ml-auto border border-[#282C34] bg-[#101216] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[#8A909B]">
      {children}
    </span>
  );
}
