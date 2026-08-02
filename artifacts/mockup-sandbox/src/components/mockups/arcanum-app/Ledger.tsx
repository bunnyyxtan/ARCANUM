import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./_shared/Header";

type LedgerStatus = "APPROVED" | "REJECTED" | "ESCALATED" | "FROZEN";

type LedgerRow = {
  time: string;
  agent: string;
  counterparty: string;
  category: string;
  amount: string;
  status: LedgerStatus;
  wallet: string;
  block: string;
  gas: string;
  tx: string;
  decision: string;
};

const rows: LedgerRow[] = [
  { time: "09:41:08", agent: "procurement-bot", counterparty: "AWS", category: "compute", amount: "$184.20", status: "APPROVED", wallet: "0x3f…9a2c", block: "18,402,771", gas: "0.00042 ARC", tx: "0x8f2c…d911", decision: "Approved: vendor and amount satisfy procurement policy" },
  { time: "09:39:42", agent: "support-agent", counterparty: "OpenAI", category: "inference", amount: "$740.00", status: "REJECTED", wallet: "0x71…4be1", block: "18,402,702", gas: "0.00038 ARC", tx: "0x12aa…c01e", decision: "Rejected: exceeds $500 per-transaction cap" },
  { time: "09:36:19", agent: "growth-bot", counterparty: "Anthropic", category: "inference", amount: "$2,100.00", status: "ESCALATED", wallet: "0xa8…c912", block: "18,402,611", gas: "0.00051 ARC", tx: "0x39be…7d42", decision: "Escalated: unusual amount requires human quorum" },
  { time: "09:31:05", agent: "procurement-bot", counterparty: "AWS", category: "compute", amount: "$316.40", status: "APPROVED", wallet: "0x3f…9a2c", block: "18,402,448", gas: "0.00041 ARC", tx: "0xbb83…0a19", decision: "Approved: within daily and per-transaction limits" },
  { time: "09:24:56", agent: "research-bot", counterparty: "Qdrant Cloud", category: "storage", amount: "$96.20", status: "APPROVED", wallet: "0xc4…0f7e", block: "18,402,311", gas: "0.00036 ARC", tx: "0x6d14…91aa", decision: "Approved: allowlisted destination and category" },
  { time: "09:18:31", agent: "support-agent", counterparty: "AWS Bedrock", category: "inference", amount: "$512.00", status: "REJECTED", wallet: "0x71…4be1", block: "18,402,184", gas: "0.00039 ARC", tx: "0x7ea0…b109", decision: "Rejected: exceeds $500 per-transaction cap" },
  { time: "09:06:44", agent: "growth-bot", counterparty: "OpenAI", category: "inference", amount: "$428.50", status: "APPROVED", wallet: "0xa8…c912", block: "18,401,980", gas: "0.00037 ARC", tx: "0x04ce…12f0", decision: "Approved: within policy envelope" },
  { time: "08:52:12", agent: "research-bot", counterparty: "Anthropic", category: "inference", amount: "$188.00", status: "APPROVED", wallet: "0xc4…0f7e", block: "18,401,721", gas: "0.00035 ARC", tx: "0x5d43…a8be", decision: "Approved: within policy envelope" },
  { time: "08:36:40", agent: "procurement-bot", counterparty: "AWS Bedrock", category: "compute", amount: "$2,100.00", status: "ESCALATED", wallet: "0x3f…9a2c", block: "18,401,482", gas: "0.00047 ARC", tx: "0x94fa…1c0a", decision: "Escalated: outside the agent's normal spend pattern" },
  { time: "08:11:29", agent: "support-agent", counterparty: "OpenAI", category: "inference", amount: "$74.40", status: "APPROVED", wallet: "0x71…4be1", block: "18,401,102", gas: "0.00031 ARC", tx: "0xac71…e032", decision: "Approved: allowlisted destination and amount" },
  { time: "07:48:03", agent: "growth-bot", counterparty: "AWS", category: "compute", amount: "$680.00", status: "FROZEN", wallet: "0xa8…c912", block: "18,400,801", gas: "0.00044 ARC", tx: "0xf101…b771", decision: "Frozen: wallet paused pending policy review" },
  { time: "07:12:26", agent: "research-bot", counterparty: "Qdrant Cloud", category: "storage", amount: "$96.20", status: "APPROVED", wallet: "0xc4…0f7e", block: "18,400,410", gas: "0.00033 ARC", tx: "0x8ca8…3d20", decision: "Approved: recurring storage charge is within cap" },
  { time: "06:54:18", agent: "procurement-bot", counterparty: "AWS", category: "compute", amount: "$420.00", status: "APPROVED", wallet: "0x3f…9a2c", block: "18,400,182", gas: "0.00034 ARC", tx: "0xb42f…773a", decision: "Approved: within daily and per-transaction limits" },
];

const statusClasses: Record<LedgerStatus, string> = {
  APPROVED: "bg-[#e7f0e5] text-[#3f653e]",
  REJECTED: "bg-[#ff3c00] text-[#faf6f1]",
  ESCALATED: "border border-[#ff3c00] text-[#ff3c00]",
  FROZEN: "bg-[#292522] text-[#faf6f1]",
};

