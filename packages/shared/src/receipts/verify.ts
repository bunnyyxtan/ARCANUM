import { type Hex, parseUnits, verifyMessage } from "viem";

import { createPaymentIntentMessage } from "../schemas/payment-intents";
import { paymentReceiptDigest, paymentReceiptSigningMessage, paymentRequestDigest } from "./digest";
import {
  PAYMENT_RECEIPT_ISSUERS,
  type PaymentReceiptIssuer,
  findPaymentReceiptIssuer,
  issuerActiveAt,
} from "./issuers";
import { type PaymentReceiptBody, paymentReceiptEnvelopeSchema } from "./schema";

export type ReceiptFormatCheck =
  | { status: "valid" }
  | { status: "malformed"; issues: readonly string[] };

export type ReceiptDigestCheck =
  | { status: "verified"; digest: Hex }
  | { status: "mismatch"; expected: Hex; computed: Hex }
  | { status: "not_checked" };

/**
 * Who vouches for the decision. `unknown_issuer` is the honest answer for a
 * key this verifier has never heard of: the signature may well be valid, but
 * nothing ties it to Arcanum.
 */
export type ReceiptIssuerCheck =
  | { status: "verified"; issuer: PaymentReceiptIssuer }
  | { status: "invalid_signature"; issuer: PaymentReceiptIssuer }
  | { status: "issuer_retired"; issuer: PaymentReceiptIssuer }
  | { status: "issuer_chain_mismatch"; issuer: PaymentReceiptIssuer; chainId: number }
  | { status: "issuer_mismatch"; issuer: PaymentReceiptIssuer; claimed: `0x${string}` }
  | { status: "unknown_issuer"; keyId: string; claimed: `0x${string}` }
  | { status: "not_checked" };

/** Whether the agent really signed the request the receipt describes. */
export type ReceiptRequestCheck =
  | { status: "verified"; signer: `0x${string}` }
  | { status: "invalid_signature"; signer: `0x${string}` }
  | { status: "digest_mismatch"; expected: Hex; computed: Hex }
  | { status: "amount_mismatch"; expected: string; computed: string }
  | { status: "not_checked" };

export type PaymentReceiptVerification = Readonly<{
  /** True only when every check below passed. */
  ok: boolean;
  body: PaymentReceiptBody | null;
  format: ReceiptFormatCheck;
  receiptDigest: ReceiptDigestCheck;
  issuer: ReceiptIssuerCheck;
  request: ReceiptRequestCheck;
}>;

export type VerifyPaymentReceiptOptions = Readonly<{
  /** Trusted issuer keys. Defaults to the published Arcanum registry. */
  issuers?: readonly PaymentReceiptIssuer[];
}>;

/**
 * Verify a receipt envelope offline. Every check is independent and reported
 * separately: a receipt can carry a valid agent signature and a forged issuer
 * signature, or a valid issuer signature from a key nobody trusts, and the
 * caller needs to see which.
 */
export async function verifyPaymentReceipt(
  envelope: unknown,
  options: VerifyPaymentReceiptOptions = {},
): Promise<PaymentReceiptVerification> {
  const parsed = paymentReceiptEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      body: null,
      format: {
        status: "malformed",
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      },
      receiptDigest: { status: "not_checked" },
      issuer: { status: "not_checked" },
      request: { status: "not_checked" },
    };
  }

  const { receipt: body, receiptDigest: claimedDigest, signature } = parsed.data;
  const computedDigest = paymentReceiptDigest(body);
  const receiptDigest: ReceiptDigestCheck =
    computedDigest === claimedDigest
      ? { status: "verified", digest: computedDigest }
      : { status: "mismatch", expected: claimedDigest as Hex, computed: computedDigest };

  const [issuer, request] = await Promise.all([
    checkIssuer(body, computedDigest, signature as Hex, options.issuers ?? PAYMENT_RECEIPT_ISSUERS),
    checkRequest(body),
  ]);

  return {
    ok:
      receiptDigest.status === "verified" &&
      issuer.status === "verified" &&
      request.status === "verified",
    body,
    format: { status: "valid" },
    receiptDigest,
    issuer,
    request,
  };
}

async function checkIssuer(
  body: PaymentReceiptBody,
  computedDigest: Hex,
  signature: Hex,
  issuers: readonly PaymentReceiptIssuer[],
): Promise<ReceiptIssuerCheck> {
  const claimed = body.issuer.address as `0x${string}`;
  const issuer = findPaymentReceiptIssuer(body.issuer.keyId, issuers);
  if (!issuer) {
    return { status: "unknown_issuer", keyId: body.issuer.keyId, claimed };
  }
  if (issuer.address.toLowerCase() !== claimed) {
    return { status: "issuer_mismatch", issuer, claimed };
  }

  // The signature is checked against the digest recomputed from the body, so
  // a body edited after signing fails here even if the envelope digest was
  // edited to match.
  const valid = await safeVerifyMessage(
    issuer.address,
    paymentReceiptSigningMessage(computedDigest),
    signature,
  );
  if (!valid) {
    return { status: "invalid_signature", issuer };
  }
  if (!issuerActiveAt(issuer, body.issuedAt)) {
    return { status: "issuer_retired", issuer };
  }
  if (issuer.chainId !== body.request.chainId) {
    return { status: "issuer_chain_mismatch", issuer, chainId: body.request.chainId };
  }
  return { status: "verified", issuer };
}

async function checkRequest(body: PaymentReceiptBody): Promise<ReceiptRequestCheck> {
  const signer = body.request.agentSignerAddress as `0x${string}`;
  const expectedBaseUnits = parseUnits(body.request.amount, 6).toString();
  if (expectedBaseUnits !== body.amountBaseUnits) {
    return {
      status: "amount_mismatch",
      expected: expectedBaseUnits,
      computed: body.amountBaseUnits,
    };
  }

  const computedDigest = paymentRequestDigest(body.request);
  if (computedDigest !== body.requestDigest) {
    return {
      status: "digest_mismatch",
      expected: body.requestDigest as Hex,
      computed: computedDigest,
    };
  }

  const valid = await safeVerifyMessage(
    signer,
    createPaymentIntentMessage(body.request),
    body.request.signature as Hex,
  );
  return valid ? { status: "verified", signer } : { status: "invalid_signature", signer };
}

async function safeVerifyMessage(address: `0x${string}`, message: string, signature: Hex) {
  try {
    return await verifyMessage({ address, message, signature });
  } catch {
    // A malformed signature cannot recover a signer; that is "invalid", not a crash.
    return false;
  }
}
