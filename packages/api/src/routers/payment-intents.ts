import {
  type NormalizedPaymentIntentInput,
  type PaymentIntentDecision,
  type PaymentIntentResult,
  createPaymentIntentResult,
  signedPaymentIntentInputSchema,
} from "@arcanum/shared";
import type { PublicClient } from "viem";

import { isReceiptError } from "../receipts/errors";
import {
  evaluatePaymentIntentAtBlock,
  parsePaymentIntentAmount,
  verifyPaymentIntentSignature,
} from "../receipts/evaluation";
import { rateLimitedPublicProcedure, router } from "../trpc";

export const paymentIntentsRouter = router({
  create: rateLimitedPublicProcedure
    .input(signedPaymentIntentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const signatureValid = await verifyPaymentIntentSignature(input);

      if (!signatureValid) {
        return intentResult(input, {
          decision: "validation_error",
          reason: "Agent signer signature did not match this payment intent.",
          errorCode: "SIGNATURE_INVALID",
        });
      }

      return evaluatePaymentIntent(ctx.publicClient, input);
    }),
});

/**
 * Read-only preflight. It runs the same pinned-block evaluation the receipt
 * path signs, but reports every outcome -- including input and chain failures
 * -- in the result body rather than as errors, because this endpoint predates
 * receipts and integrations branch on its `decision` field.
 */
async function evaluatePaymentIntent(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
): Promise<PaymentIntentResult> {
  try {
    const { amount, decision } = await evaluatePaymentIntentAtBlock(publicClient, intent);

    if (decision.reasonCode === "AGENT_NOT_AUTHORIZED") {
      return intentResult(intent, {
        amount,
        decision: "deny",
        reason: "Agent signer is not authorized for this GuardedWallet.",
        errorCode: "AGENT_NOT_AUTHORIZED",
      });
    }
    if (decision.reasonCode === "WALLET_FROZEN") {
      return intentResult(intent, {
        amount,
        decision: "freeze",
        reason: "GuardedWallet is frozen.",
        errorCode: "WALLET_FROZEN",
      });
    }

    return intentResult(intent, {
      amount,
      decision: decision.verdict,
      reason: decision.reasonCode,
      policyReference: `guarded-wallet:${intent.governedWalletAddress}`,
    });
  } catch (error) {
    if (!isReceiptError(error)) {
      throw error;
    }
    const inputRejected =
      error.code === "UNSUPPORTED_CHAIN" ||
      error.code === "UNSUPPORTED_TOKEN" ||
      error.code === "INVALID_AMOUNT" ||
      error.code === "INVALID_RECIPIENT";
    return intentResult(intent, {
      amount: inputRejected ? undefined : (parsePaymentIntentAmount(intent.amount) ?? undefined),
      decision:
        error.code === "UNSUPPORTED_CHAIN" ||
        error.code === "UNSUPPORTED_TOKEN" ||
        error.code === "UNSUPPORTED_WALLET_TOKEN"
          ? "unsupported"
          : "validation_error",
      reason: error.message,
      errorCode: error.code,
    });
  }
}

function intentResult(
  intent: NormalizedPaymentIntentInput,
  input: Readonly<{
    decision: PaymentIntentDecision;
    reason: string;
    amount?: bigint;
    policyReference?: string;
    errorCode?: string;
  }>,
) {
  return createPaymentIntentResult(intent, {
    decision: input.decision,
    reason: input.reason,
    amountBaseUnits: input.amount,
    policyReference: input.policyReference,
    errorCode: input.errorCode,
  });
}
