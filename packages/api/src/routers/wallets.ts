import { agents, policies, wallets } from "@arcanum/db/schema";
import { addressSchema, looseWalletIdSchema } from "@arcanum/shared";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { fallbackAgents, fallbackPolicies, fallbackWalletRows } from "../mock-fallback";
import {
  readSupabaseAgents,
  readSupabasePolicies,
  readSupabasePublicWalletProfile,
  readSupabaseWallets,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { canUseDemoFallback, findWalletByLooseId, readDbOrFallback, tenantIdFor } from "./helpers";

export const walletsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackWalletRows;
    }

    const tenantId = tenantIdFor(ctx);
    const supabaseRows = await readSupabaseWallets(ctx);

    if (supabaseRows.length > 0) {
      return supabaseRows;
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "wallets.list",
      () =>
        ctx.db.query.wallets.findMany({
          where: eq(wallets.tenantId, tenantId),
          orderBy: desc(wallets.createdAt),
        }),
      [],
    );

    return rows.length > 0 ? rows : fallbackWalletRows;
  }),

  getById: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(({ ctx, input }) => {
      return findWalletByLooseId(ctx, input.walletId);
    }),

  getByAddress: publicProcedure
    .input(z.object({ address: addressSchema }))
    .query(({ ctx, input }) => {
      return findWalletByLooseId(ctx, input.address);
    }),

  publicProfile: publicProcedure
    .input(z.object({ address: addressSchema }))
    .query(({ ctx, input }) => {
      return readSupabasePublicWalletProfile(ctx, input.address);
    }),

  listAgents: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(async ({ ctx, input }) => {
      if (canUseDemoFallback(ctx)) {
        const wallet = await findWalletByLooseId(ctx, input.walletId);
        return fallbackAgents.filter((agent) => agent.walletId === wallet?.id);
      }

      const tenantId = tenantIdFor(ctx);
      const wallet = await findWalletByLooseId(ctx, input.walletId);
      const supabaseRows = await readSupabaseAgents(ctx);
      const supabaseWalletAgents = supabaseRows.filter((agent) => agent.walletId === wallet?.id);

      if (supabaseWalletAgents.length > 0) {
        return supabaseWalletAgents;
      }

      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "wallets.listAgents",
        () =>
          ctx.db.query.agents.findMany({
            where: and(
              eq(agents.tenantId, tenantId),
              eq(agents.walletId, wallet?.id ?? input.walletId),
            ),
            orderBy: desc(agents.lastSeenAt),
          }),
        [],
      );

      return rows.length > 0
        ? rows
        : canUseDemoFallback(ctx)
          ? fallbackAgents.filter((agent) => agent.walletId === wallet?.id)
          : [];
    }),

  listPolicies: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(async ({ ctx, input }) => {
      if (canUseDemoFallback(ctx)) {
        const wallet = await findWalletByLooseId(ctx, input.walletId);
        return fallbackPolicies.filter((policy) => policy.walletId === wallet?.id);
      }

      const tenantId = tenantIdFor(ctx);
      const wallet = await findWalletByLooseId(ctx, input.walletId);
      const supabaseRows = await readSupabasePolicies(ctx, wallet);

      if (supabaseRows.length > 0) {
        return supabaseRows;
      }

      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "wallets.listPolicies",
        () =>
          ctx.db.query.policies.findMany({
            where: and(
              eq(policies.tenantId, tenantId),
              eq(policies.walletId, wallet?.id ?? input.walletId),
            ),
            orderBy: desc(policies.version),
          }),
        [],
      );

      return rows.length > 0
        ? rows
        : canUseDemoFallback(ctx)
          ? fallbackPolicies.filter((policy) => policy.walletId === wallet?.id)
          : [];
    }),
});
