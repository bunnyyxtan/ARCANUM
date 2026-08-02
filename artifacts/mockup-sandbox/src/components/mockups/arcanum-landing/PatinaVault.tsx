import React, { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, LockKeyhole, Menu, ShieldCheck, X } from "lucide-react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATE";

const rows: { time: string; agent: string; vendor: string; amount: string; verdict: Verdict; note: string }[] = [
  { time: "14:42:08.311", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", verdict: "ALLOWED", note: "policy match · infra" },
  { time: "14:42:09.047", agent: "procurement-bot", vendor: "OpenAI", amount: "$620.00", verdict: "BLOCKED", note: "daily cap exceeded" },
  { time: "14:42:11.803", agent: "treasury-bot", vendor: "Anthropic", amount: "$1,200.00", verdict: "ESCALATE", note: "new vendor · human review" },
  { time: "14:42:14.190", agent: "procurement-bot", vendor: "AWS", amount: "$48.60", verdict: "ALLOWED", note: "policy match · infra" },
  { time: "14:42:16.922", agent: "ops-agent", vendor: "OpenAI", amount: "$87.50", verdict: "ALLOWED", note: "policy match · tools" },
];

function Pill({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "copper" | "red" }) {
  const colors = tone === "copper" ? "bg-[#c68458]/12 text-[#995630] border-[#c68458]/40" : tone === "red" ? "bg-[#0e3a3e] text-[#d9eee9] border-[#0e3a3e]" : "bg-[#d7e4db] text-[#215d5b] border-[#a8c6ba]";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[.13em] ${colors}`}>{children}</span>;
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.24em] text-[#638b82]"><span className="h-px w-7 bg-[#bd7b53]" />{children}</div>;
}

export function PatinaVault() {
  const [mobile, setMobile] = useState(false);
  const [activeRow, setActiveRow] = useState(1);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setActiveRow((n) => (n + 1) % rows.length), 2400);
    return () => window.clearInterval(timer);
  }, []);
  const visibleRows = showAll ? rows : rows.slice(0, 4);
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f4f1e8] text-[#173f40]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap');
        :root { --petrol:#0e3a3e; --ink:#173f40; --copper:#bd7b53; }
        * { box-sizing:border-box } html { scroll-behavior:smooth }
        .display { font-family:'Syne',sans-serif; } .mono { font-family:'Space Mono',monospace; }
        .paper { background-image: radial-gradient(#173f40 0.6px,transparent .6px); background-size:17px 17px; background-position:3px 3px; opacity:.035 }
        .hairline { border-color: rgba(14,58,62,.18) }
        .reveal { animation: rise .8s cubic-bezier(.2,.8,.2,1) both } .delay-1{animation-delay:.1s}.delay-2{animation-delay:.2s}.delay-3{animation-delay:.3s}
        @keyframes rise { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes verdict { 0%,100%{transform:scale(1)} 50%{transform:scale(1.025)} }
        .pulse-verdict { animation: verdict 2.4s ease-in-out infinite }
        .gridlines { background-image:linear-gradient(rgba(14,58,62,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(14,58,62,.07) 1px,transparent 1px); background-size:46px 46px; }
        button,a { transition:transform .2s ease,background-color .2s ease,color .2s ease,border-color .2s ease; }
        button:active,a:active { transform:translateY(1px) } 
      `}</style>
      <div className="paper pointer-events-none fixed inset-0 z-0" />
      <nav className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between border-b hairline px-6 py-5 lg:px-10">
        <a href="#top" className="display text-[21px] font-extrabold tracking-[.19em] text-[#0e3a3e]">ARCANUM<span className="text-[#bd7b53]">.</span></a>
        <div className={`${mobile ? "absolute left-0 top-full flex w-full flex-col bg-[#f4f1e8] p-6 shadow-xl" : "hidden"} gap-6 text-xs font-bold uppercase tracking-[.14em] md:static md:flex md:flex-row md:bg-transparent md:p-0 md:shadow-none`}>
          <a href="#governed" className="hover:text-[#bd7b53]">The ledger</a><a href="#policies" className="hover:text-[#bd7b53]">Policies</a><a href="#proof" className="hover:text-[#bd7b53]">Proof</a>
        </div>
        <div className="flex items-center gap-4"><a href="#contact" className="hidden rounded-sm bg-[#0e3a3e] px-4 py-2.5 text-xs font-bold uppercase tracking-[.12em] text-[#f4f1e8] hover:bg-[#225d5d] md:block">Request access <ArrowUpRight className="ml-2 inline h-3.5 w-3.5" /></a><button onClick={() => setMobile(!mobile)} className="md:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button></div>
      </nav>

      <section id="top" className="relative z-10 mx-auto grid max-w-[1240px] grid-cols-1 gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.04fr_.96fr] lg:px-10 lg:pb-32 lg:pt-28">
        <div className="reveal self-center"><SectionKicker>Non-custodial control layer / Arc mainnet</SectionKicker><h1 className="display max-w-[720px] text-[clamp(3.5rem,7.2vw,7.3rem)] font-extrabold leading-[.88] tracking-[-.065em] text-[#0e3a3e]">Every dollar.<br /><span className="text-[#bd7b53]">Accounted for.</span></h1><p className="mt-8 max-w-[510px] text-lg leading-8 text-[#426663]">ARCANUM governs USDC wallets for autonomous agents—before a transaction leaves the wallet, not after.</p><div className="mt-9 flex flex-wrap items-center gap-5"><a href="#governed" className="rounded-sm bg-[#0e3a3e] px-6 py-4 text-sm font-bold text-[#f4f1e8] shadow-[5px_5px_0_#bd7b53] hover:bg-[#225d5d]">See the ledger <ArrowUpRight className="ml-4 inline h-4 w-4" /></a><span className="mono text-[10px] leading-5 text-[#638b82]">42ms average policy check<br />$2.4M governed this month</span></div></div>
        <div className="reveal delay-2 relative flex min-h-[430px] items-center justify-center">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full border border-[#bd7b53]/40" /><div className="absolute right-8 top-8 h-48 w-48 rounded-full border border-[#bd7b53]/30" />
          <div className="relative w-full max-w-[500px] border border-[#0e3a3e]/30 bg-[#e8e7dc] p-5 shadow-[14px_14px_0_#d0d8cc]">
            <div className="flex items-center justify-between border-b border-[#0e3a3e]/20 pb-4"><span className="mono text-[10px] uppercase tracking-[.15em]">Wallet / 0x3f…9a2c</span><Pill><span className="h-1.5 w-1.5 rounded-full bg-[#bd7b53]" /> Live</Pill></div>
            <div className="py-8"><div className="mono text-[10px] uppercase text-[#638b82]">Available balance</div><div className="display mt-1 text-5xl font-bold tracking-[-.05em]">$48,230<span className="text-2xl text-[#bd7b53]">.40</span></div></div>
            <div className="grid grid-cols-2 gap-px bg-[#0e3a3e]/15 text-xs"><div className="bg-[#e8e7dc] p-4"><div className="mono text-[9px] text-[#638b82]">DAILY CAP</div><b className="mt-2 block text-lg">$5,000</b></div><div className="bg-[#e8e7dc] p-4"><div className="mono text-[9px] text-[#638b82]">VENDORS</div><b className="mt-2 block text-lg">12 allowlisted</b></div></div>
            <div className="mt-4 flex items-center justify-between text-[10px] text-[#638b82]"><span className="mono">POLICY / AP-042</span><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-[#bd7b53]" /> Enforced on-chain</span></div>
          </div>
        </div>
      </section>

      <section id="governed" className="relative z-10 border-y border-[#0e3a3e]/20 bg-[#e0e6dc] py-24 lg:py-32"><div className="mx-auto max-w-[1240px] px-6 lg:px-10"><SectionKicker>The transaction path</SectionKicker><div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><h2 className="display max-w-[600px] text-5xl font-bold leading-[.95] tracking-[-.05em] text-[#0e3a3e] lg:text-7xl">A dollar has<br />three chances.</h2><p className="max-w-[300px] text-sm leading-6 text-[#426663]">No blind spots. No retroactive reports. Every agent instruction meets the same hard perimeter.</p></div>
          <div className="mt-16 grid grid-cols-1 gap-0 border-t border-[#0e3a3e]/25 md:grid-cols-3">{[["01","CHECK","Policy engine reads the instruction, vendor, amount and context in 42ms.","$500 / tx · $5,000 / day"],["02","DECIDE","Allowlisted and within limits? The wallet signs. Anything else is stopped.","ALLOW  /  BLOCK"],["03","ESCALATE","Ambiguous or high-value? Hold the funds and ask a human.","HUMAN IN THE LOOP"]].map(([num,title,copy,meta],i)=><div key={num} className={`border-b border-[#0e3a3e]/25 py-8 md:border-b-0 md:border-r md:px-8 ${i===0?"md:pl-0":""}`}><div className="mono text-xs text-[#bd7b53]">{num}</div><h3 className="display mt-6 text-2xl font-bold">{title}</h3><p className="mt-4 max-w-[270px] text-sm leading-6 text-[#426663]">{copy}</p><div className="mono mt-8 text-[10px] font-bold tracking-[.08em] text-[#215d5b]">{meta}</div></div>)}</div>
        </div></section>

      <section className="relative z-10 mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32"><div className="grid grid-cols-1 gap-14 lg:grid-cols-[.7fr_1.3fr]"><div><SectionKicker>Live governed ledger</SectionKicker><h2 className="display text-5xl font-bold leading-[.95] tracking-[-.05em] lg:text-6xl">The verdict<br /><span className="text-[#bd7b53]">is the record.</span></h2><p className="mt-7 max-w-[300px] text-sm leading-6 text-[#426663]">Watch policy enforcement happen at the edge. A complete audit trail, signed and readable by your finance team.</p><div className="mt-12 border-l-2 border-[#bd7b53] pl-4"><div className="mono text-[10px] text-[#638b82]">TODAY / 14:42 UTC</div><div className="mt-2 text-sm font-bold">$2,410.30 processed</div><div className="mt-1 text-xs text-[#638b82]">3 allowed · 1 blocked · 1 escalated</div></div></div>
          <div className="gridlines overflow-hidden border border-[#0e3a3e]/25 bg-[#eef0e7] shadow-[8px_8px_0_#bd7b53]/30"><div className="flex items-center justify-between border-b border-[#0e3a3e]/20 bg-[#dce4d9] px-4 py-4"><span className="mono text-[10px] font-bold tracking-[.1em]">ARC / GOVERNED EVENTS</span><span className="flex items-center gap-2 text-[10px] text-[#638b82]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#bd7b53]" /> STREAMING</span></div><div>{visibleRows.map((row, i)=><div key={row.time} className={`grid grid-cols-[.82fr_1fr_.72fr_.75fr] items-center gap-3 border-b border-[#0e3a3e]/10 px-4 py-5 transition-all duration-500 ${i===activeRow ? "bg-[#d5e1d7]" : ""}`}><div className="mono text-[9px] text-[#638b82]">{row.time}</div><div><div className="text-xs font-bold">{row.agent}</div><div className="mono mt-1 text-[9px] text-[#638b82]">{row.vendor} · {row.note}</div></div><div className="mono text-right text-xs font-bold">{row.amount}</div><div className="text-right">{row.verdict==="ALLOWED"?<Pill tone="copper"><Check className="h-3 w-3" /> ALLOWED</Pill>:row.verdict==="BLOCKED"?<Pill tone="red"><X className="h-3 w-3" /> BLOCKED</Pill>:<Pill><CircleAlert className="h-3 w-3" /> ESCALATE</Pill>}</div></div>)}</div><button onClick={()=>setShowAll(!showAll)} className="flex w-full items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-[.15em] text-[#215d5b] hover:bg-[#dce4d9]">{showAll?"Collapse ledger":"View full ledger"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll?"rotate-180":""}`} /></button></div>
         </div></section>

      <section id="policies" className="relative z-10 bg-[#0e3a3e] py-24 text-[#e5ebe0] lg:py-32"><div className="mx-auto max-w-[1240px] px-6 lg:px-10"><div className="grid grid-cols-1 gap-14 lg:grid-cols-[.9fr_1.1fr]"><div><SectionKicker>Policy primitives</SectionKicker><h2 className="display max-w-[500px] text-5xl font-bold leading-[.95] tracking-[-.05em] lg:text-6xl">Rules that hold<br /><span className="text-[#bd7b53]">under pressure.</span></h2><p className="mt-7 max-w-[360px] text-sm leading-6 text-[#b0c6b9]">Define the perimeter once. ARCANUM applies it to every agent, vendor and wallet without exceptions.</p><a href="#contact" className="mt-9 inline-block border-b border-[#bd7b53] pb-2 text-xs font-bold uppercase tracking-[.16em] text-[#e5ebe0] hover:text-[#bd7b53]">Explore the API <ArrowUpRight className="ml-3 inline h-3.5 w-3.5" /></a></div><div className="divide-y divide-[#8eafa2]/25 border-y border-[#8eafa2]/25">{[["01","Spend controls","Per-transaction and rolling daily caps, enforced before signing.","$500 / TX"],["02","Vendor perimeter","Allowlist vendors and contract addresses. Block everything else.","12 VENDORS"],["03","Human approvals","Route high-value, new-vendor and anomalous requests to Slack or API.","2 APPROVERS"],["04","Audit ledger","Immutable event history with reason codes, timestamps and signatures.","365 DAYS"]].map(([n,t,c,m])=><div key={n} className="flex items-center gap-5 py-6 hover:bg-[#17494a]"><span className="mono text-xs text-[#bd7b53]">{n}</span><div className="flex-1"><h3 className="text-base font-bold">{t}</h3><p className="mt-1 text-xs leading-5 text-[#a8c0b5]">{c}</p></div><span className="mono hidden text-[9px] tracking-[.1em] text-[#bd7b53] sm:block">{m}</span></div>)}</div></div></div></section>

      <section id="proof" className="relative z-10 mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32"><div className="grid grid-cols-1 items-end gap-10 border-b border-[#0e3a3e]/20 pb-14 lg:grid-cols-[1fr_1.4fr]"><div><SectionKicker>Built for the balance sheet</SectionKicker><h2 className="display text-5xl font-bold leading-[.95] tracking-[-.05em] lg:text-6xl">Trust is<br /><span className="text-[#bd7b53]">the product.</span></h2></div><div className="grid grid-cols-2 gap-8 lg:grid-cols-3"><div><div className="display text-4xl font-bold">$2.4M</div><div className="mono mt-2 text-[9px] uppercase tracking-[.12em] text-[#638b82]">USDC governed</div></div><div><div className="display text-4xl font-bold">42ms</div><div className="mono mt-2 text-[9px] uppercase tracking-[.12em] text-[#638b82]">policy latency</div></div><div className="hidden lg:block"><div className="display text-4xl font-bold">0</div><div className="mono mt-2 text-[9px] uppercase tracking-[.12em] text-[#638b82]">unaccounted dollars</div></div></div></div><div className="mt-12 flex flex-col justify-between gap-8 md:flex-row md:items-center"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#bd7b53] text-[#bd7b53]"><LockKeyhole className="h-5 w-5" /></div><div><div className="text-sm font-bold">Non-custodial by design</div><div className="mt-1 text-xs text-[#638b82]">Your keys. Your wallets. Your policy layer.</div></div></div><div className="mono max-w-[440px] text-xs leading-6 text-[#638b82]">“The agent can move money. It cannot move money outside the rules.”<br /><span className="text-[#173f40]">— Finance lead, Arc ecosystem company</span></div></div></section>

      <section id="contact" className="relative z-10 mx-6 mb-10 overflow-hidden bg-[#d9e1d5] px-6 py-20 lg:mx-auto lg:max-w-[1180px] lg:px-20"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-[#bd7b53]/45" /><div className="relative max-w-[620px]"><SectionKicker>Put a perimeter around autonomy</SectionKicker><h2 className="display text-5xl font-bold leading-[.92] tracking-[-.06em] lg:text-7xl">Let your agents<br /><span className="text-[#bd7b53]">do more.</span><br />Not spend more.</h2><p className="mt-7 max-w-[410px] text-sm leading-6 text-[#426663]">Bring us your wallet architecture. We’ll show you exactly where ARCANUM fits.</p><button className="mt-9 rounded-sm bg-[#0e3a3e] px-6 py-4 text-sm font-bold text-[#f4f1e8] hover:bg-[#225d5d]">Request a technical briefing <ArrowUpRight className="ml-4 inline h-4 w-4" /></button></div></section>
      <footer className="relative z-10 mx-auto flex max-w-[1240px] flex-col justify-between gap-5 border-t hairline px-6 py-8 text-xs text-[#638b82] md:flex-row md:items-center lg:px-10"><div className="display font-bold tracking-[.18em] text-[#0e3a3e]">ARCANUM<span className="text-[#bd7b53]">.</span></div><div className="flex gap-5"><a href="#policies" className="hover:text-[#bd7b53]">Documentation</a><a href="#contact" className="hover:text-[#bd7b53]">Contact</a><span className="mono text-[10px]">© 2025 ARCANUM</span></div></footer>
    </main>
  );
}
