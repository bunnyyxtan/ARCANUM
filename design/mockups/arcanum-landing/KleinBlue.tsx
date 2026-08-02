import { useEffect, useState, type ReactNode } from "react";

const blue = "#062fa8";
const ivory = "#f4efdf";
const ink = "#071a54";
const red = "#c62f3d";

function Arrow() {
  return <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">↗</span>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`kb-reveal ${className}`}>{children}</div>;
}

function Verdict({ status }: { status: "ALLOWED" | "BLOCKED" | "ESCALATED" }) {
  const style = status === "ALLOWED"
    ? "bg-[#d8e5cc] text-[#173e2b]"
    : status === "BLOCKED"
      ? "bg-[#c62f3d] text-[#fff5e7]"
      : "border border-[#c62f3d] text-[#c62f3d]";
  return <span className={`rounded-sm px-2.5 py-1 font-mono text-[9px] tracking-[.1em] ${style}`}>{status}</span>;
}

function Ledger() {
  const rows = [
    ["procurement-bot", "AWS", "$184.20", "0x3f…9a2c", "ALLOWED", "09:41:08"],
    ["support-agent", "OpenAI", "$740.00", "0x71…4be1", "BLOCKED", "09:41:12"],
    ["growth-bot", "Anthropic", "$2,100.00", "0xa8…c912", "ESCALATED", "09:41:16"],
    ["procurement-bot", "AWS", "$316.40", "0x3f…9a2c", "ALLOWED", "09:41:19"],
  ] as const;
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const timer = window.setInterval(() => setVisible((v) => v >= rows.length ? 1 : v + 1), 2200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="overflow-hidden border border-[#7890d0] bg-[#f4efdf] text-[#071a54] shadow-[18px_18px_0_#c62f3d]">
      <div className="flex items-center justify-between border-b border-[#c2cce1] px-5 py-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#58824c]" /><span className="font-mono text-[10px] uppercase tracking-[.18em]">Live governed ledger</span></div>
        <span className="font-mono text-[10px]">ARC / USDC</span>
      </div>
      <div className="hidden grid-cols-[1.3fr_1fr_.9fr_1fr_auto] gap-3 border-b border-[#c2cce1] px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] opacity-60 sm:grid"><span>Agent</span><span>Vendor</span><span>Amount</span><span>Wallet</span><span>Verdict</span></div>
      <div className="divide-y divide-[#d2d9e8]">
        {rows.map((r, i) => <div key={r[5]} className={`grid grid-cols-2 gap-3 px-5 py-4 transition-all duration-500 sm:grid-cols-[1.3fr_1fr_.9fr_1fr_auto] sm:items-center ${i < visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-25"}`}>
          <div><div className="text-[12px] font-semibold">{r[0]}</div><div className="mt-1 font-mono text-[9px] opacity-55">{r[5]} UTC</div></div>
          <span className="text-[12px]">{r[1]}</span><span className="font-mono text-[12px] tabular-nums">{r[2]}</span><span className="font-mono text-[10px] opacity-60">{r[3]}</span><Verdict status={r[4]} />
        </div>)}
      </div>
      <div className="flex items-center justify-between border-t border-[#c2cce1] px-5 py-3"><span className="font-mono text-[9px] opacity-60">policy/v4.18 · 42ms median</span><span className="font-mono text-[9px] text-[#35613b]">● streaming</span></div>
    </div>
  );
}

