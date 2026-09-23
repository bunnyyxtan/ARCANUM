import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const query = {
    wallets: { findFirst: vi.fn() },
    organizations: { findFirst: vi.fn() },
    events: { findFirst: vi.fn() },
    transfers: { findFirst: vi.fn() },
  };
  return { returning, values, insert, query };
});
vi.mock("@arcanum/db", () => ({ db: { insert: mocks.insert, query: mocks.query } }));

const originalEnv = { ...process.env };

describe("legacy mirror adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const event = {
    tenantId: "tenant",
    type: "CREATED",
    severity: "info" as const,
    payload: {},
    blockNumber: 30,
    txHash: "0xabc",
    timestamp: new Date(0),
  };

  it("performs no database operations in Supabase-only mode", async () => {
    process.env.ARCANUM_DISABLE_PG_MIRROR = "1";
    const mirror = await import("../src/legacy-mirror");
    await mirror.findWallet("0xABC", "tenant");
    await mirror.ensureOrganization("0xABC", "tenant");
    await mirror.insertEvent(event);
    await mirror.findTransferByTx("tenant", "0xabc");
    expect(mocks.insert).not.toHaveBeenCalled();
    for (const query of Object.values(mocks.query)) {
      expect(query.findFirst).not.toHaveBeenCalled();
    }
  });

  it("retains existing organization/event identity in enabled mode", async () => {
    process.env.ARCANUM_DISABLE_PG_MIRROR = "";
    const org = { id: "org" };
    const existing = { id: "event" };
    mocks.query.organizations.findFirst.mockResolvedValueOnce(org);
    mocks.query.events.findFirst.mockResolvedValueOnce(existing);
    const mirror = await import("../src/legacy-mirror");
    expect(await mirror.ensureOrganization("0xABC", "tenant")).toBe(org);
    expect(await mirror.insertEvent(event)).toBe(existing);
    expect(mocks.insert).not.toHaveBeenCalled();
    await mirror.findWallet("0xABC", "tenant");
    await mirror.findTransferByTx("tenant", "0xabc");
    expect(mocks.query.wallets.findFirst).toHaveBeenCalledOnce();
    expect(mocks.query.transfers.findFirst).toHaveBeenCalledOnce();
  });

  it("retains enabled-mode organization and event writes", async () => {
    process.env.ARCANUM_DISABLE_PG_MIRROR = "";
    mocks.query.organizations.findFirst.mockResolvedValueOnce(undefined);
    mocks.query.events.findFirst.mockResolvedValueOnce(undefined);
    mocks.returning.mockResolvedValueOnce([{ id: "created" }]);
    const mirror = await import("../src/legacy-mirror");
    expect(await mirror.ensureOrganization("0xABC", "tenant")).toEqual({ id: "created" });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant",
        ownerWallet: "0xabc",
      }),
    );
    await mirror.insertEvent(event);
    expect(mocks.values).toHaveBeenLastCalledWith(event);
  });
});
