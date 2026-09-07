import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const originalEnv = { ...process.env };
let tables: Record<string, Row[]>;
let failLedgerWrites: boolean;

function tableRows(table: string) {
  const rows = tables[table];
  if (!rows) throw new Error(`Missing in-memory table: ${table}`);
  return rows;
}

function matches(row: Row, endpoint: URL) {
  return [...endpoint.searchParams.entries()]
    .filter(([key]) => key !== "select" && key !== "limit")
    .every(([key, value]) => String(row[key]) === value.replace(/^eq\./, ""));
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const endpoint = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const table = endpoint.pathname.split("/").at(-1) ?? "";
  const method = init?.method ?? "GET";
  tables[table] ??= [];
  const rows = tableRows(table);

  if (table === "ledger_events" && method === "POST" && failLedgerWrites) {
    return new Response("temporary outage", { status: 503 });
  }
  if (method === "GET") {
    const limit = Number(endpoint.searchParams.get("limit") ?? Number.POSITIVE_INFINITY);
    return Response.json(rows.filter((row) => matches(row, endpoint)).slice(0, limit));
  }
  const body: Row | Row[] | undefined = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (method === "POST") {
    if (!body) throw new Error("POST body is required");
    const inserted = (Array.isArray(body) ? body : [body]).map((row, index) => ({
      id: row.id ?? `${table}-${rows.length + index + 1}`,
      ...row,
    }));
    rows.push(...inserted);
    return Response.json(inserted);
  }
  if (method === "PATCH") {
    const changed = rows.filter((row) => matches(row, endpoint));
    for (const row of changed) Object.assign(row, body);
    return Response.json(changed);
  }
  const removed = rows.filter((row) => matches(row, endpoint));
  tables[table] = rows.filter((row) => !matches(row, endpoint));
  return Response.json(removed);
}

const transfer = {
  walletAddress: "0x1111111111111111111111111111111111111111",
  txHash: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  toAddress: "0x2222222222222222222222222222222222222222",
  amount: 1_000_000n,
  blockNumber: 20,
  timestamp: new Date("2025-01-01T00:00:00.000Z"),
};

describe("Supabase synchronization", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    tables = {
      governed_wallets: [
        {
          id: "wallet-1",
          organization_id: "organization-1",
          wallet_address: transfer.walletAddress,
          chain_id: 5042002,
          label: "Treasury",
          status: "active",
        },
      ],
      public_wallet_profiles: [],
      ledger_events: [],
      unlinked_ledger_events: [],
      indexer_checkpoints: [],
    };
    failLedgerWrites = false;
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores a repeated ledger event only once", async () => {
    const { syncTransferExecuted } = await import("./supabase-sync");
    await syncTransferExecuted(transfer);
    await syncTransferExecuted(transfer);
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]).toMatchObject({ tx_hash: transfer.txHash.toLowerCase() });
  });

  it("stages an event when its wallet row does not exist", async () => {
    tables.governed_wallets = [];
    const { syncTransferExecuted } = await import("./supabase-sync");
    await syncTransferExecuted(transfer);
    expect(tableRows("ledger_events")).toHaveLength(0);
    expect(tableRows("unlinked_ledger_events")).toHaveLength(1);
    expect(tableRows("unlinked_ledger_events")[0]).toMatchObject({
      wallet_address: transfer.walletAddress,
      event_kind: "transfer_executed",
      event_key: transfer.txHash.toLowerCase(),
    });
  });

  it("retains a failed write and stops the checkpoint before it", async () => {
    failLedgerWrites = true;
    const { syncCheckpoint, syncTransferExecuted } = await import("./supabase-sync");
    await syncTransferExecuted(transfer);
    await syncCheckpoint(30);
    expect(tableRows("indexer_checkpoints")[0]).toMatchObject({
      last_block: transfer.blockNumber - 1,
      status: "degraded",
    });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("temporary outage"));
  });

  it("advances a successful checkpoint to the indexed block", async () => {
    const { syncCheckpoint, syncTransferExecuted } = await import("./supabase-sync");
    await syncTransferExecuted(transfer);
    await syncCheckpoint(30);
    expect(tableRows("indexer_checkpoints")[0]).toMatchObject({
      last_block: 30,
      status: "synced",
      error_note: null,
    });
  });
});
