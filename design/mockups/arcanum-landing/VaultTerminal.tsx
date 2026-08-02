import React, { useEffect, useState } from "react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATE";

const ledgerSeed = [
  { agent: "procurement-bot", vendor: "AWS", amount: "$184.20", address: "0x3f…9a2c", verdict: "ALLOWED" as Verdict, rule: "vendor allowlist · cap $500/tx" },
  { agent: "research-runner", vendor: "OpenAI", amount: "$38.00", address: "0x82…1d7e", verdict: "ALLOWED" as Verdict, rule: "daily spend · $5,000 remaining" },
  { agent: "procurement-bot", vendor: "Anthropic", amount: "$612.00", address: "0x3f…9a2c", verdict: "BLOCKED" as Verdict, rule: "exceeds $500 per transaction cap" },
  { agent: "growth-agent", vendor: "AWS", amount: "$2,400.00", address: "0x71…e04f", verdict: "ESCALATE" as Verdict, rule: "new vendor · approval requested" },
];

function Mark({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "orange" | "green" }) {
  return <span className={`font-mono text-[10px] tracking-[.16em] ${tone === "orange" ? "text-[#e87d35]" : tone === "green" ? "text-[#a4c49a]" : "text-[#7d817b]"}`}>{children}</span>;
}

function Arrow() {
  return <span className="text-[#e87d35]">→</span>;
}

