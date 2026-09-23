import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "./context";
import { enforceRateLimit } from "./rate-limit";
import { consumeRateLimit, rateLimitFailure, rateLimitKey } from "./rate-limit-store";

const upstash = vi.hoisted(() => ({ limit: vi.fn(), constructor: vi.fn() }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn(() => "window");
    limit = upstash.limit;
    constructor(options: unknown) {
      upstash.constructor(options);
    }
  },
}));
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn(() => "redis") } }));

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
const policy = { scope: "test", identity: "192.0.2.1", limit: 2, windowMs: 60_000 };

beforeEach(() => {
  for (const name of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ARCANUM_REQUIRE_RATE_LIMIT_BACKEND",
  ]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT", "true");
  globalThis.__arcanumApiRateLimitBuckets?.clear();
  upstash.limit.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("distributed abuse limits", () => {
  it("enforces the mutation quota and returns Retry-After through tRPC cause", async () => {
    for (let i = 0; i < 60; i++) await enforceRateLimit(context("client"), "mutation", "create");
    const error = await enforceRateLimit(context("client"), "mutation", "create").catch((e) => e);
    expect(error.code).toBe("TOO_MANY_REQUESTS");
    expect(rateLimitFailure(error)).toMatchObject({ status: 429, retryAfter: 60 });
  });

  it("hashes and separates anonymous, missing, authenticated, tenant, and procedure identities", async () => {
    await enforceRateLimit(context("browser-a"), "mutation", "create");
    await enforceRateLimit(context(null), "mutation", "create");
    const session = {
      tenantId: "tenant-a",
      walletAddress: "0xABC",
      role: "viewer" as const,
      expiresAt: Date.now() + 1000,
    };
    await enforceRateLimit(context("ignored", session), "query", "list");
    await enforceRateLimit(
      context("different", { ...session, walletAddress: "0xabc" }),
      "query",
      "list",
    );
    await enforceRateLimit(context(null, { ...session, tenantId: "tenant-b" }), "query", "list");
    await enforceRateLimit(context(null, session), "query", "other");
    const entries = [...(globalThis.__arcanumApiRateLimitBuckets?.entries() ?? [])];
    expect(entries).toHaveLength(5);
    expect(entries.every(([key]) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(entries.some(([, value]) => value.count === 2)).toBe(true);
  });

  it("fails closed in production even with the development escape hatch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(enforceRateLimit(context(null), "query", "list")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("requires explicit development opt-in and respects required-backend override", async () => {
    vi.stubEnv("ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT", "");
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT", "true");
    vi.stubEnv("ARCANUM_REQUIRE_RATE_LIMIT_BACKEND", "true");
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 503 });
  });

  it("prefers Upstash, disables its fail-open timeout, and hashes identities", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    upstash.limit.mockResolvedValue({ success: false, reset: Date.now() + 10_000 });
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 429 });
    expect(upstash.limit).toHaveBeenCalledWith(rateLimitKey(policy));
    expect(upstash.constructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 0 }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed on Upstash errors, fail-open responses, timeouts and partial configuration", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    upstash.limit.mockRejectedValue(new Error("secret backend URL"));
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({
      status: 503,
      message: "Rate limit service unavailable.",
    });
    upstash.limit.mockResolvedValue({ success: true, reason: "timeout", reset: Date.now() });
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 503 });
    vi.useFakeTimers();
    upstash.limit.mockImplementation(() => new Promise(() => {}));
    const assertion = expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(3001);
    await assertion;
    expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(0);
  });

  it("uses the service-role RPC and validates denied responses", async () => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.example/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ allowed: false, retry_after: 7 }])));
    vi.stubGlobal("fetch", fetcher);
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 429, retryAfter: 7 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://supabase.example/rest/v1/rpc/consume_rate_limit",
      expect.objectContaining({
        body: JSON.stringify({ p_key: rateLimitKey(policy), p_limit: 2, p_window_ms: 60000 }),
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("allows successful Supabase responses in production without using local state", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify([{ allowed: true, retry_after: 60 }]))),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(consumeRateLimit(policy)).resolves.toBeUndefined();
    await expect(consumeRateLimit(policy)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(0);
  });

  it.each(["network", "http", "malformed", "invalid-json"])(
    "fails closed on Supabase %s failure",
    async (failure) => {
      vi.stubEnv("SUPABASE_URL", "https://supabase.example");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
      vi.stubGlobal(
        "fetch",
        failure === "network"
          ? vi.fn().mockRejectedValue(new Error("secret"))
          : vi
              .fn()
              .mockResolvedValue(
                new Response(
                  failure === "invalid-json" ? "secret" : JSON.stringify({ allowed: true }),
                  { status: failure === "http" ? 500 : 200 },
                ),
              ),
      );
      await expect(consumeRateLimit(policy)).rejects.toMatchObject({
        status: 503,
        message: "Rate limit service unavailable.",
      });
      expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(0);
    },
  );

  it("expires local buckets and bounds cleanup to 100 examined rows", async () => {
    vi.useFakeTimers();
    await consumeRateLimit(policy);
    await consumeRateLimit(policy);
    await expect(consumeRateLimit(policy)).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(60001);
    await expect(consumeRateLimit(policy)).resolves.toBeUndefined();
    globalThis.__arcanumApiRateLimitBuckets?.clear();
    for (let i = 0; i < 150; i++) {
      globalThis.__arcanumApiRateLimitBuckets?.set(String(i), { count: 1, resetAt: 0 });
    }
    await consumeRateLimit(policy);
    expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(51);
  });
});
