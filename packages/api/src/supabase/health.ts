import {
  ARC_CHAIN_ID,
  ARC_NETWORK,
  deploymentIdentity,
  deploymentManifestFor,
} from "@arcanum/shared";

import type { ApiContext } from "../context";
import { type SupabaseRow, createSupabaseServiceRoleClient, safeSupabaseError } from "./client";
import { booleanField, numberOrNull, stringField } from "./fields";
import { PUBLIC_AGGREGATE_WINDOW, formatUsdcBaseUnits, readSupabasePublicLedger } from "./ledger";
import { postureFromDoctrineRow, publicProfileFromRow, shortAddress } from "./mappers";
import { selectRows } from "./transport";
import { readSupabaseWalletByAddressUnscoped } from "./wallets";

export type SupabaseRuntimeHealth = {
  api: {
    status: "available" | "unavailable" | "not_configured";
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    error: string | null;
  };
  serviceRole: {
    status: "configured" | "missing";
  };
  readModel: {
    status: "available" | "unavailable" | "not_configured";
    sampleRows: number;
    error: string | null;
  };
  indexerCheckpoint: {
    status: "available" | "empty" | "unknown" | "unavailable" | "not_configured";
    /** Last block that carried an Arcanum contract event. */
    lastIndexedBlock: number | null;
    /**
     * Chain cursor captured when a complete catch-up was confirmed. This is
     * intentionally not combined with lastIndexedBlock: the latter is event
     * progress, not proof of a scan position.
     */
    lastSeenChainBlock: number | null;
    /** Timestamp of event progress (updated_at), not catch-up freshness. */
    lastIndexedAt: string | null;
    lastEventAt: string | null;
    /** Timestamp written only after Ponder reports /ready. */
    lastCatchupAt: string | null;
    /**
     * Missing `lastCatchupAt` is unknown, never a healthy fallback to the
     * event timestamp. This also covers a deployment before the migration.
     */
    error: string | null;
  };
};

export type SupabasePublicWalletProfile = {
  walletAddress: string;
  label: string;
  postureScore: number | null;
  state: string;
  spend: string | null;
  threatsBlocked: number | null;
  governedDays: number | null;
  dataSource: "supabase" | "none";
};

