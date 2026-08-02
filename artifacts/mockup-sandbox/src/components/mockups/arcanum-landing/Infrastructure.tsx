import { useEffect, useState } from "react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATE";

const events: { time: string; agent: string; vendor: string; amount: string; verdict: Verdict; detail: string }[] = [
  { time: "14:32:08.041", agent: "procurement-bot", vendor: "AWS", amount: "$420.00", verdict: "ALLOWED", detail: "within vendor allowlist · daily cap" },
  { time: "14:32:09.118", agent: "procurement-bot", vendor: "OpenAI", amount: "$500.00", verdict: "ALLOWED", detail: "within per-transaction cap" },
  { time: "14:32:11.403", agent: "procurement-bot", vendor: "Anthropic", amount: "$1,250.00", verdict: "BLOCKED", detail: "exceeds $500 / transaction" },
  { time: "14:32:14.772", agent: "treasury-agent", vendor: "AWS", amount: "$4,880.00", verdict: "ESCALATE", detail: "requires human approval · daily cap" },
];

function Mark({ size = 18 }: { size?: number }) {
  return <span className="inline-flex items-center justify-center border border-[#282044] text-[10px] font-semibold tracking-[-.08em]" style={{ width: size, height: size }}>A</span>;
}
function Arrow({ dark = false }: { dark?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke={dark ? "#fffaf1" : "#282044"} strokeWidth="1.2" /></svg>;
}
function Rule({ className = "" }: { className?: string }) { return <div className={`h-px bg-[#d8cde4] ${className}`} />; }

export function Infrastructure() {
  const [active, setActive] = useState(2);
  const [live, setLive] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setLive(v => (v + 1) % events.length), 3200);
    return () => window.clearInterval(id);
  }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="min-h-[100dvh] bg-[#fbf6ec] text-[#282044] selection:bg-[#d9d3e7] selection:text-[#282044]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
        .arc-root { font-family: Manrope, sans-serif; color:#282044; }
        .arc-mono { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; }
        .arc-reveal { animation: arcIn .7s cubic-bezier(.2,.8,.2,1) both; }
        .arc-delay-1 { animation-delay: .08s } .arc-delay-2 { animation-delay: .16s } .arc-delay-3 { animation-delay: .24s }
        @keyframes arcIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        .arc-scan { animation: scan 3.2s ease-in-out infinite; }
        @keyframes scan { 0%, 12% { opacity:.35; transform:scaleX(.2); transform-origin:left } 28%, 82% { opacity:1; transform:scaleX(1); transform-origin:left } 100% { opacity:.35; transform:scaleX(.2); transform-origin:right } }
        .arc-row { transition: background-color .2s ease, transform .2s ease; }
        .arc-row:hover { background:#f0eaf5; transform:translateX(3px); }
      `}</style>
      <div className="arc-root">
        <header className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between border-b border-[#d8cde4] px-6 lg:px-0">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-2 text-[13px] font-bold tracking-[.18em] hover:opacity-60"><Mark /> ARCANUM</button>
          <nav className="hidden items-center gap-8 text-[12px] font-semibold text-[#64707e] md:flex">
            <button onClick={() => scrollTo("system")} className="hover:text-[#182333]">System</button>
            <button onClick={() => scrollTo("ledger")} className="hover:text-[#182333]">Ledger</button>
            <button onClick={() => scrollTo("controls")} className="hover:text-[#182333]">Controls</button>
            <button onClick={() => scrollTo("proof")} className="hover:text-[#182333]">Proof</button>
          </nav>
          <button onClick={() => scrollTo("contact")} className="group flex items-center gap-2 border border-[#182333] px-4 py-2 text-[11px] font-bold tracking-[.06em] hover:bg-[#182333] hover:text-[#f8fafb]">Request access <Arrow /></button>
        </header>

        <main id="top">
          <section className="mx-auto max-w-[1180px] px-6 pb-28 pt-24 lg:px-0 lg:pt-32">
            <div className="max-w-[850px] arc-reveal">
              <p className="arc-mono mb-8 text-[11px] uppercase tracking-[.16em] text-[#687483]">Governance infrastructure for AI agents</p>
              <h1 className="max-w-[820px] text-[clamp(3.3rem,7vw,6.5rem)] font-medium leading-[.98] tracking-[-.075em]">Every dollar an agent spends, <span className="text-[#6f7c93]">accounted for.</span></h1>
              <p className="mt-9 max-w-[570px] text-[18px] leading-[1.6] text-[#596675]">ARCanum is the non-custodial governance layer for USDC wallets on Arc. Set the policy. We enforce it before money moves.</p>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <button onClick={() => scrollTo("contact")} className="flex items-center gap-3 bg-[#182333] px-5 py-3.5 text-[12px] font-bold text-[#f8fafb] hover:bg-[#303e50]">See the infrastructure <Arrow dark /></button>
                <button onClick={() => scrollTo("ledger")} className="text-[12px] font-bold underline decoration-[#abb6c2] underline-offset-4 hover:decoration-[#182333]">Watch a transaction get governed</button>
              </div>
            </div>
            <div className="mt-24 grid grid-cols-2 border-y border-[#d8cde4] py-5 sm:grid-cols-4 arc-reveal arc-delay-2">
              {[["$2.4M", "governed"], ["42ms", "policy checks"], ["0", "custody taken"], ["24/7", "audit ledger"]].map(([n, l]) => <div key={l} className="border-r border-[#d8cde4] px-4 first:pl-0 last:border-0"><div className="arc-mono text-[19px]">{n}</div><div className="mt-1 text-[11px] text-[#625779]">{l}</div></div>)}
            </div>
          </section>

          <section id="system" className="border-y border-[#d8cde4] bg-[#f0ecf6]">
            <div className="mx-auto max-w-[1180px] px-6 py-24 lg:px-0">
              <div className="grid gap-12 lg:grid-cols-[.65fr_1.35fr]">
                <div><p className="arc-mono text-[11px] text-[#6f7c8d]">01 / THE CONTROL PLANE</p><h2 className="mt-5 max-w-[350px] text-[38px] font-medium leading-[1.04] tracking-[-.055em]">A policy check before every transaction.</h2><p className="mt-6 max-w-[320px] text-[14px] leading-[1.65] text-[#657281]">Your agents keep their wallets. Arcanum sits between intent and settlement, evaluating each transfer against rules you own.</p></div>
                <div className="border border-[#cfc4de] bg-[#f7f1fa] p-8 shadow-[0_8px_24px_rgba(53,38,84,.08)]">
                  <div className="arc-mono mb-12 text-[10px] uppercase tracking-[.13em] text-[#788491]">transaction lifecycle / 42ms p95</div>
                  <div className="grid items-center gap-4 sm:grid-cols-[1fr_28px_1fr_28px_1fr]">
                    {[["01", "Agent intent", "procurement-bot"], ["02", "Policy engine", "$500/tx · $5,000/day"], ["03", "Arc settlement", "0x3f…9a2c"]].map(([num, title, sub], i) => <div key={num} className="contents"><div className={`border p-4 ${i === 1 ? "border-[#64548d] bg-[#e8e0f1]" : "border-[#cfc4de]"}`}><div className="arc-mono text-[10px] text-[#665a7e]">{num}</div><div className="mt-5 text-[13px] font-bold">{title}</div><div className="arc-mono mt-2 text-[10px] text-[#625779]">{sub}</div></div>{i < 2 && <Arrow />}</div>)}
                  </div>
                  <div className="mt-9 flex items-center gap-3 text-[11px] text-[#625779]"><span className="h-1.5 w-1.5 rounded-full bg-[#67578f]" /> Decision recorded to immutable audit ledger <span className="arc-mono ml-auto">0x8c…1f04</span></div>
                </div>
              </div>
            </div>
          </section>

          <section id="ledger" className="mx-auto max-w-[1180px] px-6 py-28 lg:px-0">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6"><div><p className="arc-mono text-[11px] text-[#6f7c8d]">02 / GOVERNED LEDGER</p><h2 className="mt-5 text-[38px] font-medium tracking-[-.055em]">The verdict is the interface.</h2></div><p className="max-w-[290px] text-[13px] leading-[1.6] text-[#657281]">A live, queryable record of what your agents tried to do — and why the system said yes or no.</p></div>
            <div className="overflow-hidden border border-[#cfc4de] bg-[#f7f1fa] shadow-[0_8px_24px_rgba(53,38,84,.08)]">
              <div className="flex items-center justify-between border-b border-[#dfe4e9] px-5 py-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#71809a]" /><span className="arc-mono text-[10px] uppercase tracking-[.1em]">Live activity</span></div><span className="arc-mono text-[10px] text-[#7a8693]">ARC / USDC / MAINNET</span></div>
              <div className="hidden grid-cols-[1.1fr_1.3fr_1fr_.7fr_.8fr] gap-4 border-b border-[#e5e9ed] px-5 py-3 text-[10px] font-bold uppercase tracking-[.08em] text-[#8a949f] md:grid"><span>Timestamp</span><span>Agent / vendor</span><span>Amount</span><span>Verdict</span><span>Reason</span></div>
              {events.map((e, i) => <div key={e.time} className={`arc-row grid gap-2 border-b border-[#e5e9ed] px-5 py-4 last:border-0 md:grid-cols-[1.1fr_1.3fr_1fr_.7fr_.8fr] md:items-center md:gap-4 ${i === live ? "bg-[#f6f8fa]" : ""}`}><span className="arc-mono text-[10px] text-[#8a949f]">{e.time}</span><span><strong className="text-[12px] font-semibold">{e.agent}</strong><span className="ml-2 text-[12px] text-[#74808d]">/ {e.vendor}</span></span><span className="arc-mono text-[12px]">{e.amount}</span><span className={`arc-mono text-[10px] font-medium ${e.verdict === "ALLOWED" ? "text-[#516276]" : e.verdict === "BLOCKED" ? "text-[#68717d]" : "text-[#6e7890]"}`}>{e.verdict}</span><span className="text-[10px] text-[#7c8793]">{e.detail}</span></div>)}
              <div className="arc-scan h-px bg-[#71809a]" />
            </div>
          </section>

          <section id="controls" className="border-y border-[#d8cde4] bg-[#f0ecf6]">
            <div className="mx-auto max-w-[1180px] px-6 py-28 lg:px-0"><p className="arc-mono text-[11px] text-[#6f7c8d]">03 / POLICY SURFACE</p><div className="mt-5 flex flex-col justify-between gap-10 lg:flex-row"><h2 className="max-w-[520px] text-[42px] font-medium leading-[1.02] tracking-[-.06em]">Rules that read like your operating model.</h2><p className="max-w-[300px] text-[14px] leading-[1.65] text-[#657281]">Compose controls at the level your finance team understands. Deploy without taking keys or rewriting agent code.</p></div>
              <div className="mt-16 grid gap-0 border-y border-[#cfc4de] md:grid-cols-3">{[["Spending limits", "$500 / tx", "Set per-transaction and rolling daily ceilings for every wallet."], ["Vendor allowlists", "AWS · OpenAI", "Approve counterparties before an agent can send USDC."], ["Human escalation", "2 approvers", "Route exceptional spend to the people who can assess context."]].map(([a,b,c], i) => <button key={a} onClick={() => setActive(i)} className={`border-b p-7 text-left transition-colors md:border-b-0 md:border-r last:border-0 ${active === i ? "bg-[#e4dbef]" : "hover:bg-[#ebe5f2]"}`}><span className="arc-mono text-[10px] text-[#665a7e]">0{i+1}</span><h3 className="mt-12 text-[18px] font-semibold tracking-[-.02em]">{a}</h3><div className="arc-mono mt-3 text-[12px] text-[#5e5278]">{b}</div><p className="mt-5 text-[12px] leading-[1.55] text-[#625779]">{c}</p><span className="mt-8 block text-[11px] font-bold underline underline-offset-4">Configure policy</span></button>)}</div>
            </div>
          </section>

          <section id="proof" className="mx-auto max-w-[1180px] px-6 py-28 lg:px-0"><div className="border-l-2 border-[#67578f] pl-7"><p className="arc-mono text-[11px] text-[#625779]">VERIFIABLE BY DESIGN</p><blockquote className="mt-6 max-w-[830px] text-[30px] font-medium leading-[1.18] tracking-[-.04em]">“We can give agents the authority to move money without giving them the authority to decide how much.”</blockquote><div className="mt-7 flex items-center gap-3 text-[11px] text-[#625779]"><span className="font-bold text-[#282044]">Mara Chen</span><span>/</span><span>VP Finance, Northstar Systems</span></div></div><div className="mt-24 grid gap-8 border-t border-[#d8cde4] pt-8 sm:grid-cols-3"><div><div className="arc-mono text-[26px]">100%</div><p className="mt-2 text-[11px] text-[#625779]">of decisions signed and queryable</p></div><div><div className="arc-mono text-[26px]">42ms</div><p className="mt-2 text-[11px] text-[#625779]">median policy evaluation</p></div><div><div className="arc-mono text-[26px]">$2.4M</div><p className="mt-2 text-[11px] text-[#625779]">USDC governed to date</p></div></div></section>

          <section id="contact" className="border-t border-[#493b6c] bg-[#302650] text-[#fffaf1]"><div className="mx-auto max-w-[1180px] px-6 py-28 lg:px-0"><div className="flex flex-col justify-between gap-12 lg:flex-row lg:items-end"><div><p className="arc-mono text-[11px] text-[#d8cde4]">04 / NEXT STEP</p><h2 className="mt-6 max-w-[650px] text-[48px] font-medium leading-[1] tracking-[-.06em]">Put a policy between intent and settlement.</h2></div><button onClick={() => window.alert("Access request noted — a member of the Arcanum team will follow up.")} className="flex shrink-0 items-center gap-3 border border-[#fffaf1] px-5 py-3.5 text-[12px] font-bold hover:bg-[#fffaf1] hover:text-[#302650]">Request access <Arrow dark /></button></div></div></section>
        </main>
        <footer className="bg-[#302650] text-[#d8cde4]"><div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-8 border-t border-[#493b6c] px-6 py-8 text-[11px] sm:flex-row lg:px-0"><div className="flex items-center gap-2 text-[#fffaf1]"><Mark size={16} /> <span className="font-bold tracking-[.16em]">ARCANUM</span></div><div className="flex gap-7"><button onClick={() => scrollTo("system")} className="hover:text-white">System</button><button onClick={() => scrollTo("ledger")} className="hover:text-white">Ledger</button><span>© 2025 Arcanum Labs</span></div></div></footer>
      </div>
    </div>
  );
}