import Link from "next/link";
import type { CSSProperties } from "react";

import { formatUsd } from "@/lib/format/money";
import type { Agent } from "@/lib/types";

import { StatusPill } from "@/components/arcanum/status-pill";
import { agentStatus } from "../_lib/agent-status";

interface AgentRowProps {
  agent: Agent;
  index: number;
  selected: boolean;
  selectAgent: (id: string) => void;
}

export function AgentRow({ agent, index, selected, selectAgent }: AgentRowProps) {
  const status = agentStatus(agent);
  const postureWidth = Math.max(0, Math.min(100, agent.posture)) / 100;
  const capWidth = agent.dailyLimit > 0 ? Math.min(1, agent.dailySpend / agent.dailyLimit) : 0;
  return (
    <button
      type="button"
      onClick={() => selectAgent(agent.id)}
      style={{ "--i": index + 3 } as CSSProperties}
      className={`agent-row agents-reveal grid w-full gap-4 px-3 py-5 text-left max-md:block md:grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] md:items-center ${
        selected ? "bg-[var(--wl-bg-soft)] shadow-[inset_2px_0_0_var(--wl-signal)]" : ""
      }`}
    >
      <div className="max-md:mb-4">
        <StatusPill
          status={status}
          tone={status === "ACTIVE" ? "active" : status === "FROZEN" ? "frozen" : "idle"}
        />
      </div>
      <div className="max-md:mb-4">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Agent
        </span>
        <p className="text-[13px] font-medium">
          <Link
            href={`/agents/${agent.wallet}`}
            onClick={(event) => event.stopPropagation()}
            className="transition-colors hover:text-[var(--wl-signal)]"
          >
            {agent.name}
          </Link>
        </p>
        <p className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">
          {agent.wallet.length > 12
            ? `${agent.wallet.slice(0, 6)}…${agent.wallet.slice(-4)}`
            : agent.wallet}
        </p>
      </div>
      <div className="max-md:mb-4">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Posture
        </span>
        <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
          <span>{agent.posture}/100</span>
          <span className="text-[var(--wl-mute)]">posture</span>
        </div>
        <div className="meter mt-2 w-full max-w-[90px]">
          <span style={{ transform: `scaleX(${postureWidth})` }} />
        </div>
      </div>
      <div className="max-md:mb-4">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Daily spend
        </span>
        <span className="font-mono text-[11px] tabular-nums">{formatUsd(agent.dailySpend)}</span>
        <span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
          of {formatUsd(agent.dailyLimit)}
        </span>
        <div className="meter mt-1.5 w-full max-w-[90px]">
          <span style={{ transform: `scaleX(${capWidth})` }} />
        </div>
      </div>
      <div className="max-md:mb-4">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Categories
        </span>
        <div className="flex flex-wrap gap-1">
          {agent.categories.length > 0 ? (
            agent.categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-[var(--wl-line)] px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] text-[var(--wl-secondary)]"
              >
                {category}
              </span>
            ))
          ) : (
            <span className="font-mono text-[9px] text-[var(--wl-mute)]">-</span>
          )}
        </div>
      </div>
      <div>
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Doctrine
        </span>
        <p className="text-[11px] text-[var(--wl-body)]">{agent.mandate}</p>
        <p className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">{agent.doctrineVersion}</p>
      </div>
    </button>
  );
}