export async function readSupabaseRuntimeHealth(ctx: ApiContext): Promise<SupabaseRuntimeHealth> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = {
    api: {
      status: "not_configured" as const,
      urlConfigured: Boolean(url),
      anonKeyConfigured: Boolean(anonKey),
      error: null,
    },
    serviceRole: {
      status: serviceRoleKey ? ("configured" as const) : ("missing" as const),
    },
  };

  if (!url) {
    return {
      ...base,
      api: { ...base.api, error: "NEXT_PUBLIC_SUPABASE_URL is missing." },
      readModel: {
        status: "not_configured",
        sampleRows: 0,
        error: "Supabase URL is missing.",
      },
      indexerCheckpoint: {
        status: "not_configured",
        lastIndexedBlock: null,
        lastSeenChainBlock: null,
        lastIndexedAt: null,
        lastEventAt: null,
        lastCatchupAt: null,
        error: "Supabase URL is missing.",
      },
    };
  }

  if (!serviceRoleKey || !ctx.supabase) {
    return {
      ...base,
      readModel: {
        status: "not_configured",
        sampleRows: 0,
        error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
      },
      indexerCheckpoint: {
        status: "not_configured",
        lastIndexedBlock: null,
        lastSeenChainBlock: null,
        lastIndexedAt: null,
        lastEventAt: null,
        lastCatchupAt: null,
        error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
      },
    };
  }

  const client = ctx.supabase;
  const readModel = await safeHealthRead(() =>
    client.selectRows("governed_wallets", { limit: 1, select: "id" }),
  );
  // Newest first: a deployment that ran under the old checkpoint name leaves a
  // second row behind, and "how fresh is the read model" cannot be answered
  // differently from one request to the next depending on which row came back.
  const checkpoint = await safeHealthRead(() =>
    client.selectRows("indexer_checkpoints", {
      filters: {
        chain_id: ARC_CHAIN_ID,
        contract_name: CHECKPOINT_CONTRACT,
        deployment_id: DEPLOYMENT_ID,
      },
      limit: 2,
      order: "updated_at.desc",
    }),
  );
  const catchup = await safeHealthRead(() =>
    client.selectRows(CATCHUP_TABLE, {
      filters: {
        chain_id: ARC_CHAIN_ID,
        deployment_id: DEPLOYMENT_ID,
      },
      limit: 2,
      order: "updated_at.desc",
    }),
  );
  const readModelError = readModel.ok ? null : safeSupabaseError(readModel.error);
  const checkpointError = checkpoint.ok ? null : safeSupabaseError(checkpoint.error);
  const catchupError = catchup.ok ? null : safeSupabaseError(catchup.error);
  const checkpointRow = checkpoint.ok ? selectCheckpointRow(checkpoint.data) : undefined;
  const checkpointGate = checkpoint.ok
    ? checkpointRow
      ? checkpointMirrorStatus(checkpointRow)
      : checkpoint.data.length === 0
        ? ("empty" as const)
        : ("unknown" as const)
    : ("unavailable" as const);
  const catchupRow = catchup.ok ? selectCatchupRow(catchup.data) : undefined;
  const evidenceStatus = catchup.ok
    ? catchupRow
      ? catchupEvidenceHealthStatus(catchupRow)
      : catchup.data.length === 0
        ? ("empty" as const)
        : ("unknown" as const)
    : ("unavailable" as const);
  // A current checkpoint, when present, is a gate: a row marked syncing,
  // failed, error, or carrying an error_note cannot be made healthy by an old
  // catch-up timestamp. A genuinely quiet deployment has no checkpoint row and
  // is represented by the dedicated deployment-scoped evidence record.
  const checkpointStatus =
    checkpointGate === "unavailable" || checkpointGate === "unknown"
      ? checkpointGate
      : evidenceStatus;
  const catchupAt = catchupRow ? catchupEvidenceTime(catchupRow) : null;
  const eventAt = checkpointRow ? checkpointEventTime(checkpointRow) : null;

  return {
    ...base,
    api: {
      ...base.api,
      status: readModel.ok || checkpoint.ok ? "available" : "unavailable",
      error: readModel.ok || checkpoint.ok ? null : (readModelError ?? checkpointError),
    },
    readModel: {
      status: readModel.ok ? "available" : "unavailable",
      sampleRows: readModel.ok ? readModel.data.length : 0,
      error: readModelError,
    },
    indexerCheckpoint: {
      status: checkpointStatus,
      lastIndexedBlock: checkpointRow ? checkpointBlock(checkpointRow) : null,
      lastSeenChainBlock:
        checkpointStatus === "available" && catchupRow ? checkpointSeenBlock(catchupRow) : null,
      lastIndexedAt: eventAt,
      lastEventAt: eventAt,
      lastCatchupAt: catchupAt,
      error:
        checkpointError ??
        catchupError ??
        (checkpointGate === "unknown"
          ? checkpointHealthError(checkpointRow)
          : evidenceStatus === "unknown"
            ? catchupEvidenceError(catchupRow)
            : checkpointStatus === "empty"
              ? "No confirmed full catch-up is available."
              : null),
    },
  };
}

