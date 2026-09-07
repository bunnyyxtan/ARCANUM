import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import type { CSSProperties } from "react";

import { ConnectCta } from "@/components/warm/ConnectCta";

import type { AgentsController } from "../_hooks/use-agents-controller";
import { AgentRow } from "./agent-row";

type AgentsRegistryProps = Pick<
  AgentsController,
  | "visibleAgents"
  | "agents"
  | "selectedAgent"
  | "setSelectedId"
  | "readOnly"
  | "agentsQuery"
  | "openDeploy"
  | "clearFilters"
>;

export function AgentsRegistry(props: AgentsRegistryProps) {
  const { visibleAgents, agents, selectedAgent, agentsQuery } = props;
  return (
    <div className="agents-reveal" style={{ "--i": 2 } as CSSProperties}>
      <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            REGISTRY / {visibleAgents.length.toString().padStart(2, "0")}
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Agent register
          </h2>
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:inline">
          {ARC_NETWORK_BADGE.toLowerCase()}
        </span>
      </div>
      <div className="hidden grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] gap-3 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid">
        <span>Status</span>
        <span>Agent</span>
        <span>Posture</span>
        <span>Daily spend</span>
        <span>Categories</span>
        <span>Doctrine</span>
      </div>
      {props.readOnly ? (
        <ConnectCta className="border-b border-[var(--wl-line)] px-6 py-16 text-center" />
      ) : agentsQuery.isLoading ? (
        <div className="divide-y divide-[var(--wl-line-soft)]">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="grid animate-pulse gap-3 px-3 py-5 md:grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] md:items-center"
            >
              <div className="h-4 w-16 rounded-full bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-32 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-24 rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-28 rounded bg-[var(--wl-line-soft)]" />
            </div>
          ))}
        </div>
      ) : agentsQuery.isError ? (
        <div className="border-b border-[var(--wl-line)] py-16 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
            Registry read failed
          </p>
          <button
            type="button"
            onClick={() => void agentsQuery.refetch()}
            className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--wl-line-soft)]">
            {visibleAgents.map((agent, index) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                index={index}
                selected={selectedAgent?.id === agent.id}
                selectAgent={props.setSelectedId}
              />
            ))}
          </div>
          {visibleAgents.length === 0 && (
            <div className="border-b border-[var(--wl-line)] py-16 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                {agents.length === 0 ? "No governed wallets yet" : "No agents match this view"}
              </p>
              {agents.length === 0 ? (
                <button
                  type="button"
                  onClick={props.openDeploy}
                  className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                >
                  Deploy your first governed wallet
                </button>
              ) : (
                <button
                  type="button"
                  onClick={props.clearFilters}
                  className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
