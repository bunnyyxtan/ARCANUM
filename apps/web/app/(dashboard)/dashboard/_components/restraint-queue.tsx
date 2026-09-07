import { categoryLabel, formatUsdCompact } from "@/lib/format";
import Link from "next/link";
import type { DashboardController } from "../_hooks/use-dashboard-controller";
import { Arrow, Reveal } from "./dashboard-primitives";

export function RestraintQueue({
  readOnly,
  escalations,
  anomalies,
  pendingItem,
  attentionSettled,
  needsAttention,
}: Pick<
  DashboardController,
  "readOnly" | "escalations" | "anomalies" | "pendingItem" | "attentionSettled" | "needsAttention"
>) {
  return (
    <Reveal index={3}>
      <aside className="bg-[var(--wl-bg-soft)] p-6 md:p-7">
        <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
          <div>
            <p
              className={`font-mono text-[10px] uppercase tracking-[.17em] ${
                needsAttention ? "text-[var(--wl-signal)]" : "text-[var(--wl-secondary)]"
              }`}
            >
              {attentionSettled
                ? needsAttention
                  ? "ACTION REQUIRED"
                  : "ALL CLEAR"
                : "HUMAN CONTROL"}
            </p>
            <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
              Restraint queue
            </h2>
          </div>
          <span
            className={`rounded-full px-2 py-1 font-mono text-[9px] ${
              escalations.data.length > 0
                ? "bg-[var(--wl-signal)] text-white"
                : "border border-[var(--wl-line)] text-[var(--wl-mute)]"
            }`}
          >
            {String(escalations.data.length).padStart(2, "0")}
          </span>
        </div>
        {readOnly ? (
          <div className="border-b border-[var(--wl-line)] py-9">
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
              READ-ONLY VIEW
            </p>
            <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
              Connect a wallet to see your own restraint queue.
            </p>
          </div>
        ) : escalations.isLoading ? (
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
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
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
                onchain quorum vote
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
                <Link
                  key={anomaly.id}
                  href="/anomalies"
                  className="group/anomaly flex w-full items-center justify-between border-b border-[var(--wl-line-soft)] py-3 text-left text-[12px] transition-colors hover:border-[var(--wl-signal)]"
                >
                  <span className="min-w-0 truncate pr-3 text-[var(--wl-ink)] transition-colors group-hover/anomaly:text-[var(--wl-signal)]">
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
                </Link>
              ))
            )}
          </div>
          {!readOnly && anomalies.data.length > 0 && (
            <Link
              href="/anomalies"
              className="group mt-5 inline-flex font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
            >
              Review anomalies <Arrow />
            </Link>
          )}
        </div>
      </aside>
    </Reveal>
  );
}
