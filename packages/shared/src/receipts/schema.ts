import { z } from "zod";

import { supportedPaymentTokenSchema } from "../schemas/payment-intents";

export const PAYMENT_RECEIPT_SCHEMA_V1 = "arcanum.payment-receipt.v1";

/** First line of the message the issuer signs; the second line is the receipt digest. */
export const PAYMENT_RECEIPT_SIGNATURE_PREFIX = "ARCANUM_PAYMENT_RECEIPT_V1";

/**
 * Receipts attest policy decisions only. Input problems and infrastructure
 * failures are reported as errors and never become signed receipts.
 */
export const PAYMENT_RECEIPT_VERDICTS = ["allow", "escalate", "deny", "freeze"] as const;

// The body schemas are strict and transform-free on purpose. Verification
// re-serializes the parsed body, so parsing must neither drop unknown members
// nor rewrite values, or a digest computed over the parsed object would stop
// matching what was signed.
const lowercaseAddressSchema = z.string().regex(/^0x[0-9a-f]{40}$/, "Expected a lowercase address");
const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, "Expected a lowercase 32-byte hex value");
const uintDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)$/, "Expected an unsigned decimal string");
const isoTimestampSchema = z.string().datetime();
// Request fields must already be in the normalized form `paymentIntentInputSchema`
// produces, so one signed message corresponds to exactly one receipt body.
const usdcAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, "Expected a USDC amount with up to 6 decimals")
  .refine((value) => !/^0(?:\.0{1,6})?$/.test(value), "Amount must be greater than zero");
const trimmedTextSchema = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value === value.trim(), "Expected trimmed text");

export const paymentReceiptRequestSchema = z
  .object({
    chainId: z.number().int().positive(),
    governedWalletAddress: lowercaseAddressSchema,
    agentSignerAddress: lowercaseAddressSchema,
    vendorAddress: lowercaseAddressSchema,
    tokenAddress: lowercaseAddressSchema,
    tokenSymbol: supportedPaymentTokenSchema.optional(),
    amount: usdcAmountSchema,
    purpose: trimmedTextSchema(280),
    reference: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    signature: z.string().regex(/^0x[0-9a-f]+$/, "Expected a lowercase hex signature"),
  })
  .strict();

export const paymentReceiptPolicySchema = z
  .object({
    perTxCap: uintDecimalSchema,
    daily24hCap: uintDecimalSchema,
    monthlyCap: uintDecimalSchema,
    allowedCategories: uintDecimalSchema,
    escalationThreshold: uintDecimalSchema,
    requireAllowlist: z.boolean(),
    freezeOnBlockedVendor: z.boolean(),
  })
  .strict();

export const paymentReceiptVendorSchema = z
  .object({
    allowed: z.boolean(),
    blocked: z.boolean(),
    category: z.number().int().min(0).max(255),
    perVendorCap: uintDecimalSchema,
  })
  .strict();

/**
 * Spend counters as stored at the block, and as `GuardedWallet.executeUSDC`
 * would see them after `_rollSpendWindow` at that block's timestamp. The
 * effective values are what the policy engine was evaluated with.
 */
export const paymentReceiptSpendSchema = z
  .object({
    spendDay: uintDecimalSchema,
    spendMonth: uintDecimalSchema,
    dailySpent: uintDecimalSchema,
    monthlySpent: uintDecimalSchema,
    blockDay: uintDecimalSchema,
    blockMonth: uintDecimalSchema,
    effectiveDailySpent: uintDecimalSchema,
    effectiveMonthlySpent: uintDecimalSchema,
  })
  .strict();

export const paymentReceiptEvaluationSchema = z
  .object({
    blockNumber: uintDecimalSchema,
    blockHash: bytes32Schema,
    blockTimestamp: z.number().int().nonnegative(),
    evaluatedAt: isoTimestampSchema,
    policyVersion: uintDecimalSchema,
    policyEngine: lowercaseAddressSchema,
    vendorRegistry: lowercaseAddressSchema,
    escalationManager: lowercaseAddressSchema,
    policy: paymentReceiptPolicySchema,
    signerAuthorized: z.boolean(),
    frozen: z.boolean(),
    vendor: paymentReceiptVendorSchema,
    spend: paymentReceiptSpendSchema,
    usdcBalance: uintDecimalSchema,
  })
  .strict();

export const paymentReceiptDecisionSchema = z
  .object({
    verdict: z.enum(PAYMENT_RECEIPT_VERDICTS),
    reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
    explanation: trimmedTextSchema(500),
  })
  .strict();

export const paymentReceiptIssuerRefSchema = z
  .object({
    keyId: z.string().min(1).max(64),
    address: lowercaseAddressSchema,
  })
  .strict();

export const paymentReceiptBodySchema = z
  .object({
    schema: z.literal(PAYMENT_RECEIPT_SCHEMA_V1),
    receiptId: z.string().uuid(),
    issuedAt: isoTimestampSchema,
    issuer: paymentReceiptIssuerRefSchema,
    request: paymentReceiptRequestSchema,
    requestDigest: bytes32Schema,
    amountBaseUnits: uintDecimalSchema,
    decision: paymentReceiptDecisionSchema,
    evaluation: paymentReceiptEvaluationSchema,
  })
  .strict();

export const paymentReceiptEnvelopeSchema = z
  .object({
    receipt: paymentReceiptBodySchema,
    receiptDigest: bytes32Schema,
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Expected a 65-byte signature"),
  })
  .strict();

export type PaymentReceiptVerdict = (typeof PAYMENT_RECEIPT_VERDICTS)[number];
export type PaymentReceiptRequest = z.infer<typeof paymentReceiptRequestSchema>;
export type PaymentReceiptPolicy = z.infer<typeof paymentReceiptPolicySchema>;
export type PaymentReceiptVendor = z.infer<typeof paymentReceiptVendorSchema>;
export type PaymentReceiptSpend = z.infer<typeof paymentReceiptSpendSchema>;
export type PaymentReceiptEvaluation = z.infer<typeof paymentReceiptEvaluationSchema>;
export type PaymentReceiptDecision = z.infer<typeof paymentReceiptDecisionSchema>;
export type PaymentReceiptBody = z.infer<typeof paymentReceiptBodySchema>;
export type PaymentReceiptEnvelope = z.infer<typeof paymentReceiptEnvelopeSchema>;
