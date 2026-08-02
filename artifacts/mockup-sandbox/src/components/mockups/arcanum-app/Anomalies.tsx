import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

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

const ORANGE = "#ff3c00";
const navItems = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];

const initialAnomalies: Anomaly[] = [
  { agent: "growth-bot", time: "10:42:18 UTC", status: "FROZEN", score: "6.2", severity: "CRITICAL", narrative: "spend 4.8× baseline vs 30d median", points: "2,24 10,22 18,23 27,17 35,18 43,8 51,11 59,5" },
  { agent: "support-agent", time: "09:57:04 UTC", status: "WATCH", score: "4.7", severity: "ELEVATED", narrative: "OpenAI retries crossed the hourly threshold", points: "2,21 10,19 18,18 27,20 35,12 43,15 51,10 59,11" },
  { agent: "research-bot", time: "09:31:44 UTC", status: "WATCH", score: "3.9", severity: "ELEVATED", narrative: "new Qdrant region outside approved geography", points: "2,20 10,21 18,16 27,17 35,19 43,13 51,14 59,9" },
  { agent: "procurement-bot", time: "08:16:27 UTC", status: "WATCH", score: "3.4", severity: "ELEVATED", narrative: "AWS burst pattern reached 82% of daily cap", points: "2,22 10,20 18,22 27,18 35,16 43,18 51,14 59,12" },
];

