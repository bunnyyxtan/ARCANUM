import { GuardedWalletAbi, PolicyEngineAbi } from "@arcanum/contracts";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  type NormalizedPaymentIntentInput,
  type NormalizedSignedPaymentIntentInput,
  type PaymentIntentDecision,
  type PaymentIntentResult,
  createPaymentIntentMessage,
  createPaymentIntentResult,
  signedPaymentIntentInputSchema,
} from "@arcanum/shared";
import { type Address, type PublicClient, parseUnits, verifyMessage } from "viem";

import { rateLimitedPublicProcedure, router } from "../trpc";

const VERDICTS = [
  "allow",
  "escalate",
  "deny",
  "freeze",
] as const satisfies readonly PaymentIntentDecision[];
const REASONS = [
  "NONE",
  "ALLOWLIST_REQUIRED",
  "PER_TX_CAP",
  "DAILY_CAP",
  "ESCALATION_THRESHOLD",
  "BLOCKED_VENDOR",
  "CATEGORY_DISABLED",
] as const;

export const paymentIntentsRouter = router({
  create: rateLimitedPublicProcedure
    .input(signedPaymentIntentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const signatureValid = await verifyIntentSignature(input);

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

async function evaluatePaymentIntent(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
): Promise<PaymentIntentResult> {
  const amount = parsePaymentIntentAmount(intent.amount);

  if (intent.chainId !== ARC_TESTNET_CHAIN_ID) {
    return intentResult(intent, {
      decision: "unsupported",
      reason: "Only Arc Testnet payment intents are supported.",
      errorCode: "UNSUPPORTED_CHAIN",
    });
  }

  if (!sameAddress(intent.tokenAddress, ARC_TESTNET_USDC_ADDRESS)) {
    return intentResult(intent, {
      decision: "unsupported",
      reason: "Only Arc Testnet USDC payment intents are supported.",
      errorCode: "UNSUPPORTED_TOKEN",
    });
  }

  if (amount === null) {
    return intentResult(intent, {
      decision: "validation_error",
      reason: "Amount must be greater than zero with up to 6 decimals.",
      errorCode: "INVALID_AMOUNT",
    });
  }

  try {
    const [walletToken, isSigner, frozen, policy, dailySpent, policyEngine, vendorRegistry] =
      await Promise.all([
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "usdc",
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "agentSigners",
          args: [intent.agentSignerAddress],
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "frozen",
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "policy",
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "dailySpent",
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "policyEngine",
        }),
        publicClient.readContract({
          address: intent.governedWalletAddress,
          abi: GuardedWalletAbi,
          functionName: "vendorRegistry",
        }),
      ]);

    if (!sameAddress(walletToken, ARC_TESTNET_USDC_ADDRESS)) {
      return intentResult(intent, {
        amount,
        decision: "unsupported",
        reason: "GuardedWallet is not configured for Arc Testnet USDC.",
        errorCode: "UNSUPPORTED_WALLET_TOKEN",
      });
    }

    if (!isSigner) {
      return intentResult(intent, {
        amount,
        decision: "deny",
        reason: "Agent signer is not authorized for this GuardedWallet.",
        errorCode: "AGENT_NOT_AUTHORIZED",
      });
    }

    if (frozen) {
      return intentResult(intent, {
        amount,
        decision: "freeze",
        reason: "GuardedWallet is frozen.",
        errorCode: "WALLET_FROZEN",
      });
    }

    const policyEnvelope = {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyRollingCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
    };

    const [verdictIndex, reasonIndex] = await publicClient.readContract({
      account: intent.governedWalletAddress,
      address: policyEngine,
      abi: PolicyEngineAbi,
      functionName: "evaluate",
      args: [policyEnvelope, intent.vendorAddress, amount, dailySpent, vendorRegistry],
    });

    return intentResult(intent, {
      amount,
      decision: VERDICTS[Number(verdictIndex)] ?? "deny",
      reason: REASONS[Number(reasonIndex)] ?? "UNKNOWN",
      policyReference: `guarded-wallet:${intent.governedWalletAddress}`,
    });
  } catch {
    return intentResult(intent, {
      amount,
      decision: "validation_error",
      reason: "Unable to read governed wallet policy state on Arc Testnet.",
      errorCode: "CHAIN_READ_FAILED",
    });
  }
}

async function verifyIntentSignature(intent: NormalizedSignedPaymentIntentInput) {
  try {
    return verifyMessage({
      address: intent.agentSignerAddress,
      message: createPaymentIntentMessage(intent),
      signature: intent.signature,
    });
  } catch {
    return false;
  }
}

function parsePaymentIntentAmount(amount: string) {
  try {
    const parsed = parseUnits(amount, 6);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
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

function sameAddress(a: Address | string, b: Address | string) {
  return a.toLowerCase() === b.toLowerCase();
}
