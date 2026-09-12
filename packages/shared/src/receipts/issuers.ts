import { ARC_TESTNET_CHAIN_ID } from "../chains/arc-testnet";

/**
 * Public verification keys for payment receipt issuers.
 *
 * A receipt names its issuer by `keyId`; verifiers resolve the key here and
 * never trust the address written inside the receipt itself. Retired keys stay
 * listed with a `retiredAt` date so receipts issued while they were active keep
 * verifying, and so a receipt dated after retirement is reported as such.
 */
export type PaymentReceiptIssuer = Readonly<{
  keyId: string;
  address: `0x${string}`;
  /** The only chain this key may attest decisions for. */
  chainId: number;
  validFrom: string;
  retiredAt: string | null;
}>;

export const PAYMENT_RECEIPT_ISSUERS: readonly PaymentReceiptIssuer[] = [
  {
    keyId: "arc-testnet-2026-09",
    address: "0x768020000608ab6afc28a15b2b03a00273ef3288",
    chainId: ARC_TESTNET_CHAIN_ID,
    validFrom: "2026-09-10T00:00:00Z",
    retiredAt: null,
  },
];

export function findPaymentReceiptIssuer(
  keyId: string,
  issuers: readonly PaymentReceiptIssuer[] = PAYMENT_RECEIPT_ISSUERS,
): PaymentReceiptIssuer | null {
  return issuers.find((issuer) => issuer.keyId === keyId) ?? null;
}

export function findPaymentReceiptIssuerByAddress(
  address: string,
  issuers: readonly PaymentReceiptIssuer[] = PAYMENT_RECEIPT_ISSUERS,
): PaymentReceiptIssuer | null {
  const wanted = address.toLowerCase();
  return issuers.find((issuer) => issuer.address.toLowerCase() === wanted) ?? null;
}

/** Whether `issuedAt` falls inside the window the key was active for. */
export function issuerActiveAt(issuer: PaymentReceiptIssuer, issuedAt: string): boolean {
  const issued = Date.parse(issuedAt);
  if (Number.isNaN(issued) || issued < Date.parse(issuer.validFrom)) {
    return false;
  }
  return issuer.retiredAt === null || issued <= Date.parse(issuer.retiredAt);
}
