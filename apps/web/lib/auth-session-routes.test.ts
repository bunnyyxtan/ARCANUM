import type { AuthSessionData } from "@arcanum/auth";
import { SESSION_TTL_MS, createTrackedSession, validateSession } from "@arcanum/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {} as AuthSessionData & {
    save: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  },
  limit: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("iron-session", () => ({ getIronSession: vi.fn(async () => mocks.session) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
  headers: vi.fn(async () => new Headers({ host: "app.example" })),
}));
vi.mock("@arcanum/api/server", () => ({
  syncSupabaseAuthSession: vi.fn(async () => ({ synced: true })),
}));
vi.mock("@arcanum/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@arcanum/auth")>()),
  verifySiweLogin: mocks.verify,
}));
vi.mock("../app/api/auth/rate-limit", () => ({ enforceAuthRouteRateLimit: mocks.limit }));

import { POST as logoutAll } from "../app/api/auth/logout-all/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { POST as nonce } from "../app/api/auth/nonce/route";
import { GET as readSession } from "../app/api/auth/session/route";
import { POST as verify } from "../app/api/auth/verify/route";

function request(route: string, origin: string | null = "https://app.example") {
  return new Request(`https://app.example/api/auth/${route}`, {
    method: "POST",
    headers: { host: "app.example", ...(origin ? { origin } : {}) },
    body: JSON.stringify({
      message: "isolated-test-message",
      signature: "isolated-test-signature",
    }),
  });
}
let testClock = Date.now();
async function issueSession() {
  const user = {
    walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    tenantId: "00000000-0000-0000-0000-000000000001",
    role: "viewer" as const,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const sessionId = await createTrackedSession(user);
  mocks.session.user = user;
  mocks.session.sessionId = sessionId;
  return { user: { ...user }, sessionId };
}
beforeEach(() => {
  vi.useFakeTimers();
  testClock += 1000;
  vi.setSystemTime(testClock);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
  vi.stubEnv("SIWE_SECRET", "isolated-unit-test-seal-password".repeat(2));
  vi.stubEnv("ARCANUM_DEPLOYMENT_MODE", "single-tenant");
  vi.stubEnv("ARCANUM_TENANT_ID", "00000000-0000-0000-0000-000000000001");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network")));
  mocks.session = { save: vi.fn(), destroy: vi.fn() };
  mocks.limit.mockReset().mockResolvedValue(null);
  mocks.verify.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth REST boundaries (mock cookies/SIWE; real local session registry)", () => {
  it.each([
    ["nonce", nonce],
    ["verify", verify],
    ["logout", logout],
    ["logout-all", logoutAll],
  ] as const)(
    "rejects cross-origin and absent origins before %s can mutate state",
    async (path, route) => {
      for (const origin of [null, "https://attacker.example"]) {
        expect((await route(request(path, origin))).status).toBe(403);
      }
      expect(mocks.limit).not.toHaveBeenCalled();
      expect(mocks.session.save).not.toHaveBeenCalled();
      expect(mocks.session.destroy).not.toHaveBeenCalled();
    },
  );

  it("awaits the limiter rather than treating its Promise as a response", async () => {
    mocks.limit.mockResolvedValue(new Response("limited", { status: 429 }));
    expect((await nonce(request("nonce"))).status).toBe(429);
    expect(mocks.session.save).not.toHaveBeenCalled();
  });

  it("issues a tracked cookie on verification without exposing its ID in JSON", async () => {
    const old = await issueSession();
    expect((await nonce(request("nonce"))).status).toBe(200);
    mocks.verify.mockResolvedValue(old.user);
    const response = await verify(request("verify"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: old.user });
    expect(mocks.session.sessionId).not.toBe(old.sessionId);
    expect(await validateSession(old)).toBeNull();
    expect(await validateSession(mocks.session)).toEqual(old.user);
  });

  it("invalidates copied credentials server-side before reporting logout success", async () => {
    const copied = await issueSession();
    expect((await logout(request("logout"))).status).toBe(200);
    expect(mocks.session.destroy).toHaveBeenCalledOnce();
    expect(await validateSession(copied)).toBeNull();
    mocks.session = { ...copied, save: vi.fn(), destroy: vi.fn() };
    const response = await readSession(
      new Request("https://app.example/api/auth/session", { headers: { host: "app.example" } }),
    );
    expect(await response.json()).toEqual({ user: null });
  });

  it("logout-all invalidates both copied sessions", async () => {
    const first = await issueSession();
    const second = await issueSession();
    expect((await logoutAll(request("logout-all"))).status).toBe(200);
    expect(await validateSession(first)).toBeNull();
    expect(await validateSession(second)).toBeNull();
  });

  it("rejects old cookies and makes store outages explicit without claiming logout", async () => {
    await issueSession();
    mocks.session.sessionId = undefined;
    expect(await (await readSession(request("session"))).json()).toEqual({ user: null });
    await issueSession();
    mocks.session.destroy.mockClear();
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://session.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-test-only");
    expect((await readSession(request("session"))).status).toBe(503);
    expect((await logout(request("logout"))).status).toBe(503);
    expect((await logoutAll(request("logout-all"))).status).toBe(503);
    expect(mocks.session.destroy).not.toHaveBeenCalled();
  });
});
