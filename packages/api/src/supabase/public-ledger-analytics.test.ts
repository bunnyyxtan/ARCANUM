import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../context";
import { analyticsRouter } from "../routers/analytics";
import { ledgerRouter } from "../routers/ledger";
import type { SupabaseRequestOptions, SupabaseRow } from "./client";
import { readSupabasePublicWalletProfile } from "./health";
import { readSupabasePublicLedger } from "./ledger";

const OWNER = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";
const ORG = "10000000-0000-4000-8000-000000000001";
const PROFILE = "20000000-0000-4000-8000-000000000002";
const WALLET_ID = "30000000-0000-4000-8000-000000000003";
const OTHER_WALLET_ID = "40000000-0000-4000-8000-000000000004";

afterEach(() => {
  vi.unstubAllEnvs();
});

function walletRow(id: string, address: string, organizationId = ORG): SupabaseRow {
  return {
    id,
    organization_id: organizationId,
    wallet_address: address,
    owner_address: OWNER,
    wallet_factory_address: "0x4444444444444444444444444444444444444444",
    label: "Treasury wallet",
    created_at: "2026-09-01T00:00:00.000Z",
  };
}

function context(
  selectRows: (table: string, options?: SupabaseRequestOptions) => Promise<SupabaseRow[]>,
  anonymous = false,
): ApiContext {
  return {
    db: null as never,
    session: anonymous
      ? null
      : {
          walletAddress: OWNER,
          tenantId: ORG,
          role: "owner",
          expiresAt: Date.now() + 60_000,
        },
    publicClient: null as never,
    supabase: {
      configured: true,
      selectRows,
      insertRows: () => Promise.resolve([]),
      upsertRows: () => Promise.resolve([]),
      patchRows: () => Promise.resolve([]),
      callFunction: () => Promise.resolve(null),
    },
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  };
}

function publicReaderContext(input: {
  showPublicBadge: boolean | string;
  includeWallet?: boolean;
  ledgerRows?: SupabaseRow[];
}) {
  const calls: string[] = [];
  const profile = {
    id: PROFILE,
    wallet_address: WALLET,
    show_public_badge: input.showPublicBadge,
    label: "Public treasury",
    posture_score: 92,
  };
  const selectRows = async (table: string, options?: SupabaseRequestOptions) => {
    calls.push(table);
    if (table === "public_wallet_profiles") {
      return [profile];
    }
    if (table === "governed_wallets" && input.includeWallet !== false) {
      return [walletRow(WALLET_ID, WALLET)];
    }
    if (table === "ledger_events") {
      return input.ledgerRows ?? [];
    }
    if (table === "doctrines") {
      return [];
    }
    return [];
  };
  return { calls, ctx: context(selectRows, true) };
}

describe("public publication gate", () => {
  it("does not resolve wallet or ledger metadata for an opted-out profile", async () => {
    const { calls, ctx } = publicReaderContext({ showPublicBadge: false });

    await expect(readSupabasePublicWalletProfile(ctx, WALLET)).resolves.toBeNull();
    expect(calls).toEqual(["public_wallet_profiles"]);

    calls.length = 0;
    await expect(readSupabasePublicLedger(ctx, WALLET)).resolves.toEqual([]);
    expect(calls).toEqual(["public_wallet_profiles"]);
  });

  it("requires a profile row and explicit opt-in before public fallback reads", async () => {
    const { calls, ctx } = publicReaderContext({
      showPublicBadge: true,
      includeWallet: false,
    });
    const result = await readSupabasePublicWalletProfile(ctx, WALLET);

    expect(result).toMatchObject({
      walletAddress: WALLET,
      label: "Public treasury",
      postureScore: 92,
    });
    expect(calls).toContain("governed_wallets");

    const missingProfileCalls: string[] = [];
    const missingProfile = context(async (table) => {
      missingProfileCalls.push(table);
      return [];
    }, true);
    await expect(readSupabasePublicWalletProfile(missingProfile, WALLET)).resolves.toBeNull();
    expect(missingProfileCalls).toEqual(["public_wallet_profiles"]);
  });
});