function StatusPill({ status }: { status: AnomalyStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.13em] ${status === "FROZEN" ? "bg-[#292522] text-[#faf6f1]" : "border border-[#ff3c00] text-[#ff3c00]"}`}>
      {status}
    </span>
  );
}

function Sparkline({ points }: { points: string }) {
  const [first, ...rest] = points.split(" ");
  const last = rest[rest.length - 1];
  return (
    <svg aria-label="anomaly trend" viewBox="0 0 62 28" className="h-7 w-[62px]" fill="none">
      <polyline points={points} stroke="#837a72" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <polyline points={`${first} ${last}`} stroke={ORANGE} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={Number(last.split(",")[0])} cy={Number(last.split(",")[1])} r="1.8" fill={ORANGE} />
    </svg>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .font-mono{font-family:'DM Mono',monospace}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(41,37,34,.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(255,60,0,.32),0 2px 6px rgba(41,37,34,.08);transform:translateY(-1px)}
        .warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:#292522}.warm-pill-ghost:hover{color:#faf6f1;border-color:#292522}
        .anomaly-row{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 90ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .anomaly-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 #ff3c00}
        @keyframes rowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before,.anomaly-row{animation:none;transition:none}.warm-pill:hover,.anomaly-row:hover{transform:none}}
      `}</style>
      <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#ded7d0] px-5 py-4 sm:h-[68px] sm:flex-nowrap sm:px-8 sm:py-0">
        <div className="flex min-w-0 items-center gap-7">
          <a href="/__mockup/preview/arcanum-app/Anomalies" className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></a>
          <nav className="flex min-w-0 gap-4 overflow-x-auto pb-0.5 sm:gap-5">
            {navItems.map((item) => {
              const active = item === "ANOMALIES";
              return <a key={item} href={`/__mockup/preview/arcanum-app/${item[0] + item.slice(1).toLowerCase()}`} className={`whitespace-nowrap text-[11px] font-medium tracking-[-.01em] transition-colors duration-[220ms] ${active ? "border-b-2 border-[#ff3c00] pb-[6px] text-[#292522]" : "text-[#655d56] hover:text-[#292522]"}`}>{item}</a>;
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden font-mono text-[9px] tracking-[.14em] text-[#9b9289] sm:inline">ARC TESTNET</span>
          <div className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-3 py-1.5">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span>
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
      <section className="flex flex-col justify-between gap-6 border-b border-[#ded7d0] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[#ff3c00]">WATCH / DEVIATION</p>
          <h1 className="mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.09em]">Anomalies</h1>
          <p className="mt-5 max-w-[460px] text-[14px] leading-[1.45] text-[#776f68]">Where agent behavior departs from its approved operating shape.</p>
        </div>
        <button type="button" onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })} className="warm-pill w-fit rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-[#faf6f1]">Review register <span className="ml-2">↘</span></button>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
        <div className="border border-[#ded7d0] bg-[#f5f0ea] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#837a72]">DEVIATION INDEX</p><div className="mt-8 flex items-end gap-3"><span className="text-[clamp(4.5rem,9vw,7.8rem)] font-semibold leading-[.72] tracking-[-.11em] text-[#ff3c00]">6.2</span><span className="mb-1 font-mono text-[10px] tracking-[.14em] text-[#ff3c00]">CRITICAL</span></div></div>
            <span className="font-mono text-[9px] tracking-[.15em] text-[#9b9289]">LIVE / 24H</span>
          </div>
          <p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-[#837a72]">peak deviation / 24h</p>
          <div className="mt-10">
            <div className="relative h-4 border-t border-[#292522]">
              <span className="absolute left-0 top-2 font-mono text-[9px] text-[#837a72]">0</span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((tick) => <span key={tick} className="absolute top-[-4px] h-2 w-px bg-[#292522]" style={{ left: `${tick * 12.5}%` }} />)}
              <span className="absolute top-[-5px] h-3 w-[2px] bg-[#ff3c00]" style={{ left: "77.5%" }} />
              <span className="absolute right-0 top-2 font-mono text-[9px] text-[#837a72]">8</span>
            </div>
            <div className="mt-4 flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]"><span>nominal</span><span>attention</span><span>critical</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#ded7d0] border border-[#ded7d0] bg-[#fbf8f4]">
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] tracking-[.14em] text-[#837a72]">CRITICAL</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.08em] text-[#ff3c00]">{critical}</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">NOW</span></div>
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] tracking-[.14em] text-[#837a72]">ELEVATED</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.08em]">3</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">OPEN</span></div>
          <div className="p-4 sm:p-6"><span className="font-mono text-[9px] leading-[1.3] tracking-[.14em] text-[#837a72]">RESOLVED / 30D</span><strong className="mt-9 block text-4xl font-semibold tracking-[-.08em]">14</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">CLOSED</span></div>
        </div>
      </section>

      <section id="register" className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-[#292522] pb-4 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">REGISTER / ACTIVE</p><h2 className="mt-3 text-2xl font-semibold tracking-[-.06em]">Anomaly register</h2></div><span className="font-mono text-[9px] tracking-[.12em] text-[#9b9289]">{notice}</span></div>
        <div className="hidden grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] gap-4 border-b border-[#ded7d0] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289] md:grid"><span>Agent</span><span>Observed</span><span>Status</span><span>Score</span><span>Deviation</span><span>Trend</span><span className="text-right">Action</span></div>
        <div className="divide-y divide-[#e3dcd5] border-b border-[#ded7d0]">
          {anomalies.length === 0 && <div className="border border-dashed border-[#ded7d0] p-10 text-center font-mono text-[10px] tracking-[.14em] text-[#837a72]">REGISTER CLEAR · NO ACTIVE DEVIATIONS</div>}
          {anomalies.map((item, index) => (
            <div key={item.agent} style={{ "--row": index } as CSSProperties} className="anomaly-row grid gap-3 px-4 py-5 md:grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] md:items-center">
              <div><div className="text-[13px] font-medium">{item.agent}</div><div className="mt-1 font-mono text-[9px] text-[#9b9289]">agent wallet · 0x{index === 0 ? "a8…c912" : index === 1 ? "71…4be1" : index === 2 ? "c2…ff18" : "3f…9a2c"}</div></div>
              <span className="font-mono text-[10px] tabular-nums text-[#655d56]">{item.time}</span>
              <div><StatusPill status={item.status} /><span className="ml-2 font-mono text-[9px] tracking-[.1em] text-[#837a72] md:hidden">{item.severity}</span></div>
              <span className="font-mono text-[14px] tabular-nums text-[#ff3c00]">{item.score}</span>
              <span className="text-[12px] text-[#655d56]">{item.narrative}</span>
              <div className="flex items-center justify-between gap-3"><Sparkline points={item.points} /><span className="hidden font-mono text-[9px] tracking-[.12em] text-[#837a72] lg:inline">{item.severity}</span></div>
              <div className="flex items-center justify-start gap-3 md:justify-end"><button type="button" onClick={() => restrain(item.agent)} className="rounded-full border border-[#ff3c00] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[#ff3c00] transition-transform duration-[220ms] hover:-translate-y-0.5">Restrain</button><button type="button" onClick={() => { setInvestigated(item.agent); setNotice(`${item.agent.toUpperCase()} INVESTIGATION OPEN · 4 TRANSACTIONS FLAGGED`); }} className="warm-pill warm-pill-ghost rounded-full border border-[#ded7d0] px-3 py-1.5 font-mono text-[9px] tracking-[.1em]">Investigate</button><button type="button" onClick={() => dismiss(item.agent)} className="font-mono text-[9px] tracking-[.1em] text-[#837a72] transition-colors hover:text-[#292522]">Dismiss</button></div>
              {investigated === item.agent && <div className="md:col-span-7 border-l-2 border-[#ff3c00] bg-[#f5f0ea] px-4 py-3 text-[11px] text-[#655d56]">Investigation trace opened for <strong className="font-medium text-[#292522]">{item.agent}</strong> · baseline comparison, vendor path, and wallet history queued for review.</div>}
            </div>
          ))}
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]"><span>Policy/v4.18</span><span>caps $500/tx · $5,000/day</span><span>updated 10:43:02 UTC</span></div>
    </AppShell>
  );
}