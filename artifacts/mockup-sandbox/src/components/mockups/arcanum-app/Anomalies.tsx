import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./_shared/Header";

type AnomalyStatus = "FROZEN" | "WATCH";

type Anomaly = {
  agent: string;
  time: string;
  status: AnomalyStatus;
  score: string;
  severity: string;
  narrative: string;
  points: string;
};

const ORANGE = "var(--wl-signal)";
const navItems = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

const initialAnomalies: Anomaly[] = [
  { agent: "growth-bot", time: "10:42:18 UTC", status: "FROZEN", score: "6.2", severity: "CRITICAL", narrative: "spend 4.8× baseline vs 30d median", points: "2,24 10,22 18,23 27,17 35,18 43,8 51,11 59,5" },
  { agent: "support-agent", time: "09:57:04 UTC", status: "WATCH", score: "4.7", severity: "ELEVATED", narrative: "OpenAI retries crossed the hourly threshold", points: "2,21 10,19 18,18 27,20 35,12 43,15 51,10 59,11" },
  { agent: "research-bot", time: "09:31:44 UTC", status: "WATCH", score: "3.9", severity: "ELEVATED", narrative: "new Qdrant region outside approved geography", points: "2,20 10,21 18,16 27,17 35,19 43,13 51,14 59,9" },
  { agent: "procurement-bot", time: "08:16:27 UTC", status: "WATCH", score: "3.4", severity: "ELEVATED", narrative: "AWS burst pattern reached 82% of daily cap", points: "2,22 10,20 18,22 27,18 35,16 43,18 51,14 59,12" },
];

