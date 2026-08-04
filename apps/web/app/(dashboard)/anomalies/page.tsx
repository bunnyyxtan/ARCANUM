"use client";

import { type CSSProperties, type MouseEvent as ReactMouseEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

import { useWorkspaceMode } from "@/lib/auth-session";
import { shortAddress } from "@/lib/format/address";
import { useLiveAnomalies } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { Anomaly } from "@/lib/types";

const ORANGE = "var(--wl-signal)";
const fallbackAnomalyId = "70000000-0000-4000-8000-000000000001";

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function pointsToPolyline(points: readonly number[]) {
  if (points.length === 0) {
    return "2,24 59,5";
  }
  const step = points.length > 1 ? 57 / (points.length - 1) : 0;
  return points
    .map((value, index) => {
      const x = 2 + index * step;
      const y = Math.max(2, Math.min(26, 26 - value * 3));
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    })
    .join(" ");
}

function Sparkline({ points }: { points: readonly number[] }) {
  const line = pointsToPolyline(points);
  const parts = line.split(" ");
  const first = parts[0] ?? "2,24";
  const last = parts[parts.length - 1] ?? "59,5";
  return (
    <svg
      role="img"
      aria-label="anomaly trend"
      viewBox="0 0 62 28"
      className="h-7 w-[62px]"
      fill="none"
    >
      <polyline
        points={line}
        style={{ stroke: "var(--wl-secondary)" }}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={`${first} ${last}`}
        stroke={ORANGE}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={Number(last.split(",")[0])}
        cy={Number(last.split(",")[1])}
        r="1.8"
        fill={ORANGE}
      />
    </svg>
  );
}

function StatusPill({ frozen }: { frozen: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.13em] ${
        frozen
          ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
          : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"
      }`}
    >
      {frozen ? "FROZEN" : "WATCH"}
    </span>
  );
}

type RowState = "idle" | "restrained" | "dismissed";

function AnomalyRow({
  item,
  index,
  investigated,
  onInvestigate,
  onNotice,
}: Readonly<{
  item: Anomaly;
  index: number;
  investigated: boolean;
  onInvestigate: () => void;
  onNotice: (message: string) => void;
}>) {
  const { isConnected } = useAccount();
  const utils = trpc.useUtils();
  const acknowledge = trpc.anomalies.acknowledge.useMutation();
  const dismiss = trpc.anomalies.dismiss.useMutation();
  const [state, setState] = useState<RowState>(
    item.suggestedAction === "freeze" ? "restrained" : "idle",
  );

  const severity = item.score >= 5 ? "CRITICAL" : "ELEVATED";
  const frozen = state === "restrained" || item.suggestedAction === "freeze";

  const settle = async (
    next: "restrained" | "dismissed",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const action = next === "dismissed" ? "anomalies.dismiss" : "anomalies.acknowledge";
    if (!allowTrustedMutation(action, event)) {
      return;
    }
    if (!isConnected) {
      return;
    }

    setState(next);
    try {
      const anomalyId = item.id ?? fallbackAnomalyId;
      if (next === "dismissed") {
        await dismiss.mutateAsync({ anomalyId });
      } else {
        await acknowledge.mutateAsync({ anomalyId });
      }
      await utils.anomalies.list.invalidate();
      onNotice(
        next === "dismissed"
          ? `${item.agentName.toUpperCase()} REMOVED FROM ACTIVE REGISTER`
          : `${item.agentName.toUpperCase()} WALLET RESTRAINED · POLICY HOLD ACTIVE`,
      );
      toast.success(
        next === "dismissed"
          ? `${item.agentName.toUpperCase()} DISMISSED / anomaly archived`
          : `${item.agentName.toUpperCase()} FROZEN / anomaly restraint active`,
      );
    } catch {
      setState(item.suggestedAction === "freeze" ? "restrained" : "idle");
      toast.error(`${item.agentName.toUpperCase()} ACTION FAILED / CONNECT WALLET`);
    }
  };

  if (state === "dismissed") {
    return null;
  }

  return (
    <div
      style={{ "--row": index } as CSSProperties}
      className={`anomaly-row grid gap-3 px-4 py-5 md:grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] md:items-center ${
        acknowledge.isPending || dismiss.isPending ? "opacity-60" : ""
      }`}
    >
      <div>
        <div className="text-[13px] font-medium">{item.agentName}</div>
        <div className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">
          agent wallet · {shortAddress(item.agentId)}
        </div>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">
        {item.timestamp}
      </span>
      <div>
        <StatusPill frozen={frozen} />
        <span className="ml-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] md:hidden">
          {severity}
        </span>
      </div>
      <span className="font-mono text-[14px] tabular-nums text-[var(--wl-signal)]">
        {item.score.toFixed(1)}
      </span>
      <span className="text-[12px] text-[var(--wl-body)]">{item.narrative}</span>
      <div className="flex items-center justify-between gap-3">
        <Sparkline points={item.points} />
        <span className="hidden font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] lg:inline">
          {severity}
        </span>
      </div>
      <div className="flex flex-col items-start gap-1.5 md:items-end">
        <div className="flex items-center justify-start gap-3 md:justify-end">
          {frozen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wl-ink)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-bg)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--wl-signal)]" />
              RESTRAINED
            </span>
          ) : (
            <button
              type="button"
              disabled={acknowledge.isPending || !isConnected}
              title={!isConnected ? "Connect wallet first." : undefined}
              onClick={(event) => void settle("restrained", event)}
              className="rounded-full border border-[var(--wl-signal)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--wl-signal)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restrain
            </button>
          )}
          <button
            type="button"
            onClick={onInvestigate}
            className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em]"
          >
            {investigated ? "Close trace" : "Investigate"}
          </button>
          <button
            type="button"
            disabled={dismiss.isPending || !isConnected}
            title={!isConnected ? "Connect wallet first." : undefined}
            onClick={(event) => void settle("dismissed", event)}
            className="font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
        {!isConnected && !frozen && (
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
            CONNECT WALLET FIRST
          </span>
        )}
      </div>
      {investigated && (
        <div className="border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-5 py-4 md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">
              INVESTIGATION TRACE / {item.agentName.toUpperCase()}
            </p>
            <span className="font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-mute)]">
              OPENED {item.timestamp}
            </span>
          </div>
          <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-[var(--wl-body)] sm:grid-cols-2">
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Baseline comparison</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">
                DEVIATION {item.score.toFixed(1)}σ
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Vendor path</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-green)]">
                3 HOPS VERIFIED
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Wallet history · 30d</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-body)]">
                {item.flaggedPoint} TX FLAGGED
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Policy doctrine check</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">
                §3.2 CAP BURST
              </span>
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            <a
              href="/ledger"
              className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-signal)] hover:underline"
            >
              OPEN LEDGER ROWS →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnomaliesPage() {
  useWorkspaceMode();
  const liveAnomalies = useLiveAnomalies();
  const [notice, setNotice] = useState("MONITORING WINDOW / LAST 24 HOURS");
  const [investigated, setInvestigated] = useState<string | null>(null);

  const anomalies = liveAnomalies.data;
  const critical = useMemo(() => anomalies.filter((item) => item.score >= 5).length, [anomalies]);
  const elevated = anomalies.length - critical;
  const peakScore = anomalies[0]?.score.toFixed(1) ?? "0.0";

  const loading = liveAnomalies.isLoading && anomalies.length === 0;
  const errored = liveAnomalies.isError && anomalies.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <style>{`
        .anomaly-row{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 90ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .anomaly-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes rowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.anomaly-row{animation:none;transition:none}.anomaly-row:hover{transform:none}}
      `}</style>

      <section className="flex flex-col justify-between gap-6 border-b border-[var(--wl-line)] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[var(--wl-signal)]">
            WATCH / DEVIATION
          </p>
          <h1 className="font-display mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.015em]">
            Anomalies
          </h1>
          <p className="mt-5 max-w-[460px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            Where agent behavior departs from its approved operating shape.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })
          }
          className="warm-pill w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
        >
          Review register <span className="ml-2">↘</span>
        </button>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
        <div className="border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-secondary)]">
                DEVIATION INDEX
              </p>
              <div className="mt-8 flex items-end gap-3">
                <span className="font-display text-[clamp(4.5rem,9vw,7.8rem)] font-semibold leading-[.72] tracking-[-.015em] text-[var(--wl-signal)]">
                  {peakScore}
                </span>
                <span className="mb-1 font-mono text-[10px] tracking-[.14em] text-[var(--wl-signal)]">
                  {critical > 0 ? "CRITICAL" : "NOMINAL"}
                </span>
              </div>
            </div>
            <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">
              LIVE / 24H
            </span>
          </div>
          <p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
            peak deviation / 24h
          </p>
          <div className="mt-10">
            <div className="relative h-4 border-t border-[var(--wl-ink)]">
              <span className="absolute left-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">
                0
              </span>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((tick) => (
                <span
                  key={tick}
                  className="absolute top-[-4px] h-2 w-px bg-[var(--wl-ink)]"
                  style={{ left: `${tick * 12.5}%` }}
                />
              ))}
              <span
                className="absolute top-[-5px] h-3 w-[2px] bg-[var(--wl-signal)]"
                style={{ left: `${Math.min(100, (Number(peakScore) / 8) * 100)}%` }}
              />
              <span className="absolute right-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">
                8
              </span>
            </div>
            <div className="mt-4 flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
              <span>nominal</span>
              <span>attention</span>
              <span>critical</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
          <div className="p-4 sm:p-6">
            <span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">
              CRITICAL
            </span>
            <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em] text-[var(--wl-signal)]">
              {critical}
            </strong>
            <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">NOW</span>
          </div>
          <div className="p-4 sm:p-6">
            <span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">
              ELEVATED
            </span>
            <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em]">
              {elevated}
            </strong>
            <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">OPEN</span>
          </div>
          <div className="p-4 sm:p-6">
            <span className="font-mono text-[9px] leading-[1.3] tracking-[.14em] text-[var(--wl-secondary)]">
              RESOLVED / 30D
            </span>
            <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em]">
              —
            </strong>
            <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">CLOSED</span>
          </div>
        </div>
      </section>

      <section id="register" className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-ink)] pb-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              REGISTER / ACTIVE
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-.015em]">
              Anomaly register
            </h2>
          </div>
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
            {notice}
          </span>
        </div>
        <div className="hidden grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] md:grid">
          <span>Agent</span>
          <span>Observed</span>
          <span>Status</span>
          <span>Score</span>
          <span>Deviation</span>
          <span>Trend</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-[var(--wl-line-soft)] border-b border-[var(--wl-line)]">
          {loading ? (
            [0, 1, 2].map((row) => (
              <div
                key={row}
                className="grid gap-3 px-4 py-5 md:grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr]"
              >
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-10 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              </div>
            ))
          ) : errored ? (
            <div className="p-10 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                ANOMALY QUERY FAILED
              </p>
              <button
                type="button"
                onClick={() => void liveAnomalies.refetch()}
                className="mt-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
              >
                RETRY
              </button>
            </div>
          ) : anomalies.length === 0 ? (
            <div className="border border-dashed border-[var(--wl-line)] p-10 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">
              REGISTER CLEAR · NO ACTIVE DEVIATIONS
            </div>
          ) : (
            anomalies.map((item, index) => (
              <AnomalyRow
                key={item.id}
                item={item}
                index={index}
                investigated={investigated === item.id}
                onInvestigate={() => {
                  const opening = investigated !== item.id;
                  setInvestigated(opening ? item.id : null);
                  if (opening) {
                    setNotice(
                      `${item.agentName.toUpperCase()} INVESTIGATION OPEN · ${item.flaggedPoint} TRANSACTIONS FLAGGED`,
                    );
                  }
                }}
                onNotice={setNotice}
              />
            ))
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
        <span>Policy/v4.18</span>
        <span>caps $500/tx · $5,000/day</span>
        <span>live indexer</span>
      </div>
    </div>
  );
}
