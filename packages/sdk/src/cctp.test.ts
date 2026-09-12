import {
  type Address,
  type Hash,
  type Hex,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  concatHex,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  padHex,
  stringToHex,
  toHex,
} from "viem";
import { describe, expect, it } from "vitest";

import {
  CCTP_FORWARD_HOOK_V1,
  CCTP_ROUTE,
  CCTP_ZERO_BYTES32,
  buildCctpTransactions,
  getCctpQuote,
  getCctpStatus,
} from "./cctp";
import { cctpTokenMessengerAbi } from "./cctp/transactions";

const RECIPIENT = "0x1234567890123456789012345678901234567890" as Address;
const SENDER = "0x9876543210987654321098765432109876543210" as Address;
const HASH = `0x${"ab".repeat(32)}` as Hash;

describe("CCTP Sepolia to Arc route", () => {
  it("parses six-decimal totals exactly and uses high forwarding fee", async () => {
    const quote = await getCctpQuote("1.000001", {
      fetchFn: async () =>
        json([
          { finalityThreshold: 1000, minimumFee: 1, forwardFee: { high: 1 } },
          { finalityThreshold: 2000, minimumFee: 0, forwardFee: { low: 1, med: 2, high: 345 } },
        ]),
    });
    expect(quote.amountBaseUnits).toBe("1000001");
    expect(quote.maxFeeBaseUnits).toBe("345");
    expect(quote.minimumReceivedBaseUnits).toBe("999656");
    await expect(getCctpQuote("0.0000001", { fetchFn: async () => json([]) })).rejects.toThrow(
      "6 decimal",
    );
    await expect(
      getCctpQuote("1", {
        fetchFn: async () =>
          json([{ finalityThreshold: 2000, minimumFee: 1, forwardFee: { high: 1 } }]),
      }),
    ).rejects.toThrow("changed from zero");
    await expect(
      getCctpQuote("1", {
        fetchFn: async () => json([{ finalityThreshold: 2000, minimumFee: 0, forwardFee: {} }]),
      }),
    ).rejects.toThrow("forwardFee.high");
  });

  it("encodes an exact allowance and immutable Standard forwarding call", () => {
    const transactions = buildCctpTransactions({
      recipient: RECIPIENT,
      quote: {
        amountBaseUnits: "1000000",
        maxFeeBaseUnits: "123",
        minimumReceivedBaseUnits: "999877",
        expiresAt: Date.now() + 60_000,
      },
    });
    expect(transactions.approval.to).toBe(CCTP_ROUTE.sourceUsdc);
    const decoded = decodeFunctionData({
      abi: cctpTokenMessengerAbi,
      data: transactions.burn.data,
    });
    expect(decoded.functionName).toBe("depositForBurnWithHook");
    expect(decoded.args?.[0]).toBe(1_000_000n);
    expect(decoded.args?.[1]).toBe(26);
    expect(decoded.args?.[5]).toBe(123n);
    expect(decoded.args?.[6]).toBe(2_000);
    expect(decoded.args?.[7]).toBe(CCTP_FORWARD_HOOK_V1);
    expect(() =>
      buildCctpTransactions({
        recipient: RECIPIENT,
        quote: {
          amountBaseUnits: "100",
          maxFeeBaseUnits: "100",
          minimumReceivedBaseUnits: "0",
          expiresAt: Date.now() + 1,
        },
      }),
    ).toThrow("invalid amount");
    expect(() =>
      buildCctpTransactions({
        recipient: RECIPIENT,
        quote: {
          amountBaseUnits: "100",
          maxFeeBaseUnits: "1",
          minimumReceivedBaseUnits: "99",
          expiresAt: Date.now() - 1,
        },
      }),
    ).toThrow("expired");
    expect(() =>
      buildCctpTransactions({
        recipient: RECIPIENT,
        quote: {
          amountBaseUnits: (1n << 256n).toString(),
          maxFeeBaseUnits: "1",
          minimumReceivedBaseUnits: "1",
          expiresAt: Date.now() + 60_000,
        },
      }),
    ).toThrow("exceeds uint256");
  });

  it("rejects malformed, non-integral, and unsafe fee responses", async () => {
    const response = (high: unknown) =>
      getCctpQuote("999999999", {
        fetchFn: async () =>
          json([{ finalityThreshold: 2000, minimumFee: 0, forwardFee: { high } }]),
      });
    await expect(response("1.5")).rejects.toThrow("canonical unsigned");
    await expect(response(Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow("safe non-negative");
    await expect(getCctpQuote("01", { fetchFn: async () => json([]) })).rejects.toThrow("decimal");
  });

  it("reports attestation pending, not completion, when Iris has not indexed a valid burn", async () => {
    const fixture = validFixture();
    const status = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: fixture.source,
        fetchFn: async () => new Response(JSON.stringify({ code: 404 }), { status: 404 }),
      },
    );
    expect(status.stage).toBe("attestation_pending");
    expect(status.receivedBaseUnits).toBeUndefined();
    expect(status.feeBaseUnits).toBeUndefined();
    expect(status).toMatchObject({
      sourceNonce: 7,
      sourceBlockNumber: "42",
      sender: SENDER,
      recipient: RECIPIENT,
      amountBaseUnits: "1000000",
      maxFeeBaseUnits: "123",
    });
  });

  it("accepts only the real single-record V2 pending-confirmations envelope", async () => {
    const fixture = validFixture();
    const status = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      { sourceClient: fixture.source, fetchFn: async () => json(pendingIris()) },
    );
    expect(status).toMatchObject({ stage: "attestation_pending", sourceNonce: 7 });
    expect(status.feeBaseUnits).toBeUndefined();
    expect(status.receivedBaseUnits).toBeUndefined();

    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () => json({ ...pendingIris(), sourceTxHash: MINT_HASH }),
        },
      ),
    ).rejects.toThrow("not bound");
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () =>
            json({
              ...pendingIris(),
              messages: [pendingIris().messages[0], pendingIris().messages[0]],
            }),
        },
      ),
    ).rejects.toThrow("does not uniquely identify");
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () =>
            json({
              ...pendingIris(),
              messages: [{ ...pendingIris().messages[0], status: "complete" }],
            }),
        },
      ),
    ).rejects.toThrow("does not uniquely identify");
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () =>
            json({
              ...pendingIris(),
              messages: [
                { ...pendingIris().messages[0], attestation: "0x1234", status: "complete" },
              ],
            }),
        },
      ),
    ).rejects.toThrow("does not uniquely identify");
  });

  it("reports forwarding, not completion, for a complete attestation without a forward transaction", async () => {
    const fixture = validFixture();
    const status = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: fixture.source,
        fetchFn: async () => json(iris(fixture.message, { forwardState: "PENDING" })),
      },
    );
    expect(status).toMatchObject({ stage: "forwarding", forwardState: "PENDING" });
  });

  it("verifies an explicitly supplied manual destination transaction candidate", async () => {
    const fixture = validFixture();
    const completed = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: MINT_HASH },
      {
        sourceClient: fixture.source,
        destinationClient: fixture.destination,
        fetchFn: async () => json(iris(fixture.message, { forwardState: "COMPLETE" })),
      },
    );
    expect(completed).toMatchObject({
      stage: "completed",
      mintTxHash: MINT_HASH,
      forwardState: "COMPLETE",
    });

    for (const destinationMutation of [
      "wrong-calldata",
      "wrong-nonce",
      "wrong-recipient",
      "missing-message",
    ] as const) {
      const invalid = validFixture({ destinationMutation });
      await expect(
        getCctpStatus(
          { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: MINT_HASH },
          {
            sourceClient: invalid.source,
            destinationClient: invalid.destination,
            fetchFn: async () => json(iris(invalid.message, {})),
          },
        ),
      ).rejects.toThrow();
    }

    const revertedDestination = validFixture({ destinationMutation: "failed-call" });
    const revertedStatus = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: MINT_HASH },
      {
        sourceClient: revertedDestination.source,
        destinationClient: revertedDestination.destination,
        fetchFn: async () => json(iris(revertedDestination.message, {})),
      },
    );
    expect(revertedStatus).toMatchObject({ stage: "forwarding", mintTxHash: MINT_HASH });
    expect(revertedStatus.forwardState).toBeUndefined();
    expect(revertedStatus.detail).toBe("Forwarded destination transaction has not succeeded.");

    const providerStateOnRevertedDestination = validFixture({ destinationMutation: "failed-call" });
    const providerStateStatus = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: MINT_HASH },
      {
        sourceClient: providerStateOnRevertedDestination.source,
        destinationClient: providerStateOnRevertedDestination.destination,
        fetchFn: async () =>
          json(iris(providerStateOnRevertedDestination.message, { forwardState: "COMPLETE" })),
      },
    );
    expect(providerStateStatus).toMatchObject({
      stage: "forwarding",
      mintTxHash: MINT_HASH,
      forwardState: "COMPLETE",
      detail: "Forwarded destination transaction has not succeeded.",
    });

    const pendingDestination = validFixture();
    const pending = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: MINT_HASH },
      {
        sourceClient: pendingDestination.source,
        destinationClient: {
          ...pendingDestination.destination,
          getTransaction: async () => null,
        },
        fetchFn: async () => json(iris(pendingDestination.message, {})),
      },
    );
    expect(pending).toMatchObject({ stage: "forwarding", mintTxHash: MINT_HASH });
    expect(pending.forwardState).toBeUndefined();
    expect(pending.detail).toBe("Circle attested the burn; forwarding is still pending.");

    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT, mintTxHash: OTHER_MINT_HASH },
        {
          sourceClient: fixture.source,
          fetchFn: async () => json(iris(fixture.message, { forwardTxHash: MINT_HASH })),
        },
      ),
    ).rejects.toThrow("conflicts");
    await expect(
      getCctpStatus({
        burnTxHash: HASH,
        recipient: RECIPIENT,
        mintTxHash: "0x1234" as Hash,
      }),
    ).rejects.toThrow("mint transaction hash is invalid");
  });

  it("keeps a reverted source burn in source_failed", async () => {
    const fixture = validFixture({ sourceStatus: "reverted" });
    const status = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      { sourceClient: fixture.source, fetchFn: async () => json({}) },
    );
    expect(status.stage).toBe("source_failed");
    expect(status.receivedBaseUnits).toBeUndefined();
    expect(status.feeBaseUnits).toBeUndefined();
    expect(status).toMatchObject({
      sourceNonce: 7,
      sourceBlockNumber: "42",
      recipient: RECIPIENT,
      maxFeeBaseUnits: "123",
    });
  });

  it("requires hash-bound, canonical source identity metadata before any status recovery", async () => {
    const cases = [
      ["wrong-tx-hash", "not bound"],
      ["wrong-receipt-hash", "not bound"],
      ["unsafe-nonce", "safe non-negative"],
      ["negative-block", "canonical non-negative"],
    ] as const;
    for (const [sourceMetadataMutation, error] of cases) {
      const fixture = validFixture({ sourceStatus: "reverted", sourceMetadataMutation });
      await expect(
        getCctpStatus({ burnTxHash: HASH, recipient: RECIPIENT }, { sourceClient: fixture.source }),
      ).rejects.toThrow(error);
    }
  });

  it("maps viem missing source transactions and receipts to source_pending", async () => {
    const transactionMissing = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: {
          getChainId: async () => 11_155_111,
          getTransaction: async () => {
            throw new TransactionNotFoundError({ hash: HASH });
          },
          getTransactionReceipt: async () => null,
        },
      },
    );
    expect(transactionMissing).toMatchObject({ stage: "source_pending", burnTxHash: HASH });

    const fixture = validFixture();
    const receiptMissing = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: {
          ...fixture.source,
          getTransactionReceipt: async () => {
            throw new TransactionReceiptNotFoundError({ hash: HASH });
          },
        },
      },
    );
    expect(receiptMissing).toMatchObject({ stage: "source_pending", burnTxHash: HASH });
  });

  it("maps viem missing destination reads to forwarding but preserves RPC failures", async () => {
    const fixture = validFixture();
    const status = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: fixture.source,
        destinationClient: {
          ...fixture.destination,
          getTransaction: async () => {
            throw new TransactionNotFoundError({ hash: MINT_HASH });
          },
        },
        fetchFn: async () =>
          json(iris(fixture.message, { forwardState: "COMPLETE", forwardTxHash: MINT_HASH })),
      },
    );
    expect(status).toMatchObject({ stage: "forwarding", mintTxHash: MINT_HASH });
    expect(status.receivedBaseUnits).toBeUndefined();
    expect(status.feeBaseUnits).toBeUndefined();

    const receiptMissing = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: fixture.source,
        destinationClient: {
          ...fixture.destination,
          getTransactionReceipt: async () => {
            throw new TransactionReceiptNotFoundError({ hash: MINT_HASH });
          },
        },
        fetchFn: async () => json(iris(fixture.message, { forwardTxHash: MINT_HASH })),
      },
    );
    expect(receiptMissing).toMatchObject({ stage: "forwarding", mintTxHash: MINT_HASH });

    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: {
            getChainId: async () => 11_155_111,
            getTransaction: async () => {
              throw new Error("RPC offline");
            },
            getTransactionReceipt: async () => null,
          },
        },
      ),
    ).rejects.toThrow("RPC offline");
  });

  it("rejects source and destination clients connected to another chain", async () => {
    const fixture = validFixture({ sourceChainId: 1 });
    await expect(
      getCctpStatus({ burnTxHash: HASH, recipient: RECIPIENT }, { sourceClient: fixture.source }),
    ).rejects.toThrow("expected 11155111");
    const valid = validFixture({ destinationChainId: 1 });
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: valid.source,
          destinationClient: valid.destination,
          fetchFn: async () => json(iris(valid.message, { forwardTxHash: MINT_HASH })),
        },
      ),
    ).rejects.toThrow("expected 5042002");
  });

  it("rejects Iris responses not bound to the source hash or emitted message", async () => {
    const fixture = validFixture();
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () => json({ ...iris(fixture.message, {}), sourceTxHash: MINT_HASH }),
        },
      ),
    ).rejects.toThrow("not bound");
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: fixture.source,
          fetchFn: async () => json(iris(`0x${"00".repeat(376)}`, {})),
        },
      ),
    ).rejects.toThrow("does not uniquely identify");
  });

  it("rejects a source burn encoded for another recipient", async () => {
    const fixture = validFixture();
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: "0x1234567890123456789012345678901234567891" as Address },
        { sourceClient: fixture.source },
      ),
    ).rejects.toThrow("does not match");
  });

  it("requires a successful bound receiveMessage, MessageReceived and exact native-USDC mint", async () => {
    const fixture = validFixture();
    const completed = await getCctpStatus(
      { burnTxHash: HASH, recipient: RECIPIENT },
      {
        sourceClient: fixture.source,
        destinationClient: fixture.destination,
        fetchFn: async () =>
          json(iris(fixture.message, { forwardState: "COMPLETE", forwardTxHash: MINT_HASH })),
      },
    );
    expect(completed).toMatchObject({
      stage: "completed",
      mintTxHash: MINT_HASH,
      forwardState: "COMPLETE",
      feeBaseUnits: "100",
      receivedBaseUnits: "999900",
      sourceNonce: 7,
      sourceBlockNumber: "42",
      recipient: RECIPIENT,
      maxFeeBaseUnits: "123",
    });

    for (const mutation of [
      "missing-message",
      "wrong-token",
      "wrong-recipient",
      "wrong-amount",
      "wrong-nonce",
      "expired-message",
    ] as const) {
      const broken = validFixture({ destinationMutation: mutation });
      await expect(
        getCctpStatus(
          { burnTxHash: HASH, recipient: RECIPIENT },
          {
            sourceClient: broken.source,
            destinationClient: broken.destination,
            fetchFn: async () => json(iris(broken.message, { forwardTxHash: MINT_HASH })),
          },
        ),
      ).rejects.toThrow();
    }
    const failed = validFixture({ destinationMutation: "failed-call" });
    await expect(
      getCctpStatus(
        { burnTxHash: HASH, recipient: RECIPIENT },
        {
          sourceClient: failed.source,
          destinationClient: failed.destination,
          fetchFn: async () => json(iris(failed.message, { forwardTxHash: MINT_HASH })),
        },
      ),
    ).resolves.toMatchObject({ stage: "forwarding", mintTxHash: MINT_HASH });
  });
});

