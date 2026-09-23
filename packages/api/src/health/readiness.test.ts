import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../context";
import { readSecurityReadiness } from "./readiness";

const { consume } = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock("../rate-limit-store", () => ({ consumeRateLimit: consume }));

const selectRows = vi.fn();
const ctx = { supabase: { configured: true, selectRows } } as unknown as ApiContext;
beforeEach(() => {
  consume.mockReset().mockResolvedValue(undefined);
  selectRows.mockReset().mockResolvedValue([]);
  vi.stubEnv("SIWE_SECRET", "x".repeat(32));
  vi.stubEnv("ARCANUM_INSECURE_COOKIES", "false");
  vi.stubEnv("ARCANUM_DEPLOYMENT_MODE", "single-tenant");
  vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "supabase");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("security readiness", () => {
  it("accepts empty but reachable identity/session stores and probes Supabase limiter", async () => {
    const result = await readSecurityReadiness(ctx);
    expect(result.identity.status).toBe("available");
    expect(result.sessions.status).toBe("available");
    expect(result.rateLimit).toEqual({ status: "available", backend: "supabase" });
    expect(consume).toHaveBeenCalledOnce();
    expect(selectRows).toHaveBeenCalledWith("auth_sessions", expect.objectContaining({ limit: 1 }));
  });
  it("fails closed if registry migration is missing", async () => {
    selectRows.mockImplementation(async (table) => {
      if (table === "auth_sessions") throw new Error("private database detail");
      return [];
    });
    expect((await readSecurityReadiness(ctx)).sessions.status).toBe("unavailable");
  });
  it("requires real limiter readiness, not configuration presence", async () => {
    consume.mockRejectedValue(new Error("private backend detail"));
    expect((await readSecurityReadiness(ctx)).rateLimit.status).toBe("unavailable");
  });
  it("supports configured Upstash without requiring it for Supabase deployments", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    expect((await readSecurityReadiness(ctx)).rateLimit.backend).toBe("upstash");
  });
  it("rejects local-test sessions and unsupported shared multi-tenant identity", async () => {
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    vi.stubEnv("ARCANUM_DEPLOYMENT_MODE", "multi-tenant");
    const result = await readSecurityReadiness(ctx);
    expect(result.identity.status).toBe("unavailable");
    expect(result.sessions.status).toBe("unavailable");
  });
  it("rejects missing signing secret and empty malformed backend responses", async () => {
    vi.stubEnv("SIWE_SECRET", "");
    expect((await readSecurityReadiness(ctx)).identity.status).toBe("unavailable");
    vi.stubEnv("SIWE_SECRET", "x".repeat(32));
    selectRows.mockResolvedValue(undefined);
    expect((await readSecurityReadiness(ctx)).identity.status).toBe("unavailable");
  });
});
