"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-2 inline-block transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      ↗
    </span>
  );
}

export function GitHubMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function BookIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

type MagneticAnchorProps = {
  children: ReactNode;
  className?: string;
  href: string;
  rel?: string;
  target?: string;
  onClick?: () => void;
};

/**
 * Anchor with a subtle magnetic hover offset. Uses next/link for internal
 * routes and a plain anchor for hash links / external links.
 */
export function MagneticAnchor({
  children,
  className = "",
  href,
  rel,
  target,
  onClick,
}: MagneticAnchorProps) {
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

  const isInternal = href.startsWith("/") && !target;

  if (isInternal) {
    return (
      <Link
        href={href}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerLeave={reset}
        className={`warm-interaction ${className}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      rel={rel}
      target={target}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`warm-interaction ${className}`}
    >
      {children}
    </a>
  );
}

export function StatusPill({ status }: { status: "ALLOWED" | "BLOCKED" | "ESCALATED" }) {
  const styles = {
    ALLOWED: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    BLOCKED: "bg-[var(--wl-signal)] text-white",
    ESCALATED: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  };
  return (
    <span
      className={`warm-status warm-status-${status.toLowerCase()} rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}
    >
      <span>{status}</span>
      {status === "ESCALATED" && <span className="approval-chip">HUMAN</span>}
    </span>
  );
}

export function LedgerRows({ dark = false }: { dark?: boolean }) {
  const rows = [
    {
      agent: "procurement-bot",
      vendor: "AWS",
      amount: "$184.20",
      detail: "0x3f…9a2c",
      status: "ALLOWED" as const,
      time: "09:41:08",
    },
    {
      agent: "support-agent",
      vendor: "OpenAI",
      amount: "$740.00",
      detail: "0x71…4be1",
      status: "BLOCKED" as const,
      time: "09:41:12",
    },
    {
      agent: "growth-bot",
      vendor: "Anthropic",
      amount: "$2,100.00",
      detail: "0xa8…c912",
      status: "ESCALATED" as const,
      time: "09:41:16",
    },
    {
      agent: "procurement-bot",
      vendor: "AWS",
      amount: "$316.40",
      detail: "0x3f…9a2c",
      status: "ALLOWED" as const,
      time: "09:41:19",
    },
  ];
  const [visible, setVisible] = useState(2);
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only ticker; rows is a static array
  useEffect(() => {
    const id = window.setInterval(() => setVisible((v) => (v >= rows.length ? 1 : v + 1)), 2500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const line = dark ? "border-[var(--wl-strong2)]" : "border-[var(--wl-line)]";
  const quiet = dark ? "text-[var(--wl-dim2)]" : "text-[var(--wl-mute)]";
  return (
    <div
      className={`overflow-hidden border ${line} ${dark ? "bg-[var(--wl-ink-soft)]" : "bg-[var(--wl-bg-raised)]"}`}
    >
      <div className={`flex items-center justify-between border-b px-5 py-4 ${line}`}>
        <span className={`font-mono text-[10px] uppercase tracking-[.18em] ${quiet}`}>
          Live governed ledger
        </span>
        <span className={`font-mono text-[10px] ${quiet}`}>ARC / USDC</span>
      </div>
      <div
        className={`grid grid-cols-[1.3fr_1fr_.9fr_1fr_140px] gap-3 border-b px-5 py-3 font-mono text-[9px] uppercase tracking-[.13em] ${line} ${quiet}`}
      >
        <span>Agent</span>
        <span>Vendor</span>
        <span className="text-right">Amount</span>
        <span>Wallet</span>
        <span className="text-right">Verdict</span>
      </div>
      <div
        className={`divide-y ${dark ? "divide-[var(--wl-strong4)]" : "divide-[var(--wl-line-faint)]"}`}
      >
        {rows.map((r, i) => (
          <div
            key={r.time}
            style={{ "--row-i": i } as CSSProperties}
            className={`warm-ledger-row grid grid-cols-[1.3fr_1fr_.9fr_1fr_140px] items-center gap-3 px-5 py-4 ${i < visible ? "is-live" : "is-quiet"}`}
          >
            <div>
              <div
                className={`text-[12px] font-medium ${dark ? "text-[var(--wl-bg-tint)]" : "text-[var(--wl-ink)]"}`}
              >
                {r.agent}
              </div>
              <div className={`mt-1 font-mono text-[9px] ${quiet}`}>{r.time} UTC</div>
            </div>
            <span
              className={`text-[12px] ${dark ? "text-[var(--wl-line-bolder)]" : "text-[var(--wl-strong)]"}`}
            >
              {r.vendor}
            </span>
            <span
              className={`text-right font-mono text-[12px] tabular-nums ${dark ? "text-[var(--wl-bg-tint)]" : "text-[var(--wl-ink)]"}`}
            >
              {r.amount}
            </span>
            <span className={`font-mono text-[10px] ${quiet}`}>{r.detail}</span>
            <span className="flex justify-end">
              <StatusPill status={r.status} />
            </span>
          </div>
        ))}
      </div>
      <div className={`flex items-center justify-between border-t px-5 py-3 ${line}`}>
        <span className={`font-mono text-[9px] ${quiet}`}>policy/v4.18 · 42ms median</span>
        <span className="font-mono text-[9px] text-[var(--wl-green-soft)]">● streaming</span>
      </div>
    </div>
  );
}

export function Reveal({
  children,
  className = "",
  kind = "default",
}: {
  children: ReactNode;
  className?: string;
  kind?: "default" | "headline";
}) {
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
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            reveal();
            observer?.disconnect();
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
      );
      observer.observe(node);
    } else {
      reveal();
    }
    if (inInitialViewport) reveal();
    const fallback = window.setTimeout(reveal, inInitialViewport ? 720 : 1320);
    return () => {
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  const index = className.includes("delay-1")
    ? 1
    : className.includes("delay-2")
      ? 2
      : className.includes("delay-3")
        ? 3
        : 0;
  return (
    <div
      ref={ref}
      data-reveal-kind={kind}
      className={`warm-reveal ${armed ? "warm-armed" : ""} ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function SectionNumber({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState("00");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        const target = Number(value);
        let current = 0;
        timer = window.setInterval(() => {
          current += 1;
          setShown(String(Math.min(current, target)).padStart(2, "0"));
          if (current >= target) window.clearInterval(timer);
        }, 75);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [value]);
  return (
    <span ref={ref} className={`warm-section-number tabular-nums ${className}`}>
      {shown}
    </span>
  );
}
