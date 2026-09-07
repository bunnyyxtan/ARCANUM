"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";

import { isSameAddress, shortAddress } from "@/lib/format/address";
import { useLiveAgents, useLiveLedgerByWallet } from "@/lib/live-data";
import type { LedgerEntry } from "@/lib/types";

import { getBehaviorMetrics, resolveGovernedWalletAddress } from "../_lib/agent-detail-helpers";

function useAgentDetailControllerInternal() {
  const params = useParams();
  const governedWalletAddress = resolveGovernedWalletAddress(params.walletId);
  const walletValue = governedWalletAddress ?? params.walletId?.toString() ?? "";
  const agentsQuery = useLiveAgents();
  const ledgerQuery = useLiveLedgerByWallet(walletValue || null);
  const agent = useMemo(
    () =>
      agentsQuery.data.find(
        (item) => isSameAddress(item.wallet, walletValue) || item.id === walletValue,
      ) ?? null,
    [agentsQuery.data, walletValue],
  );
  const decisions: LedgerEntry[] = ledgerQuery.data;
  const frozen = agent?.status === "frozen";
  const dailySpend = agent?.dailySpend ?? 0;
  const dailyLimit = agent?.dailyLimit ?? 0;

  return {
    governedWalletAddress,
    agent,
    decisions,
    ledgerQuery,
    frozen,
    agentName:
      agent?.name ??
      (governedWalletAddress
        ? `Governed Wallet ${shortAddress(governedWalletAddress)}`
        : "Invalid wallet"),
    approvedCount: decisions.filter((decision) => decision.status === "approved").length,
    rejectedCount: decisions.filter((decision) => decision.status === "rejected").length,
    dailySpend,
    dailyLimit,
    capWidth: dailyLimit > 0 ? Math.min(1, dailySpend / dailyLimit) : 0,
    behavior: getBehaviorMetrics(decisions),
  };
}

export type AgentDetailController = ReturnType<typeof useAgentDetailControllerInternal>;

export function useAgentDetailController(): AgentDetailController {
  return useAgentDetailControllerInternal();
}
