import { beforeEach, describe, expect, it, vi } from "vitest";

const { ping } = vi.hoisted(() => ({ ping: vi.fn() }));
vi.mock("@arcanum/api/server", () => ({
  createContext: vi.fn(() => ({})),
  appRouter: { createCaller: () => ({ health: { ping } }) },
}));
import { GET } from "./route";

const health = () => ({
  ok: true,
  checkedAt: "2026-09-16T12:00:00Z",
  network: { name: "mainnet", chainId: 5042 },
  readiness: { identity: { status: "available" } },
  rpc: { status: "available", latestBlock: "100", error: "secret-url" },
  supabase: {
    readModel: { status: "available", error: "secret-table", sampleRows: 1 },
    api: { error: "secret-key" },
  },
  indexer: {
    status: "available",
    lastCatchupAt: "2026-09-16T12:00:00Z",
    lastSeenChainBlock: 100,
    lastIndexedBlock: 1,
    staleAfterSeconds: 900,
    maxBlockLag: 900,
    error: "secret-query",
  },
});
beforeEach(() => {
  ping.mockReset();
});
describe("public readiness endpoint", () => {
  it("returns no-store 200 for full readiness and omits infrastructure details", async () => {
    ping.mockResolvedValue(health());
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("secret");
  });
  it("returns HTTP 503 for stale or unavailable dependencies", async () => {
    ping.mockResolvedValue({ ...health(), ok: false });
    expect((await GET()).status).toBe(503);
  });
  it("sanitizes exceptions and never treats missing data as healthy", async () => {
    ping.mockRejectedValue(new Error("provider-url-with-secret"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
