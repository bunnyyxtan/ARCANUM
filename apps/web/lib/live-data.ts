"use client";

import { useEffect, useMemo, useState } from "react";

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

function agentName(agentId: string | null | undefined, fallback = "Agent") {
  return fallback;
}

function vendorName(address: string | null | undefined) {
  return address ? shortAddress(address) : "Counterparty";
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
    counterpartyAddress: entry.toAddress,
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
  const query = trpc.agents.list.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  // Shares react-query's cache with useLiveLedger, so this costs no extra request.
  const ledgerQuery = trpc.ledger.list.useQuery(
    { page: 0, pageSize: 100 },
    { enabled, retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  );

  const walletAddressById = new Map(
    (enabled ? (walletsQuery.data ?? []) : []).map((wallet) => [wallet.id, wallet.address]),
  );

  const transfers = enabled ? (ledgerQuery.data ?? []) : [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const spendByWallet = new Map<string, number>();
  const lastSeenByWallet = new Map<string, number>();

  for (const transfer of transfers) {
    const at = new Date(transfer.timestamp ?? 0).getTime();
    if (Number.isFinite(at)) {
      lastSeenByWallet.set(
        transfer.walletId,
        Math.max(lastSeenByWallet.get(transfer.walletId) ?? 0, at),
      );
    }
    if (transfer.verdict === "ALLOW" && at >= dayAgo) {
      spendByWallet.set(
        transfer.walletId,
        (spendByWallet.get(transfer.walletId) ?? 0) + usdcNumber(transfer.amount),
      );
    }
  }

  const agents: Agent[] = (enabled ? (query.data ?? []) : []).map((agent) => {
    const lastSeen = lastSeenByWallet.get(agent.walletId);
    return {
      id: agent.id,
      name: agent.label,
      // Routes and on-chain reads key on the governed wallet, not the signer key.
      wallet: walletAddressById.get(agent.walletId) ?? agent.walletId,
      signer: agent.signerAddress,
      owner: "Owner synced in Supabase",
      status: agentStatus(agent.status),
      posture: agent.postureScore ?? 0,
      dailySpend: spendByWallet.get(agent.walletId) ?? 0,
      dailyLimit: agent.daily24hCap === null ? 0 : usdcNumber(agent.daily24hCap),
      lastActivity: lastSeen ? formatTimestampOrNA(new Date(lastSeen)) : "No activity yet",
      doctrineVersion: agent.policyVersion === null ? "unknown" : `v${agent.policyVersion}`,
      mandate: agent.type.toUpperCase(),
      categories: [],
    };
  });
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
  // Deliberately NOT gated on an authenticated workspace: the public explorer
  // and badge pages call this for a wallet address anyone may inspect, and
  // ledger.byWallet is a public procedure that scopes to that address.
  const query = trpc.ledger.byWallet.useQuery(
    {
      wallet: wallet ?? "0x0000000000000000000000000000000000000000",
      page: 0,
      pageSize: 100,
    },
    {
      enabled: Boolean(wallet),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const ledger: LedgerEntry[] = (wallet ? (query.data ?? []) : []).map(ledgerEntryFromTransfer);
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
    agentName: agentName(item.transferId, "Governed Wallet"),
    wallet: item.walletId,
    amount: usdcNumber(item.amount),
    counterparty: vendorName(item.toAddress),
    category: "compute",
    reason: item.reason,
    quorumCurrent: item.signaturesCount,
    quorumRequired: item.threshold,
    deviation: 0,
    createdAt: toIsoTimestamp(item.createdAt),
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
    points: [0, 0, 0, Number(item.sigma)],
    flaggedPoint: 3,
    timestamp: formatTimestampOrNA(item.createdAt),
  }));
  return { ...query, data: anomalies };
}

export function useLiveVendors() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.vendors.list.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
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
    createdAt: formatTimestampOrNA(vendor.addedAt),
    lastUsed: "Never used",
    walletAddress:
      "walletAddress" in vendor && typeof vendor.walletAddress === "string"
        ? vendor.walletAddress
        : undefined,
  }));
  return { ...query, data: vendors };
}

