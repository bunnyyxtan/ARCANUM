import { useEffect, useState, type ReactNode } from "react";

const orange = "#ff3c00";

function Arrow() {
  return <span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">↗</span>;
}

function StatusPill({ status }: { status: "ALLOWED" | "BLOCKED" | "ESCALATED" }) {
  const styles = {
    ALLOWED: "bg-[#e7f0e5] text-[#3f653e]",
    BLOCKED: "bg-[#ff3c00] text-white",
    ESCALATED: "border border-[#ff3c00] text-[#ff3c00]",
  };
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}>{status}</span>;
}

function LedgerDemo() {
  const rows = [
    { agent: "procurement-bot", vendor: "AWS", amount: "$184.20", detail: "0x3f…9a2c", status: "ALLOWED" as const, time: "09:41:08" },
    { agent: "support-agent", vendor: "OpenAI", amount: "$740.00", detail: "0x71…4be1", status: "BLOCKED" as const, time: "09:41:12" },
    { agent: "growth-bot", vendor: "Anthropic", amount: "$2,100.00", detail: "0xa8…c912", status: "ESCALATED" as const, time: "09:41:16" },
    { agent: "procurement-bot", vendor: "AWS", amount: "$316.40", detail: "0x3f…9a2c", status: "ALLOWED" as const, time: "09:41:19" },
  ];
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const id = window.setInterval(() => setVisible((v) => (v >= rows.length ? 1 : v + 1)), 2500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="overflow-hidden rounded-[3px] border border-[#d8d0c8] bg-[#fbf8f4] shadow-[0_22px_70px_rgba(46,35,26,.08)]">
      <div className="flex items-center justify-between border-b border-[#ded7d0] px-5 py-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4d7b49]" /><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#756e67]">Live governed ledger</span></div>
        <span className="font-mono text-[10px] text-[#9b9289]">ARC / USDC</span>
      </div>
      <div className="grid grid-cols-[1.3fr_1fr_.9fr_1fr_auto] gap-3 border-b border-[#e3ddd7] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]">
        <span>Agent</span><span>Vendor</span><span>Amount</span><span>Wallet</span><span>Verdict</span>
      </div>
      <div className="divide-y divide-[#e7e0d9]">
        {rows.map((r, i) => (
          <div key={r.time} className={`grid grid-cols-[1.3fr_1fr_.9fr_1fr_auto] items-center gap-3 px-5 py-4 transition-all duration-500 ${i < visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-30"}`}>
            <div><div className="text-[12px] font-medium text-[#292522]">{r.agent}</div><div className="mt-1 font-mono text-[9px] text-[#9b9289]">{r.time} UTC</div></div>
            <span className="text-[12px] text-[#5b544d]">{r.vendor}</span>
            <span className="font-mono text-[12px] tabular-nums text-[#292522]">{r.amount}</span>
            <span className="font-mono text-[10px] text-[#837a72]">{r.detail}</span>
            <StatusPill status={r.status} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-[#ded7d0] px-5 py-3">
        <span className="font-mono text-[9px] text-[#9b9289]">policy/v4.18 · 42ms median</span>
        <span className="font-mono text-[9px] text-[#4d7b49]">● streaming</span>
      </div>
    </div>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`warm-reveal ${className}`}>{children}</div>;
}

export function WarmLedgerClassic() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .warm-reveal{animation:warmIn .8s cubic-bezier(.22,.8,.26,1) both}.delay-1{animation-delay:.12s}.delay-2{animation-delay:.22s}.delay-3{animation-delay:.34s}
        @keyframes warmIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        html{scroll-behavior:smooth}.font-mono{font-family:'DM Mono',monospace}
      `}</style>
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between border-b border-[#ded7d0] px-6 py-5 lg:px-0">
        <a href="#" className="text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></a>
        <div className="hidden items-center gap-9 text-[12px] text-[#706860] md:flex">
          <a href="#governed" className="transition-colors hover:text-[#ff3c00]">How it works</a>
          <a href="#policies" className="transition-colors hover:text-[#ff3c00]">Policies</a>
          <a href="#ledger" className="transition-colors hover:text-[#ff3c00]">Ledger</a>
        </div>
        <a href="#contact" className="group rounded-full bg-[#ff3c00] px-5 py-2.5 text-[11px] font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">Book a control room<Arrow /></a>
      </nav>

      <section className="mx-auto grid max-w-[1200px] gap-16 px-6 pb-32 pt-28 lg:grid-cols-[1.1fr_.9fr] lg:px-0 lg:pt-40">
        <Reveal><p className="mb-8 font-mono text-[10px] uppercase tracking-[.22em] text-[#ff3c00]">Governed autonomy / Arc blockchain</p>
          <h1 className="max-w-[700px] text-[clamp(3.5rem,7.2vw,6.8rem)] font-semibold leading-[.88] tracking-[-.085em]">Autonomous spend.<br /><span className="text-[#8d837b]">Human control.</span></h1>
          <p className="mt-9 max-w-[440px] text-[17px] leading-[1.45] text-[#655d56]">ARCANUM gives every AI-agent wallet a policy layer. Every dollar is checked, recorded, and visibly governed before it moves.</p>
          <div className="mt-10 flex flex-wrap items-center gap-5"><a href="#ledger" className="group rounded-full bg-[#ff3c00] px-6 py-3.5 text-[12px] font-semibold text-white transition-transform hover:-translate-y-0.5 active:scale-95">See a dollar move<Arrow /></a><span className="font-mono text-[10px] text-[#8a8179]">No custody. No guesswork.</span></div>
        </Reveal>
        <Reveal className="delay-2 flex items-end"><div className="w-full border-l border-[#d8d0c8] pl-8 lg:mb-2"><div className="mb-8 font-mono text-[10px] uppercase tracking-[.16em] text-[#9b9289]">Operator's view / 14:32:07</div><div className="space-y-7"><div><div className="mb-2 text-[12px] text-[#756c64]">Capital under governance</div><div className="font-mono text-[40px] tracking-[-.06em]">$2,418,630<span className="text-[18px] text-[#9b9289]">.48</span></div></div><div className="h-px w-full bg-[#ded7d0]" /><div className="grid grid-cols-2 gap-8"><div><div className="font-mono text-[24px]">42ms</div><div className="mt-1 text-[11px] text-[#837a72]">median policy check</div></div><div><div className="font-mono text-[24px]">0.00%</div><div className="mt-1 text-[11px] text-[#837a72]">unattributed spend</div></div></div></div></div></Reveal>
      </section>

      <section id="governed" className="border-y border-[#ded7d0] bg-[#f5f0ea]"><div className="mx-auto grid max-w-[1200px] gap-14 px-6 py-24 lg:grid-cols-[.65fr_1.35fr] lg:px-0"><Reveal><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">01 / The control loop</p><h2 className="mt-7 max-w-[360px] text-[45px] font-semibold leading-[.94] tracking-[-.07em]">A dollar earns its way through.</h2></Reveal><Reveal className="delay-1"><div className="grid gap-0 md:grid-cols-3">{[["01","Policy check","Caps, vendors, destinations. Evaluated in 42ms."],["02","Allow or block","The wallet moves only when the policy says so."],["03","Escalate to human","Unusual spend pauses. You decide, not the model."]].map(([n,t,d],i)=><div key={n} className={`border-t border-[#bdb4aa] py-5 md:border-l md:border-t-0 md:pl-7 ${i===0?"md:border-l-0 md:pl-0":""}`}><span className="font-mono text-[10px] text-[#ff3c00]">{n}</span><h3 className="mt-12 text-[21px] font-medium tracking-[-.04em]">{t}</h3><p className="mt-3 max-w-[190px] text-[12px] leading-[1.45] text-[#776f68]">{d}</p></div>)}</div></Reveal></div></section>

      <section id="policies" className="mx-auto max-w-[1200px] px-6 py-32 lg:px-0"><Reveal><div className="flex flex-col justify-between gap-8 border-b border-[#ded7d0] pb-12 md:flex-row md:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">02 / Policy surface</p><h2 className="mt-5 text-[48px] font-semibold leading-[.9] tracking-[-.07em]">Rules that read<br />like your business.</h2></div><p className="max-w-[270px] text-[13px] leading-[1.5] text-[#776f68]">Write the boundary once. ARCANUM enforces it on every agent wallet, on every transaction.</p></div></Reveal>
        <Reveal className="delay-1"><div className="grid gap-0 md:grid-cols-3"><div className="border-b border-[#ded7d0] py-9 md:border-b-0 md:border-r md:pr-9"><span className="font-mono text-[11px] text-[#ff3c00]">CAPS</span><div className="mt-12 font-mono text-[26px]">$500<span className="text-[#9b9289]">/tx</span></div><div className="mt-2 font-mono text-[13px] text-[#756c64]">$5,000/day</div><p className="mt-6 text-[12px] text-[#837a72]">procurement-bot · USDC</p></div><div className="border-b border-[#ded7d0] py-9 md:border-b-0 md:border-r md:px-9"><span className="font-mono text-[11px] text-[#ff3c00]">ALLOWLIST</span><div className="mt-12 space-y-2 font-mono text-[13px]"><div>AWS <span className="text-[#4d7b49]">✓</span></div><div>OpenAI <span className="text-[#4d7b49]">✓</span></div><div className="text-[#aaa099]">New vendor <span className="text-[#ff3c00]">→ human</span></div></div></div><div className="py-9 md:pl-9"><span className="font-mono text-[11px] text-[#ff3c00]">ANOMALY</span><div className="mt-12 text-[25px] tracking-[-.05em]">Pause the strange.</div><p className="mt-6 max-w-[190px] text-[12px] leading-[1.5] text-[#837a72]">Velocity, destination, and amount are scored against the agent's working history.</p></div></div></Reveal>
      </section>

      <section id="ledger" className="bg-[#292522] px-6 py-28 text-[#faf6f1] lg:px-0"><div className="mx-auto max-w-[1200px]"><Reveal><div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">03 / Signature moment</p><h2 className="mt-5 text-[46px] font-semibold leading-[.92] tracking-[-.07em]">Nothing moves<br />in the dark.</h2></div><p className="max-w-[245px] text-[12px] leading-[1.5] text-[#a69d94]">A quiet, immutable record of what your agents tried, what policy decided, and who stepped in.</p></div></Reveal><Reveal className="delay-1"><LedgerDemo /></Reveal></div></section>

      <section id="contact" className="mx-auto max-w-[1200px] px-6 py-32 lg:px-0"><Reveal><div className="grid gap-12 border-b border-[#ded7d0] pb-24 md:grid-cols-[1fr_.7fr]"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">Trust is the product</p><h2 className="mt-6 max-w-[680px] text-[clamp(3rem,6vw,5.6rem)] font-semibold leading-[.9] tracking-[-.08em]">Let agents move.<br /><span className="text-[#8d837b]">Keep the final word.</span></h2></div><div className="self-end"><p className="text-[15px] leading-[1.5] text-[#655d56]">Built for finance and engineering teams who need autonomy without giving up the ledger.</p><a href="mailto:control@thearcanum.in" className="group mt-8 inline-block rounded-full bg-[#ff3c00] px-6 py-3.5 text-[12px] font-semibold text-white transition-transform hover:-translate-y-0.5">Talk to an operator<Arrow /></a></div></div></Reveal></section>

      <footer className="mx-auto flex max-w-[1200px] flex-col justify-between gap-6 px-6 pb-10 text-[11px] text-[#837a72] md:flex-row lg:px-0"><span className="font-semibold tracking-[-.04em] text-[#292522]">ARCANUM<span className="text-[#ff3c00]">.</span></span><div className="flex gap-7"><a href="#governed" className="hover:text-[#ff3c00]">Documentation</a><a href="mailto:control@thearcanum.in" className="hover:text-[#ff3c00]">Contact</a><span className="font-mono">© 2025 ARCANUM</span></div></footer>
    </main>
  );
}