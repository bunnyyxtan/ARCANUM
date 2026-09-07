"use client";

import { ARC_NETWORK_NAME } from "@arcanum/shared";

import { DeployWalletModal } from "@/components/warm/DeployWalletModal";

import { AgentDetailPanel } from "./_components/agent-detail-panel";
import { AgentsFilters } from "./_components/agents-filters";
import { AgentsHeader, AgentsSummary } from "./_components/agents-header";
import { AgentsRegistry } from "./_components/agents-registry";
import { useAgentsController } from "./_hooks/use-agents-controller";

export default function AgentsPage() {
  const agents = useAgentsController();
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .agents-reveal{animation:agentsIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms) both}@keyframes agentsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .agent-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.agent-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}.meter{height:4px;background:var(--wl-line-soft)}.meter>span{display:block;height:100%;background:var(--wl-ink);transform-origin:left;transition:transform 420ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.agents-reveal,.agent-row{animation:none;transition:none}}
      `}</style>
      <div id="top" className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <AgentsHeader openDeploy={agents.openDeploy} />
        <AgentsSummary
          totalCount={agents.totalCount}
          activeCount={agents.activeCount}
          frozenCount={agents.frozenCount}
          idleCount={agents.idleCount}
        />
        <AgentsFilters
          filter={agents.filter}
          setFilter={agents.setFilter}
          query={agents.query}
          setQuery={agents.setQuery}
        />
        <section className="grid gap-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
          <AgentsRegistry
            visibleAgents={agents.visibleAgents}
            agents={agents.agents}
            selectedAgent={agents.selectedAgent}
            setSelectedId={agents.setSelectedId}
            readOnly={agents.readOnly}
            agentsQuery={agents.agentsQuery}
            openDeploy={agents.openDeploy}
            clearFilters={agents.clearFilters}
          />
          <AgentDetailPanel
            selectedAgent={agents.selectedAgent}
            selectedStatus={agents.selectedStatus}
          />
        </section>

        <footer className="mt-14 flex flex-col justify-between gap-4 border-t border-[var(--wl-line)] pt-5 text-[11px] text-[var(--wl-secondary)] sm:flex-row">
          <span className="font-mono uppercase tracking-[.14em]">
            {agents.totalCount} governed wallet{agents.totalCount === 1 ? "" : "s"} ·{" "}
            {agents.activeCount} active now
          </span>
          <span>{ARC_NETWORK_NAME} registry</span>
        </footer>
      </div>

      {agents.deployOpen && <DeployWalletModal onClose={agents.closeDeploy} />}
    </main>
  );
}
