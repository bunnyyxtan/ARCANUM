import React, { useEffect, useState } from "react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATED";

const transactions: { time: string; agent: string; vendor: string; amount: string; address: string; verdict: Verdict; reason: string }[] = [
  { time: "14:32:09", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", address: "0x3f…9a2c", verdict: "ALLOWED", reason: "under daily cap" },
  { time: "14:32:11", agent: "research-agent", vendor: "OpenAI", amount: "$612.00", address: "0xa8…41d0", verdict: "BLOCKED", reason: "vendor not allowlisted" },
  { time: "14:32:14", agent: "procurement-bot", vendor: "Anthropic", amount: "$420.00", address: "0x3f…9a2c", verdict: "ESCALATED", reason: "human approval required" },
  { time: "14:32:18", agent: "ops-runner", vendor: "AWS", amount: "$76.40", address: "0x71…08be", verdict: "ALLOWED", reason: "policy matched" },
  { time: "14:32:22", agent: "research-agent", vendor: "AWS", amount: "$38.90", address: "0xa8…41d0", verdict: "ALLOWED", reason: "under per-tx cap" },
];

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`pc-reveal ${className}`}>{children}</div>;
}

function Arrow() { return <span aria-hidden="true" className="pc-arrow">↗</span>; }

function Verdict({ verdict }: { verdict: Verdict }) {
  return <span className={`pc-verdict ${verdict.toLowerCase()}`}><i />{verdict}</span>;
}

function PolicyWindow() {
  return (
    <div className="pc-window">
      <div className="pc-windowbar"><span className="pc-dots">● ● ●</span><span>policy / procurement-bot</span><span>published</span></div>
      <div className="pc-policy-head"><div><div className="pc-eyebrow">SPENDING POLICY</div><h3>Procurement baseline</h3></div><span className="pc-status">ACTIVE</span></div>
      <div className="pc-policy-row"><span>Per transaction</span><strong>$500.00 <small>USDC</small></strong><b>✓</b></div>
      <div className="pc-policy-row"><span>Daily aggregate</span><strong>$5,000.00 <small>USDC</small></strong><b>✓</b></div>
      <div className="pc-policy-row"><span>Allowlisted vendors</span><strong>AWS&nbsp; · &nbsp;Anthropic</strong><b>✓</b></div>
      <div className="pc-policy-foot"><span>Last changed by</span><span className="pc-mono">finance@arcanum.in&nbsp; · &nbsp;2m ago</span></div>
    </div>
  );
}

