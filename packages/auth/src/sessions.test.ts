import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sealData, unsealData } from "iron-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ArcanumSession,
  type AuthSessionData,
  SESSION_TTL_MS,
  SessionStoreUnavailableError,
  assertSessionStoreReady,
  createTrackedSession,
  revokeAllSessions,
  revokeSession,
  validateSession,
} from "./index";

const user = (overrides: Partial<ArcanumSession> = {}): ArcanumSession => ({
  walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  tenantId: "tenant-a",
  role: "viewer",
  expiresAt: Date.now() + SESSION_TTL_MS,
  ...overrides,
});
let testClock = Date.now();
async function tracked(
  overrides: Partial<ArcanumSession> = {},
): Promise<{ user: ArcanumSession; sessionId: string }> {
  const identity = user(overrides);
  return { user: identity, sessionId: await createTrackedSession(identity) };
}

beforeEach(() => {
  vi.useFakeTimers();
  testClock += 1000;
  vi.setSystemTime(testClock);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
  // No test may accidentally contact a configured live backend.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("tracked SIWE sessions", () => {
  it("rejects a copied, still-valid sealed cookie after individual logout", async () => {
    const session = await tracked();
    const password = "isolated-test-password-not-a-secret".repeat(2);
    const seal = await sealData(session, { password });
    const copied = await unsealData<AuthSessionData>(seal, { password });
    expect(await validateSession(copied)).toEqual(session.user);
    await revokeSession(session);
    expect(await validateSession(copied)).toBeNull();
    await expect(revokeSession(copied)).resolves.toBeUndefined();
  });

  it("revokes every current session for the wallet+tenant, not other identities", async () => {
    const first = await tracked();
    const second = await tracked();
    const otherTenant = await tracked({ tenantId: "tenant-b" });
    const otherWallet = await tracked({
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(await revokeAllSessions(first, "tenant-a")).toBe(true);
    expect(await validateSession(first)).toBeNull();
    expect(await validateSession(second)).toBeNull();
    expect(await validateSession(otherTenant)).not.toBeNull();
    expect(await validateSession(otherWallet)).not.toBeNull();
    expect(await revokeAllSessions(first)).toBe(false);
  });

  it("rejects missing, untracked, expired, and incorrectly bound credentials", async () => {
    const session = await tracked();
    expect(await validateSession({})).toBeNull();
    expect(await validateSession({ user: session.user })).toBeNull();
    expect(await validateSession({ ...session, sessionId: "0".repeat(64) })).toBeNull();
    expect(await validateSession(session, "tenant-b")).toBeNull();
    for (const changes of [
      { tenantId: "tenant-b" },
      { role: "owner" as const },
      { walletAddress: "other" },
      { expiresAt: Date.now() + 1000 },
    ]) {
      expect(
        await validateSession({ ...session, user: { ...session.user, ...changes } }),
      ).toBeNull();
    }
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + SESSION_TTL_MS + 1);
    expect(await validateSession(session)).toBeNull();
  });

  it("does not permit lifetime inflation", async () => {
    await expect(
      createTrackedSession(user({ expiresAt: Date.now() + SESSION_TTL_MS * 2 })),
    ).rejects.toThrow("Invalid session lifetime");
  });

  it("rejects an in-flight pre-logout-all login but permits a fresh signature afterwards", async () => {
    const active = await tracked();
    const pendingLogin = user();
    vi.setSystemTime(Date.now() + 10);
    expect(await revokeAllSessions(active)).toBe(true);
    await expect(createTrackedSession(pendingLogin)).rejects.toBeInstanceOf(
      SessionStoreUnavailableError,
    );
    // Watermarks are tenant-scoped; another tenant's login is unaffected.
    await expect(
      createTrackedSession({ ...pendingLogin, tenantId: "other-tenant" }),
    ).resolves.toMatch(/^[a-f0-9]{64}$/);
    vi.setSystemTime(Date.now() + 10);
    expect(await validateSession(await tracked())).not.toBeNull();
  });

  it("revokes a parallel login that inserts before the logout-all transaction", async () => {
    const active = await tracked();
    const [parallel] = await Promise.all([tracked(), revokeAllSessions(active)]);
    expect(await validateSession(parallel)).toBeNull();
  });
});

describe("Supabase session store (mocked REST only)", () => {
  beforeEach(() => {
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://session-store.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only-not-a-secret");
  });

  it("persists only the SHA-256 identifier with no-store reads and bounded requests", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: URL, init: RequestInit) => {
      const args = JSON.parse(String(init.body));
      return Response.json([
        {
          session_hash: args.p_session_hash,
          wallet_address: args.p_wallet_address,
          tenant_id: args.p_tenant_id,
          role: args.p_role,
          expires_at: args.p_expires_at,
          revoked_at: null,
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const session = await tracked();
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("Expected a session-store request");
    const [url, init] = call;
    const row = JSON.parse(init.body);
    expect(url.pathname).toBe("/rest/v1/rpc/create_auth_session");
    expect(row.p_session_hash).toBe(createHash("sha256").update(session.sessionId).digest("hex"));
    expect(init.body).not.toContain(session.sessionId);
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails closed on unconfigured, failed, or malformed storage and production local-test mode", async () => {
    const session = { user: user(), sessionId: "a".repeat(64) };
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(validateSession(session)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    await expect(createTrackedSession(user())).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
    for (const response of [
      new Response("outage", { status: 503 }),
      Response.json({}),
      Response.json([{ session_hash: "wrong" }]),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(validateSession(session)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network outage")));
    await expect(revokeSession(session)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    await expect(revokeAllSessions(session)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    await expect(validateSession(session)).rejects.toBeInstanceOf(SessionStoreUnavailableError);
  });

  it("treats a missing or revoked database row as invalid, not an outage", async () => {
    const identity = user();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    expect(await validateSession({ user: identity, sessionId: "a".repeat(64) })).toBeNull();
  });

  it("provides a read-only migration canary requesting all required columns", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(assertSessionStoreReady()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0].searchParams.get("select")).toContain("revoked_at");
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("GET");
  });
});

describe("session migration source guards (not a database integration test)", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260918190000_revocable_sessions.sql", import.meta.url),
    "utf8",
  );
  it("bounds expired-session pruning and skips rows locked by concurrent operations", () => {
    expect(migration).toMatch(
      /where expires_at <= clock_timestamp\(\)[\s\S]*?limit 100 for update skip locked/,
    );
    expect(migration).toMatch(/delete from public\.auth_sessions s using expired e/);
  });
  it("serializes issuance/revocation with an identity watermark and service-only invoker RPCs", () => {
    expect(migration.match(/wallet_address = p_wallet_address for update/g)?.length).toBe(2);
    expect(migration).toContain("p_expires_at - interval '12 hours' <= v_revoked_before");
    expect(migration.match(/security invoker/g)?.length).toBe(2);
    expect(migration).toContain("revoke all on function public.create_auth_session");
    expect(migration).toContain("revoke all on function public.revoke_all_auth_sessions");
  });
});