export function VaultTerminal() {
  const [live, setLive] = useState(2);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setLive((n) => (n + 1) % ledgerSeed.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#111311] text-[#e4e4dc] selection:bg-[#e87d35] selection:text-[#111311]" style={{ fontFamily: "var(--arcanum-mono)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root { --arcanum-mono:'JetBrains Mono',ui-monospace,monospace; --arcanum-display:'Barlow Condensed',Impact,sans-serif; }
        * { box-sizing:border-box; } html { scroll-behavior:smooth; }
        .dot-grid { background-image: radial-gradient(#4d514a 0.75px, transparent .75px); background-size: 18px 18px; }
        .hairline { border-color:#30342f; } .surface { background:#171a17; }
        .reveal { animation: reveal .8s ease-out both; } .d1 { animation-delay:.08s } .d2 { animation-delay:.16s } .d3 { animation-delay:.24s }
        @keyframes reveal { from {opacity:0;transform:translateY(14px)} to {opacity:1;transform:translateY(0)} }
        @keyframes pulseDot { 0%,100% {opacity:.35} 50% {opacity:1} }
        .live-dot { animation:pulseDot 1.4s ease-in-out infinite; }
        button,a { transition:background-color .18s ease,color .18s ease,border-color .18s ease,transform .18s ease; }
        button:active,a:active { transform:translateY(1px); }
      `}</style>

      <nav className="mx-auto flex max-w-[1320px] items-center justify-between border-b hairline px-6 py-5 lg:px-10">
        <a href="#" className="flex items-center gap-3 text-[#f0efe7] hover:text-[#e87d35]"><span className="h-3 w-3 bg-[#e87d35]" /><span className="text-[15px] font-bold tracking-[.24em]">ARCANUM</span><Mark>GOVERNANCE LAYER</Mark></a>
        <div className="hidden items-center gap-8 text-[11px] tracking-[.12em] text-[#9a9d95] md:flex">
          <a href="#method" className="hover:text-[#e4e4dc]">METHOD</a><a href="#ledger" className="hover:text-[#e4e4dc]">LEDGER</a><a href="#policies" className="hover:text-[#e4e4dc]">POLICIES</a><a href="#proof" className="hover:text-[#e4e4dc]">PROOF</a>
        </div>
        <a href="#contact" className="border border-[#555950] px-4 py-2 text-[10px] tracking-[.16em] text-[#e4e4dc] hover:border-[#e87d35] hover:text-[#e87d35]">REQUEST ACCESS <Arrow /></a>
      </nav>

      <section className="dot-grid relative border-b hairline">
        <div className="mx-auto grid max-w-[1320px] items-end gap-16 px-6 pb-24 pt-24 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:pb-32 lg:pt-32">
          <div className="reveal">
            <Mark tone="orange">ARC / GOVERNANCE PROTOCOL 01</Mark>
            <h1 className="mt-7 max-w-[760px] font-[var(--arcanum-display)] text-[clamp(4rem,9vw,8.5rem)] font-semibold uppercase leading-[.84] tracking-[-.035em] text-[#e9e8df]">Every dollar<br /><span className="text-[#8d9188]">has a witness.</span></h1>
            <p className="mt-9 max-w-[530px] font-mono text-sm leading-7 text-[#9a9d95]">ARCANUM governs autonomous USDC wallets on Arc. Policies check every transaction before it moves. Operators see the decision, the rule, and the human who approved it.</p>
            <div className="mt-10 flex flex-wrap gap-3"><a href="#ledger" className="bg-[#e87d35] px-5 py-3 text-[11px] font-bold tracking-[.13em] text-[#171a17] hover:bg-[#f1944e]">OPEN THE LEDGER <Arrow /></a><a href="#method" className="border hairline px-5 py-3 text-[11px] tracking-[.13em] text-[#c1c3b9] hover:border-[#e87d35] hover:text-[#e87d35]">SEE HOW IT WORKS</a></div>
          </div>
          <div className="reveal d2 border hairline surface p-5 lg:mb-2">
            <div className="flex items-center justify-between border-b hairline pb-4"><Mark>VAULT / ARC-7F2A</Mark><span className="flex items-center gap-2"><i className="live-dot h-1.5 w-1.5 bg-[#a4c49a]" /><Mark tone="green">MONITORING</Mark></span></div>
            <div className="py-6"><div className="font-[var(--arcanum-display)] text-6xl tracking-tight text-[#e9e8df]">$2.4M</div><Mark>GOVERNED THIS MONTH</Mark></div>
            <div className="grid grid-cols-2 gap-px bg-[#30342f]"><div className="bg-[#171a17] p-4"><div className="text-xl text-[#e4e4dc]">42<span className="text-xs text-[#7d817b]">ms</span></div><Mark>POLICY CHECK</Mark></div><div className="bg-[#171a17] p-4"><div className="text-xl text-[#e4e4dc]">0.00</div><Mark>UNACCOUNTED USDC</Mark></div></div>
            <div className="mt-5 flex items-center justify-between text-[10px] text-[#7d817b]"><span>LAST EVENT 00:00:04 AGO</span><span className="text-[#a4c49a]">● ALL SYSTEMS NOMINAL</span></div>
          </div>
        </div>
        <div className="absolute bottom-5 right-10 hidden text-[10px] tracking-[.18em] text-[#565b54] lg:block">SCROLL TO INSPECT ↓</div>
      </section>

      <section id="method" className="mx-auto max-w-[1320px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="mb-14 flex items-end justify-between border-b hairline pb-5"><div><Mark tone="orange">01 / THE CONTROL LOOP</Mark><h2 className="mt-4 font-[var(--arcanum-display)] text-5xl uppercase tracking-tight text-[#e9e8df]">A dollar gets<br />three decisions.</h2></div><Mark>NO BLIND SPOTS</Mark></div>
        <div className="grid gap-0 border hairline md:grid-cols-3">
          {[["01", "POLICY CHECK", "Agent signs intent. ARCANUM compares destination, amount, asset, and velocity against the wallet’s policy.", "42ms median"], ["02", "ALLOW / BLOCK", "A match releases USDC. A violation stops at the edge — before the transaction reaches Arc.", "0 dollars moved"], ["03", "ESCALATE TO HUMAN", "Unfamiliar vendors and high-value actions become a clear approval request. A person owns the exception.", "human in the loop"]].map(([num, title, body, foot], i) => <div key={num} className={`surface p-7 ${i < 2 ? "border-b hairline md:border-b-0 md:border-r" : ""}`}><Mark tone={i === 2 ? "orange" : "muted"}>{num} / {title}</Mark><p className="mt-16 text-[15px] leading-7 text-[#c2c4bb]">{body}</p><div className="mt-12 border-t hairline pt-4 text-[10px] tracking-[.12em] text-[#7d817b]">{foot}</div></div>)}
        </div>
      </section>

      <section id="ledger" className="border-y hairline bg-[#0d0f0d]">
        <div className="mx-auto max-w-[1320px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><Mark tone="orange">02 / SIGNATURE LEDGER</Mark><h2 className="mt-4 font-[var(--arcanum-display)] text-5xl uppercase tracking-tight">Watch the rule<br />do its job.</h2></div><button onClick={() => setLive((n) => (n + 1) % ledgerSeed.length)} className="border hairline px-4 py-2 text-[10px] tracking-[.14em] text-[#9a9d95] hover:border-[#e87d35] hover:text-[#e87d35]">SIMULATE NEXT EVENT ↻</button></div>
          <div className="border hairline">
            <div className="hidden grid-cols-[1.1fr_1fr_.7fr_.7fr_.8fr] gap-4 border-b hairline px-5 py-3 text-[10px] tracking-[.12em] text-[#666b63] md:grid"><span>AGENT / DESTINATION</span><span>WALLET</span><span>AMOUNT</span><span>VERDICT</span><span>RULE TRACE</span></div>
            {ledgerSeed.map((row, i) => <div key={row.agent + row.amount} className={`grid gap-3 border-b hairline px-5 py-5 transition-colors duration-500 last:border-0 md:grid-cols-[1.1fr_1fr_.7fr_.7fr_.8fr] md:items-center ${i === live ? "bg-[#1c211c]" : "surface"}`}><div><div className="text-xs text-[#e4e4dc]">{row.agent} <span className="text-[#666b63]">→ {row.vendor}</span></div><div className="mt-1 text-[10px] text-[#666b63]">{row.address}</div></div><div className="text-[10px] text-[#8e938a]">USDC / ARC</div><div className="font-mono text-sm tabular-nums">{row.amount}</div><div><span className={`inline-block border px-2 py-1 text-[9px] tracking-[.12em] ${row.verdict === "BLOCKED" ? "border-[#bc5f30] text-[#e87d35]" : row.verdict === "ESCALATE" ? "border-[#e87d35] text-[#e87d35]" : "border-[#61765b] text-[#a4c49a]"}`}>{row.verdict}</span></div><div className="text-[10px] leading-5 text-[#7d817b]">{row.rule}</div></div>)}
          </div>
          <div className="mt-4 flex items-center gap-3 text-[10px] tracking-[.1em] text-[#686d65]"><span className="live-dot h-1.5 w-1.5 bg-[#e87d35]" /> STREAMING FROM ARC MAINNET · EVENT {String(live + 1842).padStart(4, "0")}</div>
        </div>
      </section>

      <section id="policies" className="mx-auto max-w-[1320px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[.7fr_1.3fr]"><div><Mark tone="orange">03 / POLICY ENGINE</Mark><h2 className="mt-5 font-[var(--arcanum-display)] text-6xl uppercase leading-[.9]">Write the<br />guardrails.</h2><p className="mt-7 max-w-sm text-sm leading-7 text-[#92968d]">Express finance policy once. ARCANUM enforces it at signing speed, then leaves an immutable trail for the close.</p></div><div className="space-y-2"><div className="surface border hairline p-6"><div className="flex justify-between"><Mark>PROCUREMENT-BOT / ACTIVE</Mark><Mark tone="green">ENFORCING</Mark></div><div className="mt-7 grid gap-6 text-sm md:grid-cols-3"><div><Mark>PER TX CAP</Mark><div className="mt-2 text-xl tabular-nums">$500</div></div><div><Mark>DAILY CAP</Mark><div className="mt-2 text-xl tabular-nums">$5,000</div></div><div><Mark>VENDORS</Mark><div className="mt-2 text-xl">12 allowed</div></div></div></div>{["Vendor allowlists / 12 destinations approved", "Velocity limits / reset at 00:00 UTC", "Human approvals / $500+ or novel vendor"].map((t, i) => <button key={t} onClick={() => setExpanded(expanded === i)} className="flex w-full items-center justify-between border-b hairline py-5 text-left text-xs text-[#b9bcb2] hover:text-[#e87d35]"><span>{t}</span><span className="font-mono text-[#e87d35]">{expanded === i ? "−" : "+"}</span></button>)}</div></div>
      </section>

      <section id="proof" className="border-y hairline bg-[#171a17]"><div className="mx-auto grid max-w-[1320px] gap-14 px-6 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-24"><div><Mark tone="orange">04 / OPERATIONS LOG</Mark><h2 className="mt-5 font-[var(--arcanum-display)] text-5xl uppercase">Control you<br />can reconcile.</h2></div><div><blockquote className="max-w-2xl text-2xl leading-snug text-[#d9d9d0]">“We stopped asking what the agent spent. The ledger shows us what it was allowed to spend — and why.”</blockquote><div className="mt-8 flex gap-8 border-t hairline pt-5"><div><Mark>MARIA S.</Mark><div className="mt-1 text-xs text-[#8e938a]">VP Finance, Latticeworks</div></div><div><Mark>Q2 CLOSE</Mark><div className="mt-1 text-xs text-[#8e938a]">47,218 events reconciled</div></div></div></div></div></section>

      <section id="contact" className="dot-grid"><div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-10 px-6 py-24 lg:flex-row lg:items-end lg:px-10 lg:py-32"><div><Mark tone="orange">05 / TAKE THE WHEEL</Mark><h2 className="mt-5 max-w-3xl font-[var(--arcanum-display)] text-[clamp(4rem,8vw,7.5rem)] uppercase leading-[.82] tracking-tight">Move fast.<br /><span className="text-[#8d9188]">Stay governed.</span></h2></div><div className="max-w-xs"><p className="text-sm leading-7 text-[#999d94]">Bring your agents. Bring your policy. We’ll show you the ledger before you move a dollar.</p><a href="mailto:operators@thearcanum.in" className="mt-7 inline-block bg-[#e87d35] px-6 py-4 text-[11px] font-bold tracking-[.13em] text-[#171a17] hover:bg-[#f1944e]">TALK TO AN OPERATOR <Arrow /></a></div></div></section>

      <footer className="border-t hairline px-6 py-8 lg:px-10"><div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-5 text-[10px] tracking-[.12em] text-[#686d65] md:flex-row"><span className="font-bold tracking-[.22em] text-[#c3c5bb]">ARCANUM / ARC GOVERNANCE</span><span>NON-CUSTODIAL · USDC · ARC BLOCKCHAIN</span><span>© 2025 ARCANUM SYSTEMS</span></div></footer>
    </main>
  );
}