import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const orange = "var(--wl-signal)";

import metamaskLogo from "./assets/metamask.png";
import rabbyLogo from "./assets/rabby.png";
import coinbaseLogo from "./assets/coinbase.png";

type WalletOption = { name: string; hint: string; logo: string; tag?: string };
const WALLET_OPTIONS: WalletOption[] = [
  { name: "MetaMask", hint: "Browser extension", logo: metamaskLogo, tag: "INSTALLED" },
  { name: "Rabby", hint: "Browser extension", logo: rabbyLogo },
  { name: "Coinbase Wallet", hint: "Extension · mobile", logo: coinbaseLogo },
];

function Arrow() {
  return <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">↗</span>;
}

function GitHubMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className={`inline-block shrink-0 ${className}`}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function BookIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function MagneticAnchor({ children, className = "", href, rel, target }: { children: ReactNode; className?: string; href: string; rel?: string; target?: string }) {
  const onMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-4, Math.min(4, (event.clientX - (rect.left + rect.width / 2)) * 0.08));
    const y = Math.max(-4, Math.min(4, (event.clientY - (rect.top + rect.height / 2)) * 0.08));
    event.currentTarget.style.setProperty("--mag-x", `${x}px`);
    event.currentTarget.style.setProperty("--mag-y", `${y}px`);
  };
  const reset = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty("--mag-x", "0px");
    event.currentTarget.style.setProperty("--mag-y", "0px");
  };
  return <a href={href} rel={rel} target={target} onPointerMove={onMove} onPointerLeave={reset} className={`warm-interaction ${className}`}>{children}</a>;
}

