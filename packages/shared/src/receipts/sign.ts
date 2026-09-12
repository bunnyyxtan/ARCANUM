import type { Hex } from "viem";

import { paymentReceiptDigest, paymentReceiptSigningMessage } from "./digest";
import {
  type PaymentReceiptBody,
  type PaymentReceiptEnvelope,
  paymentReceiptBodySchema,
} from "./schema";

/** Signs an EIP-191 personal message and returns the 65-byte signature. */
export type PaymentReceiptSigner = (message: string) => Promise<Hex>;

/**
 * Seal a receipt body into a signed envelope. The body is validated against
 * the strict schema first so an issuer can never sign something a verifier
 * would refuse to parse.
 */
export async function signPaymentReceipt(
  body: PaymentReceiptBody,
  signMessage: PaymentReceiptSigner,
): Promise<PaymentReceiptEnvelope> {
  const receipt = paymentReceiptBodySchema.parse(body);
  const receiptDigest = paymentReceiptDigest(receipt);
  const signature = await signMessage(paymentReceiptSigningMessage(receiptDigest));

  return { receipt, receiptDigest, signature: signature.toLowerCase() as Hex };
}
