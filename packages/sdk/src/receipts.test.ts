import { signedTestReceipt, testAgentAccount, testIssuer } from "@arcanum/shared/testing";
import { describe, expect, it, vi } from "vitest";

import { ArcanumClient } from "./client";
import { type ArcanumError, TransferRevertedError } from "./errors";
import { ReceiptApi, ReceiptRequestError } from "./receipts";
import type { ExecuteUSDCInput, ExecuteUSDCResult, PaymentIntentInput } from "./types";

const API_URL = "https://arcanum.test";
const TX_HASH = `0x${"a1".repeat(32)}` as const;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fixtures(overrides: Parameters<typeof signedTestReceipt>[0] = {}) {
  const envelope = await signedTestReceipt(overrides);
  const request = envelope.receipt.request;
  const intent: PaymentIntentInput = {
    chainId: request.chainId,
    governedWalletAddress: request.governedWalletAddress,
    agentSignerAddress: request.agentSignerAddress,
    vendorAddress: request.vendorAddress,
    tokenAddress: request.tokenAddress,
    tokenSymbol: request.tokenSymbol,
    amount: request.amount,
    purpose: request.purpose,
    reference: request.reference,
  };
  return { envelope, intent };
}

function evidenceRow(receiptId: string, outcome: string) {
  return {
    id: "5d0f1e2c-3b4a-4c5d-8e6f-7a8b9c0d1e2f",
    receiptId,
    kind: "execution",
    outcome,
    txHash: TX_HASH,
    logIndex: 3,
    blockNumber: 61_000_010,
    escalationKey: null,
    calldataNamesReceipt: true,
    observedAt: "2026-09-10T10:05:00.000Z",
    details: { receiptVerdict: "allow", verdictMatches: true },
  };
}

/** A client whose chain side is stubbed and whose receipt side talks to `fetch`. */
function clientWith(fetch: typeof globalThis.fetch, execute?: ArcanumClient["executeUSDC"]) {
  const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
  Reflect.set(client, "walletAddress", "0x1000000000000000000000000000000000000001");
  Reflect.set(client, "receiptApi", new ReceiptApi({ apiUrl: `${API_URL}/`, fetch }));
  Reflect.set(client, "receiptIssuers", [testIssuer]);
  Reflect.set(client, "walletClient", {
    account: testAgentAccount,
    signMessage: (args: { message: string }) =>
      testAgentAccount.signMessage({ message: args.message }),
  });
  if (execute) {
    client.executeUSDC = execute;
  }
  return client;
}

