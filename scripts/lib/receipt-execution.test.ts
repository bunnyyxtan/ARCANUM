import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionRecoveryError, TransferRevertedError } from "../../packages/sdk/src/errors";
import type { ExecuteUSDCInput, ExecuteUSDCOptions } from "../../packages/sdk/src/types";
import {
  assertReceiptExecutionAvailable,
  executeReceiptJournaled,
  readReceiptExecution,
  recoverReceiptExecution,
  requestedReceiptReference,
} from "./receipt-execution";

// Only the pure orchestration module is imported. Never import/run the CLI main,
// construct a wallet/RPC client, sign, or make network requests in these tests.
const walletAddress = "0x1000000000000000000000000000000000000001";
const to = "0x2000000000000000000000000000000000000002";
const txHash = `0x${"12".repeat(32)}` as const;
const receiptId = "8d2b4d6e-1e5a-4b7f-9c1d-0a2b3c4d5e6f";
const identity = { chainId: 5042002, walletAddress, reference: "invoice-123" } as const;
const input: ExecuteUSDCInput = {
  to,
  amount: 12_500_000n,
  reason: "invoice",
  metadata: { reference: identity.reference, receiptId, tokenSymbol: "USDC" },
};
const directories: string[] = [];

function directory() {
  const path = mkdtempSync(join(tmpdir(), "arcanum-receipt-execution-"));
  directories.push(path);
  return path;
}

async function submitted(options?: ExecuteUSDCOptions) {
  await options?.onSubmitted?.({ txHash, walletAddress, chainId: identity.chainId, input });
}

