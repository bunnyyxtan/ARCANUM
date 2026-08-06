import { defaultTenantId } from "@arcanum/db";
import { TRPCError } from "@trpc/server";

import type { ApiContext } from "../context";
import {
  readModelUnavailable,
  readSupabaseAgentByLooseId,
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
 * surfaced as an explicit "data unavailable" error — never swallowed into an
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

/** Resolve an agent by its id, signer address, or governed wallet identity. */
export function findAgentByWalletLooseId(ctx: ApiContext, looseWalletId: string) {
  return readSupabaseAgentByLooseId(ctx, looseWalletId);
}