describe("tenant-scoped ledger pagination and 24h outcomes", () => {
  it("returns explicit page metadata without dropping rows after the first 100", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const rows = Array.from({ length: 125 }, (_, index) => ({
      ...walletLedgerRow(WALLET_ID, index),
      tenant_id: ORG,
    }));
    const wallets = [
      walletRow(WALLET_ID, WALLET),
      walletRow(OTHER_WALLET_ID, OTHER_WALLET, "other-org"),
    ];
    const ctx = context(async (table, options) => {
      if (table === "profiles") return [{ id: PROFILE }];
      if (table === "organization_members") return [{ organization_id: ORG, role: "owner" }];
      if (table === "governed_wallets") {
        const organizationId = options?.filters?.organization_id;
        const address = options?.filters?.owner_address;
        const filtered = wallets.filter(
          (wallet) =>
            (!organizationId || wallet.organization_id === organizationId) &&
            (!address || wallet.owner_address === address),
        );
        return pageRows(filtered, options, "created_at");
      }
      if (table === "ledger_events") return pageRows(rows, options, "event_time");
      return [];
    });

    const result = await ledgerRouter.createCaller(ctx).list({ page: 0, pageSize: 100 });
    expect(result.rows).toHaveLength(100);
    expect(result.totalCount).toBe(125);
    expect(result.hasNext).toBe(true);
    expect(result.subset).toBe("page");
    expect(result.scope).toBe("tenant-wallets");
    expect(result.rows.every((row) => row.walletId === WALLET_ID)).toBe(true);
  });

  it("counts only executed ALLOW and blocked outcomes in the true 24h window", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const now = Date.now();
    const rows = [
      walletLedgerRow(WALLET_ID, 1, new Date(now - 60 * 60 * 1000), "allowed", 2),
      walletLedgerRow(WALLET_ID, 2, new Date(now - 2 * 60 * 60 * 1000), "escalated", 9),
      walletLedgerRow(WALLET_ID, 3, new Date(now - 25 * 60 * 60 * 1000), "allowed", 100),
      walletLedgerRow(WALLET_ID, 4, new Date(now - 3 * 60 * 60 * 1000), "blocked", 1),
      walletLedgerRow(WALLET_ID, 5, new Date(now - 4 * 60 * 60 * 1000), "frozen", 1),
    ];
    const ctx = context(async (table, options) => {
      if (table === "profiles") return [{ id: PROFILE }];
      if (table === "organization_members") return [{ organization_id: ORG, role: "owner" }];
      if (table === "governed_wallets")
        return pageRows([walletRow(WALLET_ID, WALLET)], options, "created_at");
      if (table === "ledger_events") return pageRows(rows, options, "event_time");
      return [];
    });

    const analytics = analyticsRouter.createCaller(ctx);
    const value = await analytics.valueGoverned24h();
    const activity = await analytics.walletActivity24h();
    const blocked = await analytics.threatsBlocked24h();

    expect(value).toMatchObject({
      valueBaseUnits: "2000000",
      movementCount: 1,
      outcome: "ALLOW",
      complete: true,
    });
    expect(value.windowStart).toBeTruthy();
    expect(value.windowEnd).toBeTruthy();
    expect(activity).toMatchObject({
      rows: [
        {
          walletId: WALLET_ID,
          spendBaseUnits: "2000000",
          lastActivityAt: expect.any(String),
        },
      ],
      complete: true,
    });
    expect(blocked).toMatchObject({
      count: 2,
      outcomes: ["DENY", "FREEZE"],
      complete: true,
    });
  });

  it("reaches the final ledger pages past 1,000 rows under a smaller server cap", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const rows: SupabaseRow[] = Array.from({ length: 2_505 }, (_, index) => ({
      ...walletLedgerRow(WALLET_ID, index),
      tenant_id: ORG,
    }));
    const ctx = context(async (table, options) => {
      if (table === "profiles") return [{ id: PROFILE }];
      if (table === "organization_members") return [{ organization_id: ORG, role: "owner" }];
      if (table === "governed_wallets") {
        return pageRows([walletRow(WALLET_ID, WALLET)], options, "created_at", 37);
      }
      if (table === "ledger_events") return pageRows(rows, options, "event_time", 37);
      return [];
    });

    const page24 = await ledgerRouter.createCaller(ctx).list({ page: 24, pageSize: 100 });
    expect(page24.rows).toHaveLength(100);
    expect(page24.rows[0]?.id).toBe(rows[2_400]?.id);
    expect(page24.rows[99]?.id).toBe(rows[2_499]?.id);
    expect(page24.totalCount).toBe(2_505);
    expect(page24.hasNext).toBe(true);

    const page25 = await ledgerRouter.createCaller(ctx).list({ page: 25, pageSize: 100 });
    expect(page25.rows).toHaveLength(5);
    expect(page25.rows[0]?.id).toBe(rows[2_500]?.id);
    expect(page25.hasNext).toBe(false);
    expect(page25.hasPrevious).toBe(true);
  });

  it("keeps unknown public totals honest while exhausting a capped read", async () => {
    const rows: SupabaseRow[] = Array.from({ length: 2_505 }, (_, index) => ({
      ...walletLedgerRow(WALLET_ID, index),
    }));
    const publicContext = context(async (table: string, options?: SupabaseRequestOptions) => {
      if (table === "public_wallet_profiles") {
        return [{ wallet_address: WALLET, show_public_badge: true }];
      }
      if (table === "governed_wallets") return [walletRow(WALLET_ID, WALLET)];
      if (table === "ledger_events") return pageRows(rows, options, "event_time", 31);
      return [];
    }, true);

    const result = await ledgerRouter.createCaller(publicContext).byWallet({
      wallet: WALLET,
      page: 10,
      pageSize: 100,
    });
    expect(result.rows).toHaveLength(100);
    expect(result.totalCount).toBeNull();
    expect(result.hasNext).toBe(true);
  });

  it("keeps legacy created_at ledger rows reachable through keyset pagination", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const rows: SupabaseRow[] = Array.from({ length: 1_001 }, (_, index) => {
      const row = walletLedgerRow(WALLET_ID, index);
      const { event_time: _eventTime, ...legacy } = row;
      return { ...legacy, created_at: row.event_time, tenant_id: ORG };
    });
    const ctx = context(async (table, options) => {
      if (table === "profiles") return [{ id: PROFILE }];
      if (table === "organization_members") return [{ organization_id: ORG, role: "owner" }];
      if (table === "governed_wallets") {
        return pageRows([walletRow(WALLET_ID, WALLET)], options, "created_at");
      }
      if (table === "ledger_events") return pageRows(rows, options, "event_time", 23);
      return [];
    });

    const result = await ledgerRouter.createCaller(ctx).list({ page: 9, pageSize: 100 });
    expect(result.rows).toHaveLength(100);
    expect(result.rows[0]?.id).toBe(rows[900]?.id);
    expect(result.hasNext).toBe(true);
  });

  it("fails explicitly when a read adapter never advances its cursor", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const ctx = context(async (table) => {
      if (table === "profiles") return [{ id: PROFILE }];
      if (table === "organization_members") return [{ organization_id: ORG, role: "owner" }];
      if (table === "governed_wallets") return [walletRow(WALLET_ID, WALLET)];
      if (table === "ledger_events") {
        const page = [walletLedgerRow(WALLET_ID, 0)];
        Object.defineProperty(page, "contentRange", { configurable: true, value: "0-0/2" });
        return page;
      }
      return [];
    });

    await expect(ledgerRouter.createCaller(ctx).list({ page: 0, pageSize: 50 })).rejects.toThrow(
      /live data service is unavailable/i,
    );
  });
});

