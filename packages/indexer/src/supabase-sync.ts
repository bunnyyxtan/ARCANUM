/**
 * Supabase read-model sync for the Ponder indexer.
 *
 * The dashboard API reads activity from the Supabase tables `ledger_events`,
 * `escalations`, `anomalies`, and `indexer_checkpoints`. The indexer is the
 * only writer of on-chain activity into those tables. Every handler in
 * `index.ts` calls into this module so real Arc Testnet activity shows up in
 * the ledger and escalation queue.
 *
 * All writes are idempotent (select-then-insert keyed on tx_hash /
 * escalation_key) so re-indexing after a restart never duplicates rows.
 */

import { ARC_CHAIN_ID } from "@arcanum/shared";

const CHAIN_ID = ARC_CHAIN_ID;
const CHECKPOINT_CONTRACT = "arcanum-indexer";

type Row = Record<string, unknown>;

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

const supabaseUrl = (env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"))?.replace(/\/+$/, "");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

let warnedUnconfigured = false;

function configured() {
  if (supabaseUrl && serviceRoleKey) {
    return true;
  }
  if (!warnedUnconfigured) {
    warnedUnconfigured = true;
    console.error(
      "[supabase-sync] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured - on-chain activity will NOT reach the dashboard read model.",
    );
  }
  return false;
}

async function request(
  method: "GET" | "POST" | "PATCH",
  table: string,
  options?: {
    filters?: Record<string, string | number>;
    limit?: number;
    body?: Row | Row[];
  },
): Promise<Row[]> {
  const endpoint = new URL(`${supabaseUrl}/rest/v1/${table}`);
  endpoint.searchParams.set("select", "*");
  if (options?.limit) {
    endpoint.searchParams.set("limit", String(options.limit));
  }
  for (const [key, value] of Object.entries(options?.filters ?? {})) {
    endpoint.searchParams.set(key, `eq.${String(value)}`);
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: serviceRoleKey as string,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `[supabase-sync] ${table} ${method} failed with ${response.status}: ${body
        .replaceAll(serviceRoleKey ?? "__never__", "[redacted]")
        .slice(0, 300)}`,
    );
  }

  return (await response.json()) as Row[];
}

function str(row: Row | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : "";
}

/** On-chain USDC base units (6 decimals) -> decimal USDC used by the read model. */
function usdcDecimal(amountBaseUnits: bigint) {
  return Number(amountBaseUnits) / 1_000_000;
}

async function findGovernedWallet(walletAddress: string) {
  const [row] = await request("GET", "governed_wallets", {
    filters: { wallet_address: walletAddress.toLowerCase(), chain_id: CHAIN_ID },
    limit: 1,
  });
  return row ?? null;
}

/** Flip a wallet out of PENDING INDEXER once real events for it are observed. */
async function markWalletIndexed(wallet: Row, timestamp: Date, frozen?: boolean) {
  const walletId = str(wallet, "id");
  const now = new Date().toISOString();
  const status = frozen === undefined ? undefined : frozen ? "frozen" : "active";

  const currentStatus = str(wallet, "status");
  const patch: Row = { indexer_status: "synced", updated_at: now };
  if (status) {
    patch.status = status;
  } else if (currentStatus === "pending_indexer") {
    patch.status = "active";
  }
  await request("PATCH", "governed_wallets", { filters: { id: walletId }, body: patch });

  const grade =
    (status ?? (currentStatus === "frozen" ? "frozen" : "active")) === "frozen"
      ? "UNDER RESTRAINT"
      : "FORTIFIED";
  await request("PATCH", "public_wallet_profiles", {
    filters: { governed_wallet_id: walletId },
    body: { health_grade: grade, last_indexed_at: timestamp.toISOString(), updated_at: now },
  }).catch((error) => console.error(String(error)));
}

async function updateCheckpoint(blockNumber: number) {
  const [existing] = await request("GET", "indexer_checkpoints", {
    filters: { chain_id: CHAIN_ID, contract_name: CHECKPOINT_CONTRACT },
    limit: 1,
  });
  const now = new Date().toISOString();
  if (existing) {
    const lastBlock = Number(existing.last_block ?? 0);
    if (blockNumber <= lastBlock) {
      return;
    }
    await request("PATCH", "indexer_checkpoints", {
      filters: { id: str(existing, "id") },
      body: { last_block: blockNumber, status: "synced", updated_at: now },
    });
    return;
  }
  await request("POST", "indexer_checkpoints", {
    body: [
      {
        chain_id: CHAIN_ID,
        contract_name: CHECKPOINT_CONTRACT,
        contract_address: "0x0000000000000000000000000000000000000000",
        last_block: blockNumber,
        status: "synced",
        updated_at: now,
      },
    ],
  });
}

async function upsertLedgerEvent(input: {
  wallet: Row;
  txHash: string;
  status: "allowed" | "escalated" | "blocked" | "frozen";
  amount: bigint;
  counterpartyAddress: string;
  reason: string;
  blockNumber: number;
  timestamp: Date;
}): Promise<Row | null> {
  const [existing] = await request("GET", "ledger_events", {
    filters: { tx_hash: input.txHash.toLowerCase() },
    limit: 1,
  });
  if (existing) {
    return existing;
  }

  const [created] = await request("POST", "ledger_events", {
    body: [
      {
        organization_id: str(input.wallet, "organization_id"),
        governed_wallet_id: str(input.wallet, "id"),
        tx_hash: input.txHash.toLowerCase(),
        event_time: input.timestamp.toISOString(),
        agent_label: str(input.wallet, "label") || null,
        category: "other",
        counterparty_address: input.counterpartyAddress.toLowerCase(),
        amount_usdc: usdcDecimal(input.amount),
        status: input.status,
        decision_reason: input.reason,
        block_number: input.blockNumber,
        chain_id: CHAIN_ID,
        policy_snapshot: {},
        data_source: "live",
      },
    ],
  });
  return created ?? null;
}

