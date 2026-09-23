import type { Address, Hash, TransactionReceipt } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  type RecoveryClient,
  checkRecovery,
  dismissRecovery,
  emergencyRecovery,
  listRecovery,
  recoveryAction,
  recoveryKey,
  submitRecoverable,
  waitForRecovery,
  withRecoveryLock,
} from "./transaction-recovery";

class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
const account = `0x${"1".repeat(40)}` as Address;
const other = `0x${"2".repeat(40)}` as Address;
const hash = `0x${"a".repeat(64)}` as Hash;
const replacementHash = `0x${"b".repeat(64)}` as Hash;
let sequence = 0;
function setup() {
  const storage = new MemoryStorage();
  const scope = { chainId: 5042002, account, action: `action:${++sequence}`, label: "setPolicy" };
  return { storage, scope };
}
function receipt(status: "success" | "reverted", transactionHash = hash) {
  return { status, transactionHash } as TransactionReceipt;
}
function client(): RecoveryClient {
  return {
    waitForTransactionReceipt: vi.fn().mockResolvedValue(receipt("success")),
    getTransactionReceipt: vi.fn().mockResolvedValue(receipt("success")),
  };
}
async function pending(storage: MemoryStorage, scope: ReturnType<typeof setup>["scope"]) {
  await submitRecoverable(storage, scope, async () => hash);
  return stored(storage, scope);
}
function stored(storage: MemoryStorage, scope: ReturnType<typeof setup>["scope"]) {
  const entry = listRecovery(storage, scope.chainId, account).find(
    (entry) => entry.action === scope.action,
  );
  if (!entry) throw new Error("Expected a persisted recovery entry.");
  return entry;
}