describe("payment decision receipts", () => {
  it("signs the intent, posts it and returns the parsed receipt", async () => {
    const { envelope, intent } = await fixtures();
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(`${API_URL}/api/receipts`);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.signature).toMatch(/^0x[0-9a-f]{130}$/);
      expect(body.reference).toBe(intent.reference);
      return jsonResponse(201, { receipt: envelope, replayed: false });
    });

    const requested = await clientWith(fetch as typeof globalThis.fetch).requestPaymentReceipt(
      intent,
    );

    expect(requested.replayed).toBe(false);
    expect(requested.receipt.receiptDigest).toBe(envelope.receiptDigest);
  });

  it("surfaces API domain errors with their code and status", async () => {
    const { intent } = await fixtures();
    const fetch = async () =>
      jsonResponse(403, {
        error: { code: "AGENT_NOT_AUTHORIZED", message: "not a signer" },
      });

    await expect(clientWith(fetch).requestPaymentReceipt(intent)).rejects.toMatchObject({
      name: "ReceiptRequestError",
      code: "AGENT_NOT_AUTHORIZED",
      status: 403,
    } satisfies Partial<ReceiptRequestError>);
  });

  it("refuses a malformed receipt body instead of trusting it", async () => {
    const { envelope, intent } = await fixtures();
    const fetch = async () =>
      jsonResponse(201, { receipt: { ...envelope, signature: "0x00" }, replayed: false });

    await expect(clientWith(fetch).requestPaymentReceipt(intent)).rejects.toThrow();
  });

  it("refuses a receipt whose issuer signature does not verify", async () => {
    const { envelope, intent } = await fixtures();
    const forged = {
      ...envelope,
      receipt: {
        ...envelope.receipt,
        decision: { verdict: "allow", reasonCode: "OK", explanation: "edited after signing" },
      },
    };
    const fetch = async () => jsonResponse(201, { receipt: forged, replayed: false });

    await expect(clientWith(fetch).requestPaymentReceipt(intent)).rejects.toMatchObject({
      name: "ArcanumError",
      code: "RECEIPT_UNVERIFIED",
      message: expect.stringContaining("digest mismatch"),
    } satisfies Partial<ArcanumError>);
  });

  it("refuses a receipt signed by an issuer it does not trust", async () => {
    const { envelope, intent } = await fixtures();
    const client = clientWith(async () =>
      jsonResponse(201, { receipt: envelope, replayed: false }),
    );
    Reflect.set(client, "receiptIssuers", undefined);

    await expect(client.requestPaymentReceipt(intent)).rejects.toMatchObject({
      code: "RECEIPT_UNVERIFIED",
      message: expect.stringContaining("issuer unknown_issuer"),
    } satisfies Partial<ArcanumError>);
  });

  it("refuses a valid receipt that answers a different intent", async () => {
    const { envelope, intent } = await fixtures();
    const fetch = async () => jsonResponse(201, { receipt: envelope, replayed: false });

    await expect(
      clientWith(fetch).requestPaymentReceipt({ ...intent, reference: "inv-2026-09-0002" }),
    ).rejects.toMatchObject({
      code: "RECEIPT_MISMATCH",
    } satisfies Partial<ArcanumError>);
  });

  it("requires apiUrl for the receipt methods", async () => {
    const { intent } = await fixtures();
    const client = Object.create(ArcanumClient.prototype) as ArcanumClient;
    Reflect.set(client, "receiptApi", null);

    await expect(client.requestPaymentReceipt(intent)).rejects.toMatchObject({
      code: "API_URL_REQUIRED",
    } satisfies Partial<ArcanumError>);
  });

  it("executes an allowed receipt, names it in the calldata and links the tx", async () => {
    const { envelope, intent } = await fixtures();
    const receiptId = envelope.receipt.receiptId;
    const posts: string[] = [];
    const fetch = async (url: string | URL | Request) => {
      posts.push(String(url));
      if (posts.length === 1) {
        return jsonResponse(201, { receipt: envelope, replayed: false });
      }
      return jsonResponse(200, { receiptId, evidence: [evidenceRow(receiptId, "executed")] });
    };
    const calls: ExecuteUSDCInput[] = [];
    const client = clientWith(fetch, async (input): Promise<ExecuteUSDCResult> => {
      calls.push(input);
      return { verdict: "ALLOW", txHash: TX_HASH };
    });

    const outcome = await client.executePaymentIntentWithReceipt(intent);

    expect(calls[0]).toMatchObject({
      to: intent.vendorAddress,
      amount: BigInt(envelope.receipt.amountBaseUnits),
      metadata: { reference: intent.reference, receiptId },
    });
    expect(posts).toEqual([
      `${API_URL}/api/receipts`,
      `${API_URL}/api/receipts/${receiptId}/evidence`,
    ]);
    expect(outcome.result).toMatchObject({
      decision: "allow",
      txHash: TX_HASH,
      policyReference: `payment-receipt:${receiptId}`,
    });
    expect(outcome.evidence?.[0]?.outcome).toBe("executed");
    expect(outcome.evidenceError).toBeUndefined();
  });

  it("does not act on a replayed receipt unless told to", async () => {
    const { envelope, intent } = await fixtures();
    const execute = vi.fn(
      async (): Promise<ExecuteUSDCResult> => ({
        verdict: "ALLOW",
        txHash: TX_HASH,
      }),
    );
    const posts: string[] = [];
    const fetch = async (url: string | URL | Request) => {
      posts.push(String(url));
      return String(url).endsWith("/evidence")
        ? jsonResponse(200, {
            receiptId: envelope.receipt.receiptId,
            evidence: [evidenceRow(envelope.receipt.receiptId, "executed")],
          })
        : jsonResponse(200, { receipt: envelope, replayed: true });
    };
    const client = clientWith(fetch, execute);

    const heldBack = await client.executePaymentIntentWithReceipt(intent);
    expect(execute).not.toHaveBeenCalled();
    expect(heldBack.replayed).toBe(true);
    expect(heldBack.result).toMatchObject({
      decision: "validation_error",
      errorCode: "RECEIPT_REPLAYED",
    });
    expect(heldBack.evidence).toBeNull();

    const executed = await client.executePaymentIntentWithReceipt(intent, {
      executeReplayedReceipt: true,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(executed.result).toMatchObject({ decision: "allow", txHash: TX_HASH });
    expect(posts.filter((url) => url.endsWith("/evidence"))).toHaveLength(1);
  });

  it("never sends a denied or frozen decision onchain", async () => {
    const { envelope: denied, intent } = await fixtures({
      decision: { verdict: "deny", reasonCode: "PER_TX_CAP", explanation: "cap" },
    });
    const execute = vi.fn();
    const client = clientWith(
      async () => jsonResponse(201, { receipt: denied, replayed: true }),
      execute as unknown as ArcanumClient["executeUSDC"],
    );

    const outcome = await client.executePaymentIntentWithReceipt(intent);

    expect(execute).not.toHaveBeenCalled();
    expect(outcome.replayed).toBe(true);
    expect(outcome.result.decision).toBe("deny");
    expect(outcome.result.reason).toBe("PER_TX_CAP");
    expect(outcome.evidence).toBeNull();
  });

  it("keeps the tx hash when the chain reverted or the linkage failed", async () => {
    const { envelope, intent } = await fixtures();
    let attachCalls = 0;
    const fetch = async (url: string | URL | Request) => {
      if (String(url).endsWith("/evidence")) {
        attachCalls += 1;
        return jsonResponse(503, {
          error: { code: "RECEIPT_STORE_UNAVAILABLE", message: "store down" },
        });
      }
      return jsonResponse(201, { receipt: envelope, replayed: false });
    };
    const client = clientWith(fetch, async () => {
      throw new TransferRevertedError(TX_HASH, "PolicyDenied");
    });

    const outcome = await client.executePaymentIntentWithReceipt(intent);

    expect(attachCalls).toBe(1);
    expect(outcome.result).toMatchObject({
      decision: "deny",
      txHash: TX_HASH,
      errorCode: "TRANSFER_REVERTED",
    });
    expect(outcome.evidence).toBeNull();
    expect(outcome.evidenceError).toBeInstanceOf(ReceiptRequestError);
  });
});
