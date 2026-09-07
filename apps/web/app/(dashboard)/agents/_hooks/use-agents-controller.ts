"use client";

import { useMemo, useState } from "react";

import { useWorkspaceMode } from "@/lib/auth-session";
import { useLiveAgents } from "@/lib/live-data";

import { type AgentFilterStatus, agentStatus } from "../_lib/agent-status";

function useAgentsControllerInternal() {
  const { dataMode, isResolving } = useWorkspaceMode();
  const agentsQuery = useLiveAgents();
  const agents = agentsQuery.data;
  const [filter, setFilter] = useState<AgentFilterStatus>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);

  const visibleAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const matchesFilter = filter === "ALL" || agentStatus(agent) === filter;
        const matchesQuery = agent.name.toLowerCase().includes(query.toLowerCase());
        return matchesFilter && matchesQuery;
      }),
    [agents, filter, query],
  );

  const selectedAgent =
    agents.find((agent) => agent.id === selectedId) ?? visibleAgents[0] ?? agents[0] ?? null;

  return {
    agentsQuery,
    agents,
    visibleAgents,
    selectedAgent,
    selectedStatus: selectedAgent ? agentStatus(selectedAgent) : ("IDLE" as const),
    readOnly: dataMode === "disconnected" && !isResolving,
    filter,
    setFilter,
    query,
    setQuery,
    setSelectedId,
    deployOpen,
    openDeploy: () => setDeployOpen(true),
    closeDeploy: () => setDeployOpen(false),
    clearFilters: () => {
      setFilter("ALL");
      setQuery("");
    },
    totalCount: agents.length,
    activeCount: agents.filter((agent) => agentStatus(agent) === "ACTIVE").length,
    frozenCount: agents.filter((agent) => agentStatus(agent) === "FROZEN").length,
    idleCount: agents.filter((agent) => agentStatus(agent) === "IDLE").length,
  };
}

export type AgentsController = ReturnType<typeof useAgentsControllerInternal>;

export function useAgentsController(): AgentsController {
  return useAgentsControllerInternal();
}
