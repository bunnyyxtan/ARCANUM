/**
 * Supabase read-model sync for the Ponder indexer.
 *
 * The dashboard API reads activity from the Supabase tables `ledger_events`,
 * `escalations`, `anomalies`, and `indexer_checkpoints`. The indexer is the
 * only writer of onchain activity into those tables. Every handler in
 * `index.ts` calls into this module so real activity on the configured Arc
 * network shows up in the ledger and escalation queue.
 *
 * All writes are idempotent so re-indexing after a restart never duplicates
 * rows.
 */

import { ARC_CHAIN_ID, deploymentIdentity } from "@arcanum/shared";
import { loadDeployment } from "./deployment";
import { assertIdenticalLedgerEvent } from "./ledger-event";

const CHAIN_ID = ARC_CHAIN_ID;
const DEPLOYMENT = loadDeployment();
const DEPLOYMENT_ID = deploymentIdentity(DEPLOYMENT);
const LEGACY_CHECKPOINT_CONTRACT = "arcanum-indexer";
const CHECKPOINT_CONTRACT = `${LEGACY_CHECKPOINT_CONTRACT}:${DEPLOYMENT.network}:${CHAIN_ID}`;

type Row = Record<string, unknown>;

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

const supabaseUrl = (env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"))?.replace(/\/+$/, "");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

let warnedUnconfigured = false;

/**
 * When the legacy Postgres mirror is off (the GitHub Actions top-up) or the
 * process runs as production, Supabase is the only place indexed activity can
 * land. Skipping silently there would let a run finish green having written
 * nothing, so missing credentials are a startup failure rather than a warning.
 */
const supabaseRequired =
  process.env.ARCANUM_DISABLE_PG_MIRROR === "1" || process.env.NODE_ENV === "production";
const UNCONFIGURED_MESSAGE =
  "[supabase-sync] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured - onchain activity will NOT reach the dashboard read model.";
if (supabaseRequired && !(supabaseUrl && serviceRoleKey)) {
  throw new Error(
    `${UNCONFIGURED_MESSAGE} This run has no other write target (ARCANUM_DISABLE_PG_MIRROR=1 or NODE_ENV=production), so it refuses to start.`,
  );
}

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
  if (supabaseRequired) {
    throw new Error(UNCONFIGURED_MESSAGE);
  }
  if (!warnedUnconfigured) {
    warnedUnconfigured = true;
    console.error(UNCONFIGURED_MESSAGE);
  }
  return false;
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  table: string,
  options?: {
    filters?: Record<string, string | number | null>;
    limit?: number;
    offset?: number;
    order?: string;
    body?: Row | Row[];
  },
): Promise<Row[]> {
  const endpoint = new URL(`${supabaseUrl}/rest/v1/${table}`);
  endpoint.searchParams.set("select", "*");
  if (options?.limit) {
    endpoint.searchParams.set("limit", String(options.limit));
  }
  if (options?.offset) {
    endpoint.searchParams.set("offset", String(options.offset));
  }
  if (options?.order) {
    endpoint.searchParams.set("order", options.order);
  }
  for (const [key, value] of Object.entries(options?.filters ?? {})) {
    endpoint.searchParams.set(key, value === null ? "is.null" : `eq.${String(value)}`);
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
    const body = await response.text();
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

async function insertDuplicateSafe(
  table: string,
  body: Row,
  filters: Record<string, string | number | null>,
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

/**
 * Flush staged events whose wallet has since been created.
 *
 * Staging happens when a transfer is indexed before the application has written
 * its wallet row. The row usually appears moments later through a path this
 * indexer never observes, so waiting for the next onchain event for that
 * wallet can strand the staged rows indefinitely.
 */
// PostgREST caps a single response at the project's max-rows setting, so every
// read that must see a whole queue pages explicitly until a short page.
const STAGED_PAGE_SIZE = 500;
const STAGED_MAX_PAGES = 200;
const MAINTENANCE_INTERVAL_MS = 5_000;
let lastReconciledAt = Number.NEGATIVE_INFINITY;
let checkpointCache: { row: Row | undefined; readAt: number } | undefined;

// One writer owns a deployment. Serialize all entry points (including the
// quiet-chain timer), not just scans: lifecycle replay must not race a handler.
// A rejected operation still rejects its caller, without poisoning later retries.
let writeTail: Promise<unknown> = Promise.resolve();
function serialized<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
  return (...args: Args): Promise<Result> => {
    const result = writeTail.then(() => operation(...args));
    writeTail = result.catch(() => undefined);
    return result;
  };
}

async function reconcileIfDue(force = false) {
  if (!force && Date.now() - lastReconciledAt < MAINTENANCE_INTERVAL_MS) return;
  lastReconciledAt = Number.NEGATIVE_INFINITY;
  await reconcileStagedEvents();
  // Only success earns a throttle window. Failures remain eligible immediately.
  lastReconciledAt = Date.now();
}

/** A fresh exhaustive pass; does not claim readiness or advance any height. */
export const syncStagedEvents = serialized(async () => {
  if (!configured()) return;
  await reconcileIfDue(true);
});

/** Start only in the indexing process, never as an import side effect. */
export function startStagedEventReconciliation() {
  let pending = false;
  const periodicPass = serialized(async () => {
    if (!configured()) return;
    await reconcileIfDue();
  });
  const timer = setInterval(() => {
    if (pending) return;
    pending = true;
    void periodicPass()
      .catch((error: unknown) => {
        console.error("[supabase-sync] periodic staged reconciliation failed; will retry", error);
      })
      .finally(() => {
        pending = false;
      });
  }, MAINTENANCE_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

async function readAllStagedRows(filters: Record<string, string | number | null>) {
  const rows: Row[] = [];
  for (let page = 0; ; page += 1) {
    if (page >= STAGED_MAX_PAGES) {
      throw new Error(
        `[supabase-sync] unlinked_ledger_events exceeded ${STAGED_PAGE_SIZE * STAGED_MAX_PAGES} rows for ${JSON.stringify(filters)}; refusing to reconcile a partial queue`,
      );
    }
    const batch = await request("GET", "unlinked_ledger_events", {
      filters,
      order: "block_number.asc,created_at.asc,id.asc",
      limit: STAGED_PAGE_SIZE,
      offset: page * STAGED_PAGE_SIZE,
    });
    rows.push(...batch);
    if (batch.length < STAGED_PAGE_SIZE) {
      return rows;
    }
  }
}

async function reconcileStagedEvents() {
  const rows = await readAllStagedRows({ chain_id: CHAIN_ID, deployment_id: DEPLOYMENT_ID });

  const addresses = [...new Set(rows.map((row) => str(row, "wallet_address")).filter(Boolean))];
  for (const address of addresses) {
    const wallet = await findGovernedWallet(address);
    if (!wallet) {
      continue;
    }
    await flushUnlinkedLedgerEvents(
      wallet,
      rows.filter((row) => str(row, "wallet_address") === address),
    );
  }
}

function str(row: Row | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : "";
}

/** Onchain USDC base units (6 decimals) -> decimal USDC used by the read model. */
export function usdcDecimal(amountBaseUnits: bigint) {
  const scale = 1_000_000n;
  const sign = amountBaseUnits < 0n ? "-" : "";
  const absolute = amountBaseUnits < 0n ? -amountBaseUnits : amountBaseUnits;
  const fraction = (absolute % scale).toString().padStart(6, "0").replace(/0+$/, "") || "0";
  return `${sign}${absolute / scale}.${fraction}`;
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
  });
  await flushUnlinkedLedgerEvents(wallet);
}

async function updateCheckpoint(blockNumber: number, startBlock: number) {
  if (blockNumber < startBlock) {
    throw new Error(
      `[supabase-sync] refusing checkpoint block ${blockNumber} below deployment start block ${startBlock}`,
    );
  }
  const existing =
    checkpointCache && Date.now() - checkpointCache.readAt < MAINTENANCE_INTERVAL_MS
      ? checkpointCache.row
      : await findCheckpoint();
  const now = new Date().toISOString();
  const checkpointPatch: Row = {
    last_block: blockNumber,
    status: "synced",
    error_note: null,
    updated_at: now,
  };
  if (existing) {
    const lastBlock = Number(existing.last_block ?? 0);
    if (blockNumber < lastBlock) {
      throw new Error(
        `[supabase-sync] current deployment checkpoint ${lastBlock} is ahead of event block ${blockNumber}; refusing to skip low deployment events`,
      );
    }
    if (blockNumber === lastBlock && str(existing, "status") === "synced") {
      return;
    }
    const [updated] = await request("PATCH", "indexer_checkpoints", {
      filters: { id: str(existing, "id") },
      body: {
        ...checkpointPatch,
        contract_name: CHECKPOINT_CONTRACT,
      },
    });
    if (!updated) throw new Error("[supabase-sync] checkpoint disappeared during update");
    checkpointCache = { row: updated, readAt: checkpointCache?.readAt ?? Date.now() };
    return;
  }
  const [created] = await request("POST", "indexer_checkpoints", {
    body: [
      {
        chain_id: CHAIN_ID,
        contract_name: CHECKPOINT_CONTRACT,
        contract_address: DEPLOYMENT.walletFactory.toLowerCase(),
        deployment_id: DEPLOYMENT_ID,
        deployment_start_block: DEPLOYMENT.startBlock,
        deployment_network: DEPLOYMENT.network,
        deployment_usdc_address: DEPLOYMENT.usdc.toLowerCase(),
        deployment_policy_engine_address: DEPLOYMENT.policyEngine.toLowerCase(),
        deployment_escalation_manager_address: DEPLOYMENT.escalationManager.toLowerCase(),
        deployment_anomaly_oracle_address: DEPLOYMENT.anomalyOracle.toLowerCase(),
        deployment_vendor_registry_address: DEPLOYMENT.vendorRegistry.toLowerCase(),
        deployment_wallet_factory_address: DEPLOYMENT.walletFactory.toLowerCase(),
        ...checkpointPatch,
      },
    ],
  });
  if (!created) throw new Error("[supabase-sync] checkpoint insert returned no row");
  checkpointCache = { row: created, readAt: Date.now() };
}

/** Finalize deployment-scoped /ready evidence through the atomic RPC. */
async function syncConfirmedCatchup(blockNumber?: number) {
  if (!configured()) return;
  await reconcileIfDue(true);
  await request("POST", "rpc/finalize_indexer_catchup", {
    body: {
      p_deployment_id: DEPLOYMENT_ID,
      p_chain_id: CHAIN_ID,
      p_deployment_network: DEPLOYMENT.network,
      p_deployment_start_block: DEPLOYMENT.startBlock,
      p_deployment_usdc_address: DEPLOYMENT.usdc.toLowerCase(),
      p_deployment_policy_engine_address: DEPLOYMENT.policyEngine.toLowerCase(),
      p_deployment_escalation_manager_address: DEPLOYMENT.escalationManager.toLowerCase(),
      p_deployment_anomaly_oracle_address: DEPLOYMENT.anomalyOracle.toLowerCase(),
      p_deployment_vendor_registry_address: DEPLOYMENT.vendorRegistry.toLowerCase(),
      p_deployment_wallet_factory_address: DEPLOYMENT.walletFactory.toLowerCase(),
      p_last_seen_block: blockNumber ?? null,
    },
  });
}

async function findCheckpoint() {
  const rows = await request("GET", "indexer_checkpoints", {
    filters: {
      chain_id: CHAIN_ID,
      contract_name: CHECKPOINT_CONTRACT,
      deployment_id: DEPLOYMENT_ID,
    },
    limit: 2,
  });
  if (rows.length > 1) throw new Error("[supabase-sync] duplicate deployment checkpoints");
  checkpointCache = { row: rows[0], readAt: Date.now() };
  return rows[0];
}

let ledgerRpcUnavailable = false;

function isMissingLedgerRpc(error: unknown): boolean {
  if (!(error instanceof SupabaseRequestError) || error.status !== 404) return false;
  try {
    const body = JSON.parse(error.responseBody) as Row;
    return (
      body.code === "PGRST202" &&
      typeof body.message === "string" &&
      /\bpublic\.insert_ledger_event\b/.test(body.message)
    );
  } catch {
    return false;
  }
}

async function upsertLedgerEvent(input: {
  wallet: Row;
  txHash: string;
  logIndex: number;
  escalationId?: string;
  policyVersion?: string;
  councilVersion?: string;
  status: "allowed" | "escalated" | "blocked" | "frozen";
  amount: bigint;
  counterpartyAddress: string;
  reason: string;
  blockNumber: number;
  timestamp: Date;
}): Promise<Row> {
  const body: Row = {
    organization_id: str(input.wallet, "organization_id"),
    governed_wallet_id: str(input.wallet, "id"),
    tx_hash: input.txHash.toLowerCase(),
    log_index: input.logIndex,
    event_time: input.timestamp.toISOString(),
    agent_label: str(input.wallet, "label") || null,
    category: null,
    counterparty_address: input.counterpartyAddress.toLowerCase(),
    amount_usdc: usdcDecimal(input.amount),
    status: input.status,
    decision_reason: input.reason,
    block_number: input.blockNumber,
    chain_id: CHAIN_ID,
    policy_snapshot: {
      ...(input.escalationId ? { escalationId: input.escalationId } : {}),
      ...(input.policyVersion ? { policyVersion: input.policyVersion } : {}),
      ...(input.councilVersion ? { councilVersion: input.councilVersion } : {}),
    },
    data_source: "live",
  };
  if (!ledgerRpcUnavailable) {
    try {
      // The RPC returns JSON objects with numeric money/bigint block values
      // encoded as text, so response.json() cannot round immutable values.
      const rows = await request("POST", "rpc/insert_ledger_event", { body: { p_event: body } });
      if (rows.length !== 1 || !rows[0]) {
        throw new Error("[supabase-sync] ledger RPC must return exactly one row");
      }
      return assertIdenticalLedgerEvent(rows[0], body);
    } catch (error) {
      if (!isMissingLedgerRpc(error)) throw error;
      // Only the explicit PostgREST capability error permits the old path.
      ledgerRpcUnavailable = true;
    }
  }
  const filters = {
    chain_id: CHAIN_ID,
    tx_hash: input.txHash.toLowerCase(),
    log_index: input.logIndex,
  };
  const rows = await request("GET", "ledger_events", { filters, limit: 2 });
  if (rows.length > 1) throw new Error("[supabase-sync] duplicate ledger event identity");
  const row = rows[0] ?? (await insertDuplicateSafe("ledger_events", body, filters));
  if (!row) throw new Error("[supabase-sync] ledger insert returned no row");
  return assertIdenticalLedgerEvent(row, body);
}

type TransferInput = {
  walletAddress: string;
  txHash: string;
  logIndex: number;
  escalationId?: string;
  toAddress: string;
  amount: bigint;
  blockNumber: number;
  timestamp: Date;
};

type EscalatedTransferInput = TransferInput & {
  reason: string;
  escalationId: string;
  policyVersion: string;
  councilVersion: string;
  expiresAt: Date;
  quorumRequired: number;
};

type VendorRuleInput = {
  walletAddress: string;
  vendorAddress: string;
  kind: "added" | "blocked" | "removed";
  categoryIndex?: number;
  perVendorCap?: bigint;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  timestamp: Date;
};

const VENDOR_CATEGORY_ORDER = ["api", "compute", "data", "subcontracting", "other"] as const;

export function vendorCategoryFromIndex(index: number) {
  return VENDOR_CATEGORY_ORDER[index] ?? "other";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function vendorEventIsNewer(row: Row, input: VendorRuleInput) {
  if (row.rule_sync_block === null || row.rule_sync_block === undefined) return true;
  const priorBlock = BigInt(String(row.rule_sync_block));
  const priorLog = BigInt(String(row.rule_sync_log_index ?? -1));
  return (
    BigInt(input.blockNumber) > priorBlock ||
    (BigInt(input.blockNumber) === priorBlock && BigInt(input.logIndex) > priorLog)
  );
}

async function persistVendorRule(wallet: Row, input: VendorRuleInput) {
  const walletAddress = input.walletAddress.toLowerCase();
  const vendorAddress = input.vendorAddress.toLowerCase();
  const filters = { wallet_address: walletAddress, vendor_address: vendorAddress };
  const [existing] = await request("GET", "vendors", { filters, limit: 1 });
  if (existing && !vendorEventIsNewer(existing, input)) return;

  const patch: Row = {
    organization_id: str(wallet, "organization_id"),
    wallet_address: walletAddress,
    vendor_address: vendorAddress,
    status: input.kind === "added" ? "allowed" : input.kind,
    data_source: "live",
    source: "indexer",
    rule_sync_block: input.blockNumber,
    rule_sync_log_index: input.logIndex,
    rule_sync_tx_hash: input.txHash.toLowerCase(),
    updated_at: input.timestamp.toISOString(),
  };
  if (input.kind === "added") {
    const cap = input.perVendorCap ?? 0n;
    patch.category = vendorCategoryFromIndex(input.categoryIndex ?? 4);
    patch.per_vendor_cap_base_units = cap.toString();
    patch.confidential = cap > 0n;
  }

  if (existing) {
    await request("PATCH", "vendors", { filters: { id: str(existing, "id") }, body: patch });
    return;
  }
  const [legacy] = await request("GET", "vendors", {
    filters: {
      organization_id: str(wallet, "organization_id"),
      vendor_address: vendorAddress,
      wallet_address: null,
    },
    limit: 1,
  });
  const inserted = await insertDuplicateSafe(
    "vendors",
    {
      ...patch,
      name: str(legacy, "name") || shortAddress(vendorAddress),
      category: patch.category ?? "other",
      per_vendor_cap_base_units: patch.per_vendor_cap_base_units ?? "0",
      confidential: patch.confidential ?? false,
    },
    filters,
  );
  if (inserted && !vendorEventIsNewer(inserted, input)) return;
  if (inserted && str(inserted, "id")) {
    await request("PATCH", "vendors", { filters: { id: str(inserted, "id") }, body: patch });
  }
}

async function stageVendorRule(input: VendorRuleInput) {
  await insertDuplicateSafe(
    "unlinked_ledger_events",
    {
      wallet_address: input.walletAddress.toLowerCase(),
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: `vendor_${input.kind}`,
      event_key: `${input.txHash.toLowerCase()}:${input.logIndex}`,
      payload: {
        vendorAddress: input.vendorAddress,
        categoryIndex: input.categoryIndex ?? 4,
        perVendorCap: (input.perVendorCap ?? 0n).toString(),
        logIndex: input.logIndex,
        txHash: input.txHash,
      },
      block_number: input.blockNumber,
      event_time: input.timestamp.toISOString(),
    },
    {
      wallet_address: input.walletAddress.toLowerCase(),
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: `vendor_${input.kind}`,
      event_key: `${input.txHash.toLowerCase()}:${input.logIndex}`,
    },
  );
}

async function syncVendorRule(input: VendorRuleInput) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    await stageVendorRule(input);
    return;
  }
  await persistVendorRule(wallet, input);
  await markWalletIndexed(wallet, input.timestamp);
}

async function stageUnlinked(
  eventKind:
    | "transfer_executed"
    | "transfer_escalated"
    | "vendor_added"
    | "vendor_blocked"
    | "vendor_removed"
    | "escalation_approval"
    | "escalation_status",
  input: TransferInput | EscalatedTransferInput,
) {
  const payload: Row = {
    txHash: input.txHash,
    logIndex: input.logIndex,
    toAddress: input.toAddress,
    amount: input.amount.toString(),
  };
  if (input.escalationId) {
    payload.escalationId = input.escalationId;
  }
  if ("expiresAt" in input) {
    payload.reason = input.reason;
    payload.expiresAt = input.expiresAt.toISOString();
    payload.quorumRequired = input.quorumRequired;
    payload.policyVersion = input.policyVersion;
    payload.councilVersion = input.councilVersion;
  }
  const eventKey =
    "expiresAt" in input ? input.escalationId : `${input.txHash.toLowerCase()}:${input.logIndex}`;
  await insertDuplicateSafe(
    "unlinked_ledger_events",
    {
      wallet_address: input.walletAddress.toLowerCase(),
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: eventKind,
      event_key: eventKey,
      payload,
      block_number: input.blockNumber,
      event_time: input.timestamp.toISOString(),
    },
    {
      wallet_address: input.walletAddress.toLowerCase(),
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: eventKind,
      event_key: eventKey,
    },
  );
}

type EscalationLifecycleInput = {
  escalationId: string;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  timestamp: Date;
};

async function stagedEscalationBase(escalationId: string) {
  // Filter on the staged payload server-side: a window of the newest staged
  // rows would silently miss an escalation once enough foreign-wallet
  // events accumulate ahead of it.
  const [row] = await request("GET", "unlinked_ledger_events", {
    filters: {
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: "transfer_escalated",
      "payload->>escalationId": escalationId,
    },
    limit: 1,
  });
  return row ?? null;
}

async function stageEscalationLifecycle(
  kind: "escalation_approval" | "escalation_status",
  input: EscalationLifecycleInput,
  values: Row,
) {
  const base = await stagedEscalationBase(input.escalationId);
  if (!base) {
    // Every lifecycle event follows a TransferEscalated that was either
    // persisted or staged; neither existing means the read model has no
    // trace of this escalation at all, which must be visible in the logs.
    console.warn(
      `[supabase-sync] dropping ${kind} for unknown escalation ${input.escalationId} (tx ${input.txHash}, log ${input.logIndex})`,
    );
    return false;
  }
  const walletAddress = str(base, "wallet_address");
  await insertDuplicateSafe(
    "unlinked_ledger_events",
    {
      wallet_address: walletAddress,
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: kind,
      event_key: `${input.txHash.toLowerCase()}:${input.logIndex}`,
      payload: {
        escalationId: input.escalationId,
        logIndex: input.logIndex,
        txHash: input.txHash,
        ...values,
      },
      block_number: input.blockNumber,
      event_time: input.timestamp.toISOString(),
    },
    {
      wallet_address: walletAddress,
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
      event_kind: kind,
      event_key: `${input.txHash.toLowerCase()}:${input.logIndex}`,
    },
  );
  return true;
}

async function persistEscalation(wallet: Row, input: EscalatedTransferInput) {
  const ledgerEvent = await upsertLedgerEvent({
    wallet,
    txHash: input.txHash,
    logIndex: input.logIndex,
    escalationId: input.escalationId,
    policyVersion: input.policyVersion,
    councilVersion: input.councilVersion,
    status: "escalated",
    amount: input.amount,
    counterpartyAddress: input.toAddress,
    reason: input.reason,
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
      category: null,
      counterparty_address: input.toAddress.toLowerCase(),
      reason: input.reason,
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

async function flushUnlinkedLedgerEvents(wallet: Row, stagedRows?: Row[]) {
  const walletAddress = str(wallet, "wallet_address").toLowerCase();
  if (!walletAddress) return;
  // Read the wallet's complete staged set before applying anything: chain
  // order is (block, log), and a partial page could replay a lifecycle status
  // ahead of the escalation it belongs to.
  const rows =
    stagedRows ??
    (await readAllStagedRows({
      wallet_address: walletAddress,
      chain_id: CHAIN_ID,
      deployment_id: DEPLOYMENT_ID,
    }));
  rows.sort((left, right) => {
    const block = Number(left.block_number) - Number(right.block_number);
    if (block !== 0) return block;
    const leftPayload = left.payload as Row | undefined;
    const rightPayload = right.payload as Row | undefined;
    const log = Number(leftPayload?.logIndex ?? 0) - Number(rightPayload?.logIndex ?? 0);
    if (log !== 0) return log;
    return str(left, "id").localeCompare(str(right, "id"));
  });
  for (const row of rows) {
    const payload = row.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`[supabase-sync] staged event ${str(row, "id")} has invalid payload`);
    }
    const staged = payload as Row;
    const kind = str(row, "event_kind");
    if (
      ![
        "transfer_executed",
        "transfer_escalated",
        "vendor_added",
        "vendor_blocked",
        "vendor_removed",
        "escalation_approval",
        "escalation_status",
      ].includes(kind)
    ) {
      throw new Error(
        `[supabase-sync] staged event ${str(row, "id")} has unsupported kind ${kind}`,
      );
    }
    if (kind === "escalation_approval") {
      const applied = await applyEscalationApproval(
        str(staged, "escalationId"),
        Number(staged.approvalsCount),
        new Date(str(row, "event_time")),
      );
      if (!applied) {
        throw new Error(`[supabase-sync] staged event ${str(row, "id")} awaits its escalation`);
      }
      await request("DELETE", "unlinked_ledger_events", { filters: { id: str(row, "id") } });
      continue;
    }
    if (kind === "escalation_status") {
      const applied = await applyEscalationStatus(
        str(staged, "escalationId"),
        str(staged, "status") as EscalationStatus,
        str(staged, "txHash") || undefined,
        new Date(str(row, "event_time")),
      );
      if (!applied) {
        throw new Error(`[supabase-sync] staged event ${str(row, "id")} awaits its escalation`);
      }
      await request("DELETE", "unlinked_ledger_events", { filters: { id: str(row, "id") } });
      continue;
    }
    if (kind.startsWith("vendor_")) {
      await persistVendorRule(wallet, {
        walletAddress,
        vendorAddress: str(staged, "vendorAddress"),
        kind: kind.replace("vendor_", "") as VendorRuleInput["kind"],
        categoryIndex: Number(staged.categoryIndex),
        perVendorCap: BigInt(str(staged, "perVendorCap") || "0"),
        blockNumber: Number(row.block_number),
        logIndex: Number(staged.logIndex),
        txHash: str(staged, "txHash"),
        timestamp: new Date(str(row, "event_time")),
      });
      await request("DELETE", "unlinked_ledger_events", { filters: { id: str(row, "id") } });
      continue;
    }
    // Legacy allowed transfers use transfer_executed with this original
    // payload, without escalation/version enrichment. No other kind (including
    // a missing kind) is an alias for an allowed transfer.
    if (
      kind === "transfer_executed" &&
      (!/^0x[0-9a-f]{64}$/i.test(str(staged, "txHash")) ||
        !/^0x[0-9a-f]{40}$/i.test(str(staged, "toAddress")) ||
        !/^\d+$/.test(str(staged, "amount")) ||
        typeof staged.logIndex !== "number" ||
        !Number.isSafeInteger(staged.logIndex) ||
        staged.logIndex < 0 ||
        row.block_number === null ||
        row.block_number === undefined ||
        !Number.isSafeInteger(Number(row.block_number)) ||
        Number(row.block_number) < 0 ||
        !Number.isFinite(new Date(str(row, "event_time")).getTime()))
    ) {
      throw new Error(
        `[supabase-sync] staged event ${str(row, "id")} has invalid transfer payload`,
      );
    }
    const common: TransferInput = {
      walletAddress,
      txHash: str(staged, "txHash"),
      logIndex: Number(staged.logIndex),
      toAddress: str(staged, "toAddress"),
      amount: BigInt(str(staged, "amount")),
      blockNumber: Number(row.block_number),
      timestamp: new Date(str(row, "event_time")),
    };
    if (kind === "transfer_escalated") {
      await persistEscalation(wallet, {
        ...common,
        reason: str(staged, "reason"),
        escalationId: str(staged, "escalationId"),
        expiresAt: new Date(str(staged, "expiresAt")),
        quorumRequired: Number(staged.quorumRequired),
        policyVersion: str(staged, "policyVersion"),
        councilVersion: str(staged, "councilVersion"),
      });
    } else {
      await upsertLedgerEvent({
        wallet,
        txHash: common.txHash,
        logIndex: common.logIndex,
        escalationId: str(staged, "escalationId") || undefined,
        status: "allowed",
        amount: common.amount,
        counterpartyAddress: common.toAddress,
        reason: "Onchain policy allowed the transfer.",
        blockNumber: common.blockNumber,
        timestamp: common.timestamp,
      });
    }
    await request("DELETE", "unlinked_ledger_events", { filters: { id: str(row, "id") } });
  }
}

async function syncWalletCreated(walletAddress: string, timestamp: Date) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(walletAddress);
  if (!wallet) return;
  await markWalletIndexed(wallet, timestamp);
}

async function syncTransferExecuted(input: TransferInput) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    await stageUnlinked("transfer_executed", input);
    return;
  }
  await upsertLedgerEvent({
    wallet,
    txHash: input.txHash,
    logIndex: input.logIndex,
    escalationId: input.escalationId,
    status: "allowed",
    amount: input.amount,
    counterpartyAddress: input.toAddress,
    reason: "Onchain policy allowed the transfer.",
    blockNumber: input.blockNumber,
    timestamp: input.timestamp,
  });
  await markWalletIndexed(wallet, input.timestamp);
}

