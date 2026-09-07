import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "./context";
import { enforceRateLimit } from "./rate-limit";

const upstash = vi.hoisted(() => ({
  limit: vi.fn(),
  constructor: vi.fn(),
  slidingWindow: vi.fn(() => "window"),
  fromEnv: vi.fn(() => "redis"),
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = upstash.slidingWindow;
    limit = upstash.limit;
    constructor(options: unknown) {
      upstash.constructor(options);
    }
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: upstash.fromEnv } }));

const originalEnv = { ...process.env };
function context(fingerprint: string | null, session: ApiContext["session"] = null): ApiContext {
  return {
    db: null as never,
    session,
    publicClient: null as never,
    supabase: null,
    requestFingerprint: fingerprint,
    env: { authConfigured: true, allowDevAuth: false },
  };
}

describe("enforceRateLimit", () => {
  beforeEach(() => {
    globalThis.__arcanumApiRateLimitBuckets?.clear();
    Reflect.deleteProperty(process.env, "UPSTASH_REDIS_REST_URL");
    Reflect.deleteProperty(process.env, "UPSTASH_REDIS_REST_TOKEN");
    upstash.limit.mockReset();
    upstash.constructor.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("allows through the fallback limit and rejects the next request", async () => {
    for (let request = 0; request < 60; request += 1) {
      await enforceRateLimit(context("client"), "mutation", "payments.create");
    }
    await expect(
      enforceRateLimit(context("client"), "mutation", "payments.create"),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("buckets anonymous callers by fingerprint or as unidentified", async () => {
    await enforceRateLimit(context("browser-a"), "mutation", "payments.create");
    await enforceRateLimit(context(null), "mutation", "payments.create");
    expect([...(globalThis.__arcanumApiRateLimitBuckets?.keys() ?? [])]).toEqual(
      expect.arrayContaining([
        "browser-a:mutation:payments.create",
        "unidentified:mutation:payments.create",
      ]),
    );
  });

  it("keys sessions by tenant and normalized wallet", async () => {
    await enforceRateLimit(
      context("ignored", {
        tenantId: "tenant-a",
        walletAddress: "0xABC",
        role: "viewer",
        expiresAt: Date.now() + 1_000,
      }),
      "query",
      "ledger.list",
    );
    expect(globalThis.__arcanumApiRateLimitBuckets?.has("tenant-a:0xabc:query:ledger.list")).toBe(
      true,
    );
  });

  it("uses the mutation limit independently of the larger query limit", async () => {
    for (let request = 0; request < 61; request += 1) {
      await enforceRateLimit(context("client"), "query", "ledger.list");
    }
    await expect(
      enforceRateLimit(context("client"), "mutation", "ledger.create"),
    ).resolves.toBeUndefined();
  });

  it("skips subscriptions", async () => {
    await enforceRateLimit(context(null), "subscription", "events.live");
    expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(0);
  });

  it("uses Upstash and rejects an unsuccessful result", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    upstash.limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });
    await expect(
      enforceRateLimit(context("client"), "mutation", "payments.create"),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(upstash.limit).toHaveBeenCalledWith("client:mutation:payments.create");
    expect(upstash.constructor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "arcanum:mutation" }),
    );
  });
});
