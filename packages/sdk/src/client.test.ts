import { describe, expect, it } from "vitest";

import { paymentIntentInputSchema } from "@arcanum/shared";

import { PolicyDeniedError, WalletFrozenError } from "./errors";
import {
  ArcanumClient,
  type ExecuteUSDCInput,
  type ExecuteUSDCResult,
  type PaymentIntentInput,
  type PaymentIntentResult,
  createPaymentIntentMessage,
  encodeExecuteUSDC,
} from "./index";

const paymentIntent = {
  governedWalletAddress: "0x0000000000000000000000000000000000000001",
  agentSignerAddress: "0x0000000000000000000000000000000000000002",
  vendorAddress: "0x0000000000000000000000000000000000000003",
  tokenAddress: "0x3600000000000000000000000000000000000000",
  tokenSymbol: "USDC",
  amount: "12.5",
  purpose: "Arc Testnet API invoice",
  idempotencyKey: "invoice-12345",
} as const satisfies PaymentIntentInput;

describe("Arcanum SDK surface", () => {
  it("identifies policy denial errors", () => {
    const error = new PolicyDeniedError("PER_TX_CAP");

    expect(error).toBeInstanceOf(PolicyDeniedError);
    expect(error.code).toBe("POLICY_DENIED");
    expect(error.verdict).toBe("DENY");
  });

  it("identifies frozen wallet errors", () => {
    const error = new WalletFrozenError("BLOCKED_VENDOR");

    expect(error).toBeInstanceOf(WalletFrozenError);
    expect(error.code).toBe("WALLET_FROZEN");
    expect(error.verdict).toBe("FREEZE");
  });

  it("encodes executeUSDC calldata", () => {
    const data = encodeExecuteUSDC({
      to: "0x0000000000000000000000000000000000000001",
      amount: 50_000_000n,
      reason: "OpenAI API top-up",
      metadata: { category: "API" },
    });

    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });

  it("builds a canonical payment intent message", () => {
    const message = createPaymentIntentMessage(paymentIntent);

    expect(message).toContain("ARCANUM_PAYMENT_INTENT_V1");
    expect(message).toContain("chainId=5042002");
    expect(message).toContain("amount=12.5");
    expect(message).toContain("idempotencyKey=invoice-12345");
  });

  it("executes an allowed payment intent through executeUSDC", async () => {
    const txHash = `0x${"1".repeat(64)}` as const;
    const calls: ExecuteUSDCInput[] = [];
    const client = Object.create(ArcanumClient.prototype) as ArcanumClient;

    client.createPaymentIntent = async (): Promise<PaymentIntentResult> => ({
      decision: "allow",
      reason: "NONE",
      governedWalletAddress: paymentIntent.governedWalletAddress,
      agentSignerAddress: paymentIntent.agentSignerAddress,
      vendorAddress: paymentIntent.vendorAddress,
      tokenAddress: paymentIntent.tokenAddress,
      tokenSymbol: "USDC",
      amount: paymentIntent.amount,
      amountBaseUnits: "12500000",
      purpose: paymentIntent.purpose,
      idempotencyKey: paymentIntent.idempotencyKey,
      policyReference: `guarded-wallet:${paymentIntent.governedWalletAddress}`,
      pendingIndexer: false,
    });
    client.executeUSDC = async (input: ExecuteUSDCInput): Promise<ExecuteUSDCResult> => {
      calls.push(input);
      return { verdict: "ALLOW", txHash };
    };

    const result = await client.executePaymentIntent(paymentIntent);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      to: paymentIntent.vendorAddress,
      amount: 12_500_000n,
      reason: paymentIntent.purpose,
    });
    expect(result.decision).toBe("allow");
    expect(result.txHash).toBe(txHash);
    expect(result.pendingIndexer).toBe(true);
  });

  it("rejects unsafe payment intent amounts", () => {
    expect(
      paymentIntentInputSchema.safeParse({
        governedWalletAddress: "0x0000000000000000000000000000000000000001",
        agentSignerAddress: "0x0000000000000000000000000000000000000002",
        vendorAddress: "0x0000000000000000000000000000000000000003",
        tokenAddress: "0x3600000000000000000000000000000000000000",
        amount: "0",
        purpose: "Arc Testnet API invoice",
        idempotencyKey: "invoice-12345",
      }).success,
    ).toBe(false);

    expect(
      paymentIntentInputSchema.safeParse({
        governedWalletAddress: "0x0000000000000000000000000000000000000001",
        agentSignerAddress: "0x0000000000000000000000000000000000000002",
        vendorAddress: "0x0000000000000000000000000000000000000003",
        tokenAddress: "0x3600000000000000000000000000000000000000",
        amount: "1.0000001",
        purpose: "Arc Testnet API invoice",
        idempotencyKey: "invoice-12345",
      }).success,
    ).toBe(false);
  });
});
