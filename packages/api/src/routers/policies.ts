import { policies } from "@arcanum/db/schema";
import { agentByWalletInputSchema, policyUpdateInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { fallbackPolicies } from "../mock-fallback";
import { readSupabasePolicy } from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { canUseDemoFallback, findWalletByLooseId, readDbOrFallback, tenantIdFor } from "./helpers";

function onChainPolicyWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Policy updates must be submitted on-chain by the governed wallet owner.",
  });
}

export const policiesRouter = router({
  get: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const wallet = await findWalletByLooseId(ctx, input.walletId);
    const supabasePolicy = await readSupabasePolicy(ctx, wallet);

    if (supabasePolicy) {
      return supabasePolicy;
    }

    if (!canUseDemoFallback(ctx)) {
      return null;
    }

    const row = await readDbOrFallback(
      "policies.get",
      () =>
        ctx.db.query.policies.findFirst({
          where: and(
            eq(policies.tenantId, tenantId),
            eq(policies.walletId, wallet?.id ?? input.walletId),
          ),
          orderBy: desc(policies.version),
        }),
      undefined,
    );

    return row ?? fallbackPolicies.find((policy) => policy.walletId === wallet?.id) ?? null;
  }),

  update: protectedProcedure.input(policyUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.walletId);

    if (!wallet) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Wallet not found" });
    }

    return onChainPolicyWriteOnly();
  }),

  count: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);

    if (!canUseDemoFallback(ctx)) {
      return 0;
    }

    const [row] = await readDbOrFallback(
      "policies.count",
      () =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(policies)
          .where(eq(policies.tenantId, tenantId)),
      [],
    );

    return row?.count ?? fallbackPolicies.length;
  }),
});
