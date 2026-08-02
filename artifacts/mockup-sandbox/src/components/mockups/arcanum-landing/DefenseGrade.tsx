import { useEffect, useMemo, useState } from "react";

type Verdict = "ALLOWED" | "BLOCKED" | "ESCALATED";
type Entry = {
  time: string;
  agent: string;
  vendor: string;
  amount: string;
  address: string;
  policy: string;
  verdict: Verdict;
};

const entries: Entry[] = [
  { time: "14:32:08.114", agent: "procurement-bot", vendor: "AWS", amount: "$184.20", address: "0x3f…9a2c", policy: "P-014 / vendor allowlist", verdict: "ALLOWED" },
  { time: "14:31:56.802", agent: "procurement-bot", vendor: "OpenAI", amount: "$1,200.00", address: "0x3f…9a2c", policy: "P-014 / daily cap", verdict: "BLOCKED" },
  { time: "14:31:41.227", agent: "treasury-agent", vendor: "Anthropic", amount: "$500.00", address: "0x71…c04e", policy: "P-022 / human approval", verdict: "ESCALATED" },
  { time: "14:30:17.401", agent: "procurement-bot", vendor: "AWS", amount: "$74.80", address: "0x3f…9a2c", policy: "P-014 / per-tx cap", verdict: "ALLOWED" },
  { time: "14:28:09.992", agent: "research-agent", vendor: "OpenAI", amount: "$92.00", address: "0xb2…18df", policy: "P-009 / vendor allowlist", verdict: "ALLOWED" },
];

