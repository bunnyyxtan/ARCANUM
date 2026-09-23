import { afterEach, describe, expect, it, vi } from "vitest";

import type { CctpStatus } from "../../packages/sdk/src/cctp";
import {
  type CctpRecoveryCheck,
  type CctpSourceIdentity,
  formatQuoteExpiry,
  isQuoteExpired,
  printQuote,
  validateCctpRecovery,
} from "./cctp-fund-io";
import type { CctpFundingState, CctpPendingMarker } from "./cctp-state";

const RECIPIENT = "0x1234567890123456789012345678901234567890" as const;
const SENDER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const BURN_HASH = `0x${"ab".repeat(32)}` as const;

const INTENT: CctpSourceIdentity = {
  sender: SENDER,
  recipient: RECIPIENT,
  amountBaseUnits: "1000000",
  maxFeeBaseUnits: "100",
  sourceNonce: 7,
  sourceBlockNumber: "100",
};

function recoveryState(overrides: Partial<CctpFundingState> = {}): CctpFundingState {
  return {
    version: 1,
    recipient: RECIPIENT,
    sender: SENDER,
    sourceChainId: 11155111,
    destinationChainId: 5042002,
    amountBaseUnits: INTENT.amountBaseUnits,
    maxFeeBaseUnits: INTENT.maxFeeBaseUnits,
    minimumReceivedBaseUnits: "999900",
    quoteExpiresAt: Date.now() + 120_000,
    phase: "source_pending",
    burnTxHash: BURN_HASH,
    sourceNonce: INTENT.sourceNonce,
    sourceBlockNumber: INTENT.sourceBlockNumber,
    pollCount: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function recoveryMarker(overrides: Partial<CctpPendingMarker> = {}): CctpPendingMarker {
  return {
    version: 1,
    recipient: RECIPIENT,
    sourceChainId: 11155111,
    createdAt: Date.now(),
    intent: { ...INTENT },
    ...overrides,
  };
}

function recoveryStatus(
  stage: CctpStatus["stage"],
  overrides: Partial<CctpSourceIdentity> = {},
): CctpStatus {
  return {
    stage,
    burnTxHash: BURN_HASH,
    ...INTENT,
    ...overrides,
  } as CctpStatus;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CCTP CLI quote expiry", () => {
  it("treats expiresAt as milliseconds, not seconds", () => {
    const expiresAt = 1_700_000_000_000;
    expect(formatQuoteExpiry(expiresAt)).toBe("2023-11-14T22:13:20.000Z");
    expect(formatQuoteExpiry(expiresAt)).not.toContain("586");

    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    printQuote({
      amountBaseUnits: "1000000",
      maxFeeBaseUnits: "1",
      minimumReceivedBaseUnits: "999999",
      expiresAt,
    });
    expect(output).toHaveBeenCalledWith("expires     2023-11-14T22:13:20.000Z");
    output.mockRestore();
  });

  it("uses the millisecond timestamp for the pre-burn expiry guard", () => {
    vi.setSystemTime(new Date(1_700_000_000_000 - 1));
    expect(isQuoteExpired(1_700_000_000_000)).toBe(false);
    vi.setSystemTime(new Date(1_700_000_000_000));
    expect(isQuoteExpired(1_700_000_000_000)).toBe(true);
  });

  it("does not adopt an old same-sender/recipient/amount burn with a different nonce or block", () => {
    const marker = recoveryMarker();
    const nonceMismatch = validateCctpRecovery(
      recoveryState(),
      marker,
      BURN_HASH,
      recoveryStatus("completed", { sourceNonce: 8 }),
    );
    const blockMismatch = validateCctpRecovery(
      recoveryState(),
      marker,
      BURN_HASH,
      recoveryStatus("completed", { sourceBlockNumber: "99" }),
    );

    expect(nonceMismatch.linked).toBe(false);
    expect(nonceMismatch.terminalVerified).toBe(false);
    expect(blockMismatch.linked).toBe(false);
    expect(blockMismatch.terminalVerified).toBe(false);
  });

  it("accepts exact identity proof for both resolved and reverted source outcomes", () => {
    for (const stage of ["completed", "source_failed"] as const) {
      const result = validateCctpRecovery(
        recoveryState(),
        recoveryMarker(),
        BURN_HASH,
        recoveryStatus(stage),
      );
      expect(result).toEqual<CctpRecoveryCheck>({
        linked: true,
        terminalVerified: true,
        pendingWithoutProof: false,
      });
    }
  });

  it("accepts a confirmed source block at or after the prepared anchor", () => {
    const result = validateCctpRecovery(
      recoveryState(),
      recoveryMarker(),
      BURN_HASH,
      recoveryStatus("completed", { sourceBlockNumber: "101" }),
    );

    expect(result.linked).toBe(true);
    expect(result.terminalVerified).toBe(true);
  });

  it("updates a known-hash run without a pending marker when confirmed status identity matches", () => {
    const result = validateCctpRecovery(
      recoveryState(),
      undefined,
      BURN_HASH,
      recoveryStatus("attestation_pending"),
    );

    expect(result.linked).toBe(true);
    expect(result.terminalVerified).toBe(false);
    expect(result.pendingWithoutProof).toBe(false);
  });

  it("refuses unresolved records without a hash and legacy markers without identity", () => {
    const noHash = validateCctpRecovery(
      recoveryState({ burnTxHash: undefined }),
      recoveryMarker(),
      BURN_HASH,
      recoveryStatus("completed"),
    );
    const legacyMarker = validateCctpRecovery(
      recoveryState(),
      { ...recoveryMarker(), intent: undefined },
      BURN_HASH,
      recoveryStatus("completed"),
    );

    expect(noHash.linked).toBe(false);
    expect(noHash.reason).toMatch(/refusing to adopt/);
    expect(legacyMarker.linked).toBe(false);
    expect(legacyMarker.reason).toMatch(/legacy marker/);
  });
});