export function KleinBlue() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#062fa8] text-[#f4efdf]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        html{scroll-behavior:smooth}.kb-mono{font-family:'DM Mono',monospace}.kb-serif{font-family:'Instrument Serif',serif}
        .kb-reveal{animation:kbIn .85s cubic-bezier(.2,.8,.25,1) both}.kb-delay{animation-delay:.18s}.kb-delay-2{animation-delay:.32s}
        @keyframes kbIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <nav className="mx-auto flex max-w-[1240px] items-center justify-between border-b border-[#5875c5] px-6 py-5 lg:px-0">
        <a href="#" className="text-[18px] font-bold tracking-[-.07em]">ARCANUM<span className="text-[#d8e5cc]">.</span></a>
        <div className="hidden items-center gap-9 text-[12px] text-[#d5ddf3] md:flex"><a href="#control" className="transition-colors hover:text-[#d8e5cc]">Control loop</a><a href="#policy" className="transition-colors hover:text-[#d8e5cc]">Policies</a><a href="#ledger" className="transition-colors hover:text-[#d8e5cc]">Ledger</a></div>
        <a href="#contact" className="group border border-[#d8e5cc] px-4 py-2 text-[11px] font-semibold text-[#d8e5cc] transition-colors hover:bg-[#d8e5cc] hover:text-[#062fa8]">Book a control room<Arrow /></a>
      </nav>

      <section className="mx-auto grid max-w-[1240px] gap-20 px-6 pb-36 pt-28 lg:grid-cols-[1.2fr_.8fr] lg:px-0 lg:pt-40">
        <Reveal><p className="kb-mono mb-8 text-[10px] uppercase tracking-[.24em] text-[#d8e5cc]">Governed autonomy / Arc blockchain</p><h1 className="max-w-[780px] text-[clamp(4rem,9vw,9.5rem)] font-semibold leading-[.8] tracking-[-.1em]">Let the<br /><span className="kb-serif font-normal italic text-[#d8e5cc]">agent</span> move.</h1><p className="mt-10 max-w-[480px] text-[17px] leading-[1.45] text-[#e0e5f4]">ARCANUM puts a policy layer between an AI agent and its USDC wallet. Every dollar is checked, recorded, and governed before it moves.</p><div className="mt-10 flex flex-wrap items-center gap-5"><a href="#ledger" className="group bg-[#f4efdf] px-6 py-3.5 text-[12px] font-semibold text-[#062fa8] transition-transform hover:-translate-y-1 active:translate-y-0">Watch a dollar move<Arrow /></a><span className="kb-mono text-[10px] text-[#c4d0ed]">No custody. No guesswork.</span></div></Reveal>
        <Reveal className="kb-delay flex items-end"><div className="w-full border-l border-[#7590d1] pl-8 lg:mb-3"><div className="kb-mono mb-10 text-[10px] uppercase tracking-[.16em] text-[#c4d0ed]">Operator's view / 14:32:07</div><div><div className="mb-2 text-[12px] text-[#d5ddf3]">Capital under governance</div><div className="kb-mono text-[clamp(2.5rem,4vw,4.2rem)] tracking-[-.08em]">$2,418,630<span className="text-[20px] text-[#b8c5e8]">.48</span></div></div><div className="my-8 h-px bg-[#7590d1]" /><div className="grid grid-cols-2 gap-8"><div><div className="kb-mono text-[26px]">42ms</div><div className="mt-1 text-[11px] text-[#c4d0ed]">median policy check</div></div><div><div className="kb-mono text-[26px]">0.00%</div><div className="mt-1 text-[11px] text-[#c4d0ed]">unattributed spend</div></div></div></div></Reveal>
      </section>

      <section id="control" className="bg-[#f4efdf] py-28 text-[#071a54]"><div className="mx-auto grid max-w-[1240px] gap-16 px-6 lg:grid-cols-[.7fr_1.3fr] lg:px-0"><Reveal><p className="kb-mono text-[10px] uppercase tracking-[.18em] text-[#c62f3d]">01 / The control loop</p><h2 className="mt-7 max-w-[390px] text-[52px] font-semibold leading-[.88] tracking-[-.08em]">A dollar earns its way through.</h2></Reveal><Reveal className="kb-delay"><div className="grid gap-0 md:grid-cols-3">{[["01","Policy check","Caps, vendors, destinations. Evaluated in 42ms."],["02","Allow or block","The wallet moves only when the policy says so."],["03","Escalate to human","Unusual spend pauses. You decide, not the model."]].map(([n,t,d], i) => <div key={n} className={`border-t border-[#9aa8c6] py-6 md:border-l md:border-t-0 md:pl-7 ${i === 0 ? "md:border-l-0 md:pl-0" : ""}`}><span className="kb-mono text-[10px] text-[#c62f3d]">{n}</span><h3 className="mt-14 text-[22px] font-semibold tracking-[-.05em]">{t}</h3><p className="mt-3 max-w-[190px] text-[12px] leading-[1.5] text-[#40517a]">{d}</p></div>)}</div></Reveal></div></section>

      <section id="policy" className="mx-auto max-w-[1240px] px-6 py-32 lg:px-0"><Reveal><div className="flex flex-col justify-between gap-8 border-b border-[#7190d2] pb-12 md:flex-row md:items-end"><div><p className="kb-mono text-[10px] uppercase tracking-[.18em] text-[#d8e5cc]">02 / Policy surface</p><h2 className="mt-5 text-[52px] font-semibold leading-[.88] tracking-[-.08em]">Rules that read<br />like your business.</h2></div><p className="max-w-[270px] text-[13px] leading-[1.5] text-[#d5ddf3]">Write the boundary once. ARCANUM enforces it on every agent wallet, on every transaction.</p></div></Reveal><Reveal className="kb-delay"><div className="grid gap-0 md:grid-cols-3"><div className="border-b border-[#7190d2] py-10 md:border-b-0 md:border-r md:pr-9"><span className="kb-mono text-[11px] text-[#d8e5cc]">CAPS</span><div className="kb-mono mt-12 text-[28px]">$500<span className="text-[#aebfe9]">/tx</span></div><div className="kb-mono mt-2 text-[14px] text-[#d5ddf3]">$5,000/day</div><p className="mt-6 text-[12px] text-[#c4d0ed]">procurement-bot · USDC</p></div><div className="border-b border-[#7190d2] py-10 md:border-b-0 md:border-r md:px-9"><span className="kb-mono text-[11px] text-[#d8e5cc]">ALLOWLIST</span><div className="kb-mono mt-12 space-y-2 text-[13px]"><div>AWS <span className="text-[#d8e5cc]">✓</span></div><div>OpenAI <span className="text-[#d8e5cc]">✓</span></div><div className="text-[#aebfe9]">New vendor <span className="text-[#d8e5cc]">→ human</span></div></div></div><div className="py-10 md:pl-9"><span className="kb-mono text-[11px] text-[#d8e5cc]">ANOMALY</span><div className="mt-12 text-[27px] tracking-[-.06em]">Pause the strange.</div><p className="mt-6 max-w-[190px] text-[12px] leading-[1.5] text-[#c4d0ed]">Velocity, destination, and amount are scored against the agent's working history.</p></div></div></Reveal></section>

      <section id="ledger" className="bg-[#f4efdf] px-6 py-28 text-[#071a54] lg:px-0"><div className="mx-auto max-w-[1240px]"><Reveal><div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="kb-mono text-[10px] uppercase tracking-[.18em] text-[#c62f3d]">03 / Signature moment</p><h2 className="mt-5 text-[52px] font-semibold leading-[.88] tracking-[-.08em]">Nothing moves<br />in the dark.</h2></div><p className="max-w-[245px] text-[12px] leading-[1.5] text-[#40517a]">A quiet, immutable record of what your agents tried, what policy decided, and who stepped in.</p></div></Reveal><Reveal className="kb-delay"><Ledger /></Reveal></div></section>

      <section id="contact" className="mx-auto max-w-[1240px] px-6 py-32 lg:px-0"><Reveal><div className="grid gap-12 border-b border-[#7190d2] pb-24 md:grid-cols-[1fr_.7fr]"><div><p className="kb-mono text-[10px] uppercase tracking-[.18em] text-[#d8e5cc]">Trust is the product</p><h2 className="mt-6 max-w-[700px] text-[clamp(3.5rem,7vw,7rem)] font-semibold leading-[.82] tracking-[-.1em]">Let agents move.<br /><span className="kb-serif font-normal italic text-[#d8e5cc]">Keep the final word.</span></h2></div><div className="self-end"><p className="text-[15px] leading-[1.5] text-[#d5ddf3]">Built for finance and engineering teams who need autonomy without giving up the ledger.</p><a href="mailto:control@thearcanum.in" className="group mt-8 inline-block bg-[#f4efdf] px-6 py-3.5 text-[12px] font-semibold text-[#062fa8] transition-transform hover:-translate-y-1">Talk to an operator<Arrow /></a></div></div></Reveal></section>
      <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 px-6 pb-10 text-[11px] text-[#c4d0ed] md:flex-row lg:px-0"><span className="font-semibold tracking-[-.04em] text-[#f4efdf]">ARCANUM<span className="text-[#d8e5cc]">.</span></span><div className="flex flex-wrap gap-7"><a href="#control" className="transition-colors hover:text-[#d8e5cc]">Documentation</a><a href="mailto:control@thearcanum.in" className="transition-colors hover:text-[#d8e5cc]">Contact</a><span className="kb-mono">© 2025 ARCANUM</span></div></footer>
    </main>
  );
}