function StatusPill({ status }: { status: "ALLOWED" | "BLOCKED" | "ESCALATED" }) {
  const styles = {
    ALLOWED: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    BLOCKED: "bg-[var(--wl-signal)] text-white",
    ESCALATED: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  };
  return <span className={`warm-status warm-status-${status.toLowerCase()} rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}><span>{status}</span>{status === "ESCALATED" && <span className="approval-chip">HUMAN</span>}</span>;
}

function LedgerRows({ dark = false }: { dark?: boolean }) {
  const rows = [
    { agent: "procurement-bot", vendor: "AWS", amount: "$184.20", detail: "0x3f…9a2c", status: "ALLOWED" as const, time: "09:41:08" },
    { agent: "support-agent", vendor: "OpenAI", amount: "$740.00", detail: "0x71…4be1", status: "BLOCKED" as const, time: "09:41:12" },
    { agent: "growth-bot", vendor: "Anthropic", amount: "$2,100.00", detail: "0xa8…c912", status: "ESCALATED" as const, time: "09:41:16" },
    { agent: "procurement-bot", vendor: "AWS", amount: "$316.40", detail: "0x3f…9a2c", status: "ALLOWED" as const, time: "09:41:19" },
  ];
  const [visible, setVisible] = useState(2);
  useEffect(() => {
    const id = window.setInterval(() => setVisible((v) => (v >= rows.length ? 1 : v + 1)), 2500);
    return () => window.clearInterval(id);
  }, []);
  const line = dark ? "border-[var(--wl-strong2)]" : "border-[var(--wl-line)]";
  const quiet = dark ? "text-[var(--wl-dim2)]" : "text-[var(--wl-mute)]";
  return (
    <div className={`overflow-hidden border ${line} ${dark ? "bg-[var(--wl-ink-soft)]" : "bg-[var(--wl-bg-raised)]"}`}>
      <div className={`flex items-center justify-between border-b px-5 py-4 ${line}`}>
        <span className={`font-mono text-[10px] uppercase tracking-[.18em] ${quiet}`}>Live governed ledger</span>
        <span className={`font-mono text-[10px] ${quiet}`}>ARC / USDC</span>
      </div>
      <div className={`grid grid-cols-[1.3fr_1fr_.9fr_1fr_auto] gap-3 border-b px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] ${line} ${quiet}`}><span>Agent</span><span>Vendor</span><span>Amount</span><span>Wallet</span><span>Verdict</span></div>
      <div className={`divide-y ${dark ? "divide-[var(--wl-strong4)]" : "divide-[var(--wl-line-faint)]"}`}>
        {rows.map((r, i) => <div key={r.time} style={{ "--row-i": i } as CSSProperties} className={`warm-ledger-row grid grid-cols-[1.3fr_1fr_.9fr_1fr_auto] items-center gap-3 px-5 py-4 ${i < visible ? "is-live" : "is-quiet"}`}>
          <div><div className={`text-[12px] font-medium ${dark ? "text-[var(--wl-bg-tint)]" : "text-[var(--wl-ink)]"}`}>{r.agent}</div><div className={`mt-1 font-mono text-[9px] ${quiet}`}>{r.time} UTC</div></div>
          <span className={`text-[12px] ${dark ? "text-[var(--wl-line-bolder)]" : "text-[var(--wl-strong)]"}`}>{r.vendor}</span><span className={`font-mono text-[12px] tabular-nums ${dark ? "text-[var(--wl-bg-tint)]" : "text-[var(--wl-ink)]"}`}>{r.amount}</span><span className={`font-mono text-[10px] ${quiet}`}>{r.detail}</span><StatusPill status={r.status} />
        </div>)}
      </div>
      <div className={`flex items-center justify-between border-t px-5 py-3 ${line}`}><span className={`font-mono text-[9px] ${quiet}`}>policy/v4.18 · 42ms median</span><span className="font-mono text-[9px] text-[var(--wl-green-soft)]">● streaming</span></div>
    </div>
  );
}

function Reveal({ children, className = "", kind = "default" }: { children: ReactNode; className?: string; kind?: "default" | "headline" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reveal = () => setVisible(true);
    const inInitialViewport = node.getBoundingClientRect().top < window.innerHeight * 1.12;
    setArmed(true);
    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer?.disconnect();
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
      observer.observe(node);
    } else {
      reveal();
    }
    if (inInitialViewport) reveal();
    // IO is the choreography trigger, but never allow a failed observer to strand content.
    const fallback = window.setTimeout(reveal, inInitialViewport ? 720 : 1320);
    return () => {
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  const index = className.includes("delay-1") ? 1 : className.includes("delay-2") ? 2 : className.includes("delay-3") ? 3 : 0;
  return <div ref={ref} data-reveal-kind={kind} className={`warm-reveal ${armed ? "warm-armed" : ""} ${visible ? "is-visible" : ""} ${className}`} style={{ "--i": index } as CSSProperties}>{children}</div>;
}

function SectionNumber({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState("00");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const target = Number(value);
      let current = 0;
      timer = window.setInterval(() => {
        current += 1;
        setShown(String(Math.min(current, target)).padStart(2, "0"));
        if (current >= target) window.clearInterval(timer);
      }, 75);
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [value]);
  return <span ref={ref} className={`warm-section-number tabular-nums ${className}`}>{shown}</span>;
}

export function WarmLedger() {
  const [connectOpen, setConnectOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [chosenWallet, setChosenWallet] = useState<WalletOption | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const [capitalGoverned, setCapitalGoverned] = useState(82.4);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ids = ["governed", "policies", "record", "contact"];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { threshold: [0.2, 0.45, 0.7], rootMargin: "-12% 0px -45% 0px" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const open = () => setConnectOpen(true);
    window.addEventListener("arcanum-connect", open);
    return () => window.removeEventListener("arcanum-connect", open);
  }, []);
  useEffect(() => {
    if (!connecting) return;
    const timer = window.setTimeout(() => {
      setConnecting(false);
      setConnectOpen(false);
      window.dispatchEvent(new CustomEvent("arcanum-connected"));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [connecting]);
  useEffect(() => {
    if (!connectOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setConnectOpen(false); setConnecting(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectOpen]);
  useEffect(() => {
    const capitalTimer = window.setInterval(() => setCapitalGoverned((value) => value >= 87.8 ? 82.4 : Number((value + 0.1).toFixed(1))), 1800);
    return () => {
      window.clearInterval(capitalTimer);
    };
  }, []);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        if (gridRef.current) gridRef.current.style.transform = `translate3d(0, ${Math.min(window.scrollY * 0.045, 28)}px, 0)`;
        frame = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const link = rail.querySelector<HTMLAnchorElement>(`a[href="#${activeSection}"]`);
    if (link) {
      rail.style.setProperty("--dot-y", `${link.offsetTop + (link.offsetHeight - 9) / 2}px`);
      rail.style.setProperty("--dot-o", "1");
    } else {
      rail.style.setProperty("--dot-o", "0");
    }
  }, [activeSection]);
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--wl-bg)] text-[var(--wl-ink)]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .warm-reveal{will-change:transform,opacity;}.warm-reveal.warm-armed:not(.is-visible){opacity:0;transform:translateY(16px);clip-path:inset(0 0 12% 0)}.warm-reveal.is-visible{animation:warmIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 120ms) both}.warm-reveal[data-reveal-kind="headline"].warm-armed:not(.is-visible){clip-path:inset(0 0 100% 0);transform:translateY(11px)}.warm-reveal[data-reveal-kind="headline"].is-visible{animation:warmHeadline 560ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 120ms) both}
        .delay-1{--i:1}.delay-2{--i:2}.delay-3{--i:3}
        @keyframes warmIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes warmHeadline{from{opacity:0;transform:translateY(11px);clip-path:inset(0 0 100% 0)}to{opacity:1;transform:translateY(0);clip-path:inset(0 0 0 0)}}
        @keyframes warmModalBackdrop{from{opacity:0}to{opacity:1}}@keyframes warmModalPanel{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes warmScan{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}
        .warm-modal-backdrop{animation:warmModalBackdrop 260ms ease both;backdrop-filter:blur(3px)}.warm-modal-panel{animation:warmModalPanel 380ms cubic-bezier(.16,1,.3,1) 60ms both}.warm-wallet-option{transition:border-color 200ms ease,background 200ms ease,transform 220ms cubic-bezier(.16,1,.3,1)}.warm-wallet-option:hover{border-color:var(--wl-ink);background:var(--wl-bg-tint2);transform:translateX(3px)}.warm-wallet-option:hover .warm-wallet-arrow{opacity:1;transform:translateX(0)}.warm-wallet-arrow{opacity:0;transform:translateX(-6px);transition:opacity 200ms ease,transform 220ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.warm-modal-backdrop,.warm-modal-panel{animation:none}}
        html{scroll-behavior:smooth;scroll-snap-type:y proximity}.font-mono{font-family:'DM Mono',monospace}section{scroll-margin-top:20px}
        .warm-interaction{--mag-x:0px;--mag-y:0px;transform:translate3d(var(--mag-x),var(--mag-y),0);transition:transform 220ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}.warm-interaction:active{transform:translate3d(var(--mag-x),calc(var(--mag-y) + 2px),0)}.warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(var(--wl-ink-rgb),.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}.warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}.warm-pill:hover{box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.45),0 2px 6px rgba(var(--wl-ink-rgb),.08)}.warm-pill:hover::before{transform:translateY(0)}.warm-pill-ghost::before{background:var(--wl-ink)}.warm-pill-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink);box-shadow:0 10px 28px -10px rgba(var(--wl-ink-rgb),.4)}@media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before{transition:none}}.warm-link{position:relative}.warm-link::after{position:absolute;bottom:-4px;left:0;width:100%;height:1px;background:${orange};content:"";transform:scaleX(0);transform-origin:right;transition:transform 220ms cubic-bezier(.16,1,.3,1)}.warm-link:hover::after{transform:scaleX(1);transform-origin:left}
        .warm-ledger-row{opacity:.3;transform:translateY(8px);transition:transform 220ms cubic-bezier(.16,1,.3,1),opacity 220ms ease}.warm-ledger-row.is-live{opacity:1;transform:translateY(0);animation:ledgerIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--row-i) * 120ms) both}.warm-ledger-row:hover{transform:translate3d(2px,-2px,0);box-shadow:inset 1px 0 0 ${orange}}.warm-ledger-row.is-quiet{opacity:.26}
        @keyframes ledgerIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.warm-status{display:inline-flex;align-items:center;gap:5px}.warm-status-blocked{animation:blockedSlam 420ms cubic-bezier(.16,1,.3,1) 240ms both}.warm-status-escalated{overflow:hidden}.approval-chip{display:inline-block;max-width:0;opacity:0;transform:translateX(-8px);transition:max-width 420ms cubic-bezier(.16,1,.3,1),transform 420ms cubic-bezier(.16,1,.3,1),opacity 220ms ease}.warm-ledger-row.is-live .approval-chip{max-width:45px;opacity:1;transform:translateX(0)}@keyframes blockedSlam{0%,100%{transform:translateX(0)}20%{transform:translateX(-1px)}40%{transform:translateX(1px)}60%{transform:translateX(-1px)}}
        .warm-section-number{display:inline-block;opacity:0;transform:translateY(12px);animation:numberIn 420ms cubic-bezier(.16,1,.3,1) 180ms both}.warm-reveal.is-visible .warm-section-number{opacity:1;transform:translateY(0)}@keyframes numberIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.warm-policy-doc{position:relative;transform:scale(.96);}.warm-reveal.is-visible .warm-policy-doc{animation:policyIn 560ms cubic-bezier(.16,1,.3,1) 120ms both}.warm-policy-doc::before{position:absolute;top:-1px;left:-1px;width:100%;height:2px;background:${orange};content:"";transform:scaleX(0);transform-origin:left}.warm-reveal.is-visible .warm-policy-doc::before{animation:lineDraw 420ms cubic-bezier(.16,1,.3,1) 220ms both}@keyframes policyIn{from{opacity:.8;transform:scale(.96)}to{opacity:1;transform:scale(1)}}@keyframes lineDraw{from{transform:scaleX(0)}to{transform:scaleX(1)}}.warm-period{display:inline-block;animation:periodPulse 420ms cubic-bezier(.16,1,.3,1) 420ms both}@keyframes periodPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
        .warm-active-dot{position:absolute;top:0;left:-5px;width:3px;height:9px;background:${orange};opacity:var(--dot-o,0);transform:translateY(var(--dot-y,0px));transition:transform 220ms cubic-bezier(.16,1,.3,1),opacity 220ms ease}.warm-nav-dot{position:relative;z-index:1;transition:color 220ms ease}.warm-nav-dot[data-active="true"]{color:${orange}}
        @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto;scroll-snap-type:none}.warm-reveal,.warm-reveal[data-reveal-kind="headline"],.warm-ledger-row,.warm-policy-doc,.warm-section-number{animation:none!important;transform:none!important;clip-path:none!important}.warm-reveal{opacity:1!important}.warm-reveal.is-visible,.warm-ledger-row.is-live,.warm-section-number{opacity:1}.warm-active-dot{transition:none}.warm-interaction{transition:none}}
      `}</style>

      <aside className="fixed bottom-0 left-0 top-0 z-20 hidden w-[86px] flex-col items-center justify-between border-r border-[var(--wl-line)] bg-[var(--wl-bg)] py-7 lg:flex">
        <MagneticAnchor href="#" className="text-[17px] font-bold tracking-[-.045em]" >ARCANUM<span className="text-[var(--wl-signal)]">.</span></MagneticAnchor>
        <div className="font-mono text-[9px] tracking-[.18em] text-[var(--wl-mute)]" style={{ writingMode: "vertical-rl" }}>ARC · GOVERNED</div>
        <div ref={railRef} className="relative flex flex-col items-center gap-6 font-mono text-[9px] text-[var(--wl-secondary)]"><span className="warm-active-dot" aria-hidden="true" /><MagneticAnchor href="#governed" className="warm-nav-dot" >01</MagneticAnchor><MagneticAnchor href="#policies" className="warm-nav-dot" >02</MagneticAnchor><MagneticAnchor href="#record" className="warm-nav-dot" >03</MagneticAnchor><MagneticAnchor href="#contact" className="warm-nav-dot" >04</MagneticAnchor></div>
      </aside>

      <div className="lg:pl-[86px]">
        <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-6 py-5 lg:hidden"><MagneticAnchor href="#" className="text-[18px] font-bold tracking-[-.05em]">ARCANUM<span className="text-[var(--wl-signal)]">.</span></MagneticAnchor><MagneticAnchor href="/dashboard" className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-2.5 text-[11px] font-semibold text-white">Launch Dashboard<Arrow /></MagneticAnchor></nav>
        <div className="hidden h-[68px] items-center justify-between border-b border-[var(--wl-line)] pl-10 pr-6 lg:flex"><span className="text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)]">Governed wallets for AI agents<span className="text-[var(--wl-mute)]"> · USDC on Arc</span></span><div className="flex items-center"><MagneticAnchor href="/docs" className="warm-link mx-4 inline-flex items-center gap-2 text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-ink)]"><BookIcon className="h-[15px] w-[15px] text-[var(--wl-mute)]" />Read Docs</MagneticAnchor><MagneticAnchor href="https://github.com/bunnyyxtan/ARCANUM" target="_blank" rel="noreferrer" className="warm-link mx-4 inline-flex items-center gap-2 text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-ink)]"><GitHubMark className="h-[15px] w-[15px] text-[var(--wl-mute)]" />GitHub</MagneticAnchor><span className="mx-4 h-5 w-px bg-[var(--wl-line)]" aria-hidden="true" /><button type="button" data-theme-toggle aria-label="Toggle dark mode" className="mx-1 flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]"><svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-moon h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" /></svg><svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-sun h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="10" cy="10" r="4" /><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16" /></svg></button><MagneticAnchor href="/dashboard" className="warm-pill group ml-2 rounded-full bg-[var(--wl-signal)] px-6 py-2.5 text-[13px] font-semibold tracking-[-.01em] text-white">Launch Dashboard<Arrow /></MagneticAnchor></div></div>

        <section id="ledger" className="relative min-h-[780px] border-b border-[var(--wl-line)] px-6 py-16 lg:px-10 lg:py-20">
          <div ref={gridRef} className="pointer-events-none absolute inset-0 opacity-60 will-change-transform" style={{ backgroundImage: "linear-gradient(var(--wl-line-faint2) 1px, transparent 1px), linear-gradient(90deg, var(--wl-line-faint2) 1px, transparent 1px)", backgroundSize: "72px 72px", maskImage: "linear-gradient(to bottom, black, transparent 80%)" }} />
          <div className="relative mx-auto max-w-[1400px]">
            <Reveal><p className="font-mono text-[10px] uppercase tracking-[.22em] text-[var(--wl-signal)]">Governed autonomy / Arc blockchain</p></Reveal>
            <Reveal kind="headline" className="delay-1"><h1 className="mt-8 max-w-[880px] text-[clamp(4.4rem,10.5vw,10.5rem)] font-semibold leading-[.8] tracking-[-.045em]">Autonomous<br /><span className="text-[var(--wl-dim)]">spend,</span> <em className="not-italic text-[var(--wl-ink)]">accounted.</em></h1></Reveal>
            <Reveal className="delay-2"><div className="mt-12"><p className="max-w-[420px] text-[16px] leading-[1.45] text-[var(--wl-body)]">Every dollar is checked, recorded, and visibly governed before it moves.</p><div className="mt-7 flex flex-wrap items-center gap-4"><MagneticAnchor href="/dashboard" className="warm-pill group rounded-full bg-[var(--wl-signal)] px-6 py-3.5 text-[12px] font-semibold text-white">Launch Dashboard<Arrow /></MagneticAnchor><MagneticAnchor href="/docs" className="warm-pill warm-pill-ghost inline-flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-6 py-3.5 text-[12px] font-semibold text-[var(--wl-ink)]"><BookIcon />Read Docs</MagneticAnchor><MagneticAnchor href="https://github.com/bunnyyxtan/ARCANUM" target="_blank" rel="noreferrer" className="warm-link inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"><GitHubMark />GitHub ↗</MagneticAnchor></div></div></Reveal>
            <div className="relative mt-20 lg:mt-24 lg:ml-[15%]"><Reveal className="delay-3"><LedgerRows /></Reveal><div className="absolute bottom-full right-0 mb-5 hidden w-[200px] border-l border-[var(--wl-signal)] pl-4 text-[10px] leading-[1.4] text-[var(--wl-signal)] lg:block">THE LIVE RECORD<br /><span className="text-[var(--wl-secondary)]">Not a demo. A transaction deciding itself in public.</span><strong className="mt-4 block font-mono text-[20px] font-medium tabular-nums text-[var(--wl-ink)]">${capitalGoverned.toFixed(1)}k</strong><span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">capital governed</span></div></div>
          </div>
        </section>

        <section id="governed" className="border-b border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-6 py-24 lg:px-10 lg:py-32"><div className="mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[240px_1fr]"><Reveal><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">01 / The control loop</p><SectionNumber value="1" className="mt-28 hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-strong)] lg:block" /></Reveal><Reveal className="delay-1"><h2 className="max-w-[700px] text-[clamp(3rem,6vw,6.2rem)] font-semibold leading-[.84] tracking-[-.045em]">A dollar earns<br />its way through.</h2><div className="mt-20 grid border-t border-[var(--wl-faint)] md:grid-cols-3">{[["01","Policy check","Caps, vendors, destinations. Evaluated in 42ms."],["02","Allow or block","The wallet moves only when the policy says so."],["03","Escalate to human","Unusual spend pauses. You decide, not the model."]].map(([n,t,d]) => <div key={n} className="border-b border-[var(--wl-faint)] py-7 md:border-b-0 md:border-r md:px-8 md:pt-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"><span className="font-mono text-[10px] text-[var(--wl-signal)]">{n}</span><h3 className="mt-14 text-[21px] font-medium tracking-[-.04em]">{t}</h3><p className="mt-3 max-w-[190px] text-[12px] leading-[1.45] text-[var(--wl-secondary2)]">{d}</p></div>)}</div></Reveal></div></section>

        <section id="policies" className="border-b border-[var(--wl-line)] px-6 py-28 lg:px-10 lg:py-36"><div className="mx-auto max-w-[1400px]"><Reveal><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">02 / Policy surface</p><h2 className="mt-7 text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.84] tracking-[-.045em]">The rulebook,<br /><span className="text-[var(--wl-dim)]">made executable.</span></h2></div><SectionNumber value="2" className="hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-soft)] lg:block" /></div></Reveal>
           <Reveal className="delay-1"><div className="warm-policy-doc relative mt-24 max-w-[930px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-7 shadow-[14px_18px_0_var(--wl-bg-deep2)] lg:ml-[12%] lg:p-12"><div className="flex justify-between border-b border-[var(--wl-line)] pb-5 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]"><span>POLICY / PROCUREMENT-BOT</span><span>v4.18 · ACTIVE</span></div><div className="mt-10 grid gap-9 font-mono text-[12px] leading-[1.8] md:grid-cols-[1fr_1fr]"><div><span className="text-[var(--wl-mute)]">when</span><br /><span className="text-[var(--wl-signal)]">transaction.vendor</span> in<br /><span className="ml-5">[ AWS, OpenAI ]</span><br /><span className="text-[var(--wl-signal)]">and amount</span> ≤ <span className="text-[var(--wl-signal)]">$500</span></div><div><span className="text-[var(--wl-mute)]">then</span><br /><span className="text-[var(--wl-green-bright)]">ALLOW</span> · record to ledger<br /><span className="text-[var(--wl-mute)]">otherwise</span><br /><span className="text-[var(--wl-signal)]">ESCALATE</span> · ask human operator</div></div><div className="mt-10 flex justify-between border-t border-[var(--wl-line)] pt-5 text-[10px] text-[var(--wl-secondary)]"><span>daily cap $5,000 · USDC only</span><span className="text-[var(--wl-green-bright)]">✓ signed by operator</span></div></div></Reveal>
        </div></section>

        <section id="record" className="bg-[var(--wl-ink)] px-6 py-28 text-[var(--wl-bg)] lg:px-10 lg:py-32"><div className="mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[240px_1fr]"><Reveal><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">03 / Trust surface</p><SectionNumber value="3" className="mt-28 hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-strong5)] lg:block" /></Reveal><Reveal className="delay-1"><div className="flex flex-col justify-between gap-10 md:flex-row md:items-end"><h2 className="max-w-[680px] text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.84] tracking-[-.045em]">Nothing moves<br /><span className="text-[var(--wl-dim2)]">in the dark.</span></h2><p className="max-w-[240px] text-[12px] leading-[1.5] text-[var(--wl-muted2)]">A quiet, immutable record of what your agents tried, what policy decided, and who stepped in.</p></div><div className="mt-16"><LedgerRows dark /></div></Reveal></div></section>

        <section id="contact" className="px-6 py-32 lg:px-10 lg:py-44"><Reveal><div className="mx-auto max-w-[1400px] border-b border-[var(--wl-line)] pb-24"><div className="flex items-start justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">04 / Trust is the product</p><SectionNumber value="4" className="hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-soft)] lg:block" /></div><h2 className="mt-8 max-w-[950px] text-[clamp(4rem,9vw,9rem)] font-semibold leading-[.78] tracking-[-.045em]">Let agents move.<br /><span className="text-[var(--wl-dim)]">Keep the final word.</span></h2><div className="mt-14 flex flex-col gap-8 lg:ml-[42%] lg:flex-row lg:items-center"><p className="max-w-[290px] text-[15px] leading-[1.5] text-[var(--wl-body)]">Built for finance and engineering teams who need autonomy without giving up the ledger.</p><div className="flex flex-wrap items-center gap-4"><MagneticAnchor href="/dashboard" className="warm-pill group w-fit rounded-full bg-[var(--wl-signal)] px-6 py-3.5 text-[12px] font-semibold text-white">Launch Dashboard<Arrow /></MagneticAnchor><MagneticAnchor href="/docs" className="warm-pill warm-pill-ghost inline-flex w-fit items-center gap-2 rounded-full border border-[var(--wl-line)] px-6 py-3.5 text-[12px] font-semibold text-[var(--wl-ink)]"><BookIcon />Read Docs</MagneticAnchor></div></div></div></Reveal></section>
        <footer className="flex flex-col justify-between gap-6 px-6 pb-10 text-[11px] text-[var(--wl-secondary)] lg:flex-row lg:px-10"><span className="font-semibold tracking-[-.04em] text-[var(--wl-ink)]">ARCANUM<span className="warm-period text-[var(--wl-signal)]">.</span></span><div className="flex gap-7"><MagneticAnchor href="/docs" className="warm-link inline-flex items-center gap-1.5 hover:text-[var(--wl-signal)]"><BookIcon className="h-3 w-3" />Documentation</MagneticAnchor><MagneticAnchor href="https://github.com/bunnyyxtan/ARCANUM" target="_blank" rel="noreferrer" className="warm-link inline-flex items-center gap-1.5 hover:text-[var(--wl-signal)]"><GitHubMark className="h-3 w-3" />GitHub</MagneticAnchor><MagneticAnchor href="/dashboard" className="warm-link hover:text-[var(--wl-signal)]">Dashboard</MagneticAnchor><span className="font-mono">© 2025 ARCANUM</span></div></footer>
       </div>
       {connectOpen && <div className="warm-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.32)] p-5" role="dialog" aria-modal="true" aria-label="Connect wallet" onClick={() => { setConnectOpen(false); setConnecting(false); }}>
        <div className="warm-modal-panel w-full max-w-[440px] border border-[var(--wl-line-strong2)] bg-[var(--wl-bg)] shadow-[0_24px_60px_-16px_rgba(var(--wl-ink-rgb),.35)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-[var(--wl-line-soft)] px-7 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">ARCANUM / ACCESS</p>
            <button type="button" aria-label="Close" onClick={() => { setConnectOpen(false); setConnecting(false); }} className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px] leading-none text-[var(--wl-secondary)] transition-colors hover:bg-[var(--wl-bg-deep)] hover:text-[var(--wl-ink)]">✕</button>
          </div>
          {connecting ? (
            <div className="px-7 py-10">
              <div className="flex items-center gap-4">
                <span className="relative flex h-12 w-12 items-center justify-center border border-[var(--wl-line-soft)] bg-[var(--wl-glass-strong)]">
                  {chosenWallet && <img src={chosenWallet.logo} alt="" className="h-7 w-7 object-contain" />}
                  <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--wl-signal)] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--wl-signal)]" /></span>
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">CONNECTING / ARC TESTNET</p>
                  <p className="mt-1 text-[15px] font-semibold tracking-[-.02em]">{chosenWallet?.name ?? "Wallet"}</p>
                </div>
              </div>
              <p className="mt-5 text-[14px] leading-[1.5] text-[var(--wl-body)]">Waiting for an operator signature in {chosenWallet?.name ?? "your wallet"}…</p>
              <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-[var(--wl-line-soft)]"><span className="block h-full w-1/3 rounded-full bg-[var(--wl-signal)]" style={{ animation: "warmScan 1.1s cubic-bezier(.45,.05,.55,.95) infinite" }} /></div>
              <p className="mt-3 font-mono text-[9px] tracking-[.12em] text-[var(--wl-muted)]">SIWE · NO CUSTODY · POLICY-SCOPED SESSION</p>
            </div>
          ) : (
            <div className="px-7 pb-7 pt-6">
              <h2 className="text-[26px] font-semibold leading-[1.02] tracking-[-.05em]">Connect your governed wallet.</h2>
              <p className="mt-3 text-[13.5px] leading-[1.55] text-[var(--wl-body)]">ARCANUM never takes custody. Sign in to inspect the governed ledger and manage policies.</p>
              <div className="mt-6 space-y-2.5">
                {WALLET_OPTIONS.map((option) => (
                  <button key={option.name} type="button" onClick={() => { setChosenWallet(option); setConnecting(true); }} className="warm-wallet-option flex w-full items-center gap-3.5 border border-[var(--wl-line)] bg-[var(--wl-glass)] px-3.5 py-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--wl-line-soft)] bg-[var(--wl-surface)]">
                      <img src={option.logo} alt="" className="h-6 w-6 object-contain" />
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block text-[13.5px] font-semibold tracking-[-.01em]">{option.name}</span>
                        {option.tag && <span className="rounded-full bg-[var(--wl-green-tint)] px-2 py-0.5 font-mono text-[8px] tracking-[.1em] text-[var(--wl-green)]">{option.tag}</span>}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] tracking-[.06em] text-[var(--wl-muted)]">{option.hint.toUpperCase()}</span>
                    </span>
                    <span className="warm-wallet-arrow font-mono text-[12px] text-[var(--wl-signal)]">→</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--wl-line-soft)] pt-4">
                <p className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-muted)]">SIWE · ARC TESTNET</p>
                <button type="button" onClick={() => { setConnectOpen(false); window.dispatchEvent(new CustomEvent("arcanum-connected")); }} className="warm-link font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]">CONTINUE READ-ONLY</button>
              </div>
            </div>
          )}
        </div>
      </div>}
    </main>
  );
}