function walletLedgerRow(
  walletId: string,
  index: number,
  timestamp = new Date(Date.now() - index * 60_000),
  status = "allowed",
  amount = 1,
): SupabaseRow {
  return {
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    governed_wallet_id: walletId,
    event_time: timestamp.toISOString(),
    tx_hash: `0x${String(index + 1).padStart(64, "0")}`,
    status,
    amount_usdc: amount,
    counterparty_address: "0x5555555555555555555555555555555555555555",
    decision_reason: "indexed decision",
    block_number: index + 1,
  };
}

function pageRows(
  rows: SupabaseRow[],
  options: SupabaseRequestOptions | undefined,
  column: string,
  serverCap = Number.POSITIVE_INFINITY,
) {
  const ordered = [...rows].sort((left, right) => {
    const leftTime = String(left[column] ?? left.created_at ?? "");
    const rightTime = String(right[column] ?? right.created_at ?? "");
    return rightTime.localeCompare(leftTime) || String(right.id).localeCompare(String(left.id));
  });
  const afterCursor = options?.before
    ? ordered.filter((row) => {
        const timestamp = String(row[column] ?? row.created_at ?? "");
        const id = String(row.id);
        const before = options.before;
        return (
          timestamp < (before?.createdAt ?? "") ||
          (timestamp === before?.createdAt && id < (before?.id ?? ""))
        );
      })
    : ordered;
  const page = afterCursor.slice(0, Math.min(options?.limit ?? afterCursor.length, serverCap));
  if (Number.isFinite(serverCap)) {
    Object.defineProperty(page, "contentRange", {
      configurable: true,
      value: `0-${Math.max(page.length - 1, 0)}/${afterCursor.length}`,
    });
  }
  return page;
}
