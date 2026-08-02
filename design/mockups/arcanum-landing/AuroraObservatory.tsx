import "./aurora-observatory.css";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, CircleDot, Clock3, Fingerprint, LockKeyhole, ShieldCheck, TriangleAlert, UserRoundCheck } from "lucide-react";

const glass = "aurora-glass rounded-[20px]";

function Count({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => { let start = 0; const tick = () => { start += Math.max(1, Math.ceil(end / 32)); if (start >= end) { setValue(end); return; } setValue(start); requestAnimationFrame(tick); }; const id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, [end]);
  return <span className="aurora-mono">{prefix}{value.toLocaleString()}{suffix}</span>;
}

function StatusIcon({ type }: { type: "allow" | "block" | "escalate" }) {
  if (type === "block") return <TriangleAlert size={15} strokeWidth={1.7} />;
  if (type === "escalate") return <UserRoundCheck size={15} strokeWidth={1.7} />;
  return <Check size={15} strokeWidth={1.8} />;
}

function LedgerRow({ type, agent, vendor, amount, detail, time }: { type: "allow" | "block" | "escalate"; agent: string; vendor: string; amount: string; detail: string; time: string }) {
  const tone = type === "allow" ? "text-[#a5e7c2]" : type === "block" ? "text-[#e5a69c]" : "text-[#d4d7ac]";
  return <div className="flex items-center gap-3 border-t border-white/[.1] py-3.5 first:border-t-0 aurora-reveal" style={{ "--i": 3 } as React.CSSProperties}>
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current ${tone}`}><StatusIcon type={type}/></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold"><span>{agent}</span><span className="text-white/30">→</span><span className="text-white/80">{vendor}</span></div><div className="aurora-mono mt-1 truncate text-[9px] text-white/45">{detail}</div></div>
    <div className="text-right"><div className={`aurora-mono text-[12px] ${tone}`}>{amount}</div><div className="aurora-mono mt-1 text-[9px] text-white/35">{time}</div></div>
  </div>
}

function PolicyLine({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center justify-between border-t border-white/[.09] py-4 first:border-0"><div className="flex items-center gap-3 text-[12px] text-white/65">{icon}{label}</div><span className="aurora-mono text-[11px] text-[#b5d9c7]">{value}</span></div>
}

export function AuroraObservatory() {
  return <main className="aurora-page">
    <div className="aurora-world"><div className="aurora-orb one"/><div className="aurora-orb two"/></div>
    <div className="relative z-10 mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
      <nav className="aurora-reveal flex h-[82px] items-center justify-between" style={{ "--i": 0 } as React.CSSProperties}>
        <a href="#top" className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#a8dbc1]/50"><span className="h-2 w-2 rounded-full bg-[#8ed9b3] shadow-[0_0_15px_#8ed9b3]"/></span><span className="font-bold tracking-[.24em] text-[13px]">ARCANUM</span></a>
        <div className="hidden items-center gap-8 text-[11px] tracking-[.04em] text-white/60 md:flex"><a href="#governance" className="hover:text-white">Governance</a><a href="#ledger" className="hover:text-white">Live ledger</a><a href="#trust" className="hover:text-white">Trust layer</a></div>
        <a href="#contact" className="aurora-btn rounded-full border border-[#a8dbc1]/40 bg-[#d4f3e4]/10 px-4 py-2 text-[11px] font-semibold text-[#d9f2e5]">Request access <ArrowUpRight size={14} className="ml-1 inline"/></a>
      </nav>

      <section id="top" className="grid min-h-[700px] items-center gap-14 pb-24 pt-14 lg:grid-cols-[.88fr_1.12fr] lg:pt-20">
        <div><div className="aurora-reveal mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[.22em] text-[#9bd5b8]" style={{ "--i": 1 } as React.CSSProperties}><CircleDot size={13}/> Governance layer for agent wallets</div>
          <h1 className="aurora-reveal max-w-[600px] text-[clamp(3.8rem,7.4vw,6.9rem)] font-semibold leading-[.88]" style={{ "--i": 2 } as React.CSSProperties}>Autonomy,<br/><span className="text-[#a9d8bf]">under glass.</span></h1>
          <p className="aurora-reveal mt-8 max-w-[430px] text-[16px] leading-7 text-white/60" style={{ "--i": 3 } as React.CSSProperties}>ARCanum gives every AI agent a wallet with a mandate. Every dollar is checked, recorded, and answerable before it moves on Arc.</p>
          <div className="aurora-reveal mt-9 flex flex-wrap items-center gap-5" style={{ "--i": 4 } as React.CSSProperties}><a href="#contact" className="aurora-btn rounded-full bg-[#b8e8cb] px-5 py-3 text-[12px] font-semibold text-[#112c2a]">See the control plane <ArrowUpRight size={15} className="ml-1 inline"/></a><span className="aurora-mono text-[10px] text-white/40">42ms median policy check</span></div>
          <div className="aurora-reveal mt-16 grid max-w-[450px] grid-cols-3 gap-5 border-t border-white/[.14] pt-5" style={{ "--i": 5 } as React.CSSProperties}><div><strong className="block text-[22px] font-medium"><Count end={2400000} prefix="$" /></strong><span className="mt-1 block text-[9px] uppercase tracking-[.14em] text-white/40">governed volume</span></div><div><strong className="block text-[22px] font-medium"><Count end={184} /></strong><span className="mt-1 block text-[9px] uppercase tracking-[.14em] text-white/40">active policies</span></div><div><strong className="block text-[22px] font-medium"><Count end={0} suffix=" bps" /></strong><span className="mt-1 block text-[9px] uppercase tracking-[.14em] text-white/40">unexplained spend</span></div></div>
        </div>
        <div id="ledger" className={`${glass} aurora-reveal relative overflow-hidden p-4 sm:p-6`} style={{ "--i": 3 } as React.CSSProperties}>
          <div className="absolute -right-24 -top-20 h-56 w-56 rounded-full bg-[#7bd7ba]/10 blur-3xl"/><div className="relative flex items-center justify-between border-b border-white/[.12] pb-5"><div><div className="aurora-mono text-[9px] uppercase tracking-[.18em] text-[#a7d9bf]">ARC / telemetry stream</div><div className="mt-2 text-[17px] font-medium">Governed ledger <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[#a7d9bf]"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8ed9b3]"/> LIVE</span></div></div><div className="aurora-mono text-right text-[9px] text-white/40">UTC<br/><span className="text-white/70">14:08:32.441</span></div></div>
          <div className="py-1"><LedgerRow type="allow" agent="Atlas / 07" vendor="Cloudflare" amount="$84.20" detail="POL-042 · vendor allowlist / infra" time="14:08:31"/><LedgerRow type="escalate" agent="Mira / 02" vendor="Mercury API" amount="$1,240.00" detail="POL-107 · human approval requested" time="14:08:27"/><LedgerRow type="block" agent="Kestrel / 11" vendor="Unknown wallet" amount="$500.00" detail="POL-019 · destination not permitted" time="14:08:19"/></div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[.1] bg-[#08232a]/35 px-4 py-3"><span className="aurora-mono text-[9px] text-white/45">BLOCK RATE · LAST 24H</span><span className="aurora-mono text-[12px] text-[#b8e8cb]">1.7% <span className="text-white/35">/ 1,842 checks</span></span></div>
        </div>
      </section>

      <section id="governance" className="border-t border-white/[.12] py-28"><div className="grid gap-14 lg:grid-cols-[.7fr_1.3fr]"><div><p className="aurora-mono text-[10px] uppercase tracking-[.18em] text-[#a7d9bf]">01 / The mandate</p><h2 className="mt-5 max-w-[390px] text-4xl font-medium leading-[.98] sm:text-5xl">How a dollar gets governed.</h2><p className="mt-6 max-w-[330px] text-sm leading-6 text-white/50">A policy is not a dashboard setting. It is an executable boundary around an agent's intent.</p></div><div className="grid gap-3 sm:grid-cols-3"><div className={`${glass} p-5`}><span className="aurora-mono text-[10px] text-[#a7d9bf]">01</span><Fingerprint className="my-12 text-white/70" size={22} strokeWidth={1.4}/><h3 className="text-lg font-medium">Check intent</h3><p className="mt-2 text-xs leading-5 text-white/45">Read destination, amount, velocity, and policy context.</p></div><div className={`${glass} p-5`}><span className="aurora-mono text-[10px] text-[#a7d9bf]">02</span><ShieldCheck className="my-12 text-white/70" size={22} strokeWidth={1.4}/><h3 className="text-lg font-medium">Allow or block</h3><p className="mt-2 text-xs leading-5 text-white/45">The policy engine returns a deterministic verdict in 42ms.</p></div><div className={`${glass} p-5`}><span className="aurora-mono text-[10px] text-[#a7d9bf]">03</span><UserRoundCheck className="my-12 text-white/70" size={22} strokeWidth={1.4}/><h3 className="text-lg font-medium">Escalate</h3><p className="mt-2 text-xs leading-5 text-white/45">Exceptions move to a human, with context attached.</p></div></div></div></section>

      <section className="grid gap-8 pb-28 lg:grid-cols-[1.15fr_.85fr]"><div className={`${glass} p-7 sm:p-9`}><p className="aurora-mono text-[10px] uppercase tracking-[.18em] text-[#a7d9bf]">02 / Policy observatory</p><div className="mt-9 flex items-end justify-between"><h2 className="text-3xl font-medium">A mandate you can inspect.</h2><span className="aurora-mono text-[10px] text-white/35">POL-042</span></div><p className="mt-3 max-w-[480px] text-sm leading-6 text-white/50">Operators define the perimeter once. Agents work inside it without learning to ask permission.</p><div className="mt-8"><PolicyLine label="Per-transaction cap" value="$500 / tx" icon={<LockKeyhole size={15}/>}/><PolicyLine label="Daily velocity" value="$5,000 / day" icon={<Clock3 size={15}/>}/><PolicyLine label="Vendor destinations" value="12 approved" icon={<Check size={15}/>}/></div></div><div className="flex flex-col justify-between py-5 lg:pl-8"><div><p className="aurora-mono text-[10px] uppercase tracking-[.18em] text-[#a7d9bf]">Signal, not noise</p><h2 className="mt-5 text-4xl font-medium leading-[.95]">Quiet when<br/>everything is right.</h2><p className="mt-6 text-sm leading-6 text-white/50">The only alerts worth seeing are the ones that need you. Everything else is quietly accounted for.</p></div><a href="#trust" className="mt-12 flex items-center gap-2 text-xs text-[#b8e8cb]">Explore the trust layer <ChevronRight size={15}/></a></div></section>

      <section id="trust" className="border-t border-white/[.12] py-28"><div className="grid items-end gap-10 lg:grid-cols-[1fr_.85fr]"><div><p className="aurora-mono text-[10px] uppercase tracking-[.18em] text-[#a7d9bf]">03 / Proof of custody</p><h2 className="mt-5 max-w-[680px] text-5xl font-medium leading-[.93] sm:text-6xl">The ledger is the<br/><span className="text-white/45">source of truth.</span></h2></div><div className={`${glass} p-6`}><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-white/70"><ShieldCheck size={16} className="text-[#a7d9bf]"/> Audit integrity</span><span className="aurora-mono text-[10px] text-[#a7d9bf]">VERIFIED</span></div><div className="mt-7 border-l border-[#9ed8bb]/30 pl-4"><p className="aurora-mono text-[11px] leading-6 text-white/65">0x3f91…9a2c<br/>block 19,481,220<br/>2025-02-14 14:08:31 UTC</p></div><p className="mt-5 text-xs leading-5 text-white/45">Every decision carries its policy ID, its evidence, and its place in an append-only history.</p></div></div></section>

      <section id="contact" className={`${glass} mb-20 overflow-hidden px-7 py-16 text-center sm:px-10`}><div className="mx-auto max-w-[650px]"><p className="aurora-mono text-[10px] uppercase tracking-[.2em] text-[#a7d9bf]">Ready for the first orbit?</p><h2 className="mt-5 text-5xl font-medium leading-[.9] sm:text-7xl">Give your agents<br/><span className="text-[#a9d8bf]">a governed sky.</span></h2><p className="mx-auto mt-7 max-w-[400px] text-sm leading-6 text-white/50">Bring your policy surface. We will show you where every dollar goes.</p><a href="mailto:operators@thearcanum.in" className="aurora-btn mt-9 inline-block rounded-full bg-[#b8e8cb] px-6 py-3 text-[12px] font-semibold text-[#112c2a]">Talk to an operator <ArrowUpRight size={15} className="ml-1 inline"/></a></div></section>

      <footer className="flex flex-col justify-between gap-5 border-t border-white/[.12] py-8 text-[10px] text-white/40 sm:flex-row"><div className="flex items-center gap-3"><span className="font-bold tracking-[.2em] text-white/75">ARCANUM</span><span>Non-custodial governance for Arc</span></div><div className="flex gap-6"><span>thearcanum.in</span><span>© 2025</span><span className="aurora-mono">ARC / 01</span></div></footer>
    </div>
  </main>
}