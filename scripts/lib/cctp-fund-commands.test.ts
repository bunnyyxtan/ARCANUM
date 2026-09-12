import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { assertTerminalArchiveSafe, assertTerminalStateProofSafe } from "./cctp-fund-commands";
import {
  type CctpBurnIntent,
  type CctpFundingState,
  acquireCctpLock,
  clearCctpPendingMarker,
  readCctpState,
  refreshCctpPendingMarkerQuote,
  writeCctpState,
} from "./cctp-state";

const RECIPIENT = "0x1234567890123456789012345678901234567890" as const;
const SENDER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const BURN_HASH = `0x${"ab".repeat(32)}` as const;
const IDENTITY = { recipient: RECIPIENT, sourceChainId: 11155111 };

const oldIntent: CctpBurnIntent = {
  sender: SENDER,
  recipient: RECIPIENT,
  amountBaseUnits: "5000000",
  maxFeeBaseUnits: "100",
  sourceNonce: 7,
  sourceBlockNumber: "100",
};

function terminalState(): CctpFundingState {
  return {
    version: 1,
    recipient: RECIPIENT,
    sender: SENDER,
    sourceChainId: 11155111,
    destinationChainId: 5042002,
    amountBaseUnits: oldIntent.amountBaseUnits,
    maxFeeBaseUnits: oldIntent.maxFeeBaseUnits,
    minimumReceivedBaseUnits: "4999900",
    quoteExpiresAt: Date.now() + 120_000,
    phase: "completed",
    burnTxHash: BURN_HASH,
    sourceNonce: oldIntent.sourceNonce,
    sourceBlockNumber: oldIntent.sourceBlockNumber,
    sourceProofVerified: true,
    pollCount: 1,
    updatedAt: Date.now(),
  };
}

const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "arcanum-cctp-command-"));
  roots.push(value);
  return value;
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("CCTP terminal restart guards", () => {
  it("allows a fresh changed-fee quote after the verified old marker is cleared", () => {
    const directory = root();
    writeCctpState(terminalState(), directory);
    const oldLock = acquireCctpLock(IDENTITY, directory, oldIntent);

    expect(() => assertTerminalArchiveSafe(IDENTITY, terminalState(), directory)).not.toThrow();
    oldLock.release();

    const freshIntent = { ...oldIntent, maxFeeBaseUnits: "200" };
    const freshLock = acquireCctpLock(IDENTITY, directory, freshIntent);
    expect(() => assertTerminalStateProofSafe(terminalState())).not.toThrow();
    freshLock.release();
    clearCctpPendingMarker(IDENTITY, directory);
  });

  it("rejects an unrelated old marker before a new lock can be owned", () => {
    const directory = root();
    writeCctpState(terminalState(), directory);
    const unrelated = acquireCctpLock(IDENTITY, directory, {
      ...oldIntent,
      maxFeeBaseUnits: "999",
    });

    expect(() => assertTerminalArchiveSafe(IDENTITY, terminalState(), directory)).toThrow(
      /does not match the archived intent/,
    );
    unrelated.release();
  });
});

describe("CCTP capped-run persistence guards", () => {
  it("retains cap observations and permits pre-nonce quote refresh", () => {
    const directory = root();
    const state = {
      ...terminalState(),
      phase: "safety_failed" as const,
      burnTxHash: undefined,
      sourceNonce: undefined,
      sourceBlockNumber: undefined,
      sourceProofVerified: undefined,
      safety: {
        maxFeeBaseUnits: "100000",
        maxSourceGasWei: "1000000000000000",
        initialQuoteMaxFeeBaseUnits: "18704",
        approvalNonce: 12,
        burnNonce: 13,
        approvalMaxCostWei: "100000000000000",
        burnGasCeiling: "200000",
        approvalGasLimit: "50000",
        burnGasLimit: "150000",
        approvalMaxFeePerGasWei: "2000000000",
        burnMaxFeePerGasWei: "2000000000",
        combinedMaxGasWei: "400000000000000",
      },
    };
    writeCctpState(state, directory);
    const lock = acquireCctpLock(IDENTITY, directory, {
      ...oldIntent,
      maxFeeBaseUnits: "18704",
      sourceNonce: undefined,
      sourceBlockNumber: undefined,
    });

    refreshCctpPendingMarkerQuote(IDENTITY, "25000", directory);
    expect(readCctpState(IDENTITY, directory)?.safety?.maxSourceGasWei).toBe("1000000000000000");
    expect(readCctpState(IDENTITY, directory)?.safety?.burnGasCeiling).toBe("200000");
    expect(() => refreshCctpPendingMarkerQuote(IDENTITY, "30000", directory)).not.toThrow();

    lock.release();
    clearCctpPendingMarker(IDENTITY, directory);
  });

  it("refuses a quote refresh after the burn nonce is bound", () => {
    const directory = root();
    writeCctpState(terminalState(), directory);
    const lock = acquireCctpLock(IDENTITY, directory, oldIntent);
    expect(() => refreshCctpPendingMarkerQuote(IDENTITY, "200", directory)).toThrow(
      "source nonce has been bound",
    );
    lock.release();
  });
});