async function syncTransferEscalated(input: EscalatedTransferInput) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    await stageUnlinked("transfer_escalated", input);
    return;
  }
  await persistEscalation(wallet, input);
  await markWalletIndexed(wallet, input.timestamp);
}

async function applyEscalationApproval(
  escalationId: string,
  approvalsCount: number,
  timestamp: Date,
) {
  const [existing] = await request("GET", "escalations", {
    filters: { escalation_key: escalationId },
    limit: 1,
  });
  if (!existing) return false;
  await request("PATCH", "escalations", {
    filters: { id: str(existing, "id") },
    body: {
      approvals_count: Math.max(approvalsCount, Number(existing.approvals_count ?? 0)),
      updated_at: timestamp.toISOString(),
    },
  });
  return true;
}

async function syncEscalationApproval(
  input: EscalationLifecycleInput & { approvalsCount: number },
) {
  if (!configured()) return;
  if (await applyEscalationApproval(input.escalationId, input.approvalsCount, input.timestamp))
    return;
  await stageEscalationLifecycle("escalation_approval", input, {
    approvalsCount: input.approvalsCount,
  });
}

type EscalationStatus =
  | "approved"
  | "cancelled"
  | "denied"
  | "expired"
  | "invalidated"
  | "rejected"
  | "released";

