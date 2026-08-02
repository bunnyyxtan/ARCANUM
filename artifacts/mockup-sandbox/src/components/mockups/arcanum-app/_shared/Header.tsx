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
    <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-[#ded7d0] px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-7">
        <button type="button" onClick={onLogo} className="shrink-0 text-[18px] font-bold tracking-[-.05em] transition-transform duration-[220ms] hover:-translate-y-0.5">
          ARCANUM<span className="text-[#ff3c00]">.</span>
        </button>
        <nav className="flex min-w-0 gap-5 overflow-x-auto pb-0.5">
          {links.map((link) => (
            <a key={link} data-nav={link} href={`#${link.toLowerCase()}`} className={`relative whitespace-nowrap py-6 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] hover:text-[#292522] ${active === link ? "text-[#292522] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#ff3c00]" : "text-[#655d56]"}`}>{link}</a>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289] sm:inline">ARC TESTNET</span>
        <div className="relative" data-notifications>
          <button type="button" aria-label="Governance notifications" aria-expanded={notifications} onClick={() => setNotifications((value) => !value)} className="relative flex h-8 w-8 items-center justify-center text-[#655d56] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[#ff3c00]">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4.5 8.5a5.5 5.5 0 0 1 11 0c0 5 2 5 2 6H2.5c0-1 2-1 2-6ZM8 17h4" /></svg>
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ff3c00]" />
          </button>
          {notifications && <div role="dialog" aria-label="Recent governance events" className="absolute right-0 top-[calc(100%+10px)] z-30 w-[300px] border border-[#cfc5bc] bg-[#fbf8f4] p-4 shadow-[12px_14px_0_#e7e0d9]">
            <div className="flex items-center justify-between border-b border-[#ded7d0] pb-3"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">INBOX / GOVERNANCE</p><span className="font-mono text-[9px] text-[#9b9289]">03 NEW</span></div>
            <div className="divide-y divide-[#e3dcd5]">
              {[["RESTRAINT", "growth-bot wallet placed on policy hold", "2m ago"], ["ESCALATION", "ESC-042 is awaiting operator approval", "18m ago"], ["ANOMALY", "support-agent crossed retry threshold", "41m ago"]].map(([kind, text, time]) => <button type="button" key={kind} onClick={() => setNotifications(false)} className="block w-full py-3 text-left transition-colors hover:text-[#ff3c00]"><span className="font-mono text-[9px] tracking-[.13em] text-[#ff3c00]">{kind}</span><span className="mt-1 block text-[12px] leading-[1.35] text-[#292522]">{text}</span><span className="mt-1 block font-mono text-[9px] text-[#9b9289]">{time}</span></button>)}
            </div>
          </div>}
        </div>
        <CommandPalette />
        <div className="relative">
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 rounded-full border border-[#ded7d0] px-2.5 py-1.5 text-left transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[#292522] sm:px-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span>
            <span className="hidden text-[12px] font-medium sm:inline">HELIX-DAO</span><span className={`font-mono text-[10px] text-[#837a72] transition-transform duration-[220ms] ${open ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {open && <div className="absolute right-0 top-[calc(100%+10px)] w-[250px] border border-[#cfc5bc] bg-[#fbf8f4] p-4 shadow-[12px_14px_0_#e7e0d9]">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">WALLET / OPERATOR</p>
            <p className="mt-3 text-[14px] font-medium">HELIX-DAO</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-mono text-[10px] text-[#837a72]">0x71…4be1</p>
              <button type="button" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText("0x71f39c2e84be1"); setCopiedAddress(true); window.setTimeout(() => setCopiedAddress(false), 1500); }} className="font-mono text-[8.5px] tracking-[.1em] text-[#ff3c00] transition-colors hover:text-[#d63200]">{copiedAddress ? "COPIED" : "COPY"}</button>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[.1em] text-[#3f653e]"><span className="h-1.5 w-1.5 rounded-full bg-[#3f653e]" />ARC TESTNET · CONNECTED</p>
            <div className="mt-4 border-t border-[#ded7d0] pt-2">
               <a data-nav="EXPLORER" href="#explorer" className="block border-b border-[#e3dcd5] py-3 font-mono text-[10px] tracking-[.12em] text-[#655d56] transition-colors hover:text-[#ff3c00]">VIEW IN EXPLORER ↗</a>
               <a data-nav="SETTINGS" href="#settings" className="block border-b border-[#e3dcd5] py-3 font-mono text-[10px] tracking-[.12em] text-[#655d56] transition-colors hover:text-[#ff3c00]">SETTINGS</a>
               <a data-nav="STATUS" href="#status" className="block border-b border-[#e3dcd5] py-3 font-mono text-[10px] tracking-[.12em] text-[#655d56] transition-colors hover:text-[#ff3c00]">STATUS</a>
              <button type="button" data-nav="LANDING" className="w-full py-3 text-left font-mono text-[10px] tracking-[.12em] text-[#837a72] transition-colors hover:text-[#ff3c00]">DISCONNECT</button>
            </div>
          </div>}
        </div>
      </div>
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      {children}
    </header>
  );
}