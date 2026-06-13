import { escalations } from "@arcanum/db/schema";
import {
  escalationByTxHashInputSchema,
  escalationDecisionInputSchema,
  escalationListInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte } from "drizzle-orm";

import { fallbackEscalations } from "../mock-fallback";
import { readSupabaseEscalationByTxHash, readSupabaseEscalations } from "../supabase";
import { publicProcedure, router } from "../trpc";
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

  approve: publicProcedure
    .input(escalationDecisionInputSchema)
    .mutation(() => onChainEscalationWriteOnly()),

  reject: publicProcedure
    .input(escalationDecisionInputSchema)
    .mutation(() => onChainEscalationWriteOnly()),
});
