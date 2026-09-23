import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../context";
import { readAnomalyCounts, readLedgerSummary } from "./analytics";
import { SupabaseRpcError, createSupabaseServiceRoleClient } from "./client";
import { moneyBaseUnits } from "./fields";
import { missingAnalyticsFunction } from "./scoped-analytics";
import { oldSchemaAnalyticsRpc } from "./scoped-analytics.test-support";
import { readSupabaseAgentCounts } from "./wallets";

const id = "00000000-0000-4000-8000-000000000001";
const owner = `0x${"11".repeat(20)}`;
const factory = `0x${"44".repeat(20)}`;
const now = new Date("2026-09-23T12:00:00Z");
const output = {
  total: 1,
  denied: 0,
  blocked24h: 0,
  movementCount: 1,
  valueBaseUnits: "9007199254740993000001",
  activity: [
    { walletId: id, spendBaseUnits: "9007199254740993000001", lastActivityAt: now.toISOString() },
  ],
};
const doctrine = {
  id,
  governed_wallet_id: id,
  version: 4,
  updated_at: now.toISOString(),
  signers: [owner],
  escalation_council: null,
  per_tx_cap_usdc: null,
  daily_cap_usdc: null,
  monthly_cap_usdc: null,
  escalate_above_usdc: null,
  quorum: null,
  require_vendor_allowlist: false,
};
function fixture() {
  const selectRows = vi.fn(async (table: string) =>
    table === "governed_wallets"
      ? [
          {
            id,
            wallet_address: owner,
            owner_address: owner,
            wallet_factory_address: factory,
          },
        ]
      : table === "ledger_events"
        ? [
            {
              id,
              governed_wallet_id: id,
              status: "allowed",
              amount_usdc: "1.25",
              event_time: now.toISOString(),
            },
          ]
        : [],
  );
  const callFunction = vi.fn(
    async (_fn: string, _args: Record<string, unknown>): Promise<unknown> => output,
  );
  const ctx = {
    session: {
      walletAddress: owner,
      tenantId: "tenant",
      role: "owner",
      expiresAt: now.getTime() + 60000,
    },
    supabase: { configured: true, selectRows, callFunction },
  } as unknown as ApiContext;
  return { ctx, selectRows, callFunction };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scoped analytics RPC integration", () => {
  it("coalesces promoted reads, sends server scope and keeps exact money without raw history", async () => {
    vi.useFakeTimers({ now });
    const { ctx, callFunction, selectRows } = fixture();
    const [daily, all] = await Promise.all([readLedgerSummary(ctx), readLedgerSummary(ctx, true)]);
    expect(daily).toBe(all);
    expect(all.valueBaseUnits).toBe(9007199254740993000001n);
    expect(callFunction).toHaveBeenCalledExactlyOnceWith("scoped_ledger_analytics", {
      p_wallet_ids: [id],
      p_owner_address: owner,
      p_organization_id: null,
      p_factory_address: factory,
      p_since: "2026-09-22T12:00:00.000Z",
      p_until: now.toISOString(),
      p_all_time: true,
    });
    expect(selectRows.mock.calls.some(([table]) => table === "ledger_events")).toBe(false);
    await readLedgerSummary(ctx);
    expect(callFunction).toHaveBeenCalledTimes(2);
  });

  it("only exact missing-signature capability invokes legacy exhaustive mapping", async () => {
    vi.useFakeTimers({ now });
    const { ctx, callFunction, selectRows } = fixture();
    callFunction.mockImplementation(oldSchemaAnalyticsRpc);
    expect((await readLedgerSummary(ctx, true)).valueBaseUnits).toBe(1250000n);
    expect(selectRows.mock.calls.some(([table]) => table === "ledger_events")).toBe(true);
  });

  it.each([
    new Error("network unavailable"),
    new SupabaseRpcError("scoped_ledger_analytics", 403, "42501", "permission denied"),
    new SupabaseRpcError(
      "scoped_ledger_analytics",
      404,
      "42883",
      "function public.internal_helper() does not exist",
    ),
    new SupabaseRpcError("scoped_ledger_analytics", 404, "PGRST202", "missing schema cache"),
    new SupabaseRpcError("scoped_ledger_analytics", 500, "22003", "numeric overflow"),
  ])("fails closed without a raw scan for %s", async (error) => {
    const { ctx, callFunction, selectRows } = fixture();
    callFunction.mockRejectedValue(error);
    await expect(readLedgerSummary(ctx, true)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(selectRows.mock.calls.some(([table]) => table === "ledger_events")).toBe(false);
    callFunction.mockResolvedValue(output);
    expect((await readLedgerSummary(ctx, true)).total).toBe(1);
  });

  it.each([
    null,
    {},
    { ...output, valueBaseUnits: Number("9007199254740993") },
    { ...output, activity: [{ ...output.activity[0], walletId: "foreign" }] },
  ])("rejects malformed RPC results rather than inventing zero", async (data) => {
    const { ctx, callFunction } = fixture();
    callFunction.mockResolvedValue(data);
    await expect(readLedgerSummary(ctx)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("bounds anomalies and current doctrines without history downloads", async () => {
    const { ctx, callFunction, selectRows } = fixture();
    callFunction.mockImplementation(async (fn) =>
      fn === "scoped_anomaly_counts" ? { total: 100, danger: 90 } : [doctrine],
    );
    expect(await readAnomalyCounts(ctx)).toEqual({ total: 100, danger: 90 });
    expect(await readSupabaseAgentCounts(ctx)).toEqual({ active: 1, frozen: 0 });
    expect(
      selectRows.mock.calls.some(([table]) => ["anomalies", "doctrines"].includes(table)),
    ).toBe(false);
  });

  it.each([
    { governed_wallet_id: id },
    { ...doctrine, signers: undefined },
    { ...doctrine, signers: "not-an-array" },
    { ...doctrine, version: undefined },
    { ...doctrine, version: 1.5 },
    { ...doctrine, updated_at: null },
    { ...doctrine, per_tx_cap_usdc: undefined },
    { ...doctrine, escalation_council: undefined },
  ])("rejects incomplete current doctrines rather than zeroing agents", async (row) => {
    const { ctx, callFunction, selectRows } = fixture();
    callFunction.mockResolvedValue([row]);
    await expect(readSupabaseAgentCounts(ctx)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(selectRows.mock.calls.some(([table]) => table === "doctrines")).toBe(false);
  });

  it.each([null, []])(
    "accepts explicitly nullable or empty doctrine signers: %s",
    async (signers) => {
      const { ctx, callFunction } = fixture();
      callFunction.mockResolvedValue([{ ...doctrine, signers }]);
      expect(await readSupabaseAgentCounts(ctx)).toEqual({ active: 0, frozen: 0 });
    },
  );

  it("preserves signed integer text from the numeric SQL aggregate", async () => {
    const { ctx, callFunction } = fixture();
    callFunction.mockResolvedValue({
      ...output,
      valueBaseUnits: "-1000000",
      activity: [{ ...output.activity[0], spendBaseUnits: "-1000000" }],
    });
    const summary = await readLedgerSummary(ctx);
    expect(summary.valueBaseUnits).toBe(-1000000n);
    expect(summary.activity.get(id)?.spendBaseUnits).toBe(-1000000n);
  });

  it("keeps legacy TEXT heuristics separate from native JSON numeric amounts", () => {
    // Dedicated legacy text fixture, NOT a claim about the numeric SQL column.
    const legacyText = ["-1", "10000000", "1e-6", "1.0000001"];
    expect(
      legacyText.map((amount_usdc) => moneyBaseUnits({ amount_usdc }, ["amount_usdc"])),
    ).toEqual(["0", "10000000", "0", "0"]);
    const nativeNumbers = JSON.parse("[-1,10000000,1e-6]");
    expect(
      nativeNumbers.map((amount_usdc: number) => moneyBaseUnits({ amount_usdc }, ["amount_usdc"])),
    ).toEqual(["-1000000", "10000000000000", "1"]);
    // Old JSON-number reader fails closed when IEEE-754 multiplication is not
    // integral/safe; SQL exact arithmetic intentionally removes that limit.
    for (const amount_usdc of JSON.parse("[1.000001,9007199254740993.123456,10000000000000000]")) {
      expect(() => moneyBaseUnits({ amount_usdc }, ["amount_usdc"])).toThrow();
    }
  });

  it("requires the exact SQL missing signature, not a missing nested function", () => {
    expect(
      missingAnalyticsFunction(
        new SupabaseRpcError(
          "scoped_anomaly_counts",
          404,
          "42883",
          "function public.scoped_anomaly_counts(uuid[], text, uuid, text) does not exist",
        ),
        "scoped_anomaly_counts",
        {},
      ),
    ).toBe(true);
  });

  it("retains structured RPC errors from the real HTTP client", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "42501",
              message: "permission denied",
            }),
            { status: 403 },
          ),
      ),
    );
    await expect(
      createSupabaseServiceRoleClient()?.callFunction("scoped_ledger_analytics", {}),
    ).rejects.toMatchObject({ name: "SupabaseRpcError", code: "42501", status: 403 });
  });
});
