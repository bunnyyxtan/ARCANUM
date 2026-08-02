import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

type QueueStatus = "PENDING" | "APPROVED" | "REJECTED";

type Escalation = {
  id: string;
  agent: string;
  amount: string;
  vendor: string;
  reason: string;
  created: string;
  expiry: string;
  expiresIn: string;
  status: QueueStatus;
  signedBy?: string;
  signedAt?: string;
};

const initialQueue: Escalation[] = [
  { id: "ESC-042", agent: "research-bot", amount: "$96.20", vendor: "AWS Bedrock", reason: "amount exceeds per-tx cap", created: "09:36:19 UTC", expiry: "18 Jun 2025 · 10:06 UTC", expiresIn: "00:18:42", status: "PENDING", signedBy: "Mara Chen", signedAt: "09:41 UTC" },
  { id: "ESC-041", agent: "growth-bot", amount: "$2,100.00", vendor: "Anthropic", reason: "unusual spend pattern for this wallet", created: "08:36:40 UTC", expiry: "18 Jun 2025 · 11:36 UTC", expiresIn: "01:48:16", status: "PENDING", signedBy: "Owen Park", signedAt: "08:48 UTC" },
  { id: "ESC-040", agent: "support-agent", amount: "$740.00", vendor: "OpenAI", reason: "amount exceeds per-tx cap", created: "17 Jun 2025 · 16:22 UTC", expiry: "17 Jun 2025 · 18:22 UTC", expiresIn: "EXPIRED", status: "APPROVED", signedBy: "Mara Chen", signedAt: "17 Jun · 16:39 UTC" },
];

const statusStyles: Record<QueueStatus, string> = {
  PENDING: "border border-[#ff3c00] text-[#ff3c00]",
  APPROVED: "bg-[#e7f0e5] text-[#3f653e]",
  REJECTED: "bg-[#ff3c00] text-[#faf6f1]",
};

function StatusPill({ status }: { status: QueueStatus }) {
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${statusStyles[status]}`}>{status}</span>;
}

function Shell({ children, onAction }: { children: ReactNode; onAction: () => void }) {
  const links = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];
  return (
    <div className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .arc-escalations{font-family:'Inter Tight',sans-serif}.arc-escalations .font-mono{font-family:'DM Mono',monospace}
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(255,60,0,.42),0 2px 6px rgba(41,37,34,.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:#292522}.arc-ghost:hover{color:#faf6f1;border-color:#292522;box-shadow:0 10px 28px -10px rgba(41,37,34,.35)}
        .arc-card{animation:cardIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--card-i) * 110ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}.arc-card:hover{transform:translateY(-3px);box-shadow:10px 14px 0 #eee7df}
        .arc-card-near{border-left:2px solid #ff3c00}.arc-card-resolved{opacity:.76}.arc-stamp{transform:rotate(-7deg);border:1px solid #3f653e;color:#3f653e}
        @keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.arc-pill,.arc-card{animation:none!important;transition:none!important}.arc-card:hover,.arc-pill:hover{transform:none}}
      `}</style>
      <header className="flex min-h-[68px] items-center justify-between border-b border-[#ded7d0] px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-7">
          <button onClick={onAction} className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></button>
          <nav className="hidden items-center gap-5 lg:flex">
            {links.map((link) => <a key={link} href={`#${link.toLowerCase()}`} className={`relative py-6 text-[12px] font-medium text-[#655d56] transition-colors hover:text-[#292522] ${link === "ESCALATIONS" ? "text-[#292522] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#ff3c00]" : ""}`}>{link}</a>)}
          </nav>
          <span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#9b9289] lg:hidden">QUEUE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[9px] tracking-[.14em] text-[#9b9289] sm:inline">ARC TESTNET</span>
          <button onClick={onAction} className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-2 py-1.5 transition-transform duration-[220ms] hover:-translate-y-0.5 sm:px-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span>
            <span className="hidden text-[12px] font-medium sm:inline">HELIX-DAO</span>
          </button>
        </div>
      </header>
      <div className="arc-escalations">{children}</div>
    </div>
  );
}

