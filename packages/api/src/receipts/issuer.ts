import {
  ARC_CHAIN_ID,
  PAYMENT_RECEIPT_ISSUERS,
  type PaymentReceiptIssuer,
  type PaymentReceiptSigner,
  findPaymentReceiptIssuerByAddress,
  issuerActiveAt,
} from "@arcanum/shared";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { ReceiptError } from "./errors";

export const RECEIPT_ISSUER_KEY_ENV = "ARCANUM_RECEIPT_ISSUER_PRIVATE_KEY";

export type ReceiptIssuer = Readonly<{
  keyId: string;
  address: Address;
  registration: PaymentReceiptIssuer;
  signMessage: PaymentReceiptSigner;
}>;

// Key derivation is cached; the activity window is checked on every call so a
// retirement date takes effect without a restart.
let cached: { key: string; issuer: ReceiptIssuer } | null = null;

/**
 * The signing key must correspond to a published, active registry entry for
 * this chain. A key that verifiers cannot resolve would produce receipts that
 * look signed but prove nothing, so issuance refuses instead.
 */
export function resolveReceiptIssuer(
  env: Readonly<Record<string, string | undefined>> = process.env,
  issuers: readonly PaymentReceiptIssuer[] = PAYMENT_RECEIPT_ISSUERS,
  now: Date = new Date(),
): ReceiptIssuer {
  const key = env[RECEIPT_ISSUER_KEY_ENV]?.trim();
  if (!key) {
    throw new ReceiptError(
      "RECEIPT_ISSUER_NOT_CONFIGURED",
      `Receipt issuing is not configured on this deployment (${RECEIPT_ISSUER_KEY_ENV} is unset).`,
    );
  }
  const issuer = cached?.key === key ? cached.issuer : deriveIssuer(key, issuers);
  if (!issuerActiveAt(issuer.registration, now.toISOString())) {
    throw new ReceiptError(
      "RECEIPT_ISSUER_NOT_REGISTERED",
      `Receipt issuer ${issuer.keyId} is not active on ${now.toISOString()}.`,
    );
  }
  cached = { key, issuer };
  return issuer;
}

function deriveIssuer(key: string, issuers: readonly PaymentReceiptIssuer[]): ReceiptIssuer {
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new ReceiptError(
      "RECEIPT_ISSUER_NOT_CONFIGURED",
      `${RECEIPT_ISSUER_KEY_ENV} must be a 0x-prefixed 32-byte hex private key.`,
    );
  }

  const account = privateKeyToAccount(key as Hex);
  const registration = findPaymentReceiptIssuerByAddress(account.address, issuers);
  if (!registration) {
    throw new ReceiptError(
      "RECEIPT_ISSUER_NOT_REGISTERED",
      `The configured receipt issuer key (${account.address}) is not in the published issuer registry.`,
    );
  }
  if (registration.chainId !== ARC_CHAIN_ID) {
    throw new ReceiptError(
      "RECEIPT_ISSUER_NOT_REGISTERED",
      `Receipt issuer ${registration.keyId} is registered for chain ${registration.chainId}, not ${ARC_CHAIN_ID}.`,
    );
  }

  return {
    keyId: registration.keyId,
    address: account.address.toLowerCase() as Address,
    registration,
    signMessage: (message) => account.signMessage({ message }),
  };
}
