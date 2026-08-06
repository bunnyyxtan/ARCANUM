import {
  escalationByTxHashInputSchema,
  escalationDecisionInputSchema,
  escalationListInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import { z } from "zod";

import { isEscalationSigner, readEscalationChainState } from "../chain";
import {
  readSupabaseEscalationByTxHash,
  readSupabaseEscalations,
  readSupabaseWalletByAddressUnscoped,
  recordSupabaseEscalationDecision,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";

function onChainEscalationWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Escalation approvals and rejections must be submitted on-chain by an authorized approver.",
  });
}

// Escalations are governance-critical: reads go to the Supabase read model,
// which fails closed so an outage can never look like "nothing needs review".
export const escalationsRouter = router({
  list: publicProcedure
    .input(escalationListInputSchema)
    .query(({ ctx, input }) => readSupabaseEscalations(ctx, input?.status)),

  byTxHash: publicProcedure
    .input(escalationByTxHashInputSchema)
    .query(({ ctx, input }) => readSupabaseEscalationByTxHash(ctx, input.txHash)),

  /**
   * Mirror an approve/reject that already settled on-chain into the read model.
   * The status is taken from the chain, never from the caller, so the queue can
   * never be marked resolved for a transaction that did not happen.
   */
  recordDecision: protectedProcedure
    .input(
      z.object({
        escalationKey: z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid escalation key"),
        txHash: z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash"),
      })
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
          message:
            "Escalation is still pending on-chain; nothing to record yet.",
        });
      }

      // Approvers are frequently council members rather than the wallet owner,
      // so resolve the wallet unscoped and authorize against the chain below.
      const wallet = await readSupabaseWalletByAddressUnscoped(
        ctx,
        chainState.wallet
      );
      if (!wallet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet for this escalation was not found.",
        });
      }

      const caller = ctx.session.walletAddress.toLowerCase();
      const isOwner = wallet.ownerAddress.toLowerCase() === caller;
      if (
        !isOwner &&
        !(await isEscalationSigner(chainState.wallet, caller as `0x${string}`))
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the wallet owner or an authorized approver can record this decision.",
        });
      }

      const result = await recordSupabaseEscalationDecision(ctx, wallet, {
        escalationKey,
        txHash: input.txHash as `0x${string}`,
        status: chainState.status,
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
