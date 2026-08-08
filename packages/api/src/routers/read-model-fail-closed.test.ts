import { describe, expect, it } from "vitest";

import type { ApiContext } from "../context";
import { READ_MODEL_UNAVAILABLE_MESSAGE } from "../supabase";
import { analyticsRouter } from "./analytics";
import { escalationsRouter } from "./escalations";
import { eventsRouter } from "./events";
import { ledgerRouter } from "./ledger";
import { vendorsRouter } from "./vendors";
import { walletsRouter } from "./wallets";

// The whole promise of the product is showing what an AI agent spent. A
// read-model outage must therefore surface as an explicit error the UI can
// render as "data unavailable" - never as a calm, believable, empty dashboard.

const OWNER = "0x1111111111111111111111111111111111111111";

function sessionCtx(supabase: ApiContext["supabase"]): ApiContext {
  return {
    db: null as never,
    session: {
      walletAddress: OWNER,
      tenantId: "20000000-0000-4000-8000-000000000002",
      role: "owner",
      expiresAt: Date.now() + 60_000,
    },
    publicClient: null as never,
    supabase,
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  } satisfies ApiContext;
}

const brokenSupabase: NonNullable<ApiContext["supabase"]> = {
  configured: true,
  selectRows: () => Promise.reject(new Error("connect ECONNREFUSED (simulated outage)")),
  upsertRows: () => Promise.reject(new Error("connect ECONNREFUSED (simulated outage)")),
  patchRows: () => Promise.reject(new Error("connect ECONNREFUSED (simulated outage)")),
  callFunction: () => Promise.reject(new Error("connect ECONNREFUSED (simulated outage)")),
};

const unavailable = {
  code: "INTERNAL_SERVER_ERROR",
  message: READ_MODEL_UNAVAILABLE_MESSAGE,
};

describe("read model fails closed", () => {
  it("surfaces a Supabase outage as an explicit error, not an empty ledger", async () => {
    const caller = ledgerRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(caller.list({ page: 0, pageSize: 50 })).rejects.toMatchObject(unavailable);
  });

  it("fails closed when Supabase is not configured at all", async () => {
    const caller = ledgerRouter.createCaller(sessionCtx(null));
    await expect(caller.list({ page: 0, pageSize: 50 })).rejects.toMatchObject(unavailable);
  });

  it("never reports zero pending escalations during an outage", async () => {
    const escalations = escalationsRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(escalations.list(undefined)).rejects.toMatchObject(unavailable);

    const analytics = analyticsRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(analytics.pendingEscalations()).rejects.toMatchObject(unavailable);
  });

  it("never renders an empty vendor allowlist or wallet fleet during an outage", async () => {
    const vendors = vendorsRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(vendors.list()).rejects.toMatchObject(unavailable);

    const wallets = walletsRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(wallets.list()).rejects.toMatchObject(unavailable);
  });

  it("surfaces an outage in the governed event stream, not an empty feed", async () => {
    const events = eventsRouter.createCaller(sessionCtx(brokenSupabase));
    await expect(events.list({ page: 0, pageSize: 50 })).rejects.toMatchObject(unavailable);
  });

  it("fails closed for the event stream when Supabase is not configured", async () => {
    const events = eventsRouter.createCaller(sessionCtx(null));
    await expect(events.list({ page: 0, pageSize: 50 })).rejects.toMatchObject(unavailable);
  });

  it("returns an empty event stream (not an error) for anonymous callers", async () => {
    const anonymous: ApiContext = {
      ...sessionCtx(brokenSupabase),
      session: null,
    };
    const events = eventsRouter.createCaller(anonymous);
    await expect(events.list({ page: 0, pageSize: 50 })).resolves.toEqual([]);
  });
});
