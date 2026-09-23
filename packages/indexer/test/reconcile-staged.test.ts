import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const originalExitCode = process.exitCode;

describe("one-shot staged reconciliation CLI", () => {
  beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    process.exitCode = originalExitCode;
    vi.doUnmock("../src/supabase-sync");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("awaits forced reconciliation without finalizing catch-up evidence", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const finalize = vi.fn();
    vi.doMock("../src/supabase-sync", () => ({
      syncStagedEvents: reconcile,
      syncConfirmedCatchup: finalize,
    }));
    await import("../scripts/reconcile-staged");
    expect(reconcile).toHaveBeenCalledOnce();
    expect(finalize).not.toHaveBeenCalled();
    expect(process.env.ARCANUM_DISABLE_PG_MIRROR).toBe("1");
    expect(process.exitCode).toBeUndefined();
  });

  it("returns a nonzero exit code on reconciliation failure", async () => {
    vi.doMock("../src/supabase-sync", () => ({
      syncStagedEvents: vi.fn().mockRejectedValue(new Error("write failed")),
    }));
    await import("../scripts/reconcile-staged");
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects missing credentials rather than silently succeeding", async () => {
    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.ARCANUM_DISABLE_PG_MIRROR = "";
    vi.stubGlobal("fetch", vi.fn());
    await import("../scripts/reconcile-staged");
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: expect.stringContaining("refuses to start") }),
    );
  });
});
