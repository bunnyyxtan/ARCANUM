import { encodeErrorResult } from "viem";
import { describe, expect, it, vi } from "vitest";

import { GuardedWalletAbi } from "@arcanum/contracts";
import { paymentIntentInputSchema } from "@arcanum/shared";

import { PolicyDeniedError, type TransferRevertedError, WalletFrozenError } from "./errors";
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
  reference: "invoice-12345",
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
    expect(message).toContain("reference=invoice-12345");
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
      reference: paymentIntent.reference,
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
        reference: "invoice-12345",
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
        reference: "invoice-12345",
      }).success,
    ).toBe(false);
  });

  it.each(["ALLOW", "ESCALATE", "FREEZE"] as const)(
    "raises TransferRevertedError when a %s transaction receipt reverted",
    async (verdict) => {
      const txHash = `0x${"2".repeat(64)}` as const;
      const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
      Reflect.set(client, "walletAddress", paymentIntent.governedWalletAddress);
      Reflect.set(client, "walletClient", {
        account: { address: paymentIntent.agentSignerAddress },
        writeContract: vi.fn().mockResolvedValue(txHash),
      });
      Reflect.set(client, "publicClient", {
        waitForTransactionReceipt: vi.fn().mockResolvedValue({
          status: "reverted",
          blockNumber: 10n,
          logs: [],
        }),
        getTransaction: vi.fn().mockRejectedValue(new Error("transaction unavailable")),
      });
      Reflect.set(client, "assertSignerAndWalletOpen", vi.fn());
      Reflect.set(client, "assertSufficientBalance", vi.fn());
      Reflect.set(
        client,
        "simulate",
        vi.fn().mockResolvedValue({ verdict, reason: "BLOCKED_VENDOR" }),
      );

      await expect(
        client.executeUSDC({
          to: paymentIntent.vendorAddress,
          amount: 1n,
          reason: "test",
        }),
      ).rejects.toMatchObject({
        txHash,
        code: "TRANSFER_REVERTED",
      } satisfies Partial<TransferRevertedError>);
    },
  );

  it("does not submit a transaction for DENY", async () => {
    const writeContract = vi.fn();
    const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
    Reflect.set(client, "walletClient", {
      account: { address: paymentIntent.agentSignerAddress },
      writeContract,
    });
    Reflect.set(client, "assertSignerAndWalletOpen", vi.fn());
    Reflect.set(
      client,
      "simulate",
      vi.fn().mockResolvedValue({ verdict: "DENY", reason: "PER_VENDOR_CAP" }),
    );

    const result = await client.executeUSDC({
      to: paymentIntent.vendorAddress,
      amount: 1n,
      reason: "test",
    });

    expect(result.verdict).toBe("DENY");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("decodes a custom error while confirming a reverted transaction", async () => {
    const txHash = `0x${"3".repeat(64)}` as const;
    const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
    Reflect.set(client, "publicClient", {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "reverted",
        blockNumber: 10n,
      }),
      getTransaction: vi.fn().mockResolvedValue({
        from: paymentIntent.agentSignerAddress,
        to: paymentIntent.governedWalletAddress,
        input: "0x",
        value: 0n,
      }),
      call: vi.fn().mockRejectedValue({
        data: encodeErrorResult({ abi: GuardedWalletAbi, errorName: "ZeroAmount" }),
      }),
    });

    await expect(client.confirm(txHash)).rejects.toMatchObject({
      txHash,
      customErrorName: "ZeroAmount",
    } satisfies Partial<TransferRevertedError>);
  });
});
