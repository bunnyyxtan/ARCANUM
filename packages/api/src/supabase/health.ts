import type { ApiContext } from "../context";
import { type SupabaseRow, createSupabaseServiceRoleClient, safeSupabaseError } from "./client";
import { numberOrNull, stringField } from "./fields";
import { selectRows } from "./internal";
import { PUBLIC_AGGREGATE_WINDOW, formatUsdcBaseUnits, readSupabasePublicLedger } from "./ledger";
import { postureFromDoctrineRow, publicProfileFromRow, shortAddress } from "./mappers";
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
    status: "available" | "empty" | "unavailable" | "not_configured";
    lastIndexedBlock: number | null;
    lastIndexedAt: string | null;
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
        lastIndexedAt: null,
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
        lastIndexedAt: null,
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
      limit: 1,
      order: "updated_at.desc",
    }),
  );
  const readModelError = readModel.ok ? null : safeSupabaseError(readModel.error);
  const checkpointError = checkpoint.ok ? null : safeSupabaseError(checkpoint.error);
  const checkpointRow = checkpoint.ok ? checkpoint.data[0] : undefined;

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
      status: checkpoint.ok ? (checkpointRow ? "available" : "empty") : "unavailable",
      lastIndexedBlock: checkpointRow ? checkpointBlock(checkpointRow) : null,
      lastIndexedAt: checkpointRow ? checkpointTime(checkpointRow) : null,
      error: checkpointError,
    },
  };
}

export async function readSupabasePublicWalletProfile(ctx: ApiContext, address: string) {
  const walletAddress = address.toLowerCase();
  // Anonymous visitors have no session, so the wallet must be resolved unscoped
  // or the public trust pages would always report "no public profile".
  const [rows, wallet] = await Promise.all([
    selectRows(ctx, "public_wallet_profiles", {
      filters: { wallet_address: walletAddress },
      limit: 1,
    }),
    readSupabaseWalletByAddressUnscoped(ctx, walletAddress),
  ]);

  if (!rows[0] && !wallet) {
    return null;
  }

  const stored = rows[0] ? publicProfileFromRow(rows[0], "supabase") : null;
  // Aggregates cover the most recent PUBLIC_AGGREGATE_WINDOW events; the read
  // model has no aggregate endpoint, so very long histories would need the
  // indexer to maintain running totals.
  const [ledger, doctrineRows] = await Promise.all([
    readSupabasePublicLedger(ctx, walletAddress, PUBLIC_AGGREGATE_WINDOW),
    wallet
      ? selectRows(ctx, "doctrines", {
          filters: { governed_wallet_id: wallet.id },
          order: "updated_at.desc",
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
  return numberOrNull(row, [
    "last_indexed_block",
    "last_block",
    "latest_block",
    "block_number",
    "block",
  ]);
}

function checkpointTime(row: SupabaseRow) {
  const value = stringField(
    row,
    ["last_indexed_at", "updated_at", "timestamp", "created_at"],
    null,
  );

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
