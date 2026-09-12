import type { EIP1193Provider } from "viem";
import { describe, expect, it } from "vitest";

import { CCTP_ROUTE, buildCctpTransactions } from "@/lib/cctp";

import {
  assertImportableCctpStatus,
  assertSelectedFundingAccount,
  assertStatusMatchesFundingIntent,
  assertSuccessfulApprovalReceipt,
  assertValidCctpQuote,
  assertValidCctpStatus,
  burnNonceForIntent,
  canUseOriginalQuoteForBurn,
  createFundingWalletClient,
  fundingAmountError,
  fundingIntentFromStatus,
  fundingStateForStage,
  parseFundingAmount,
} from "./cctp-funding-flow";

const quote = {
  amountBaseUnits: "1000000",
  expiresAt: Date.now() + 60_000,
  maxFeeBaseUnits: "1000",
  minimumReceivedBaseUnits: "999000",
};

describe("CCTP funding flow validation", () => {
  it("uses one strict parser for funding input and preserves base units", () => {
    expect(parseFundingAmount("1.000001")).toBe(1_000_001n);
    expect(fundingAmountError("-1")).toContain("at most 6 decimal places");
    expect(fundingAmountError("1e3")).toContain("at most 6 decimal places");
    expect(fundingAmountError("1.0000001")).toContain("at most 6 decimal places");
    expect(fundingAmountError("0")).toContain("greater than zero");
  });

  it("submits both wallet requests on Sepolia with the captured burn nonce", async () => {
    const calls: { method: string; params?: unknown }[] = [];
    const provider = {
      request: async ({ method, params }: { method: string; params?: unknown }) => {
        calls.push({ method, params });
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "eth_sendTransaction") return `0x${"ab".repeat(32)}`;
        throw new Error(`Unexpected wallet method: ${method}`);
      },
    } as EIP1193Provider;
    const client = createFundingWalletClient(provider);
    expect(client.chain.id).toBe(CCTP_ROUTE.sourceChainId);
    const account = "0x9876543210987654321098765432109876543210";
    const { approval, burn } = buildCctpTransactions({
      recipient: "0x1234567890123456789012345678901234567890",
      quote: { ...quote, expiresAt: Date.now() + 60_000 },
    });
    await client.sendTransaction({ account, ...approval, value: 0n });
    await client.sendTransaction({ account, ...burn, value: 0n, nonce: 4 });
    const sends = calls.filter((call) => call.method === "eth_sendTransaction");
    expect(sends).toHaveLength(2);
    expect(sends[1]?.params).toEqual([
      expect.objectContaining({ to: burn.to, data: burn.data, nonce: "0x4", value: "0x0" }),
    ]);
  });

  it("rejects expired and inconsistent fee quotes", () => {
    expect(() => assertValidCctpQuote({ ...quote, expiresAt: Date.now() - 1 }, "1")).toThrow(
      "expired",
    );
    expect(() => assertValidCctpQuote({ ...quote, maxFeeBaseUnits: "1001" }, "1")).toThrow(
      "Malformed CCTP quote amounts",
    );
  });

  it("keeps the reviewed cap for a lower fee and refuses a higher or expired quote", () => {
    expect(
      canUseOriginalQuoteForBurn(quote, {
        ...quote,
        expiresAt: Date.now() + 120_000,
        maxFeeBaseUnits: "999",
        minimumReceivedBaseUnits: "999001",
      }),
    ).toBe(true);
    expect(
      canUseOriginalQuoteForBurn(quote, {
        ...quote,
        expiresAt: Date.now() + 120_000,
        maxFeeBaseUnits: "1001",
        minimumReceivedBaseUnits: "998999",
      }),
    ).toBe(false);
    expect(canUseOriginalQuoteForBurn({ ...quote, expiresAt: Date.now() - 1 }, quote)).toBe(false);
  });

  it("maps only verified terminal stages to terminal UI states", () => {
    expect(fundingStateForStage("completed")).toBe("COMPLETED");
    expect(fundingStateForStage("source_failed")).toBe("SOURCE_FAILED");
    expect(fundingStateForStage("forwarding")).toBe("POLLING_STATUS");
  });

  it("rejects malformed status hashes instead of fabricating completion", () => {
    expect(() =>
      assertValidCctpStatus(
        { burnTxHash: "0x1234", stage: "completed" },
        `0x${"a".repeat(64)}`,
        "0x0000000000000000000000000000000000000001",
      ),
    ).toThrow("Malformed CCTP status response");
  });

  it("rejects a malformed Circle forwarding state", () => {
    const burnHash = `0x${"a".repeat(64)}` as `0x${string}`;
    expect(() =>
      assertValidCctpStatus(
        { burnTxHash: burnHash, forwardState: 1, stage: "forwarding" },
        burnHash,
        "0x0000000000000000000000000000000000000001",
      ),
    ).toThrow("Malformed CCTP forwarding state");
  });

  it("rejects imported pending burns and a burn from another sender", () => {
    const burnHash = `0x${"a".repeat(64)}` as `0x${string}`;
    expect(() =>
      assertImportableCctpStatus({
        burnTxHash: burnHash,
        stage: "source_pending",
      }),
    ).toThrow("not yet a confirmed");
    expect(() =>
      assertValidCctpStatus(
        {
          burnTxHash: burnHash,
          sender: "0x0000000000000000000000000000000000000002",
          stage: "attestation_pending",
        },
        burnHash,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000003",
      ),
    ).toThrow("different connected wallet");
  });

  it("requires the saved nonce, terms, and block anchor before resolving a marker", () => {
    const confirmed = {
      amountBaseUnits: "1000000",
      burnTxHash: `0x${"a".repeat(64)}`,
      maxFeeBaseUnits: "1000",
      recipient: "0x0000000000000000000000000000000000000001",
      sender: "0x0000000000000000000000000000000000000002",
      sourceBlockNumber: "125",
      sourceNonce: 7,
      stage: "attestation_pending",
    } as unknown as import("@/lib/cctp").CctpStatus;
    const intent = fundingIntentFromStatus(confirmed);
    expect(burnNonceForIntent(intent)).toBe(7);
    expect(() =>
      assertStatusMatchesFundingIntent(
        confirmed,
        { ...intent, sourceNonce: 6 },
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ),
    ).toThrow("does not match");
    expect(() =>
      assertStatusMatchesFundingIntent(
        confirmed,
        intent,
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ),
    ).not.toThrow();
    expect(() =>
      assertImportableCctpStatus({ ...confirmed, stage: "source_failed" }),
    ).not.toThrow();
  });

  it("requires a successful approval receipt and the connected account", () => {
    expect(() => assertSuccessfulApprovalReceipt({ status: "reverted" })).toThrow(
      "approval reverted",
    );
    expect(() =>
      assertSelectedFundingAccount(
        ["0x0000000000000000000000000000000000000001"],
        "0x0000000000000000000000000000000000000002",
      ),
    ).toThrow("selected connector");
  });
});
