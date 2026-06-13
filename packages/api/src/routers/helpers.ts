import { defaultTenantId } from "@arcanum/db";
import { agents, wallets } from "@arcanum/db/schema";
import { isDemoOwnerWallet } from "@arcanum/shared";
import { and, eq, or } from "drizzle-orm";
import { isAddress } from "viem";

import type { ApiContext } from "../context";
import { fallbackAgents, fallbackWalletRows, fallbackWallets } from "../mock-fallback";
import { readSupabaseAgentByLooseId, readSupabaseWalletByLooseId } from "../supabase";

const dbFallbackWarnings = new Set<string>();

export function tenantIdFor(ctx: ApiContext) {
  return ctx.session?.tenantId ?? defaultTenantId();
}

export function actorFor(ctx: ApiContext) {
  return ctx.session?.walletAddress ?? "0x0000000000000000000000000000000000000000";
}

export function canUseDemoFallback(ctx: ApiContext) {
  return isDemoOwnerWallet(ctx.session?.walletAddress, process.env.ARCANUM_DEMO_OWNER_WALLET);
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

export function syntheticHash(seed: string) {
  return `0x${Buffer.from(seed).toString("hex").padEnd(64, "0").slice(0, 64)}`;
}

export async function readDbOrFallback<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T | (() => T),
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    warnDbFallback(label, error);
    return resolveFallback(fallback);
  }
}

export async function writeDbOrFallback<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T | (() => T),
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    warnDbFallback(label, error);
    return resolveFallback(fallback);
  }
}

export async function findWalletByLooseId(ctx: ApiContext, looseWalletId: string) {
  const tenantId = tenantIdFor(ctx);
  const normalized = looseWalletId.toLowerCase();

  if (canUseDemoFallback(ctx)) {
    return (
      fallbackWalletRows.find(
        (wallet) =>
          wallet.id === looseWalletId ||
          wallet.address.toLowerCase() === normalized ||
          wallet.label.toLowerCase() === normalized,
      ) ?? null
    );
  }

  const supabaseWallet = await readSupabaseWalletByLooseId(ctx, looseWalletId);

  if (supabaseWallet) {
    return supabaseWallet;
  }

  if (!canUseDemoFallback(ctx)) {
    return null;
  }

  const row = await readDbOrFallback(
    "wallets.findByLooseId",
    () =>
      ctx.db.query.wallets.findFirst({
        where: isAddress(looseWalletId)
          ? and(eq(wallets.tenantId, tenantId), eq(wallets.address, normalized))
          : and(
              eq(wallets.tenantId, tenantId),
              or(eq(wallets.id, looseWalletId), eq(wallets.address, normalized)),
            ),
      }),
    undefined,
  );

  if (row) {
    return row;
  }

  return (
    fallbackWalletRows.find(
      (wallet) =>
        wallet.id === looseWalletId ||
        wallet.address.toLowerCase() === normalized ||
        wallet.label.toLowerCase() === normalized,
    ) ?? null
  );
}

export async function findAgentByWalletLooseId(ctx: ApiContext, looseWalletId: string) {
  const tenantId = tenantIdFor(ctx);
  const normalized = looseWalletId.toLowerCase();
  const wallet = await findWalletByLooseId(ctx, looseWalletId);

  if (canUseDemoFallback(ctx)) {
    return (
      fallbackAgents.find(
        (agent) =>
          agent.id === looseWalletId ||
          agent.walletId === looseWalletId ||
          agent.signerAddress.toLowerCase() === normalized ||
          fallbackWallets.find((item) => item.id === agent.walletId)?.address.toLowerCase() ===
            normalized,
      ) ?? null
    );
  }

  const supabaseAgent = await readSupabaseAgentByLooseId(ctx, looseWalletId);

  if (supabaseAgent) {
    return supabaseAgent;
  }

  if (!canUseDemoFallback(ctx)) {
    return null;
  }

  const row = await readDbOrFallback(
    "agents.findByWalletLooseId",
    () =>
      ctx.db.query.agents.findFirst({
        where: wallet
          ? and(eq(agents.tenantId, tenantId), eq(agents.walletId, wallet.id))
          : and(
              eq(agents.tenantId, tenantId),
              or(eq(agents.id, looseWalletId), eq(agents.signerAddress, normalized)),
            ),
      }),
    undefined,
  );

  if (row) {
    return row;
  }

  return (
    fallbackAgents.find(
      (agent) =>
        agent.id === looseWalletId ||
        agent.walletId === looseWalletId ||
        agent.signerAddress.toLowerCase() === normalized ||
        fallbackWallets.find((item) => item.id === agent.walletId)?.address.toLowerCase() ===
          normalized,
    ) ?? null
  );
}

export function isFallbackTenant(ctx: ApiContext) {
  return !ctx.session;
}

function resolveFallback<T>(fallback: T | (() => T)): T {
  return typeof fallback === "function" ? (fallback as () => T)() : fallback;
}

function warnDbFallback(label: string, error: unknown) {
  if (dbFallbackWarnings.has(label)) {
    return;
  }

  dbFallbackWarnings.add(label);
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[arcanum-api] ${label} fell back to safe local data: ${message}`);
}
