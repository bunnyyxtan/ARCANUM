import {
  ARC_NETWORK_NAME,
  escalationByTxHashInputSchema,
  escalationDecisionInputSchema,
  escalationKeyInputSchema,
  escalationListInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import { z } from "zod";

import {
  isEscalationSigner,
  readEscalationChainState,
  readWalletOwner,
  verifyEscalationDecisionReceipt,
} from "../chain";
import {
  readSupabaseEscalationByTxHash,
  readSupabaseEscalations,
  readSupabasePublicEscalationByKey,
  readSupabaseWalletByAddressUnscoped,
  recordSupabaseEscalationDecision,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";

function onChainEscalationWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Escalation approvals and rejections must be submitted onchain by an authorized approver.",
  });
}

// Escalations are governance-critical: reads go to the Supabase read model,
// which fails closed so an outage can never look like "nothing needs review".
export const escalationsRouter = router({
  list: publicProcedure
    .input(escalationListInputSchema)
    .query(({ ctx, input }) =>
      readSupabaseEscalations(ctx, input?.status, input?.cursor, input?.limit),
    ),

  byTxHash: publicProcedure
    .input(escalationByTxHashInputSchema)
    .query(({ ctx, input }) => readSupabaseEscalationByTxHash(ctx, input.txHash)),

  publicByKey: publicProcedure.input(escalationKeyInputSchema).query(async ({ ctx, input }) => {
    const escalation = await readSupabasePublicEscalationByKey(ctx, input.escalationKey);
    if (!escalation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Escalation not found." });
    }
    return escalation;
  }),

  /**
   * Mirror an approve/reject that already settled onchain into the read model.
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
          message: `Escalation was not found on ${ARC_NETWORK_NAME}.`,
        });
      }
      if (chainState.status === "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Escalation is still pending onchain; nothing to record yet.",
        });
      }

      try {
        await verifyEscalationDecisionReceipt(
          ctx.publicClient,
          input.txHash as `0x${string}`,
          escalationKey,
          chainState.status,
        );
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The transaction is not a successful decision for this escalation.",
          cause: error,
        });
      }

      // Approvers are frequently council members rather than the wallet owner,
      // so resolve the wallet unscoped and authorize against the chain below.
      const wallet = await readSupabaseWalletByAddressUnscoped(ctx, chainState.wallet);
      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet for this escalation was not found.",
        });
      }

      const caller = ctx.session.walletAddress.toLowerCase();
      let isOwner = false;
      try {
        const chainOwner = await readWalletOwner(ctx.publicClient, wallet.address as `0x${string}`);
        isOwner = chainOwner.toLowerCase() === caller;
      } catch (error) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "The governed wallet owner could not be verified onchain. Try again shortly.",
          cause: error,
        });
      }
      if (!isOwner && !(await isEscalationSigner(chainState.wallet, caller as `0x${string}`))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the wallet owner or an authorized approver can record this decision.",
        });
      }

      const result = await recordSupabaseEscalationDecision(ctx, wallet, {
        escalationKey,
        txHash: input.txHash as `0x${string}`,
        status:
          chainState.status === "executed"
            ? "released"
            : chainState.status === "rejected"
              ? "rejected"
              : chainState.status === "denied"
                ? "denied"
                : chainState.status,
        approvalsCount: chainState.signatures,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.message,
        });
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
