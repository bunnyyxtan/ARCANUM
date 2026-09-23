import type { Wallet } from "@arcanum/db/schema";
import { ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import type { ApiContext } from "../context";
import { readCallerMembership } from "./auth";
import { SupabaseRpcError, readModelUnavailable } from "./client";
import { ownerScope } from "./scope";

const signatures: Record<string, string> = {
  scoped_ledger_analytics:
    "uuid[], text, uuid, text, timestamp with time zone, timestamp with time zone, boolean",
  scoped_anomaly_counts: "uuid[], text, uuid, text",
  scoped_current_doctrines: "uuid[], text, uuid, text",
};

export function missingAnalyticsFunction(
  error: unknown,
  fn: string,
  args: Record<string, unknown>,
) {
  if (!(error instanceof SupabaseRpcError) || error.fn !== fn) return false;
  if (error.code === "PGRST202" && error.status === 404) {
    return (
      error.detail ===
      `Could not find the function public.${fn}(${Object.keys(args).sort().join(", ")}) in the schema cache`
    );
  }
  return (
    error.code === "42883" &&
    error.status === 404 &&
    error.detail === `function public.${fn}(${signatures[fn]}) does not exist`
  );
}

/**
 * Server-only trust boundary: IDs come from authorized wallet discovery, org
 * from authenticated membership, factory from the deployment manifest. There
 * is no tenant column in this single-tenant read model; multi-tenant sign-in
 * remains prohibited. Never accept any of these arguments from request input.
 */
export async function scopedAnalyticsRpc(
  ctx: ApiContext,
  wallets: Wallet[],
  fn: string,
  extra: Record<string, unknown> = {},
): Promise<{ available: false } | { available: true; data: unknown }> {
  const args = {
    p_wallet_ids: wallets.map((wallet) => wallet.id),
    p_owner_address: ownerScope(ctx),
    p_organization_id: (await readCallerMembership(ctx))?.orgId ?? null,
    p_factory_address: deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase(),
    ...extra,
  };
  try {
    if (!ctx.supabase) throw new Error("Supabase read model is not configured.");
    return { available: true, data: await ctx.supabase.callFunction(fn, args) };
  } catch (error) {
    // Deliberate OLD-SCHEMA compatibility only. Permission, SQL and network
    // failures must not trigger expensive scans or hide an unavailable model.
    if (missingAnalyticsFunction(error, fn, args)) return { available: false };
    throw readModelUnavailable(fn, error);
  }
}

export function aggregateCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid analytics count.");
  }
  return value;
}

export function aggregateMoney(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|-?[1-9]\d*)$/.test(value)) {
    throw new Error("Invalid analytics base-unit text.");
  }
  return BigInt(value);
}