export function Escalations() {
  const [queue, setQueue] = useState(initialQueue);
  const [notice, setNotice] = useState("");
  const pending = useMemo(() => queue.filter((item) => item.status === "PENDING"), [queue]);
  const act = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const updateStatus = (id: string, status: QueueStatus) => {
    const record = queue.find((item) => item.id === id);
    setQueue((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    act(`${id} marked ${status.toLowerCase()}. Ledger record updated.`);
    if (record?.status === "PENDING") window.setTimeout(() => setNotice(""), 2600);
  };
  const copyPortal = (id: string) => {
    const link = `https://portal.arcanum.local/approve/${id}`;
    if (navigator.clipboard) void navigator.clipboard.writeText(link);
    act("Approver portal link copied.");
  };
  return (
    <Shell onAction={() => act(pending.length ? `Next review: ${pending[0].id}.` : "No pending escalations.")}>
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col justify-between gap-7 border-b border-[#ded7d0] pb-9 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">QUORUM / HUMAN CONTROL</p>
            <h1 className="mt-4 text-[clamp(2.7rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.075em]">Escalations</h1>
            <p className="mt-4 max-w-[560px] text-[14px] leading-[1.45] text-[#776f68]">When an agent reaches the edge of its doctrine, a human gets the final word.</p>
          </div>
          <button onClick={() => act(pending.length ? `Reviewing ${pending[0].id}, the oldest open request.` : "The queue is clear.")} className="arc-pill group w-fit rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-[#faf6f1]">Review next <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">↗</span></button>
        </div>

        <section className="grid grid-cols-3 border-b border-[#ded7d0]">
          <div className="py-6"><p className="font-mono text-[9px] tracking-[.15em] text-[#9b9289]">PENDING</p><p className="mt-3 text-[34px] font-medium tracking-[-.07em] text-[#ff3c00]">{pending.length}</p></div>
          <div className="border-l border-[#ded7d0] py-6 pl-5 md:pl-7"><p className="font-mono text-[9px] tracking-[.15em] text-[#9b9289]">APPROVED / 7D</p><p className="mt-3 text-[34px] font-medium tracking-[-.07em]">11</p></div>
          <div className="border-l border-[#ded7d0] py-6 pl-5 md:pl-7"><p className="font-mono text-[9px] tracking-[.15em] text-[#9b9289]">EXPIRED</p><p className="mt-3 text-[34px] font-medium tracking-[-.07em]">1</p></div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {queue.map((item, index) => {
            const isPending = item.status === "PENDING";
            const isNear = item.id === "ESC-042";
            return <article key={item.id} style={{ "--card-i": index } as CSSProperties} className={`arc-card relative border border-[#cfc5bc] bg-[#fbf8f4] p-5 md:p-7 ${isNear ? "arc-card-near" : ""} ${!isPending ? "arc-card-resolved" : ""} ${index === 2 ? "lg:col-span-2 lg:max-w-[calc(50%-12px)]" : ""}`}>
              <div className="flex items-start justify-between gap-4 border-b border-[#ded7d0] pb-5">
                <div><p className="font-mono text-[9px] tracking-[.16em] text-[#ff3c00]">{item.id} · HUMAN REVIEW</p><h2 className="mt-3 text-[21px] font-medium tracking-[-.045em]">{item.agent}</h2></div>
                <div className="flex items-center gap-3"><StatusPill status={item.status} />{!isPending && <span className="arc-stamp px-2 py-1 font-mono text-[8px] tracking-[.12em]">RECORDED</span>}</div>
              </div>
              <div className="grid gap-7 py-6 md:grid-cols-[1fr_1.1fr]">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]">REQUEST</p>
                  <p className="mt-3 text-[27px] font-medium tracking-[-.065em]">{item.amount} <span className="text-[#9b9289]">→</span> {item.vendor}</p>
                  <p className="mt-4 text-[13px] text-[#655d56]">Reason: <span className="font-medium text-[#292522]">{item.reason}</span></p>
                </div>
                <div className="border-l border-[#ded7d0] pl-5 md:pl-7">
                  <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[#9b9289]">QUORUM / 2 SIGNATURES</p>
                  <div className="mt-4 flex gap-2"><div className="flex min-h-[62px] flex-1 flex-col justify-between border border-[#bdb4aa] bg-[#f5f0ea] p-3"><span className="font-mono text-[9px] text-[#3f653e]">SIGNED</span><span className="text-[11px] font-medium">{item.signedBy}</span><span className="font-mono text-[8px] text-[#9b9289]">{item.signedAt}</span></div><div className={`flex min-h-[62px] flex-1 flex-col justify-between border border-dashed p-3 ${isPending ? "border-[#ff3c00]" : "border-[#ded7d0]"}`}><span className="font-mono text-[9px] text-[#9b9289]">{isPending ? "AWAITING" : "CLOSED"}</span><span className="text-[11px] text-[#776f68]">{isPending ? "operator signature" : "queue closed"}</span><span className="font-mono text-[8px] text-[#9b9289]">{isPending ? "—" : "recorded"}</span></div></div>
                  <div className="mt-5 flex items-baseline justify-between border-t border-[#ded7d0] pt-4"><span className="font-mono text-[9px] tracking-[.12em] text-[#9b9289]">EXPIRY</span><span className={`font-mono text-[12px] tabular-nums ${isNear ? "text-[#ff3c00]" : "text-[#655d56]"}`}>{item.expiresIn}</span></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#ded7d0] pt-5">
                {isPending ? <>
                  <button onClick={() => updateStatus(item.id, "APPROVED")} className="arc-pill rounded-full bg-[#ff3c00] px-4 py-2.5 text-[10px] font-semibold text-[#faf6f1]">Approve</button>
                  <button onClick={() => updateStatus(item.id, "REJECTED")} className="arc-pill arc-ghost rounded-full border border-[#ded7d0] px-4 py-2.5 text-[10px] font-semibold">Reject</button>
                </> : <span className="font-mono text-[9px] tracking-[.12em] text-[#3f653e]">FINAL DECISION COMMITTED TO LEDGER</span>}
                <button onClick={() => copyPortal(item.id)} className="ml-auto rounded-full border border-[#ded7d0] px-4 py-2.5 font-mono text-[9px] tracking-[.08em] text-[#776f68] transition-colors duration-[220ms] hover:border-[#292522] hover:text-[#292522]">Copy approver portal link</button>
              </div>
              <div className="mt-5 font-mono text-[9px] text-[#9b9289]">CREATED {item.created} <span className="mx-2 text-[#ded7d0]">·</span> EXPIRES {item.expiry}</div>
            </article>;
          })}
        </div>
      </main>
      {notice && <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 border border-[#292522] bg-[#292522] px-4 py-3 font-mono text-[10px] text-[#faf6f1] shadow-[0_12px_28px_rgba(41,37,34,.18)]">{notice}</div>}
    </Shell>
  );
}