function StatusPill({ status }: { status: LedgerStatus }) {
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${statusClasses[status]}`}>{status}</span>;
}

function Shell({ children, onAction }: { children: ReactNode; onAction: () => void }) {
  const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];
  return (
    <div className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .arc-ledger{font-family:'Inter Tight',sans-serif}.arc-ledger .font-mono{font-family:'DM Mono',monospace}
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(255,60,0,.42),0 2px 6px rgba(41,37,34,.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:#292522}.arc-ghost:hover{color:#faf6f1;border-color:#292522;box-shadow:0 10px 28px -10px rgba(41,37,34,.35)}
        .arc-row{animation:arcRowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--row-i) * 55ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease,box-shadow 220ms ease}
        .arc-row:hover{transform:translate3d(3px,-1px,0);background:#fbf8f4;box-shadow:inset 2px 0 0 #ff3c00}.arc-row-selected{background:#f5f0ea;box-shadow:inset 2px 0 0 #ff3c00}
        @keyframes arcRowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .arc-drawer{animation:drawerIn 420ms cubic-bezier(.16,1,.3,1) both}@keyframes drawerIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @media (prefers-reduced-motion:reduce){.arc-pill,.arc-row,.arc-drawer{animation:none!important;transition:none!important}.arc-row:hover,.arc-pill:hover{transform:none}}
      `}</style>
      <Header active="LEDGER" /><header className="hidden flex min-h-[68px] items-center justify-between border-b border-[#ded7d0] px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-7">
          <button onClick={onAction} className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></button>
          <nav className="hidden items-center gap-5 lg:flex">
            {links.map((link) => <a key={link} href={`#${link.toLowerCase()}`} className={`relative py-6 text-[12px] font-medium text-[#655d56] transition-colors hover:text-[#292522] ${link === "LEDGER" ? "text-[#292522] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#ff3c00]" : ""}`}>{link}</a>)}
          </nav>
          <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9b9289] lg:hidden">LEDGER</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[9px] tracking-[.14em] text-[#9b9289] sm:inline">ARC TESTNET</span>
          <button onClick={onAction} className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-2 py-1.5 transition-transform duration-[220ms] hover:-translate-y-0.5 sm:px-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span>
            <span className="hidden text-[12px] font-medium sm:inline">HELIX-DAO</span>
          </button>
        </div>
      </header>
      <div className="arc-ledger">{children}</div>
    </div>
  );
}