async function applyEscalationStatus(
  escalationId: string,
  status: EscalationStatus,
  txHash?: string,
  timestamp = new Date(),
) {
  const [existing] = await request("GET", "escalations", {
    filters: { escalation_key: escalationId },
    limit: 1,
  });
  if (!existing) return false;
  const patch: Row = { status, updated_at: timestamp.toISOString() };
  if (txHash) {
    if (status === "released") {
      patch.release_tx_hash = txHash.toLowerCase();
    }
    if (
      status === "rejected" ||
      status === "denied" ||
      status === "cancelled" ||
      status === "invalidated"
    ) {
      patch.deny_tx_hash = txHash.toLowerCase();
    }
  }
  await request("PATCH", "escalations", { filters: { id: str(existing, "id") }, body: patch });
  return true;
}

async function syncEscalationStatus(
  input: EscalationLifecycleInput & { status: EscalationStatus },
) {
  if (!configured()) return;
  if (
    await applyEscalationStatus(input.escalationId, input.status, input.txHash, input.timestamp)
  ) {
    return;
  }
  await stageEscalationLifecycle("escalation_status", input, { status: input.status });
}

async function syncWalletFrozenState(walletAddress: string, frozen: boolean, timestamp: Date) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(walletAddress);
  if (!wallet) return;
  await markWalletIndexed(wallet, timestamp, frozen);
}

