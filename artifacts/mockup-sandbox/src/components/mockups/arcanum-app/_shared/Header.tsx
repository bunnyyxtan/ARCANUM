import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";

type HeaderProps = { active?: string; onLogo?: () => void; children?: ReactNode };

const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

export function Header({ active, onLogo, children }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
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
      if (!(event.target as HTMLElement).closest("[data-notifications]")) setNotifications(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, []);
  return (
    <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-[var(--wl-line)] px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-7">
        <button type="button" onClick={onLogo} className="shrink-0 text-[18px] font-bold tracking-[-.05em] transition-transform duration-[220ms] hover:-translate-y-0.5">
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </button>
        <nav className="flex min-w-0 gap-5 overflow-x-auto pb-0.5">
          {links.map((link) => (
            <a key={link} data-nav={link} href={`#${link.toLowerCase()}`} className={`relative whitespace-nowrap py-6 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] hover:text-[var(--wl-ink)] ${active === link ? "text-[var(--wl-ink)] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[var(--wl-signal)]" : "text-[var(--wl-body)]"}`}>{link}</a>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">ARC TESTNET</span>
        <button type="button" data-theme-toggle aria-label="Toggle dark mode" className="flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)]">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-moon h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" /></svg>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-sun h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="10" cy="10" r="4" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16" /></svg>
        </button>
        <div className="relative" data-notifications>
          <button type="button" aria-label="Governance notifications" aria-expanded={notifications} onClick={() => setNotifications((value) => !value)} className="relative flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)]">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4.5 8.5a5.5 5.5 0 0 1 11 0c0 5 2 5 2 6H2.5c0-1 2-1 2-6ZM8 17h4" /></svg>
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--wl-signal)]" />
          </button>
          {notifications && <div role="dialog" aria-label="Recent governance events" className="absolute right-0 top-[calc(100%+10px)] z-30 w-[300px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-4 shadow-[12px_14px_0_var(--wl-line-faint)]">
            <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-3"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">INBOX / GOVERNANCE</p><span className="font-mono text-[9px] text-[var(--wl-mute)]">03 NEW</span></div>
            <div className="divide-y divide-[var(--wl-line-soft)]">
              {[["RESTRAINT", "growth-bot wallet placed on policy hold", "2m ago"], ["ESCALATION", "ESC-042 is awaiting operator approval", "18m ago"], ["ANOMALY", "support-agent crossed retry threshold", "41m ago"]].map(([kind, text, time]) => <button type="button" key={kind} onClick={() => setNotifications(false)} className="block w-full py-3 text-left transition-colors hover:text-[var(--wl-signal)]"><span className="font-mono text-[9px] tracking-[.13em] text-[var(--wl-signal)]">{kind}</span><span className="mt-1 block text-[12px] leading-[1.35] text-[var(--wl-ink)]">{text}</span><span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">{time}</span></button>)}
            </div>
          </div>}
        </div>
        <CommandPalette />
        <div className="relative">
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-2.5 py-1.5 text-left transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-ink)] sm:px-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--wl-ink)] font-mono text-[9px] text-[var(--wl-bg)]">HD</span>
            <span className="hidden text-[12px] font-medium sm:inline">HELIX-DAO</span><span className={`font-mono text-[10px] text-[var(--wl-secondary)] transition-transform duration-[220ms] ${open ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {open && <div className="absolute right-0 top-[calc(100%+10px)] w-[250px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-4 shadow-[12px_14px_0_var(--wl-line-faint)]">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">WALLET / OPERATOR</p>
            <p className="mt-3 text-[14px] font-medium">HELIX-DAO</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-[10px] text-[var(--wl-secondary)]">0x71…4be1</p>
              <button type="button" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText("0x71f39c2e84be1"); setCopiedAddress(true); window.setTimeout(() => setCopiedAddress(false), 1500); }} className="font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-signal)] transition-colors hover:text-[var(--wl-signal-deep)]">{copiedAddress ? "COPIED" : "COPY"}</button>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-green)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--wl-green)]" />ARC TESTNET · CONNECTED</p>
            <div className="mt-4 border-t border-[var(--wl-line)] pt-2">
               <a data-nav="EXPLORER" href="#explorer" className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]">VIEW IN EXPLORER ↗</a>
               <a data-nav="SETTINGS" href="#settings" className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]">SETTINGS</a>
               <a data-nav="STATUS" href="#status" className="block border-b border-[var(--wl-line-soft)] py-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]">STATUS</a>
              <button type="button" data-nav="LANDING" className="w-full py-3 text-left font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]">DISCONNECT</button>
            </div>
          </div>}
        </div>
      </div>
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      {children}
    </header>
  );
}