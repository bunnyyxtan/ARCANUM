"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";

import { useLiveAnomalies, useLiveEscalations } from "@/lib/live-data";

import { CommandPalette } from "./CommandPalette";
import { ConnectModal } from "./landing/ConnectModal";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { ThemeToggle } from "./ThemeToggle";

type HeaderProps = { children?: ReactNode };

const links = [
  { label: "DASHBOARD", href: "/dashboard" },
  { label: "AGENTS", href: "/agents" },
  { label: "VENDORS", href: "/vendors" },
  { label: "LEDGER", href: "/ledger" },
  { label: "ESCALATIONS", href: "/escalations" },
  { label: "ANOMALIES", href: "/anomalies" },
] as const;

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Header({ children }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: pendingEscalations } = useLiveEscalations("PENDING");
  const { data: anomalies } = useLiveAnomalies();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const inboxItems = [
    ...pendingEscalations.slice(0, 3).map((item) => ({
      kind: "ESCALATION" as const,
      text: `${item.id} is awaiting operator approval`,
      time: item.expiresIn ? `expires ${item.expiresIn}` : "pending",
      href: `/escalations`,
    })),
    ...anomalies.slice(0, 3).map((item) => ({
      kind: "ANOMALY" as const,
      text: `${item.agentName} crossed the ${item.score.toFixed(1)}σ threshold`,
      time: item.timestamp,
      href: `/anomalies`,
    })),
  ].slice(0, 4);
  const inboxCount = inboxItems.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "?") {
        const target = event.target as HTMLElement;
        const typing =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable;
        const paletteOpen = !!document.querySelector('[aria-label="Command palette"]');
        if (!typing && !paletteOpen && !event.metaKey && !event.ctrlKey && !event.altKey) setShortcuts(true);
      }
      if (event.key === "Escape") {
        setNotifications(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-notifications]")) setNotifications(false);
      if (!target.closest("[data-account-menu]")) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const shortAddress = address ? truncateAddress(address) : null;

  return (
    <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-[var(--wl-line)] bg-[var(--wl-bg)] px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-7">
        <Link href="/" className="font-display shrink-0 text-[18px] font-bold tracking-[-.015em] transition-transform duration-[220ms] hover:-translate-y-0.5">
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </Link>
        <nav className="flex min-w-0 gap-5 overflow-x-auto pb-0.5">
          {links.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                className={`relative whitespace-nowrap py-6 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] hover:text-[var(--wl-ink)] ${active ? "text-[var(--wl-ink)] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[var(--wl-signal)]" : "text-[var(--wl-body)]"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">ARC TESTNET</span>
        <ThemeToggle />
        <div className="relative" data-notifications>
          <button
            type="button"
            aria-label="Governance notifications"
            aria-expanded={notifications}
            onClick={() => setNotifications((value) => !value)}
            className="relative flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M4.5 8.5a5.5 5.5 0 0 1 11 0c0 5 2 5 2 6H2.5c0-1 2-1 2-6ZM8 17h4" />
            </svg>
            {inboxCount > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--wl-signal)]" />
            )}
          </button>
          {notifications && (
            <div
              role="dialog"
              aria-label="Recent governance events"
              className="absolute right-0 top-[calc(100%+10px)] z-30 w-[300px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-4 shadow-[12px_14px_0_var(--wl-line-faint)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-3">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">
                  INBOX / GOVERNANCE
                </p>
                <span className="font-mono text-[9px] text-[var(--wl-mute)]">
                  {String(inboxCount).padStart(2, "0")} NEW
                </span>
              </div>
              {inboxCount === 0 ? (
                <p className="py-8 text-center font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  INBOX CLEAR · NO PENDING GOVERNANCE
                </p>
              ) : (
                <div className="divide-y divide-[var(--wl-line-soft)]">
                  {inboxItems.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.kind}-${index}`}
                      onClick={() => {
                        setNotifications(false);
                        router.push(item.href);
                      }}
                      className="block w-full py-3 text-left transition-colors hover:text-[var(--wl-signal)]"
                    >
                      <span className="font-mono text-[9px] tracking-[.13em] text-[var(--wl-signal)]">
                        {item.kind}
                      </span>
                      <span className="mt-1 block text-[12px] leading-[1.35] text-[var(--wl-ink)]">
                        {item.text}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                        {item.time}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <CommandPalette />
        <div className="relative" data-account-menu>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="group flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-2.5 py-1.5 text-left transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-ink)] sm:px-3"
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--wl-ink)] font-mono text-[9px] text-[var(--wl-bg)]">
              {shortAddress ? shortAddress.slice(2, 4).toUpperCase() : "RO"}
            </span>
            <span className="hidden font-mono text-[11px] font-medium sm:inline">{shortAddress ?? "READ-ONLY"}</span>
            <span className={`font-mono text-[10px] text-[var(--wl-secondary)] transition-transform duration-[220ms] ${open ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {open && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[250px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-4 shadow-[12px_14px_0_var(--wl-line-faint)]">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">WALLET / OPERATOR</p>
              <p className="mt-3 text-[14px] font-medium">{isConnected ? "CONNECTED OPERATOR" : "READ-ONLY PREVIEW"}</p>
              {address && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-[10px] text-[var(--wl-secondary)]">{truncateAddress(address)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) void navigator.clipboard.writeText(address);
                      setCopiedAddress(true);
                      window.setTimeout(() => setCopiedAddress(false), 1500);
                    }}
                    className="font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-signal)] transition-colors hover:text-[var(--wl-signal-deep)]"
                  >
                    {copiedAddress ? "COPIED" : "COPY"}
                  </button>
                </div>
              )}
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-green)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--wl-green)]" />
                ARC TESTNET · {isConnected ? "CONNECTED" : "VIEWING"}
              </p>
              <div className="mt-4 border-t border-[var(--wl-line)] pt-2">
                {address && (
                  <Link
                    href={`/explorer/${address}`}
                    onClick={() => setOpen(false)}
                    className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]"
                  >
                    VIEW IN EXPLORER ↗
                  </Link>
                )}
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]"
                >
                  SETTINGS
                </Link>
                <Link
                  href="/status"
                  onClick={() => setOpen(false)}
                  className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]"
                >
                  STATUS
                </Link>
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setOpen(false);
                      router.push("/");
                    }}
                    className="w-full py-3 text-left font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
                  >
                    DISCONNECT
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setConnectOpen(true);
                    }}
                    className="w-full py-3 text-left font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
                  >
                    CONNECT WALLET
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      {children}
    </header>
  );
}
