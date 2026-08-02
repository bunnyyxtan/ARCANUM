import { useState, type ReactNode } from "react";

type HeaderProps = { active?: string; onLogo?: () => void; children?: ReactNode };

const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

export function Header({ active, onLogo, children }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-20 flex h-[68px] items-center justify-between border-b border-[#ded7d0] px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-7">
        <button type="button" onClick={onLogo} className="shrink-0 text-[18px] font-bold tracking-[-.06em] transition-transform duration-[220ms] hover:-translate-y-0.5">
          ARCANUM<span className="text-[#ff3c00]">.</span>
        </button>
        <nav className="flex min-w-0 gap-5 overflow-x-auto pb-0.5">
          {links.map((link) => (
            <a key={link} href={`#${link.toLowerCase()}`} className={`relative whitespace-nowrap py-6 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] hover:text-[#292522] ${active === link ? "text-[#292522] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#ff3c00]" : "text-[#655d56]"}`}>{link}</a>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289] sm:inline">ARC TESTNET</span>
        <div className="relative">
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="group flex items-center gap-2 rounded-full border border-[#ded7d0] px-2.5 py-1.5 text-left transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[#292522] sm:px-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span>
            <span className="hidden text-[12px] font-medium sm:inline">HELIX-DAO</span><span className={`font-mono text-[10px] text-[#837a72] transition-transform duration-[220ms] ${open ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {open && <div className="absolute right-0 top-[calc(100%+10px)] w-[250px] border border-[#cfc5bc] bg-[#fbf8f4] p-4 shadow-[12px_14px_0_#e7e0d9]">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">WALLET / OPERATOR</p>
            <p className="mt-3 text-[14px] font-medium">HELIX-DAO</p>
            <p className="mt-1 font-mono text-[10px] text-[#837a72]">0x71…4be1 · ARC TESTNET</p>
            <div className="mt-4 border-t border-[#ded7d0] pt-2">
              <a href="#settings" className="block border-b border-[#e3dcd5] py-3 font-mono text-[10px] tracking-[.12em] text-[#655d56] transition-colors hover:text-[#ff3c00]">SETTINGS</a>
              <a href="#status" className="block border-b border-[#e3dcd5] py-3 font-mono text-[10px] tracking-[.12em] text-[#655d56] transition-colors hover:text-[#ff3c00]">STATUS</a>
              <button type="button" onClick={() => setOpen(false)} className="w-full py-3 text-left font-mono text-[10px] tracking-[.12em] text-[#837a72] transition-colors hover:text-[#292522]">DISCONNECT</button>
            </div>
          </div>}
        </div>
      </div>
      {children}
    </header>
  );
}