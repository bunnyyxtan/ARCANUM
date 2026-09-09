import { privateKeyToAccount } from "viem/accounts";

import { createPaymentIntentMessage } from "../schemas/payment-intents";
import { paymentRequestDigest } from "./digest";
import type { PaymentReceiptIssuer } from "./issuers";
import { PAYMENT_RECEIPT_SCHEMA_V1, type PaymentReceiptBody } from "./schema";
import { signPaymentReceipt } from "./sign";

// Throwaway keys for tests only.
export const testIssuerAccount = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
export const testAgentAccount = privateKeyToAccount(
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
);

export const testIssuer: PaymentReceiptIssuer = {
  keyId: "test-2026",
  address: testIssuerAccount.address.toLowerCase() as `0x${string}`,
  chainId: 5042002,
  validFrom: "2026-01-01T00:00:00Z",
  retiredAt: null,
};

const WALLET = "0x1000000000000000000000000000000000000001";
const VENDOR = "0x2000000000000000000000000000000000000002";
const USDC = "0x3600000000000000000000000000000000000000";
const MODULE = "0x4000000000000000000000000000000000000004";

export async function signedTestRequest(overrides: Partial<PaymentReceiptBody["request"]> = {}) {
  const intent = {
    chainId: 5042002,
    governedWalletAddress: WALLET,
    agentSignerAddress: testAgentAccount.address.toLowerCase(),
    vendorAddress: VENDOR,
    tokenAddress: USDC,
    tokenSymbol: "USDC" as const,
    amount: "12.500000",
    purpose: "Monthly API quota",
    reference: "inv-2026-09-0001",
    ...overrides,
  };
  const signature = await testAgentAccount.signMessage({
    message: createPaymentIntentMessage(intent),
  });
  return { ...intent, signature: signature.toLowerCase() };
}

export async function testReceiptBody(
  overrides: Partial<PaymentReceiptBody> = {},
): Promise<PaymentReceiptBody> {
  const request = overrides.request ?? (await signedTestRequest());
  return {
    schema: PAYMENT_RECEIPT_SCHEMA_V1,
    receiptId: "8d2b4d6e-1e5a-4b7f-9c1d-0a2b3c4d5e6f",
    issuedAt: "2026-09-10T10:00:00.000Z",
    issuer: { keyId: testIssuer.keyId, address: testIssuer.address },
    request,
    requestDigest: paymentRequestDigest(request),
    amountBaseUnits: "12500000",
    decision: {
      verdict: "allow",
      reasonCode: "ALLOW",
      explanation: "Within policy caps and the vendor is allowlisted.",
    },
    evaluation: {
      blockNumber: "61000000",
      blockHash: `0x${"ab".repeat(32)}`,
      blockTimestamp: 1_789_000_000,
      evaluatedAt: "2026-09-10T09:59:59.000Z",
      policyVersion: "3",
      policyEngine: MODULE,
      vendorRegistry: MODULE,
      escalationManager: MODULE,
      policy: {
        perTxCap: "100000000",
        daily24hCap: "500000000",
        monthlyCap: "5000000000",
        allowedCategories: "6",
        escalationThreshold: "50000000",
        requireAllowlist: true,
        freezeOnBlockedVendor: true,
      },
      signerAuthorized: true,
      frozen: false,
      vendor: { allowed: true, blocked: false, category: 1, perVendorCap: "0" },
      spend: {
        spendDay: "20705",
        spendMonth: "690",
        dailySpent: "1000000",
        monthlySpent: "1000000",
        blockDay: "20705",
        blockMonth: "690",
        effectiveDailySpent: "1000000",
        effectiveMonthlySpent: "1000000",
      },
      usdcBalance: "250000000",
    },
    ...overrides,
  };
}

export async function signedTestReceipt(overrides: Partial<PaymentReceiptBody> = {}) {
  const body = await testReceiptBody(overrides);
  return signPaymentReceipt(body, (message) => testIssuerAccount.signMessage({ message }));
}
