import { useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./_shared/Header";

type Decision = { time: string; action: string; vendor: string; amount: string; status: "APPROVED" | "REJECTED" | "ESCALATED" };

const decisions: Decision[] = [
  { time: "09:41:08", action: "Invoice settlement", vendor: "AWS", amount: "$184.20", status: "APPROVED" },
  { time: "09:31:05", action: "Reserved capacity", vendor: "AWS", amount: "$316.40", status: "APPROVED" },
  { time: "08:36:40", action: "Bedrock capacity", vendor: "AWS Bedrock", amount: "$2,100.00", status: "ESCALATED" },
  { time: "yesterday", action: "Token replenishment", vendor: "OpenAI", amount: "$740.00", status: "REJECTED" },
];

function StatusPill({ status }: { status: "ACTIVE" | "FROZEN" | "APPROVED" | "REJECTED" | "ESCALATED" }) {
  const styles = {
    ACTIVE: "bg-[#e7f0e5] text-[#3f653e]", FROZEN: "bg-[#292522] text-[#faf6f1]",
    APPROVED: "bg-[#e7f0e5] text-[#3f653e]", REJECTED: "bg-[#ff3c00] text-[#faf6f1]",
    ESCALATED: "border border-[#ff3c00] text-[#ff3c00]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}>{status}</span>;
}

function Arrow() { return <span aria-hidden="true" className="ml-1 transition-transform duration-[220ms] group-hover:translate-x-1">→</span>; }
function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}><style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
    .font-mono{font-family:'DM Mono',monospace}.detail-in{animation:detailIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0)*75ms) both}@keyframes detailIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .warm-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms ease,color 220ms ease}.warm-pill:before{content:"";position:absolute;inset:0;z-index:-1;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}.warm-pill:hover{transform:translateY(-1px);box-shadow:0 10px 28px -8px rgba(255,60,0,.4)}.warm-pill:hover:before{transform:translateY(0)}.warm-ghost:before{background:#292522}.warm-ghost:hover{color:#faf6f1}
    .decision-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.decision-row:hover{transform:translateX(3px);background:#f5f0ea}
    .bar{height:5px;background:#e3dcd5}.bar span{display:block;height:100%;background:#292522;transform-origin:left;animation:barIn 700ms cubic-bezier(.16,1,.3,1) both}@keyframes barIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media(prefers-reduced-motion:reduce){.detail-in,.bar span{animation:none}.warm-pill,.warm-pill:before,.decision-row{transition:none}}
  `}</style><Header active="AGENTS" />{children}</main>;
}

export function AgentDetail() {
  const [frozen, setFrozen] = useState(false);
  const [notice, setNotice] = useState("");
  const toggleFreeze = () => {
    const next = !frozen;
    setFrozen(next);
    setNotice(next ? "Wallet frozen. New spend will be restrained." : "Wallet unfrozen. Policy remains active.");
    window.setTimeout(() => setNotice(""), 2600);
  };
  return <Shell><div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
    <div className="detail-in flex flex-col justify-between gap-7 border-b border-[#ded7d0] pb-9 md:flex-row md:items-end" style={{ "--i": 0 } as CSSProperties}>
      <div><button type="button" data-nav="AGENTS" className="font-mono text-[9px] uppercase tracking-[.16em] text-[#837a72] transition-colors hover:text-[#ff3c00]">← Agent register</button><p className="mt-6 font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">DOSSIER / GOVERNED WALLET</p><h1 className="mt-4 text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[.86] tracking-[-.085em]">procurement-bot</h1><p className="mt-5 max-w-[510px] text-[14px] leading-[1.45] text-[#776f68]">A governed procurement wallet with a narrow mandate: approved infrastructure, observable limits, no unreviewed drift.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={toggleFreeze} className="warm-pill warm-ghost rounded-full border border-[#ded7d0] px-4 py-2.5 text-[11px] font-semibold">{frozen ? "Unfreeze wallet" : "Freeze wallet"}</button><button type="button" data-nav="POLICY_EDITOR" className="warm-pill group rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-white">Edit policy<Arrow /></button></div>
    </div>
    <section className="grid border-b border-[#ded7d0] md:grid-cols-4">{[
      ["POSTURE", "94 / 100", "within doctrine"], ["TODAY'S SPEND", "$1,842.20", "of $5,000.00 cap"], ["TRANSACTIONS", "18", "12 approved · 4 rejected"], ["GOVERNANCE", frozen ? "FROZEN" : "ACTIVE", frozen ? "operator restraint" : "policy/v4.18"],
    ].map(([label, value, note], i) => <div key={label} className={`detail-in min-h-[130px] border-b border-[#ded7d0] py-6 md:border-b-0 ${i ? "md:border-l md:pl-6" : "md:pr-6"}`} style={{ "--i": i + 1 } as CSSProperties}><p className="font-mono text-[9px] uppercase tracking-[.15em] text-[#837a72]">{label}</p><p className={`mt-5 text-[27px] font-semibold tracking-[-.06em] tabular-nums ${label === "GOVERNANCE" && frozen ? "text-[#ff3c00]" : ""}`}>{value}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[.1em] text-[#9b9289]">{note}</p></div>)}</section>
    <section className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.8fr)]">
      <div className="detail-in" style={{ "--i": 3 } as CSSProperties}><div className="flex items-end justify-between border-b border-[#ded7d0] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#ff3c00]">BEHAVIOR / 30 DAYS</p><h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Spending behavior</h2></div><span className="font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]">USD · UTC</span></div>
        <div className="grid grid-cols-2 border-b border-[#ded7d0] py-6 sm:grid-cols-4">{[["30D TOTAL", "$8,492.60"],["AVG. TX", "$471.81"],["PEAK TX", "$2,100.00"],["RESTRAINTS", "07"]].map(([l,v])=><div key={l} className="mb-4 sm:mb-0"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[#9b9289]">{l}</p><p className="mt-2 font-mono text-[14px] tabular-nums">{v}</p></div>)}</div>
        <div className="flex h-[180px] items-end gap-2 border-b border-[#ded7d0] px-2 py-6">{[.34,.52,.42,.7,.58,.86,.48,.66,.73,.48,.9,.62,.78,.55,.68,.83,.57,.75,.64,.89].map((height,i)=><div key={i} className="group flex h-full flex-1 items-end"><span className={`w-full origin-bottom bg-[#292522] transition-transform duration-[420ms] group-hover:scale-y-110 ${i === 18 ? "bg-[#ff3c00]" : ""}`} style={{ height: `${height*100}%` }} /></div>)}</div><div className="flex justify-between pt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[#9b9289]"><span>19 MAY</span><span>18 JUN</span></div>
        <div className="mt-10 flex items-end justify-between border-b border-[#ded7d0] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#ff3c00]">DECISIONS / RECENT</p><h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Decision record</h2></div><button type="button" data-nav="LEDGER" className="group font-mono text-[9px] uppercase tracking-[.13em] text-[#655d56] hover:text-[#ff3c00]">Open ledger<Arrow /></button></div>
        <div>{decisions.map((row,i)=><div key={`${row.time}-${row.vendor}`} className="decision-row grid gap-2 border-b border-[#e3dcd5] px-3 py-4 md:grid-cols-[.8fr_1.2fr_1.1fr_.8fr_auto] md:items-center" style={{ "--i": i } as CSSProperties}><span className="font-mono text-[10px] text-[#837a72]">{row.time}</span><span className="text-[12px] font-medium">{row.action}</span><span className="text-[12px] text-[#655d56]">{row.vendor}</span><span className="font-mono text-[11px]">{row.amount}</span><StatusPill status={row.status} /></div>)}</div>
      </div>
      <aside className="detail-in bg-[#f5f0ea] p-6 md:p-7" style={{ "--i": 4 } as CSSProperties}><div className="flex items-start justify-between border-b border-[#ded7d0] pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#ff3c00]">IDENTITY / CONTROL</p><h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Wallet file</h2></div><StatusPill status={frozen ? "FROZEN" : "ACTIVE"} /></div>
        <dl className="divide-y divide-[#ded7d0] font-mono text-[10px]">{[["WALLET", "0x3f…9a2c"],["NETWORK", "ARC TESTNET"],["ASSET", "USDC"],["POLICY", "procurement/v4.18"],["DEPLOYED", "2025-05-08 · 14:22 UTC"],["OWNER", "HELIX-DAO / TREASURY"]].map(([l,v])=><div key={l} className="grid grid-cols-[.9fr_1.1fr] gap-3 py-3"><dt className="text-[#9b9289]">{l}</dt><dd className="text-right text-[#655d56]">{v}</dd></div>)}</dl>
        <div className="border-b border-[#ded7d0] py-6"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#837a72]">CAPACITY USED</p><div className="mt-4 flex justify-between font-mono text-[11px]"><span>$1,842.20</span><span className="text-[#9b9289]">$5,000.00</span></div><div className="bar mt-3"><span style={{ transform: "scaleX(.368)" }} /></div></div>
        <div className="border-b border-[#ded7d0] py-6"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#837a72]">AUTHORIZED VENDORS</p><div className="mt-3 flex flex-wrap gap-2">{["AWS","AWS Bedrock","OpenAI"].map(v=><span key={v} className="rounded-full border border-[#cfc5bc] px-2.5 py-1.5 font-mono text-[9px] text-[#655d56]">{v}</span>)}</div></div>
        <div className="flex flex-wrap gap-2 pt-5"><button type="button" data-nav="BADGE" className="warm-pill warm-ghost rounded-full border border-[#ded7d0] px-3.5 py-2.5 text-[10px] font-semibold">Public badge</button><button type="button" data-nav="EXPLORER" className="warm-pill warm-ghost rounded-full border border-[#ded7d0] px-3.5 py-2.5 text-[10px] font-semibold">Public explorer ↗</button></div>
      </aside>
    </section>
    <footer className="mt-14 flex justify-between border-t border-[#ded7d0] pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]"><span>policy/v4.18 · caps $500 / tx</span><span>Last sync 09:43:02 UTC</span></footer>
    {notice && <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 bg-[#292522] px-4 py-3 font-mono text-[10px] text-[#faf6f1]">{notice}</div>}
  </div></Shell>;
}

export default AgentDetail;