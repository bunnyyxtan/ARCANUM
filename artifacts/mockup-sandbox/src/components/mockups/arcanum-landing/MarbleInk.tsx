import React, { useEffect, useState } from "react";

type Verdict = "allowed" | "blocked" | "escalated";

const ledgerRows: Array<{
  time: string;
  agent: string;
  vendor: string;
  amount: string;
  wallet: string;
  verdict: Verdict;
  note: string;
}> = [
  { time: "09:41:08", agent: "procurement-bot", vendor: "AWS", amount: "$184.00", wallet: "0x3f…9a2c", verdict: "allowed", note: "within daily cap" },
  { time: "09:41:14", agent: "research-bot", vendor: "OpenAI", amount: "$68.40", wallet: "0x8c…41ef", verdict: "allowed", note: "vendor allowlist" },
  { time: "09:41:22", agent: "procurement-bot", vendor: "Anthropic", amount: "$920.00", wallet: "0x3f…9a2c", verdict: "blocked", note: "over $500 / tx cap" },
  { time: "09:41:27", agent: "ops-agent", vendor: "AWS", amount: "$1,200.00", wallet: "0xb1…77d0", verdict: "escalated", note: "human approval required" },
];

function Mark() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center border border-[#af8f62] text-[11px] font-semibold tracking-[-0.08em] text-[#af8f62]" aria-hidden="true">
      A
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#917c62]">{children}</p>;
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  const styles = {
    allowed: "border-[#9fae96] bg-[#eef0e8] text-[#4b674d]",
    blocked: "border-[#c68170] bg-[#f6e5df] text-[#9f493d]",
    escalated: "border-[#c9a665] bg-[#f5edda] text-[#85652b]",
  }[verdict];
  return <span className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${styles}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{verdict}</span>;
}

