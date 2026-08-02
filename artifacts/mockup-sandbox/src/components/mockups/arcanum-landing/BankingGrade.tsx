import { useEffect, useState, type ReactNode } from "react";

const ink = "#123b43";
const muted = "#5c716f";
const line = "#d8c7ad";
const paper = "#f3ead9";
const steel = "#527b78";

function Arrow() {
  return <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">↗</span>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bank-reveal ${className}`}>{children}</div>;
}

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATED";
function VerdictPill({ value }: { value: Verdict }) {
  const style = value === "ALLOWED" ? "bg-[#dbe7df] text-[#24534d]" : value === "BLOCKED" ? "bg-[#123b43] text-[#f3ead9]" : "border border-[#6c918b] text-[#315f5b]";
  return <span className={`inline-flex items-center px-2.5 py-1 font-mono text-[9px] tracking-[.14em] ${style}`}>{value}</span>;
}

function Ledger() {
  const rows = [
    ["procurement-bot", "AWS", "$184.20", "0x3f…9a2c", "ALLOWED" as Verdict, "09:41:08"],
    ["support-agent", "OpenAI", "$740.00", "0x71…4be1", "BLOCKED" as Verdict, "09:41:12"],
    ["growth-bot", "Anthropic", "$2,100.00", "0xa8…c912", "ESCALATED" as Verdict, "09:41:16"],
    ["procurement-bot", "AWS", "$316.40", "0x3f…9a2c", "ALLOWED" as Verdict, "09:41:19"],
  ];
  const [count, setCount] = useState(2);
  useEffect(() => {
    const timer = window.setInterval(() => setCount((n) => n >= rows.length ? 2 : n + 1), 2400);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="overflow-hidden border border-[#c9b798] bg-[#f8f0e2] shadow-[0_24px_80px_rgba(18,59,67,.12)]">
      <div className="flex items-center justify-between border-b border-[#ddceb7] px-5 py-4">
        <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#527b78]" /><span className="font-mono text-[9px] uppercase tracking-[.2em] text-[#52716d]">Governed ledger / live</span></div>
        <span className="font-mono text-[9px] text-[#718681]">ARC · USDC</span>
      </div>
      <div className="hidden grid-cols-[1.3fr_1fr_.8fr_1fr_auto] gap-3 border-b border-[#ddceb7] px-5 py-3 font-mono text-[8px] uppercase tracking-[.15em] text-[#718681] md:grid"><span>Agent</span><span>Vendor</span><span>Amount</span><span>Wallet</span><span>Verdict</span></div>
      <div className="divide-y divide-[#e8dcc9]">
        {rows.map((row, i) => <div key={row[5]} className={`grid gap-2 px-5 py-4 transition-all duration-700 md:grid-cols-[1.3fr_1fr_.8fr_1fr_auto] md:items-center ${i < count ? "translate-y-0 opacity-100" : "translate-y-2 opacity-30"}`}>
          <div><div className="text-[11px] font-medium text-[#123b43]">{row[0]}</div><div className="mt-1 font-mono text-[8px] text-[#718681]">{row[5]} UTC</div></div>
          <span className="text-[11px] text-[#52716d]">{row[1]}</span><span className="font-mono text-[11px] tabular-nums text-[#123b43]">{row[2]}</span><span className="font-mono text-[9px] text-[#718681]">{row[3]}</span><VerdictPill value={row[4]} />
        </div>)}
      </div>
      <div className="flex justify-between border-t border-[#ddceb7] px-5 py-3 font-mono text-[8px] text-[#718681]"><span>policy/v4.18 · 42ms median</span><span className="text-[#527b78]">streaming</span></div>
    </div>
  );
}

function ProductFrame() {
  return <div className="border border-[#c9b798] bg-[#e8dbc5] p-2 shadow-[0_30px_90px_rgba(18,59,67,.14)]">
    <div className="border border-[#d6c5a9] bg-[#f8f0e2]">
      <div className="flex items-center justify-between border-b border-[#e4d6c0] px-4 py-3"><span className="font-mono text-[8px] tracking-[.14em] text-[#52716d]">ARCANUM / CONTROL</span><span className="font-mono text-[8px] text-[#52716d]">14:32:07 UTC</span></div>
      <div className="grid md:grid-cols-[.8fr_1.2fr]">
        <div className="border-b border-[#e4d6c0] p-5 md:border-b-0 md:border-r"><div className="font-mono text-[8px] uppercase tracking-[.16em] text-[#52716d]">Capital under governance</div><div className="mt-5 font-mono text-[28px] tracking-[-.06em] text-[#123b43]">$2,418,630<span className="text-[14px] text-[#718681]">.48</span></div><div className="mt-8 grid grid-cols-2 gap-4 border-t border-[#e4d6c0] pt-4"><div><div className="font-mono text-[16px] text-[#123b43]">42ms</div><div className="mt-1 text-[9px] text-[#718681]">policy check</div></div><div><div className="font-mono text-[16px] text-[#123b43]">0.00%</div><div className="mt-1 text-[9px] text-[#718681]">unattributed</div></div></div></div>
        <div className="p-5"><div className="mb-3 flex justify-between"><span className="font-mono text-[8px] uppercase tracking-[.16em] text-[#718681]">Recent decisions</span><span className="font-mono text-[8px] text-[#527b78]">view ledger ↗</span></div><div className="space-y-2">{[["AWS","$184.20","ALLOWED"],["OpenAI","$740.00","BLOCKED"],["Anthropic","$2,100.00","ESCALATED"]].map((x) => <div key={x[0]} className="flex items-center justify-between border-t border-[#e8dcc9] py-3"><div><div className="text-[10px] text-[#315f5b]">{x[0]}</div><div className="font-mono text-[8px] text-[#718681]">procurement-bot · USDC</div></div><div className="flex items-center gap-3"><span className="font-mono text-[10px]">{x[1]}</span><VerdictPill value={x[2] as Verdict} /></div></div>)}</div></div>
      </div>
    </div>
  </div>;
}

export function BankingGrade() {
  return <main className="min-h-[100dvh] overflow-hidden bg-[#f3ead9] text-[#123b43]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');.bank-reveal{animation:bankIn .85s cubic-bezier(.2,.8,.25,1) both}.bank-delay-1{animation-delay:.14s}.bank-delay-2{animation-delay:.28s}@keyframes bankIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}html{scroll-behavior:smooth}.font-mono{font-family:'DM Mono',monospace}`}</style>
    <nav className="mx-auto flex max-w-[1160px] items-center justify-between border-b border-[#d8c7ad] px-6 py-5 lg:px-0"><a href="#" className="text-[16px] font-bold tracking-[-.07em]">ARCANUM</a><div className="hidden gap-9 text-[11px] text-[#52716d] md:flex"><a className="transition-colors hover:text-[#123b43]" href="#system">System</a><a className="transition-colors hover:text-[#123b43]" href="#policies">Policies</a><a className="transition-colors hover:text-[#123b43]" href="#ledger">Ledger</a></div><a href="#contact" className="group border border-[#8ca39e] px-4 py-2 text-[10px] font-medium transition-colors hover:bg-[#123b43] hover:text-[#f3ead9]">Book a control room<Arrow /></a></nav>
    <section className="mx-auto grid max-w-[1160px] gap-16 px-6 pb-28 pt-28 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-0 lg:pt-36"><Reveal><p className="font-mono text-[9px] uppercase tracking-[.24em] text-[#527b78]">Governed autonomy / Arc blockchain</p><h1 className="mt-7 max-w-[600px] text-[clamp(3.8rem,7vw,6.8rem)] font-semibold leading-[.88] tracking-[-.085em]">Every dollar.<br /><span className="text-[#52716d]">Accounted for.</span></h1><p className="mt-8 max-w-[420px] text-[16px] leading-[1.5] text-[#52716d]">ARCANUM gives AI-agent wallets a policy layer. Spending is checked, recorded, and governed before it moves.</p><div className="mt-9 flex flex-wrap items-center gap-5"><a href="#ledger" className="group bg-[#123b43] px-5 py-3.5 text-[11px] font-medium text-[#f3ead9] transition-transform hover:-translate-y-0.5 active:translate-y-0">See a dollar move<Arrow /></a><span className="font-mono text-[9px] text-[#718681]">Non-custodial · USDC native</span></div></Reveal><Reveal className="bank-delay-2"><ProductFrame /></Reveal></section>
    <section id="system" className="border-y border-[#d8c7ad] bg-[#e8dbc5]"><div className="mx-auto grid max-w-[1160px] gap-14 px-6 py-24 lg:grid-cols-[.65fr_1.35fr] lg:px-0"><Reveal><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#527b78]">01 / The control loop</p><h2 className="mt-6 max-w-[340px] text-[42px] font-semibold leading-[.94] tracking-[-.07em]">A dollar earns its way through.</h2></Reveal><Reveal className="bank-delay-1"><div className="grid gap-0 md:grid-cols-3">{[["01","Policy check","Caps, vendors, and destinations evaluated in 42ms."],["02","Allow or block","The wallet moves only when the policy says so."],["03","Escalate to human","Unusual spend pauses. You decide, not the model."]].map((item, i) => <div key={item[0]} className={`border-t border-[#b9c3c8] py-5 md:border-l md:border-t-0 md:pl-7 ${i === 0 ? "md:border-l-0 md:pl-0" : ""}`}><span className="font-mono text-[9px] text-[#527b78]">{item[0]}</span><h3 className="mt-12 text-[20px] font-medium tracking-[-.04em]">{item[1]}</h3><p className="mt-3 max-w-[190px] text-[11px] leading-[1.5] text-[#52716d]">{item[2]}</p></div>)}</div></Reveal></div></section>
    <section id="policies" className="mx-auto max-w-[1160px] px-6 py-32 lg:px-0"><Reveal><div className="flex flex-col justify-between gap-8 border-b border-[#d8c7ad] pb-12 md:flex-row md:items-end"><div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#527b78]">02 / Policy surface</p><h2 className="mt-5 text-[46px] font-semibold leading-[.9] tracking-[-.07em]">Rules that read<br />like your business.</h2></div><p className="max-w-[270px] text-[12px] leading-[1.5] text-[#52716d]">Write the boundary once. Enforce it across every agent wallet, on every transaction.</p></div></Reveal><Reveal className="bank-delay-1"><div className="grid gap-0 md:grid-cols-3"><div className="border-b border-[#d8c7ad] py-9 md:border-b-0 md:border-r md:pr-9"><span className="font-mono text-[9px] tracking-[.16em] text-[#527b78]">CAPS</span><div className="mt-12 font-mono text-[25px]">$500<span className="text-[#718681]">/tx</span></div><div className="mt-2 font-mono text-[12px] text-[#52716d]">$5,000/day</div><p className="mt-6 text-[11px] text-[#718681]">procurement-bot · USDC</p></div><div className="border-b border-[#d8c7ad] py-9 md:border-b-0 md:border-r md:px-9"><span className="font-mono text-[9px] tracking-[.16em] text-[#527b78]">ALLOWLIST</span><div className="mt-12 space-y-2 font-mono text-[12px]"><div>AWS <span className="text-[#527b78]">✓</span></div><div>OpenAI <span className="text-[#527b78]">✓</span></div><div className="text-[#9ba5aa]">New vendor <span className="text-[#527b78]">→ human</span></div></div></div><div className="py-9 md:pl-9"><span className="font-mono text-[9px] tracking-[.16em] text-[#527b78]">ANOMALY</span><div className="mt-12 text-[24px] tracking-[-.05em]">Pause the strange.</div><p className="mt-6 max-w-[190px] text-[11px] leading-[1.5] text-[#52716d]">Velocity, destination, and amount scored against the agent's working history.</p></div></div></Reveal></section>
    <section id="ledger" className="bg-[#123b43] px-6 py-28 text-[#f3ead9] lg:px-0"><div className="mx-auto max-w-[1160px]"><Reveal><div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#aab9c1]">03 / The signature moment</p><h2 className="mt-5 text-[46px] font-semibold leading-[.92] tracking-[-.07em]">Nothing moves<br />in the dark.</h2></div><p className="max-w-[250px] text-[12px] leading-[1.5] text-[#b8c2c6]">A quiet record of what agents tried, what policy decided, and who stepped in.</p></div></Reveal><Reveal className="bank-delay-1"><Ledger /></Reveal></div></section>
    <section id="contact" className="mx-auto max-w-[1160px] px-6 py-32 lg:px-0"><Reveal><div className="grid gap-12 border-b border-[#d8c7ad] pb-24 md:grid-cols-[1fr_.7fr]"><div><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#527b78]">Trust is the product</p><h2 className="mt-6 max-w-[680px] text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.9] tracking-[-.08em]">Let agents move.<br /><span className="text-[#52716d]">Keep the final word.</span></h2></div><div className="self-end"><p className="text-[14px] leading-[1.5] text-[#52716d]">Built for finance and engineering teams who need autonomy without giving up the ledger.</p><a href="mailto:control@thearcanum.in" className="group mt-8 inline-block border border-[#123b43] px-5 py-3.5 text-[11px] font-medium transition-colors hover:bg-[#123b43] hover:text-[#f3ead9]">Talk to an operator<Arrow /></a></div></div></Reveal></section>
    <footer className="mx-auto flex max-w-[1160px] flex-col justify-between gap-5 px-6 pb-10 text-[10px] text-[#718681] md:flex-row lg:px-0"><span className="font-semibold tracking-[-.05em] text-[#123b43]">ARCANUM</span><div className="flex gap-7"><a href="#system" className="hover:text-[#123b43]">Documentation</a><a href="mailto:control@thearcanum.in" className="hover:text-[#123b43]">Contact</a><span className="font-mono">© 2025 ARCANUM</span></div></footer>
  </main>;
}