/* ------------------------------------------------------------------ */
/* Public entry points called from the Ponder handlers                */
/* ------------------------------------------------------------------ */

export async function syncWalletCreated(walletAddress: string, timestamp: Date) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(walletAddress);
  if (!wallet) return;
  await markWalletIndexed(wallet, timestamp);
}

export async function syncTransferExecuted(input: {
  walletAddress: string;
  txHash: string;
  toAddress: string;
  amount: bigint;
  blockNumber: number;
  timestamp: Date;
}) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    console.warn(
      `[supabase-sync] no governed_wallets row for ${input.walletAddress}; skipping transfer ${input.txHash}`,
    );
    return;
  }
  await upsertLedgerEvent({
    wallet,
    txHash: input.txHash,
    status: "allowed",
    amount: input.amount,
    counterpartyAddress: input.toAddress,
    reason: "On-chain policy allowed the transfer.",
    blockNumber: input.blockNumber,
    timestamp: input.timestamp,
  });
  await markWalletIndexed(wallet, input.timestamp);
}

export async function syncTransferEscalated(input: {
  walletAddress: string;
  txHash: string;
  toAddress: string;
  amount: bigint;
  reason: string;
  escalationId: string;
  blockNumber: number;
  timestamp: Date;
  expiresAt: Date;
  /** Signatures the EscalationManager actually requires to release the hold. */
  quorumRequired: number;
}) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    console.warn(
      `[supabase-sync] no governed_wallets row for ${input.walletAddress}; skipping escalation ${input.escalationId}`,
    );
    return;
  }

  const ledgerEvent = await upsertLedgerEvent({
    wallet,
    txHash: input.txHash,
    status: "escalated",
    amount: input.amount,
    counterpartyAddress: input.toAddress,
    reason: input.reason || "Escalated by on-chain policy.",
    blockNumber: input.blockNumber,
    timestamp: input.timestamp,
  });

  const [existing] = await request("GET", "escalations", {
    filters: { escalation_key: input.escalationId },
    limit: 1,
  });
  if (!existing) {
    await request("POST", "escalations", {
      body: [
        {
          organization_id: str(wallet, "organization_id"),
          governed_wallet_id: str(wallet, "id"),
          ledger_event_id: ledgerEvent ? str(ledgerEvent, "id") : null,
          escalation_key: input.escalationId,
          amount_usdc: usdcDecimal(input.amount),
          category: "other",
          counterparty_address: input.toAddress.toLowerCase(),
          reason: input.reason || "Escalated by on-chain policy.",
          status: "pending",
          approvals_count: 0,
          quorum_required: input.quorumRequired,
          expires_at: input.expiresAt.toISOString(),
          created_at: input.timestamp.toISOString(),
          data_source: "live",
        },
      ],
    });
  }
  await markWalletIndexed(wallet, input.timestamp);
}

export async function syncEscalationApproval(escalationId: string, approvalsCount: number) {
  if (!configured()) return;
  const [existing] = await request("GET", "escalations", {
    filters: { escalation_key: escalationId },
    limit: 1,
  });
  if (!existing) return;
  await request("PATCH", "escalations", {
    filters: { id: str(existing, "id") },
    body: {
      approvals_count: Math.max(approvalsCount, Number(existing.approvals_count ?? 0)),
      updated_at: new Date().toISOString(),
    },
  });
}

export async function syncEscalationStatus(
  escalationId: string,
  status: "approved" | "denied" | "expired" | "released",
  txHash?: string,
) {
  if (!configured()) return;
  const [existing] = await request("GET", "escalations", {
    filters: { escalation_key: escalationId },
    limit: 1,
  });
  if (!existing) return;
  const patch: Row = { status, updated_at: new Date().toISOString() };
  if (txHash) {
    if (status === "released" || status === "approved") {
      patch.release_tx_hash = txHash.toLowerCase();
    }
    if (status === "denied") {
      patch.deny_tx_hash = txHash.toLowerCase();
    }
  }
  await request("PATCH", "escalations", { filters: { id: str(existing, "id") }, body: patch });
}

export async function syncWalletFrozenState(
  walletAddress: string,
  frozen: boolean,
  timestamp: Date,
) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(walletAddress);
  if (!wallet) return;
  await markWalletIndexed(wallet, timestamp, frozen);
}

export async function syncAnomaly(input: {
  walletAddress: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) return;
  await request("POST", "anomalies", {
    body: [
      {
        organization_id: str(wallet, "organization_id"),
        governed_wallet_id: str(wallet, "id"),
        severity: input.severity,
        score: input.score,
        title: input.title,
        description: input.description,
        status: "open",
        metadata: input.metadata ?? null,
        detected_at: input.timestamp.toISOString(),
        data_source: "live",
      },
    ],
  });
}

/** Record indexing progress so `health.indexer` reports a real checkpoint. */
export async function syncCheckpoint(blockNumber: number) {
  if (!configured()) return;
  try {
    await updateCheckpoint(blockNumber);
  } catch (error) {
    console.error(String(error));
  }
}
