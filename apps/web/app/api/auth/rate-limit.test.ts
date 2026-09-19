import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceAuthRouteRateLimit } from "./rate-limit";

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
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("auth shared abuse limits", () => {
  it.each([
    ["nonce", 30],
    ["verify", 10],
    ["logout", 30],
    ["logout-all", 10],
  ] as const)("limits %s and returns Retry-After", async (route, limit) => {
    const request = new Request("http://localhost/api/auth");
    for (let i = 0; i < limit; i++) {
      expect(await enforceAuthRouteRateLimit(request, route)).toBeNull();
    }
    const denied = await enforceAuthRouteRateLimit(request, route);
    expect(denied?.status).toBe(429);
    expect(Number(denied?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(denied?.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed in production with no backend", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const denied = await enforceAuthRouteRateLimit(new Request("http://localhost"), "nonce");
    expect(denied?.status).toBe(503);
  });

  it("fails closed on configured backend errors without exposing their messages", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret backend error")));
    const denied = await enforceAuthRouteRateLimit(new Request("http://localhost"), "verify");
    expect(denied?.status).toBe(503);
    expect(await denied?.text()).not.toContain("secret");
    expect(globalThis.__arcanumApiRateLimitBuckets?.size).toBe(0);
  });
});
