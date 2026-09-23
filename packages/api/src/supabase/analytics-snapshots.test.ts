import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../context";
import { analyticsRouter } from "../routers/analytics";
import { readAnomalyCounts, readLedgerSummary } from "./analytics";
import type { SupabaseRequestOptions, SupabaseRow, SupabaseRows } from "./client";
import { readSupabaseTransfers } from "./ledger";
import { oldSchemaAnalyticsRpc } from "./scoped-analytics.test-support";
import {
  readSupabaseAgentCounts,
  readSupabaseAgents,
  readSupabaseLegacyWalletCount,
  readSupabasePolicyCount,
  readSupabaseWallets,
} from "./wallets";

const OWNER = `0x${"11".repeat(20)}`;
const OTHER = `0x${"22".repeat(20)}`;
const FACTORY = `0x${"44".repeat(20)}`;
const NOW = new Date("2026-09-23T12:00:00Z");
const RECENT = "2026-09-23T11:00:00Z";
const OLD = "2025-01-01T00:00:00Z";
afterEach(() => vi.useRealTimers());

function fixture(input: Record<string, SupabaseRow[]>, cap = 73, owner = OWNER) {
  const selectRows = vi.fn(async (table: string, options: SupabaseRequestOptions = {}) => {
    let rows = [...(input[table] ?? [])];
    for (const [key, value] of Object.entries(options.filters ?? {})) {
      rows = rows.filter((row) => row[key] === value);
    }
    for (const [key, values] of Object.entries(options.inFilters ?? {})) {
      rows = rows.filter((row) => values.includes(String(row[key])));
    }
    for (const [key, value] of Object.entries(options.gte ?? {})) {
      rows = rows.filter((row) => String(row[key]) >= String(value));
    }
    for (const [key, value] of Object.entries(options.lte ?? {})) {
      rows = rows.filter((row) => String(row[key]) <= String(value));
    }
    const column = options.beforeColumn ?? options.order?.split(".")[0] ?? "created_at";
    rows.sort(
      (a, b) =>
        String(b[column]).localeCompare(String(a[column])) ||
        String(b.id).localeCompare(String(a.id)),
    );
    const before = options.before;
    if (before) {
      rows = rows.filter(
        (row) =>
          String(row[column]) < before.createdAt ||
          (String(row[column]) === before.createdAt && String(row.id) < before.id),
      );
    }
    const page = rows.slice(0, Math.min(options.limit ?? cap, cap)) as SupabaseRows;
    page.contentRange = page.length ? `0-${page.length - 1}/${rows.length}` : "*/0";
    return page;
  });
  const ctx: ApiContext = {
    db: null as never,
    session: {
      walletAddress: owner,
      tenantId: `tenant-${owner}`,
      role: "owner",
      expiresAt: NOW.getTime() + 60_000,
    },
    publicClient: null as never,
    supabase: {
      configured: true,
      selectRows,
      insertRows: async () => [],
      upsertRows: async () => [],
      patchRows: async () => [],
      callFunction: oldSchemaAnalyticsRpc,
    },
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  };
  return { ctx, selectRows };
}

function wallet(id: string, owner = OWNER, factory = FACTORY): SupabaseRow {
  return {
    id,
    wallet_address: `0x${id.padStart(40, "0")}`,
    owner_address: owner,
    wallet_factory_address: factory,
    created_at: OLD,
  };
}
function ledger(id: number, walletId = "1", status = "allowed", eventTime = RECENT): SupabaseRow {
  return {
    id: String(id).padStart(8, "0"),
    governed_wallet_id: walletId,
    status,
    amount_usdc: "1.25",
    event_time: eventTime,
  };
}

