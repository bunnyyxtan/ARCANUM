import type { Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import { type SupabaseRequestOptions, type SupabaseRow, readModelUnavailable } from "./client";
import { stringField } from "./fields";

export async function selectRows(ctx: ApiContext, table: string, options?: SupabaseRequestOptions) {
  // Reads scoped in memory cannot be bounded until legacy wallet identity columns are retired.
  // PostgREST has no tolerant `or` across columns that may not exist.
  const client = ctx.supabase;
  if (!client) {
    // A missing configuration must never look like "no rows": for a product
    // whose promise is showing what an agent spent, a calm empty dashboard on
    // top of a broken read model is worse than an error.
    throw readModelUnavailable(
      `${table}.read`,
      new Error(
        "Supabase read model is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      ),
    );
  }

  try {
    return await client.selectRows(table, options);
  } catch (error) {
    throw readModelUnavailable(`${table}.read`, error);
  }
}

export function scopedRows(ctx: ApiContext, rows: SupabaseRow[]) {
  const scope = ownerScope(ctx);
  if (!scope) {
    return [];
  }

  const filtered = rows.filter((row) => {
    const owner = stringField(row, ["owner_address"]);
    // Private read-model rows must be wallet-owned; rows without owner metadata fail closed.
    return Boolean(owner) && owner.toLowerCase() === scope;
  });

  return filtered;
}

/**
 * Keep only the rows that belong to a wallet the caller owns. Uses the same
 * identity precedence as walletForRow so a row is never listed for one wallet
 * and then attributed to another.
 */
export function rowsForWallets(rows: SupabaseRow[], wallets: Wallet[]) {
  if (wallets.length === 0) {
    return [];
  }

  return rows.filter((row) => walletForRow(row, wallets) !== null);
}

/**
 * Vendors are organisation-scoped: the table has no wallet column, so a row can
 * only be tied to the org. Keep every row for an org the caller owns a wallet
 * in, and attribute it to that org's first wallet purely for display.
 */
export function orgScopedRowsForWallets(rows: SupabaseRow[], wallets: Wallet[]) {
  if (wallets.length === 0) {
    return [] as { row: SupabaseRow; wallet: Wallet }[];
  }

  const walletsByOrg = new Map<string, Wallet>();
  for (const wallet of wallets) {
    if (!walletsByOrg.has(wallet.orgId)) {
      walletsByOrg.set(wallet.orgId, wallet);
    }
  }

  const matched: { row: SupabaseRow; wallet: Wallet }[] = [];
  for (const row of rows) {
    const wallet =
      walletForRow(row, wallets) ?? walletsByOrg.get(stringField(row, ["organization_id"], ""));
    if (wallet) {
      matched.push({ row, wallet });
    }
  }

  return matched;
}

export function rowsForWalletIdentity(rows: SupabaseRow[], wallets: Wallet[]) {
  const walletAddresses = new Set(wallets.map((wallet) => wallet.address.toLowerCase()));
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  if (walletAddresses.size === 0) {
    return [];
  }

  return rows.filter((row) => {
    const walletAddress = stringField(row, ["wallet_address"], "").toLowerCase();
    const governedWalletId = stringField(row, ["governed_wallet_id", "wallet_id"], "");
    return (
      (Boolean(walletAddress) && walletAddresses.has(walletAddress)) ||
      (Boolean(governedWalletId) && walletIds.has(governedWalletId))
    );
  });
}

/**
 * Resolve the wallet a Supabase row belongs to, strongest identity first.
 *
 * The organization is a last resort and only decides the row when the org owns
 * exactly one wallet: every wallet in an org shares its id, so matching on it
 * first would file each row under whichever wallet happened to be listed first.
 */
export function walletForRow(row: SupabaseRow, wallets: Wallet[]) {
  const walletAddress = stringField(row, ["wallet_address"], "").toLowerCase();
  if (walletAddress) {
    const byAddress = wallets.find((wallet) => wallet.address.toLowerCase() === walletAddress);
    if (byAddress) {
      return byAddress;
    }
  }

  const governedWalletId = stringField(row, ["governed_wallet_id", "wallet_id"], "");
  if (governedWalletId) {
    const byId = wallets.find((wallet) => wallet.id === governedWalletId);
    if (byId) {
      return byId;
    }
  }

  // A row that names a wallet we do not own is not ours to reassign.
  if (walletAddress || governedWalletId) {
    return null;
  }

  const organizationId = stringField(row, ["organization_id"], "");
  if (!organizationId) {
    return null;
  }

  const orgWallets = wallets.filter((wallet) => wallet.orgId === organizationId);
  return orgWallets.length === 1 ? orgWallets[0] : null;
}

export function ownerScope(ctx: ApiContext) {
  return ctx.session?.walletAddress.toLowerCase() ?? null;
}

export function requiredStringField(row: SupabaseRow | undefined, keys: string[], label: string) {
  const value = stringField(row, keys, "");
  if (!value) {
    throw new Error(`${label} was not returned by Supabase.`);
  }

  return value;
}

/**
 * Every auto-provisioned workspace starts under the same placeholder. Keeping
 * it in one exported constant is what lets the product recognise a workspace
 * nobody has named yet and ask its owner for a real one.
 */
