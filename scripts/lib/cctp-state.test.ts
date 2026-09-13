import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type CctpBurnIntent,
  type CctpFundingState,
  acquireCctpLock,
  acquireCctpSigningLock,
  archiveCctpState,
  bindCctpPendingMarker,
  cctpPendingPath,
  cctpStatePath,
  clearCctpPendingMarker,
  hasCctpPendingMarker,
  isCctpTerminalPhase,
  isCctpUnresolvedPhase,
  readCctpPendingMarker,
  readCctpState,
  updateCctpState,
  writeCctpState,
} from "./cctp-state";

const RECIPIENT = "0x1234567890123456789012345678901234567890" as const;
const IDENTITY = { recipient: RECIPIENT, sourceChainId: 11155111 };
const HASH = `0x${"ab".repeat(32)}` as const;
const INTENT: CctpBurnIntent = {
  sender: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  recipient: RECIPIENT,
  amountBaseUnits: "1000000",
  maxFeeBaseUnits: "100",
};

const directories: string[] = [];

function directory(): string {
  const value = mkdtempSync(join(tmpdir(), "arcanum-cctp-state-"));
  directories.push(value);
  return value;
}

function state(): CctpFundingState {
  return {
    version: 1,
    recipient: RECIPIENT,
    sourceChainId: 11155111,
    destinationChainId: 5042002,
    amountBaseUnits: "1000000",
    maxFeeBaseUnits: "0",
    minimumReceivedBaseUnits: "1000000",
    quoteExpiresAt: Date.now() + 120_000,
    phase: "prepared",
    pollCount: 0,
    updatedAt: Date.now(),
  };
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("CCTP durable state", () => {
  it("writes private state atomically and keeps hashes but no transaction bytes", () => {
    const root = directory();
    writeCctpState(state(), root);

    const path = cctpStatePath(IDENTITY, root);
    expect(readCctpState(IDENTITY, root)?.phase).toBe("prepared");
    expect(readFileSync(path, "utf8")).not.toContain("private");
    expect(readFileSync(path, "utf8")).not.toContain('"data"');
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("creates an exclusive marker before a run and never stale-cleans it", () => {
    const root = directory();
    const lock = acquireCctpLock(IDENTITY, root);
    expect(hasCctpPendingMarker(IDENTITY, root)).toBe(true);
    expect(() => acquireCctpLock(IDENTITY, root)).toThrow(/unresolved CCTP run/);
    expect(() => readFileSync(cctpPendingPath(IDENTITY, root), "utf8")).not.toThrow();

    lock.release();
    expect(hasCctpPendingMarker(IDENTITY, root)).toBe(false);
  });

  it("serializes one funder across different recipient runs", () => {
    const root = directory();
    const first = acquireCctpSigningLock(INTENT.sender, IDENTITY.sourceChainId, root);
    expect(() => acquireCctpSigningLock(INTENT.sender, IDENTITY.sourceChainId, root)).toThrow(
      /signing lock already exists/,
    );
    first.release();

    const second = acquireCctpSigningLock(INTENT.sender, IDENTITY.sourceChainId, root);
    second.release();
  });

  it("preserves progress and source errors across atomic updates", () => {
    const root = directory();
    writeCctpState(state(), root);
    updateCctpState(
      IDENTITY,
      {
        phase: "source_failed",
        burnTxHash: HASH,
        sourceError: "source receipt reverted",
        pollCount: 2,
      },
      root,
    );

    const saved = readCctpState(IDENTITY, root);
    expect(saved?.burnTxHash).toBe(HASH);
    expect(saved?.sourceError).toBe("source receipt reverted");
    expect(saved?.pollCount).toBe(2);
    expect(isCctpTerminalPhase(saved?.phase ?? "prepared")).toBe(true);
  });

  it("keeps nonce-drift safety failures unresolved so a second start cannot archive them", () => {
    const root = directory();
    writeCctpState({ ...state(), phase: "safety_failed" }, root);
    expect(isCctpTerminalPhase("safety_failed")).toBe(false);
    expect(isCctpTerminalPhase("approval_failed")).toBe(false);
    expect(isCctpTerminalPhase("quote_expired")).toBe(false);
    expect(isCctpUnresolvedPhase("safety_failed")).toBe(true);
    expect(readCctpState(IDENTITY, root)?.phase).toBe("safety_failed");
  });

  it("persists approval and planned burn nonces for bare and max-fee-only reservations", () => {
    const root = directory();
    const bare = {
      ...state(),
      safety: { approvalNonce: 7, burnNonce: 8 },
    };
    writeCctpState(bare, root);
    expect(readCctpState(IDENTITY, root)?.safety).toMatchObject({
      approvalNonce: 7,
      burnNonce: 8,
    });

    const maxFeeOnly = {
      ...bare,
      safety: { maxFeeBaseUnits: "100000", approvalNonce: 9, burnNonce: 10 },
    };
    writeCctpState(maxFeeOnly, root);
    expect(readCctpState(IDENTITY, root)?.safety).toMatchObject({
      maxFeeBaseUnits: "100000",
      approvalNonce: 9,
      burnNonce: 10,
    });
  });

  it("archives a terminal record before an explicit new run", () => {
    const root = directory();
    writeCctpState({ ...state(), phase: "completed", burnTxHash: HASH }, root);
    const archived = archiveCctpState(IDENTITY, root);

    expect(archived).toBeDefined();
    expect(readCctpState(IDENTITY, root)).toBeUndefined();
    expect(readFileSync(archived ?? "", "utf8")).toContain(HASH);
  });

  it("can clear a marker only when the caller has verified a terminal outcome", () => {
    const root = directory();
    const lock = acquireCctpLock(IDENTITY, root);
    lock.release();
    const second = acquireCctpLock(IDENTITY, root);
    clearCctpPendingMarker(IDENTITY, root);
    expect(hasCctpPendingMarker(IDENTITY, root)).toBe(false);
    second.release();
  });

  it("binds the exact source nonce/block anchor and rejects repurposing it", () => {
    const root = directory();
    const lock = acquireCctpLock(IDENTITY, root, INTENT);
    const bound = bindCctpPendingMarker(
      IDENTITY,
      { ...INTENT, sourceNonce: 7, sourceBlockNumber: "100" },
      root,
    );

    expect(bound.intent?.sourceNonce).toBe(7);
    expect(bound.intent?.sourceBlockNumber).toBe("100");
    expect(() =>
      bindCctpPendingMarker(
        IDENTITY,
        { ...INTENT, sourceNonce: 8, sourceBlockNumber: "100" },
        root,
      ),
    ).toThrow(/source nonce/);
    expect(readCctpPendingMarker(IDENTITY, root)?.intent?.sourceBlockNumber).toBe("100");
    lock.release();
  });

  it("fails closed when a legacy marker has no identity", () => {
    const root = directory();
    const lock = acquireCctpLock(IDENTITY, root);
    expect(() =>
      bindCctpPendingMarker(
        IDENTITY,
        { ...INTENT, sourceNonce: 7, sourceBlockNumber: "100" },
        root,
      ),
    ).toThrow(/legacy/);
    lock.release();
  });
});