describe("durable transaction recovery", () => {
  it("refuses concurrent views without queueing a later automatic submission", async () => {
    const { scope } = setup();
    let held = false;
    const locks = {
      request: async (
        _name: string,
        options: LockOptions,
        work: (lock: Lock | null) => Promise<unknown>,
      ) => {
        expect(options.ifAvailable).toBe(true);
        if (held) return work(null);
        held = true;
        try {
          return await work({ name: recoveryKey(scope), mode: "exclusive" });
        } finally {
          held = false;
        }
      },
    } as Pick<LockManager, "request">;
    let finish!: () => void;
    const first = withRecoveryLock(
      locks,
      scope,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const duplicate = vi.fn(async () => hash);
    await expect(withRecoveryLock(locks, scope, duplicate)).rejects.toThrow(
      "already being submitted or checked",
    );
    expect(duplicate).not.toHaveBeenCalled();
    finish();
    await first;
    expect(duplicate).not.toHaveBeenCalled();
    await expect(withRecoveryLock(undefined, scope, duplicate)).rejects.toThrow("Web Locks");
    expect(duplicate).not.toHaveBeenCalled();
  });

  it("persists the reservation before sending and the hash before waiting", async () => {
    const { storage, scope } = setup();
    await submitRecoverable(storage, scope, async () => {
      expect(listRecovery(storage, scope.chainId, account)[0]).toMatchObject({
        status: "unknown",
        action: scope.action,
      });
      return hash;
    });
    const rpc = client();
    vi.mocked(rpc.waitForTransactionReceipt).mockImplementation(async () => {
      expect(listRecovery(storage, scope.chainId, account)[0]?.hash).toBe(hash);
      return receipt("success");
    });
    await waitForRecovery(storage, rpc, stored(storage, scope));
    expect(listRecovery(storage, scope.chainId, account)[0]?.status).toBe("success");
  });

  it("recovers after reload, checks only the original hash, and blocks repeat submission", async () => {
    const { storage, scope } = setup();
    await pending(storage, scope);
    const reloadedStorage = new MemoryStorage();
    reloadedStorage.values = new Map(storage.values);
    const sendAgain = vi.fn(async () => hash);
    await expect(submitRecoverable(reloadedStorage, scope, sendAgain)).rejects.toThrow(
      "Use Check status",
    );
    expect(sendAgain).not.toHaveBeenCalled();
    const rpc = client();
    await checkRecovery(reloadedStorage, rpc, stored(reloadedStorage, scope));
    expect(rpc.getTransactionReceipt).toHaveBeenCalledExactlyOnceWith({ hash });
    expect(rpc.waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(sendAgain).not.toHaveBeenCalled();
  });

  it("isolates accounts and chains, and shares opposing action locks without mutable input", async () => {
    const { storage, scope } = setup();
    await pending(storage, scope);
    expect(listRecovery(storage, scope.chainId, other)).toEqual([]);
    expect(listRecovery(storage, scope.chainId + 1, account)).toEqual([]);
    expect(listRecovery(storage, scope.chainId, account.toUpperCase())).toHaveLength(1);
    expect(recoveryAction(account, "approve", [hash])).toBe(
      recoveryAction(account, "reject", [hash]),
    );
    expect(recoveryAction(account, "approve", [hash])).toBe(
      recoveryAction(other, "cancelEscalation", [hash]),
    );
    expect(recoveryAction(account, "addVendor", [other, 1n])).toBe(
      recoveryAction(account, "blockVendor", [other]),
    );
    expect(recoveryAction(account, "setPolicy", [1n])).toBe(
      recoveryAction(account, "setPolicy", [2n]),
    );
    expect(recoveryAction(account, "addSigner", [other])).toBe(
      recoveryAction(account, "removeSigner", [other]),
    );
    await expect(
      submitRecoverable(storage, { ...scope, account: other }, async () => hash),
    ).resolves.toBe(hash);
  });

  it("retains an unknown outcome on timeout, missing receipt, and offline RPC errors", async () => {
    const { storage, scope } = setup();
    const entry = await pending(storage, scope);
    const rpc = client();
    vi.mocked(rpc.waitForTransactionReceipt).mockRejectedValue(new Error("timeout"));
    vi.mocked(rpc.getTransactionReceipt).mockRejectedValue(new Error("offline"));
    await expect(waitForRecovery(storage, rpc, entry)).rejects.toThrow("outcome is unknown");
    await expect(checkRecovery(storage, rpc, entry)).rejects.toThrow("Still unknown");
    expect(listRecovery(storage, scope.chainId, account)[0]).toMatchObject({
      hash,
      status: "unknown",
    });
    expect(() => dismissRecovery(storage, entry)).toThrow("cannot be dismissed");
  });

  it("never settles the journal from a mismatched RPC receipt", async () => {
    const { storage, scope } = setup();
    const entry = await pending(storage, scope);
    const rpc = client();
    vi.mocked(rpc.waitForTransactionReceipt).mockResolvedValue(receipt("success", replacementHash));
    vi.mocked(rpc.getTransactionReceipt).mockResolvedValue(receipt("success", replacementHash));
    await expect(waitForRecovery(storage, rpc, entry)).rejects.toThrow(
      "different transaction receipt",
    );
    await expect(checkRecovery(storage, rpc, entry)).rejects.toThrow("different transaction");
    expect(
      listRecovery(storage, scope.chainId, account).find((item) => item.action === scope.action)
        ?.status,
    ).toBe("unknown");
  });

  it("distinguishes a confirmed revert from timeout, permitting a deliberate later action", async () => {
    const { storage, scope } = setup();
    const entry = await pending(storage, scope);
    const rpc = client();
    vi.mocked(rpc.waitForTransactionReceipt).mockResolvedValue(receipt("reverted"));
    await expect(waitForRecovery(storage, rpc, entry)).resolves.toMatchObject({
      status: "reverted",
    });
    const resolved = stored(storage, scope);
    expect(resolved.status).toBe("reverted");
    dismissRecovery(storage, resolved);
    expect(listRecovery(storage, scope.chainId, account)).toEqual([]);
    await expect(submitRecoverable(storage, scope, async () => replacementHash)).resolves.toBe(
      replacementHash,
    );
  });

  it.each(["cancelled", "replaced", "repriced"] as const)(
    "does not infer original success after %s",
    async (reason) => {
      const { storage, scope } = setup();
      const entry = await pending(storage, scope);
      const rpc = client();
      vi.mocked(rpc.waitForTransactionReceipt).mockImplementation(async (args) => {
        args.onReplaced?.({
          reason,
          replacedTransaction: { hash },
          transaction: { hash: replacementHash },
          transactionReceipt: receipt("success", replacementHash),
        } as Parameters<NonNullable<typeof args.onReplaced>>[0]);
        return receipt("success", replacementHash);
      });
      await expect(waitForRecovery(storage, rpc, entry)).rejects.toThrow(
        reason === "cancelled" ? "cancelled" : "replaced",
      );
      expect(listRecovery(storage, scope.chainId, account)[0]).toMatchObject({
        hash,
        replacementHash,
        status: reason === "cancelled" ? "cancelled" : "replaced",
      });
    },
  );

  it("retains cancellation evidence through a replacement timeout and reload", async () => {
    const { storage, scope } = setup();
    const entry = await pending(storage, scope);
    const rpc = client();
    vi.mocked(rpc.waitForTransactionReceipt).mockImplementation(async (args) => {
      args.onReplaced?.({
        reason: "cancelled",
        transaction: { hash: replacementHash },
      } as Parameters<NonNullable<typeof args.onReplaced>>[0]);
      throw new Error("timeout");
    });
    await expect(waitForRecovery(storage, rpc, entry)).rejects.toThrow("unknown");
    const reloaded = stored(storage, scope);
    expect(reloaded.status).toBe("unknown");
    vi.mocked(rpc.getTransactionReceipt)
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(receipt("success", replacementHash));
    expect(await checkRecovery(storage, rpc, reloaded)).toMatchObject({
      status: "cancelled",
      hash,
      replacementHash,
    });
  });

  it("fails closed before sending when storage is unavailable", async () => {
    const { storage, scope } = setup();
    storage.setItem = () => {
      throw new Error("quota");
    };
    const send = vi.fn(async () => hash);
    await expect(submitRecoverable(storage, scope, send)).rejects.toThrow(
      "No transaction was sent",
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("never loses an already submitted hash if persistence fails after preflight", async () => {
    const { storage, scope } = setup();
    await expect(
      submitRecoverable(storage, scope, async () => {
        storage.setItem = () => {
          throw new Error("quota");
        };
        return hash;
      }),
    ).resolves.toBe(hash);
    const entry = listRecovery(storage, scope.chainId, account).find(
      (item) => item.action === scope.action,
    );
    expect(entry).toMatchObject({
      hash,
      status: "unknown",
      storageError: expect.stringContaining("Copy this hash"),
    });
    expect(emergencyRecovery(scope.chainId, account)).toContainEqual(entry);
    const sendAgain = vi.fn(async () => hash);
    await expect(submitRecoverable(storage, scope, sendAgain)).rejects.toThrow("unknown outcome");
    expect(sendAgain).not.toHaveBeenCalled();
  });

  it("only releases pre-submission reservations on explicit wallet rejection", async () => {
    const { storage, scope } = setup();
    await expect(
      submitRecoverable(storage, scope, async () => {
        throw { cause: { code: 4001 } };
      }),
    ).rejects.toEqual({ cause: { code: 4001 } });
    expect(storage.getItem(recoveryKey(scope))).toBeNull();
    await expect(
      submitRecoverable(storage, scope, async () => {
        throw new Error("RPC timeout during send");
      }),
    ).rejects.toThrow("submission outcome is unknown");
    expect(
      listRecovery(storage, scope.chainId, account).find((item) => item.action === scope.action),
    ).toMatchObject({ status: "unknown" });
  });

  it("does not let stale recovery checks or dismissals overwrite a newer pending action", async () => {
    const { storage, scope } = setup();
    const old = await pending(storage, scope);
    const rpc = client();
    const resolved = await checkRecovery(storage, rpc, old);
    await submitRecoverable(storage, scope, async () => replacementHash);
    expect(() => dismissRecovery(storage, resolved)).toThrow("changed");
    await checkRecovery(storage, rpc, old);
    expect(
      listRecovery(storage, scope.chainId, account).find((item) => item.action === scope.action),
    ).toMatchObject({ hash: replacementHash, status: "unknown" });
  });

  it("rejects corrupt account-scoped journal entries instead of silently enabling submission", async () => {
    const { storage, scope } = setup();
    storage.setItem(recoveryKey(scope), "{broken");
    const send = vi.fn(async () => hash);
    await expect(submitRecoverable(storage, scope, send)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
