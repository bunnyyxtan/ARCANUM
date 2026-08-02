import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const orange = "#ff3c00";

function Arrow({ direction = "↗" }: { direction?: string }) {
  return <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">{direction}</span>;
}

function ShellLink({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      className={`relative h-full whitespace-nowrap px-3 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] ${active ? "text-[#292522]" : "text-[#655d56] hover:text-[#292522]"}`}
    >
      {children}
      {active && <span className="absolute bottom-[-1px] left-3 right-3 h-[2px] bg-[#ff3c00]" />}
    </button>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}.font-mono{font-family:'DM Mono',monospace}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(41,37,34,.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(255,60,0,.38),0 2px 6px rgba(41,37,34,.08);transform:translateY(-1px)}.warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:#292522}.warm-pill-ghost:hover{color:#faf6f1;border-color:#292522}
        .warm-reveal{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms) both}
        @keyframes rowIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .health-card{transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}.health-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px -20px rgba(41,37,34,.5)}
        .health-card:hover .card-rule{transform:scaleX(1)}.card-rule{transform:scaleX(.25);transform-origin:left;transition:transform 420ms cubic-bezier(.16,1,.3,1)}
        .data-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.data-row:hover{transform:translateX(3px);background:#f5f0ea}
        @media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before,.warm-reveal,.health-card,.data-row,.card-rule{transition:none!important;animation:none!important;transform:none!important}}
        @media (max-width:900px){.app-nav{overflow-x:auto}.app-nav button{padding-left:9px;padding-right:9px}.app-nav button:first-child{padding-left:0}.app-content{padding-left:20px;padding-right:20px}}
      `}</style>
      <header className="flex h-[68px] items-center justify-between border-b border-[#ded7d0] px-8">
        <div className="flex h-full min-w-0 items-center gap-8">
          <button type="button" onClick={() => undefined} className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></button>
          <nav className="app-nav flex h-full items-center gap-0">
            <ShellLink> DASHBOARD </ShellLink><ShellLink> AGENTS </ShellLink><ShellLink> VENDORS </ShellLink><ShellLink> LEDGER </ShellLink><ShellLink> ESCALATIONS </ShellLink><ShellLink active> ANOMALIES </ShellLink>
          </nav>
        </div>
        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">ARC TESTNET</span>
          <button type="button" onClick={() => undefined} className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-3 py-1.5 transition-colors duration-[220ms] hover:border-[#292522]">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span><span className="text-[12px] font-medium">HELIX-DAO</span>
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

function HealthCard({ index, label, detail, metric, metricLabel, status = "OPERATIONAL" }: { index: number; label: string; detail: string; metric: string; metricLabel: string; status?: string }) {
  return (
    <article className="health-card warm-reveal relative border-r border-[#ded7d0] px-7 py-7 first:pl-0 last:border-r-0 last:pr-0 max-lg:border-b max-lg:border-r-0 max-lg:px-0 max-lg:py-6" style={{ "--i": index } as CSSProperties}>
      <span className="card-rule absolute left-0 right-7 top-0 h-[2px] bg-[#ff3c00]" />
      <div className="flex items-start justify-between gap-5">
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#655d56]">{label}</span>
        <span className={`font-mono text-[10px] tracking-[.12em] ${status === "OPERATIONAL" ? "text-[#292522]" : "text-[#ff3c00]"}`}>{status}</span>
      </div>
      <p className="mt-12 max-w-[290px] text-[13px] leading-[1.45] text-[#776f68]">{detail}</p>
      <div className="mt-8 border-t border-[#e3dcd5] pt-4">
        <strong className="block font-mono text-[20px] font-medium tabular-nums tracking-[-.04em]">{metric}</strong>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289]">{metricLabel}</span>
      </div>
    </article>
  );
}

export function Status() {
  const [checkedAt, setCheckedAt] = useState("09:42:18 UTC");
  const [isChecking, setIsChecking] = useState(false);
  const runCheck = () => {
    setIsChecking(true);
    window.setTimeout(() => {
      setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " UTC");
      setIsChecking(false);
    }, 420);
  };
  return (
    <AppShell>
      <div className="app-content mx-auto max-w-[1400px] px-8 py-10">
        <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
          <div className="warm-reveal">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#ff3c00]">SYSTEMS / READ MODEL</p>
            <h1 className="mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.085em]">Status</h1>
            <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[#776f68]">A direct read on the services that keep governed wallets accountable.</p>
          </div>
          <button type="button" onClick={runCheck} className="warm-pill group rounded-full bg-[#ff3c00] px-5 py-3 text-[12px] font-semibold text-[#fff]">
            {isChecking ? "Checking systems" : "Run health check"}<Arrow />
          </button>
        </div>

        <section className="mt-16 border-y border-[#ded7d0]" aria-label="Infrastructure health">
          <div className="grid grid-cols-3 max-lg:grid-cols-1">
            <HealthCard index={1} label="EVENT INDEXER" detail="On-chain history is being indexed for governed wallets." metric="8,412,930" metricLabel="LAST BLOCK · INDEXING LAG 2 BLOCKS" />
            <HealthCard index={2} label="SUPABASE READ MODEL" detail="service role configured / read model reachable" metric="1,204" metricLabel="SAMPLE ROWS" />
            <HealthCard index={3} label="ARC RPC" detail="The Arc endpoint is answering signed read requests." metric="42ms" metricLabel="LATEST BLOCK 8,412,932 · LATENCY" />
          </div>
        </section>

        <section className="warm-reveal mt-16 grid gap-12 border border-[#ded7d0] bg-[#f5f0ea] p-8 md:grid-cols-[1fr_280px] md:p-10" style={{ "--i": 4 } as CSSProperties}>
          <div className="max-w-[700px]">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">READ MODEL / HOW TO READ THIS</p>
            <p className="mt-8 text-[16px] leading-[1.5] text-[#655d56]">Supabase stores wallet-creation writes so the dashboard can answer quickly. The indexer tracks on-chain history and may lag behind the latest Arc block.</p>
            <p className="mt-5 text-[16px] leading-[1.5] text-[#655d56]">Fresh wallets may show no indexed activity until their first transactions are picked up. That is expected—not a missing policy decision.</p>
          </div>
          <div className="flex flex-col justify-between border-l border-[#ded7d0] pl-6 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-6">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">LAST CHECKED</span>
            <span className="mt-4 font-mono text-[12px] tabular-nums text-[#292522]">{checkedAt}</span>
            <span className="mt-8 text-[11px] leading-[1.45] text-[#837a72]">All read-only checks complete without writing to the ledger.</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}