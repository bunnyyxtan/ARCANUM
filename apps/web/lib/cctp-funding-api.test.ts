import type { Address, Hash } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CctpStatus } from "./cctp";
import {
  CctpFundingApiError,
  clearMatchingActiveFundingMarker,
  requestCctpQuote,
  requestCctpStatus,
  revalidateCctpQuoteForBurn,
} from "./cctp-funding-api";
import {
  bindPendingFundingIntent,
  cctpFundingPendingKey,
  loadFundingStorage,
  persistFundingTransfer,
  readFundingStorageSnapshot,
  writePendingFundingMarker,
} from "./cctp-funding-storage";

const recipient: Address = "0x0000000000000000000000000000000000000001";
const sender: Address = "0x0000000000000000000000000000000000000002";
const burnTxHash: Hash = `0x${"a".repeat(64)}`;
const otherHash: Hash = `0x${"b".repeat(64)}`;
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

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    json: async () => body,
    ok,
    status,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CCTP funding API validation", () => {
  it("validates both the initial quote and the independent pre-burn revalidation", async () => {
    const initial = {
      amountBaseUnits: "1000000",
      expiresAt: Date.now() + 60_000,
      maxFeeBaseUnits: "1000",
      minimumReceivedBaseUnits: "999000",
    };
    const refreshed = {
      ...initial,
      expiresAt: Date.now() + 120_000,
      maxFeeBaseUnits: "1001",
      minimumReceivedBaseUnits: "998999",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ quote: initial }))
      .mockResolvedValueOnce(response({ quote: refreshed }));
    vi.stubGlobal("fetch", fetchMock);

    const reviewedQuote = await requestCctpQuote("1");
    await expect(revalidateCctpQuoteForBurn(reviewedQuote, "1")).rejects.toThrow(
      "requires a higher fee",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/cctp/quote?amount=1",
      expect.objectContaining({ signal: undefined }),
    );
  });

  it("surfaces API failures and rejects malformed successful quote responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: "Quote service unavailable" }, false))
      .mockResolvedValueOnce(response({ quote: { amountBaseUnits: "1000000" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestCctpQuote("1")).rejects.toThrow("Quote service unavailable");
    await expect(requestCctpQuote("1")).rejects.toThrow("Malformed or expired CCTP quote");
  });

  it("fails closed when pre-burn revalidation cannot produce a valid quote", async () => {
    const reviewed = {
      amountBaseUnits: "1000000",
      expiresAt: Date.now() + 60_000,
      maxFeeBaseUnits: "1000",
      minimumReceivedBaseUnits: "999000",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "offline" }, false)));

    await expect(revalidateCctpQuoteForBurn(reviewed, "1")).rejects.toThrow("Could not revalidate");
  });

  it("binds status validation to the requested hash, recipient, and sender", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          transfer: {
            burnTxHash,
            recipient,
            sender: "0x0000000000000000000000000000000000000003",
            stage: "attestation_pending",
          },
        }),
      ),
    );

    const result = requestCctpStatus(burnTxHash, recipient, sender);
    await expect(result).rejects.toThrow("different connected wallet");
    await expect(result).rejects.toMatchObject({ retryable: false });
  });

  it("marks only transient status failures as retryable", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ error: "busy" }, false, 503))
      .mockResolvedValueOnce(response({ error: "bad hash" }, false, 400));
    vi.stubGlobal("fetch", fetchMock);

    for (const retryable of [true, true, false]) {
      const result = requestCctpStatus(burnTxHash, recipient, sender);
      await expect(result).rejects.toBeInstanceOf(CctpFundingApiError);
      await expect(result).rejects.toMatchObject({ retryable });
    }
  });
});

describe("active CCTP transfer marker recovery", () => {
  function recoveryFixture(transferIntent = intent, pendingIntent = intent, statusIntent = intent) {
    const storage = new MemoryStorage();
    persistFundingTransfer(storage, recipient, sender, burnTxHash, transferIntent);
    const marker = writePendingFundingMarker(storage, recipient, sender);
    const pending = bindPendingFundingIntent(storage, recipient, sender, marker, pendingIntent);
    const loaded = loadFundingStorage(storage, recipient, sender);
    if (loaded.kind !== "active") throw new Error("Expected active transfer fixture");
    const status = {
      ...statusIntent,
      burnTxHash,
      recipient,
      sender,
      stage: "attestation_pending",
    } satisfies CctpStatus;
    return {
      pending,
      status,
      storage,
      transfer: loaded.transfer,
    };
  }

  it("validates, links, and clears a matching marker without any network or wallet request", () => {
    const fixture = recoveryFixture();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    clearMatchingActiveFundingMarker(
      fixture.storage,
      fixture.transfer,
      fixture.pending,
      fixture.status,
      burnTxHash,
      recipient,
      sender,
    );

    expect(readFundingStorageSnapshot(fixture.storage, recipient, sender)).toMatchObject({
      pending: null,
    });
    expect(loadFundingStorage(fixture.storage, recipient, sender)).toMatchObject({
      kind: "active",
      transfer: { burnTxHash },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched hash without clearing the marker", () => {
    const fixture = recoveryFixture();

    expect(() =>
      clearMatchingActiveFundingMarker(
        fixture.storage,
        fixture.transfer,
        fixture.pending,
        fixture.status,
        otherHash,
        recipient,
        sender,
      ),
    ).toThrow("saved transfer hash");
    expect(fixture.storage.getItem(cctpFundingPendingKey(recipient, sender))).toBe(fixture.pending);
  });

  it.each([
    ["saved transfer", { ...intent, amountBaseUnits: "1000001" }, intent],
    ["pending marker", intent, { ...intent, sourceNonce: 8 }],
  ])("rejects a mismatched %s intent without clearing the marker", (_label, saved, pending) => {
    const fixture = recoveryFixture(saved, pending);

    expect(() =>
      clearMatchingActiveFundingMarker(
        fixture.storage,
        fixture.transfer,
        fixture.pending,
        fixture.status,
        burnTxHash,
        recipient,
        sender,
      ),
    ).toThrow("does not match");
    expect(fixture.storage.getItem(cctpFundingPendingKey(recipient, sender))).toBe(fixture.pending);
  });
});