const ATTESTED_NONCE = `0x${"42".repeat(32)}` as Hex;

function forwardingMessage(
  amount: bigint,
  maxFee: bigint,
  {
    nonce = CCTP_ZERO_BYTES32,
    finalityThresholdExecuted = 0,
    feeExecuted = 0n,
    expirationBlock = 0n,
  }: {
    nonce?: Hex;
    finalityThresholdExecuted?: number;
    feeExecuted?: bigint;
    expirationBlock?: bigint;
  } = {},
): Hex {
  const address32 = (address: Address) => padHex(address, { size: 32 });
  return concatHex([
    toHex(1, { size: 4 }),
    toHex(0, { size: 4 }),
    toHex(26, { size: 4 }),
    nonce,
    address32(CCTP_ROUTE.sourceTokenMessenger),
    address32(CCTP_ROUTE.destinationTokenMessenger),
    padHex("0x", { size: 32 }),
    toHex(2_000, { size: 4 }),
    toHex(finalityThresholdExecuted, { size: 4 }),
    toHex(1, { size: 4 }),
    address32(CCTP_ROUTE.sourceUsdc),
    address32(RECIPIENT),
    toHex(amount, { size: 32 }),
    address32(SENDER),
    toHex(maxFee, { size: 32 }),
    toHex(feeExecuted, { size: 32 }),
    toHex(expirationBlock, { size: 32 }),
    CCTP_FORWARD_HOOK_V1,
  ]);
}

