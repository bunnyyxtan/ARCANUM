import { type Hex, hashMessage, sha256, stringToBytes } from "viem";

import { type PaymentIntentInput, createPaymentIntentMessage } from "../schemas/payment-intents";
import { canonicalJson } from "./canonical-json";
import { PAYMENT_RECEIPT_SIGNATURE_PREFIX, type PaymentReceiptBody } from "./schema";

/** SHA-256 of the canonical JSON encoding of the receipt body. */
export function paymentReceiptDigest(body: PaymentReceiptBody): Hex {
  return sha256(stringToBytes(canonicalJson(body)));
}

/**
 * The EIP-191 message the issuer signs. Signing a prefixed digest rather than
 * the body keeps the signed message short and domain-separated from every
 * other message an Arcanum key might sign.
 */
export function paymentReceiptSigningMessage(receiptDigest: Hex): string {
  return `${PAYMENT_RECEIPT_SIGNATURE_PREFIX}\n${receiptDigest}`;
}

/**
 * The EIP-191 digest the agent actually signed for a payment intent. Recorded
 * in the receipt so the request can be matched to its signature without
 * re-deriving the message format.
 */
export function paymentRequestDigest(request: PaymentIntentInput): Hex {
  return hashMessage(createPaymentIntentMessage(request));
}
