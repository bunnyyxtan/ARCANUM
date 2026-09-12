import { defaultTenantId } from "@arcanum/db";
import { TRPCError } from "@trpc/server";

import { readWalletOwner } from "../chain";
import type { ApiContext } from "../context";
import {
  readModelUnavailable,
  readSupabaseAgentByLooseId,
  readSupabaseWalletByAddressUnscoped,
  readSupabaseWalletByLooseId,
} from "../supabase";

export function tenantIdFor(ctx: ApiContext) {
  return ctx.session?.tenantId ?? defaultTenantId();
}

export function actorFor(ctx: ApiContext) {
  return ctx.session?.walletAddress ?? "0x0000000000000000000000000000000000000000";
}

export function toUsdcBaseUnits(amount: number) {
  return String(Math.round(amount * 1_000_000));
}

export function fromUsdcBaseUnits(amount: string | number | null | undefined) {
  if (amount === null || amount === undefined) {
    return 0;
  }

  const value = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(value) ? value / 1_000_000 : 0;
}

/**
 * Run a local-database operation that must fail closed. A storage problem is
 * surfaced as an explicit "data unavailable" error - never swallowed into an
 * empty result that looks like a legitimate "no activity yet".
 */
export async function failClosed<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    throw readModelUnavailable(label, error);
  }
}

/** Resolve a governed wallet by id, address, or label from the read model. */
export function findWalletByLooseId(ctx: ApiContext, looseWalletId: string) {
  return readSupabaseWalletByLooseId(ctx, looseWalletId);
}

export async function requireChainWalletOwner(ctx: ApiContext, walletAddress: string) {
  const caller = ctx.session?.walletAddress.toLowerCase();
  let chainOwner: string;
  try {
    chainOwner = (
      await readWalletOwner(ctx.publicClient, walletAddress as `0x${string}`)
    ).toLowerCase();
  } catch (error) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "The governed wallet owner could not be verified onchain. Try again shortly.",
      cause: error,
    });
  }

  if (!caller || chainOwner !== caller) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the current onchain wallet owner may record wallet metadata.",
    });
  }

  return chainOwner;
}

/**
 * Resolve a supplied governed-wallet address without trusting its eventually
 * consistent owner_address mirror, then authorize against the wallet contract.
 *
 * Owner-only metadata callbacks commonly arrive during the interval after an
 * OwnershipTransferred event and before Supabase has indexed it. Address
 * lookup keeps the current owner addressable in that interval; the chain read
 * prevents the former owner from retaining write authority.
 */
export async function requireWalletOwner(ctx: ApiContext, walletAddress: string) {
  const wallet = await readSupabaseWalletByAddressUnscoped(ctx, walletAddress);
  if (!wallet || wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Governed wallet was not found in the live read model.",
    });
  }

  await requireChainWalletOwner(ctx, wallet.address);

  return wallet;
}

/** Resolve an agent by its id, signer address, or governed wallet identity. */
export function findAgentByWalletLooseId(ctx: ApiContext, looseWalletId: string) {
  return readSupabaseAgentByLooseId(ctx, looseWalletId);
}
