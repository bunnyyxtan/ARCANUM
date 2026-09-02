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

import { ARC_CHAIN_ID, ARC_NETWORK } from "@arcanum/shared";

const CHAIN_ID = ARC_CHAIN_ID;
const LEGACY_CHECKPOINT_CONTRACT = "arcanum-indexer";
const CHECKPOINT_CONTRACT = `${LEGACY_CHECKPOINT_CONTRACT}:${ARC_NETWORK}:${CHAIN_ID}`;

type Row = Record<string, unknown>;

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

const supabaseUrl = (env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"))?.replace(/\/+$/, "");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

let warnedUnconfigured = false;
type PendingWrite = { blockNumber: number; note: string; retry: () => Promise<void> };

/** Bounded so a long outage cannot turn the failure ledger into a memory leak. */
const MAX_TRACKED_FAILURES = 500;
const MAINTENANCE_INTERVAL_MS = 30_000;

const failedWrites = new Map<string, PendingWrite>();
let lastMaintenanceAt = 0;
/** Lowest block whose failure was discarded by the bound above, if any. */
let droppedFailureBlock: number | null = null;

class SupabaseRequestError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
    message: string,
  ) {
    super(message);
  }
}

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
  method: "GET" | "POST" | "PATCH" | "DELETE",
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
    throw new SupabaseRequestError(
      response.status,
      body,
      `[supabase-sync] ${table} ${method} failed with ${response.status}: ${body
        .replaceAll(serviceRoleKey ?? "__never__", "[redacted]")
        .slice(0, 300)}`,
    );
  }

  return (await response.json()) as Row[];
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof SupabaseRequestError &&
    (error.status === 409 || error.responseBody.includes("23505"))
  );
}

function isMissingTable(error: unknown) {
  return (
    error instanceof SupabaseRequestError &&
    (error.status === 404 ||
      error.responseBody.includes("42P01") ||
      error.responseBody.includes("PGRST205"))
  );
}

async function insertDuplicateSafe(
  table: string,
  body: Row,
  filters: Record<string, string | number>,
) {
  try {
    const [created] = await request("POST", table, { body: [body] });
    return created ?? null;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    const [existing] = await request("GET", table, { filters, limit: 1 });
    if (!existing) {
      throw error;
    }
    return existing;
  }
}

async function trackedWrite(key: string, blockNumber: number, operation: () => Promise<void>) {
  try {
    await operation();
    failedWrites.delete(key);
  } catch (error) {
    // The operation is kept, not just the fact that it failed. Ponder does not
    // re-emit an event once its handler returns, so without a retry path a
    // single transient Supabase blip would pin the reported checkpoint below
    // that block permanently - honest, but never recovering on its own.
    if (failedWrites.size < MAX_TRACKED_FAILURES || failedWrites.has(key)) {
      failedWrites.set(key, { blockNumber, note: failureNote(error), retry: operation });
    } else {
      // Past the bound the operation itself is discarded, so nothing can repair
      // this block later. Remember the block anyway: once the retained
      // failures drain, the checkpoint would otherwise heal over data that was
      // never written and report a block it never actually synced.
      droppedFailureBlock =
        droppedFailureBlock === null ? blockNumber : Math.min(droppedFailureBlock, blockNumber);
    }
    console.error(failureNote(error));
  }
}

/**
 * Periodic repair pass, throttled because it is driven by every indexed event.
 *
 * Failures are re-driven and staged rows are re-checked here rather than only
 * when the next event for that wallet arrives, so a read model that fell behind
 * can catch up without waiting for on-chain activity that may never come.
 */
async function runMaintenance() {
  const now = Date.now();
  if (now - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) {
    return;
  }
  lastMaintenanceAt = now;

  await retryFailedWrites();
  await reconcileStagedEvents().catch((error) => console.error(failureNote(error)));
}

/**
 * Flush staged events whose wallet has since been created.
 *
 * Staging happens when a transfer is indexed before the application has written
 * its wallet row. The row usually appears moments later through a path this
 * indexer never observes, so waiting for the next on-chain event for that
 * wallet can strand the staged rows indefinitely.
 */
