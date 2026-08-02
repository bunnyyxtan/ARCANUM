import React, { useEffect, useMemo, useState } from "react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATED";

type Entry = {
  time: string;
  agent: string;
  vendor: string;
  amount: string;
  address: string;
  verdict: Verdict;
  detail: string;
};

const ledgerSeed: Entry[] = [
  { time: "14:32:08", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", address: "0x3f…9a2c", verdict: "ALLOWED", detail: "within vendor + daily cap" },
  { time: "14:32:04", agent: "research-agent", vendor: "OpenAI", amount: "$42.00", address: "0x91…c044", verdict: "ALLOWED", detail: "within vendor allowlist" },
  { time: "14:31:57", agent: "procurement-bot", vendor: "Unknown", amount: "$1,240.00", address: "0x3f…9a2c", verdict: "BLOCKED", detail: "vendor not on allowlist" },
  { time: "14:31:49", agent: "treasury-agent", vendor: "Anthropic", amount: "$860.00", address: "0x72…d1e8", verdict: "ESCALATED", detail: "over $500 transaction cap" },
  { time: "14:31:41", agent: "research-agent", vendor: "OpenAI", amount: "$18.50", address: "0x91…c044", verdict: "ALLOWED", detail: "within vendor + daily cap" },
];

function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="ab-section-label">
      <span>{number}</span>
      <span>{children}</span>
    </div>
  );
}

function Rule({ className = "" }: { className?: string }) {
  return <div className={`ab-rule ${className}`} aria-hidden="true" />;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`ab-verdict ab-${verdict.toLowerCase()}`}>{verdict}</span>;
}

function SwissStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .ab-page{--paper:#f6f5f1;--ink:#101112;--muted:#686963;--line:#c8c8c1;--red:#e92c20;--wash:#e9e8e2;background:var(--paper);color:var(--ink);font-family:Archivo,Arial,sans-serif;min-height:100dvh;overflow:hidden}
      .ab-page *{box-sizing:border-box}.ab-mono{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
      .ab-container{width:min(1180px,calc(100% - 56px));margin:0 auto}.ab-rule{height:1px;background:var(--ink);width:100%}.ab-rule-soft{background:var(--line)}
      .ab-nav{height:78px;border-bottom:1px solid var(--ink);display:flex;align-items:center;justify-content:space-between;gap:24px}
      .ab-logo{font-weight:900;letter-spacing:-.075em;font-size:26px;line-height:1}.ab-logo span{color:var(--red)}
      .ab-navlinks{display:flex;align-items:center;gap:30px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.ab-navlinks a{color:inherit;text-decoration:none;transition:color .2s ease}.ab-navlinks a:hover{color:var(--red)}
      .ab-cta{background:var(--red);color:white;padding:13px 18px;border:1px solid var(--red);font:700 11px Archivo;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;transition:transform .2s ease,background .2s ease}.ab-cta:hover{background:#b92018;transform:translateY(-2px)}.ab-cta:active{transform:translateY(0)}
      .ab-kicker{display:flex;gap:10px;align-items:center;font-size:11px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.ab-kicker i{display:block;width:7px;height:7px;background:var(--red)}
      .ab-hero{padding:84px 0 72px;display:grid;grid-template-columns:58px 1fr 260px;gap:26px;border-bottom:1px solid var(--ink)}.ab-hero-index{font:500 13px "IBM Plex Mono";padding-top:7px;color:var(--red)}
      .ab-hero h1{font-size:clamp(58px,8.1vw,119px);letter-spacing:-.095em;line-height:.87;margin:22px 0 30px;max-width:790px;font-weight:800}.ab-hero h1 em{font-style:normal;color:var(--red)}.ab-hero-copy{font-size:18px;line-height:1.35;max-width:540px;letter-spacing:-.025em}
      .ab-hero-aside{border-left:1px solid var(--ink);padding-left:20px;align-self:end;font-size:12px;line-height:1.5}.ab-hero-aside strong{display:block;font-size:41px;letter-spacing:-.08em;line-height:1;margin:9px 0 4px}
      .ab-section{padding:72px 0}.ab-section-head{display:grid;grid-template-columns:180px 1fr;gap:28px}.ab-section-label{font:600 11px "IBM Plex Mono";display:flex;gap:16px;text-transform:uppercase;letter-spacing:.06em}.ab-section-label span:first-child{color:var(--red)}.ab-section-title{font-size:clamp(38px,5.2vw,76px);letter-spacing:-.085em;line-height:.9;margin:0;max-width:690px}.ab-section-intro{font-size:16px;line-height:1.45;max-width:450px;margin:24px 0 0 208px;color:#44453f}
      .ab-flow{margin:62px 0 0 208px;display:grid;grid-template-columns:1fr 28px 1fr 28px 1fr;align-items:stretch}.ab-flow-step{border-top:3px solid var(--ink);padding:18px 12px 18px 0;min-height:146px}.ab-flow-step:nth-child(1){border-top-color:var(--red)}.ab-flow-step h3{font-size:20px;letter-spacing:-.04em;margin:0 0 9px}.ab-flow-step p{font-size:12px;line-height:1.4;color:var(--muted);max-width:175px;margin:0}.ab-flow-num{font:500 11px "IBM Plex Mono";color:var(--red);margin-bottom:30px}.ab-flow-arrow{font:22px "IBM Plex Mono";align-self:start;padding-top:21px;text-align:center}
      .ab-ledger-wrap{background:var(--wash);border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}.ab-ledger-top{display:flex;justify-content:space-between;align-items:center;padding:17px 0}.ab-ledger-top h3{margin:0;font-size:14px;letter-spacing:-.02em}.ab-live{font:600 10px "IBM Plex Mono";letter-spacing:.07em;display:flex;align-items:center;gap:8px}.ab-live i{width:7px;height:7px;border-radius:50%;background:var(--red);animation:ab-pulse 1.5s ease-out infinite}.ab-ledger-head,.ab-ledger-row{display:grid;grid-template-columns:100px 1.25fr 1fr 110px 125px 150px;align-items:center;gap:14px}.ab-ledger-head{font:500 10px "IBM Plex Mono";color:var(--muted);padding:11px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-transform:uppercase}.ab-ledger-row{padding:17px 0;border-bottom:1px solid var(--line);font-size:12px;animation:ab-in .45s ease-out both}.ab-ledger-row:last-child{border-bottom:0}.ab-ledger-row:hover{background:rgba(255,255,255,.55)}.ab-agent{font-weight:700}.ab-vendor{font-weight:600}.ab-amount{text-align:right;font:500 13px "IBM Plex Mono"}.ab-address{font:400 11px "IBM Plex Mono";color:var(--muted)}.ab-verdict{font:600 10px "IBM Plex Mono";letter-spacing:.05em;padding:5px 7px;justify-self:start}.ab-allowed{background:#d7e3d2;color:#273b25}.ab-blocked{background:var(--red);color:white}.ab-escalated{background:#e5d5b9;color:#5d431e}.ab-detail{color:var(--muted);font-size:11px}
      .ab-ledger-foot{display:flex;justify-content:space-between;border-top:1px solid var(--ink);padding-top:15px;margin-top:20px;font-size:11px;color:var(--muted)}.ab-ledger-foot strong{color:var(--ink)}
      .ab-policy{display:grid;grid-template-columns:180px 1fr 1fr;gap:28px}.ab-policy-main{grid-column:2/-1}.ab-policy-line{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--ink);padding:28px 0 30px;gap:28px}.ab-policy-line:last-child{border-bottom:1px solid var(--ink)}.ab-policy-big{font-size:45px;letter-spacing:-.08em;line-height:.9}.ab-policy-big small{font-size:12px;letter-spacing:0;display:block;margin-top:7px;color:var(--muted)}.ab-policy-text{font-size:13px;line-height:1.45}.ab-policy-text strong{display:block;font-size:17px;letter-spacing:-.04em;margin-bottom:8px}.ab-policy-code{font:11px/1.6 "IBM Plex Mono";color:var(--muted);border-left:1px solid var(--line);padding-left:18px}
      .ab-proof{display:grid;grid-template-columns:180px 1.4fr 1fr;gap:28px;align-items:start;background:var(--ink);color:var(--paper);padding-top:72px;padding-bottom:72px}.ab-proof .ab-section-label{color:var(--paper)}.ab-proof .ab-section-label span:first-child{color:var(--red)}.ab-proof-quote{font-size:clamp(28px,3.8vw,54px);letter-spacing:-.075em;line-height:.95;margin:0}.ab-proof-stat{border-left:1px solid #555;padding-left:24px}.ab-proof-stat strong{font-size:68px;letter-spacing:-.1em;line-height:.9;display:block}.ab-proof-stat p{font-size:12px;line-height:1.4;color:#aaa;margin-top:13px}.ab-proof-source{font:10px "IBM Plex Mono";color:#888;margin-top:34px}
      .ab-final{padding:105px 0 115px;display:grid;grid-template-columns:180px 1fr;gap:28px}.ab-final h2{font-size:clamp(52px,7vw,104px);line-height:.84;letter-spacing:-.1em;max-width:760px;margin:0}.ab-final h2 em{font-style:normal;color:var(--red)}.ab-final-actions{display:flex;gap:14px;align-items:center;margin-top:32px}.ab-text-link{font:700 11px Archivo;text-transform:uppercase;letter-spacing:.08em;text-decoration:none;color:var(--ink);border-bottom:1px solid var(--ink);padding-bottom:4px;transition:color .2s ease}.ab-text-link:hover{color:var(--red);border-color:var(--red)}
      .ab-footer{border-top:1px solid var(--ink);padding:21px 0 28px;display:flex;justify-content:space-between;align-items:start;font-size:11px}.ab-footer p{margin:0;color:var(--muted)}.ab-footer-links{display:flex;gap:22px}.ab-footer a{color:inherit;text-decoration:none}.ab-footer a:hover{color:var(--red)}
      .ab-reveal{animation:ab-in .65s ease-out both}.ab-delay-1{animation-delay:.08s}.ab-delay-2{animation-delay:.16s}
      @keyframes ab-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes ab-pulse{0%{box-shadow:0 0 0 0 rgba(233,44,32,.45)}70%{box-shadow:0 0 0 6px rgba(233,44,32,0)}100%{box-shadow:0 0 0 0 rgba(233,44,32,0)}}
      @media(max-width:800px){.ab-container{width:min(100% - 32px,620px)}.ab-navlinks{display:none}.ab-nav{height:65px}.ab-hero{padding:55px 0;grid-template-columns:32px 1fr;gap:10px}.ab-hero-aside{grid-column:2;border-left:0;border-top:1px solid var(--ink);padding:18px 0 0;margin-top:10px}.ab-hero h1{font-size:clamp(54px,15vw,100px)}.ab-section{padding:55px 0}.ab-section-head,.ab-policy,.ab-proof,.ab-final{display:block}.ab-section-label{margin-bottom:24px}.ab-section-intro,.ab-flow{margin-left:0}.ab-flow{grid-template-columns:1fr;gap:0}.ab-flow-arrow{display:none}.ab-flow-step{min-height:auto;padding:18px 0}.ab-ledger-wrap{overflow-x:auto}.ab-ledger-head,.ab-ledger-row{min-width:780px}.ab-ledger-top{min-width:780px}.ab-policy-main{margin-top:40px}.ab-policy-line{grid-template-columns:1fr 1fr}.ab-policy-code{grid-column:1/-1}.ab-proof-stat{border-left:0;border-top:1px solid #555;margin-top:36px;padding:22px 0 0}.ab-final-actions{flex-wrap:wrap}.ab-footer{display:block}.ab-footer-links{margin-top:18px}}
    `}</style>
  );
}

export function SwissBroadsheet() {
  const [entries, setEntries] = useState<Entry[]>(ledgerSeed);
  const [isLive, setIsLive] = useState(true);
  const newest = useMemo(() => entries[0], [entries]);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      setEntries((current) => {
        const next: Entry = { ...current[0], time: new Date().toLocaleTimeString("en-GB", { hour12: false }) };
        return [next, ...current.slice(0, 4)];
      });
    }, 5200);
    return () => window.clearInterval(timer);
  }, [isLive]);

  const scrollToLedger = () => document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="ab-page">
      <SwissStyles />
      <header className="ab-container ab-nav">
        <a className="ab-logo" href="#top">ARCANUM<span>.</span></a>
        <nav className="ab-navlinks" aria-label="Primary navigation">
          <a href="#method">Method</a><a href="#ledger">Ledger</a><a href="#policies">Policies</a><a href="#proof">Proof</a>
        </nav>
        <a className="ab-cta" href="#start">Request access <span aria-hidden="true">↗</span></a>
      </header>

      <main id="top">
        <section className="ab-container ab-hero">
          <div className="ab-hero-index">01 / 05</div>
          <div className="ab-reveal">
            <div className="ab-kicker"><i /> Governance layer for Arc wallets</div>
            <h1>Every dollar<br />has a <em>verdict.</em></h1>
            <p className="ab-hero-copy">ARCANUM gives autonomous agents a wallet — and gives operators the final word. Every USDC movement meets policy before it moves.</p>
            <div className="ab-final-actions"><a className="ab-cta" href="#start">See the control layer <span>↗</span></a><a className="ab-text-link" href="#ledger">Watch the ledger ↓</a></div>
          </div>
          <aside className="ab-hero-aside ab-reveal ab-delay-2">
            <span className="ab-mono">NETWORK / ARC</span>
            <strong>42ms</strong>
            median policy check
            <Rule className="ab-rule-soft" />
            <strong>$2.4M</strong>
            governed this month
          </aside>
        </section>

        <section id="method" className="ab-container ab-section">
          <div className="ab-section-head"><SectionLabel number="02">The control loop</SectionLabel><h2 className="ab-section-title">A dollar does not<br />move on trust alone.</h2></div>
          <p className="ab-section-intro">Your agent makes the request. ARCANUM runs the checks. A human only enters the loop when the policy says they should.</p>
          <div className="ab-flow">
            <div className="ab-flow-step"><div className="ab-flow-num">01 / CHECK</div><h3>Read the policy</h3><p>Transaction, vendor, agent, and velocity are evaluated against the rules you set.</p></div><div className="ab-flow-arrow">→</div>
            <div className="ab-flow-step"><div className="ab-flow-num">02 / DECIDE</div><h3>Allow or block</h3><p>Inside the boundary, USDC moves. Outside it, the transaction stops before settlement.</p></div><div className="ab-flow-arrow">→</div>
            <div className="ab-flow-step"><div className="ab-flow-num">03 / ESCALATE</div><h3>Ask a human</h3><p>Exceptions route to the right operator with context, not a blank approval prompt.</p></div>
          </div>
        </section>

        <section id="ledger" className="ab-container ab-section" style={{ paddingTop: 30 }}>
          <div className="ab-section-head"><SectionLabel number="03">Signature / Live ledger</SectionLabel><h2 className="ab-section-title">The receipt is<br />always visible.</h2></div>
          <p className="ab-section-intro">A quiet, append-only record of every request. Watch the policy do its job in real time.</p>
          <div className="ab-ledger-wrap" style={{ marginTop: 52 }}>
            <div className="ab-ledger-top"><h3>ARCANUM / GOVERNED TRANSACTIONS</h3><button onClick={() => setIsLive((v) => !v)} className="ab-live" style={{ border: 0, background: "none", cursor: "pointer", color: "inherit" }}><i /> {isLive ? "LIVE STREAM" : "STREAM PAUSED"} ↗</button></div>
            <div className="ab-ledger-head"><span>Timestamp</span><span>Agent</span><span>Vendor</span><span style={{ textAlign: "right" }}>Amount</span><span>Wallet</span><span>Policy verdict</span></div>
            {entries.map((entry, index) => <div className="ab-ledger-row" key={`${entry.time}-${index}`}><span className="ab-mono">{entry.time}</span><span className="ab-agent">{entry.agent}</span><span className="ab-vendor">{entry.vendor}</span><span className="ab-amount">{entry.amount}</span><span className="ab-address">{entry.address}</span><span style={{ display: "flex", alignItems: "center", gap: 9 }}><VerdictBadge verdict={entry.verdict} /><span className="ab-detail">{entry.detail}</span></span></div>)}
          </div>
          <div className="ab-ledger-foot"><span><strong>↓</strong> newest event / {newest?.time} UTC</span><span className="ab-mono">ALL RECORDS · IMMUTABLE</span></div>
        </section>

        <section id="policies" className="ab-container ab-section">
          <div className="ab-policy"><SectionLabel number="04">Policy, not promises</SectionLabel><div className="ab-policy-main">
            <div className="ab-policy-line"><div className="ab-policy-big">$500<small>per transaction</small></div><div className="ab-policy-text"><strong>Spend boundaries</strong>Set caps per transaction and per day. The agent cannot negotiate its own limits.</div><div className="ab-policy-code">limit.tx = 500.00<br />limit.day = 5,000.00<br />currency = USDC</div></div>
            <div className="ab-policy-line"><div className="ab-policy-big">03<small>approved vendors</small></div><div className="ab-policy-text"><strong>Vendor allowlists</strong>Approve AWS, OpenAI, and Anthropic. Unknown counterparties stop at the door.</div><div className="ab-policy-code">vendors = [<br />&nbsp;&nbsp;aws.com,<br />&nbsp;&nbsp;openai.com,<br />&nbsp;&nbsp;anthropic.com<br />]</div></div>
            <div className="ab-policy-line"><div className="ab-policy-big">1:1<small>operator context</small></div><div className="ab-policy-text"><strong>Human escalation</strong>Route exceptions with the agent’s reason, history, and policy delta attached.</div><div className="ab-policy-code">on exception →<br />notify = finance@co<br />expires = 15 min</div></div>
          </div></div>
        </section>

        <section id="proof" className="ab-proof">
          <div className="ab-container ab-proof" style={{ paddingTop: 0, paddingBottom: 0 }}><SectionLabel number="05">Operator proof</SectionLabel><div><p className="ab-proof-quote">“We gave our agents room to work without giving them room to improvise.”</p><div className="ab-proof-source">— MIRA CHEN / VP FINANCE, NORTHSTAR SYSTEMS</div></div><div className="ab-proof-stat"><strong>0</strong><p>unreviewed out-of-policy transactions<br />since deploying ARCANUM</p><span className="ab-mono" style={{ fontSize: 10, color: "#888" }}>VERIFIED LEDGER / 184 DAYS</span></div></div>
        </section>

        <section id="start" className="ab-container ab-final"><SectionLabel number="06">Next action</SectionLabel><div><h2>Put a boundary<br />around <em>autonomy.</em></h2><div className="ab-final-actions"><a className="ab-cta" href="mailto:hello@thearcanum.in">Request operator access ↗</a><a className="ab-text-link" href="#method">Read the method</a></div></div></section>
      </main>
      <footer className="ab-container ab-footer"><div><div className="ab-logo">ARCANUM<span>.</span></div><p style={{ marginTop: 9 }}>Governed wallets for autonomous work.</p></div><div className="ab-footer-links"><a href="mailto:hello@thearcanum.in">Contact</a><a href="#top">Back to top ↑</a><span className="ab-mono">ARC / USDC / 2025</span></div></footer>
    </div>
  );
}