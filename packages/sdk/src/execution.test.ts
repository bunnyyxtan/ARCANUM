import { GuardedWalletAbi } from "@arcanum/contracts";
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS } from "@arcanum/shared";
import { signedTestReceipt } from "@arcanum/shared/testing";
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  zeroHash,
} from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  ArcanumClient,
  type ExecuteUSDCInput,
  type PaymentIntentInput,
  type SubmittedUSDCTransaction,
  TransactionRecoveryError,
  encodeExecuteUSDC,
} from "./index";

const wallet = "0x1000000000000000000000000000000000000001";
const vendor = "0x2000000000000000000000000000000000000002";
const signer = "0x3000000000000000000000000000000000000003";
const unrelated = "0x4000000000000000000000000000000000000004";
const txHash = `0x${"12".repeat(32)}` as const;
const escalationId = `0x${"34".repeat(32)}` as const;
const input = { to: vendor, amount: 12_500_000n, reason: "invoice" } as const;
const intent: PaymentIntentInput = {
  governedWalletAddress: wallet,
  agentSignerAddress: signer,
  vendorAddress: vendor,
  tokenAddress: ARC_USDC_ADDRESS,
  amount: "12.5",
  purpose: "invoice",
  reference: "invoice-123",
};
type EventLog = { address: Address; topics: Hex[]; data: Hex };

function executed(to: Address = vendor, amount: bigint = input.amount): EventLog {
  return {
    address: wallet,
    topics: encodeEventTopics({
      abi: GuardedWalletAbi,
      eventName: "TransferExecuted",
      args: { wallet, signer, to },
    }) as Hex[],
    data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [amount, zeroHash]),
  };
}

function escalated(to: Address = vendor, amount: bigint = input.amount): EventLog {
  return {
    address: wallet,
    topics: encodeEventTopics({
      abi: GuardedWalletAbi,
      eventName: "TransferEscalated",
      args: { wallet, to, escalationId },
    }) as Hex[],
    data: encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "bytes" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [amount, "0x", 2n, 100n, 1n, 1n],
    ),
  };
}

function frozen(source = 0): EventLog {
  return {
    address: wallet,
    topics: encodeEventTopics({
      abi: GuardedWalletAbi,
      eventName: "Frozen",
      args: { wallet, source },
    }) as Hex[],
    data: encodeAbiParameters([{ type: "uint8" }, { type: "bytes" }], [5, "0x"]),
  };
}

/** Only external chain IO is replaced. All public execution/preflight methods run. */
function harness(logs: EventLog[] = [executed()], verdict = 0) {
  const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
  const writeContract = vi.fn(async (args: { args: [Address, bigint, Hex] }) => {
    // Preserve the actual calldata produced by the public method, including receipt metadata.
    transaction.input = encodeFunctionData({
      abi: GuardedWalletAbi,
      functionName: "executeUSDC",
      args: args.args,
    });
    return txHash;
  });
  const transaction = {
    hash: txHash,
    to: wallet as Address,
    from: signer as Address,
    value: 0n,
    input: encodeExecuteUSDC(input),
  };
  const receipt = { transactionHash: txHash, status: "success", blockNumber: 10n, logs };
  const waitForTransactionReceipt = vi.fn().mockResolvedValue(receipt);
  const getTransaction = vi.fn().mockImplementation(async () => transaction);
  const readContract = vi.fn(
    async ({ functionName }: { functionName: string }): Promise<unknown> => {
      switch (functionName) {
        case "agentSigners":
          return true;
        case "frozen":
          return false;
        case "usdc":
          return ARC_USDC_ADDRESS;
        case "balanceOf":
          return 100_000_000n;
        case "policy":
          return [100_000_000n, 100_000_000n, 100_000_000n, 31n, 1n, false, true];
        case "dailySpent":
        case "monthlySpent":
        case "spendDay":
        case "spendMonth":
          return 0n;
        case "policyEngine":
        case "vendorRegistry":
          return unrelated;
        case "evaluate":
          return [verdict, verdict === 0 ? 0 : 5];
        default:
          throw new Error(`Unexpected read ${functionName}`);
      }
    },
  );
  Reflect.set(client, "walletAddress", wallet);
  Reflect.set(client, "walletClient", { account: { address: signer }, writeContract });
  Reflect.set(client, "publicClient", {
    chain: { id: ARC_CHAIN_ID },
    readContract,
    getBlock: vi.fn().mockResolvedValue({ number: 10n, timestamp: 0n }),
    waitForTransactionReceipt,
    getTransaction,
  });
  return {
    client,
    writeContract,
    waitForTransactionReceipt,
    getTransaction,
    readContract,
    transaction,
    receipt,
  };
}

