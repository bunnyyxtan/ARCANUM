import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties } from "react";

import { formatUsd } from "@/lib/format/money";

import type { AgentsController } from "../_hooks/use-agents-controller";
import { Arrow, StatusPill } from "./agent-ui";

type AgentDetailPanelProps = Pick<AgentsController, "selectedAgent" | "selectedStatus">;

export function AgentDetailPanel({ selectedAgent, selectedStatus }: AgentDetailPanelProps) {
  return (
    <aside
      className="agents-reveal bg-[var(--wl-bg-soft)] p-6 md:p-7"
      style={{ "--i": 3 } as CSSProperties}
    >
      {selectedAgent ? (
        <>
          <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                SELECTED WALLET
              </p>
              <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                {selectedAgent.name}
              </h2>
            </div>
            <StatusPill status={selectedStatus} />
          </div>
          <div className="border-b border-[var(--wl-line)] py-6">
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              DOCTRINE SNAPSHOT
            </p>
            <p className="mt-3 text-[13px] leading-[1.5] text-[var(--wl-body)]">
              {selectedAgent.mandate} · {selectedAgent.owner}
            </p>
            <p className="mt-4 font-mono text-[9px] text-[var(--wl-mute)]">
              {selectedAgent.wallet} · USDC
            </p>
          </div>
          <div className="grid grid-cols-2 gap-y-5 border-b border-[var(--wl-line)] py-6">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                DAILY SPEND
              </p>
              <p className="mt-2 font-mono text-[13px]">{formatUsd(selectedAgent.dailySpend)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                DAILY CAP
              </p>
              <p className="mt-2 font-mono text-[13px]">{formatUsd(selectedAgent.dailyLimit)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                POSTURE
              </p>
              <p className="mt-2 font-mono text-[13px]">{selectedAgent.posture} / 100</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                NETWORK
              </p>
              <p className="mt-2 font-mono text-[13px]">{ARC_NETWORK_BADGE}</p>
            </div>
          </div>
          <div className="py-6">
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              LAST ACTIVITY
            </p>
            <p className="mt-3 text-[12px] text-[var(--wl-body)]">{selectedAgent.lastActivity}</p>
          </div>
          <div className="flex gap-2 border-t border-[var(--wl-line)] pt-5">
            <Link
              href={`/agents/${selectedAgent.wallet}`}
              className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[11px] font-semibold"
            >
              Open dossier
            </Link>
            <Link
              href={`/agents/${selectedAgent.wallet}/policy`}
              className="warm-pill group rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[11px] font-semibold text-white"
            >
              Edit policy
              <Arrow />
            </Link>
          </div>
        </>
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            No wallet selected
          </p>
          <p className="mt-3 max-w-[240px] text-[12px] text-[var(--wl-body)]">
            Deploy a governed wallet to begin tracking agent spend under policy.
          </p>
        </div>
      )}
    </aside>
  );
}
