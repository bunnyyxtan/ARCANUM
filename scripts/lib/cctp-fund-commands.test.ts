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
