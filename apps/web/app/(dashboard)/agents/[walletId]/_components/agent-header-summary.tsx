import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties } from "react";

import { formatUsd } from "@/lib/format/money";

import type { AgentDetailController } from "../_hooks/use-agent-detail-controller";
import { Arrow } from "./detail-primitives";

export function AgentHeaderSummary({ controller }: { controller: AgentDetailController }) {
  const {
    agent,
    agentName,
    approvedCount,
    dailyLimit,
    dailySpend,
    decisions,
    frozen,
    governedWalletAddress,
    rejectedCount,
  } = controller;
  return (
    <>
      <div
        className="detail-in flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
        style={{ "--i": 0 } as CSSProperties}
      >
        <div>
          <Link
            href="/agents"
            className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
          >
            ← Agent register
          </Link>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            DOSSIER / GOVERNED WALLET
          </p>
          <h1 className="font-display mt-4 text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[.86] tracking-[-.015em]">
            {agentName}
          </h1>
          <p className="mt-5 max-w-[510px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            {agent?.mandate
              ? `${agent.mandate}. Observable limits, no unreviewed drift.`
              : "A governed wallet with observable limits and a legible policy trail."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {frozen ? (
            <span
              title="This wallet is frozen onchain. Restraint changes are submitted onchain by the governed wallet owner; this console reflects the onchain record."
              className="cursor-help rounded-full bg-[var(--wl-ink)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-bg)]"
            >
              FROZEN · ONCHAIN RESTRAINT
            </span>
          ) : null}
          <Link
            href={governedWalletAddress ? `/agents/${governedWalletAddress}/policy` : "/agents"}
            className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white"
          >
            Edit policy
            <Arrow />
          </Link>
        </div>
      </div>
      <section className="grid border-b border-[var(--wl-line)] md:grid-cols-4">
        {(
          [
            [
              "POSTURE",
              `${agent?.posture ?? 0} / 100`,
              agent ? ARC_NETWORK_BADGE.toLowerCase() : "invalid route",
            ],
            ["TODAY'S SPEND", formatUsd(dailySpend), `of ${formatUsd(dailyLimit)} cap`],
            [
              "DECISIONS",
              decisions.length.toString(),
              `${approvedCount} approved · ${rejectedCount} rejected`,
            ],
            [
              "GOVERNANCE",
              frozen ? "FROZEN" : "ACTIVE",
              frozen
                ? "operator restraint"
                : (agent?.doctrineVersion ?? ARC_NETWORK_BADGE.toLowerCase()),
            ],
          ] as const
        ).map(([label, value, note], index) => (
          <div
            key={label}
            className={`detail-in min-h-[130px] border-b border-[var(--wl-line)] py-6 md:border-b-0 ${index ? "md:border-l md:pl-6" : "md:pr-6"}`}
            style={{ "--i": index + 1 } as CSSProperties}
          >
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
              {label}
            </p>
            <p
              className={`font-display mt-5 text-[27px] font-semibold tracking-[-.015em] tabular-nums ${label === "GOVERNANCE" && frozen ? "text-[var(--wl-signal)]" : ""}`}
            >
              {value}
            </p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
              {note}
            </p>
          </div>
        ))}
      </section>
    </>
  );
}