async function uncertain(path: string) {
  const executeUSDC = vi.fn(async (_input: ExecuteUSDCInput, options?: ExecuteUSDCOptions) => {
    await submitted(options);
    throw new TransactionRecoveryError(txHash, "CONFIRMATION_UNAVAILABLE", "Timeout");
  });
  await expect(
    executeReceiptJournaled({ executeUSDC }, identity, receiptId, input, path),
  ).rejects.toMatchObject({ txHash, code: "CONFIRMATION_UNAVAILABLE" });
  return executeUSDC;
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("receipt CLI durable execution guard (offline)", () => {
  it("requires an explicit stable execution reference, never a timestamp fallback", () => {
    expect(() => requestedReceiptReference(["--execute"], true)).toThrow("--reference");
    expect(requestedReceiptReference(["--reference", "invoice-123"], true)).toBe("invoice-123");
    expect(requestedReceiptReference([], false)).toBeUndefined();
    expect(() => requestedReceiptReference(["--reference", "--execute"], true)).toThrow();
    expect(() =>
      requestedReceiptReference(["--reference", "a", "--reference", "b"], true),
    ).toThrow();
  });

  it("durably records prepared terms before submit, hash before waiting, and resolved outcome", async () => {
    const path = directory();
    const executeUSDC = vi.fn(async (_input: ExecuteUSDCInput, options?: ExecuteUSDCOptions) => {
      expect(readReceiptExecution(identity, path).phase).toBe("prepared");
      await submitted(options);
      // This models the point at which SDK confirmation would begin.
      expect(readReceiptExecution(identity, path)).toMatchObject({
        phase: "submitted",
        txHash,
        input: { amount: "12500000" },
      });
      return { verdict: "ALLOW" as const, reason: "NONE", txHash };
    });
    await expect(
      executeReceiptJournaled({ executeUSDC }, identity, receiptId, input, path),
    ).resolves.toMatchObject({ verdict: "ALLOW", txHash });
    expect(readReceiptExecution(identity, path).phase).toBe("resolved");
    const files = readdirSync(path);
    expect(files).toHaveLength(1);
    const file = files[0];
    if (!file) throw new Error("Missing execution journal");
    expect(statSync(join(path, file)).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(path, file), "utf8")).toContain('"amount": "12500000"');
    expect(executeUSDC).toHaveBeenCalledTimes(1);
    expect(() => assertReceiptExecutionAvailable(identity, path)).toThrow("already has");
  });

  it("blocks both the same reference and a new reference after a submitted timeout", async () => {
    const path = directory();
    const executeUSDC = await uncertain(path);
    for (const reference of [identity.reference, "fresh-reference"]) {
      const next = { ...identity, reference };
      expect(() => assertReceiptExecutionAvailable(next, path)).toThrow("unresolved");
      await expect(
        executeReceiptJournaled(
          { executeUSDC },
          next,
          receiptId,
          { ...input, metadata: { ...input.metadata, reference } },
          path,
        ),
      ).rejects.toThrow("unresolved");
    }
    expect(executeUSDC).toHaveBeenCalledTimes(1);
    expect(readReceiptExecution(identity, path)).toMatchObject({ phase: "submitted", txHash });
  });

  it("recovers only the persisted hash/input without a signing interface; original stays blocked", async () => {
    const path = directory();
    const executeUSDC = await uncertain(path);
    const reconcileUSDC = vi.fn().mockResolvedValue({
      verdict: "ESCALATE",
      txHash,
      escalationId: `0x${"34".repeat(32)}`,
    });
    const result = await recoverReceiptExecution({ reconcileUSDC }, identity, path);
    expect(result.verdict).toBe("ESCALATE");
    expect(reconcileUSDC).toHaveBeenCalledExactlyOnceWith(txHash, input);
    expect(readReceiptExecution(identity, path)).toMatchObject({
      phase: "resolved",
      txHash,
      outcome: { verdict: "ESCALATE" },
    });
    expect(executeUSDC).toHaveBeenCalledTimes(1);
    expect(() => assertReceiptExecutionAvailable(identity, path)).toThrow("already has");
    // A genuinely new payment is possible only after the previous outcome is resolved.
    expect(() =>
      assertReceiptExecutionAvailable({ ...identity, reference: "next-invoice" }, path),
    ).not.toThrow();
  });

  it("failed recovery keeps the blocking marker and hash", async () => {
    const path = directory();
    await uncertain(path);
    const reconcileUSDC = vi
      .fn()
      .mockRejectedValue(new TransactionRecoveryError(txHash, "OUTCOME_MISSING", "Missing event"));
    await expect(recoverReceiptExecution({ reconcileUSDC }, identity, path)).rejects.toMatchObject({
      txHash,
      code: "OUTCOME_MISSING",
    });
    expect(() => assertReceiptExecutionAvailable({ ...identity, reference: "new" }, path)).toThrow(
      "unresolved",
    );
  });

  it("records a definitive reverted same-hash recovery without resubmitting", async () => {
    const path = directory();
    await uncertain(path);
    const reconcileUSDC = vi.fn().mockRejectedValue(new TransferRevertedError(txHash));
    await expect(recoverReceiptExecution({ reconcileUSDC }, identity, path)).rejects.toMatchObject({
      txHash,
      code: "TRANSFER_REVERTED",
    });
    expect(readReceiptExecution(identity, path)).toMatchObject({ phase: "reverted", txHash });
    expect(() => assertReceiptExecutionAvailable(identity, path)).toThrow("already has");
    expect(reconcileUSDC).toHaveBeenCalledTimes(1);
  });

  it("fails closed when submission errors before returning a hash", async () => {
    const path = directory();
    const executeUSDC = vi.fn().mockRejectedValue(new Error("signer connection lost"));
    await expect(
      executeReceiptJournaled({ executeUSDC }, identity, receiptId, input, path),
    ).rejects.toThrow("signer connection lost");
    expect(readReceiptExecution(identity, path).phase).toBe("prepared");
    const reconcileUSDC = vi.fn();
    await expect(recoverReceiptExecution({ reconcileUSDC }, identity, path)).rejects.toThrow(
      "No submitted hash",
    );
    expect(reconcileUSDC).not.toHaveBeenCalled();
    expect(() => assertReceiptExecutionAvailable({ ...identity, reference: "new" }, path)).toThrow(
      "unresolved",
    );
  });

  it("records known preflight denial without a hash and still blocks reference reuse", async () => {
    const path = directory();
    const executeUSDC = vi.fn().mockResolvedValue({ verdict: "DENY" });
    await executeReceiptJournaled({ executeUSDC }, identity, receiptId, input, path);
    expect(readReceiptExecution(identity, path).phase).toBe("not_submitted");
    expect(() => assertReceiptExecutionAvailable(identity, path)).toThrow("already has");
    expect(() =>
      assertReceiptExecutionAvailable({ ...identity, reference: "new" }, path),
    ).not.toThrow();
  });

  it("fails closed on corrupt journal and stale mutex rather than guessing or deleting", async () => {
    const path = directory();
    await uncertain(path);
    const journal = readdirSync(path).find((name) => name.endsWith(".json"));
    if (!journal) throw new Error("Missing journal");
    writeFileSync(join(path, journal), "{}");
    const reconcileUSDC = vi.fn();
    await expect(recoverReceiptExecution({ reconcileUSDC }, identity, path)).rejects.toThrow();
    expect(reconcileUSDC).not.toHaveBeenCalled();
    writeFileSync(join(path, `execution-${identity.chainId}-${walletAddress}.lock`), "interrupted");
    expect(() => assertReceiptExecutionAvailable(identity, path)).toThrow("locked");
  });

  it("reconciling an older completed payment never releases a newer unresolved marker", async () => {
    const path = directory();
    await uncertain(path);
    const reconcileUSDC = vi.fn().mockResolvedValue({ verdict: "ALLOW", txHash });
    await recoverReceiptExecution({ reconcileUSDC }, identity, path);
    const next = { ...identity, reference: "next-invoice" };
    const executeUSDC = vi.fn().mockRejectedValue(new Error("unknown broadcast state"));
    await expect(
      executeReceiptJournaled(
        { executeUSDC },
        next,
        receiptId,
        { ...input, metadata: { ...input.metadata, reference: next.reference } },
        path,
      ),
    ).rejects.toThrow("unknown broadcast state");
    await recoverReceiptExecution({ reconcileUSDC }, identity, path);
    expect(() =>
      assertReceiptExecutionAvailable({ ...identity, reference: "third" }, path),
    ).toThrow("unresolved");
  });
});
