"use client";

import { useEffect, useState } from "react";

import { useWorkspaceMode } from "@/lib/auth-session";
import { shortAddress } from "@/lib/format/address";
import { usdcNumber } from "@/lib/format/money";
import { formatTimestampOrNA, toIsoTimestamp } from "@/lib/format/time";
import { trpc } from "@/lib/trpc";
import type {
  Agent,
  AgentStatus,
  Anomaly,
  Category,
  Escalation,
  GovernanceEvent,
  LedgerEntry,
  LedgerStatus,
  TeamMember,
  Vendor,
} from "@/lib/types";

function normalizeCategory(category: string | null | undefined): Category {
  if (
    category === "api" ||
    category === "compute" ||
    category === "data" ||
    category === "subcontracting" ||
    category === "other"
  ) {
    return category;
  }
  return "other";
}

function categoryLabel(category: Category) {
  if (category === "subcontracting") {
    return "SUBCONTRACTING";
  }

  return category.toUpperCase();
}

const knownAgents: Record<string, string> = {
  "30000000-0000-4000-8000-000000000001": "ResearchAgent",
  "30000000-0000-4000-8000-000000000002": "MarketingAgent",
  "30000000-0000-4000-8000-000000000003": "DevAgent-01",
  "30000000-0000-4000-8000-000000000004": "TreasuryRebalancer",
  "30000000-0000-4000-8000-000000000005": "CustomerSupportAgent",
};

const knownVendors: Record<string, string> = {
  "0x71c700000000000000000000000000000000fe19": "OpenAI",
  "0x4a2b000000000000000000000000000000008c0d": "Anthropic",
  "0x3f1900000000000000000000000000000000aa52": "Tavily",
  "0xab0900000000000000000000000000000000cd44": "GitHub",
  "0x9dd400000000000000000000000000000000b71a": "AWS Bedrock",
  "0x88e10000000000000000000000000000000007bb": "Cloudflare",
  "0x77fa0000000000000000000000000000000012dd": "Vercel",
  "0x6b880000000000000000000000000000000014ec": "Pinecone",
  "0x22ad000000000000000000000000000000009f31": "Cohere",
  "0x1234000000000000000000000000000000005678": "Stripe",
  "evil-data-broker.com": "evil-data-broker.com",
};

function agentName(agentId: string | null | undefined, fallback = "Agent") {
  return agentId ? (knownAgents[agentId] ?? fallback) : fallback;
}

function vendorName(address: string | null | undefined) {
  return address ? (knownVendors[address.toLowerCase()] ?? shortAddress(address)) : "Counterparty";
}

function agentStatus(status: string): AgentStatus {
  if (status === "frozen") {
    return "frozen";
  }
  return "watch";
}

function ledgerStatus(verdict: string): LedgerStatus {
  if (verdict === "DENY") {
    return "rejected";
  }
  if (verdict === "ESCALATE") {
    return "escalated";
  }
  if (verdict === "FREEZE") {
    return "frozen";
  }
  return "approved";
}

type LiveTransferRow = {
  id: string;
  agentId: string | null;
  walletId: string;
  toAddress: string;
  vendorCategory: string;
  verdict: string;
  amount: string | number;
  reason: string;
  timestamp: Date | string;
  txHash: string;
  blockNumber: number;
};

function ledgerEntryFromTransfer(entry: LiveTransferRow): LedgerEntry {
  const status = ledgerStatus(entry.verdict);
  return {
    id: entry.id,
    agentId: entry.agentId ?? entry.walletId,
    agentName: agentName(entry.agentId, "Wallet"),
    counterparty: vendorName(entry.toAddress),
    category: normalizeCategory(entry.vendorCategory),
    action: entry.verdict,
    amount: usdcNumber(entry.amount),
    status,
    reason: entry.reason,
    timestamp: formatTimestampOrNA(entry.timestamp),
    hash: entry.txHash,
    block: entry.blockNumber,
    gasUsed: "INDEXED",
    calldata: "0x",
  };
}

function severityFromStatus(status: LedgerStatus): GovernanceEvent["severity"] {
  if (status === "approved") {
    return "success";
  }
  if (status === "rejected" || status === "frozen") {
    return "danger";
  }
  return "warning";
}

function useLiveQueriesEnabled() {
  const [enabled, setEnabled] = useState(false);
  const workspace = useWorkspaceMode();

  useEffect(() => {
    setEnabled(workspace.isAuthenticated);
  }, [workspace.isAuthenticated]);

  return enabled;
}

export function useLiveAgents() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.agents.list.useQuery(undefined, { enabled, retry: false, staleTime: 30_000 });
  const agents: Agent[] = (enabled ? (query.data ?? []) : []).map((agent) => ({
    id: agent.id,
    name: agent.label,
    wallet: agent.signerAddress,
    owner: "Owner synced in Supabase",
    status: agentStatus(agent.status),
    posture: 0,
    dailySpend: 0,
    dailyLimit: 0,
    lastActivity: formatTimestampOrNA(agent.lastSeenAt),
    doctrineVersion: "pending indexer",
    mandate: agent.type.toUpperCase(),
    categories: [],
  }));
  return { ...query, data: agents };
}

export function useLiveLedger() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.ledger.list.useQuery(
    { page: 0, pageSize: 100 },
    { enabled, retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  );
  const ledger: LedgerEntry[] = (enabled ? (query.data ?? []) : []).map(ledgerEntryFromTransfer);
  return { ...query, data: ledger };
}

