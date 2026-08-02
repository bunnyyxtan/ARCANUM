import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, CircleAlert, LockKeyhole, Menu, ShieldCheck, X, Zap } from "lucide-react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATE";
type Row = { time: string; agent: string; vendor: string; amount: string; verdict: Verdict; note: string };

const seedRows: Row[] = [
  { time: "14:42:08.311", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", verdict: "ALLOWED", note: "policy match · infra" },
  { time: "14:42:09.047", agent: "procurement-bot", vendor: "OpenAI", amount: "$620.00", verdict: "BLOCKED", note: "daily cap exceeded" },
  { time: "14:42:11.803", agent: "treasury-bot", vendor: "Anthropic", amount: "$1,200.00", verdict: "ESCALATE", note: "new vendor · human review" },
  { time: "14:42:14.190", agent: "procurement-bot", vendor: "AWS", amount: "$48.60", verdict: "ALLOWED", note: "policy match · infra" },
  { time: "14:42:16.922", agent: "ops-agent", vendor: "Linear", amount: "$87.50", verdict: "ALLOWED", note: "policy match · tools" },
];
const streamRows: Row[] = [
  { time: "14:42:19.103", agent: "research-agent", vendor: "Replicate", amount: "$42.80", verdict: "ALLOWED", note: "policy match · model" },
  { time: "14:42:21.711", agent: "procurement-bot", vendor: "Unknown", amount: "$2,180.00", verdict: "BLOCKED", note: "vendor not allowlisted" },
  { time: "14:42:24.090", agent: "treasury-bot", vendor: "Datadog", amount: "$980.00", verdict: "ESCALATE", note: "velocity threshold · review" },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="mv-kicker"><span />{children}</div>;
}
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0; const id = window.setInterval(() => { start += Math.max(1, to / 28); if (start >= to) { setValue(to); window.clearInterval(id); } else setValue(Math.floor(start)); }, 36);
    return () => window.clearInterval(id);
  }, [to]);
  return <>{value.toLocaleString()}{suffix}</>;
}