function Mark({ size = 22 }: { size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center border border-[#68727a] text-[10px] font-bold tracking-[-.06em]">A</span>;
}

function Arrow() {
  return <span aria-hidden="true" className="text-[#8e989f]">↗</span>;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone = verdict === "BLOCKED" ? "border-[#9b8c83] text-[#c1ada0]" : verdict === "ESCALATED" ? "border-[#9ca3a3] text-[#c8cecc]" : "border-[#71847e] text-[#adbbb5]";
  return <span className={`inline-flex items-center gap-2 border px-2 py-1 font-mono text-[9px] tracking-[.14em] ${tone}`}><i className="h-1 w-1 rounded-full bg-current" />{verdict}</span>;
}

function SectionLabel({ index, children }: { index: string; children: string }) {
  return <div className="mb-8 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.18em] text-[#788188]"><span>{index}</span><span className="h-px w-8 bg-[#424a50]" />{children}</div>;
}

function GovernedLedger() {
  const [filter, setFilter] = useState<"ALL" | Verdict>("ALL");
  const [pulse, setPulse] = useState(false);
  const visible = useMemo(() => filter === "ALL" ? entries : entries.filter((entry) => entry.verdict === filter), [filter]);
  const simulate = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 700);
  };
  return (
    <div className="border border-[#3d474e] bg-[#20272c] shadow-[0_24px_70px_rgba(0,0,0,.24)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3d474e] px-5 py-4">
        <div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full bg-[#a5b5af] ${pulse ? "animate-ping" : ""}`} /><span className="font-mono text-[10px] uppercase tracking-[.19em] text-[#b8c0c3]">Live governed ledger</span><span className="font-mono text-[9px] text-[#68737a]">STREAM / 01</span></div>
        <button onClick={simulate} className="font-mono text-[9px] uppercase tracking-[.16em] text-[#8f9ba1] transition-colors hover:text-[#d0d5d5]">Simulate transaction <Arrow /></button>
      </div>
      <div className="grid grid-cols-2 border-b border-[#3d474e] sm:grid-cols-4">
        {[["$2.4M", "governed"], ["42ms", "median check"], ["0", "unreviewed"], ["99.98%", "ledger uptime"]].map(([value, label]) => <div key={label} className="border-r border-[#3d474e] px-5 py-5 last:border-r-0"><div className="font-mono text-[18px] tabular-nums text-[#e0e3e1]">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[.14em] text-[#788188]">{label}</div></div>)}
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#3d474e] px-4 py-3">
        {(["ALL", "ALLOWED", "BLOCKED", "ESCALATED"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 font-mono text-[9px] tracking-[.14em] transition-colors ${filter === item ? "bg-[#39434a] text-[#dce1df]" : "text-[#778289] hover:text-[#c1c8c8]"}`}>{item}</button>)}
      </div>
      <div className="divide-y divide-[#343e44]">
        {visible.map((entry, index) => <div key={`${entry.time}-${entry.verdict}`} className={`grid gap-3 px-5 py-4 transition-colors hover:bg-[#252e33] sm:grid-cols-[1.1fr_.9fr_.7fr_1fr_auto] ${index === 1 && pulse ? "bg-[#303338]" : ""}`}>
          <div><div className="font-mono text-[10px] tabular-nums text-[#b8c0c3]">{entry.time}</div><div className="mt-1 text-[11px] text-[#818c92]">{entry.agent}</div></div>
          <div className="text-[12px] text-[#d0d5d4]">{entry.vendor}<div className="mt-1 font-mono text-[9px] text-[#69757b]">{entry.address}</div></div>
          <div className="font-mono text-[12px] tabular-nums text-[#d0d5d4]">{entry.amount}</div>
          <div className="font-mono text-[9px] leading-4 text-[#7f898f]">{entry.policy}</div>
          <div className="sm:justify-self-end"><VerdictBadge verdict={entry.verdict} /></div>
        </div>)}
      </div>
      <div className="border-t border-[#3d474e] px-5 py-3 font-mono text-[9px] uppercase tracking-[.12em] text-[#667178]">All events cryptographically signed · Arc mainnet · block 18,402,771</div>
    </div>
  );
}

function RuleRow({ number, title, copy, value }: { number: string; title: string; copy: string; value: string }) {
  return <div className="grid gap-5 border-t border-[#c9c9c3] py-7 sm:grid-cols-[60px_1fr_180px]"><div className="font-mono text-[10px] text-[#8a918f]">{number}</div><div><h3 className="text-[17px] tracking-[-.02em] text-[#293137]">{title}</h3><p className="mt-2 max-w-md text-[13px] leading-6 text-[#737b7c]">{copy}</p></div><div className="font-mono text-[11px] tabular-nums text-[#4c575b] sm:text-right">{value}</div></div>;
}

export function DefenseGrade() {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const reveal = () => document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * .88) el.style.opacity = "1";
    });
    reveal(); window.addEventListener("scroll", reveal, { passive: true }); return () => window.removeEventListener("scroll", reveal);
  }, []);
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#d8d9d4] text-[#273036] selection:bg-[#59646a] selection:text-[#e7e9e5]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'); [data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .8s ease-out,transform .8s ease-out} @media(max-width:640px){[data-reveal]{opacity:1;transform:none}}
      /* DefenseGrade field tint: moss and bone replace the neutral wireframe without changing its structure. */
      [class*="bg-[#20272c]"]{background-color:#1c3025!important}
      [class*="bg-[#d8d9d4]"]{background-color:#d7cfb3!important}
      [class*="bg-[#cfd1cc]"]{background-color:#c4c8a8!important}
      [class*="bg-[#252e33]"]{background-color:#263d2e!important}
      [class*="bg-[#303338]"]{background-color:#35412d!important}
      [class*="bg-[#39434a]"]{background-color:#3a513a!important}
      [class*="text-[#d8dcda]"]{color:#e1d8bb!important}
      [class*="text-[#d9ddda]"]{color:#e4ddc3!important}
      [class*="text-[#dce1df]"]{color:#e7dfc5!important}
      [class*="text-[#e0e3e1]"]{color:#eee5c9!important}
      [class*="text-[#e7e9e5]"]{color:#eee6ca!important}
      [class*="text-[#273036]"],[class*="text-[#293137]"]{color:#263b2c!important}
      [class*="text-[#394247]"]{color:#344936!important}
      [class*="text-[#626b6c]"],[class*="text-[#737b7c]"],[class*="text-[#747c7c]"]{color:#59684f!important}
      [class*="text-[#788188]"],[class*="text-[#778289]"],[class*="text-[#78848a]"],[class*="text-[#7c888e]"]{color:#91a080!important}
      [class*="text-[#8a918f]"],[class*="text-[#7d8584]"],[class*="text-[#7f8786]"]{color:#778565!important}
      [class*="text-[#9b8c83]"],[class*="text-[#c1ada0]"]{color:#c5a66b!important}
      [class*="border-[#3b454b]"],[class*="border-[#3d474e]"],[class*="border-[#424a50]"],[class*="border-[#4a555b]"]{border-color:#415d43!important}
      [class*="border-[#c8c9c3]"],[class*="border-[#c9c9c3]"]{border-color:#aeb58d!important}
      [class*="border-[#71847e]"]{border-color:#718c69!important}
      [class*="bg-[#a5b5af]"]{background-color:#a3b37c!important}
      `}</style>
      <section className="bg-[#20272c] text-[#d8dcda]">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between border-b border-[#3b454b] px-6 py-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3 text-[13px] font-semibold tracking-[.28em] transition-opacity hover:opacity-70"><Mark /> ARCANUM</a>
          <div className="hidden items-center gap-8 font-mono text-[10px] uppercase tracking-[.16em] text-[#8e999f] md:flex"><a href="#protocol" className="transition-colors hover:text-[#dce1df]">Protocol</a><a href="#ledger" className="transition-colors hover:text-[#dce1df]">Ledger</a><a href="#controls" className="transition-colors hover:text-[#dce1df]">Controls</a><a href="#company" className="transition-colors hover:text-[#dce1df]">Company</a></div>
          <a href="#contact" className="hidden border border-[#69747a] px-4 py-2 font-mono text-[10px] uppercase tracking-[.13em] transition-colors hover:bg-[#d8dcda] hover:text-[#20272c] sm:block">Request access <Arrow /></a>
          <button aria-label="Open menu" onClick={() => setMenu(!menu)} className="border border-[#556168] px-3 py-2 font-mono text-[10px] md:hidden">MENU</button>
        </nav>
        {menu && <div className="border-b border-[#3b454b] px-6 py-4 font-mono text-[10px] uppercase tracking-[.16em] text-[#aab3b4] md:hidden"><a className="mr-5" href="#protocol">Protocol</a><a className="mr-5" href="#ledger">Ledger</a><a href="#contact">Access</a></div>}
        <div id="top" className="mx-auto grid max-w-[1240px] gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:pb-32 lg:pt-28">
          <div data-reveal><div className="mb-9 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[.2em] text-[#859197]"><span className="h-px w-8 bg-[#718087]" />MISSION REPORT / ARC-01</div><h1 className="max-w-[700px] text-[clamp(3.3rem,7vw,6.8rem)] font-medium leading-[.92] tracking-[-.075em]">Every dollar.<br /><span className="text-[#929c9e]">Under command.</span></h1><p className="mt-9 max-w-[470px] text-[16px] leading-7 text-[#9da7aa]">ARCanum is the non-custodial governance layer for autonomous AI-agent wallets on Arc. Policy decides before money moves.</p><div className="mt-10 flex flex-wrap items-center gap-5"><a href="#contact" className="bg-[#d8dcda] px-5 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#20272c] transition-colors hover:bg-[#bfc7c4]">Deploy your control plane <Arrow /></a><span className="font-mono text-[10px] text-[#7c888e]">NO CUSTODY · NO GUESSWORK</span></div></div>
          <div data-reveal className="relative border-l border-[#4a555b] pl-7 pt-2 lg:mt-12"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-[#77848a]">OPERATING PICTURE / 08.24.24</div><div className="mt-12 grid grid-cols-2 gap-y-10"><div><div className="font-mono text-[31px] tabular-nums text-[#d9ddda]">$2.4M</div><div className="mt-2 text-[10px] uppercase tracking-[.14em] text-[#78848a]">Volume governed</div></div><div><div className="font-mono text-[31px] tabular-nums text-[#d9ddda]">42ms</div><div className="mt-2 text-[10px] uppercase tracking-[.14em] text-[#78848a]">Policy decision</div></div><div><div className="font-mono text-[31px] tabular-nums text-[#d9ddda]">18,402</div><div className="mt-2 text-[10px] uppercase tracking-[.14em] text-[#78848a]">Transactions cleared</div></div><div><div className="font-mono text-[31px] tabular-nums text-[#d9ddda]">0</div><div className="mt-2 text-[10px] uppercase tracking-[.14em] text-[#78848a]">Unauthorized spend</div></div></div><div className="mt-14 border-t border-[#4a555b] pt-4 font-mono text-[9px] text-[#748087]">LAT 37.7749° N / LONG 122.4194° W<br />SYSTEM STATUS: OPERATIONAL</div></div>
        </div>
      </section>

      <section id="protocol" className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32"><SectionLabel index="01" children="The protocol" /><div data-reveal className="grid gap-12 lg:grid-cols-[.78fr_1.22fr]"><h2 className="max-w-[430px] text-[clamp(2.5rem,5vw,5rem)] leading-[.94] tracking-[-.065em]">The wallet is<br />not the control.</h2><div><p className="max-w-[540px] text-[18px] leading-8 text-[#626b6c]">Agents act at machine speed. ARCANUM makes every instruction legible, bounded, and answerable to a human.</p><div className="mt-14 grid gap-8 sm:grid-cols-3"><div><span className="font-mono text-[10px] text-[#8a918f]">01 / CHECK</span><h3 className="mt-5 text-[19px]">Policy check</h3><p className="mt-3 text-[13px] leading-6 text-[#747c7c]">Inspect agent, vendor, amount, time, and intent before signing.</p></div><div><span className="font-mono text-[10px] text-[#8a918f]">02 / DECIDE</span><h3 className="mt-5 text-[19px]">Allow or block</h3><p className="mt-3 text-[13px] leading-6 text-[#747c7c]">Execute within bounds. Block out-of-policy transactions automatically.</p></div><div><span className="font-mono text-[10px] text-[#8a918f]">03 / ESCALATE</span><h3 className="mt-5 text-[19px]">Ask a human</h3><p className="mt-3 text-[13px] leading-6 text-[#747c7c]">Route exceptions to the right approver with full context attached.</p></div></div></div></div></section>

      <section id="ledger" className="bg-[#20272c] px-6 py-24 text-[#d8dcda] lg:px-10 lg:py-32"><div className="mx-auto max-w-[1240px]"><SectionLabel index="02" children="Proof of control" /><div data-reveal className="mb-12 flex flex-wrap items-end justify-between gap-7"><h2 className="max-w-[620px] text-[clamp(2.6rem,5vw,5rem)] leading-[.94] tracking-[-.065em]">A ledger that<br /><span className="text-[#909b9e]">shows its work.</span></h2><p className="max-w-[290px] text-[13px] leading-6 text-[#869196]">Not a dashboard of promises. A live record of decisions, signed at the edge.</p></div><GovernedLedger /></div></section>

      <section id="controls" className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32"><SectionLabel index="03" children="Rules of engagement" /><div data-reveal className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]"><h2 className="max-w-[390px] text-[clamp(2.5rem,4vw,4.2rem)] leading-[.95] tracking-[-.06em]">Your policy.<br />Enforced in<br />real time.</h2><div><RuleRow number="P-014" title="Procurement operations" copy="Approved vendors for procurement-bot. Anything else stops at the boundary." value="$500 / TX · $5,000 / DAY" /><RuleRow number="P-022" title="Human approval gate" copy="Require a named operator for payments above the threshold or outside office hours." value="> $500 · 2 APPROVERS" /><RuleRow number="P-009" title="Anomaly response" copy="Compare new behavior against the agent's operating history. Freeze, notify, document." value="7 SIGNALS · 42ms" /></div></div></section>

      <section id="company" className="border-y border-[#c8c9c3] bg-[#cfd1cc] px-6 py-20 lg:px-10"><div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1fr_2fr]"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#7d8584]">Operator testimony / 001</div><blockquote data-reveal className="max-w-[790px] text-[clamp(1.8rem,3.2vw,3.2rem)] leading-[1.08] tracking-[-.045em] text-[#394247]">“We gave the agent a budget. ARCANUM gave us a reason to trust it.”<footer className="mt-7 font-mono text-[10px] uppercase tracking-[.14em] text-[#7f8786]">— Maya Chen, VP Finance · Meridian Systems</footer></blockquote></div></section>

      <section id="contact" className="bg-[#20272c] px-6 py-24 text-[#d8dcda] lg:px-10 lg:py-32"><div data-reveal className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-12 md:flex-row md:items-end"><div><div className="mb-8 font-mono text-[10px] uppercase tracking-[.18em] text-[#849095]">04 / Establish command</div><h2 className="max-w-[720px] text-[clamp(3rem,7vw,7rem)] leading-[.88] tracking-[-.075em]">Put policy<br /><span className="text-[#909b9e]">in the loop.</span></h2></div><a href="mailto:ops@thearcanum.in" className="border border-[#748087] px-6 py-4 text-[11px] font-semibold uppercase tracking-[.14em] transition-colors hover:bg-[#d8dcda] hover:text-[#20272c]">Talk to an operator <Arrow /></a></div></section>
      <footer className="bg-[#20272c] px-6 pb-8 text-[#77838a] lg:px-10"><div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 border-t border-[#3b454b] pt-6 font-mono text-[9px] uppercase tracking-[.14em] sm:flex-row"><span className="flex items-center gap-3"><Mark size={17} /> ARCANUM / THEARCanum.IN</span><span>NON-CUSTODIAL GOVERNANCE FOR ARC</span><span>© 2024 ARCANUM LABS</span></div></footer>
    </main>
  );
}