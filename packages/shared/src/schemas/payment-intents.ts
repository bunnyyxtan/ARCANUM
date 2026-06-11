import { z } from "zod";

import { ARC_TESTNET_CHAIN_ID } from "../chains/arc-testnet";
import { addressSchema } from "./common";

const amountDecimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, "Use a positive USDC amount with up to 6 decimals")
  .refine((value) => !/^0(?:\.0{1,6})?$/.test(value), "Amount must be greater than zero");

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency key is required")
  .max(128, "Idempotency key is too long")
  .regex(/^[A-Za-z0-9._:-]+$/, "Use letters, numbers, dots, underscores, colons, or dashes");

const signatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "Invalid signature")
  .transform((value) => value.toLowerCase() as `0x${string}`);

export const supportedPaymentTokenSchema = z.enum(["USDC", "EURC"]);

export const paymentIntentDecisionSchema = z.enum([
  "allow",
  "deny",
  "escalate",
  "freeze",
  "validation_error",
  "unsupported",
]);

export const paymentIntentInputSchema = z.object({
  chainId: z.number().int().positive().default(ARC_TESTNET_CHAIN_ID),
  governedWalletAddress: addressSchema,
  agentSignerAddress: addressSchema,
  vendorAddress: addressSchema,
  tokenAddress: addressSchema,
  tokenSymbol: supportedPaymentTokenSchema.optional(),
  amount: amountDecimalSchema,
  purpose: z.string().trim().min(1, "Purpose is required").max(280, "Purpose is too long"),
  idempotencyKey: idempotencyKeySchema,
});

export const signedPaymentIntentInputSchema = paymentIntentInputSchema.extend({
  signature: signatureSchema,
});

export type SupportedPaymentToken = z.infer<typeof supportedPaymentTokenSchema>;
export type PaymentIntentDecision = z.infer<typeof paymentIntentDecisionSchema>;
export type PaymentIntentInput = z.input<typeof paymentIntentInputSchema>;
export type NormalizedPaymentIntentInput = z.infer<typeof paymentIntentInputSchema>;
export type SignedPaymentIntentInput = z.input<typeof signedPaymentIntentInputSchema>;
export type NormalizedSignedPaymentIntentInput = z.infer<typeof signedPaymentIntentInputSchema>;

export type PaymentIntentResult = Readonly<{
  decision: PaymentIntentDecision;
  reason: string;
  governedWalletAddress: `0x${string}`;
  agentSignerAddress: `0x${string}`;
  vendorAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol?: SupportedPaymentToken;
  amount: string;
  amountBaseUnits?: string;
  purpose: string;
  idempotencyKey: string;
  escalationId?: `0x${string}`;
  policyReference?: string;
  txHash?: `0x${string}`;
  pendingIndexer?: boolean;
  errorCode?: string;
}>;

export function createPaymentIntentMessage(input: PaymentIntentInput): string {
  const intent = paymentIntentInputSchema.parse(input);

  return [
    "ARCANUM_PAYMENT_INTENT_V1",
    `chainId=${intent.chainId}`,
    `governedWalletAddress=${intent.governedWalletAddress}`,
    `agentSignerAddress=${intent.agentSignerAddress}`,
    `vendorAddress=${intent.vendorAddress}`,
    `tokenAddress=${intent.tokenAddress}`,
    `tokenSymbol=${intent.tokenSymbol ?? ""}`,
    `amount=${intent.amount}`,
    `purpose=${intent.purpose}`,
    `idempotencyKey=${intent.idempotencyKey}`,
  ].join("\n");
}

export function createPaymentIntentResult(
  intent: PaymentIntentInput,
  input: Readonly<{
    decision: PaymentIntentDecision;
    reason: string;
    amountBaseUnits?: bigint | string;
    policyReference?: string;
    escalationId?: `0x${string}`;
    txHash?: `0x${string}`;
    pendingIndexer?: boolean;
    errorCode?: string;
  }>,
): PaymentIntentResult {
  const parsedIntent = paymentIntentInputSchema.parse(intent);

  return {
    decision: input.decision,
    reason: input.reason,
    governedWalletAddress: parsedIntent.governedWalletAddress,
    agentSignerAddress: parsedIntent.agentSignerAddress,
    vendorAddress: parsedIntent.vendorAddress,
    tokenAddress: parsedIntent.tokenAddress,
    tokenSymbol: parsedIntent.tokenSymbol ?? "USDC",
    amount: parsedIntent.amount,
    amountBaseUnits: input.amountBaseUnits?.toString(),
    purpose: parsedIntent.purpose,
    idempotencyKey: parsedIntent.idempotencyKey,
    escalationId: input.escalationId,
    policyReference: input.policyReference,
    txHash: input.txHash,
    pendingIndexer: input.pendingIndexer ?? false,
    errorCode: input.errorCode,
  };
}
