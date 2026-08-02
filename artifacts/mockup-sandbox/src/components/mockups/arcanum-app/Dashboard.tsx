import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./_shared/Header";

const orange = "var(--wl-signal)";
const navItems = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

type Status = "APPROVED" | "REJECTED" | "ESCALATED";

const streamRows: Array<{
  time: string;
  agent: string;
  action: string;
  counterparty: string;
  amount: string;
  status: Status;
}> = [
  { time: "09:41:08", agent: "procurement-bot", action: "Invoice settlement", counterparty: "AWS", amount: "$184.20", status: "APPROVED" },
  { time: "09:39:44", agent: "support-agent", action: "Token replenishment", counterparty: "OpenAI", amount: "$740.00", status: "REJECTED" },
  { time: "09:36:21", agent: "growth-bot", action: "Campaign inference", counterparty: "Anthropic", amount: "$2,100.00", status: "ESCALATED" },
  { time: "09:34:05", agent: "research-bot", action: "Vector index run", counterparty: "Qdrant Cloud", amount: "$96.20", status: "APPROVED" },
  { time: "09:30:18", agent: "procurement-bot", action: "Reserved capacity", counterparty: "AWS Bedrock", amount: "$316.40", status: "APPROVED" },
  { time: "09:27:52", agent: "support-agent", action: "Embedding batch", counterparty: "OpenAI", amount: "$212.80", status: "REJECTED" },
  { time: "09:21:11", agent: "growth-bot", action: "Model access", counterparty: "Anthropic", amount: "$482.00", status: "ESCALATED" },
  { time: "09:16:39", agent: "research-bot", action: "Archive query", counterparty: "AWS", amount: "$48.00", status: "APPROVED" },
];

function Arrow() {
  return <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">→</span>;
}

function StatusPill({ status }: { status: Status }) {
  const styles = {
    APPROVED: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    REJECTED: "bg-[var(--wl-signal)] text-white",
    ESCALATED: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}>{status}</span>;
}

