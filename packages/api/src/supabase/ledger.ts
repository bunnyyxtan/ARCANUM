import { FALLBACK_TENANT_ID } from "@arcanum/db";
import type { Transfer, Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import type { SupabaseRequestOptions, SupabaseRow } from "./client";
import { readModelUnavailable, warnSupabase } from "./client";
import {
  booleanField,
  dateField,
  moneyBaseUnits,
  numberField,
  stableHash,
  stableUuid,
  stringField,
} from "./fields";
import { transferFromRow } from "./mappers";
import { rowsForWalletIdentity, walletForRow } from "./scope";
import { selectRows, selectRowsExhaustive } from "./transport";
import { readSupabaseWalletByAddressUnscoped, readSupabaseWallets } from "./wallets";

/** How many recent ledger events the public trust figures are computed over. */
export const PUBLIC_AGGREGATE_WINDOW = 2000;
const MAX_GOVERNANCE_EVENT_ROWS = 1_000;
export type LedgerCursor = { createdAt: string; id: string };

export type TransferReadOptions = {
  cursor?: LedgerCursor;
  /** Upper bound for a visible page read; aggregate readers may omit it. */
  limit?: number;
  /** Restrict the database page to one already-authorized wallet. */
  walletId?: string;
  /** Restrict the database page to one counterparty address. */
  counterparty?: string;
  since?: Date | string;
  until?: Date | string;
};

export async function readSupabaseTransfers(
  ctx: ApiContext,
  cursorOrOptions?: LedgerCursor | TransferReadOptions,
) {
  const options: TransferReadOptions =
    cursorOrOptions && "createdAt" in cursorOrOptions
      ? { cursor: cursorOrOptions }
      : (cursorOrOptions ?? {});
  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }
  const scopedWallets = options.walletId
    ? wallets.filter((wallet) => wallet.id === options.walletId)
    : wallets;
  if (scopedWallets.length === 0) {
    return [];
  }
  const since = options.since instanceof Date ? options.since.toISOString() : options.since;
  const until = options.until instanceof Date ? options.until.toISOString() : options.until;
  const rows = await selectRowsExhaustive(
    ctx,
    "ledger_events",
    {
      inFilters: { governed_wallet_id: scopedWallets.map((wallet) => wallet.id) },
      filters: options.counterparty ? { counterparty_address: options.counterparty } : undefined,
      gte: since ? { event_time: since } : undefined,
      lte: until ? { event_time: until } : undefined,
      order: "event_time.desc,id.desc",
      before: options.cursor,
    },
    {
      cursorColumn: "event_time",
      stopAfter: options.limit,
      label: "ledger_events.read",
    },
  );
  const transfers = rowsForWalletIdentity(rows, scopedWallets).map((row) =>
    transferFromRow(row, scopedWallets),
  );
  // Keep the range check in the API as well as the PostgREST predicate. It
  // covers legacy rows whose timestamp mapper uses created_at and protects the
  // aggregate contract if a test/read-model adapter ignores range operators.
  return transfers.filter((transfer) => {
    const timestamp = transfer.timestamp.getTime();
    const afterSince = !since || timestamp >= new Date(since).getTime();
    const beforeUntil = !until || timestamp <= new Date(until).getTime();
    return afterSince && beforeUntil;
  });
}

/**
 * Exact count for a ledger page. Production Supabase adapters use
 * Content-Range/count=exact and still return only one id row; in-memory
 * adapters without count support fall back to their scoped rows.
 */
