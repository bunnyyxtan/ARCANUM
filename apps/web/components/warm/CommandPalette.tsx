"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { useLiveEscalations } from "@/lib/live-data";

const SAMPLE_WALLET = "0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7";

type Entry = { label: string; meta: "ACTION" | "NAVIGATE"; href: string; hint?: string };

export function CommandPalette() {
  const router = useRouter();
  const { address } = useAccount();
  const { data: pendingEscalations } = useLiveEscalations("PENDING");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const nextEscalation = pendingEscalations[0];
    const approveHint = nextEscalation
      ? `${nextEscalation.agentName} · $${nextEscalation.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : undefined;
    const explorerHref = address ? `/explorer/${address}` : `/explorer/${SAMPLE_WALLET}`;
    const badgeHref = address ? `/badge/${address}` : `/badge/${SAMPLE_WALLET}`;

    return [
      {
        label: "Approve next escalation",
        meta: "ACTION",
        href: nextEscalation ? `/approve/${nextEscalation.id}` : "/escalations",
        hint: approveHint,
      },
      { label: "Freeze an agent", meta: "ACTION", href: "/agents", hint: "policy hold" },
      { label: "Add vendor", meta: "ACTION", href: "/vendors", hint: "allowlist" },
      { label: "Open dashboard", meta: "NAVIGATE", href: "/dashboard" },
      { label: "Inspect agents", meta: "NAVIGATE", href: "/agents" },
      { label: "Browse vendors", meta: "NAVIGATE", href: "/vendors" },
      { label: "Read ledger", meta: "NAVIGATE", href: "/ledger" },
      { label: "Review escalations", meta: "NAVIGATE", href: "/escalations" },
      { label: "Review anomalies", meta: "NAVIGATE", href: "/anomalies" },
      { label: "Open settings", meta: "NAVIGATE", href: "/settings" },
      { label: "Check network status", meta: "NAVIGATE", href: "/status" },
      { label: "Read the guide", meta: "NAVIGATE", href: "/docs" },
      { label: "Browse glossary", meta: "NAVIGATE", href: "/glossary" },
      { label: "Open public explorer", meta: "NAVIGATE", href: explorerHref },
      { label: "View trust badge", meta: "NAVIGATE", href: badgeHref },
    ];
  }, [address, pendingEscalations]);

  const filtered = useMemo(
    () => entries.filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase())),
    [entries, query],
  );
  const groups = useMemo(() => {
    const actions = filtered.filter((entry) => entry.meta === "ACTION");
    const navigate = filtered.filter((entry) => entry.meta === "NAVIGATE");
    return [
      { title: "QUICK ACTIONS", items: actions },
      { title: "GO TO", items: navigate },
    ].filter((group) => group.items.length > 0);
  }, [filtered]);

  const stateRef = useRef({ open, filtered, cursor });
  stateRef.current = { open, filtered, cursor };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const run = (entry: Entry) => {
    router.push(entry.href);
    close();
  };

  const onNavKey = (event: {
    key: string;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    const { filtered: items, cursor: index } = stateRef.current;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setCursor((value) => Math.min(value + 1, items.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setCursor((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (items[index]) run(items[index]);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only global key handler; reads live state via stateRef
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!stateRef.current.open) return;
      // If the palette is open but the input lost focus, reclaim it so typed
      // characters always land in the search box (Enter would otherwise act
      // on the unfiltered list). Keys typed into the input are handled by the
      // input's own onKeyDown, which stops propagation before reaching here.
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          setQuery((value) => value + event.key);
          return;
        }
        onNavKey(event);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset cursor whenever the query changes
  useEffect(() => {
    setCursor(0);
  }, [query]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the active row into view when the cursor moves
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let flatIndex = -1;

  return (
    <>
      <style>{`
        @keyframes cmdBackdrop{from{opacity:0}to{opacity:1}}
        @keyframes cmdPanel{from{opacity:0;transform:translateY(-14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        .cmd-backdrop{animation:cmdBackdrop 200ms ease both}
        .cmd-panel{animation:cmdPanel 300ms cubic-bezier(.16,1,.3,1) 40ms both}
        .cmd-row{transition:background 140ms ease,box-shadow 140ms ease}
        .cmd-row[data-active="true"]{background:var(--wl-bg-tint2);box-shadow:inset 2px 0 0 var(--wl-signal)}
        .cmd-row[data-active="true"] .cmd-go{opacity:1;transform:translateX(0)}
        .cmd-go{opacity:0;transform:translateX(-5px);transition:opacity 140ms ease,transform 180ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.cmd-backdrop,.cmd-panel{animation:none}}
      `}</style>
      <button
        type="button"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-full border border-[var(--wl-line)] px-2.5 py-1 font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] transition-colors hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)] md:flex"
      >
        <span className="text-[10px]">⌘</span>K
      </button>
      {open && (
        <div
          className="cmd-backdrop fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(var(--wl-ink-rgb),.28)] px-5 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onClick={close}
        >
          <div
            className="cmd-panel w-full max-w-[580px] overflow-hidden border border-[var(--wl-line-bold)] bg-[var(--wl-bg)] shadow-[0_28px_70px_-18px_rgba(var(--wl-ink-rgb),.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--wl-line-soft)] px-5 py-4">
              <span className="font-mono text-[13px] text-[var(--wl-signal)]">⌕</span>
              <input
                autoFocus
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onNavKey}
                placeholder="Search actions and pages…"
                className="w-full bg-transparent text-[15px] tracking-[-.01em] outline-none placeholder:text-[var(--wl-mute)]"
              />
              <button
                type="button"
                onClick={close}
                className="rounded border border-[var(--wl-line)] px-1.5 py-0.5 font-mono text-[8.5px] tracking-[.08em] text-[var(--wl-mute)] transition-colors hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
              >
                ESC
              </button>
            </div>
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto overscroll-contain p-2">
              {groups.length === 0 && (
                <p className="px-4 py-8 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-mute)]">
                  NO MATCHES · TRY “LEDGER” OR “VENDOR”
                </p>
              )}
              {groups.map((group) => (
                <div key={group.title} className="mb-1">
                  <p className="px-3 pb-1.5 pt-2.5 font-mono text-[8.5px] tracking-[.2em] text-[var(--wl-muted)]">
                    {group.title}
                  </p>
                  {group.items.map((entry) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        data-active={index === cursor}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => run(entry)}
                        className="cmd-row flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-6 w-6 items-center justify-center border font-mono text-[10px] ${entry.meta === "ACTION" ? "border-[var(--wl-signal)] text-[var(--wl-signal)]" : "border-[var(--wl-line-soft)] text-[var(--wl-mute)]"}`}
                          >
                            {entry.meta === "ACTION" ? "!" : "→"}
                          </span>
                          <span>
                            <span className="block text-[13.5px] tracking-[-.01em]">
                              {entry.label}
                            </span>
                            {entry.hint && (
                              <span className="mt-0.5 block font-mono text-[8.5px] tracking-[.08em] text-[var(--wl-muted)]">
                                {entry.hint.toUpperCase()}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[8.5px] tracking-[.13em] ${entry.meta === "ACTION" ? "text-[var(--wl-signal)]" : "text-[var(--wl-mute)]"}`}
                          >
                            {entry.meta}
                          </span>
                          <span className="cmd-go font-mono text-[11px] text-[var(--wl-signal)]">
                            ↵
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--wl-line-soft)] px-5 py-2.5 font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-mute)]">
              <span className="flex items-center gap-3">
                <span>
                  <kbd className="mr-1 rounded border border-[var(--wl-line)] px-1 py-px">↑↓</kbd>
                  MOVE
                </span>
                <span>
                  <kbd className="mr-1 rounded border border-[var(--wl-line)] px-1 py-px">↵</kbd>
                  SELECT
                </span>
                <span>
                  <kbd className="mr-1 rounded border border-[var(--wl-line)] px-1 py-px">ESC</kbd>
                  CLOSE
                </span>
              </span>
              <span className="text-[var(--wl-signal)]">ARCANUM / COMMAND</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
