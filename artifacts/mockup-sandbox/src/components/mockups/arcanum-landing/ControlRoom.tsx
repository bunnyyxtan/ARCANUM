import React, { useEffect, useState } from "react";

const txs = [
  { time: "14:32:09", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", addr: "0x3f…9a2c", verdict: "ALLOWED", tone: "allow", note: "under daily cap" },
  { time: "14:32:11", agent: "research-agent", vendor: "OpenAI", amount: "$612.00", addr: "0xa8…41d0", verdict: "BLOCKED", tone: "block", note: "vendor not allowlisted" },
  { time: "14:32:14", agent: "procurement-bot", vendor: "Anthropic", amount: "$420.00", addr: "0x3f…9a2c", verdict: "ESCALATED", tone: "escalate", note: "human approval required" },
  { time: "14:32:18", agent: "ops-runner", vendor: "AWS", amount: "$76.40", addr: "0x71…08be", verdict: "ALLOWED", tone: "allow", note: "policy matched" },
  { time: "14:32:22", agent: "research-agent", vendor: "AWS", amount: "$38.90", addr: "0xa8…41d0", verdict: "ALLOWED", tone: "allow", note: "under per-tx cap" },
];

function Arrow({ right = false }: { right?: boolean }) {
  return <span className="cr-arrow">{right ? "↗" : "→"}</span>;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`cr-reveal ${className}`}>{children}</div>;
}