async function syncAnomaly(input: {
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
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) return;
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
}

async function syncGovernanceEvent(input: {
  walletAddress: string;
  eventType: string;
  severity: "info" | "warning" | "danger" | "success";
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
}) {
  if (!configured()) return;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) {
    // WalletFactory is permissionless; foreign wallet events are not part of
    // this deployment's read model.
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
}

/**
 * Mirror a completed ownership transfer only after its governance event has
 * been durably recorded. The database function locks the wallet and compares
 * the previous owner plus (block, log) watermark, so replayed events are
 * harmless and an older event can never roll the owner back.
 *
 * WalletFactory is permissionless: an event for a wallet outside this
 * deployment is deliberately skipped before either the event or owner RPC.
 */
async function syncOwnershipTransferred(input: {
  walletAddress: string;
  previousOwner: string;
  newOwner: string;
  blockNumber: number;
  logIndex: number;
  txHash: string;
  timestamp: Date;
}): Promise<boolean> {
  if (!configured()) return false;
  const wallet = await findGovernedWallet(input.walletAddress);
  if (!wallet) return false;

  await insertDuplicateSafe(
    "governance_events",
    {
      organization_id: str(wallet, "organization_id"),
      governed_wallet_id: str(wallet, "id"),
      event_type: "OWNERSHIP_TRANSFERRED",
      severity: "info",
      payload: {
        previousOwner: input.previousOwner.toLowerCase(),
        newOwner: input.newOwner.toLowerCase(),
      },
      block_number: input.blockNumber,
      tx_hash: input.txHash.toLowerCase(),
      chain_id: CHAIN_ID,
      event_time: input.timestamp.toISOString(),
      data_source: "live",
    },
    {
      tx_hash: input.txHash.toLowerCase(),
      event_type: "OWNERSHIP_TRANSFERRED",
      governed_wallet_id: str(wallet, "id"),
    },
  );

  // Keep this after the event insert. If the owner RPC is temporarily
  // unavailable the handler fails without advancing its checkpoint, and a
  // rerun can safely find the already-recorded event and retry this operation.
  await request("POST", "rpc/sync_governed_wallet_owner", {
    body: {
      p_wallet_address: input.walletAddress.toLowerCase(),
      p_chain_id: CHAIN_ID,
      p_previous_owner: input.previousOwner.toLowerCase(),
      p_new_owner: input.newOwner.toLowerCase(),
      p_block_number: input.blockNumber,
      p_log_index: input.logIndex,
      p_tx_hash: input.txHash.toLowerCase(),
    },
  });
  await markWalletIndexed(wallet, input.timestamp);
  return true;
}

