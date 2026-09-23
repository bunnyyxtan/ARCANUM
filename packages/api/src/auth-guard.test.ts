import {
  SESSION_TTL_MS,
  createTrackedSession,
  revokeAllSessions,
  revokeSession,
} from "@arcanum/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

// Unlike read-model fixtures, these tests exercise the real revocation store.
vi.unmock("@arcanum/auth");
vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }));

import { createContext } from "./context";
import { protectedProcedure, publicProcedure, router } from "./trpc";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Regression guard: an anonymous caller must never reach a protected resolver
// unless the explicit local-dev bypass (allowDevAuth) is on. In production the
// bypass must be off regardless of NODE_ENV, because deployment config sets
// ARCANUM_REQUIRE_AUTH=true.

const guardRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ctx.session.walletAddress),
  scopedPublic: publicProcedure.query(({ ctx }) => ctx.session?.walletAddress ?? null),
});

function anonymousContext(env: { authConfigured: boolean; allowDevAuth: boolean }) {
  return {
    db: null as never,
    session: null,
    publicClient: null as never,
    supabase: null,
    requestFingerprint: "test-client",
    env,
  };
}

describe("protectedProcedure auth guard", () => {
  it("rejects an anonymous caller when the dev bypass is off", async () => {
    const caller = guardRouter.createCaller(
      anonymousContext({ authConfigured: true, allowDevAuth: false }),
    );
    await expect(caller.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an anonymous caller even when auth is misconfigured (fail closed)", async () => {
    const caller = guardRouter.createCaller(
      anonymousContext({ authConfigured: false, allowDevAuth: false }),
    );
    await expect(caller.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("only admits an anonymous caller via the explicit local-dev bypass", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", undefined);
    const caller = guardRouter.createCaller(
      anonymousContext({ authConfigured: true, allowDevAuth: true }),
    );
    await expect(caller.whoami()).resolves.toMatch(/^0x/);
  });

  it("does not accept an injected development bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    const caller = guardRouter.createCaller(
      anonymousContext({ authConfigured: true, allowDevAuth: true }),
    );
    await expect(caller.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a session whose application expiry has passed", async () => {
    const caller = guardRouter.createCaller({
      ...anonymousContext({ authConfigured: true, allowDevAuth: false }),
      session: {
        walletAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        tenantId: "tenant-default",
        role: "viewer",
        expiresAt: Date.now() - 1,
      },
    });

    await expect(caller.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires a tracked record at both protected and wallet-scoped public boundaries", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    const session = {
      walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      tenantId: "tenant-a",
      role: "viewer" as const,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    const base = { ...anonymousContext({ authConfigured: true, allowDevAuth: false }), session };
    const untracked = guardRouter.createCaller(base);
    await expect(untracked.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(untracked.scopedPublic()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const sessionId = await createTrackedSession(session);
    const caller = guardRouter.createCaller({ ...base, sessionId, expectedTenantId: "tenant-a" });
    await expect(caller.whoami()).resolves.toBe(session.walletAddress);
    await expect(caller.scopedPublic()).resolves.toBe(session.walletAddress);
    await revokeSession({ user: session, sessionId });
    await expect(caller.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.scopedPublic()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const nextId = await createTrackedSession(session);
    const next = guardRouter.createCaller({ ...base, sessionId: nextId });
    await revokeAllSessions({ user: session, sessionId: nextId });
    await expect(next.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(next.scopedPublic()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("surfaces store outage rather than allowing either boundary to read data", async () => {
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://store.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("outage")));
    const caller = guardRouter.createCaller({
      ...anonymousContext({ authConfigured: true, allowDevAuth: false }),
      session: {
        walletAddress: "0xaaa",
        tenantId: "a",
        role: "viewer",
        expiresAt: Date.now() + 1000,
      },
      sessionId: "a".repeat(64),
    });
    await expect(caller.whoami()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(caller.scopedPublic()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});

describe("allowDevAuth environment derivation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function derivedAllowDevAuth() {
    // Only exercise the env derivation; stub everything with I/O side effects.
    const ctx = createContext({
      database: null as never,
      publicClient: null as never,
      supabase: null,
    });
    return ctx.env.allowDevAuth;
  }

  it("is disabled when NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", undefined);
    expect(derivedAllowDevAuth()).toBe(false);
  });

  it("is disabled when ARCANUM_REQUIRE_AUTH=true even outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", "true");
    expect(derivedAllowDevAuth()).toBe(false);
  });

  it("is disabled when NODE_ENV is unset or non-development (staging/preview fail closed)", () => {
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", undefined);
    expect(derivedAllowDevAuth()).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(derivedAllowDevAuth()).toBe(false);
  });

  it("is enabled only in explicit local-test development with ARCANUM_REQUIRE_AUTH unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", undefined);
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", undefined);
    expect(derivedAllowDevAuth()).toBe(false);
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    expect(derivedAllowDevAuth()).toBe(true);
  });
});
