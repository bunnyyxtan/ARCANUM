import Link from "next/link";

import { formatUsd } from "@/lib/format/money";

import type { AgentDetailController } from "../_hooks/use-agent-detail-controller";
import { ledgerStatusLabel } from "../_lib/agent-detail-helpers";
import { Arrow, StatusPill } from "./detail-primitives";

export function AgentDecisionRecord({ controller }: { controller: AgentDetailController }) {
  const { decisions, ledgerQuery } = controller;
  return (
    <>
      <div className="mt-10 flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            DECISIONS / RECENT
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Decision record
          </h2>
        </div>
        <Link
          href="/ledger"
          className="group font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
        >
          Open ledger
          <Arrow />
        </Link>
      </div>
      {ledgerQuery.isLoading ? (
        <div>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="grid animate-pulse gap-2 border-b border-[var(--wl-line-soft)] px-3 py-4 md:grid-cols-[.8fr_1.2fr_1.1fr_.8fr_90px] md:items-center"
            >
              <div className="h-4 w-16 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-28 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-24 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-16 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-16 rounded-full bg-[var(--wl-line-soft)]" />
            </div>
          ))}
        </div>
      ) : ledgerQuery.isError ? (
        <div className="border-b border-[var(--wl-line)] py-14 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
            Ledger read failed
          </p>
          <button
            type="button"
            onClick={() => void ledgerQuery.refetch()}
            className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      ) : decisions.length === 0 ? (
        <div className="border-b border-[var(--wl-line)] py-14 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            No activity recorded yet
          </p>
          <p className="mx-auto mt-3 max-w-[360px] text-[12px] leading-[1.5] text-[var(--wl-body)]">
            Payment intents, policy decisions, and transfers will appear here after this governed
            wallet is used.
          </p>
        </div>
      ) : (
        <div>
          {decisions.map((row) => (
            <div
              key={row.id}
              className="decision-row grid gap-2 border-b border-[var(--wl-line-soft)] px-3 py-4 max-md:grid-cols-1 md:grid-cols-[.8fr_1.2fr_1.1fr_.8fr_90px] md:items-center"
            >
              <span className="font-mono text-[10px] text-[var(--wl-secondary)]">
                <span className="mr-2 text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                  Time
                </span>
                {row.timestamp}
              </span>
              <span className="text-[12px] font-medium">
                <span className="mr-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                  Action
                </span>
                {row.action}
              </span>
              <span className="text-[12px] text-[var(--wl-body)]">
                <span className="mr-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                  Counterparty
                </span>
                {row.counterparty}
              </span>
              <span className="font-mono text-[11px]">
                <span className="mr-2 text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                  Amount
                </span>
                {formatUsd(row.amount)}
              </span>
              <StatusPill status={ledgerStatusLabel(row.status)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
