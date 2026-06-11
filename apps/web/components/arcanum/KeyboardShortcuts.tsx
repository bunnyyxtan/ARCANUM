"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  closeArcanumOverlays,
  isTypingTarget,
  openCommandPalette,
  setPresentationMode,
  togglePresentationMode,
} from "@/lib/arcanum-preferences";

const routes: Record<string, string> = {
  o: "/dashboard",
  a: "/agents",
  v: "/vendors",
  l: "/ledger",
  e: "/escalations",
  n: "/anomalies",
  s: "/settings",
  d: "/docs",
};

export function KeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();
  const armedUntil = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clearArmed = () => {
      armedUntil.current = 0;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        closeArcanumOverlays();
        setHelpOpen(false);
        setPresentationMode(false);
        clearArmed();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "p") {
        event.preventDefault();
        const active = togglePresentationMode();
        toast.success(active ? "PRESENTATION MODE ACTIVE" : "PRESENTATION MODE OFF");
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const now = window.performance.now();
      if (key === "g") {
        armedUntil.current = now + 800;
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
        }
        timer.current = window.setTimeout(clearArmed, 800);
        return;
      }

      if (armedUntil.current > now && routes[key]) {
        event.preventDefault();
        const href = routes[key];
        clearArmed();
        router.push(href);
      }
    };

    const close = () => setHelpOpen(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("arcanum:close-overlays", close);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("arcanum:close-overlays", close);
      clearArmed();
    };
  }, [router]);

  return (
    <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
      <SheetContent className="arcanum-shortcuts-sheet w-[460px] border-[#282C34] bg-[#15171B] p-0 font-mono text-[#D7DBE0]">
        <SheetHeader className="border-b border-[#282C34] px-5 py-4">
          <SheetTitle className="font-cond text-[24px] font-bold tracking-[0.08em] text-[#EDF0F3]">
            KEYBOARD SHORTCUTS
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[#8A909B]">
            Operator navigation and demo controls.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-5 py-5">
          <ShortcutGroup title="NAVIGATE">
            <Shortcut keys={["G", "O"]} label="Dashboard" />
            <Shortcut keys={["G", "A"]} label="Agents" />
            <Shortcut keys={["G", "V"]} label="Vendors" />
            <Shortcut keys={["G", "L"]} label="Ledger" />
            <Shortcut keys={["G", "E"]} label="Escalations" />
            <Shortcut keys={["G", "N"]} label="Anomalies" />
            <Shortcut keys={["G", "S"]} label="Settings" />
            <Shortcut keys={["G", "D"]} label="Docs" />
          </ShortcutGroup>
          <ShortcutGroup title="COMMANDS">
            <Shortcut keys={["CMD/CTRL", "K"]} label="Command palette" />
            <Shortcut keys={["CMD/CTRL", "SHIFT", "P"]} label="Presentation mode" />
            <Shortcut keys={["?"]} label="Shortcut help" />
            <Shortcut keys={["ESC"]} label="Close overlays / exit presentation" />
          </ShortcutGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ShortcutGroup({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section>
      <div className="font-cond text-[13px] font-semibold tracking-[0.22em] text-[#8A909B]">
        {title}
      </div>
      <div className="mt-2 divide-y divide-[#1E222A] border border-[#282C34]">{children}</div>
    </section>
  );
}

function Shortcut({ keys, label }: Readonly<{ keys: readonly string[]; label: string }>) {
  return (
    <div className="flex h-10 items-center justify-between px-3 text-[12px]">
      <span className="text-[#D7DBE0]">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((key) => (
          <KeyHint key={key}>{key}</KeyHint>
        ))}
      </span>
    </div>
  );
}

function KeyHint({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="border border-[#282C34] bg-[#101216] px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-[#8A909B]">
      {children}
    </span>
  );
}
