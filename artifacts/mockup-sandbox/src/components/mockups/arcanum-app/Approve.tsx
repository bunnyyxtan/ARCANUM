import { useState, type ReactNode } from "react";

type Decision = "idle" | "signing" | "approved" | "rejected";

function ActionPill({ children, onClick, quiet = false }: { children: ReactNode; onClick: () => void; quiet?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`group relative overflow-hidden rounded-full px-5 py-3 text-[11px] font-semibold transition duration-[220ms] hover:-translate-y-0.5 ${quiet ? "border border-[#ded7d0] text-[#292522] hover:border-[#292522]" : "bg-[#ff3c00] text-[#faf6f1] hover:shadow-[0_10px_26px_-9px_rgba(255,60,0,.5)]"}`}>
      <span className="relative z-10">{children} <span className="ml-2 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">↗</span></span>
    </button>
  );
}

export function Approve() {
  const [decision, setDecision] = useState<Decision>("idle");
  const [notice, setNotice] = useState("");
  const begin = (next: "approved" | "rejected") => {
    setDecision("signing");
    window.setTimeout(() => {
      setDecision(next);
      setNotice(next === "approved" ? "Approval signed and committed to the public ledger." : "Rejection signed and recorded. No funds moved.");
    }, 900);
  };
  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');.font-mono{font-family:'DM Mono',monospace}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.rise{animation:rise 500ms cubic-bezier(.16,1,.3,1) both}@media(prefers-reduced-motion:reduce){.rise{animation:none}}`}</style>
      <nav className="flex items-center justify-between border-b border-[#ded7d0] px-5 py-5 md:px-9">
        <button type="button" data-nav="LANDING" className="text-[18px] font-bold tracking-[-.05em]">ARCANUM<span className="text-[#ff3c00]">.</span></button>
        <div className="flex items-center gap-5"><span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289] sm:inline">PUBLIC APPROVER PORTAL</span><span className="rounded-full border border-[#ded7d0] px-3 py-1.5 font-mono text-[9px] tracking-[.12em] text-[#655d56]">ARC TESTNET</span></div>
      </nav>
      <div className="mx-auto max-w-[1080px] px-5 py-10 md:px-9 md:py-16">
        <header className="rise border-b border-[#ded7d0] pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#ff3c00]">QUORUM / HUMAN SIGNATURE</p>
          <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><h1 className="text-[clamp(3rem,7vw,6rem)] font-semibold leading-[.84] tracking-[-.045em]">A decision<br /><span className="text-[#8d837b]">awaits you.</span></h1><p className="mt-6 max-w-[430px] text-[14px] leading-[1.5] text-[#655d56]">This request reached the edge of growth-bot&apos;s policy. Read the record, then sign your decision.</p></div><span className="w-fit border border-[#ff3c00] px-3 py-2 font-mono text-[9px] tracking-[.16em] text-[#ff3c00]">ESC-041 · PENDING</span></div>
        </header>
        <section className="rise mt-10 grid border border-[#cfc5bc] bg-[#fbf8f4] shadow-[12px_14px_0_#eee7df] md:grid-cols-[1.15fr_.85fr]" style={{ animationDelay: "100ms" }}>
          <div className="p-6 md:p-10">
            <div className="flex items-start justify-between border-b border-[#ded7d0] pb-6"><div><p className="font-mono text-[9px] tracking-[.16em] text-[#9b9289]">TRANSACTION REQUEST</p><h2 className="mt-3 text-[25px] font-medium tracking-[-.05em]">growth-bot <span className="text-[#9b9289]">→</span> Anthropic</h2></div><span className="font-mono text-[22px] tabular-nums">$2,100.00</span></div>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2"><div><dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]">Wallet</dt><dd className="mt-2 font-mono text-[12px]">0xa8…c912</dd></div><div><dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]">Created</dt><dd className="mt-2 font-mono text-[12px]">18 Jun 2025 · 08:36 UTC</dd></div><div><dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]">Asset</dt><dd className="mt-2 font-mono text-[12px]">USDC · Arc testnet</dd></div><div><dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]">Request hash</dt><dd className="mt-2 font-mono text-[12px]">0x7c1a…e24f</dd></div></dl>
            <div className="mt-9 border-l-2 border-[#ff3c00] bg-[#f5f0ea] p-5"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">WHY THIS ESCALATED</p><p className="mt-3 text-[15px] leading-[1.45]">Unusual spend pattern for this wallet. The request is <strong className="font-medium">4.2×</strong> the agent&apos;s recent median and exceeds the $500 per-transaction doctrine.</p><p className="mt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#837a72]">policy/v4.18 · human override permitted</p></div>
          </div>
          <aside className="border-t border-[#ded7d0] bg-[#f5f0ea] p-6 md:border-l md:border-t-0 md:p-8"><p className="font-mono text-[9px] uppercase tracking-[.17em] text-[#9b9289]">YOUR SIGNATURE</p>{decision === "idle" && <><h3 className="mt-5 text-[22px] font-medium tracking-[-.045em]">Bless or restrain<br />the request.</h3><p className="mt-4 text-[13px] leading-[1.5] text-[#655d56]">Your decision becomes part of the immutable decision record. There is no silent approval.</p><div className="mt-9 flex flex-wrap gap-2"><ActionPill onClick={() => begin("approved")}>Approve transaction</ActionPill><ActionPill quiet onClick={() => begin("rejected")}>Reject</ActionPill></div></>}{decision === "signing" && <div className="py-12"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[#ff3c00]">WAITING FOR SIGNATURE</p><p className="mt-4 text-[14px] text-[#655d56]">Recording your decision against 0x7c1a…e24f.</p></div>}{decision !== "idle" && decision !== "signing" && <div className="py-8"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[#3f653e]">DECISION RECORDED</p><h3 className={`mt-5 text-[25px] font-medium ${decision === "approved" ? "text-[#3f653e]" : "text-[#ff3c00]"}`}>{decision === "approved" ? "Approved by operator." : "Rejected by operator."}</h3><p className="mt-4 text-[13px] leading-[1.5] text-[#655d56]">The signed record is now visible to the agent operator and the public ledger.</p><button type="button" data-nav="LEDGER" className="mt-8 font-mono text-[9px] uppercase tracking-[.14em] text-[#292522] underline underline-offset-4">View ledger record ↗</button></div>}</aside>
        </section>
        <footer className="mt-10 flex flex-wrap justify-between gap-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#9b9289]"><span>HELIX-DAO · ARCANUM GOVERNANCE</span><span>Expires in 01:48:16 · signed decisions are final</span></footer>
      </div>
      {notice && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 border border-[#292522] bg-[#292522] px-4 py-3 font-mono text-[10px] text-[#faf6f1]">{notice}</div>}
    </main>
  );
}