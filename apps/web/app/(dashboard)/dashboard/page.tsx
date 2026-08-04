"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

import { categoryLabel, formatUsdCompact } from "@/lib/format";
import {
  useLiveAnomalies,
  useLiveDashboardMetrics,
  useLiveEscalations,
  useLiveEvents,
} from "@/lib/live-data";
import type { GovernanceEvent, LedgerStatus } from "@/lib/types";

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      →
    </span>
  );
}

const statusPillStyles: Record<LedgerStatus, string> = {
  approved: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  rejected: "bg-[var(--wl-signal)] text-white",
  escalated: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  frozen: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
};

function StatusPill({ status }: { status: LedgerStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${statusPillStyles[status]}`}
    >
      {status}
    </span>
  );
}

function Reveal({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={`warm-reveal is-visible ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </div>
  );
}

function CountUp({
  target,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 900, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(target * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  return (
    <>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}

function StreamRow({ event, index }: { event: GovernanceEvent; index: number }) {
  return (
    <div
      style={{ "--i": index } as CSSProperties}
      className="stream-row grid gap-2 px-3 py-4 md:grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] md:items-center"
    >
      <div className="flex justify-between md:block">
        <span className="font-mono text-[10px] tabular-nums text-[var(--wl-secondary)]">
          {event.timestamp}
        </span>
        <span className="md:hidden">
          <StatusPill status={event.status} />
        </span>
      </div>
      <span className="truncate text-[12px] font-medium">{event.label}</span>
      <span className="truncate text-[12px] text-[var(--wl-body)]">{event.actor}</span>
      <span className="truncate font-mono text-[11px] text-[var(--wl-body)]">
        {event.counterparty}
      </span>
      <span className="font-mono text-[12px] tabular-nums">
        {event.amount > 0 ? formatUsdCompact(event.amount) : "—"}
      </span>
      <span className="hidden md:block">
        <StatusPill status={event.status} />
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const metrics = useLiveDashboardMetrics();
  const events = useLiveEvents();
  const escalations = useLiveEscalations("PENDING");
  const anomalies = useLiveAnomalies();

  const pendingItem = escalations.data[0] ?? null;

  const kpis = [
    {
      label: "VALUE GOVERNED",
      value: <CountUp target={metrics.valueGoverned} prefix="$" decimals={2} />,
      note: "indexed read model",
    },
    {
      label: "ACTIVE AGENTS",
      value: String(metrics.activeAgents).padStart(2, "0"),
      note: "live indexed",
    },
    {
      label: "THREATS BLOCKED",
      value: String(metrics.threatsBlocked),
      note: "policy denials",
    },
    {
      label: "PENDING ESCALATIONS",
      value: String(metrics.pendingEscalations).padStart(2, "0"),
      note: metrics.pendingEscalations > 0 ? "review required" : "no pending reviews",
      accent: metrics.pendingEscalations > 0,
    },
  ];

  const streamEvents = events.data;

  return (
    <div id="top" className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
      <style>{`
        .stream-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}
        .stream-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        @media (prefers-reduced-motion:reduce){.stream-row{transition:none}}
      `}</style>

      <Reveal>
        <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              OVERVIEW / FLEET POSTURE
            </p>
            <h1 className="font-display mt-4 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.86] tracking-[-.015em]">
              Dashboard
            </h1>
            <p className="mt-5 max-w-[430px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
              A quiet view of autonomous spend, restraint decisions, and the agents moving capital
              on Arc.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              document.getElementById("stream")?.scrollIntoView({ behavior: "smooth" })
            }
            className="warm-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white"
          >
            Review governed events
            <Arrow />
          </button>
        </div>
      </Reveal>

      <section
        aria-label="Governance metrics"
        className="grid border-b border-[var(--wl-line)] md:grid-cols-4"
      >
        {kpis.map((kpi, i) => (
          <Reveal key={kpi.label} index={i + 1}>
            <div
              className={`min-h-[142px] border-b border-[var(--wl-line)] py-6 md:border-b-0 ${
                i > 0 ? "md:border-l md:pl-6" : "md:pr-6"
              } ${i < 3 ? "md:pr-6" : ""}`}
            >
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
                {kpi.label}
              </p>
              <p
                className={`font-display mt-5 text-[32px] font-semibold tracking-[-.015em] tabular-nums ${
                  kpi.accent ? "text-[var(--wl-signal)]" : "text-[var(--wl-ink)]"
                }`}
              >
                {metrics.isLoading ? (
                  <span className="inline-block h-8 w-24 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
                ) : (
                  kpi.value
                )}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                {metrics.isError ? "read model unavailable" : kpi.note}
              </p>
            </div>
          </Reveal>
        ))}
      </section>

      <section
        id="stream"
        className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,.75fr)]"
      >
        <Reveal index={2}>
          <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                LIVE / {String(streamEvents.length).padStart(2, "0")} EVENTS
              </p>
              <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                Governed event stream
              </h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
              UTC · live read model
            </span>
          </div>
          <div className="hidden grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] gap-3 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid">
            <span>Time</span>
            <span>Event</span>
            <span>Actor</span>
            <span>Reference</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-[var(--wl-line-soft)]">
            {events.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-4">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
                </div>
              ))
            ) : events.isError ? (
              <div className="px-6 py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  READ MODEL UNAVAILABLE
                </p>
                <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                  The governed event stream could not be loaded.
                </p>
              </div>
            ) : streamEvents.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  NO ACTIVITY YET
                </p>
                <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                  Policy updates, agent payments, and escalations will appear here once your
                  governed wallet is active.
                </p>
              </div>
            ) : (
              streamEvents.map((event, i) => <StreamRow key={event.id} event={event} index={i} />)
            )}
          </div>
          <Link
            href="/ledger"
            className="group mt-5 inline-flex font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
          >
            Open full ledger <Arrow />
          </Link>
        </Reveal>

        <Reveal index={3}>
          <aside className="bg-[var(--wl-bg-soft)] p-6 md:p-7">
            <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  ACTION REQUIRED
                </p>
                <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                  Restraint queue
                </h2>
              </div>
              <span className="rounded-full bg-[var(--wl-signal)] px-2 py-1 font-mono text-[9px] text-white">
                {String(escalations.data.length).padStart(2, "0")}
              </span>
            </div>

            {escalations.isLoading ? (
              <div className="border-b border-[var(--wl-line)] py-6">
                <div className="h-24 w-full animate-pulse rounded bg-[var(--wl-bg-deep)]" />
              </div>
            ) : escalations.isError ? (
              <div className="border-b border-[var(--wl-line)] py-9">
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                  UNABLE TO LOAD
                </p>
                <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                  Pending escalations could not be read.
                </p>
              </div>
            ) : pendingItem ? (
              <div className="border-b border-[var(--wl-line)] py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{pendingItem.agentName}</p>
                    <p className="mt-1 text-[13px] text-[var(--wl-body)]">
                      {categoryLabel(pendingItem.category)} · {pendingItem.counterparty}
                    </p>
                  </div>
                  <span className="font-mono text-[14px] tabular-nums">
                    {formatUsdCompact(pendingItem.amount)}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-y-3 font-mono text-[9px] uppercase tracking-[.11em] text-[var(--wl-secondary)]">
                  <span>
                    quorum{" "}
                    <b className="font-normal text-[var(--wl-ink)]">
                      {pendingItem.quorumCurrent} / {pendingItem.quorumRequired}
                    </b>
                  </span>
                  <span className="text-right">
                    expires in{" "}
                    <b className="font-normal text-[var(--wl-ink)]">{pendingItem.expiresIn}</b>
                  </span>
                  <span className="col-span-2">
                    wallet <b className="font-normal text-[var(--wl-ink)]">{pendingItem.wallet}</b>
                  </span>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <Link
                    href="/escalations"
                    className="warm-pill group rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[11px] font-semibold text-white"
                  >
                    Review &amp; sign →
                  </Link>
                  <span className="font-mono text-[8.5px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                    on-chain quorum vote
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-b border-[var(--wl-line)] py-9">
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
                  NO ESCALATIONS PENDING
                </p>
                <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                  Risky or review-required agent payments appear here for human approval.
                </p>
              </div>
            )}

            <div className="pt-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
                  ANOMALY REGISTER
                </p>
                <span className="font-mono text-[9px] text-[var(--wl-mute)]">
                  {String(anomalies.data.length).padStart(2, "0")} flagged
                </span>
              </div>
              <div className="mt-4 space-y-1">
                {anomalies.isLoading ? (
                  <div className="h-10 w-full animate-pulse rounded bg-[var(--wl-bg-deep)]" />
                ) : anomalies.data.length === 0 ? (
                  <p className="py-3 text-[12px] text-[var(--wl-secondary2)]">
                    No anomalies detected. Spend deviations will be listed here.
                  </p>
                ) : (
                  anomalies.data.slice(0, 4).map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="flex w-full items-center justify-between border-b border-[var(--wl-line-soft)] py-3 text-left text-[12px]"
                    >
                      <span className="min-w-0 truncate pr-3 text-[var(--wl-ink)]">
                        {anomaly.agentName}
                      </span>
                      <span
                        className={`font-mono text-[9px] uppercase tracking-[.12em] ${
                          anomaly.suggestedAction === "freeze"
                            ? "text-[var(--wl-signal)]"
                            : "text-[var(--wl-mute)]"
                        }`}
                      >
                        {anomaly.suggestedAction === "freeze" ? "freeze" : "observe"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </Reveal>
      </section>

      <section
        id="ledger"
        className="mt-14 flex flex-col justify-between gap-5 border-t border-[var(--wl-line)] pt-5 text-[11px] text-[var(--wl-secondary)] sm:flex-row"
      >
        <span className="font-mono uppercase tracking-[.14em]">Arc testnet · USDC</span>
        <span>Live read model · governed spend indexed on-chain</span>
      </section>
    </div>
  );
}
