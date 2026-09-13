import { afterEach, describe, expect, it, vi } from "vitest";

import { createContext } from "./context";
import { protectedProcedure, router } from "./trpc";

// Regression guard: an anonymous caller must never reach a protected resolver
// unless the explicit local-dev bypass (allowDevAuth) is on. In production the
// bypass must be off regardless of NODE_ENV, because deployment config sets
// ARCANUM_REQUIRE_AUTH=true.

const guardRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ctx.session.walletAddress),
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
    const caller = guardRouter.createCaller(
      anonymousContext({ authConfigured: true, allowDevAuth: true }),
    );
    await expect(caller.whoami()).resolves.toMatch(/^0x/);
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

  it("is enabled only in development with ARCANUM_REQUIRE_AUTH unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ARCANUM_REQUIRE_AUTH", undefined);
    expect(derivedAllowDevAuth()).toBe(true);
  });
});