describe("authoritative executeUSDC outcomes (isolated chain IO)", () => {
  it.each([
    [0, executed(), "ALLOW", "NONE"],
    [0, escalated(), "ESCALATE", "ESCALATION_REQUIRED"],
    [0, frozen(), "FREEZE", "BLOCKED_VENDOR"],
    [1, executed(), "ALLOW", "NONE"],
    [3, executed(), "ALLOW", "NONE"],
    [1, frozen(), "FREEZE", "BLOCKED_VENDOR"],
    [3, escalated(), "ESCALATE", "ESCALATION_REQUIRED"],
  ] as const)("simulation %s cannot override mined %s", async (preflight, log, verdict, reason) => {
    const h = harness([log], preflight);
    const result = await h.client.executeUSDC(input);
    expect(result).toMatchObject({ verdict, reason, txHash });
    if (verdict === "ESCALATE") expect(result.escalationId).toBe(escalationId);
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it.each([executed(), escalated(), frozen()])(
    "ignores another emitter's matching event",
    async (log) => {
      const h = harness([{ ...log, address: unrelated }, executed()]);
      await expect(h.client.executeUSDC(input)).resolves.toMatchObject({ verdict: "ALLOW" });
    },
  );

  it.each([
    ["missing", [], "OUTCOME_MISSING"],
    ["unrelated only", [{ ...executed(), address: unrelated }], "OUTCOME_MISSING"],
    ["two outcomes", [executed(), frozen()], "OUTCOME_AMBIGUOUS"],
    ["duplicate outcome", [executed(), executed()], "OUTCOME_AMBIGUOUS"],
    ["wrong recipient", [executed(unrelated)], "OUTCOME_INCONSISTENT"],
    ["wrong amount", [executed(vendor, 1n)], "OUTCOME_INCONSISTENT"],
    ["wrong escalation recipient", [escalated(unrelated)], "OUTCOME_INCONSISTENT"],
    ["wrong escalation amount", [escalated(vendor, 1n)], "OUTCOME_INCONSISTENT"],
    ["malformed", [{ ...executed(), data: "0x" }], "OUTCOME_INCONSISTENT"],
    ["non-policy freeze", [frozen(2)], "OUTCOME_INCONSISTENT"],
  ] as const)("rejects %s explicitly with hash", async (_name, logs, code) => {
    const h = harness([...logs]);
    await expect(h.client.executeUSDC(input)).rejects.toMatchObject({
      name: "TransactionRecoveryError",
      code,
      txHash,
      submission: { input },
    });
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it("rejects an event naming a different wallet even from the configured emitter", async () => {
    const log = executed();
    log.topics = encodeEventTopics({
      abi: GuardedWalletAbi,
      eventName: "TransferExecuted",
      args: { wallet: unrelated, signer, to: vendor },
    }) as Hex[];
    await expect(harness([log]).client.executeUSDC(input)).rejects.toMatchObject({
      code: "OUTCOME_INCONSISTENT",
      txHash,
    });
  });

  it("keeps DENY as preflight and does not submit", async () => {
    const h = harness([], 2);
    await expect(h.client.executeUSDC(input)).resolves.toMatchObject({ verdict: "DENY" });
    expect(h.writeContract).not.toHaveBeenCalled();
    expect(h.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it.each([
    [executed(), "ALLOW"],
    [escalated(), "ESCALATE"],
    [frozen(), "FREEZE"],
  ] as const)("recovers timeout without another submit: %s", async (log, verdict) => {
    const h = harness([log]);
    const timeout = new Error("receipt timeout");
    h.waitForTransactionReceipt.mockRejectedValueOnce(timeout);
    const saved: SubmittedUSDCTransaction[] = [];
    await expect(
      h.client.executeUSDC(input, {
        onSubmitted: async (submission) => {
          expect(h.waitForTransactionReceipt).not.toHaveBeenCalled();
          saved.push(submission);
        },
      }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_UNAVAILABLE",
      txHash,
      submission: { input },
    });
    expect(saved).toHaveLength(1);
    // A read-only client can reconcile; neither signer nor simulation is needed.
    Reflect.set(h.client, "walletClient", {});
    h.readContract.mockRejectedValue(new Error("preflight must not run again"));
    const submission = saved[0];
    if (!submission) throw new Error("Expected a saved submission");
    const result = await h.client.reconcileUSDC(submission.txHash, submission.input);
    expect(result.verdict).toBe(verdict);
    expect(result.txHash).toBe(txHash);
    expect(h.waitForTransactionReceipt.mock.calls).toEqual([
      [{ hash: txHash }],
      [{ hash: txHash }],
    ]);
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it("retains hash if persistence fails after submission", async () => {
    const h = harness();
    await expect(
      h.client.executeUSDC(input, {
        onSubmitted: async () => {
          throw new Error("disk unavailable");
        },
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_PERSISTENCE_FAILED", txHash });
    expect(h.waitForTransactionReceipt).not.toHaveBeenCalled();
    await expect(h.client.reconcileUSDC(txHash, input)).resolves.toMatchObject({
      verdict: "ALLOW",
    });
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it("retains hash when transaction lookup fails after mining", async () => {
    const h = harness();
    h.getTransaction.mockRejectedValueOnce(new Error("RPC down"));
    await expect(h.client.executeUSDC(input)).rejects.toMatchObject({
      code: "CONFIRMATION_UNAVAILABLE",
      txHash,
    });
  });

  it("confirm preserves hash on timeout and rejects replacement receipts", async () => {
    const h = harness();
    h.waitForTransactionReceipt.mockRejectedValueOnce(new Error("RPC down"));
    await expect(h.client.confirm(txHash)).rejects.toMatchObject({
      code: "CONFIRMATION_UNAVAILABLE",
      txHash,
    });
    h.waitForTransactionReceipt.mockResolvedValue({ ...h.receipt, transactionHash: zeroHash });
    await expect(h.client.confirm(txHash)).rejects.toMatchObject({
      code: "OUTCOME_INCONSISTENT",
      txHash,
    });
  });

  it.each(["recipient", "amount", "reason", "wallet"] as const)(
    "reconcile rejects mismatched %s, including a freeze lacking terms in its event",
    async (field) => {
      const h = harness([frozen()]);
      if (field === "wallet") h.transaction.to = unrelated;
      const terms: ExecuteUSDCInput = {
        ...input,
        ...(field === "recipient" ? { to: unrelated } : {}),
        ...(field === "amount" ? { amount: 1n } : {}),
        ...(field === "reason" ? { reason: "different" } : {}),
      };
      await expect(h.client.reconcileUSDC(txHash, terms)).rejects.toMatchObject({
        code: "OUTCOME_INCONSISTENT",
        txHash,
      });
      expect(h.writeContract).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unrelated hash", { hash: zeroHash }, undefined],
    ["replacement receipt", {}, zeroHash],
    ["wrong wallet", { to: unrelated }, undefined],
    ["wrong calldata", { input: "0x" as Hex }, undefined],
    ["nonzero value", { value: 1n }, undefined],
  ] as const)(
    "does not classify a reverted %s as this payment's revert",
    async (_name, transactionMutation, receiptHash) => {
      const h = harness([]);
      Object.assign(h.transaction, transactionMutation);
      h.receipt.status = "reverted";
      if (receiptHash) h.receipt.transactionHash = receiptHash;

      await expect(h.client.reconcileUSDC(txHash, input)).rejects.toMatchObject({
        name: "TransactionRecoveryError",
        code: "OUTCOME_INCONSISTENT",
        txHash,
        submission: { input },
      });
    },
  );

  it("reports explicit recovery uncertainty when reverted transaction terms are unavailable", async () => {
    const h = harness([]);
    h.receipt.status = "reverted";
    h.getTransaction.mockRejectedValueOnce(new Error("transaction body unavailable"));

    await expect(h.client.reconcileUSDC(txHash, input)).rejects.toMatchObject({
      name: "TransactionRecoveryError",
      code: "CONFIRMATION_UNAVAILABLE",
      txHash,
      submission: { input },
    });
    expect(h.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it.each([
    ["same day and month", 40n * 86_400n + 1n, 40n, 1n, 7n, 11n],
    ["next day in same month", 41n * 86_400n, 40n, 1n, 0n, 11n],
    ["next month", 60n * 86_400n, 59n, 1n, 0n, 0n],
  ] as const)(
    "simulate rolls spend counters at the pinned block: %s",
    async (_name, timestamp, spendDay, spendMonth, expectedDaily, expectedMonthly) => {
      const h = harness();
      Reflect.set(h.client, "publicClient", {
        ...Reflect.get(h.client, "publicClient"),
        getBlock: vi.fn().mockResolvedValue({ number: 77n, timestamp }),
      });
      h.readContract.mockImplementation(
        async ({ functionName, blockNumber }: { functionName: string; blockNumber?: bigint }) => {
          if (functionName !== "balanceOf") expect(blockNumber).toBe(77n);
          switch (functionName) {
            case "policy":
              return [100n, 200n, 300n, 31n, 1n, false, true];
            case "dailySpent":
              return 7n;
            case "monthlySpent":
              return 11n;
            case "spendDay":
              return spendDay;
            case "spendMonth":
              return spendMonth;
            case "policyEngine":
            case "vendorRegistry":
              return unrelated;
            case "evaluate":
              return [0, 0];
            default:
              throw new Error(`Unexpected read ${functionName}`);
          }
        },
      );

      await expect(h.client.simulate(input)).resolves.toEqual({ verdict: "ALLOW", reason: "NONE" });
      const evaluate = h.readContract.mock.calls.find(
        ([request]) => request.functionName === "evaluate",
      )?.[0];
      expect(evaluate).toMatchObject({
        blockNumber: 77n,
        args: [expect.any(Object), vendor, input.amount, expectedDaily, expectedMonthly, unrelated],
      });
    },
  );

  it.each([
    [escalated(), "escalate"],
    [frozen(), "freeze"],
  ] as const)("intent wrapper reports mined outcome: %s", async (log, decision) => {
    const h = harness([log]);
    const result = await h.client.executePaymentIntent(intent);
    expect(result).toMatchObject({
      txHash,
      decision,
    });
  });

  it("intent wrapper propagates uncertainty instead of converting it to deny/validation_error", async () => {
    const h = harness();
    h.waitForTransactionReceipt.mockRejectedValueOnce(new Error("timeout"));
    const onSubmitted = vi.fn();
    await expect(h.client.executePaymentIntent(intent, { onSubmitted })).rejects.toBeInstanceOf(
      TransactionRecoveryError,
    );
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it.each([
    [executed(), "allow"],
    [escalated(), "escalate"],
    [frozen(), "freeze"],
  ] as const)("preserves mined outcome on evidence failure: %s", async (log, decision) => {
    const h = harness([log]);
    const receipt = await signedTestReceipt();
    vi.spyOn(h.client, "requestPaymentReceipt").mockResolvedValue({ receipt, replayed: false });
    const failure = new Error("evidence store unavailable");
    const attach = vi.spyOn(h.client, "attachPaymentReceiptEvidence").mockRejectedValue(failure);
    const result = await h.client.executePaymentIntentWithReceipt(intent);
    expect(result.result).toMatchObject({ txHash, decision });
    if (decision === "escalate") expect(result.result.escalationId).toBe(escalationId);
    expect(result.evidence).toBeNull();
    expect(result.evidenceError).toBe(failure);
    expect(attach).toHaveBeenCalledWith(receipt.receipt.receiptId, txHash);
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it.each(["intent", "receipt"] as const)("propagates ambiguous outcome: %s", async (method) => {
    const h = harness([executed(), escalated()]);
    const receipt = await signedTestReceipt();
    vi.spyOn(h.client, "requestPaymentReceipt").mockResolvedValue({ receipt, replayed: false });
    const attach = vi.spyOn(h.client, "attachPaymentReceiptEvidence");
    const pending =
      method === "intent"
        ? h.client.executePaymentIntent(intent)
        : h.client.executePaymentIntentWithReceipt(intent);
    await expect(pending).rejects.toMatchObject({
      code: "OUTCOME_AMBIGUOUS",
      txHash,
    });
    expect(attach).not.toHaveBeenCalled();
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });

  it("receipt-first timeout preserves receipt ID/hash; recovery and evidence retry never submit", async () => {
    const h = harness([executed()]);
    const receipt = await signedTestReceipt();
    vi.spyOn(h.client, "requestPaymentReceipt").mockResolvedValue({ receipt, replayed: false });
    const original = {
      ...input,
      metadata: {
        reference: intent.reference,
        tokenSymbol: "USDC",
        receiptId: receipt.receipt.receiptId,
      },
    };
    h.waitForTransactionReceipt.mockRejectedValueOnce(new Error("timeout"));
    const attach = vi
      .spyOn(h.client, "attachPaymentReceiptEvidence")
      .mockRejectedValue(new Error("offline"));
    const onSubmitted = vi.fn();
    await expect(
      h.client.executePaymentIntentWithReceipt(intent, { onSubmitted }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_UNAVAILABLE",
      txHash,
      submission: { input: original },
    });
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(attach).not.toHaveBeenCalled();
    await expect(h.client.reconcileUSDC(txHash, original)).resolves.toMatchObject({
      verdict: "ALLOW",
      txHash,
    });
    await expect(
      h.client.attachPaymentReceiptEvidence(receipt.receipt.receiptId, txHash),
    ).rejects.toThrow("offline");
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });
});
