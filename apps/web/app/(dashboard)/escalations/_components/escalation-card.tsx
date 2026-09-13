"use client";

import type { CSSProperties } from "react";

import { getArcscanTxUrl } from "@/lib/arcscan";
import { formatBaseUnits } from "@/lib/escalation-truth";
import { shortAddress } from "@/lib/format/address";
import type { Escalation } from "@/lib/types";

import { useEscalationAction } from "../_hooks/use-escalation-action";
import type { EscalationChainUpdate } from "../_hooks/use-escalation-action";
import { formatFooterTimestamp } from "../_lib/helpers";

interface EscalationCardProps {
  item: Escalation;
  index: number;
  cardId: string;
  onChainUpdate: (update: EscalationChainUpdate) => void;
}

export function EscalationCard({
  item,
  index,
  cardId,
  onChainUpdate,
}: Readonly<EscalationCardProps>) {
  const action = useEscalationAction(item, onChainUpdate);
  const amountLabel = formatBaseUnits(item.amountBaseUnits);
  const isNear = item.expiryPercent < 10;
  const displayedStatus = action.expiredUnsettled
    ? "EXPIRED · UNSWEPT"
    : action.expiryVerificationRequired
      ? "EXPIRY · VERIFYING"
      : (action.resolvedStatus ?? "PENDING");
  return (
    <article
      id={cardId}
      style={{ "--card-i": index } as CSSProperties}
      className={`arc-card relative border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-5 md:p-7 ${
        isNear ? "arc-card-near" : ""
      } ${action.resolved ? "arc-card-resolved" : ""}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--wl-line)] pb-5">
        <div>
          <p className="font-mono text-[9px] tracking-[.16em] text-[var(--wl-signal)]">
            {shortAddress(item.id, { head: 8, tail: 4 })} · HUMAN REVIEW
          </p>
          <h2 className="mt-3 text-[21px] font-medium tracking-[-.045em]">{item.agentName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
              action.resolved
                ? "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
                : action.expiredUnsettled || action.expiryVerificationRequired
                  ? "border border-[var(--wl-amber)] text-[var(--wl-amber)]"
                  : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"
            }`}
          >
            {displayedStatus}
          </span>
          {action.resolved && (
            <span className="arc-stamp px-2 py-1 font-mono text-[8px] tracking-[.12em]">
              RECORDED
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-7 py-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            REQUEST
          </p>
          <p className="mt-3 text-[27px] font-medium tracking-[-.05em]">
            {amountLabel} <span className="text-[var(--wl-mute)]">→</span> {item.counterparty}
          </p>
          <p className="mt-4 text-[13px] text-[var(--wl-body)]">
            Reason: <span className="font-medium text-[var(--wl-ink)]">{item.reason}</span>
          </p>
        </div>
        <div className="border-l border-[var(--wl-line)] pl-5 md:pl-7">
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            QUORUM / {item.quorumRequired} SIGNATURES
          </p>
          <div className="mt-4 flex gap-2">
            <div className="flex min-h-[62px] flex-1 flex-col justify-between border border-[var(--wl-faint)] bg-[var(--wl-bg-soft)] p-3">
              <span className="font-mono text-[9px] text-[var(--wl-green)]">SIGNED</span>
              <span className="text-[11px] font-medium">{item.quorumCurrent}</span>
              <span className="font-mono text-[8px] text-[var(--wl-mute)]">
                of {item.quorumRequired}
              </span>
            </div>
            <div className="flex min-h-[62px] flex-1 flex-col justify-between border border-dashed border-[var(--wl-signal)] p-3">
              <span className="font-mono text-[9px] text-[var(--wl-mute)]">AWAITING</span>
              <span className="text-[11px] text-[var(--wl-secondary2)]">operator signature</span>
              <span className="font-mono text-[8px] text-[var(--wl-mute)]">-</span>
            </div>
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-[var(--wl-line)] pt-4">
            <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
              EXPIRY
            </span>
            <span
              className={`font-mono text-[12px] tabular-nums ${
                isNear ? "text-[var(--wl-signal)]" : "text-[var(--wl-body)]"
              }`}
            >
              {item.expiresIn}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--wl-line)] pt-5">
        {action.expiredUnsettled ? (
          <>
            <div className="w-full border-l-2 border-[var(--wl-amber)] bg-[var(--wl-bg-soft)] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-amber)]">
                EXPIRED · UNSWEPT
              </p>
              <p className="mt-2 text-[12px] leading-[1.5] text-[var(--wl-body)]">
                This request passed its expiry while still pending. Approve and reject are disabled;
                any connected wallet may settle expiry onchain.
              </p>
            </div>
            <button
              type="button"
              disabled={action.sweepActionsDisabled}
              onClick={(event) => void action.submitResolution("sweepExpired", event)}
              className="arc-pill min-h-11 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[10px] font-semibold text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-55 md:min-h-0"
            >
              Settle expired request
            </button>
          </>
        ) : action.expiryVerificationRequired ? (
          <div className="w-full border-l-2 border-[var(--wl-amber)] bg-[var(--wl-bg-soft)] p-4">
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-amber)]">
              EXPIRY · VERIFYING ONCHAIN
            </p>
            <p className="mt-2 text-[12px] leading-[1.5] text-[var(--wl-body)]">
              The read model has reached expiry. Decisions stay disabled until the canonical
              EscalationManager state is confirmed.
            </p>
          </div>
        ) : !action.resolved ? (
          <>
            <button
              type="button"
              disabled={action.actionsDisabled}
              onClick={(event) => void action.submitResolution("approve", event)}
              className="arc-pill min-h-11 md:min-h-0 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[10px] font-semibold text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={action.actionsDisabled}
              onClick={(event) => void action.submitResolution("reject", event)}
              className="arc-pill arc-ghost min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-55"
            >
              Reject
            </button>
            {action.ownerCanCancel ? (
              <button
                type="button"
                disabled={action.actionsDisabled}
                onClick={(event) => void action.submitResolution("cancel", event)}
                className="arc-pill arc-ghost min-h-11 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-55 md:min-h-0"
              >
                Cancel
              </button>
            ) : null}
          </>
        ) : (
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-green)]">
            FINAL DECISION COMMITTED TO LEDGER
          </span>
        )}
        <button
          type="button"
          onClick={() => void action.copyPortal()}
          className="ml-auto min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] tracking-[.08em] text-[var(--wl-secondary2)] transition-colors duration-[220ms] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
        >
          Copy approver portal link
        </button>
      </div>
      {action.statusLine ? (
        <div
          className={`mt-4 font-mono text-[9px] tracking-[.12em] ${
            action.actionError ? "text-[var(--wl-red)]" : "text-[var(--wl-mute)]"
          }`}
        >
          {action.statusLine}
        </div>
      ) : null}
      {item.votePending ? (
        <div className="mt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-amber)]">
          Vote recorded · quorum pending
        </div>
      ) : null}
      {action.contractTxHash && getArcscanTxUrl(action.contractTxHash) ? (
        <a
          href={getArcscanTxUrl(action.contractTxHash) ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
        >
          OPEN VOTE TX ↗
        </a>
      ) : null}
      <div className="mt-5 font-mono text-[9px] text-[var(--wl-mute)]">
        CREATED {formatFooterTimestamp(item.createdAt)}{" "}
        <span className="mx-2 text-[var(--wl-line)]">·</span> EXPIRES{" "}
        {formatFooterTimestamp(item.expiresAt)}
      </div>
    </article>
  );
}