export function ProductCinema() {
  const [active, setActive] = useState(1);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % transactions.length), 3400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="pc-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f3e7d5;color:#35231b}
        .pc-page{font-family:Manrope, sans-serif;min-height:100dvh;background:#f3e7d5;overflow:hidden;color:#35231b}
        .pc-page a{color:inherit;text-decoration:none}.pc-wrap{width:min(1160px,calc(100% - 64px));margin:0 auto}.pc-mono{font-family:"DM Mono",monospace;font-variant-numeric:tabular-nums}
        .pc-nav{height:76px;border-bottom:1px solid #d8c3ae;display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:.01em}
        .pc-wordmark{font-size:14px;font-weight:800;letter-spacing:.19em}.pc-navlinks{display:flex;align-items:center;gap:30px;color:#765d50}.pc-navlinks a{transition:color .2s}.pc-navlinks a:hover{color:#35231b}.pc-navcta{border:1px solid #35231b;padding:10px 15px;transition:background .2s,color .2s,transform .2s}.pc-navcta:hover{background:#35231b;color:#f3e7d5;transform:translateY(-1px)}
        .pc-hero{min-height:720px;display:flex;align-items:center;justify-content:center;text-align:center;border-bottom:1px solid #d8c3ae;padding:92px 0 100px}.pc-kicker{font:500 11px "DM Mono",monospace;letter-spacing:.13em;color:#8d6756;text-transform:uppercase;margin-bottom:27px}.pc-hero h1{font-size:clamp(52px,8.5vw,116px);line-height:.93;letter-spacing:-.075em;font-weight:600;margin:0 auto 29px;max-width:1000px}.pc-hero p{color:#634b3e;font-size:17px;line-height:1.65;max-width:510px;margin:0 auto 36px}.pc-primary{display:inline-flex;align-items:center;gap:28px;background:#56372a;color:#f8eee1;padding:14px 17px 14px 20px;font-size:12px;font-weight:700;transition:transform .2s,background .2s}.pc-primary:hover{background:#7e4938;transform:translateY(-2px)}.pc-primary .pc-arrow{font-size:17px}.pc-note{margin-top:19px;color:#896c5c;font:11px "DM Mono",monospace}
        .pc-section{padding:150px 0}.pc-section.border{border-bottom:1px solid #d8c3ae}.pc-section-header{display:grid;grid-template-columns:1fr 1.2fr;gap:60px;margin-bottom:70px}.pc-eyebrow{font:500 10px "DM Mono",monospace;letter-spacing:.16em;color:#8d6756}.pc-section h2{font-size:clamp(36px,5vw,68px);line-height:.98;letter-spacing:-.065em;font-weight:600;margin:10px 0 0;max-width:590px}.pc-section-intro{font-size:17px;line-height:1.65;color:#634b3e;max-width:400px;align-self:end;margin:0 0 4px}
        .pc-stage{border:1px solid #c98d72;background:#d4a088;padding:20px;box-shadow:0 18px 60px rgba(86,55,42,.12)}.pc-window{background:#f8efe2;border:1px solid #b98269;max-width:920px;margin:0 auto;box-shadow:0 12px 30px rgba(86,55,42,.1)}.pc-windowbar{height:43px;border-bottom:1px solid #d6b9a3;display:flex;align-items:center;justify-content:space-between;padding:0 18px;color:#826252;font:10px "DM Mono",monospace}.pc-dots{font-size:8px;letter-spacing:2px;color:#a86e58}.pc-policy-head{padding:30px 36px 22px;display:flex;justify-content:space-between;align-items:start}.pc-policy-head h3{font-size:25px;letter-spacing:-.045em;margin:7px 0 0;font-weight:600}.pc-status{font:10px "DM Mono";color:#694c3d;border:1px solid #bd8b73;padding:6px 8px}.pc-policy-row{display:flex;justify-content:space-between;align-items:center;padding:21px 36px;border-top:1px solid #dfc7b4;font-size:13px;color:#765747}.pc-policy-row strong{color:#35231b;font-weight:500;min-width:260px}.pc-policy-row small{font:10px "DM Mono";color:#906e5d}.pc-policy-row b{font-size:14px;font-weight:400;color:#765747}.pc-policy-foot{border-top:1px solid #dfc7b4;margin-top:10px;padding:20px 36px;display:flex;justify-content:space-between;color:#896c5c;font-size:11px}.pc-policy-foot .pc-mono{color:#634b3e}
        .pc-flow{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:0;align-items:stretch}.pc-flow-step{padding:0 34px 0 0;min-height:172px;border-right:1px solid #d8c3ae}.pc-flow-step:nth-child(2){padding-left:34px}.pc-flow-step:nth-child(3){padding-left:34px;border:0}.pc-flow-num{font:11px "DM Mono";color:#8d6756}.pc-flow h3{font-size:21px;letter-spacing:-.04em;font-weight:600;margin:20px 0 10px}.pc-flow p{color:#634b3e;line-height:1.6;font-size:13px;margin:0;max-width:230px}.pc-flow-line{height:1px;background:#56372a;position:relative;margin:37px 0 20px}.pc-flow-line:after{content:"›";position:absolute;right:-4px;top:-12px;background:#f3e7d5;padding-left:6px;font-size:19px}.pc-flow-step:nth-child(2) .pc-flow-line{background:#a54e3f}.pc-flow-step:nth-child(2) .pc-flow-line:after{color:#a54e3f}.pc-flow-step:nth-child(3) .pc-flow-line{background:#896c5c}
        .pc-ledger-wrap{background:#e4c0aa;padding:34px 40px 40px;border:1px solid #c98d72}.pc-ledger-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:25px}.pc-ledger-top h3{font-size:20px;letter-spacing:-.04em;font-weight:600;margin:0}.pc-live{font:10px "DM Mono";color:#694c3d}.pc-live i{width:6px;height:6px;background:#765044;display:inline-block;border-radius:50%;margin-right:7px}.pc-tx{display:grid;grid-template-columns:88px 1.3fr 1fr 100px 115px 145px;align-items:center;gap:16px;background:#f8efe2;border:1px solid #cfaa93;padding:17px 18px;margin-top:7px;font-size:11px;transition:transform .3s,opacity .3s}.pc-tx.active{transform:translateX(6px);border-color:#a86e58}.pc-tx .time,.pc-tx .address{font:10px "DM Mono";color:#896c5c}.pc-tx .agent{font-weight:600}.pc-tx .vendor{color:#765747}.pc-tx .amount{text-align:right;font:11px "DM Mono";color:#35231b}.pc-verdict{justify-self:end;font:10px "DM Mono";letter-spacing:.04em;display:flex;gap:7px;align-items:center}.pc-verdict i{height:6px;width:6px;border-radius:50%;background:#765747}.pc-verdict.blocked{color:#8f3f35}.pc-verdict.blocked i{background:#8f3f35}.pc-verdict.escalated{color:#765747}.pc-verdict.escalated i{background:#765747}.pc-tx-note{font:10px "DM Mono";color:#896c5c;text-align:right}
        .pc-proof{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:0;border-top:1px solid #c98d72;border-bottom:1px solid #c98d72}.pc-proof-item{padding:38px 35px;border-right:1px solid #c98d72}.pc-proof-item:first-child{padding-left:0}.pc-proof-item:last-child{border:0}.pc-proof-value{font:500 34px "DM Mono";letter-spacing:-.08em;margin-bottom:10px}.pc-proof-label{font-size:12px;color:#765747;line-height:1.5}
        .pc-final{text-align:center;padding:170px 0 150px}.pc-final h2{font-size:clamp(45px,7vw,92px);line-height:.95;letter-spacing:-.075em;font-weight:600;margin:15px auto 35px;max-width:780px}.pc-final p{color:#634b3e;margin:0 auto 31px}.pc-footer{border-top:1px solid #d8c3ae;padding:28px 0 35px;display:flex;justify-content:space-between;color:#765747;font-size:11px}.pc-footer .pc-wordmark{color:#35231b;font-size:12px}
        .pc-reveal{animation:pc-rise .8s ease-out both}.pc-reveal:nth-child(2){animation-delay:.09s}@keyframes pc-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:760px){.pc-wrap{width:min(100% - 36px,1160px)}.pc-navlinks{display:none}.pc-hero{min-height:620px;padding:70px 0}.pc-hero h1{font-size:58px}.pc-section{padding:92px 0}.pc-section-header{display:block;margin-bottom:45px}.pc-section-intro{margin-top:25px}.pc-flow{display:block}.pc-flow-step,.pc-flow-step:nth-child(2),.pc-flow-step:nth-child(3){border:0;border-bottom:1px solid #e5e5e2;padding:0 0 28px;margin-bottom:28px;min-height:0}.pc-flow-line{margin:20px 0}.pc-stage{padding:10px;overflow:auto}.pc-policy-head,.pc-policy-row,.pc-policy-foot{padding-left:18px;padding-right:18px}.pc-policy-row strong{min-width:150px}.pc-ledger-wrap{padding:22px 12px;overflow:auto}.pc-tx{min-width:700px}.pc-proof{display:block}.pc-proof-item,.pc-proof-item:first-child{border-right:0;border-bottom:1px solid #dededb;padding:28px 0}.pc-proof-item:last-child{border:0}.pc-final{padding:110px 0}.pc-footer{display:block}.pc-footer span{display:block;margin-top:13px}}
      `}</style>

      <nav className="pc-nav pc-wrap">
        <a href="#top" className="pc-wordmark">ARCANUM</a>
        <div className="pc-navlinks"><a href="#governed">How it works</a><a href="#policy">Policies</a><a href="#ledger">Ledger</a><a className="pc-navcta" href="#contact">Request access <Arrow /></a></div>
      </nav>

      <section id="top" className="pc-hero">
        <Reveal><div className="pc-kicker">Governance for autonomous money</div><h1>Let agents move money.<br />Keep control.</h1><p>ARCANUM is the non-custodial governance layer for AI-agent USDC wallets on Arc.</p><a className="pc-primary" href="#contact">Request access <Arrow /></a><div className="pc-note">Built for finance and technical operators.</div></Reveal>
      </section>

      <section id="governed" className="pc-section border pc-wrap">
        <div className="pc-section-header"><div><div className="pc-eyebrow">01 / THE CONTROL LOOP</div><h2>Every dollar has a decision.</h2></div><p className="pc-section-intro">A transaction is evaluated before it touches the chain. Rules are explicit. Exceptions have a human at the end of them.</p></div>
        <div className="pc-flow"><div className="pc-flow-step"><div className="pc-flow-num">01</div><div className="pc-flow-line" /><h3>Policy check</h3><p>Read the wallet’s limits, vendor list and current aggregate spend.</p></div><div className="pc-flow-step"><div className="pc-flow-num">02</div><div className="pc-flow-line" /><h3>Allow or block</h3><p>Every action gets a deterministic verdict in 42ms. Nothing slips through.</p></div><div className="pc-flow-step"><div className="pc-flow-num">03</div><div className="pc-flow-line" /><h3>Escalate</h3><p>When context matters, route the transaction to the right human.</p></div></div>
      </section>

      <section id="policy" className="pc-section border pc-wrap">
        <div className="pc-section-header"><div><div className="pc-eyebrow">02 / POLICY AS CODE</div><h2>Set the boundary once.</h2></div><p className="pc-section-intro">Finance writes the rule. Agents get the freedom to operate inside it. No custody. No shared keys.</p></div>
        <Reveal className="pc-stage"><PolicyWindow /></Reveal>
      </section>

      <section id="ledger" className="pc-section border pc-wrap">
        <div className="pc-section-header"><div><div className="pc-eyebrow">03 / THE GOVERNED LEDGER</div><h2>Nothing is invisible.</h2></div><p className="pc-section-intro">See the decision, the reason and the signer behind every USDC movement. In real time.</p></div>
        <div className="pc-ledger-wrap"><div className="pc-ledger-top"><h3>Live transaction stream</h3><span className="pc-live"><i />STREAMING · ARC MAINNET</span></div>{transactions.map((tx, index) => <div key={tx.time} className={`pc-tx ${index === active ? "active" : ""}`}><span className="time">{tx.time}</span><span className="agent">{tx.agent}</span><span className="vendor">{tx.vendor} <span className="address">{tx.address}</span></span><span className="amount">{tx.amount}</span><Verdict verdict={index === 1 ? "BLOCKED" : index === 2 && !approved ? "ESCALATED" : tx.verdict} /><span className="pc-tx-note">{index === 2 && approved ? "approved by finance" : tx.reason}</span></div>)}<div style={{ marginTop: 22, textAlign: "right" }}>{!approved && <button onClick={() => setApproved(true)} style={{ border: "0", borderBottom: "1px solid #aaa", background: "transparent", color: "#686863", font: '11px "DM Mono"', cursor: "pointer", padding: "0 0 5px" }}>approve pending transaction&nbsp; ↗</button>}</div></div>
      </section>

      <section className="pc-section border pc-wrap"><div className="pc-proof"><div className="pc-proof-item"><div className="pc-proof-value">$2.4M</div><div className="pc-proof-label">governed through Arcanum<br />since private beta</div></div><div className="pc-proof-item"><div className="pc-proof-value">42ms</div><div className="pc-proof-label">median policy check<br />before broadcast</div></div><div className="pc-proof-item"><div className="pc-proof-value">0</div><div className="pc-proof-label">unreviewed out-of-policy<br />transactions</div></div></div></section>

      <section id="contact" className="pc-final pc-wrap"><div className="pc-eyebrow">THE NEXT CONTROL PLANE</div><h2>Your agents can start spending.</h2><p>Give them a boundary worth trusting.</p><a className="pc-primary" href="mailto:access@thearcanum.in">Request access <Arrow /></a></section>
      <footer className="pc-footer pc-wrap"><span className="pc-wordmark">ARCANUM</span><span>Non-custodial governance for autonomous finance&nbsp; · &nbsp;thearcanum.in</span><span className="pc-mono">© 2025</span></footer>
    </main>
  );
}