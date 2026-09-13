import { describe, expect, it } from "vitest";

import {
  type FundingLockManager,
  cctpFundingLockName,
  cctpFundingPendingKey,
  cctpFundingTransferKey,
  fundingSnapshotMatches,
  isStrictTransactionHash,
  linkPendingFundingMarker,
  loadFundingStorage,
  persistFundingTransfer,
  persistFundingTransferIfSnapshotMatches,
  readFundingStorageSnapshot,
  removeFundingStorageIfMatches,
  withFundingLock,
  writePendingFundingMarker,
} from "./cctp-funding-storage";

const recipient = "0x0000000000000000000000000000000000000001";
const sender = "0x0000000000000000000000000000000000000002";
const hash = `0x${"a".repeat(64)}` as `0x${string}`;
const intent = {
  amountBaseUnits: "1000000",
  maxFeeBaseUnits: "1000",
  sourceBlockNumber: "123",
  sourceNonce: 7,
};

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("CCTP funding durable recovery storage", () => {
  it("persists only a strict burn hash and recovers it under its scoped key", () => {
    const storage = new MemoryStorage();
    persistFundingTransfer(storage, recipient, sender, hash, intent);
    expect(loadFundingStorage(storage, recipient, sender)).toEqual({
      kind: "active",
      transfer: expect.objectContaining({ burnTxHash: hash, recipient, sender }),
    });
    expect(isStrictTransactionHash("0x1234")).toBe(false);
  });

  it("fails closed when storage cannot be read before a wallet request", () => {
    const unavailable = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    expect(() => writePendingFundingMarker(unavailable, recipient, sender)).toThrow(
      "storage is unavailable",
    );
  });

  it("serializes two requests for the same sender and recipient", async () => {
    let tail = Promise.resolve();
    const locks: FundingLockManager = {
      request: async (_name, _options, callback) => {
        const previous = tail;
        let release: () => void = () => undefined;
        tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback();
        } finally {
          release();
        }
      },
    };
    const events: string[] = [];
    await Promise.all([
      withFundingLock(locks, cctpFundingLockName(recipient, sender), async () => {
        events.push("first");
      }),
      withFundingLock(locks, cctpFundingLockName(recipient, sender), async () => {
        events.push("second");
      }),
    ]);
    expect(events).toEqual(["first", "second"]);
  });

  it("does not overwrite a transfer after storage changes while an import awaits the network", () => {
    const storage = new MemoryStorage();
    const beforeRequest = readFundingStorageSnapshot(storage, recipient, sender);
    writePendingFundingMarker(storage, recipient, sender);

    expect(() =>
      persistFundingTransferIfSnapshotMatches(
        storage,
        recipient,
        sender,
        hash,
        intent,
        beforeRequest,
      ),
    ).toThrow("changed in another tab");
    expect(loadFundingStorage(storage, recipient, sender)).toEqual({
      hasIntent: false,
      kind: "pending",
    });
  });

  it("does not clear a newer tab's pending marker during reset", () => {
    const storage = new MemoryStorage();
    persistFundingTransfer(storage, recipient, sender, hash, intent);
    const trackedTransfer = storage.getItem(cctpFundingTransferKey(recipient, sender));
    writePendingFundingMarker(storage, recipient, sender);

    expect(
      removeFundingStorageIfMatches(storage, cctpFundingTransferKey(recipient, sender), "old"),
    ).toBe(false);
    expect(storage.getItem(cctpFundingTransferKey(recipient, sender))).toBe(trackedTransfer);
    expect(storage.getItem(cctpFundingPendingKey(recipient, sender))).not.toBeNull();
  });

  it("cannot treat an unlinked ambiguous marker as an imported burn", () => {
    const storage = new MemoryStorage();
    const ambiguous = writePendingFundingMarker(storage, recipient, sender);

    expect(() => linkPendingFundingMarker(storage, recipient, sender, ambiguous, hash)).toThrow(
      "Legacy CCTP pending marker",
    );
    expect(() =>
      linkPendingFundingMarker(storage, recipient, sender, `${ambiguous}changed`, hash),
    ).toThrow("changed in another tab");
    expect(storage.getItem(cctpFundingPendingKey(recipient, sender))).toBe(ambiguous);
  });
});
