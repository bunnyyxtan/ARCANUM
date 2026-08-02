import { useEffect, useState, type ReactNode } from "react";

const rows = [
  { agent: "procurement-bot", vendor: "AWS", amount: "$184.20", wallet: "0x3f…9a2c", result: "ALLOWED", note: "vendor allowlist", time: "09:41:08" },
  { agent: "support-agent", vendor: "OpenAI", amount: "$740.00", wallet: "0x71…4be1", result: "BLOCKED", note: "over tx cap · $500", time: "09:41:12" },
  { agent: "growth-bot", vendor: "Anthropic", amount: "$2,100.00", wallet: "0xa8…c912", result: "ESCALATED", note: "human approval required", time: "09:41:16" },
  { agent: "procurement-bot", vendor: "AWS", amount: "$316.40", wallet: "0x3f…9a2c", result: "ALLOWED", note: "daily budget healthy", time: "09:41:19" },
];

function Arrow() {
  return <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-1">↗</span>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rg-reveal ${className}`}>{children}</div>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[#b69a63]/50 px-3 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-[#d4bd8c]">{children}</span>;
}

function Verdict({ value }: { value: string }) {
  const styles = value === "BLOCKED"
    ? "bg-[#9c3f3c] text-[#f8edda]"
    : value === "ESCALATED"
      ? "border border-[#b69a63] text-[#e2c889]"
      : "bg-[#d4bd8c] text-[#173d2b]";
  return <span className={`rounded-[2px] px-2 py-1 font-mono text-[9px] tracking-[.12em] ${styles}`}>{value}</span>;
}

function Ledger() {
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const timer = window.setInterval(() => setVisible((n) => n >= rows.length ? 1 : n + 1), 2300);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="overflow-hidden rounded-[3px] border border-[#597760] bg-[#204c39] shadow-[0_30px_80px_rgba(8,35,22,.3)]">
      <div className="flex items-center justify-between border-b border-[#597760] px-5 py-4">
        <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#d4bd8c] shadow-[0_0_0_4px_rgba(212,189,140,.12)]" /><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#e4d4b4]">Live governed ledger</span></div>
        <span className="font-mono text-[10px] text-[#9db19c]">ARC / USDC · STREAMING</span>
      </div>
      <div className="hidden grid-cols-[1.3fr_.8fr_.8fr_1fr_auto] gap-3 border-b border-[#597760] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[#9db19c] md:grid"><span>Agent</span><span>Vendor</span><span>Amount</span><span>Wallet</span><span>Verdict</span></div>
      <div className="divide-y divide-[#597760]">
        {rows.map((r, i) => <div key={r.time} className={`grid gap-2 px-5 py-4 transition-all duration-700 md:grid-cols-[1.3fr_.8fr_.8fr_1fr_auto] md:items-center ${i < visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-25"}`}>
          <div><div className="text-[12px] font-medium text-[#f2e8d5]">{r.agent}</div><div className="mt-1 font-mono text-[9px] text-[#9db19c]">{r.time} UTC · {r.note}</div></div>
          <span className="text-[12px] text-[#d3dfcf]">{r.vendor}</span><span className="font-mono text-[12px] tabular-nums text-[#f2e8d5]">{r.amount}</span><span className="font-mono text-[10px] text-[#9db19c]">{r.wallet}</span><Verdict value={r.result} />
        </div>)}
      </div>
      <div className="flex items-center justify-between border-t border-[#597760] px-5 py-3"><span className="font-mono text-[9px] text-[#9db19c]">policy/v4.18 · 42ms median</span><span className="font-mono text-[9px] text-[#d4bd8c]">● receiving</span></div>
    </div>
  );
}

