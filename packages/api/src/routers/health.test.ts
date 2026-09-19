import { ARC_CHAIN_ID } from "@arcanum/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../context";
import { healthRouter } from "./health";

const { readHealth, security } = vi.hoisted(() => ({
  readHealth: vi.fn(),
  security: vi.fn(),
}));
vi.mock("../supabase", () => ({ readSupabaseRuntimeHealth: readHealth }));
vi.mock("../health/readiness", () => ({ readSecurityReadiness: security }));
vi.mock("../rate-limit", () => ({ enforceRateLimit: vi.fn() }));

const rpc = { getBlockNumber: vi.fn(), getChainId: vi.fn() };
const ctx = { publicClient: rpc, supabase: {}, session: null } as unknown as ApiContext;
const dependencies = () => ({
  identity: { status: "available" },
  sessions: { status: "available" },
  rateLimit: { status: "available", backend: "supabase" },
});
const readModel = () => ({
  readModel: { status: "available" },
  indexerCheckpoint: {
    status: "available",
    lastIndexedBlock: 1,
    lastSeenChainBlock: 100,
    lastCatchupAt: new Date().toISOString(),
    lastEventAt: "2020-01-01T00:00:00Z",
  },
});
beforeEach(() => {
  readHealth.mockReset().mockResolvedValue(readModel());
  security.mockReset().mockResolvedValue(dependencies());
  rpc.getBlockNumber.mockReset().mockResolvedValue(100n);
  rpc.getChainId.mockReset().mockResolvedValue(ARC_CHAIN_ID);
});
describe("aggregate health", () => {
  it("is healthy on a quiet chain with fresh confirmed scan evidence", async () => {
    expect((await healthRouter.createCaller(ctx).ping()).ok).toBe(true);
  });
  it("fails stale catch-up even when every other dependency is healthy", async () => {
    const data = readModel();
    data.indexerCheckpoint.lastCatchupAt = new Date(Date.now() - 901_000).toISOString();
    readHealth.mockResolvedValue(data);
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(false);
    expect(result.indexer.status).toBe("stale");
  });
  it("fails missing confirmed cursor instead of using recent event progress", async () => {
    const data = readModel();
    readHealth.mockResolvedValue({
      ...data,
      indexerCheckpoint: { ...data.indexerCheckpoint, lastSeenChainBlock: null },
    });
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(false);
    expect(result.indexer.status).toBe("unknown");
  });
  it("rejects a recent READY marker with an ancient cursor", async () => {
    rpc.getBlockNumber.mockResolvedValue(1_001n);
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(false);
    expect(result.indexer.status).toBe("unknown");
  });
  it("accepts a recent READY marker within the bounded cursor lag", async () => {
    rpc.getBlockNumber.mockResolvedValue(1_000n);
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(true);
    expect(result.indexer.maxBlockLag).toBe(900);
  });
  it("rejects a cursor ahead of the RPC tip", async () => {
    rpc.getBlockNumber.mockResolvedValue(99n);
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(false);
    expect(result.indexer.status).toBe("unknown");
  });
  it("rejects a responsive RPC on the wrong network", async () => {
    rpc.getChainId.mockResolvedValue(1);
    const result = await healthRouter.createCaller(ctx).ping();
    expect(result.ok).toBe(false);
    expect(result.rpc.status).toBe("unavailable");
  });
  it.each(["identity", "sessions", "rateLimit"] as const)(
    "fails %s backend outages",
    async (key) => {
      const readiness = dependencies();
      readiness[key].status = "unavailable";
      security.mockResolvedValue(readiness);
      expect((await healthRouter.createCaller(ctx).ping()).ok).toBe(false);
    },
  );
  it("rejects read-model outages", async () => {
    readHealth.mockResolvedValue({ ...readModel(), readModel: { status: "unavailable" } });
    expect((await healthRouter.createCaller(ctx).ping()).ok).toBe(false);
  });
});
