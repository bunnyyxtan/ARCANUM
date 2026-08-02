import { useEffect, useRef, useState } from "react";

const entries = [
  { label: "Approve next escalation", meta: "ACTION", nav: "APPROVE" },
  { label: "Freeze an agent", meta: "ACTION", nav: "AGENTS" },
  { label: "Add vendor", meta: "ACTION", nav: "VENDORS" },
  { label: "Open dashboard", meta: "NAVIGATE", nav: "DASHBOARD" },
  { label: "Inspect agents", meta: "NAVIGATE", nav: "AGENTS" },
  { label: "Browse vendors", meta: "NAVIGATE", nav: "VENDORS" },
  { label: "Read ledger", meta: "NAVIGATE", nav: "LEDGER" },
  { label: "Review escalations", meta: "NAVIGATE", nav: "ESCALATIONS" },
  { label: "Review anomalies", meta: "NAVIGATE", nav: "ANOMALIES" },
  { label: "Open settings", meta: "NAVIGATE", nav: "SETTINGS" },
  { label: "Check network status", meta: "NAVIGATE", nav: "STATUS" },
  { label: "Read the guide", meta: "NAVIGATE", nav: "DOCS" },
  { label: "Browse glossary", meta: "NAVIGATE", nav: "GLOSSARY" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = entries.filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (!open) return;
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown") { event.preventDefault(); setCursor((value) => Math.min(value + 1, filtered.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)); }
      if (event.key === "Enter" && filtered[cursor]) { document.querySelector(`[data-nav="${filtered[cursor].nav}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true })); setOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, cursor]);
  useEffect(() => { if (open) { setCursor(0); window.setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  return <>{<button type="button" aria-label="Open command palette" onClick={() => setOpen(true)} className="hidden rounded-full border border-[#ded7d0] px-2.5 py-1 font-mono text-[9px] tracking-[.1em] text-[#837a72] transition-colors hover:border-[#292522] hover:text-[#292522] md:block">⌘K</button>}{open && <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(41,37,34,.14)] px-5 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => setOpen(false)}><div className="w-full max-w-[560px] border border-[#bdb4aa] bg-[#faf6f1] shadow-[14px_18px_0_#e7e0d9]" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-[#ded7d0] px-5 py-4"><span className="font-mono text-[12px] text-[#ff3c00]">⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions and pages" className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#9b9289]" /><kbd className="font-mono text-[9px] text-[#9b9289]">ESC</kbd></div><div className="p-2">{filtered.map((entry, index) => <button type="button" key={entry.label} data-nav={entry.nav} onClick={() => setOpen(false)} className={`flex w-full items-center justify-between px-3 py-3 text-left transition-colors ${index === cursor ? "bg-[#f5f0ea]" : ""}`}><span className="text-[13px]">{entry.label}</span><span className={`font-mono text-[9px] tracking-[.13em] ${entry.meta === "ACTION" ? "text-[#ff3c00]" : "text-[#9b9289]"}`}>{entry.meta}</span></button>)}</div><div className="border-t border-[#ded7d0] px-5 py-3 font-mono text-[9px] text-[#9b9289]">↑↓ MOVE <span className="mx-2">·</span> ENTER SELECT <span className="mx-2">·</span> ESC CLOSE</div></div></div>}</>;
}