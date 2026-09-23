import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boundedHealthCheck,
  confirmedCursorStatus,
  indexerHealthStatus,
  maxBlockLag,
  staleAfterMs,
} from "./freshness";

afterEach(() => vi.unstubAllEnvs());

describe("freshness SLO", () => {
  const now = Date.parse("2026-09-16T12:00:00Z");
  it("enforces the 15 minute boundary regardless of event activity", () => {
    expect(indexerHealthStatus("available", new Date(now - 900_000).toISOString(), now)).toBe(
      "available",
    );
    expect(indexerHealthStatus("available", new Date(now - 900_001).toISOString(), now)).toBe(
      "stale",
    );
  });
  it.each([null, "invalid", "2026-09-16T12:01:00Z"])("rejects unknown/future evidence %s", (at) => {
    expect(indexerHealthStatus("available", at, now)).toBe("unknown");
  });
  it.each(["0", "-1", "210", "NaN", ""])("fails closed on invalid SLO %s", (value) => {
    vi.stubEnv("ARCANUM_INDEXER_STALE_AFTER_MINUTES", value);
    expect(staleAfterMs()).toBeNull();
    expect(indexerHealthStatus("available", new Date(now).toISOString(), now)).toBe("unknown");
  });
  it("allows a tighter SLO", () => {
    vi.stubEnv("ARCANUM_INDEXER_STALE_AFTER_MINUTES", "5");
    expect(staleAfterMs()).toBe(300_000);
  });
  it("accepts bounded cursor lag and rejects ancient or ahead cursors", () => {
    expect(confirmedCursorStatus(100, 1_000n)).toBe("available");
    expect(confirmedCursorStatus(99, 1_000n)).toBe("unknown");
    expect(confirmedCursorStatus(1_001, 1_000n)).toBe("unknown");
  });
  it.each(["0", "-1", "901", "NaN", ""])("fails closed on invalid block lag %s", (value) => {
    vi.stubEnv("ARCANUM_INDEXER_MAX_BLOCK_LAG", value);
    expect(maxBlockLag()).toBeNull();
    expect(confirmedCursorStatus(1_000, 1_000n)).toBe("unknown");
  });
  it("allows operators to tighten the block lag", () => {
    vi.stubEnv("ARCANUM_INDEXER_MAX_BLOCK_LAG", "300");
    expect(maxBlockLag()).toBe(300);
    expect(confirmedCursorStatus(700, 1_000n)).toBe("available");
    expect(confirmedCursorStatus(699, 1_000n)).toBe("unknown");
  });
  it("never promotes an unavailable checkpoint", () => {
    expect(indexerHealthStatus("unknown", new Date(now).toISOString(), now)).toBe("unknown");
  });
  it("bounds a hung dependency and never exposes its error", async () => {
    expect(await boundedHealthCheck(() => new Promise(() => {}), 5)).toEqual({ ok: false });
    expect(
      await boundedHealthCheck(async () => {
        throw new Error("secret");
      }),
    ).toEqual({ ok: false });
  });
});