function CountUp({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 850, 1);
      setShown(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="tabular-nums">{prefix}{shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

export function Ledger() {
  const [filter, setFilter] = useState<"ALL" | LedgerStatus>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LedgerRow>(rows[1]);
  const [notice, setNotice] = useState("");
  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesFilter = filter === "ALL" || row.status === filter;
    const haystack = `${row.agent} ${row.counterparty} ${row.category} ${row.amount} ${row.status}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  }), [filter, search]);

  const action = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <Shell onAction={() => action("Account controls are available to Helix-DAO operators.")}>
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col justify-between gap-7 border-b border-[#ded7d0] pb-9 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">RECORD / LAST 24H</p>
            <h1 className="mt-4 text-[clamp(2.7rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.075em]">Governed ledger</h1>
            <p className="mt-4 max-w-[550px] text-[14px] leading-[1.45] text-[#776f68]">A complete decision record for every governed movement across the Helix-DAO fleet.</p>
          </div>
          <button onClick={() => action("Ledger export queued: 24 hours of governed activity.")} className="arc-pill group w-fit rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-[#faf6f1]">Export report <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">↗</span></button>
        </div>

        <section className="grid grid-cols-2 border-b border-[#ded7d0] md:grid-cols-4">
          {[["TOTAL VALUE", "$18,442.60", "money"], ["APPROVED", "126", "count"], ["REJECTED", "9", "count"], ["ESCALATED", "4", "count"]].map(([label, value, kind], index) => (
            <div key={label} className={`py-6 ${index > 0 ? "border-l border-[#ded7d0] pl-5 md:pl-7" : ""} ${index > 1 ? "border-t md:border-t-0" : ""}`}>
              <p className="font-mono text-[9px] tracking-[.15em] text-[#9b9289]">{label}</p>
              <p className={`mt-3 text-[clamp(1.5rem,3vw,2.15rem)] font-medium tracking-[-.06em] ${label === "ESCALATED" ? "text-[#ff3c00]" : ""}`}>{kind === "money" ? <CountUp value={18442.6} prefix="$" decimals={2} /> : <CountUp value={Number(value)} />}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-4 border-b border-[#ded7d0] py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "APPROVED", "REJECTED", "ESCALATED", "FROZEN"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-3.5 py-2 font-mono text-[9px] tracking-[.14em] transition-all duration-[220ms] ${filter === item ? "border-[#292522] bg-[#292522] text-[#faf6f1]" : "border-[#ded7d0] text-[#776f68] hover:border-[#292522] hover:text-[#292522]"}`}>{item}</button>)}
          </div>
          <label className="flex min-w-0 items-center gap-3 border-b border-[#bdb4aa] pb-2 text-[#9b9289] xl:w-[260px]">
            <span className="font-mono text-[10px]">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="filter ledger rows..." className="min-w-0 flex-1 bg-transparent text-[12px] text-[#292522] outline-none placeholder:text-[#9b9289]" />
          </label>
        </div>

        <div className="mt-7 flex flex-col gap-7 xl:flex-row">
          <section className="min-w-0 flex-1 overflow-hidden border border-[#ded7d0] bg-[#fbf8f4]">
            <div className="hidden grid-cols-[1.05fr_1.2fr_1fr_1fr_.9fr_auto] gap-4 border-b border-[#ded7d0] px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289] md:grid">
              <span>Time</span><span>Agent</span><span>Counterparty</span><span>Category</span><span>Amount</span><span>Status</span>
            </div>
            <div>
              {visibleRows.map((row, index) => <button key={`${row.time}-${row.agent}`} onClick={() => setSelected(row)} style={{ "--row-i": index } as CSSProperties} className={`arc-row grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[#e7e0d9] px-5 py-4 text-left last:border-b-0 md:grid-cols-[1.05fr_1.2fr_1fr_1fr_.9fr_auto] md:gap-4`}>
                <div><span className="font-mono text-[10px] tabular-nums text-[#655d56]">{row.time}</span><span className="ml-2 font-mono text-[9px] text-[#9b9289] md:hidden">UTC</span></div>
                <span className="text-[12px] font-medium">{row.agent}</span>
                <span className="hidden text-[12px] text-[#655d56] md:block">{row.counterparty}</span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[.08em] text-[#776f68] md:block">{row.category}</span>
                <span className="font-mono text-[12px] tabular-nums">{row.amount}</span>
                <StatusPill status={row.status} />
              </button>)}
              {visibleRows.length === 0 && <div className="px-6 py-16 text-center"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[#ff3c00]">NO MATCHING RECORDS</p><p className="mt-3 text-[13px] text-[#776f68]">Try another policy status or search term.</p></div>}
            </div>
            <div className="flex justify-between border-t border-[#ded7d0] px-5 py-3 font-mono text-[9px] text-[#9b9289]"><span>{visibleRows.length} visible records</span><span>policy/v4.18 · ARC / USDC</span></div>
          </section>

          <aside className="arc-drawer w-full shrink-0 border border-[#cfc5bc] bg-[#f5f0ea] xl:w-[360px]">
            <div className="flex items-start justify-between border-b border-[#ded7d0] px-5 py-5">
              <div><p className="font-mono text-[9px] tracking-[.16em] text-[#ff3c00]">DECISION RECORD</p><h2 className="mt-2 text-[18px] font-medium tracking-[-.04em]">{selected.agent}</h2></div>
              <StatusPill status={selected.status} />
            </div>
            <div className="px-5">
              <div className="border-b border-[#ded7d0] py-4"><p className="text-[13px] leading-[1.45] text-[#655d56]">{selected.decision}</p></div>
              <dl className="divide-y divide-[#ded7d0] font-mono text-[10px]">
                {[
                  ["STATUS BY DOCTRINE", selected.status],
                  ["TIME / UTC", `${selected.time} · 2025-06-18`],
                  ["AMOUNT", selected.amount],
                  ["CATEGORY", selected.category.toUpperCase()],
                  ["AGENT", selected.agent],
                  ["COUNTERPARTY", selected.counterparty],
                  ["BLOCK HEIGHT", selected.block],
                  ["GAS USED", selected.gas],
                  ["TX HASH", selected.tx],
                ].map(([label, value]) => <div key={label} className="grid grid-cols-[1fr_1.2fr] gap-3 py-3"><dt className="text-[#9b9289]">{label}</dt><dd className="break-words text-right text-[#655d56]">{value}</dd></div>)}
              </dl>
              <div className="border-t border-[#ded7d0] py-4"><p className="font-mono text-[9px] tracking-[.12em] text-[#9b9289]">RAW CALLDATA NOTE</p><p className="mt-2 text-[12px] text-[#655d56]">312 bytes · policy/v4.18 evaluation payload</p></div>
              <div className="flex flex-wrap gap-2 pb-5">
                <button onClick={() => action(`Arcscan opened for ${selected.tx}.`)} className="arc-pill arc-ghost rounded-full border border-[#ded7d0] px-3.5 py-2.5 text-[10px] font-semibold">View on Arcscan ↗</button>
                <button onClick={() => action(`Vendor flag created for ${selected.counterparty}.`)} className="rounded-full border border-[#ff3c00] px-3.5 py-2.5 text-[10px] font-semibold text-[#ff3c00] transition-colors duration-[220ms] hover:bg-[#ff3c00] hover:text-[#faf6f1]">Flag vendor</button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {notice && <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 border border-[#292522] bg-[#292522] px-4 py-3 font-mono text-[10px] text-[#faf6f1] shadow-[0_12px_28px_rgba(41,37,34,.18)]">{notice}</div>}
    </Shell>
  );
}