export function MarbleInk() {
  const [activeRow, setActiveRow] = useState(2);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveRow((row) => (row + 1) % ledgerRows.length), 3600);
    return () => window.clearInterval(timer);
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f3f0e8] text-[#23231f]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap');
        :root { --ink:#23231f; --bone:#f3f0e8; --paper:#faf8f2; --line:#d8d0c2; --gold:#af8f62; }
        html { scroll-behavior:smooth; }
        .serif { font-family:'Fraunces', Georgia, serif; }
        .mono { font-family:'DM Mono', monospace; font-variant-numeric:tabular-nums; }
        .rule { border-color:var(--line); }
        .reveal { animation: rise .8s both cubic-bezier(.22,.8,.24,1); }
        .delay-1 { animation-delay:.1s } .delay-2 { animation-delay:.2s } .delay-3 { animation-delay:.3s }
        @keyframes rise { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ledgerPulse { 0%,100% { opacity:.7; transform:scale(1) } 50% { opacity:1; transform:scale(1.08) } }
        .pulse-dot { animation:ledgerPulse 2.2s ease-in-out infinite; }
        .grain:after { content:''; pointer-events:none; position:fixed; inset:0; opacity:.035; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"); z-index:20; mix-blend-mode:multiply; }
        button, a { transition: transform .2s ease, color .2s ease, background-color .2s ease, border-color .2s ease, opacity .2s ease; }
        button:active, a:active { transform:translateY(1px); }
      `}</style>
      <div className="grain relative">
        <header className="mx-auto flex max-w-[1240px] items-center justify-between border-b rule px-6 py-5 lg:px-10">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-3 text-left" aria-label="Return to top"><Mark /><span className="text-[13px] font-semibold tracking-[0.3em]">ARCANUM</span></button>
          <nav className="hidden items-center gap-9 md:flex">
            <button onClick={() => scrollTo("governed")} className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#756d61] hover:text-[#af8f62]">The method</button>
            <button onClick={() => scrollTo("ledger")} className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#756d61] hover:text-[#af8f62]">Live ledger</button>
            <button onClick={() => scrollTo("controls")} className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#756d61] hover:text-[#af8f62]">Controls</button>
          </nav>
          <button onClick={() => setMenuOpen(!menuOpen)} className="border border-[#b9ad9d] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] hover:border-[#23231f] hover:bg-[#23231f] hover:text-[#f3f0e8]">Request a briefing</button>
          {menuOpen && <div className="absolute right-6 top-[68px] z-10 w-64 border border-[#c8bda9] bg-[#faf8f2] p-5 shadow-[0_16px_40px_rgba(50,42,30,.12)]"><p className="serif text-xl">A private conversation.</p><p className="mt-2 text-xs leading-5 text-[#756d61]">Tell us where your agents spend. We will show you what your policy can see.</p><button onClick={() => setMenuOpen(false)} className="mt-4 w-full border border-[#23231f] py-2 font-mono text-[10px] uppercase tracking-[.14em] hover:bg-[#23231f] hover:text-[#f3f0e8]">Close</button></div>}
        </header>

        <section id="top" className="mx-auto grid max-w-[1240px] gap-16 px-6 pb-28 pt-24 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-36 lg:pt-32">
          <div className="reveal">
            <Eyebrow>Governance layer · Arc network</Eyebrow>
            <h1 className="serif max-w-[710px] text-[clamp(3.7rem,7vw,7.7rem)] leading-[.88] tracking-[-.065em]">Every dollar<br /><em className="text-[#917c62]">has a witness.</em></h1>
            <p className="mt-9 max-w-[510px] text-[17px] leading-7 text-[#625e56]">ARCANUM gives autonomous AI agents a wallet — then gives your finance team the final word on every USDC transaction.</p>
            <div className="mt-10 flex flex-wrap items-center gap-5"><button onClick={() => scrollTo("ledger")} className="bg-[#23231f] px-6 py-3.5 text-[12px] font-semibold tracking-[.08em] text-[#f3f0e8] hover:bg-[#af8f62]">See a dollar move <span className="ml-5">↗</span></button><button onClick={() => scrollTo("governed")} className="border-b border-[#af8f62] pb-1 text-[12px] font-semibold tracking-[.08em] text-[#756d61] hover:text-[#23231f]">How it works</button></div>
            <div className="mt-20 grid max-w-[590px] grid-cols-3 border-t rule pt-5"><div><p className="mono text-[22px]">$2.4M</p><p className="mt-1 text-[10px] uppercase tracking-[.15em] text-[#917c62]">governed</p></div><div><p className="mono text-[22px]">42ms</p><p className="mt-1 text-[10px] uppercase tracking-[.15em] text-[#917c62]">policy checks</p></div><div><p className="mono text-[22px]">0</p><p className="mt-1 text-[10px] uppercase tracking-[.15em] text-[#917c62]">unreviewed exceptions</p></div></div>
          </div>
          <div className="reveal delay-2 relative flex min-h-[470px] items-center justify-center">
            <div className="absolute right-2 top-0 h-[390px] w-[78%] border border-[#d0c5b3] bg-[#ebe6da]" />
            <div className="absolute left-0 top-16 h-[390px] w-[82%] border border-[#d0c5b3] bg-[#e8e1d3]" />
            <div className="relative z-[1] w-[88%] border border-[#bda986] bg-[#faf8f2] p-7 shadow-[14px_18px_0_#dfd7c9]">
              <div className="flex items-start justify-between border-b rule pb-6"><div><p className="mono text-[9px] uppercase tracking-[.2em] text-[#917c62]">Certificate no. 00042</p><p className="serif mt-2 text-3xl">Spending authority</p></div><Mark /></div>
              <div className="py-7"><p className="text-[11px] leading-5 text-[#756d61]">This instrument confirms that the following agent wallet may act only within the boundaries inscribed below.</p><div className="mt-7 grid grid-cols-2 gap-y-5 border-y rule py-5"><div><p className="mono text-[9px] uppercase tracking-wider text-[#917c62]">Agent</p><p className="mt-1 text-sm">procurement-bot</p></div><div><p className="mono text-[9px] uppercase tracking-wider text-[#917c62]">Network</p><p className="mt-1 text-sm">Arc / USDC</p></div><div><p className="mono text-[9px] uppercase tracking-wider text-[#917c62]">Per transaction</p><p className="mono mt-1 text-sm">$500.00</p></div><div><p className="mono text-[9px] uppercase tracking-wider text-[#917c62]">Per day</p><p className="mono mt-1 text-sm">$5,000.00</p></div></div></div>
              <div className="flex items-end justify-between"><div><p className="serif text-xl italic text-[#917c62]">R. Sato</p><p className="mono text-[8px] uppercase tracking-wider text-[#917c62]">human signatory · 08.14.24</p></div><p className="mono text-[9px] text-[#917c62]">VALID / ACTIVE</p></div>
            </div>
          </div>
        </section>

        <section id="governed" className="border-y rule bg-[#eae5da]">
          <div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-28"><Eyebrow>A dollar’s itinerary</Eyebrow><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><h2 className="serif max-w-[430px] text-5xl leading-[.95] tracking-[-.05em]">The policy speaks before the agent does.</h2><div className="grid gap-0 md:grid-cols-3"><div className="border-t border-[#bfb3a0] py-5 md:mr-7"><p className="mono text-[11px] text-[#af8f62]">01 / CHECK</p><h3 className="serif mt-7 text-2xl">Read the intent.</h3><p className="mt-3 text-sm leading-6 text-[#756d61]">Vendor, amount, wallet, time of day, and the policy attached to this agent.</p></div><div className="border-t border-[#bfb3a0] py-5 md:mr-7"><p className="mono text-[11px] text-[#af8f62]">02 / DECIDE</p><h3 className="serif mt-7 text-2xl">Allow or block.</h3><p className="mt-3 text-sm leading-6 text-[#756d61]">42ms later, the transaction either moves on Arc or stops at the gate.</p></div><div className="border-t border-[#bfb3a0] py-5"><p className="mono text-[11px] text-[#af8f62]">03 / ESCALATE</p><h3 className="serif mt-7 text-2xl">Ask a human.</h3><p className="mt-3 text-sm leading-6 text-[#756d61]">Exceptions become a signed request — never a silent bypass.</p></div></div></div></div>
        </section>

        <section id="ledger" className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32"><div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><Eyebrow>Signature moment · live governed ledger</Eyebrow><h2 className="serif text-5xl tracking-[-.05em]">The quietest room<br /><em className="text-[#917c62]">in the company.</em></h2></div><div className="flex items-center gap-3 border border-[#c3b7a5] px-4 py-3"><span className="pulse-dot h-2 w-2 rounded-full bg-[#708571]" /><span className="mono text-[10px] uppercase tracking-[.14em] text-[#756d61]">Watching Arc mainnet</span></div></div>
          <div className="border border-[#c8bda9] bg-[#e9e2d5] p-3 shadow-[8px_10px_0_#dfd7c9]"><div className="border border-[#c8bda9] bg-[#f8f5ed]"><div className="grid grid-cols-[.7fr_1.25fr_1fr_.7fr_.9fr] border-b rule px-5 py-4 font-mono text-[9px] uppercase tracking-[.15em] text-[#917c62]"><span>Time</span><span>Agent / vendor</span><span>Wallet</span><span>Amount</span><span>Verdict</span></div>{ledgerRows.map((row, index) => <div key={row.time} className={`grid grid-cols-[.7fr_1.25fr_1fr_.7fr_.9fr] items-center border-b rule px-5 py-5 last:border-0 transition-all duration-500 ${activeRow === index ? "bg-[#f0ece2]" : ""}`}><span className="mono text-[11px] text-[#917c62]">{row.time}</span><span><span className="block text-sm">{row.agent}</span><span className="mt-1 block text-[11px] text-[#8b8376]">{row.vendor} · <span className="mono">{row.note}</span></span></span><span className="mono text-[11px] text-[#756d61]">{row.wallet}</span><span className="mono text-[13px]">{row.amount}</span><span><VerdictPill verdict={row.verdict} /></span></div>)}</div></div>
          <div className="mt-5 flex justify-between font-mono text-[9px] uppercase tracking-[.15em] text-[#917c62]"><span>Entries are immutable · ordered by confirmation</span><span>Block 18,442,091</span></div>
        </section>

        <section id="controls" className="border-t rule bg-[#23231f] text-[#f3f0e8]"><div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-28"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><Eyebrow>Control room / 04</Eyebrow><h2 className="serif text-5xl leading-[.95] tracking-[-.05em]">Rules that can<br /><em className="text-[#c6a975]">hold their ground.</em></h2><p className="mt-7 max-w-sm text-sm leading-6 text-[#b5afa4]">Write the boundary once. ARCANUM enforces it at the wallet — not in a spreadsheet after the fact.</p></div><div className="grid grid-cols-1 gap-0 sm:grid-cols-2"><div className="border-t border-[#4a4841] py-5 sm:mr-10"><p className="mono text-[10px] text-[#c6a975]">01</p><h3 className="serif mt-8 text-2xl">Vendor allowlists</h3><p className="mt-3 text-sm leading-6 text-[#b5afa4]">AWS and Anthropic may pass. Any new counterparty asks first.</p></div><div className="border-t border-[#4a4841] py-5"><p className="mono text-[10px] text-[#c6a975]">02</p><h3 className="serif mt-8 text-2xl">Caps with context</h3><p className="mt-3 text-sm leading-6 text-[#b5afa4]">$500 / tx · $5,000 / day · $25,000 / month, per wallet.</p></div><div className="border-t border-[#4a4841] py-5 sm:mr-10"><p className="mono text-[10px] text-[#c6a975]">03</p><h3 className="serif mt-8 text-2xl">Human escalation</h3><p className="mt-3 text-sm leading-6 text-[#b5afa4]">Route the unusual spend to a named approver with a signed trail.</p></div><div className="border-t border-[#4a4841] py-5"><p className="mono text-[10px] text-[#c6a975]">04</p><h3 className="serif mt-8 text-2xl">Anomaly signals</h3><p className="mt-3 text-sm leading-6 text-[#b5afa4]">Spot velocity, destination, and behavior that does not fit the role.</p></div></div></div></div></section>

        <section className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-28"><div className="grid gap-12 lg:grid-cols-[1fr_1fr]"><div><Eyebrow>Proof, in figures</Eyebrow><p className="serif max-w-[550px] text-4xl leading-[1.02] tracking-[-.04em]">“We gave the agent a wallet. ARCANUM gave us the confidence to let it use one.”</p><p className="mt-8 font-mono text-[10px] uppercase tracking-[.15em] text-[#917c62]">— Mira Chen · CFO, Northstar Systems</p></div><div className="border-l border-[#c8bda9] pl-8 lg:pl-16"><div className="grid grid-cols-2 gap-y-10"><div><p className="mono text-4xl">14,208</p><p className="mt-2 text-xs text-[#756d61]">transactions evaluated</p></div><div><p className="mono text-4xl">18</p><p className="mt-2 text-xs text-[#756d61]">active agent wallets</p></div><div><p className="mono text-4xl">7</p><p className="mt-2 text-xs text-[#756d61]">blocked this month</p></div><div><p className="mono text-4xl">100%</p><p className="mt-2 text-xs text-[#756d61]">ledger coverage</p></div></div></div></div></section>

        <section className="border-t rule bg-[#eae5da]"><div className="mx-auto max-w-[1240px] px-6 py-24 text-center lg:px-10 lg:py-32"><Eyebrow>Start with one wallet</Eyebrow><h2 className="serif mx-auto max-w-3xl text-6xl leading-[.9] tracking-[-.06em]">Let your agents move.<br /><em className="text-[#917c62]">Keep the signature.</em></h2><button onClick={() => setMenuOpen(true)} className="mt-10 bg-[#23231f] px-7 py-4 text-[12px] font-semibold tracking-[.08em] text-[#f3f0e8] hover:bg-[#af8f62]">Request a private briefing <span className="ml-5">↗</span></button></div></section>
        <footer className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 px-6 py-8 md:flex-row md:items-center lg:px-10"><div className="flex items-center gap-3"><Mark /><span className="text-[11px] font-semibold tracking-[.28em]">ARCANUM</span></div><p className="mono text-[9px] uppercase tracking-[.12em] text-[#917c62]">Non-custodial governance for AI-agent USDC wallets</p><div className="flex gap-6 font-mono text-[9px] uppercase tracking-[.12em] text-[#756d61]"><button onClick={() => scrollTo("top")} className="hover:text-[#af8f62]">Back to top ↑</button><button onClick={() => setMenuOpen(true)} className="hover:text-[#af8f62]">Contact</button></div></footer>
      </div>
    </main>
  );
}