async function reconcileStagedEvents() {
  let rows: Row[];
  try {
    rows = await request("GET", "unlinked_ledger_events", {
      filters: { chain_id: CHAIN_ID },
      limit: 200,
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return;
    }
    throw error;
  }

  const addresses = [...new Set(rows.map((row) => str(row, "wallet_address")).filter(Boolean))];
  for (const address of addresses) {
    const wallet = await findGovernedWallet(address);
    if (!wallet) {
      continue;
    }
    await flushUnlinkedLedgerEvents(wallet);
  }
}

/**
 * Re-drive writes that failed earlier so `degraded` can heal by itself.
 *
 * Every write reachable from here is duplicate-safe, so replaying one that
 * actually succeeded is harmless. Throttled because a sustained outage would
 * otherwise replay the whole backlog on every indexed event.
 */
async function retryFailedWrites() {
  if (failedWrites.size === 0) {
    return;
  }

  for (const [key, pending] of [...failedWrites]) {
    try {
      await pending.retry();
      failedWrites.delete(key);
    } catch (error) {
      pending.note = failureNote(error);
    }
  }
}

function failureNote(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
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
  await flushUnlinkedLedgerEvents(wallet);
}

async function updateCheckpoint(blockNumber: number) {
  let [existing] = await request("GET", "indexer_checkpoints", {
    filters: { chain_id: CHAIN_ID, contract_name: CHECKPOINT_CONTRACT },
    limit: 1,
  });
  if (!existing) {
    [existing] = await request("GET", "indexer_checkpoints", {
      filters: { chain_id: CHAIN_ID, contract_name: LEGACY_CHECKPOINT_CONTRACT },
      limit: 1,
    });
  }
  const now = new Date().toISOString();
  const failures = [...failedWrites.values()];
  const failureBlocks = failures.map((failure) => failure.blockNumber);
  if (droppedFailureBlock !== null) {
    failureBlocks.push(droppedFailureBlock);
  }
  const firstFailure = failureBlocks.length > 0 ? Math.min(...failureBlocks) : null;
  const firstFailureNote =
    failures.find((failure) => failure.blockNumber === firstFailure)?.note ??
    (firstFailure !== null && firstFailure === droppedFailureBlock
      ? "too many pending failures to retain; a reindex is required to repair this block"
      : undefined);
  const reportedBlock =
    firstFailure === null ? blockNumber : Math.min(blockNumber, firstFailure - 1);
  const checkpointPatch: Row = {
    last_block: Math.max(0, reportedBlock),
    status: firstFailure === null ? "synced" : "degraded",
    error_note:
      firstFailure === null
        ? null
        : `Write failed at block ${firstFailure}: ${firstFailureNote ?? "Supabase write failed"}`,
    updated_at: now,
  };
  if (existing) {
    const lastBlock = Number(existing.last_block ?? 0);
    if (firstFailure === null && blockNumber <= lastBlock && str(existing, "status") === "synced") {
      return;
    }
    await request("PATCH", "indexer_checkpoints", {
      filters: { id: str(existing, "id") },
      body: {
        ...checkpointPatch,
        contract_name: CHECKPOINT_CONTRACT,
      },
    });
    return;
  }
  await request("POST", "indexer_checkpoints", {
    body: [
      {
        chain_id: CHAIN_ID,
        contract_name: CHECKPOINT_CONTRACT,
        contract_address: "0x0000000000000000000000000000000000000000",
        ...checkpointPatch,
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

  return insertDuplicateSafe(
    "ledger_events",
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
    { tx_hash: input.txHash.toLowerCase() },
  );
}

type TransferInput = {
  walletAddress: string;
  txHash: string;
  toAddress: string;
  amount: bigint;
  blockNumber: number;
  timestamp: Date;
};

type EscalatedTransferInput = TransferInput & {
  reason: string;
  escalationId: string;
  expiresAt: Date;
  quorumRequired: number;
};

async function stageUnlinked(
  eventKind: "transfer_executed" | "transfer_escalated",
  input: TransferInput | EscalatedTransferInput,
) {
  const payload: Row = {
    txHash: input.txHash,
    toAddress: input.toAddress,
    amount: input.amount.toString(),
  };
  if ("escalationId" in input) {
    payload.reason = input.reason;
    payload.escalationId = input.escalationId;
    payload.expiresAt = input.expiresAt.toISOString();
    payload.quorumRequired = input.quorumRequired;
  }
  const eventKey = "escalationId" in input ? input.escalationId : input.txHash.toLowerCase();
  try {
    await insertDuplicateSafe(
      "unlinked_ledger_events",
      {
        wallet_address: input.walletAddress.toLowerCase(),
        chain_id: CHAIN_ID,
        event_kind: eventKind,
        event_key: eventKey,
        payload,
        block_number: input.blockNumber,
        event_time: input.timestamp.toISOString(),
      },
      {
        wallet_address: input.walletAddress.toLowerCase(),
        chain_id: CHAIN_ID,
        event_kind: eventKind,
        event_key: eventKey,
      },
    );
  } catch (error) {
    // Application code can ship ahead of the migration. Staging is a safety
    // net, and a missing net must not stop the pipeline that was already
    // running without one.
    if (isMissingTable(error)) {
      console.error(
        "[supabase-sync] unlinked_ledger_events is not migrated; this event cannot be replayed later",
      );
      return;
    }
    throw error;
  }
}

async function persistEscalation(wallet: Row, input: EscalatedTransferInput) {
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
  await insertDuplicateSafe(
    "escalations",
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
    { escalation_key: input.escalationId },
  );
}

async function flushUnlinkedLedgerEvents(wallet: Row) {
  const walletAddress = str(wallet, "wallet_address").toLowerCase();
  if (!walletAddress) return;
  let rows: Row[];
  try {
    rows = await request("GET", "unlinked_ledger_events", {
      filters: { wallet_address: walletAddress, chain_id: CHAIN_ID },
    });
  } catch (error) {
    if (isMissingTable(error)) {
      console.warn("[supabase-sync] unlinked_ledger_events is not migrated; staged flush skipped");
      return;
    }
    throw error;
  }
  for (const row of rows) {
    const payload = row.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`[supabase-sync] staged event ${str(row, "id")} has invalid payload`);
    }
    const staged = payload as Row;
    const common: TransferInput = {
      walletAddress,
      txHash: str(staged, "txHash"),
      toAddress: str(staged, "toAddress"),
      amount: BigInt(str(staged, "amount")),
      blockNumber: Number(row.block_number),
      timestamp: new Date(str(row, "event_time")),
    };
    if (str(row, "event_kind") === "transfer_escalated") {
      await persistEscalation(wallet, {
        ...common,
        reason: str(staged, "reason"),
        escalationId: str(staged, "escalationId"),
        expiresAt: new Date(str(staged, "expiresAt")),
        quorumRequired: Number(staged.quorumRequired),
      });
    } else {
      await upsertLedgerEvent({
        wallet,
        txHash: common.txHash,
        status: "allowed",
        amount: common.amount,
        counterpartyAddress: common.toAddress,
        reason: "On-chain policy allowed the transfer.",
        blockNumber: common.blockNumber,
        timestamp: common.timestamp,
      });
    }
    await request("DELETE", "unlinked_ledger_events", { filters: { id: str(row, "id") } });
  }
}

export async function syncWalletCreated(
  walletAddress: string,
  timestamp: Date,
  blockNumber: number,
) {
  if (!configured()) return;
  await trackedWrite(`wallet:${walletAddress.toLowerCase()}`, blockNumber, async () => {
    const wallet = await findGovernedWallet(walletAddress);
    if (!wallet) return;
    await markWalletIndexed(wallet, timestamp);
  });
}

export async function syncTransferExecuted(input: TransferInput) {
  if (!configured()) return;
  await trackedWrite(`transfer:${input.txHash.toLowerCase()}`, input.blockNumber, async () => {
    const wallet = await findGovernedWallet(input.walletAddress);
    if (!wallet) {
      await stageUnlinked("transfer_executed", input);
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
  });
}

export async function syncTransferEscalated(input: EscalatedTransferInput) {
  if (!configured()) return;
  await trackedWrite(`escalation:${input.escalationId}`, input.blockNumber, async () => {
    const wallet = await findGovernedWallet(input.walletAddress);
    if (!wallet) {
      await stageUnlinked("transfer_escalated", input);
      return;
    }
    await persistEscalation(wallet, input);
    await markWalletIndexed(wallet, input.timestamp);
  });
}

export async function syncEscalationApproval(
  escalationId: string,
  approvalsCount: number,
  blockNumber: number,
) {
  if (!configured()) return;
  await trackedWrite(`approval:${escalationId}`, blockNumber, async () => {
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
  });
}

export async function syncEscalationStatus(
  escalationId: string,
  status: "approved" | "denied" | "expired" | "released",
  blockNumber: number,
  txHash?: string,
) {
  if (!configured()) return;
  await trackedWrite(`escalation-status:${escalationId}:${status}`, blockNumber, async () => {
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
  });
}

export async function syncWalletFrozenState(
  walletAddress: string,
  frozen: boolean,
  timestamp: Date,
  blockNumber: number,
) {
  if (!configured()) return;
  // Keyed by wallet, not by wallet+state: freeze and unfreeze are the same
  // piece of state. Separate keys would let a failed freeze be retried after a
  // later unfreeze succeeded and quietly restore the stale value.
  await trackedWrite(`frozen:${walletAddress}`, blockNumber, async () => {
    const wallet = await findGovernedWallet(walletAddress);
    if (!wallet) return;
    await markWalletIndexed(wallet, timestamp, frozen);
  });
}

export async function syncAnomaly(input: {
  walletAddress: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  title: string;
  description: string;
  timestamp: Date;
  blockNumber: number;
  metadata?: Record<string, unknown>;
}) {
  if (!configured()) return;
  await trackedWrite(
    `anomaly:${String(input.metadata?.txHash ?? input.timestamp.toISOString())}`,
    input.blockNumber,
    async () => {
      const wallet = await findGovernedWallet(input.walletAddress);
      if (!wallet) return;
      // Anomalies carry no natural key, so a retry after an ambiguous failure
      // (write committed, response lost) would file the same finding twice.
      // Wallet plus detection time plus title identifies one on-chain event.
      const sameMoment = await request("GET", "anomalies", {
        filters: {
          governed_wallet_id: str(wallet, "id"),
          detected_at: input.timestamp.toISOString(),
        },
      });
      if (sameMoment.some((row) => str(row, "title") === input.title)) {
        return;
      }
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
    },
  );
}

export async function syncGovernanceEvent(input: {
  walletAddress: string;
  eventType: string;
  severity: "info" | "warning" | "danger" | "success";
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
}) {
  if (!configured()) return;
  await trackedWrite(
    `governance:${input.txHash.toLowerCase()}:${input.eventType}:${input.walletAddress.toLowerCase()}`,
    input.blockNumber,
    async () => {
      const wallet = await findGovernedWallet(input.walletAddress);
      if (!wallet) {
        // WalletFactory is permissionless, so the chain carries governance
        // events for wallets this deployment does not track. Treating those as
        // failures would let any stranger deploy a wallet, rotate a module and
        // pin this indexer's reported progress indefinitely.
        return;
      }
      await insertDuplicateSafe(
        "governance_events",
        {
          organization_id: str(wallet, "organization_id"),
          governed_wallet_id: str(wallet, "id"),
          event_type: input.eventType,
          severity: input.severity,
          payload: input.payload,
          block_number: input.blockNumber,
          tx_hash: input.txHash.toLowerCase(),
          chain_id: CHAIN_ID,
          event_time: input.timestamp.toISOString(),
          data_source: "live",
        },
        {
          tx_hash: input.txHash.toLowerCase(),
          event_type: input.eventType,
          governed_wallet_id: str(wallet, "id"),
        },
      );
      await markWalletIndexed(wallet, input.timestamp);
    },
  );
}

/** Record indexing progress so `health.indexer` reports a real checkpoint. */
export async function syncCheckpoint(blockNumber: number) {
  if (!configured()) return;
  try {
    await runMaintenance();
    await updateCheckpoint(blockNumber);
  } catch (error) {
    console.error(String(error));
  }
}