function Reveal({ children, className = "", index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  return <div className={`warm-reveal warm-reveal-${index} ${className}`}>{children}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .font-mono{font-family:'DM Mono',monospace}
        .warm-reveal{animation:warmIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms) both}
        .warm-reveal-1{--i:1}.warm-reveal-2{--i:2}.warm-reveal-3{--i:3}.warm-reveal-4{--i:4}.warm-reveal-5{--i:5}
        @keyframes warmIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(var(--wl-ink-rgb),.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.42),0 2px 6px rgba(var(--wl-ink-rgb),.08);transform:translateY(-1px)}
        .warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:var(--wl-ink)}.warm-pill-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink)}
        .stream-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.stream-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        @media (prefers-reduced-motion:reduce){.warm-reveal{animation:none}.warm-pill,.warm-pill::before,.stream-row{transition:none}}
      `}</style>
      <Header active="DASHBOARD" />
      {children}
    </main>
  );
}

function CountUp({ target, prefix = "", suffix = "", decimals = 0 }: { target: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  return <>{prefix}{value.toFixed(decimals)}{suffix}</>;
}

function Dashboard() {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const [watching, setWatching] = useState("research-bot");
  const kpis = [
    { label: "VALUE GOVERNED", value: <CountUp target={2.4} prefix="$" suffix="M" decimals={1} />, note: "across 12 wallets" },
    { label: "ACTIVE AGENTS", value: "12", note: "9 transacting today" },
    { label: "THREATS BLOCKED / 30D", value: "47", note: "policy prevented spend" },
    { label: "PENDING ESCALATIONS", value: "2", note: "review required", accent: true },
  ];
  return (
    <Shell>
      <div id="top" className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <Reveal>
          <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">OVERVIEW / FLEET POSTURE</p><h1 className="mt-4 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.86] tracking-[-.045em]">Dashboard</h1><p className="mt-5 max-w-[430px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">A quiet view of autonomous spend, restraint decisions, and the agents moving capital on Arc.</p></div>
            <button type="button" onClick={() => document.getElementById("stream")?.scrollIntoView({ behavior: "smooth" })} className="warm-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white">Review governed events<Arrow /></button>
          </div>
        </Reveal>

        <section aria-label="Governance metrics" className="grid border-b border-[var(--wl-line)] md:grid-cols-4">
          {kpis.map((kpi, i) => <Reveal key={kpi.label} index={i + 1}><div className={`min-h-[142px] border-b border-[var(--wl-line)] py-6 md:border-b-0 ${i > 0 ? "md:border-l md:pl-6" : "md:pr-6"} ${i < 3 ? "md:pr-6" : ""}`}><p className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">{kpi.label}</p><p className={`mt-5 text-[32px] font-semibold tracking-[-.05em] tabular-nums ${kpi.accent ? "text-[var(--wl-signal)]" : "text-[var(--wl-ink)]"}`}>{kpi.value}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">{kpi.note}</p></div></Reveal>)}
        </section>

        <section id="stream" className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,.75fr)]">
          <Reveal index={2}>
            <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">LIVE / 08 EVENTS</p><h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Governed event stream</h2></div><span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">UTC · policy/v4.18</span></div>
            <div className="hidden grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] gap-3 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid"><span>Time</span><span>Agent</span><span>Action</span><span>Counterparty</span><span>Amount</span><span>Status</span></div>
            <div className="divide-y divide-[var(--wl-line-soft)]">
              {streamRows.map((row, i) => <div key={`${row.time}-${row.agent}`} style={{ "--i": i } as CSSProperties} className="stream-row grid gap-2 px-3 py-4 md:grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] md:items-center"><div className="flex justify-between md:block"><span className="font-mono text-[10px] tabular-nums text-[var(--wl-secondary)]">{row.time}</span><span className="md:hidden"><StatusPill status={row.status} /></span></div><span className="text-[12px] font-medium">{row.agent}</span><span className="text-[12px] text-[var(--wl-body)]">{row.action}</span><span className="text-[12px] text-[var(--wl-body)]">{row.counterparty}</span><span className="font-mono text-[12px] tabular-nums">{row.amount}</span><span className="hidden md:block"><StatusPill status={row.status} /></span></div>)}
            </div>
            <a href="#ledger" className="group mt-5 inline-flex font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]">Open full ledger <Arrow /></a>
          </Reveal>

          <Reveal index={3}>
            <aside className="bg-[var(--wl-bg-soft)] p-6 md:p-7">
              <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">ACTION REQUIRED</p><h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Restraint queue</h2></div><span className="rounded-full bg-[var(--wl-signal)] px-2 py-1 font-mono text-[9px] text-white">02</span></div>
              {decision === "pending" ? <div className="border-b border-[var(--wl-line)] py-6"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">research-bot</p><p className="mt-1 text-[13px] text-[var(--wl-body)]">Compute reservation · AWS Bedrock</p></div><span className="font-mono text-[14px] tabular-nums">$96.20</span></div><div className="mt-5 grid grid-cols-2 gap-y-3 font-mono text-[9px] uppercase tracking-[.11em] text-[var(--wl-secondary)]"><span>quorum <b className="font-normal text-[var(--wl-ink)]">1 / 2</b></span><span className="text-right">expires in <b className="font-normal text-[var(--wl-ink)]">5h 12m</b></span><span>cap <b className="font-normal text-[var(--wl-ink)]">$500 / tx</b></span><span className="text-right">wallet <b className="font-normal text-[var(--wl-ink)]">0x71…4be1</b></span></div><div className="mt-6 flex gap-2"><button type="button" onClick={() => setDecision("approved")} className="warm-pill group rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[11px] font-semibold text-white">Approve</button><button type="button" onClick={() => setDecision("rejected")} className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[11px] font-semibold">Reject</button></div></div> : <div className="border-b border-[var(--wl-line)] py-9"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">DECISION RECORDED</p><p className={`mt-3 text-[18px] font-medium ${decision === "approved" ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}>{decision === "approved" ? "Approved by operator" : "Rejected by operator"}</p><button type="button" onClick={() => setDecision("pending")} className="mt-4 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)] underline underline-offset-4">Restore pending item</button></div>}
              <div className="pt-6"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">WATCHLIST</p><span className="font-mono text-[9px] text-[var(--wl-mute)]">03 monitored</span></div><div className="mt-4 space-y-1">{["research-bot", "growth-bot", "support-agent"].map((agent) => <button key={agent} type="button" onClick={() => setWatching(agent)} className={`flex w-full items-center justify-between border-b border-[var(--wl-line-soft)] py-3 text-left text-[12px] transition-transform duration-[220ms] hover:translate-x-1 ${watching === agent ? "text-[var(--wl-ink)]" : "text-[var(--wl-secondary2)]"}`}><span>{agent}</span><span className={`font-mono text-[9px] uppercase tracking-[.12em] ${watching === agent ? "text-[var(--wl-signal)]" : "text-[var(--wl-mute)]"}`}>{watching === agent ? "selected" : "observe"}</span></button>)}</div></div>
            </aside>
          </Reveal>
        </section>
        <section id="ledger" className="mt-14 flex flex-col justify-between gap-5 border-t border-[var(--wl-line)] pt-5 text-[11px] text-[var(--wl-secondary)] sm:flex-row"><span className="font-mono uppercase tracking-[.14em]">Arc testnet · USDC</span><span>Last policy sync 2 minutes ago · median decision 42ms</span></section>
      </div>
    </Shell>
  );
}

export { Dashboard };
export default Dashboard;