export function ControlRoom() {
  const [live, setLive] = useState(0);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setLive((v) => (v + 1) % txs.length), 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="cr-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap');
        :root { --cr-bg:#0c0e10; --cr-surface:#111417; --cr-line:#24292e; --cr-muted:#7b848c; --cr-ink:#e7eaec; --cr-signal:#5ce0a1; }
        * { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; background:var(--cr-bg); }
        .cr-page { min-height:100dvh; background:var(--cr-bg); color:var(--cr-ink); font-family:Manrope, sans-serif; overflow:hidden; }
        .cr-page:before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.035; background-image:linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px); background-size:64px 64px; mask-image:linear-gradient(to bottom,black,transparent 70%); }
        .cr-wrap { max-width:1160px; margin:auto; padding:0 28px; } .cr-mono { font-family:"DM Mono",monospace; font-variant-numeric:tabular-nums; }
        .cr-nav { height:72px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--cr-line); position:relative; z-index:2; }
        .cr-logo { letter-spacing:.2em; font-size:14px; font-weight:800; color:#f4f6f7; display:flex; gap:10px; align-items:center; }
        .cr-logo i { display:block; width:8px; height:8px; background:var(--cr-signal); border-radius:50%; box-shadow:0 0 0 4px #5ce0a11c; }
        .cr-navlinks { display:flex; gap:30px; align-items:center; } .cr-navlinks a { color:#899198; text-decoration:none; font-size:12px; transition:color .2s; } .cr-navlinks a:hover { color:#e7eaec; }
        .cr-navcta,.cr-primary { border:1px solid #58626a; color:#eef1f2; background:#171b1f; padding:11px 16px; font:600 11px Manrope; letter-spacing:.03em; cursor:pointer; transition:transform .2s,border-color .2s,background .2s; } .cr-navcta:hover,.cr-primary:hover { border-color:var(--cr-signal); background:#19221f; transform:translateY(-2px); } .cr-navcta:active,.cr-primary:active { transform:translateY(0); }
        .cr-hero { min-height:650px; display:flex; align-items:center; position:relative; border-bottom:1px solid var(--cr-line); } .cr-hero:after { content:""; position:absolute; right:-200px; top:90px; width:520px; height:520px; border:1px solid #1a2722; border-radius:50%; opacity:.7; }
        .cr-kicker { color:var(--cr-signal); text-transform:uppercase; letter-spacing:.16em; font:500 10px "DM Mono"; margin-bottom:28px; } .cr-hero h1 { max-width:790px; margin:0; font-size:clamp(48px,7vw,88px); line-height:.98; letter-spacing:-.065em; font-weight:700; color:#f1f3f3; } .cr-hero h1 span { color:#747c82; }
        .cr-hero-copy { max-width:570px; margin:30px 0 35px; color:#90999f; font-size:15px; line-height:1.75; } .cr-hero-actions { display:flex; align-items:center; gap:22px; } .cr-text-link { color:#b5bdc1; font-size:12px; text-decoration:none; } .cr-text-link:hover { color:var(--cr-signal); }
        .cr-heartbeat { height:34px; border-bottom:1px solid var(--cr-line); display:flex; align-items:center; gap:12px; color:#7c878c; font:10px "DM Mono"; letter-spacing:.08em; text-transform:uppercase; } .cr-pulse { width:6px; height:6px; border-radius:50%; background:var(--cr-signal); animation:cr-pulse 1.8s ease-in-out infinite; } .cr-beats { flex:1; height:18px; opacity:.8; background:linear-gradient(90deg,transparent 0 4%,#294437 4% 4.3%,transparent 4.3% 8%,#5ce0a1 8% 8.15%,transparent 8.15% 14%,#294437 14% 14.3%,transparent 14.3% 23%,#294437 23% 23.2%,transparent 23.2% 32%,#5ce0a1 32% 32.1%,transparent 32.1% 100%); }
        .cr-section { padding:120px 0; border-bottom:1px solid var(--cr-line); } .cr-eyebrow { color:#747f86; font:10px "DM Mono"; text-transform:uppercase; letter-spacing:.14em; margin-bottom:18px; } .cr-section h2 { margin:0; font-size:42px; line-height:1.08; letter-spacing:-.05em; max-width:620px; } .cr-section-intro { color:#8c959b; max-width:430px; font-size:14px; line-height:1.7; margin-top:18px; }
        .cr-flow { display:grid; grid-template-columns:1.1fr 1fr 1fr; gap:0; margin-top:65px; border-top:1px solid var(--cr-line); } .cr-flow-item { min-height:205px; padding:25px 30px 25px 0; border-right:1px solid var(--cr-line); margin-right:30px; } .cr-flow-item:last-child { border:0; margin:0; } .cr-num { color:var(--cr-signal); font:11px "DM Mono"; } .cr-flow h3 { font-size:17px; margin:28px 0 12px; letter-spacing:-.02em; } .cr-flow p { color:#818b91; font-size:12px; line-height:1.7; margin:0; max-width:250px; }
        .cr-ledger { margin-top:55px; background:#101416; border:1px solid #2b3236; box-shadow:0 20px 60px #00000026; } .cr-ledger-head { display:flex; justify-content:space-between; align-items:center; padding:17px 20px; border-bottom:1px solid var(--cr-line); } .cr-ledger-title { font-size:12px; font-weight:700; } .cr-ledger-status { color:var(--cr-signal); font:10px "DM Mono"; } .cr-row { display:grid; grid-template-columns:90px 1.25fr 1fr 95px 105px 120px; align-items:center; gap:16px; padding:17px 20px; border-bottom:1px solid #1c2226; font-size:11px; transition:background .25s,transform .25s; } .cr-row:last-child { border:0; } .cr-row:hover { background:#151a1c; } .cr-row.active { animation:cr-slide .65s ease-out; } .cr-row span { color:#8b959b; } .cr-row .strong { color:#dce1e2; font-weight:600; } .cr-verdict { font:10px "DM Mono"; letter-spacing:.08em; text-align:right; } .allow { color:var(--cr-signal)!important; } .block { color:#f28b83!important; } .escalate { color:#e8bd72!important; } .cr-note { color:#626c72!important; font-size:10px; }
        .cr-proof { display:grid; grid-template-columns:1.35fr 1fr; gap:90px; align-items:end; } .cr-stats { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--cr-line); margin-top:45px; } .cr-stat { padding:22px 0; border-bottom:1px solid var(--cr-line); } .cr-stat:nth-child(odd) { border-right:1px solid var(--cr-line); margin-right:28px; } .cr-stat strong { display:block; font-size:33px; letter-spacing:-.06em; font-weight:600; } .cr-stat label { display:block; margin-top:8px; color:#788389; font:10px "DM Mono"; text-transform:uppercase; letter-spacing:.07em; }
        .cr-console { border:1px solid var(--cr-line); padding:22px; color:#879198; font:11px/2 "DM Mono"; background:#0d1113; } .cr-console b { color:var(--cr-signal); font-weight:400; } .cr-console .dim { color:#4f595f; }
        .cr-cta { padding:125px 0; display:flex; justify-content:space-between; align-items:end; } .cr-cta h2 { max-width:610px; margin:0; font-size:53px; line-height:1; letter-spacing:-.06em; } .cr-cta p { color:#879198; font-size:13px; line-height:1.6; max-width:260px; margin:0 0 4px; } .cr-footer { border-top:1px solid var(--cr-line); padding:22px 0 32px; color:#626c72; display:flex; justify-content:space-between; font:10px "DM Mono"; } .cr-footer a { color:#858f94; text-decoration:none; margin-left:22px; } .cr-footer a:hover { color:var(--cr-signal); }
        @keyframes cr-pulse { 0%,100%{opacity:.35;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} } @keyframes cr-slide { from{opacity:.3;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width:760px) { .cr-wrap{padding:0 18px}.cr-navlinks{display:none}.cr-hero{min-height:600px}.cr-hero h1{font-size:54px}.cr-section{padding:78px 0}.cr-section h2{font-size:35px}.cr-flow{display:block}.cr-flow-item{border-right:0;border-bottom:1px solid var(--cr-line);margin:0;padding:24px 0}.cr-ledger{overflow-x:auto}.cr-row{min-width:720px}.cr-proof{display:block}.cr-console{margin-top:42px}.cr-cta{display:block;padding:86px 0}.cr-cta h2{font-size:43px;margin-bottom:32px}.cr-footer{display:block}.cr-footer nav{margin-top:18px}.cr-footer a{margin:0 20px 0 0} }
      `}</style>
      <div className="cr-wrap">
        <nav className="cr-nav">
          <div className="cr-logo"><i /> ARCANUM</div>
          <div className="cr-navlinks"><a href="#control">Control layer</a><a href="#ledger">Live ledger</a><a href="#proof">For operators</a></div>
          <button className="cr-navcta" onClick={() => document.getElementById("start")?.scrollIntoView({ behavior: "smooth" })}>Request access <Arrow right /></button>
        </nav>
        <div className="cr-heartbeat"><span className="cr-pulse" /> system heartbeat <span className="cr-beats" /><span>12 agents / 08:42:16 UTC</span></div>
        <section className="cr-hero">
          <div>
            <div className="cr-kicker">The governance layer for autonomous money</div>
            <h1>Agents can move money.<br /><span>You decide where it goes.</span></h1>
            <p className="cr-hero-copy">ARCANUM gives every AI-agent wallet a policy boundary. Check every transaction, block the exceptions, and put the edge cases in front of a human.</p>
            <div className="cr-hero-actions"><button className="cr-primary" onClick={() => document.getElementById("start")?.scrollIntoView({ behavior: "smooth" })}>See the control room <Arrow right /></button><a className="cr-text-link" href="#ledger">Watch a dollar move ↓</a></div>
          </div>
        </section>
        <section id="control" className="cr-section">
          <Reveal><div className="cr-eyebrow">01 / How a dollar gets governed</div><h2>Every transaction meets the same three questions.</h2><p className="cr-section-intro">No blind spots between an agent deciding to spend and a dollar leaving your treasury.</p></Reveal>
          <div className="cr-flow">
            <div className="cr-flow-item"><span className="cr-num">01</span><h3>Policy check <Arrow /></h3><p>Read the wallet’s rules at the point of execution. Per-tx and daily caps. Vendor allowlists. Asset and chain constraints.</p></div>
            <div className="cr-flow-item"><span className="cr-num">02</span><h3>Allow or block <Arrow /></h3><p>Return a verdict in 42ms. Approved funds move. Out-of-policy attempts stop before they reach the chain.</p></div>
            <div className="cr-flow-item"><span className="cr-num">03</span><h3>Escalate to a human <Arrow /></h3><p>When the policy says “ask”, route the transaction to the right operator with its full context.</p></div>
          </div>
          <div id="ledger" className="cr-ledger">
            <div className="cr-ledger-head"><span className="cr-ledger-title">Governed ledger / live stream</span><span className="cr-ledger-status"><span className="cr-pulse" /> recording</span></div>
            {txs.map((tx, i) => <div className={`cr-row ${i === live ? "active" : ""}`} key={tx.time}><span className="cr-mono">{tx.time}</span><span className="strong">{tx.agent}</span><span>{tx.vendor} <span className="cr-note">{tx.addr}</span></span><span className="strong cr-mono">{tx.amount}</span><span className={`cr-verdict ${tx.tone}`}>{tx.verdict}</span><span className="cr-note">{tx.note}</span></div>)}
          </div>
        </section>
        <section className="cr-section">
          <Reveal><div className="cr-eyebrow">02 / Control, made explicit</div><h2>Rules your finance team can read. Decisions your agents can’t reinterpret.</h2></Reveal>
          <div className="cr-proof" style={{ marginTop: 60 }}>
            <div className="cr-stats"><div className="cr-stat"><strong>$500</strong><label>per-transaction cap</label></div><div className="cr-stat"><strong>$5,000</strong><label>daily wallet cap</label></div><div className="cr-stat"><strong>42ms</strong><label>median policy check</label></div><div className="cr-stat"><strong>100%</strong><label>ledger coverage</label></div></div>
            <div className="cr-console"><div><b>●</b> POLICY / procurement-bot</div><div className="dim">────────────────────</div><div>vendor = <b>["AWS", "Anthropic"]</b></div><div>per_tx ≤ <b>500 USDC</b></div><div>daily ≤ <b>5,000 USDC</b></div><div>on_mismatch → <b>ESCALATE</b></div></div>
          </div>
        </section>
        <section id="proof" className="cr-section">
          <Reveal><div className="cr-eyebrow">03 / The operator’s view</div><h2>Trust is not a status page. It is an answer to every “why”.</h2><p className="cr-section-intro">Trace the intent, rule evaluation, verdict, and settlement for every dollar. Export the record when auditors arrive.</p></Reveal>
          <div className="cr-ledger" style={{ marginTop: 55, padding: 28 }}><div className="cr-mono" style={{ color: "#657078", fontSize: 10 }}>AUDIT EVENT / 2025-04-18T14:32:14Z</div><div style={{ display:"flex", justifyContent:"space-between", gap:30, marginTop:22, flexWrap:"wrap" }}><div><div style={{ color:"#e4e8e9",fontWeight:600 }}>procurement-bot requested 420.00 USDC</div><div className="cr-note" style={{ marginTop:9 }}>Anthropic · 0x3f…9a2c · Arc mainnet</div></div><div className="cr-escalate" style={{ color:"#e8bd72", fontFamily:"DM Mono", fontSize:11 }}>{approved ? "APPROVED BY YOU" : "AWAITING HUMAN APPROVAL"} <button className="cr-primary" style={{ marginLeft:15, padding:"8px 11px", fontSize:10 }} onClick={() => setApproved(!approved)}>{approved ? "Revoke" : "Approve"}</button></div></div></div>
        </section>
        <section id="start" className="cr-cta"><div><div className="cr-kicker">Put a boundary around autonomy</div><h2>Let your agents work.<br /><span style={{ color:"#778187" }}>Keep your hand on the switch.</span></h2></div><div><p>ARCANUM is building the operating layer for agentic finance on Arc.</p><button className="cr-primary" style={{ marginTop:24 }} onClick={() => window.alert("Thanks — access request noted.")}>Request early access <Arrow right /></button></div></section>
        <footer className="cr-footer"><span>© 2025 ARCANUM / thearcanum.in</span><nav><a href="#control">Docs</a><a href="#proof">Status</a><a href="#start">Contact</a></nav></footer>
      </div>
    </main>
  );
}