const MINT_HASH = `0x${"cd".repeat(32)}` as Hash;
const OTHER_MINT_HASH = `0x${"ef".repeat(32)}` as Hash;
const QUOTE = {
  amountBaseUnits: "1000000",
  maxFeeBaseUnits: "123",
  minimumReceivedBaseUnits: "999877",
  expiresAt: Date.now() + 60_000,
};
const receiveMessageAbi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

function validFixture(
  options: {
    sourceStatus?: "success" | "reverted";
    sourceMetadataMutation?:
      | "wrong-tx-hash"
      | "wrong-receipt-hash"
      | "unsafe-nonce"
      | "negative-block";
    sourceChainId?: number;
    destinationChainId?: number;
    destinationMutation?:
      | "missing-message"
      | "wrong-token"
      | "wrong-recipient"
      | "wrong-amount"
      | "wrong-nonce"
      | "wrong-calldata"
      | "expired-message"
      | "failed-call";
  } = {},
) {
  const burn = buildCctpTransactions({ recipient: RECIPIENT, quote: QUOTE }).burn;
  const sourceMessage = forwardingMessage(1_000_000n, 123n);
  const message = forwardingMessage(1_000_000n, 123n, {
    nonce: ATTESTED_NONCE,
    finalityThresholdExecuted: 2_000,
    feeExecuted: 100n,
    expirationBlock: 1_000n,
  });
  const body = `0x${message.slice(2 + 148 * 2)}` as Hex;
  const mutation = options.destinationMutation;
  const sourceMetadataMutation = options.sourceMetadataMutation;
  const receiptStatus = mutation === "failed-call" ? "reverted" : "success";
  const destinationMessage = mutation === "wrong-calldata" ? sourceMessage : message;
  const transferToken =
    mutation === "wrong-token" ? CCTP_ROUTE.sourceUsdc : CCTP_ROUTE.destinationUsdc;
  const transferRecipient = mutation === "wrong-recipient" ? SENDER : RECIPIENT;
  const transferAmount = mutation === "wrong-amount" ? 999_899n : 999_900n;
  const messageLogs =
    mutation === "missing-message"
      ? []
      : [messageReceivedLog(body, mutation === "wrong-nonce" ? CCTP_ZERO_BYTES32 : ATTESTED_NONCE)];
  return {
    message,
    source: {
      getChainId: async () => options.sourceChainId ?? 11_155_111,
      getTransaction: async () => ({
        hash: sourceMetadataMutation === "wrong-tx-hash" ? MINT_HASH : HASH,
        nonce: sourceMetadataMutation === "unsafe-nonce" ? Number.MAX_SAFE_INTEGER + 1 : 7,
        to: CCTP_ROUTE.sourceTokenMessenger,
        from: SENDER,
        input: burn.data,
      }),
      getTransactionReceipt: async () => ({
        transactionHash: sourceMetadataMutation === "wrong-receipt-hash" ? MINT_HASH : HASH,
        blockNumber: sourceMetadataMutation === "negative-block" ? -1n : 42n,
        status: options.sourceStatus ?? "success",
        logs: [messageSentLog(sourceMessage)],
      }),
    },
    destination: {
      getChainId: async () => options.destinationChainId ?? 5_042_002,
      getTransaction: async () => ({
        to: CCTP_ROUTE.destinationMessageTransmitter,
        input: encodeFunctionData({
          abi: receiveMessageAbi,
          functionName: "receiveMessage",
          args: [destinationMessage, "0x1234"],
        }),
      }),
      getTransactionReceipt: async () => ({
        status: receiptStatus,
        blockNumber: mutation === "expired-message" ? 1_000n : 100n,
        logs: [...messageLogs, transferLog(transferToken, transferRecipient, transferAmount)],
      }),
    },
  };
}

