import { ConnectCta } from "@/components/warm/ConnectCta";
import type { Anomaly } from "@/lib/types";

import { AnomalyRow } from "./anomaly-row";

export function AnomalyRegister({
  anomalies,
  errored,
  investigated,
  loading,
  notice,
  readOnly,
  onInvestigate,
  onNotice,
  onRetry,
}: {
  anomalies: Anomaly[];
  errored: boolean;
  investigated: string | null;
  loading: boolean;
  notice: string;
  readOnly: boolean;
  onInvestigate: (item: Anomaly) => void;
  onNotice: (message: string) => void;
  onRetry: () => void;
}) {
  return (
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
        {readOnly ? (
          <ConnectCta className="p-10 text-center" />
        ) : loading ? (
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
              onClick={onRetry}
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
              onInvestigate={() => onInvestigate(item)}
              onNotice={onNotice}
            />
          ))
        )}
      </div>
    </section>
  );
}