export async function readSupabaseTransferCount(
  ctx: ApiContext,
  options: Pick<
    TransferReadOptions,
    "cursor" | "since" | "until" | "walletId" | "counterparty"
  > = {},
) {
  const wallets = await readSupabaseWallets(ctx);
  const scopedWallets = options.walletId
    ? wallets.filter((wallet) => wallet.id === options.walletId)
    : wallets;
  if (scopedWallets.length === 0) {
    return 0;
  }
  const since = options.since instanceof Date ? options.since.toISOString() : options.since;
  const until = options.until instanceof Date ? options.until.toISOString() : options.until;
  const requestOptions: SupabaseRequestOptions = {
    inFilters: { governed_wallet_id: scopedWallets.map((wallet) => wallet.id) },
    filters: options.counterparty ? { counterparty_address: options.counterparty } : undefined,
    gte: since ? { event_time: since } : undefined,
    lte: until ? { event_time: until } : undefined,
    before: options.cursor,
    beforeColumn: "event_time",
  };
  if (ctx.supabase?.countRows) {
    try {
      return await ctx.supabase.countRows("ledger_events", requestOptions);
    } catch (error) {
      throw readModelUnavailable("ledger_events.count", error);
    }
  }
  return (
    await readSupabaseTransfers(ctx, {
      cursor: options.cursor,
      walletId: options.walletId,
      counterparty: options.counterparty,
      since: options.since,
      until: options.until,
    })
  ).length;
}

/** Governance event from the indexed Supabase audit trail. The field shape
 * matches what the dashboard event stream historically received from the local
 * `events` table, while the production stream now includes transfer outcomes
 * and the policy, signer, module, and vendor changes emitted onchain. */
export type GovernanceEventRecord = {
  id: string;
  tenantId: string;
  walletId: string | null;
  type: string;
  severity: string;
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
};

