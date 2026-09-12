import type { Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import type { SupabaseRow } from "./client";
import { stringField } from "./fields";

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