export async function readSupabasePublicWalletProfile(ctx: ApiContext, address: string) {
  const walletAddress = address.toLowerCase();
  // Service-role reads bypass RLS. Publication is therefore an application
  // invariant, not an optional decoration: do not resolve the wallet, ledger,
  // doctrine, or any fallback until the profile has explicitly opted in.
  const rows = await selectRows(ctx, "public_wallet_profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });
  const profileRow = rows[0];
  if (!profileRow || !booleanField(profileRow, ["show_public_badge"], false)) {
    return null;
  }

  // Anonymous visitors have no session, so the wallet must be resolved
  // unscoped only after the publication gate has passed.
  const wallet = await readSupabaseWalletByAddressUnscoped(ctx, walletAddress);
  const stored = publicProfileFromRow(profileRow, "supabase");
  // Aggregates cover the most recent PUBLIC_AGGREGATE_WINDOW events; the read
  // model has no aggregate endpoint, so very long histories would need the
  // indexer to maintain running totals.
  const [ledger, doctrineRows] = await Promise.all([
    readSupabasePublicLedger(ctx, walletAddress, PUBLIC_AGGREGATE_WINDOW),
    wallet
      ? selectRows(ctx, "doctrines", {
          filters: { governed_wallet_id: wallet.id },
          order: "version.desc",
          limit: 1,
        })
      : Promise.resolve([] as SupabaseRow[]),
  ]);

  // Every published figure is derived from indexed activity: a trust mark that
  // invents numbers is worse than one that shows nothing.
  const settledBaseUnits = ledger
    .filter((transfer) => transfer.verdict === "ALLOW")
    .reduce((total, transfer) => total + BigInt(transfer.amount || "0"), 0n);
  const blocked = ledger.filter(
    (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE",
  ).length;
  const governedSince = wallet ? new Date(wallet.createdAt).getTime() : Number.NaN;
  const governedDays = Number.isFinite(governedSince)
    ? Math.max(0, Math.floor((Date.now() - governedSince) / 86_400_000))
    : null;

  return {
    walletAddress: wallet?.address ?? stored?.walletAddress ?? walletAddress,
    label: wallet?.label ?? stored?.label ?? shortAddress(walletAddress),
    // Posture is recomputed from the live doctrine so the public number always
    // matches what the doctrine actually enforces; the stored score is only a
    // fallback for wallets whose doctrine is not readable.
    postureScore:
      wallet && doctrineRows[0]
        ? postureFromDoctrineRow(doctrineRows[0], wallet.frozen)
        : (stored?.postureScore ?? null),
    state: wallet
      ? wallet.frozen
        ? "UNDER RESTRAINT"
        : "FORTIFIED"
      : (stored?.state ?? "UNKNOWN"),
    spend: ledger.length > 0 ? formatUsdcBaseUnits(settledBaseUnits) : (stored?.spend ?? null),
    threatsBlocked: ledger.length > 0 ? blocked : (stored?.threatsBlocked ?? null),
    governedDays: governedDays ?? stored?.governedDays ?? null,
    dataSource: "supabase",
  } satisfies SupabasePublicWalletProfile;
}

async function safeHealthRead(operation: () => Promise<SupabaseRow[] | undefined>) {
  try {
    return { ok: true as const, data: (await operation()) ?? [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkpointBlock(row: SupabaseRow) {
  const block = numberOrNull(row, [
    "last_indexed_block",
    "last_block",
    "latest_block",
    "block_number",
    "block",
  ]);
  // The baseline checkpoint table uses BIGINT NOT NULL DEFAULT 0. Zero means
  // that no event has been observed yet, not that block zero was indexed.
  return block === 0 ? null : block;
}

/**
 * The chain cursor captured by a confirmed full catch-up.
 *
 * `last_block` is deliberately not a fallback. It is only the last block that
 * carried an Arcanum event, and quiet blocks may already have been scanned.
 * Combining the two cursors made partial event progress look like a confirmed
 * scan position.
 */
export function checkpointSeenBlock(row: SupabaseRow) {
  return numberOrNull(row, ["last_seen_block"]);
}

export function checkpointCatchupTime(row: SupabaseRow) {
  return timestampField(row, ["last_seen_at"]);
}

function checkpointEventTime(row: SupabaseRow) {
  return timestampField(row, ["updated_at", "timestamp", "created_at"]);
}

function timestampField(row: SupabaseRow, keys: string[]) {
  const value = stringField(row, keys, null);

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const DEPLOYMENT = deploymentManifestFor(ARC_NETWORK);
const CHECKPOINT_CONTRACT = `arcanum-indexer:${DEPLOYMENT.network}:${ARC_CHAIN_ID}`;
const DEPLOYMENT_ID = deploymentIdentity(DEPLOYMENT);
const CATCHUP_TABLE = "indexer_catchup_evidence";

function selectCheckpointRow(rows: SupabaseRow[]) {
  const [row] = rows;
  return rows.length === 1 && row && checkpointIdentityMatches(row) ? row : undefined;
}

function selectCatchupRow(rows: SupabaseRow[]) {
  const [row] = rows;
  return rows.length === 1 && row && checkpointIdentityMatches(row) ? row : undefined;
}

function checkpointIdentityMatches(row: SupabaseRow) {
  return (
    row.deployment_id === DEPLOYMENT_ID &&
    Number(row.chain_id) === DEPLOYMENT.chainId &&
    row.deployment_network === DEPLOYMENT.network &&
    Number(row.deployment_start_block) === DEPLOYMENT.startBlock &&
    String(row.deployment_usdc_address).toLowerCase() === DEPLOYMENT.usdc.toLowerCase() &&
    String(row.deployment_policy_engine_address).toLowerCase() ===
      DEPLOYMENT.policyEngine.toLowerCase() &&
    String(row.deployment_escalation_manager_address).toLowerCase() ===
      DEPLOYMENT.escalationManager.toLowerCase() &&
    String(row.deployment_anomaly_oracle_address).toLowerCase() ===
      DEPLOYMENT.anomalyOracle.toLowerCase() &&
    String(row.deployment_vendor_registry_address).toLowerCase() ===
      DEPLOYMENT.vendorRegistry.toLowerCase() &&
    String(row.deployment_wallet_factory_address).toLowerCase() ===
      DEPLOYMENT.walletFactory.toLowerCase()
  );
}

function catchupEvidenceTime(row: SupabaseRow) {
  return timestampField(row, ["last_seen_at"]);
}

function catchupEvidenceHealthStatus(row: SupabaseRow) {
  if (
    stringField(row, ["status"], null) !== "ready" ||
    (stringField(row, ["error_note"], null)?.trim() ?? "") !== "" ||
    !catchupEvidenceTime(row)
  ) {
    return "unknown" as const;
  }
  return "available" as const;
}

function catchupEvidenceError(row: SupabaseRow | undefined) {
  if (!row) {
    return "No deployment-scoped catch-up evidence is available.";
  }
  if (stringField(row, ["status"], null) !== "ready") {
    return `Catch-up evidence status is ${stringField(row, ["status"], null) || "unknown"}.`;
  }
  if ((stringField(row, ["error_note"], null)?.trim() ?? "") !== "") {
    return "Catch-up evidence contains an error.";
  }
  return "No confirmed full catch-up is available.";
}

export function checkpointHealthStatus(row: SupabaseRow) {
  // A missing property means the migration is not applied. Do not fall back
  // to updated_at: that timestamp moves for ordinary event progress and is
  // the source of the false-green health signal.
  if (
    !Object.hasOwn(row, "last_seen_at") ||
    stringField(row, ["status"], null) !== "synced" ||
    (stringField(row, ["error_note"], null)?.trim() ?? "") !== ""
  ) {
    return "unknown" as const;
  }
  return checkpointCatchupTime(row) ? ("available" as const) : ("unknown" as const);
}

function checkpointMirrorStatus(row: SupabaseRow) {
  if (
    stringField(row, ["status"], null) !== "synced" ||
    (stringField(row, ["error_note"], null)?.trim() ?? "") !== ""
  ) {
    return "unknown" as const;
  }
  return "available" as const;
}

function checkpointHealthError(row: SupabaseRow | undefined) {
  if (!row || !Object.hasOwn(row, "last_seen_at")) {
    return "Confirmed catch-up health is unavailable; apply the indexer checkpoint health migration.";
  }
  if (stringField(row, ["status"], null) !== "synced") {
    return `Checkpoint status is ${stringField(row, ["status"], null) || "unknown"}; no clean catch-up is available.`;
  }
  if ((stringField(row, ["error_note"], null)?.trim() ?? "") !== "") {
    return "Checkpoint contains an error; no clean catch-up is available.";
  }
  return "No confirmed full catch-up has been recorded.";
}
