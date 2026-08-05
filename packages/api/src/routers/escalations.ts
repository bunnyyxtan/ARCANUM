import { escalations } from "@arcanum/db/schema";
import {
  escalationByTxHashInputSchema,
  escalationDecisionInputSchema,
  escalationListInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte } from "drizzle-orm";

import { z } from "zod";

import { isEscalationSigner, readEscalationChainState } from "../chain";
import { fallbackEscalations } from "../mock-fallback";
import {
  readSupabaseEscalationByTxHash,
  readSupabaseEscalations,
  readSupabaseWalletByLooseId,
  recordSupabaseEscalationDecision,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { canUseDemoFallback, readDbOrFallback, tenantIdFor } from "./helpers";

function onChainEscalationWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Escalation approvals and rejections must be submitted on-chain by an authorized approver.",
  });
}

export const escalationsRouter = router({
  list: publicProcedure.input(escalationListInputSchema).query(async ({ ctx, input }) => {
    if (canUseDemoFallback(ctx)) {
      return input?.status
        ? fallbackEscalations.filter((escalation) => escalation.status === input.status)
        : fallbackEscalations;
    }

    const tenantId = tenantIdFor(ctx);
    const status = input?.status;
    const supabaseRows = await readSupabaseEscalations(ctx, status);

    if (supabaseRows.length > 0) {
      return supabaseRows;
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "escalations.list",
      () =>
        ctx.db.query.escalations.findMany({
          where: status
            ? and(
                eq(escalations.tenantId, tenantId),
                eq(escalations.status, status),
                status === "PENDING" ? gte(escalations.expiresAt, new Date()) : undefined,
              )
            : eq(escalations.tenantId, tenantId),
          orderBy: asc(escalations.expiresAt),
        }),
      [],
    );

    if (rows.length > 0) {
      return rows;
    }

    return status
      ? fallbackEscalations.filter((escalation) => escalation.status === status)
      : fallbackEscalations;
  }),

  byTxHash: publicProcedure.input(escalationByTxHashInputSchema).query(async ({ ctx, input }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackEscalations.find((escalation) => escalation.id === input.txHash) ?? null;
    }

    const tenantId = tenantIdFor(ctx);
    const supabaseRow = await readSupabaseEscalationByTxHash(ctx, input.txHash);

    if (supabaseRow) {
      return supabaseRow;
    }

    return (
      (await readDbOrFallback(
        "escalations.byTxHash",
        () =>
          ctx.db.query.escalations.findFirst({
            where: and(eq(escalations.tenantId, tenantId), eq(escalations.id, input.txHash)),
          }),
        undefined,
      )) ??
      (canUseDemoFallback(ctx)
        ? fallbackEscalations.find((escalation) => escalation.id === input.txHash)
        : null) ??
      null
    );
  }),

  /**
   * Mirror an approve/reject that already settled on-chain into the read model.
   * The status is taken from the chain, never from the caller, so the queue can
   * never be marked resolved for a transaction that did not happen.
   */
  recordDecision: protectedProcedure
    .input(
      z.object({
        escalationKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid escalation key"),
        txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const escalationKey = input.escalationKey as `0x${string}`;
      const chainState = await readEscalationChainState(escalationKey);

      if (!chainState) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Escalation was not found on Arc Testnet.",
        });
      }
      if (chainState.status === "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Escalation is still pending on-chain; nothing to record yet.",
        });
      }

      const wallet = await readSupabaseWalletByLooseId(ctx, chainState.wallet.toLowerCase());
      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet for this escalation was not found.",
        });
      }

      const caller = ctx.session.walletAddress.toLowerCase();
      const isOwner = wallet.ownerAddress.toLowerCase() === caller;
      if (!isOwner && !(await isEscalationSigner(chainState.wallet, caller as `0x${string}`))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the wallet owner or an authorized approver can record this decision.",
        });
      }

      const result = await recordSupabaseEscalationDecision(ctx, wallet, {
        escalationKey,
        txHash: input.txHash as `0x${string}`,
        status: chainState.status,
        approvalsCount: chainState.signatures,
      });

      if (!result.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.message });
      }

      return result.data;
    }),

  approve: publicProcedure
    .input(escalationDecisionInputSchema)
    .mutation(() => onChainEscalationWriteOnly()),

  reject: publicProcedure
    .input(escalationDecisionInputSchema)
    .mutation(() => onChainEscalationWriteOnly()),
});
