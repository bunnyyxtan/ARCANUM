import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Address, type Hash, type LocalAccount, keccak256 } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CctpStatus } from "../../packages/sdk/src/cctp";
import {
  MANUAL_RELAY_BURN_HASH,
  MANUAL_RELAY_GAS_CAP_WEI,
  MANUAL_RELAY_RECIPIENT,
  MANUAL_RELAY_SENDER,
  runManualRelay,
  validateManualRelayIntent,
} from "./cctp-relay";
import { readCctpRelayJournal } from "./cctp-relay-state";
import {
  type CctpFundingState,
  acquireCctpLock,
  readCctpPendingMarker,
  readCctpState,
  writeCctpState,
} from "./cctp-state";

const SOURCE_NONCE = 17;
const SOURCE_BLOCK = "500";
const AMOUNT = "5000000";
const MAX_FEE = "100";
const SIGNED_RAW = "0x1234" as const;
const MINT_HASH = keccak256(SIGNED_RAW);

function state(directory: string, overrides: Partial<CctpFundingState> = {}): CctpFundingState {
  const value: CctpFundingState = {
    version: 1,
    recipient: MANUAL_RELAY_RECIPIENT,
    sender: MANUAL_RELAY_SENDER,
    sourceChainId: 11155111,
    destinationChainId: 5042002,
    amountBaseUnits: AMOUNT,
    maxFeeBaseUnits: MAX_FEE,
    minimumReceivedBaseUnits: "4999900",
    quoteExpiresAt: Date.now() + 60_000,
    phase: "source_pending",
    burnTxHash: MANUAL_RELAY_BURN_HASH,
    sourceNonce: SOURCE_NONCE,
    sourceBlockNumber: SOURCE_BLOCK,
    pollCount: 0,
    updatedAt: Date.now(),
    ...overrides,
  };
  writeCctpState(value, directory);
  return value;
}

function status(stage: CctpStatus["stage"], overrides: Partial<CctpStatus> = {}): CctpStatus {
  return {
    stage,
    burnTxHash: MANUAL_RELAY_BURN_HASH,
    sender: MANUAL_RELAY_SENDER,
    recipient: MANUAL_RELAY_RECIPIENT,
    amountBaseUnits: AMOUNT,
    maxFeeBaseUnits: MAX_FEE,
    sourceNonce: SOURCE_NONCE,
    sourceBlockNumber: SOURCE_BLOCK,
    ...overrides,
  };
}

function account(signTransaction: () => Promise<`0x${string}`>): LocalAccount {
  return {
    address: MANUAL_RELAY_SENDER,
    type: "local",
    signTransaction,
  } as unknown as LocalAccount;
}

function destination(overrides: Record<string, unknown> = {}) {
  return {
    getChainId: vi.fn(async () => 5042002),
    call: vi.fn(async () => ({ data: "0x" })),
    estimateGas: vi.fn(async () => 100_000n),
    getTransactionCount: vi.fn(async () => 1),
    estimateFeesPerGas: vi.fn(async () => ({
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 100_000_000n,
    })),
    sendRawTransaction: vi.fn(async () => MINT_HASH),
    ...overrides,
  };
}

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), "cctp-relay-"));
  state(directory);
  acquireCctpLock({ recipient: MANUAL_RELAY_RECIPIENT, sourceChainId: 11155111 }, directory, {
    sender: MANUAL_RELAY_SENDER,
    recipient: MANUAL_RELAY_RECIPIENT,
    amountBaseUnits: AMOUNT,
    maxFeeBaseUnits: MAX_FEE,
    sourceNonce: SOURCE_NONCE,
    sourceBlockNumber: SOURCE_BLOCK,
  });
  process.env.GUARDED_WALLET = MANUAL_RELAY_RECIPIENT;
  return directory;
}

const irisFetch = async () =>
  new Response(
    JSON.stringify({
      sourceTxHash: MANUAL_RELAY_BURN_HASH,
      messages: [{ status: "complete", message: "0x1234", attestation: "0x5678" }],
    }),
    { headers: { "content-type": "application/json" } },
  );

afterEach(() => {
  process.env.GUARDED_WALLET = undefined;
});