function StatusPill({ status }: { status: AnomalyStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.13em] ${status === "FROZEN" ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]" : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"}`}>
      {status}
    </span>
  );
}

function Sparkline({ points }: { points: string }) {
  const [first, ...rest] = points.split(" ");
  const last = rest[rest.length - 1];
  return (
    <svg aria-label="anomaly trend" viewBox="0 0 62 28" className="h-7 w-[62px]" fill="none">
      <polyline points={points} style={{ stroke: 'var(--wl-secondary)' }} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <polyline points={`${first} ${last}`} stroke={ORANGE} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={Number(last.split(",")[0])} cy={Number(last.split(",")[1])} r="1.8" fill={ORANGE} />
    </svg>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .font-mono{font-family:'DM Mono',monospace}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(var(--wl-ink-rgb),.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.32),0 2px 6px rgba(var(--wl-ink-rgb),.08);transform:translateY(-1px)}
        .warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:var(--wl-ink)}.warm-pill-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink)}
        .anomaly-row{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 90ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .anomaly-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes rowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before,.anomaly-row{animation:none;transition:none}.warm-pill:hover,.anomaly-row:hover{transform:none}}
      `}</style>
      <Header active="ANOMALIES" /><header className="hidden flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[var(--wl-line)] px-5 py-4 sm:h-[68px] sm:flex-nowrap sm:px-8 sm:py-0">
        <div className="flex min-w-0 items-center gap-7">
          <a href="/__mockup/preview/arcanum-app/Anomalies" className="shrink-0 text-[18px] font-bold tracking-[-.05em]">ARCANUM<span className="text-[var(--wl-signal)]">.</span></a>
          <nav className="flex min-w-0 gap-4 overflow-x-auto pb-0.5 sm:gap-5">
            {navItems.map((item) => {
              const active = item === "ANOMALIES";
              return <a key={item} href={`/__mockup/preview/arcanum-app/${item[0] + item.slice(1).toLowerCase()}`} className={`whitespace-nowrap text-[11px] font-medium tracking-[-.01em] transition-colors duration-[220ms] ${active ? "border-b-2 border-[var(--wl-signal)] pb-[6px] text-[var(--wl-ink)]" : "text-[var(--wl-body)] hover:text-[var(--wl-ink)]"}`}>{item}</a>;
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden font-mono text-[9px] tracking-[.14em] text-[var(--wl-mute)] sm:inline">ARC TESTNET</span>
          <div className="flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-3 py-1.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--wl-ink)] font-mono text-[9px] text-[var(--wl-bg)]">HD</span>
            <span className="text-[12px] font-medium">HELIX-DAO</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
    </main>
  );
}

export function Anomalies() {
  const [anomalies, setAnomalies] = useState(initialAnomalies);
  const [notice, setNotice] = useState("MONITORING WINDOW / LAST 24 HOURS");
  const [investigated, setInvestigated] = useState<string | null>(null);
  const critical = useMemo(() => anomalies.filter((item) => item.severity === "CRITICAL").length, [anomalies]);

  const restrain = (agent: string) => {
    setAnomalies((items) => items.map((item) => item.agent === agent ? { ...item, status: "FROZEN" } : item));
    setNotice(`${agent.toUpperCase()} WALLET RESTRAINED · POLICY HOLD ACTIVE`);
  };

  const dismiss = (agent: string) => {
    setAnomalies((items) => items.filter((item) => item.agent !== agent));
    setNotice(`${agent.toUpperCase()} REMOVED FROM ACTIVE REGISTER`);
  };

  return (
    <AppShell>
      <section className="flex flex-col justify-between gap-6 border-b border-[var(--wl-line)] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[var(--wl-signal)]">WATCH / DEVIATION</p>
          <h1 className="mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.045em]">Anomalies</h1>
          <p className="mt-5 max-w-[460px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">Where agent behavior departs from its approved operating shape.</p>
        </div>
        <button type="button" onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })} className="warm-pill w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]">Review register <span className="ml-2">↘</span></button>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
        <div className="border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-secondary)]">DEVIATION INDEX</p><div className="mt-8 flex items-end gap-3"><span className="text-[clamp(4.5rem,9vw,7.8rem)] font-semibold leading-[.72] tracking-[-.045em] text-[var(--wl-signal)]">6.2</span><span className="mb-1 font-mono text-[10px] tracking-[.14em] text-[var(--wl-signal)]">CRITICAL</span></div></div>
            <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">LIVE / 24H</span>
          </div>
          <p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">peak deviation / 24h</p>
          <div className="mt-10">
            <div className="relative h-4 border-t border-[var(--wl-ink)]">
              <span className="absolute left-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">0</span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((tick) => <span key={tick} className="absolute top-[-4px] h-2 w-px bg-[var(--wl-ink)]" style={{ left: `${tick * 12.5}%` }} />)}
              <span className="absolute top-[-5px] h-3 w-[2px] bg-[var(--wl-signal)]" style={{ left: "77.5%" }} />
              <span className="absolute right-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">8</span>
            </div>
            <div className="mt-4 flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]"><span>nominal</span><span>attention</span><span>critical</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">CRITICAL</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.045em] text-[var(--wl-signal)]">{critical}</strong><span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">NOW</span></div>
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">ELEVATED</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.045em]">3</strong><span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">OPEN</span></div>
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] leading-[1.3] tracking-[.14em] text-[var(--wl-secondary)]">RESOLVED / 30D</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.045em]">14</strong><span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">CLOSED</span></div>
        </div>
      </section>

      <section id="register" className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-ink)] pb-4 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">REGISTER / ACTIVE</p><h2 className="mt-3 text-2xl font-semibold tracking-[-.05em]">Anomaly register</h2></div><span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">{notice}</span></div>
        <div className="hidden grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] md:grid"><span>Agent</span><span>Observed</span><span>Status</span><span>Score</span><span>Deviation</span><span>Trend</span><span className="text-right">Action</span></div>
        <div className="divide-y divide-[var(--wl-line-soft)] border-b border-[var(--wl-line)]">
          {anomalies.length === 0 && <div className="border border-dashed border-[var(--wl-line)] p-10 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">REGISTER CLEAR · NO ACTIVE DEVIATIONS</div>}
          {anomalies.map((item, index) => (
            <div key={item.agent} style={{ "--row": index } as CSSProperties} className="anomaly-row grid gap-3 px-4 py-5 md:grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] md:items-center">
              <div><div className="text-[13px] font-medium">{item.agent}</div><div className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">agent wallet · 0x{index === 0 ? "a8…c912" : index === 1 ? "71…4be1" : index === 2 ? "c2…ff18" : "3f…9a2c"}</div></div>
              <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">{item.time}</span>
              <div><StatusPill status={item.status} /><span className="ml-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] md:hidden">{item.severity}</span></div>
              <span className="font-mono text-[14px] tabular-nums text-[var(--wl-signal)]">{item.score}</span>
              <span className="text-[12px] text-[var(--wl-body)]">{item.narrative}</span>
              <div className="flex items-center justify-between gap-3"><Sparkline points={item.points} /><span className="hidden font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] lg:inline">{item.severity}</span></div>
              <div className="flex items-center justify-start gap-3 md:justify-end">{item.status === "FROZEN" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wl-ink)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-bg)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--wl-signal)]" />RESTRAINED</span> : <button type="button" onClick={() => restrain(item.agent)} className="rounded-full border border-[var(--wl-signal)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--wl-signal)] hover:text-white">Restrain</button>}<button type="button" onClick={() => { const opening = investigated !== item.agent; setInvestigated(opening ? item.agent : null); if (opening) setNotice(`${item.agent.toUpperCase()} INVESTIGATION OPEN · 4 TRANSACTIONS FLAGGED`); }} className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em]">{investigated === item.agent ? "Close trace" : "Investigate"}</button><button type="button" onClick={() => dismiss(item.agent)} className="font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]">Dismiss</button></div>
              {investigated === item.agent && <div className="md:col-span-7 border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-5 py-4">
                <div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">INVESTIGATION TRACE / {item.agent.toUpperCase()}</p><span className="font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-mute)]">OPENED {item.time}</span></div>
                <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-[var(--wl-body)] sm:grid-cols-2">
                  <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5"><span>Baseline comparison</span><span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">DEVIATION {item.score}σ</span></div>
                  <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5"><span>Vendor path</span><span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-green)]">3 HOPS VERIFIED</span></div>
                  <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5"><span>Wallet history · 30d</span><span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-body)]">4 TX FLAGGED</span></div>
                  <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5"><span>Policy doctrine check</span><span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">§3.2 CAP BURST</span></div>
                </div>
                <div className="mt-3 flex gap-4"><button type="button" data-nav="LEDGER" className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-signal)] hover:underline">OPEN LEDGER ROWS →</button><button type="button" data-nav="AGENT_DETAIL" className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]">VIEW DOSSIER</button></div>
              </div>}
            </div>
          ))}
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]"><span>Policy/v4.18</span><span>caps $500/tx · $5,000/day</span><span>updated 10:43:02 UTC</span></div>
    </AppShell>
  );
}