export function RacingGreen() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#173d2b] text-[#f2e8d5]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Libre+Baskerville:wght@400;700&display=swap');
        .rg-reveal{animation:rgIn .9s cubic-bezier(.22,.8,.26,1) both}.rg-d1{animation-delay:.1s}.rg-d2{animation-delay:.2s}.rg-d3{animation-delay:.32s}
        @keyframes rgIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} html{scroll-behavior:smooth}
        .rg-serif{font-family:'Libre Baskerville',serif}.rg-mono{font-family:'DM Mono',monospace}
      `}</style>
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between border-b border-[#597760] px-6 py-5 lg:px-0">
        <a href="#" className="text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#d4bd8c]">.</span></a>
        <div className="hidden items-center gap-9 text-[12px] text-[#c5d1c4] md:flex"><a href="#governed" className="transition-colors hover:text-[#e2c889]">How it works</a><a href="#policies" className="transition-colors hover:text-[#e2c889]">Policies</a><a href="#ledger" className="transition-colors hover:text-[#e2c889]">Ledger</a></div>
        <a href="#contact" className="group rounded-[2px] border border-[#d4bd8c] px-5 py-2.5 text-[11px] font-semibold text-[#f2e8d5] transition-all hover:-translate-y-0.5 hover:bg-[#d4bd8c] hover:text-[#173d2b] active:translate-y-0">Request access<Arrow /></a>
      </nav>

      <section className="mx-auto grid max-w-[1180px] items-end gap-14 px-6 pb-28 pt-24 lg:grid-cols-[.9fr_1.1fr] lg:px-0 lg:pt-32">
        <Reveal><Tag>Governance for autonomous money</Tag><h1 className="rg-serif mt-7 max-w-[620px] text-[clamp(44px,6.5vw,86px)] leading-[1.04] tracking-[-.055em]">Let agents move money.<br /><span className="text-[#d4bd8c]">Keep the final say.</span></h1><p className="mt-8 max-w-[460px] text-[16px] leading-7 text-[#c5d1c4]">ARCANUM is the non-custodial control layer for AI-agent USDC wallets on Arc. Every dollar meets policy before it moves.</p><a href="#contact" className="group mt-9 inline-flex items-center bg-[#d4bd8c] px-6 py-3.5 text-[12px] font-bold text-[#173d2b] transition-transform hover:-translate-y-1 active:translate-y-0">See the control room<Arrow /></a></Reveal>
        <Reveal className="rg-d2"><div className="mb-4 flex justify-between font-mono text-[10px] uppercase tracking-[.13em] text-[#9db19c]"><span>arcanum / control room</span><span>01 — 04</span></div><Ledger /></Reveal>
      </section>

      <section id="governed" className="border-y border-[#597760] bg-[#1d4935] px-6 py-24 lg:px-0"><div className="mx-auto max-w-[1180px]"><Reveal><div className="flex items-end justify-between gap-8"><div><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d4bd8c]">01 / The control loop</span><h2 className="rg-serif mt-5 max-w-[670px] text-4xl leading-tight tracking-[-.04em] md:text-6xl">A dollar is governed<br />in three decisions.</h2></div><p className="hidden max-w-[250px] text-sm leading-6 text-[#b4c7b5] md:block">No custody. No blind trust. Policy executes at the edge of every transaction.</p></div></Reveal>
        <div className="mt-20 grid gap-0 border-t border-[#597760] md:grid-cols-3">{[["01","CHECK","Policy reads the request","$500 / tx · $5,000 / day · vendor allowlist"],["02","DECIDE","Allow or block in 42ms","Out-of-policy transactions never settle"],["03","ESCALATE","Ask a human when it matters","Approval links carry context, not just a button"]].map(([n,t,h,d]) => <Reveal key={n} className="rg-d1 border-b border-[#597760] py-8 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"><span className="font-mono text-[11px] text-[#d4bd8c]">{n}</span><h3 className="mt-10 text-[11px] font-bold tracking-[.18em] text-[#e2c889]">{t}</h3><p className="rg-serif mt-4 text-2xl tracking-[-.03em]">{h}</p><p className="mt-4 max-w-[240px] text-[12px] leading-5 text-[#b4c7b5]">{d}</p></Reveal>)}</div>
      </div></section>

      <section id="policies" className="mx-auto max-w-[1180px] px-6 py-28 lg:px-0"><Reveal><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d4bd8c]">02 / Policy as infrastructure</span><div className="mt-6 grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><h2 className="rg-serif max-w-[440px] text-4xl leading-tight tracking-[-.04em] md:text-5xl">Write the rules once. Let every agent obey them.</h2><div className="grid gap-8 border-t border-[#597760] pt-8 sm:grid-cols-2"><div><span className="rg-mono text-3xl text-[#d4bd8c]">$2.4M</span><p className="mt-3 text-sm text-[#c5d1c4]">governed across 18,204 transactions</p></div><div><span className="rg-mono text-3xl text-[#d4bd8c]">42ms</span><p className="mt-3 text-sm text-[#c5d1c4]">median policy decision, before settlement</p></div><div className="sm:col-span-2"><div className="flex flex-wrap gap-2"><Tag>per-tx caps</Tag><Tag>daily budgets</Tag><Tag>vendor allowlists</Tag><Tag>anomaly detection</Tag><Tag>human approvals</Tag></div></div></div></div></Reveal></section>

      <section id="ledger" className="bg-[#102f21] px-6 py-24 lg:px-0"><div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><Reveal><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d4bd8c]">03 / Proof, not promises</span><h2 className="rg-serif mt-6 text-4xl leading-tight tracking-[-.04em] md:text-5xl">The audit trail is the product.</h2><p className="mt-6 max-w-[390px] text-sm leading-6 text-[#b4c7b5]">Every request, rule evaluation, verdict and approval is recorded. Finance gets a ledger. Operators get a reason.</p><div className="mt-8 border-l border-[#d4bd8c] pl-5 text-sm text-[#e2c889]">“We can finally let procurement agents run overnight.”<br /><span className="mt-2 inline-block font-mono text-[10px] text-[#9db19c]">— VP Finance, Series C infrastructure company</span></div></Reveal><Reveal className="rg-d2"><div className="border border-[#597760] p-6"><div className="flex justify-between border-b border-[#597760] pb-5"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-[#9db19c]">Policy evaluation</span><span className="font-mono text-[10px] text-[#d4bd8c]">v4.18 / immutable</span></div><div className="space-y-5 py-6 font-mono text-[11px]"><div className="flex justify-between"><span className="text-[#9db19c]">request.amount</span><span>$740.00 USDC</span></div><div className="flex justify-between"><span className="text-[#9db19c]">rule.tx_cap</span><span className="text-[#d4bd8c]">$500.00</span></div><div className="flex justify-between"><span className="text-[#9db19c]">decision</span><span className="text-[#e27d6f]">BLOCKED / 0x71…4be1</span></div></div><div className="border-t border-[#597760] pt-5 font-mono text-[10px] text-[#9db19c]">hash 8f2a…c19d · signed by arcanum</div></div></Reveal></div></section>

      <section id="contact" className="mx-auto max-w-[1180px] px-6 py-32 text-center lg:px-0"><Reveal><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d4bd8c]">04 / Put a boundary around autonomy</span><h2 className="rg-serif mx-auto mt-6 max-w-[750px] text-5xl leading-[1.08] tracking-[-.05em] md:text-7xl">Give your agents<br /><span className="text-[#d4bd8c]">a governed wallet.</span></h2><a href="mailto:hello@thearcanum.in" className="group mt-10 inline-flex bg-[#d4bd8c] px-7 py-4 text-[12px] font-bold text-[#173d2b] transition-transform hover:-translate-y-1">Talk to Arcanum<Arrow /></a></Reveal></section>
      <footer className="border-t border-[#597760] px-6 py-7 lg:px-0"><div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-4 text-[11px] text-[#9db19c] sm:flex-row"><span className="font-bold tracking-[-.05em] text-[#f2e8d5]">ARCANUM<span className="text-[#d4bd8c]">.</span></span><span>Non-custodial governance for Arc · thearcanum.in</span><span className="font-mono">© 2024</span></div></footer>
    </main>
  );
}