export type VendorFlagDetail = {
  flaggedBy: string;
  flaggedByShort: string;
  flaggedAt: string;
  note: string | null;
  /** Set whenever the note has been edited after flagging. */
  noteEditedBy: string | null;
  noteEditedByShort: string | null;
  noteEditedAt: string | null;
};

export type VendorUnflagDetail = {
  removedBy: string;
  removedByShort: string;
  removedAt: string;
};

function flagDateLabel(value: Date | string | null | undefined) {
  if (!value) {
    return "N/A";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function useVendorFlags() {
  const enabled = useLiveQueriesEnabled();
  const query = trpc.vendorFlags.list.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
  const { flaggedAddresses, flagDetails, unflagDetails } = useMemo(() => {
    const addresses = new Set<string>();
    const details = new Map<string, VendorFlagDetail>();
    const removed = new Map<string, VendorUnflagDetail>();
    for (const flag of enabled ? (query.data ?? []) : []) {
      const address = flag.vendorAddress.toLowerCase();
      const removedBy =
        "removedBy" in flag && typeof flag.removedBy === "string" ? flag.removedBy : null;
      if (removedBy) {
        // Soft-deleted row: the flag was cleared. Surface who removed it and
        // when instead of treating the vendor as flagged.
        removed.set(address, {
          removedBy,
          removedByShort: shortAddress(removedBy),
          removedAt: flagDateLabel("removedAt" in flag ? (flag.removedAt ?? null) : null),
        });
        continue;
      }
      addresses.add(address);
      const noteUpdatedBy =
        "noteUpdatedBy" in flag && typeof flag.noteUpdatedBy === "string"
          ? flag.noteUpdatedBy
          : null;
      details.set(address, {
        flaggedBy: flag.flaggedBy,
        flaggedByShort: shortAddress(flag.flaggedBy),
        flaggedAt: flagDateLabel(flag.createdAt),
        note:
          "note" in flag && typeof flag.note === "string" && flag.note.trim() !== ""
            ? flag.note
            : null,
        noteEditedBy: noteUpdatedBy,
        noteEditedByShort: noteUpdatedBy ? shortAddress(noteUpdatedBy) : null,
        noteEditedAt: noteUpdatedBy
          ? flagDateLabel("noteUpdatedAt" in flag ? (flag.noteUpdatedAt ?? null) : null)
          : null,
      });
    }
    return {
      flaggedAddresses: addresses,
      flagDetails: details,
      unflagDetails: removed,
    };
  }, [enabled, query.data]);
  return { ...query, flaggedAddresses, flagDetails, unflagDetails };
}

export type VendorFlagHistoryEntry = {
  id: string;
  eventType: "flagged" | "note_updated" | "unflagged";
  actor: string;
  actorShort: string;
  note: string | null;
  at: string;
};

const flagEventLabels: Record<VendorFlagHistoryEntry["eventType"], string> = {
  flagged: "Flagged for review",
  note_updated: "Note updated",
  unflagged: "Flag cleared",
};

export function vendorFlagEventLabel(eventType: VendorFlagHistoryEntry["eventType"]) {
  return flagEventLabels[eventType];
}

// Append-only review trail for one vendor — every flag / note edit / unflag,
// newest first, preserved across re-flag cycles.
export function useVendorFlagHistory(vendorAddress: string | null) {
  const enabled = useLiveQueriesEnabled();
  const normalized = vendorAddress ? vendorAddress.toLowerCase() : null;
  const query = trpc.vendorFlags.history.useQuery(
    { vendorAddress: normalized ?? "" },
    {
      enabled: enabled && Boolean(normalized && /^0x[a-fA-F0-9]{40}$/.test(normalized)),
      retry: false,
      staleTime: 30_000,
    },
  );
  const entries = useMemo<VendorFlagHistoryEntry[]>(
    () =>
      (query.data ?? []).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actor: event.actor,
        actorShort: shortAddress(event.actor),
        note: typeof event.note === "string" && event.note.trim() !== "" ? event.note : null,
        at: flagDateLabel(event.createdAt),
      })),
    [query.data],
  );
  return { ...query, entries };
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
  return trpc.org.getCurrent.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 30_000,
  });
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