function Verdict({ value }: { value: Verdict }) {
  const style = value === "BLOCKED" ? "mv-blocked" : value === "ESCALATE" ? "mv-escalate" : "mv-allowed";
  return <span className={`mv-verdict ${style}`}><i />{value}</span>;
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mv-glass ${className}`}>{children}</div>;
}

export function MoltenVault() {
  const [mobile, setMobile] = useState(false);
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [openApproval, setOpenApproval] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const visibleRows = useMemo(() => rows.slice(-5), [rows]);
  useEffect(() => {
    const id = window.setInterval(() => setRows((current) => [...current, streamRows[current.length % streamRows.length]]), 3200);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursor({ x: (e.clientX / window.innerWidth - .5) * 8, y: (e.clientY / window.innerHeight - .5) * 8 });
    window.addEventListener("mousemove", onMove); return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <main className="mv-shell" id="top" style={{ "--mx": `${cursor.x}px`, "--my": `${cursor.y}px` } as React.CSSProperties}>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=gambetta@400,500,700&f[]=satoshi@400,500,700,900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        :root{--umber:#120f0d;--deep:#191411;--ink:#eee4d4;--muted:#a99b87;--amber:#d59b52;--ember:#b95538;--line:rgba(235,214,183,.18)}
        *{box-sizing:border-box}html{scroll-behavior:smooth}.mv-shell{background:#120f0d;color:var(--ink);font-family:Satoshi,sans-serif;min-height:100dvh;overflow:hidden;position:relative}
        .mv-shell:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.19;background-image:radial-gradient(rgba(250,225,181,.38) .55px,transparent .55px);background-size:19px 19px;mix-blend-mode:screen;z-index:0}
        .mv-world{position:absolute;inset:0;height:900px;pointer-events:none;background:radial-gradient(ellipse at 69% 10%,rgba(190,112,42,.27),transparent 34%),radial-gradient(ellipse at 12% 34%,rgba(95,51,30,.23),transparent 33%),linear-gradient(135deg,#100d0b,#211711 52%,#110e0c);z-index:0}
        .mv-world:after{content:"";position:absolute;width:55vw;height:55vw;right:-14vw;top:-22vw;border-radius:50%;border:1px solid rgba(234,177,91,.16);box-shadow:0 0 90px rgba(192,110,40,.14),inset 0 0 90px rgba(214,140,59,.11);animation:mv-drift 13s ease-in-out infinite alternate}
        @keyframes mv-drift{to{transform:translate(-4vw,3vw) rotate(8deg);opacity:.65}}
        .mv-wrap{max-width:1240px;margin:auto;padding:0 34px;position:relative;z-index:1}.mv-nav{height:82px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
        .mv-word{font-family:Gambetta,serif;font-size:26px;letter-spacing:.16em;color:#f0e5d3}.mv-word b{color:var(--amber);font-family:JetBrains Mono;font-size:12px;margin-left:5px}
        .mv-links{display:flex;gap:36px;color:#b7aa98;font-size:12px;letter-spacing:.13em;text-transform:uppercase}.mv-links a:hover{color:var(--amber)}
        .mv-cta{background:var(--amber);border:1px solid #e4b66f;color:#20140a;padding:13px 20px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;font-size:11px;display:inline-flex;align-items:center;gap:12px;box-shadow:0 8px 28px rgba(209,143,61,.18);transition:transform .22s cubic-bezier(.16,1,.3,1),background .22s}
        .mv-cta:hover{transform:translateY(-2px);background:#e0ad65}.mv-cta:active{transform:translateY(2px)}
        .mv-menu{display:none;background:none;border:0;color:var(--ink)}
        .mv-hero{min-height:720px;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;padding:84px 0 90px}.mv-kicker{color:var(--amber);font:600 10px JetBrains Mono;letter-spacing:.19em;text-transform:uppercase;display:flex;gap:10px;align-items:center}.mv-kicker span{height:1px;width:28px;background:var(--amber)}
        .mv-hero h1{font:500 clamp(54px,7.3vw,104px)/.91 Gambetta,serif;letter-spacing:-.055em;margin:24px 0 28px;max-width:670px}.mv-hero h1 em{font-style:italic;color:#d8c2a5}.mv-lede{color:#b5a897;font-size:17px;line-height:1.6;max-width:500px;margin-bottom:34px}.mv-hero-actions{display:flex;align-items:center;gap:24px}.mv-textlink{color:#d7cab8;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.mv-textlink:hover{color:var(--amber)}
        .mv-proof{border-top:1px solid var(--line);display:flex;gap:35px;margin-top:54px;padding-top:20px}.mv-proof b{font:500 24px JetBrains Mono;color:#f0e4d2;display:block}.mv-proof span{color:#847768;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
        .mv-vault{height:440px;position:relative;display:grid;place-items:center;transform:translate(var(--mx),var(--my));transition:transform .6s cubic-bezier(.16,1,.3,1)}.mv-ring{position:absolute;border:1px solid rgba(225,187,130,.28);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(239,210,166,.13),rgba(255,255,255,.025) 40%,rgba(0,0,0,.35) 75%);backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px rgba(255,241,213,.26),0 26px 55px rgba(0,0,0,.35)}.mv-ring:nth-child(1){width:410px;height:410px;animation:mv-rotate 24s linear infinite}.mv-ring:nth-child(2){width:330px;height:330px;border-color:rgba(226,168,83,.32);animation:mv-rotate 18s linear infinite reverse}.mv-ring:nth-child(3){width:255px;height:255px;border-color:rgba(236,217,178,.22);animation:mv-rotate 13s linear infinite}.mv-ring:after{content:"";position:absolute;inset:14px;border-radius:50%;border:1px dashed rgba(218,166,93,.24)}.mv-core{width:152px;height:152px;border-radius:50%;background:radial-gradient(circle at 38% 27%,#6c4930,#201710 52%,#0e0c0a);border:1px solid rgba(247,207,139,.47);box-shadow:inset 0 2px 15px rgba(247,208,140,.3),0 0 0 14px rgba(218,161,82,.05),0 20px 80px rgba(187,105,29,.24);display:grid;place-items:center;z-index:2}.mv-core svg{width:34px;height:34px;color:#e0bc7e;stroke-width:1.2}@keyframes mv-rotate{to{transform:rotate(360deg)}}.mv-vault-label{position:absolute;bottom:16px;right:2%;font:10px JetBrains Mono;color:#887867;letter-spacing:.16em}
        .mv-section{padding:122px 0}.mv-section.tight{padding-top:72px}.mv-section-head{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid var(--line);padding-bottom:24px;margin-bottom:34px}.mv-section h2{font:500 clamp(40px,5vw,70px)/.95 Gambetta;letter-spacing:-.04em;margin:14px 0 0}.mv-section h2 em{color:#c7ae8e}.mv-note{font:12px JetBrains Mono;color:#897b6d;max-width:235px;line-height:1.55}
        .mv-process{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}.mv-step{background:rgba(28,22,18,.74);backdrop-filter:blur(20px);padding:30px;min-height:220px}.mv-step:nth-child(2){background:rgba(45,30,20,.7)}.mv-step-no{font:11px JetBrains Mono;color:#806f5f}.mv-step h3{font:500 27px Gambetta;margin:35px 0 10px}.mv-step p{font-size:13px;color:#a89987;line-height:1.55;max-width:250px}.mv-icon{color:#d5ad73;width:21px;float:right}
        .mv-ledger{display:grid;grid-template-columns:1.4fr .6fr;gap:38px;align-items:start}.mv-glass{background:rgba(255,255,255,.075);backdrop-filter:blur(24px) saturate(175%);border:1px solid rgba(237,215,181,.19);box-shadow:inset 0 1px rgba(255,241,213,.23),0 24px 60px rgba(0,0,0,.25);position:relative}.mv-glass:before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,rgba(255,229,183,.46),transparent 65%);opacity:.7}.mv-ledger-card{padding:20px 0;overflow:hidden}.mv-ledger-top{display:flex;justify-content:space-between;padding:0 22px 15px;border-bottom:1px solid var(--line);font:10px JetBrains Mono;color:#887c6d;letter-spacing:.12em;text-transform:uppercase}.mv-live{color:#d2a462}.mv-live i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#d2a462;margin-right:7px;animation:mv-blink 1.5s infinite}@keyframes mv-blink{50%{opacity:.25}}.mv-row{display:grid;grid-template-columns:108px 1.1fr 1fr 100px 110px;align-items:center;padding:16px 22px;border-bottom:1px solid rgba(237,215,181,.08);gap:10px;font-size:12px;animation:mv-in .5s cubic-bezier(.16,1,.3,1) both}.mv-row:last-child{border-bottom:0}.mv-row:hover{background:rgba(230,182,100,.05)}.mv-row small,.mv-row time{font:10px JetBrains Mono;color:#827668}.mv-amount{font:12px JetBrains Mono;text-align:right}.mv-verdict{font:9px JetBrains Mono;letter-spacing:.08em;justify-self:end}.mv-verdict i{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:7px;background:currentColor}.mv-allowed{color:#d1a55e}.mv-blocked{color:#c0694a}.mv-escalate{color:#d5c3a2}@keyframes mv-in{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        .mv-approval{padding:26px}.mv-approval h3{font:500 28px Gambetta;margin:22px 0 8px}.mv-approval p{color:#a99a87;font-size:13px;line-height:1.55}.mv-approval-meta{margin:24px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:15px 0;display:flex;justify-content:space-between;color:#bcae9c;font:11px JetBrains Mono}.mv-approval button{width:100%;background:transparent;border:1px solid rgba(228,180,108,.5);color:#ddb36d;padding:13px;font:10px JetBrains Mono;letter-spacing:.1em}.mv-approval button:hover{background:rgba(213,155,82,.1)}
        .mv-policy{display:grid;grid-template-columns:.8fr 1.2fr;gap:80px;align-items:center}.mv-policy-copy p{color:#a89987;line-height:1.65;max-width:360px}.mv-rules{display:grid;gap:1px;background:var(--line);border:1px solid var(--line)}.mv-rule{background:rgba(30,23,19,.68);padding:22px 24px;display:flex;align-items:center;justify-content:space-between}.mv-rule strong{font:500 20px Gambetta}.mv-rule span{font:11px JetBrains Mono;color:#9b8b77}.mv-rule small{color:#d1a55e;font:10px JetBrains Mono}
        .mv-proofband{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}.mv-quote{font:500 clamp(29px,4vw,54px)/1.05 Gambetta;letter-spacing:-.03em}.mv-quote em{color:#cda773}.mv-sign{border-left:1px solid var(--amber);padding:5px 0 5px 24px;color:#968777;font-size:12px;line-height:1.6}.mv-sign strong{display:block;color:#ded1bd;font-size:13px;margin-bottom:4px}.mv-footer{border-top:1px solid var(--line);padding:28px 0 40px;display:flex;justify-content:space-between;color:#7e7063;font:10px JetBrains Mono;letter-spacing:.1em}.mv-footer a:hover{color:var(--amber)}
        .mv-float{position:fixed;right:25px;bottom:25px;z-index:4;background:#d39a50;color:#21150b;padding:14px 18px;font:10px JetBrains Mono;letter-spacing:.08em;border:0;box-shadow:0 12px 35px rgba(0,0,0,.35)}.mv-float:hover{transform:translateY(-2px)}
        @media(max-width:800px){.mv-wrap{padding:0 20px}.mv-links{display:none}.mv-menu{display:block}.mv-hero{grid-template-columns:1fr;padding:68px 0 80px;min-height:auto}.mv-vault{height:380px;transform:none}.mv-ring:nth-child(1){width:340px;height:340px}.mv-ring:nth-child(2){width:275px;height:275px}.mv-ring:nth-child(3){width:210px;height:210px}.mv-section{padding:82px 0}.mv-section-head{display:block}.mv-note{margin-top:20px}.mv-process,.mv-ledger,.mv-policy,.mv-proofband{grid-template-columns:1fr;gap:22px}.mv-row{grid-template-columns:78px 1fr 86px}.mv-row time,.mv-row small{display:none}.mv-amount{grid-column:2;text-align:left}.mv-verdict{grid-column:3;grid-row:1 / span 2}.mv-footer{display:block;line-height:2.5}.mv-footer span{display:block}}
        @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
      `}</style>
      <div className="mv-world" />
      <div className="mv-wrap">
        <nav className="mv-nav">
          <a href="#top" className="mv-word">ARCANUM<b>01</b></a>
          <div className="mv-links"><a href="#ledger">The ledger</a><a href="#policies">Policies</a><a href="#proof">Proof</a></div>
          <a className="mv-cta" href="#demo">Request access <ArrowUpRight size={14} /></a>
          <button className="mv-menu" onClick={() => setMobile(!mobile)} aria-label="Toggle menu">{mobile ? <X /> : <Menu />}</button>
        </nav>
        {mobile && <div className="mv-links" style={{ padding: "18px 0", display: "flex" }}><a href="#ledger" onClick={() => setMobile(false)}>The ledger</a><a href="#policies" onClick={() => setMobile(false)}>Policies</a><a href="#proof" onClick={() => setMobile(false)}>Proof</a></div>}
        <section className="mv-hero">
          <div><Kicker>Governance layer · Arc USDC</Kicker><h1>Money moves.<br /><em>Rules stay still.</em></h1><p className="mv-lede">ARCANUM gives every AI-agent wallet a vault-grade operating system: caps, allowlists, human approval, and a ledger no one can rewrite.</p><div className="mv-hero-actions"><a className="mv-cta" href="#demo" onMouseDown={() => setIsPressed(true)} onMouseUp={() => setIsPressed(false)} style={{ transform: isPressed ? "translateY(2px)" : undefined }}>See the governed path <ChevronRight size={14} /></a><a className="mv-textlink" href="#ledger">Open live ledger ↗</a></div><div className="mv-proof"><div><b><Count to={42} />ms</b><span>median policy check</span></div><div><b>$<Count to={24} />M</b><span>governed on Arc</span></div><div><b><Count to={100} />%</b><span>audit coverage</span></div></div></div>
          <div className="mv-vault"><div className="mv-ring" /><div className="mv-ring" /><div className="mv-ring" /><div className="mv-core"><LockKeyhole /></div><span className="mv-vault-label">VAULT / 0x3f…9a2c / LIVE</span></div>
        </section>
        <section className="mv-section tight" id="governed"><div className="mv-section-head"><div><Kicker>01 · Decision physics</Kicker><h2>How a dollar gets<br /><em>governed.</em></h2></div><p className="mv-note">Every instruction enters the same deterministic path. No exceptions for speed.</p></div><div className="mv-process"><div className="mv-step"><span className="mv-step-no">01 / INSPECT</span><Zap className="mv-icon" /><h3>Policy check</h3><p>Read the agent, vendor, amount, time, and velocity against the wallet’s declared policy.</p></div><div className="mv-step"><span className="mv-step-no">02 / DECIDE</span><ShieldCheck className="mv-icon" /><h3>Allow or block</h3><p>Approved transactions settle in 42ms. Out-of-policy intent is stopped before it reaches the chain.</p></div><div className="mv-step"><span className="mv-step-no">03 / ESCALATE</span><CircleAlert className="mv-icon" /><h3>Ask a human</h3><p>Novel vendors and anomalies become a crisp approval request, never a silent compromise.</p></div></div></section>
        <section className="mv-section" id="ledger"><div className="mv-section-head"><div><Kicker>02 · Signature stream</Kicker><h2>The ledger is<br /><em>alive.</em></h2></div><p className="mv-note">Transactions cool from molten intent to solid proof. UTC, immutable, inspectable.</p></div><div className="mv-ledger"><GlassCard className="mv-ledger-card"><div className="mv-ledger-top"><span>governed ledger / arc-mainnet</span><span className="mv-live"><i />streaming</span></div>{visibleRows.map((row, i) => <div className="mv-row" key={`${row.time}-${i}`}><time>{row.time}</time><span>{row.agent}</span><small>{row.vendor} · {row.note}</small><span className="mv-amount">{row.amount}</span><Verdict value={row.verdict} /></div>)}</GlassCard><GlassCard className="mv-approval"><Kicker>Needs a human</Kicker><h3>One decision,<br />held in your hands.</h3><p>Treasury-bot is requesting a new vendor. The policy is asking for your intent, not your trust.</p><div className="mv-approval-meta"><span>POL-7F3A</span><span>$980.00</span><span>UTC 14:42</span></div><button onClick={() => setOpenApproval(!openApproval)}>{openApproval ? "Decision recorded · allowed" : "Review request →"}</button></GlassCard></div></section>
        <section className="mv-section" id="policies"><div className="mv-policy"><div className="mv-policy-copy"><Kicker>03 · Policy surface</Kicker><h2>Cold rules.<br /><em>Warm light.</em></h2><p>Policies are plain enough for finance and precise enough for an agent. Change the constraint, not the contract.</p><a href="#demo" className="mv-textlink" style={{ display: "inline-flex", marginTop: 25 }}>Explore policy syntax <ArrowUpRight size={14} /></a></div><div className="mv-rules"><div className="mv-rule"><div><strong>Per transaction</strong><span> · hard ceiling</span></div><small>$500 / TX</small></div><div className="mv-rule"><div><strong>Daily velocity</strong><span> · rolling UTC window</span></div><small>$5,000 / DAY</small></div><div className="mv-rule"><div><strong>Vendor access</strong><span> · explicit allowlist</span></div><small>12 VENDORS</small></div><div className="mv-rule"><div><strong>Human escalation</strong><span> · novel behavior</span></div><small>REQUIRED</small></div></div></div></section>
        <section className="mv-section" id="proof"><div className="mv-proofband"><div className="mv-quote">“The agent can move quickly because <em>we know exactly where it stops.</em>”</div><div className="mv-sign"><strong>Marin Vale · CFO, Halcyon Systems</strong>ARCANUM is the governance layer between an AI instruction and a dollar on Arc. Every event is signed, timestamped, and ready for audit.</div></div></section>
        <section className="mv-section" id="demo" style={{ textAlign: "center", paddingBottom: 115 }}><Kicker>04 · The vault is open</Kicker><h2>Put rules around<br /><em>the next dollar.</em></h2><p className="mv-lede" style={{ margin: "25px auto 30px" }}>Bring your agents. Keep your standards. We’ll show you the governed path in 20 minutes.</p><a className="mv-cta" href="mailto:hello@thearcanum.in">Request access <ArrowUpRight size={14} /></a></section>
        <footer className="mv-footer"><span>© 2025 ARCANUM · THEARCANUM.IN</span><span><a href="#top">Security</a>　<a href="#top">Documentation</a>　<a href="#top">Contact</a></span><span>BUILT FOR ARC / NON-CUSTODIAL BY DESIGN</span></footer>
      </div>
      <button className="mv-float" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>OPEN THE VAULT ↗</button>
    </main>
  );
}