function governanceEventFromRow(row: SupabaseRow, wallets: Wallet[]): GovernanceEventRecord {
  const wallet = walletForRow(row, wallets);
  const status = stringField(row, ["status", "verdict"], "allowed").toLowerCase();
  const type =
    status === "escalated"
      ? "TRANSFER_ESCALATED"
      : status === "denied" || status === "blocked"
        ? "TRANSFER_DENIED"
        : "TRANSFER_ALLOWED";
  const severity =
    status === "escalated"
      ? "warning"
      : status === "denied" || status === "blocked"
        ? "danger"
        : "success";
  const txHash = stringField(row, ["tx_hash", "hash"], stableHash(`event:${JSON.stringify(row)}`));

  return {
    id: stringField(row, ["id"], stableUuid(`event:${txHash}`)),
    tenantId: stringField(row, ["tenant_id", "organization_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stringField(row, ["governed_wallet_id", "wallet_id"], null),
    type,
    severity,
    payload: {
      category: stringField(row, ["category", "vendor_category"], "other"),
      counterparty: stringField(row, ["counterparty_name"], null),
      reason: stringField(row, ["decision_reason"], null),
      amountUsdc: numberField(row, ["amount_usdc", "amount"], 0),
    },
    blockNumber: numberField(row, ["block_number"], 0),
    txHash,
    timestamp: dateField(row, ["event_time", "created_at"]),
  };
}

function storedGovernanceEventFromRow(row: SupabaseRow): GovernanceEventRecord {
  const txHash = stringField(row, ["tx_hash"], stableHash(`governance:${JSON.stringify(row)}`));
  const payload = row.payload;
  return {
    id: stringField(row, ["id"], stableUuid(`governance:${txHash}`)),
    tenantId: stringField(row, ["tenant_id", "organization_id"], FALLBACK_TENANT_ID),
    walletId: stringField(row, ["governed_wallet_id", "wallet_id"], null),
    type: stringField(row, ["event_type", "type"], "GOVERNANCE_EVENT"),
    severity: stringField(row, ["severity"], "info"),
    payload:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    blockNumber: numberField(row, ["block_number"], 0),
    txHash,
    timestamp: dateField(row, ["event_time", "created_at"]),
  };
}

async function readOptionalGovernanceRows(ctx: ApiContext, walletIds: string[], limit: number) {
  if (!ctx.supabase) {
    return selectRows(ctx, "governance_events", {
      inFilters: { governed_wallet_id: walletIds },
      order: "created_at.desc,id.desc",
      limit,
    });
  }
  try {
    return await ctx.supabase.selectRows("governance_events", {
      inFilters: { governed_wallet_id: walletIds },
      order: "created_at.desc,id.desc",
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Deploying API code can precede the migration. Only absence of this new
    // table is optional; every other read failure remains fail-closed.
    if (
      message.includes("404") ||
      message.includes("42P01") ||
      message.includes("PGRST205") ||
      message.includes("Could not find the table")
    ) {
      warnSupabase("governance_events.not-migrated", error);
      return [];
    }
    throw readModelUnavailable("governance_events.read", error);
  }
}

/**
 * Owner-scoped governance event stream, read from the indexed Supabase ledger.
 * The dashboard's "Governed event stream" used to read the local Postgres
 * `events` table, which only exists in the development workspace - in a
 * deployed environment that read failed closed and the stream was permanently
 * "unavailable". The indexed read model is the real source of chain history,
 * so the stream now derives from it like every other read.
 */
export async function readSupabaseEvents(
  ctx: ApiContext,
  options?: { walletId?: string; page?: number; pageSize?: number },
): Promise<GovernanceEventRecord[]> {
  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }

  const [rows, governanceRows] = await Promise.all([
    selectRows(ctx, "ledger_events", {
      inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
      order: "created_at.desc,id.desc",
      limit: Math.min(
        (options?.page ?? 0) * (options?.pageSize ?? 50) + (options?.pageSize ?? 50),
        MAX_GOVERNANCE_EVENT_ROWS,
      ),
    }),
    readOptionalGovernanceRows(
      ctx,
      wallets.map((wallet) => wallet.id),
      Math.min(
        (options?.page ?? 0) * (options?.pageSize ?? 50) + (options?.pageSize ?? 50),
        MAX_GOVERNANCE_EVENT_ROWS,
      ),
    ),
  ]);

  const page = options?.page ?? 0;
  const pageSize = options?.pageSize ?? 50;

  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  return [
    ...rowsForWalletIdentity(rows, wallets).map((row) => governanceEventFromRow(row, wallets)),
    ...governanceRows
      .map(storedGovernanceEventFromRow)
      .filter((event) => event.walletId !== null && walletIds.has(event.walletId)),
  ]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .filter((event) => (options?.walletId ? event.walletId === options.walletId : true))
    .slice(page * pageSize, page * pageSize + pageSize);
}

/**
 * Public, unscoped ledger for one governed wallet. The explorer and badge pages
 * are meant to be verifiable by anyone, so they cannot use the owner-scoped
 * read: an anonymous visitor has no session and would always see zero rows.
 */
export async function readSupabasePublicLedger(
  ctx: ApiContext,
  address: string,
  limit?: number,
): Promise<Transfer[]> {
  // This reader is used by anonymous explorer/badge requests and therefore
  // must repeat the publication gate independently of the profile endpoint.
  // Otherwise a direct ledger call could bypass an opted-out profile.
  const profileRows = await selectRows(ctx, "public_wallet_profiles", {
    filters: { wallet_address: address.toLowerCase() },
    limit: 1,
  });
  const profile = profileRows[0];
  if (!profile || !booleanField(profile, ["show_public_badge"], false)) {
    return [];
  }

  const wallet = await readSupabaseWalletByAddressUnscoped(ctx, address);
  if (!wallet) {
    return [];
  }

  const rows = await selectRowsExhaustive(
    ctx,
    "ledger_events",
    {
      filters: { governed_wallet_id: wallet.id },
      order: "event_time.desc,id.desc",
    },
    {
      cursorColumn: "event_time",
      stopAfter: limit,
      label: "public.ledger_events.read",
    },
  );

  // The public record proves what the wallet did; it must not hand out the
  // tenant's internal wiring or the free-text decision rationale.
  return rows.map((row) => {
    const transfer = transferFromRow(row, [wallet]);
    return {
      ...transfer,
      tenantId: "",
      walletId: "",
      agentId: null,
      reason: "",
    };
  });
}

/** Base units (6dp USDC) to a decimal string without going through a float. */
export function formatUsdcBaseUnits(value: bigint) {
  const whole = value / 1_000_000n;
  const cents = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toString()}.${cents}`;
}
