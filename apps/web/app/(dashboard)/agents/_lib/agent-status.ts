import type { Agent } from "@/lib/types";

export type AgentDisplayStatus = "ACTIVE" | "FROZEN" | "IDLE";
export type AgentFilterStatus = "ALL" | AgentDisplayStatus;

export function agentStatus(agent: Agent): AgentDisplayStatus {
  if (agent.status === "frozen") {
    return "FROZEN";
  }
  return agent.posture > 0 || agent.dailySpend > 0 ? "ACTIVE" : "IDLE";
}