function iris(message: Hex, extra: Record<string, unknown>) {
  return {
    sourceTxHash: HASH,
    messages: [
      {
        message,
        status: "complete",
        eventNonce: ATTESTED_NONCE,
        cctpVersion: 2,
        decodedMessage: {
          sourceDomain: "0",
          destinationDomain: "26",
          sender: CCTP_ROUTE.sourceTokenMessenger,
          recipient: CCTP_ROUTE.destinationTokenMessenger,
          destinationCaller: CCTP_ZERO_BYTES32,
          decodedMessageBody: {
            burnToken: CCTP_ROUTE.sourceUsdc,
            mintRecipient: RECIPIENT,
            amount: "1000000",
            messageSender: SENDER,
          },
        },
        ...extra,
      },
    ],
  };
}

function pendingIris() {
  return {
    sourceTxHash: HASH,
    messages: [
      {
        attestation: "PENDING",
        message: null,
        eventNonce: ATTESTED_NONCE,
        cctpVersion: 2,
        status: "pending_confirmations",
        decodedMessage: null,
        delayReason: null,
      },
    ],
  };
}

function messageSentLog(message: Hex) {
  return {
    address: CCTP_ROUTE.sourceMessageTransmitter,
    topics: [keccak256(stringToHex("MessageSent(bytes)"))],
    data: encodeAbiParameters([{ type: "bytes" }], [message]),
  };
}

function messageReceivedLog(body: Hex, nonce: Hex) {
  return {
    address: CCTP_ROUTE.destinationMessageTransmitter,
    topics: [
      keccak256(stringToHex("MessageReceived(address,uint32,bytes32,bytes32,uint32,bytes)")),
      padHex("0x000000000000000000000000000000000000dEaD", { size: 32 }),
      nonce,
      toHex(2_000, { size: 32 }),
    ],
    data: encodeAbiParameters(
      [{ type: "uint32" }, { type: "bytes32" }, { type: "bytes" }],
      [0, padHex(CCTP_ROUTE.sourceTokenMessenger, { size: 32 }), body],
    ),
  };
}

function transferLog(token: Address, recipient: Address, amount: bigint) {
  return {
    address: token,
    topics: [
      keccak256(stringToHex("Transfer(address,address,uint256)")),
      padHex("0x", { size: 32 }),
      padHex(recipient, { size: 32 }),
    ],
    data: toHex(amount, { size: 32 }),
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
