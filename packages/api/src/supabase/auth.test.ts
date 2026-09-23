import { afterEach, describe, expect, it, vi } from "vitest";

import { syncSupabaseAuthSession } from "./auth";

const USER = {
  walletAddress: "0x1111111111111111111111111111111111111111",
  tenantId: "10000000-0000-4000-8000-000000000001",
  role: "viewer",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("syncSupabaseAuthSession", () => {
  it("refuses multi-tenant mode before the unconfigured short-circuit can allow a session", async () => {
    vi.stubEnv("ARCANUM_DEPLOYMENT_MODE", "multi-tenant");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(syncSupabaseAuthSession(USER)).rejects.toThrow(/multi-tenant/);
  });

  it("reports unconfigured in single-tenant mode without Supabase env", async () => {
    vi.stubEnv("ARCANUM_DEPLOYMENT_MODE", "single-tenant");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(syncSupabaseAuthSession(USER)).resolves.toEqual({
      synced: false,
      reason: "unconfigured",
    });
  });
});