/** Record indexing progress so `health.indexer` reports a real checkpoint. */
async function syncCheckpoint(blockNumber: number, startBlock: number) {
  if (!configured()) return;
  try {
    await reconcileIfDue();
    await updateCheckpoint(blockNumber, startBlock);
  } catch (error) {
    checkpointCache = undefined;
    throw error;
  }
}

const queuedCheckpoint = serialized(syncCheckpoint);
const queuedCatchup = serialized(syncConfirmedCatchup);
const queuedVendorRule = serialized(syncVendorRule);
const queuedWalletCreated = serialized(syncWalletCreated);
const queuedTransferExecuted = serialized(syncTransferExecuted);
const queuedTransferEscalated = serialized(syncTransferEscalated);
const queuedEscalationApproval = serialized(syncEscalationApproval);
const queuedEscalationStatus = serialized(syncEscalationStatus);
const queuedWalletFrozenState = serialized(syncWalletFrozenState);
const queuedAnomaly = serialized(syncAnomaly);
const queuedGovernanceEvent = serialized(syncGovernanceEvent);
const queuedOwnershipTransferred = serialized(syncOwnershipTransferred);

export {
  queuedCheckpoint as syncCheckpoint,
  queuedCatchup as syncConfirmedCatchup,
  queuedVendorRule as syncVendorRule,
  queuedWalletCreated as syncWalletCreated,
  queuedTransferExecuted as syncTransferExecuted,
  queuedTransferEscalated as syncTransferEscalated,
  queuedEscalationApproval as syncEscalationApproval,
  queuedEscalationStatus as syncEscalationStatus,
  queuedWalletFrozenState as syncWalletFrozenState,
  queuedAnomaly as syncAnomaly,
  queuedGovernanceEvent as syncGovernanceEvent,
  queuedOwnershipTransferred as syncOwnershipTransferred,
};