export function useLiveLedgerByWallet(wallet: string | null | undefined) {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.ledger.byWallet.useQuery(
    { wallet: wallet ?? "0x0000000000000000000000000000000000000000", page: 0, pageSize: 100 },
    {
      enabled: enabled && Boolean(wallet),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const ledger: LedgerEntry[] = (enabled && wallet ? (query.data ?? []) : []).map(
    ledgerEntryFromTransfer,
  );
  return { ...query, data: ledger };
}

export function useLiveEscalations(status?: "PENDING" | "EXECUTED" | "REJECTED" | "EXPIRED") {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.escalations.list.useQuery(status ? { status } : undefined, {
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 30_000,
  });
  const escalations: Escalation[] = (enabled ? (query.data ?? []) : []).map((item) => ({
    id: item.id,
    agentId: item.walletId,
    agentName: agentName(item.transferId, "ResearchAgent"),
    wallet: item.walletId,
    amount: usdcNumber(item.amount),
    counterparty: vendorName(item.toAddress),
    category: "compute",
    reason: item.reason,
    quorumCurrent: item.signaturesCount,
    quorumRequired: item.threshold,
    deviation: 0,
    expiresAt: toIsoTimestamp(item.expiresAt),
    expiresIn: formatTimestampOrNA(item.expiresAt),
    expiryPercent: item.status === "PENDING" ? 50 : 100,
  }));
  return { ...query, data: escalations };
}

export function useLiveAnomalies() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.anomalies.list.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 30_000,
  });
  const anomalies: Anomaly[] = (enabled ? (query.data ?? []) : []).map((item, index) => ({
    id: item.id,
    agentId: item.agentId ?? item.walletId,
    agentName: agentName(item.agentId, "Agent"),
    score: Number(item.sigma),
    narrative: item.reason,
    suggestedAction: item.severity === "danger" ? "freeze" : "investigate",
    points: [1.1, 2.4, 3.2, Number(item.sigma)],
    flaggedPoint: 3,
    timestamp: formatTimestampOrNA(item.createdAt),
  }));
  return { ...query, data: anomalies };
}

export function useLiveVendors() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.vendors.list.useQuery(undefined, { enabled, retry: false, staleTime: 30_000 });
  const vendors: Vendor[] = (enabled ? (query.data ?? []) : []).map((vendor) => ({
    id: vendor.id,
    name: String(vendor.name ?? vendorName(vendor.address)),
    address: vendor.address,
    category: normalizeCategory(vendor.category),
    trust:
      vendor.status === "blocked"
        ? "blocked"
        : vendor.perVendorCap !== "0"
          ? "confidential"
          : "approved",
    approvedBy: [vendor.addedBy],
    confidential: vendor.perVendorCap !== "0",
    lastUsed: formatTimestampOrNA(vendor.addedAt),
    walletAddress:
      "walletAddress" in vendor && typeof vendor.walletAddress === "string"
        ? vendor.walletAddress
        : undefined,
  }));
  return { ...query, data: vendors };
}

export function useLiveEvents() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.events.list.useQuery(
    { page: 0, pageSize: 50 },
    { enabled, retry: false, staleTime: 30_000 },
  );
  const events: GovernanceEvent[] = (enabled ? (query.data ?? []) : []).map((event) => {
    const status = ledgerStatus(event.type.includes("ESCALATED") ? "ESCALATE" : "ALLOW");
    return {
      id: event.id,
      label: event.type,
      actor: event.walletId ?? "Arc Testnet",
      counterparty: event.txHash,
      category: "other",
      amount: 0,
      status,
      timestamp: formatTimestampOrNA(event.timestamp),
      severity:
        event.severity === "danger" || event.severity === "warning" || event.severity === "success"
          ? event.severity
          : severityFromStatus(status),
    };
  });
  return { ...query, data: events };
}

export function useLiveMembers() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.org.listMembers.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const members: TeamMember[] = (enabled ? (query.data ?? []) : []).map((user) => ({
    id: user.id,
    name: user.displayName,
    initials: user.displayName.slice(0, 2).toUpperCase(),
    email: `${user.walletAddress.slice(0, 6)}@helixdao.eth`,
    role: user.role === "owner" ? "admin" : user.role === "viewer" ? "viewer" : "approver",
    wallet: user.walletAddress,
    status: "active",
    lastActive: formatTimestampOrNA(user.createdAt),
  }));
  return { ...query, data: members };
}

export function useLiveOrg() {
  const enabled = useLiveQueriesEnabled();
  return trpc.org.getCurrent.useQuery(undefined, { enabled, retry: false, staleTime: 30_000 });
}

export function useLiveDashboardMetrics() {
  const enabled = useLiveQueriesEnabled();
  const posture = trpc.analytics.postureIndex.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const valueGoverned = trpc.analytics.valueGoverned24h.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const activeAgents = trpc.analytics.activeAgents.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const threatsBlocked = trpc.analytics.threatsBlocked24h.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const pendingEscalations = trpc.analytics.pendingEscalations.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 30_000,
  });

  return {
    postureIndex: enabled ? (posture.data ?? 0) : 0,
    valueGoverned: enabled ? usdcNumber(valueGoverned.data ?? "0") : 0,
    activeAgents: enabled ? (activeAgents.data ?? 0) : 0,
    threatsBlocked: enabled ? (threatsBlocked.data ?? 0) : 0,
    pendingEscalations: enabled ? (pendingEscalations.data ?? 0) : 0,
    isLoading:
      posture.isLoading ||
      valueGoverned.isLoading ||
      activeAgents.isLoading ||
      threatsBlocked.isLoading ||
      pendingEscalations.isLoading,
    isError:
      posture.isError ||
      valueGoverned.isError ||
      activeAgents.isError ||
      threatsBlocked.isError ||
      pendingEscalations.isError,
  };
}