describe("manual CCTP relay guards", () => {
  it("rejects a cap breach before signing or broadcasting", async () => {
    const directory = createFixture();
    const sign = vi.fn(async () => SIGNED_RAW);
    const send = vi.fn(async () => MINT_HASH);
    const client = destination({
      estimateGas: vi.fn(async () => MANUAL_RELAY_GAS_CAP_WEI),
      sendRawTransaction: send,
    });
    const statusFn = vi.fn(async (_input, options) => {
      await options.fetchFn?.("https://iris.test");
      return status("forwarding");
    });
    await expect(
      runManualRelay(MANUAL_RELAY_BURN_HASH, true, {
        directory,
        account: account(sign),
        destinationClient: client as never,
        sourceClient: {} as never,
        statusFn,
        fetchFn: irisFetch,
      }),
    ).rejects.toThrow(/gas cap/);
    expect(sign).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(
      readCctpRelayJournal(
        { recipient: MANUAL_RELAY_RECIPIENT, sourceChainId: 11155111 },
        MANUAL_RELAY_BURN_HASH,
        directory,
      ),
    ).toBeUndefined();
    rmSync(directory, { recursive: true, force: true });
  });

  it("rejects an invalid source identity without entering the relay path", () => {
    const invalidState = {
      ...state(mkdtempSync(join(tmpdir(), "cctp-relay-invalid-"))),
      sender: "0x1111111111111111111111111111111111111111" as Address,
    };
    const marker = {
      version: 1 as const,
      recipient: MANUAL_RELAY_RECIPIENT,
      sourceChainId: 11155111,
      createdAt: Date.now(),
      intent: {
        sender: MANUAL_RELAY_SENDER,
        recipient: MANUAL_RELAY_RECIPIENT,
        amountBaseUnits: AMOUNT,
        maxFeeBaseUnits: MAX_FEE,
        sourceNonce: SOURCE_NONCE,
        sourceBlockNumber: SOURCE_BLOCK,
      },
    };
    expect(() =>
      validateManualRelayIntent(
        MANUAL_RELAY_BURN_HASH,
        invalidState,
        marker,
        status("forwarding"),
        MANUAL_RELAY_SENDER,
      ),
    ).toThrow(/same source intent|approved source sender/);
  });

  it("persists a signed hash before an ambiguous broadcast and never resends", async () => {
    const directory = createFixture();
    const sign = vi.fn(async () => SIGNED_RAW);
    const send = vi.fn(async () => {
      throw new Error("transport timeout after submission");
    });
    const client = destination({ sendRawTransaction: send });
    const statusFn = vi.fn(async (_input, options) => {
      await options.fetchFn?.("https://iris.test");
      return status("forwarding");
    });
    const dependencies = {
      directory,
      account: account(sign),
      destinationClient: client as never,
      sourceClient: {} as never,
      statusFn,
      fetchFn: irisFetch,
    };
    await expect(runManualRelay(MANUAL_RELAY_BURN_HASH, true, dependencies)).rejects.toThrow(
      /ambiguous/,
    );
    const journal = readCctpRelayJournal(
      { recipient: MANUAL_RELAY_RECIPIENT, sourceChainId: 11155111 },
      MANUAL_RELAY_BURN_HASH,
      directory,
    );
    expect(journal?.phase).toBe("ambiguous");
    expect(journal?.mintTxHash).toBe(MINT_HASH);
    await runManualRelay(MANUAL_RELAY_BURN_HASH, true, dependencies);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    rmSync(directory, { recursive: true, force: true });
  });

  it("clears the source guard only after a real completed status proof", async () => {
    const directory = createFixture();
    const sign = vi.fn(async () => SIGNED_RAW);
    const client = destination();
    const statusFn = vi.fn(async (input: { mintTxHash?: Hash }, options) => {
      if (input.mintTxHash) return status("completed", { mintTxHash: MINT_HASH });
      await options.fetchFn?.("https://iris.test");
      return status("forwarding");
    });
    await runManualRelay(MANUAL_RELAY_BURN_HASH, true, {
      directory,
      account: account(sign),
      destinationClient: client as never,
      sourceClient: {} as never,
      statusFn,
      fetchFn: irisFetch,
    });
    expect(
      readCctpPendingMarker(
        { recipient: MANUAL_RELAY_RECIPIENT, sourceChainId: 11155111 },
        directory,
      ),
    ).toBeUndefined();
    expect(
      readCctpState({ recipient: MANUAL_RELAY_RECIPIENT, sourceChainId: 11155111 }, directory)
        ?.mintTxHash,
    ).toBe(MINT_HASH);
    expect(sign).toHaveBeenCalledTimes(1);
    await runManualRelay(MANUAL_RELAY_BURN_HASH, true, {
      directory,
      account: account(sign),
      destinationClient: client as never,
      sourceClient: {} as never,
      statusFn,
    });
    expect(sign).toHaveBeenCalledTimes(1);
    expect(client.sendRawTransaction).toHaveBeenCalledTimes(1);
    rmSync(directory, { recursive: true, force: true });
  });
});