describe("streamed request analytics", () => {
  it("shares overlapping public procedures without changing their response contracts", async () => {
    vi.useFakeTimers({ now: NOW });
    const { ctx, selectRows } = fixture({
      governed_wallets: [wallet("1"), wallet("2")],
      ledger_events: [ledger(1), ledger(2, "2", "allowed", OLD)],
    });
    const caller = analyticsRouter.createCaller(ctx);
    const [activity, value] = await Promise.all([
      caller.walletActivity24h(),
      caller.valueGoverned24h(),
    ]);
    expect(value).toEqual({
      valueBaseUnits: "1250000",
      movementCount: 1,
      outcome: "ALLOW",
      windowStart: "2026-09-22T12:00:00.000Z",
      windowEnd: NOW.toISOString(),
      complete: true,
    });
    expect(activity.rows).toEqual([
      { walletId: "1", spendBaseUnits: "1250000", lastActivityAt: new Date(RECENT).toISOString() },
      { walletId: "2", spendBaseUnits: "0", lastActivityAt: OLD.replace("Z", ".000Z") },
    ]);
    expect(selectRows.mock.calls.filter(([table]) => table === "ledger_events")).toHaveLength(1);
  });

  it("keeps inclusive day boundaries, future/all-time activity, and legacy timestamp/units", async () => {
    vi.useFakeTimers({ now: NOW });
    const legacy = { ...ledger(4), event_time: null, created_at: RECENT, amount: "2.000001" };
    const { ctx } = fixture({
      governed_wallets: [wallet("1")],
      ledger_events: [
        ledger(0, "1", "allowed", "2026-09-22T12:00:00.000Z"),
        ledger(1, "1", "allowed", NOW.toISOString()),
        ledger(2, "1", "allowed", "2026-09-22T11:59:59.999Z"),
        ledger(3, "1", "allowed", "2026-09-23T12:00:00.001Z"),
        legacy,
      ],
    });
    const summary = await readLedgerSummary(ctx, true);
    expect(summary.movementCount).toBe(3);
    expect(summary.valueBaseUnits).toBe(4_500_001n);
    expect(summary.activity.get("1")?.lastActivityAt?.toISOString()).toBe(
      "2026-09-23T12:00:00.001Z",
    );
  });

  it("rejects non-progressing pages instead of reporting a partial aggregate", async () => {
    const { ctx, selectRows } = fixture({ governed_wallets: [wallet("1")] });
    const original = selectRows.getMockImplementation();
    if (!original) throw new Error("Fixture selectRows is missing.");
    selectRows.mockImplementation(async (table, options) => {
      if (table !== "ledger_events") return original(table, options);
      const page = [ledger(1)] as SupabaseRows;
      page.contentRange = "0-0/*";
      return page;
    });
    await expect(readLedgerSummary(ctx, true)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("shares a large all-time scan with daily readers and matches legacy mapper results", async () => {
    vi.useFakeTimers({ now: NOW });
    const rows = Array.from({ length: 1205 }, (_, i) =>
      ledger(i, "1", ["allowed", "rejected", "escalated", "frozen"][i % 4]),
    );
    rows.push(ledger(1300, "2", "allowed", OLD));
    rows.push({ ...ledger(1301), verdict: "ALLOW", amount: "9007199254.740993" });
    const data = {
      governed_wallets: [wallet("1"), wallet("2"), wallet("3", OTHER)],
      ledger_events: [...rows, ledger(1400, "3")],
    };
    const { ctx, selectRows } = fixture(data);
    const [daily, allTime, blocked] = await Promise.all([
      readLedgerSummary(ctx),
      readLedgerSummary(ctx, true),
      readLedgerSummary(ctx),
    ]);
    expect(daily).toBe(allTime);
    expect(blocked).toBe(allTime);
    expect(selectRows.mock.calls.filter(([table]) => table === "ledger_events")).toHaveLength(
      Math.ceil(rows.length / 73),
    );
    expect(selectRows.mock.calls.filter(([table]) => table === "governed_wallets")).toHaveLength(1);
    const mapped = await readSupabaseTransfers(fixture(data).ctx);
    const allowed = mapped.filter(
      (row) => row.verdict === "ALLOW" && row.timestamp >= allTime.since && row.timestamp <= NOW,
    );
    expect(allTime.valueBaseUnits).toBe(allowed.reduce((sum, row) => sum + BigInt(row.amount), 0n));
    expect(allTime.movementCount).toBe(allowed.length);
    expect(allTime.total).toBe(mapped.length);
    expect(allTime.denied).toBe(mapped.filter((row) => row.verdict === "DENY").length);
    expect(allTime.activity.get("2")).toEqual({
      spendBaseUnits: 0n,
      lastActivityAt: new Date(OLD),
    });
    expect(allTime.activity.has("3")).toBe(false);
  });

  it("keeps a standalone daily read bounded and does not retain success across reads", async () => {
    vi.useFakeTimers({ now: NOW });
    const data = {
      governed_wallets: [wallet("1")],
      ledger_events: [ledger(1), ledger(2, "1", "allowed", OLD)],
    };
    const { ctx, selectRows } = fixture(data);
    expect((await readLedgerSummary(ctx)).total).toBe(1);
    expect(selectRows.mock.calls.find(([table]) => table === "ledger_events")?.[1]?.gte).toEqual({
      event_time: "2026-09-22T12:00:00.000Z",
    });
    data.ledger_events.push(ledger(3));
    expect((await readLedgerSummary(ctx)).total).toBe(2);
  });

  it("fails the whole aggregate on a later page outage and never caches the error as zero", async () => {
    vi.useFakeTimers({ now: NOW });
    const { ctx, selectRows } = fixture({
      governed_wallets: [wallet("1")],
      ledger_events: Array.from({ length: 150 }, (_, i) => ledger(i)),
    });
    const original = selectRows.getMockImplementation();
    if (!original) throw new Error("Fixture selectRows is missing.");
    selectRows.mockImplementation(async (table, options) => {
      if (table === "ledger_events" && options?.before) throw new Error("outage");
      return original(table, options);
    });
    await expect(readLedgerSummary(ctx, true)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    selectRows.mockImplementation(original);
    expect((await readLedgerSummary(ctx, true)).total).toBe(150);
  });

  it("counts all anomaly pages, preserving dismissed state and severity aliases", async () => {
    const { ctx } = fixture({
      governed_wallets: [wallet("1")],
      anomalies: Array.from({ length: 310 }, (_, i) => ({
        id: String(i).padStart(8, "0"),
        governed_wallet_id: "1",
        created_at: OLD,
        severity: i % 2 ? "critical" : "warning",
        status: i < 10 ? "dismissed" : "open",
      })),
    });
    expect(await readAnomalyCounts(ctx)).toEqual({ total: 300, danger: 150 });
  });

  it("isolates owners and cached posture keys and propagates a new caller's outage", async () => {
    vi.useFakeTimers({ now: NOW });
    const data = {
      governed_wallets: [wallet("1"), wallet("2", OTHER)],
      ledger_events: [ledger(1, "1", "denied"), ledger(2, "2")],
    };
    const a = fixture(data);
    const b = fixture(data, 73, OTHER);
    if (!a.ctx.session || !b.ctx.session) throw new Error("Fixture sessions are missing.");
    b.ctx.session.tenantId = a.ctx.session.tenantId;
    const differentTenant = fixture({ governed_wallets: [wallet("1")] });
    if (!differentTenant.ctx.session) throw new Error("Fixture session is missing.");
    differentTenant.ctx.session.tenantId = "another-tenant";
    expect(await analyticsRouter.createCaller(a.ctx).postureIndex()).toBe(97);
    expect(await analyticsRouter.createCaller(b.ctx).postureIndex()).toBe(100);
    expect(await analyticsRouter.createCaller(differentTenant.ctx).postureIndex()).toBe(0);
    vi.advanceTimersByTime(30_000);
    b.selectRows.mockRejectedValue(new Error("offline"));
    await expect(analyticsRouter.createCaller(b.ctx).postureIndex()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

it("discovers current and legacy agents once, and selects doctrine by version across pages", async () => {
  const { ctx, selectRows } = fixture({
    governed_wallets: [
      wallet("1"),
      wallet("2", OWNER, OTHER),
      wallet("3", OTHER),
      wallet("4", OWNER, ""),
    ],
    doctrines: Array.from({ length: 601 }, (_, i) => ({
      id: String(i).padStart(8, "0"),
      governed_wallet_id: "1",
      updated_at: OLD,
      version: 601 - i,
      signers: [OWNER],
    })),
  });
  const [agents, legacy] = await Promise.all([
    readSupabaseAgents(ctx),
    readSupabaseLegacyWalletCount(ctx),
  ]);
  expect(agents).toHaveLength(1);
  expect(agents[0]?.policyVersion).toBe(601);
  expect(legacy).toBe(2);
  expect(selectRows.mock.calls.filter(([table]) => table === "governed_wallets")).toHaveLength(1);
});

it("counts versions in one paged scoped query rather than per-wallet reads, capped per wallet", async () => {
  const { ctx, selectRows } = fixture(
    {
      governed_wallets: [wallet("1"), wallet("2"), wallet("3", OTHER)],
      doctrines: Array.from({ length: 604 }, (_, i) => ({
        id: String(i).padStart(8, "0"),
        governed_wallet_id: i < 601 ? "1" : i === 603 ? "3" : "2",
        updated_at: OLD,
      })),
    },
    1000,
  );
  expect(await readSupabasePolicyCount(ctx)).toBe(502);
  expect(selectRows.mock.calls.filter(([table]) => table === "doctrines")).toHaveLength(1);
});

it("propagates policy count outages, without substituting an empty policy count", async () => {
  const { ctx, selectRows } = fixture({ governed_wallets: [wallet("1")] });
  const original = selectRows.getMockImplementation();
  if (!original) throw new Error("Fixture selectRows is missing.");
  selectRows.mockImplementation(async (table, options) => {
    if (table === "doctrines") throw new Error("doctrine outage");
    return original(table, options);
  });
  await expect(readSupabasePolicyCount(ctx)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
});

it("unions paged organization and direct-owner wallets, deduplicating factory partitions", async () => {
  const { ctx, selectRows } = fixture(
    {
      profiles: [{ id: "profile", wallet_address: OWNER }],
      organization_members: [{ profile_id: "profile", organization_id: "org", role: "viewer" }],
      governed_wallets: [
        { ...wallet("1"), organization_id: "org" },
        { ...wallet("2", OTHER), organization_id: "org" },
        wallet("3"),
        { ...wallet("4", OTHER), organization_id: "other-org" },
        { ...wallet("5", OTHER, OTHER), organization_id: "org" },
        { ...wallet("6", OWNER, ""), organization_id: "org" },
      ],
    },
    2,
  );
  const [wallets, legacy] = await Promise.all([
    readSupabaseWallets(ctx),
    readSupabaseLegacyWalletCount(ctx),
  ]);
  expect(wallets.map((item) => item.id).sort()).toEqual(["1", "2", "3"]);
  expect(legacy).toBe(2);
  expect(selectRows.mock.calls.filter(([table]) => table === "governed_wallets")).toHaveLength(4);
});

it("counts frozen signers, not wallets, using the same current doctrine and signer rules", async () => {
  const { ctx } = fixture({
    governed_wallets: [{ ...wallet("1"), status: "restraint" }, wallet("2")],
    doctrines: [
      { id: "one", governed_wallet_id: "1", version: 1, updated_at: OLD, signers: [OWNER] },
      {
        id: "two",
        governed_wallet_id: "1",
        version: 2,
        updated_at: OLD,
        signers: [OWNER, OTHER, OWNER, "invalid", `0x${"0".repeat(40)}`],
      },
      { id: "three", governed_wallet_id: "2", version: 1, updated_at: OLD, signers: [OWNER] },
    ],
  });
  const [counts, agents] = await Promise.all([
    readSupabaseAgentCounts(ctx),
    readSupabaseAgents(ctx),
  ]);
  expect(counts).toEqual({
    frozen: agents.filter((agent) => agent.status === "frozen").length,
    active: agents.filter((agent) => agent.status === "active").length,
  });
  expect(counts.frozen).toBe(3);
  expect(counts.active).toBe(1);
});
