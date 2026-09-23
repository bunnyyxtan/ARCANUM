import {
  ESCALATION_REASONS,
  ESCALATION_STATUSES,
  categorySchema,
  escalationReasonFromIndex,
  escalationStatusFromIndex,
} from "@arcanum/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertIdenticalLedgerEvent } from "../src/ledger-event";

type Row = Record<string, unknown>;

const originalEnv = { ...process.env };
let tables: Record<string, Row[]>;
let failLedgerWrites: boolean;
let legacyLedgerUnique: boolean;
let missingLedgerRpc: boolean;

function tableRows(table: string) {
  const rows = tables[table];
  if (!rows) throw new Error(`Missing in-memory table: ${table}`);
  return rows;
}

// Mirrors PostgREST's `column->>key` JSON text accessor for filter keys.
function columnValue(row: Row, key: string) {
  const [column, jsonKey] = key.split("->>");
  if (jsonKey === undefined) return row[key];
  const json = row[column ?? ""];
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  const value = (json as Row)[jsonKey];
  return value === undefined || value === null ? value : String(value);
}

function matches(row: Row, endpoint: URL) {
  return [...endpoint.searchParams.entries()]
    .filter(([key]) => !["select", "limit", "offset", "order"].includes(key))
    .every(([key, value]) => {
      const actual = columnValue(row, key);
      return value === "is.null"
        ? actual === null || actual === undefined
        : String(actual) === value.replace(/^eq\./, "");
    });
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const endpoint = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const table = endpoint.pathname.split("/").at(-1) ?? "";
  const method = init?.method ?? "GET";
  if (table === "insert_ledger_event") {
    if (missingLedgerRpc || legacyLedgerUnique) {
      return Response.json(
        {
          code: "PGRST202",
          message: "Could not find the function public.insert_ledger_event(p_event)",
        },
        { status: 404 },
      );
    }
    if (failLedgerWrites) return new Response("temporary outage", { status: 503 });
    const body = JSON.parse(String(init?.body)).p_event as Row;
    const rows = tableRows("ledger_events");
    const existing = rows.find(
      (row) =>
        row.chain_id === body.chain_id &&
        row.tx_hash === body.tx_hash &&
        row.log_index === body.log_index,
    );
    if (existing) {
      try {
        return Response.json([assertIdenticalLedgerEvent(existing, body)]);
      } catch (error) {
        return Response.json({ code: "23514", message: String(error) }, { status: 400 });
      }
    }
    const inserted = { id: `ledger_events-${rows.length + 1}`, ...body };
    rows.push(inserted);
    return Response.json([inserted]);
  }
  if (table === "finalize_indexer_catchup" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Row;
    const checkpoints = tableRows("indexer_checkpoints").filter(
      (row) =>
        row.deployment_id === body.p_deployment_id &&
        row.contract_name === `arcanum-indexer:${body.p_deployment_network}:${body.p_chain_id}`,
    );
    // Mirrors finalize_indexer_catchup: a legacy row without an identity only
    // counts while this deployment could still replay it.
    const pending = tableRows("unlinked_ledger_events").some(
      (row) =>
        row.deployment_id === body.p_deployment_id ||
        (row.deployment_id === null &&
          Number(row.block_number) >= Number(body.p_deployment_start_block)),
    );
    if (
      checkpoints.length > 1 ||
      (checkpoints[0] &&
        (checkpoints[0].status !== "synced" || String(checkpoints[0].error_note ?? "").trim())) ||
      pending
    ) {
      return new Response("finalization rejected", { status: 409 });
    }
    const evidence = {
      ...body,
      deployment_id: body.p_deployment_id,
      chain_id: body.p_chain_id,
      deployment_network: body.p_deployment_network,
      deployment_start_block: body.p_deployment_start_block,
      deployment_usdc_address: body.p_deployment_usdc_address,
      deployment_policy_engine_address: body.p_deployment_policy_engine_address,
      deployment_escalation_manager_address: body.p_deployment_escalation_manager_address,
      deployment_anomaly_oracle_address: body.p_deployment_anomaly_oracle_address,
      deployment_vendor_registry_address: body.p_deployment_vendor_registry_address,
      deployment_wallet_factory_address: body.p_deployment_wallet_factory_address,
      status: "ready",
      last_seen_at: "2025-01-01T00:00:00.000Z",
      last_seen_block: body.p_last_seen_block,
    };
    tables.indexer_catchup_evidence ??= [];
    tables.indexer_catchup_evidence.push(evidence);
    return Response.json([evidence]);
  }
  if (table === "sync_governed_wallet_owner" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Row;
    const wallet = tableRows("governed_wallets").find(
      (row) =>
        row.chain_id === body.p_chain_id &&
        String(row.wallet_address).toLowerCase() === String(body.p_wallet_address).toLowerCase(),
    );
    if (!wallet) {
      return Response.json(null);
    }

    const previousBlock = wallet.owner_sync_block as number | undefined;
    const previousLog = wallet.owner_sync_log_index as number | undefined;
    if (
      previousBlock !== undefined &&
      (Number(body.p_block_number) < previousBlock ||
        (Number(body.p_block_number) === previousBlock &&
          Number(body.p_log_index) <= (previousLog ?? -1)))
    ) {
      return Response.json(wallet);
    }
    if (
      String(wallet.owner_address).toLowerCase() !== String(body.p_previous_owner).toLowerCase() &&
      String(wallet.owner_address).toLowerCase() !== String(body.p_new_owner).toLowerCase()
    ) {
      return new Response("owner mismatch", { status: 409 });
    }

    Object.assign(wallet, {
      owner_address: String(body.p_new_owner).toLowerCase(),
      owner_sync_block: Number(body.p_block_number),
      owner_sync_log_index: Number(body.p_log_index),
      owner_sync_tx_hash: String(body.p_tx_hash).toLowerCase(),
    });
    return Response.json(wallet);
  }
  tables[table] ??= [];
  const rows = tableRows(table);

  if (table === "ledger_events" && method === "POST" && failLedgerWrites) {
    return new Response("temporary outage", { status: 503 });
  }
  if (method === "GET") {
    const limit = Number(endpoint.searchParams.get("limit") ?? Number.POSITIVE_INFINITY);
    const offset = Number(endpoint.searchParams.get("offset") ?? 0);
    return Response.json(
      rows.filter((row) => matches(row, endpoint)).slice(offset, offset + limit),
    );
  }
  const body: Row | Row[] | undefined = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (method === "POST") {
    if (!body) throw new Error("POST body is required");
    if (table === "ledger_events") {
      const candidate = Array.isArray(body) ? body[0] : body;
      if (
        rows.some(
          (row) =>
            row.tx_hash === candidate?.tx_hash &&
            (legacyLedgerUnique ||
              (row.chain_id === candidate?.chain_id && row.log_index === candidate?.log_index)),
        )
      ) {
        return new Response('{"code":"23505"}', { status: 409 });
      }
    }
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
  logIndex: 7,
  toAddress: "0x2222222222222222222222222222222222222222",
  amount: 1_000_000n,
  blockNumber: 20,
  timestamp: new Date("2025-01-01T00:00:00.000Z"),
};

const checkpointIdentity = {
  chain_id: 5042002,
  contract_name: "arcanum-indexer:arc-testnet:5042002",
  contract_address: "0xbe1bc48f26e7166d872828d40e82a6407dbd350c",
  deployment_id:
    "v1:5042002:arc-testnet:60951839:0x3600000000000000000000000000000000000000:0x7777ac24a19202e619bf67b92375e714e72033a4:0xb5907700df79b9030fafdaa48c26ae355512cccd:0x2eae369c3f93ebf5bbe62fbe6d2cd976977f7ae8:0xea4597b02ea2958a80afc47c417422598b9c548c:0xbe1bc48f26e7166d872828d40e82a6407dbd350c",
  deployment_start_block: 60951839,
  deployment_network: "arc-testnet",
  deployment_usdc_address: "0x3600000000000000000000000000000000000000",
  deployment_policy_engine_address: "0x7777ac24a19202e619bf67b92375e714e72033a4",
  deployment_escalation_manager_address: "0xb5907700df79b9030fafdaa48c26ae355512cccd",
  deployment_anomaly_oracle_address: "0x2eae369c3f93ebf5bbe62fbe6d2cd976977f7ae8",
  deployment_vendor_registry_address: "0xea4597b02ea2958a80afc47c417422598b9c548c",
  deployment_wallet_factory_address: "0xbe1bc48f26e7166d872828d40e82a6407dbd350c",
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
          owner_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          label: "Treasury",
          status: "active",
        },
      ],
      public_wallet_profiles: [],
      ledger_events: [],
      governance_events: [],
      escalations: [],
      vendors: [],
      unlinked_ledger_events: [],
      indexer_checkpoints: [],
      indexer_catchup_evidence: [],
    };
    failLedgerWrites = false;
    legacyLedgerUnique = false;
    missingLedgerRpc = false;
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores a repeated ledger event only once", async () => {
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    await syncTransferExecuted(transfer);
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]).toMatchObject({
      chain_id: 5042002,
      tx_hash: transfer.txHash.toLowerCase(),
      log_index: transfer.logIndex,
    });
  });

  function requests(table: string, method = "GET") {
    return vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, init]) =>
          new URL(String(url)).pathname.endsWith(`/${table}`) && (init?.method ?? "GET") === method,
      );
  }

  it("coalesces empty queue scans and checkpoint reads, not actual progress", async () => {
    const { syncCheckpoint } = await import("../src/supabase-sync");
    await Promise.all([30, 30, 31, 32].map((block) => syncCheckpoint(block, 1)));
    expect(requests("unlinked_ledger_events")).toHaveLength(1);
    expect(requests("indexer_checkpoints")).toHaveLength(1);
    expect(requests("indexer_checkpoints", "POST")).toHaveLength(1);
    expect(requests("indexer_checkpoints", "PATCH")).toHaveLength(2);
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(32);
    await expect(syncCheckpoint(31, 1)).rejects.toThrow("ahead of event block");
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(32);
  });

  it("expires checkpoint reads even while writes keep arriving", async () => {
    vi.useFakeTimers();
    const { syncCheckpoint } = await import("../src/supabase-sync");
    await syncCheckpoint(30, 1);
    vi.setSystemTime(Date.now() + 4_000);
    await syncCheckpoint(31, 1);
    vi.setSystemTime(Date.now() + 1_001);
    await syncCheckpoint(32, 1);
    expect(requests("indexer_checkpoints")).toHaveLength(2);
    expect(requests("unlinked_ledger_events")).toHaveLength(2);
  });

  it("does not overlap or accumulate periodic scans behind a slow request", async () => {
    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(fetch).mockImplementationOnce(async (url, init) => {
      await gate;
      return fakeFetch(url, init);
    });
    const { startStagedEventReconciliation, syncCheckpoint } = await import("../src/supabase-sync");
    const stop = startStagedEventReconciliation();
    try {
      await vi.advanceTimersByTimeAsync(20_000);
      expect(requests("unlinked_ledger_events")).toHaveLength(1);
      const checkpoint = syncCheckpoint(30, 1);
      expect(tableRows("indexer_checkpoints")).toHaveLength(0);
      if (!release) throw new Error("Missing test gate");
      release();
      await checkpoint;
      expect(requests("unlinked_ledger_events")).toHaveLength(1);
      expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(30);
    } finally {
      stop();
      release?.();
    }
  });

  it("refuses duplicate checkpoint rows rather than caching one arbitrarily", async () => {
    tables.indexer_checkpoints = ["a", "b"].map((id) => ({
      ...checkpointIdentity,
      id,
      last_block: 20,
      status: "synced",
    }));
    const { syncCheckpoint, syncConfirmedCatchup } = await import("../src/supabase-sync");
    await expect(syncCheckpoint(30, 1)).rejects.toThrow("duplicate deployment checkpoints");
    await expect(syncConfirmedCatchup()).rejects.toThrow("finalization rejected");
    expect(requests("indexer_checkpoints", "PATCH")).toHaveLength(0);
    expect(tableRows("indexer_catchup_evidence")).toHaveLength(0);
  });

  it("retries a failed queue scan without pinning or advancing its checkpoint", async () => {
    const { syncCheckpoint } = await import("../src/supabase-sync");
    vi.mocked(fetch).mockResolvedValueOnce(new Response("queue unavailable", { status: 503 }));
    await expect(syncCheckpoint(30, 1)).rejects.toThrow("queue unavailable");
    expect(tableRows("indexer_checkpoints")).toHaveLength(0);
    await syncCheckpoint(30, 1);
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(30);
  });

  it("invalidates checkpoint cache after a failed write and retries", async () => {
    const { syncCheckpoint } = await import("../src/supabase-sync");
    await syncCheckpoint(30, 1);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("checkpoint unavailable", { status: 503 }));
    await expect(syncCheckpoint(31, 1)).rejects.toThrow("checkpoint unavailable");
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(30);
    await syncCheckpoint(31, 1);
    expect(requests("indexer_checkpoints")).toHaveLength(2);
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(31);
  });

  it("reconciles a late-created wallet on a quiet chain, with retry after failure", async () => {
    vi.useFakeTimers();
    const wallet = tableRows("governed_wallets")[0];
    if (!wallet) throw new Error("Missing fixture wallet");
    tables.governed_wallets = [];
    const { syncTransferExecuted, syncCheckpoint, startStagedEventReconciliation } = await import(
      "../src/supabase-sync"
    );
    await syncTransferExecuted(transfer);
    await syncCheckpoint(30, 1);
    await syncCheckpoint(31, 1);
    expect(requests("unlinked_ledger_events")).toHaveLength(1);
    tables.governed_wallets = [wallet];
    failLedgerWrites = true;
    const stop = startStagedEventReconciliation();
    try {
      await vi.advanceTimersByTimeAsync(5_000);
      expect(tableRows("unlinked_ledger_events")).toHaveLength(1);
      expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(31);
      failLedgerWrites = false;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(tableRows("unlinked_ledger_events")).toHaveLength(0);
      expect(tableRows("ledger_events")).toHaveLength(1);
      expect(tableRows("indexer_catchup_evidence")).toHaveLength(0);
      // The complete global snapshot is reused, not fetched again per wallet.
      expect(requests("unlinked_ledger_events")).toHaveLength(3);
    } finally {
      stop();
    }
  });

  it("forces a final pass inside the throttle window before catch-up proof", async () => {
    const wallet = tableRows("governed_wallets")[0];
    if (!wallet) throw new Error("Missing fixture wallet");
    tables.governed_wallets = [];
    const { syncTransferExecuted, syncCheckpoint, syncConfirmedCatchup } = await import(
      "../src/supabase-sync"
    );
    await syncTransferExecuted(transfer);
    await syncCheckpoint(30, 1);
    tables.governed_wallets = [wallet];
    failLedgerWrites = true;
    await expect(syncConfirmedCatchup()).rejects.toThrow("temporary outage");
    expect(tableRows("indexer_catchup_evidence")).toHaveLength(0);
    // A failed forced pass invalidates the throttle, too.
    await expect(syncCheckpoint(31, 1)).rejects.toThrow("temporary outage");
    expect(tableRows("indexer_checkpoints")[0]?.last_block).toBe(30);
    failLedgerWrites = false;
    await syncConfirmedCatchup();
    expect(tableRows("unlinked_ledger_events")).toHaveLength(0);
    expect(tableRows("indexer_catchup_evidence")).toHaveLength(1);
    const calls = vi.mocked(fetch).mock.calls;
    expect(String(calls.at(-1)?.[0])).toContain("rpc/finalize_indexer_catchup");
  });

  it("refuses final proof while an unknown wallet still has staged work", async () => {
    tables.governed_wallets = [];
    const { syncTransferExecuted, syncConfirmedCatchup } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    await expect(syncConfirmedCatchup()).rejects.toThrow("finalization rejected");
    expect(tableRows("indexer_catchup_evidence")).toHaveLength(0);
  });

  it("serializes concurrent replay without overwriting immutable ledger payloads", async () => {
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await expect(
      Promise.all([
        syncTransferExecuted(transfer),
        syncTransferExecuted({ ...transfer, amount: 999_000_000n }),
      ]),
    ).rejects.toThrow("conflicting immutable");
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]?.amount_usdc).toBe("1.0");
    expect(requests("ledger_events")).toHaveLength(0);
    expect(requests("insert_ledger_event", "POST")).toHaveLength(2);
    expect(requests("ledger_events", "PATCH")).toHaveLength(0);
  });

  it("keeps a single-GET ledger replay on legacy tx-only uniqueness and fails a second log safely", async () => {
    legacyLedgerUnique = true;
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    vi.mocked(fetch).mockClear();
    await syncTransferExecuted(transfer);
    expect(requests("ledger_events")).toHaveLength(1);
    expect(requests("ledger_events", "POST")).toHaveLength(0);
    await expect(syncTransferExecuted({ ...transfer, logIndex: 8 })).rejects.toThrow("23505");
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]?.amount_usdc).toBe("1.0");
  });

  it("returns a raced external insert only when its complete event identity matches", async () => {
    missingLedgerRpc = true;
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/ledger_events") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Row[];
        tables.ledger_events = [{ ...body[0], id: "external", amount_usdc: "42.0" }];
      }
      return fakeFetch(url, init);
    });
    await expect(syncTransferExecuted(transfer)).rejects.toThrow("conflicting immutable");
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]?.amount_usdc).toBe("42.0");
    expect(requests("ledger_events")).toHaveLength(2);
    expect(requests("ledger_events", "POST")).toHaveLength(1);
  });

  it("fails closed before writing against a schema without ledger log_index", async () => {
    missingLedgerRpc = true;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/ledger_events")) {
        return new Response('{"code":"42703","message":"log_index does not exist"}', {
          status: 400,
        });
      }
      return fakeFetch(url, init);
    });
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await expect(syncTransferExecuted(transfer)).rejects.toThrow("log_index does not exist");
    expect(requests("ledger_events", "POST")).toHaveLength(0);
    expect(tableRows("indexer_checkpoints")).toHaveLength(0);
  });

  it("uses one ledger RPC for fresh events and one for identical replay", async () => {
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    expect(requests("insert_ledger_event", "POST")).toHaveLength(1);
    expect(requests("ledger_events")).toHaveLength(0);
    expect(requests("ledger_events", "POST")).toHaveLength(0);
    vi.mocked(fetch).mockClear();
    await syncTransferExecuted(transfer);
    expect(requests("insert_ledger_event", "POST")).toHaveLength(1);
    expect(requests("ledger_events")).toHaveLength(0);
  });

  it("validates fresh/replayed large amounts through raw JSON wire responses without rounding", async () => {
    let wire: string | undefined;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/insert_ledger_event")) {
        const { p_event: body } = JSON.parse(String(init?.body)) as { p_event: Row };
        expect(body.amount_usdc).toBe("1234567890123456789.123456");
        // Models PostgreSQL's SETOF jsonb text projection, then lets request()
        // perform the real Response.json()/JSON.parse transport boundary.
        wire ??= JSON.stringify([
          {
            ...body,
            id: "exact-large-ledger-id",
            amount_usdc: "1234567890123456789.123456",
            block_number: String(body.block_number),
          },
        ]);
        return new Response(wire, { headers: { "Content-Type": "application/json" } });
      }
      return fakeFetch(url, init);
    });
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    const large = { ...transfer, amount: 1234567890123456789123456n };
    await syncTransferExecuted(large);
    await syncTransferExecuted(large);
    expect(requests("insert_ledger_event", "POST")).toHaveLength(2);
    expect(requests("ledger_events")).toHaveLength(0);
    expect(requests("ledger_events", "POST")).toHaveLength(0);
    expect(requests("governed_wallets", "PATCH")).toHaveLength(2);
  });

  it("preserves the original row after wallet label/org changes and snapshot enrichment", async () => {
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    const original = tableRows("ledger_events")[0];
    if (!original) throw new Error("missing original");
    const wallet = tableRows("governed_wallets")[0];
    if (!wallet) throw new Error("missing wallet");
    wallet.label = "Renamed";
    wallet.organization_id = "new-organization";
    original.policy_snapshot = { enrichment: "added later" };
    await syncTransferExecuted(transfer);
    expect(tableRows("ledger_events")).toHaveLength(1);
    expect(tableRows("ledger_events")[0]).toEqual(original);
    expect(original.agent_label).toBe("Treasury");
    expect(original.organization_id).toBe("organization-1");
  });

  it.each([
    [403, "42501"],
    [503, "outage"],
    [400, "42P10"],
    [400, "42703"],
    [404, "PGRST204"],
    [404, "PGRST202"],
    [409, "23505"],
  ])("does not fall back for RPC errors %s/%s", async (status, code) => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (new URL(String(url)).pathname.endsWith("/insert_ledger_event")) {
        return Response.json({ code, message: "RPC failure" }, { status });
      }
      return fakeFetch(url, init);
    });
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await expect(syncTransferExecuted(transfer)).rejects.toThrow("RPC failure");
    expect(requests("ledger_events")).toHaveLength(0);
    expect(requests("ledger_events", "POST")).toHaveLength(0);
    expect(tableRows("indexer_checkpoints")).toHaveLength(0);
    expect(tableRows("governed_wallets")[0]?.last_indexed_at).toBeUndefined();
  });

  it("rejects an empty RPC success instead of advancing downstream writes", async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      new URL(String(url)).pathname.endsWith("/insert_ledger_event")
        ? Response.json([])
        : fakeFetch(url, init),
    );
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await expect(syncTransferExecuted(transfer)).rejects.toThrow("exactly one row");
    expect(requests("governed_wallets", "PATCH")).toHaveLength(0);
  });

  it("mirrors ownership transfers in order and makes replay idempotent", async () => {
    const { syncOwnershipTransferred } = await import("../src/supabase-sync");
    const oldOwner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const newOwner = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const txHash = `0x${"ef".repeat(32)}`;

    await syncOwnershipTransferred({
      walletAddress: transfer.walletAddress,
      previousOwner: oldOwner,
      newOwner,
      blockNumber: 21,
      logIndex: 3,
      txHash,
      timestamp: transfer.timestamp,
    });
    await syncOwnershipTransferred({
      walletAddress: transfer.walletAddress,
      previousOwner: oldOwner,
      newOwner,
      blockNumber: 21,
      logIndex: 3,
      txHash,
      timestamp: transfer.timestamp,
    });
    // A late event from before the applied transfer cannot roll the mirror
    // back to the former owner.
    await syncOwnershipTransferred({
      walletAddress: transfer.walletAddress,
      previousOwner: oldOwner,
      newOwner: oldOwner,
      blockNumber: 20,
      logIndex: 99,
      txHash: `0x${"dd".repeat(32)}`,
      timestamp: transfer.timestamp,
    });

    expect(tableRows("governed_wallets")[0]).toMatchObject({
      owner_address: newOwner,
      owner_sync_block: 21,
      owner_sync_log_index: 3,
      owner_sync_tx_hash: txHash,
    });
    expect(tableRows("governance_events")).toHaveLength(3);
  });

  it("skips ownership events for foreign wallets without pinning progress", async () => {
    tables.governed_wallets = [];
    const { syncOwnershipTransferred } = await import("../src/supabase-sync");
    await syncOwnershipTransferred({
      walletAddress: transfer.walletAddress,
      previousOwner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      newOwner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      blockNumber: 21,
      logIndex: 3,
      txHash: `0x${"ef".repeat(32)}`,
      timestamp: transfer.timestamp,
    });

    expect(tableRows("governance_events")).toEqual([]);
    expect(tableRows("governed_wallets")).toEqual([]);
  });

  it("stages an event when its wallet row does not exist", async () => {
    tables.governed_wallets = [];
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    expect(tableRows("ledger_events")).toHaveLength(0);
    expect(tableRows("unlinked_ledger_events")).toHaveLength(1);
    expect(tableRows("unlinked_ledger_events")[0]).toMatchObject({
      wallet_address: transfer.walletAddress,
      event_kind: "transfer_executed",
      event_key: `${transfer.txHash.toLowerCase()}:${transfer.logIndex}`,
    });
  });

  it("throws on a failed handler write without advancing the checkpoint", async () => {
    failLedgerWrites = true;
    const { syncCheckpoint, syncTransferExecuted } = await import("../src/supabase-sync");
    const handler = async () => {
      await syncTransferExecuted(transfer);
      await syncCheckpoint(transfer.blockNumber, 1);
    };
    await expect(handler()).rejects.toThrow("temporary outage");
    expect(tableRows("indexer_checkpoints")).toHaveLength(0);
    expect(tableRows("ledger_events")).toHaveLength(0);
  });

  it("stores two transfer logs from one transaction as distinct ledger rows", async () => {
    const { syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    await syncTransferExecuted({
      ...transfer,
      logIndex: transfer.logIndex + 1,
      amount: 2_000_000n,
    });
    expect(tableRows("ledger_events")).toHaveLength(2);
    expect(tableRows("ledger_events").map((row) => row.log_index)).toEqual([7, 8]);
  });

  it("advances a successful checkpoint to the indexed block", async () => {
    const { syncCheckpoint, syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted(transfer);
    await syncCheckpoint(30, 1);
    expect(tableRows("indexer_checkpoints")[0]).toMatchObject({
      last_block: 30,
      status: "synced",
      error_note: null,
    });
  });

  it("does not refresh a prior full catch-up when event progress continues", async () => {
    const oldCatchup = "2025-01-01T00:00:00.000Z";
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        last_block: 20,
        last_seen_block: 250,
        last_seen_at: oldCatchup,
        status: "synced",
        updated_at: oldCatchup,
      },
    ];
    const { syncCheckpoint, syncTransferExecuted } = await import("../src/supabase-sync");
    await syncTransferExecuted({ ...transfer, blockNumber: 300 });
    await syncCheckpoint(300, 1);
    expect(tableRows("indexer_checkpoints")[0]).toMatchObject({
      last_block: 300,
      last_seen_block: 250,
      last_seen_at: oldCatchup,
    });
  });

  it("records a quiet-chain catch-up only when explicitly confirmed", async () => {
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        last_block: 20,
        last_seen_block: 20,
        last_seen_at: null,
        status: "synced",
      },
    ];
    const { syncConfirmedCatchup } = await import("../src/supabase-sync");
    await syncConfirmedCatchup(250);
    expect(tableRows("indexer_catchup_evidence")[0]).toMatchObject({
      last_seen_block: 250,
      last_seen_at: expect.any(String),
      status: "ready",
    });
  });

  it("leaves the old catch-up untouched when a bounded run times out", async () => {
    const oldCatchup = "2025-01-01T00:00:00.000Z";
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        last_block: 20,
        last_seen_block: 250,
        last_seen_at: oldCatchup,
        status: "synced",
      },
    ];
    // A budget-limited run does not call syncConfirmedCatchup at all.
    expect(tableRows("indexer_checkpoints")[0]).toMatchObject({
      last_seen_block: 250,
      last_seen_at: oldCatchup,
    });
  });

  it("records a confirmed catch-up with an unknown status cursor", async () => {
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        last_block: 20,
        last_seen_block: 250,
        last_seen_at: "2025-01-01T00:00:00.000Z",
        status: "synced",
      },
    ];
    const { syncConfirmedCatchup } = await import("../src/supabase-sync");
    await syncConfirmedCatchup();
    expect(tableRows("indexer_catchup_evidence")[0]).toMatchObject({
      last_seen_block: null,
      last_seen_at: expect.any(String),
      status: "ready",
    });
  });

  it("records quiet deployment evidence without inventing a checkpoint", async () => {
    const { syncConfirmedCatchup } = await import("../src/supabase-sync");
    await syncConfirmedCatchup();
    expect(tableRows("indexer_checkpoints")).toHaveLength(0);
    expect(tableRows("indexer_catchup_evidence")).toHaveLength(1);
  });

  it("uses the deployment-scoped finalizer instead of a checkpoint marker patch", async () => {
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        last_block: 20,
        last_seen_block: 250,
        status: "synced",
      },
    ];
    const { syncConfirmedCatchup } = await import("../src/supabase-sync");
    await syncConfirmedCatchup(300);
    expect(tableRows("indexer_catchup_evidence")[0]).toMatchObject({
      status: "ready",
      last_seen_block: 300,
    });
  });

  it("does not reuse a foreign deployment watermark for low current events", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    tables.indexer_checkpoints = [
      {
        id: "checkpoint-1",
        ...checkpointIdentity,
        deployment_id: "v1:foreign-deployment",
        last_block: 10,
        last_seen_block: 12,
        status: "synced",
      },
    ];
    const { syncCheckpoint } = await import("../src/supabase-sync");
    await syncCheckpoint(25, 20);
    expect(tableRows("indexer_checkpoints")).toHaveLength(2);
    expect(tableRows("indexer_checkpoints")[1]).toMatchObject({
      last_block: 25,
      deployment_id: checkpointIdentity.deployment_id,
      status: "synced",
    });
    expect(info).not.toHaveBeenCalled();
  });

  it.each([
    ["rejected", "deny_tx_hash"],
    ["denied", "deny_tx_hash"],
    ["cancelled", "deny_tx_hash"],
    ["invalidated", "deny_tx_hash"],
    ["expired", undefined],
    ["released", "release_tx_hash"],
  ] as const)("stores escalation status %s without collapsing it", async (status, hashField) => {
    tables.escalations = [{ id: "esc-row", escalation_key: "0x01", status: "pending" }];
    const { syncEscalationStatus } = await import("../src/supabase-sync");
    await syncEscalationStatus({
      escalationId: "0x01",
      status,
      blockNumber: 21,
      logIndex: 1,
      txHash: transfer.txHash,
      timestamp: transfer.timestamp,
    });
    expect(tableRows("escalations")[0]?.status).toBe(status);
    if (hashField) {
      expect(tableRows("escalations")[0]?.[hashField]).toBe(transfer.txHash.toLowerCase());
    }
  });

  it("formats authoritative USDC amounts without precision loss", async () => {
    const { usdcDecimal } = await import("../src/supabase-sync");
    expect(usdcDecimal(9_007_199_254_740_993n)).toBe("9007199254.740993");
    expect(usdcDecimal(0n)).toBe("0.0");
    expect(usdcDecimal(1n)).toBe("0.000001");
    expect(usdcDecimal(1_000_000n)).toBe("1.0");
  });

  it("mirrors vendor lifecycle events with a chain ordering guard", async () => {
    const { syncVendorRule } = await import("../src/supabase-sync");
    const base = {
      walletAddress: transfer.walletAddress,
      vendorAddress: transfer.toAddress,
      blockNumber: 30,
      logIndex: 2,
      txHash: transfer.txHash,
      timestamp: transfer.timestamp,
    };
    await syncVendorRule({
      ...base,
      kind: "added",
      categoryIndex: 3,
      perVendorCap: 9_007_199_254_740_993n,
    });
    await syncVendorRule({ ...base, kind: "removed", blockNumber: 29 });
    await syncVendorRule({
      ...base,
      kind: "blocked",
      blockNumber: 31,
      txHash: `0x${"bb".repeat(32)}`,
    });
    expect(tableRows("vendors")).toHaveLength(1);
    expect(tableRows("vendors")[0]).toMatchObject({
      wallet_address: transfer.walletAddress,
      vendor_address: transfer.toAddress,
      category: "subcontracting",
      status: "blocked",
      per_vendor_cap_base_units: "9007199254740993",
      confidential: true,
      data_source: "live",
      source: "indexer",
      rule_sync_block: 31,
    });
  });

  it("stages and replays vendor events after the wallet appears", async () => {
    tables.governed_wallets = [];
    const { syncCheckpoint, syncVendorRule } = await import("../src/supabase-sync");
    await syncVendorRule({
      walletAddress: transfer.walletAddress,
      vendorAddress: transfer.toAddress,
      kind: "removed",
      blockNumber: 30,
      logIndex: 2,
      txHash: transfer.txHash,
      timestamp: transfer.timestamp,
    });
    expect(tableRows("unlinked_ledger_events")[0]?.event_kind).toBe("vendor_removed");
    tables.governed_wallets.push({
      id: "wallet-1",
      organization_id: "organization-1",
      wallet_address: transfer.walletAddress,
      chain_id: 5042002,
      status: "active",
    });
    await syncCheckpoint(30, 1);
    expect(tableRows("vendors")[0]).toMatchObject({ status: "removed" });
    expect(tableRows("unlinked_ledger_events")).toHaveLength(0);
  });

  function stagedTransfer(kind: unknown = "transfer_executed"): Row {
    return {
      id: "staged-compat",
      wallet_address: transfer.walletAddress,
      chain_id: checkpointIdentity.chain_id,
      deployment_id: checkpointIdentity.deployment_id,
      event_kind: kind,
      block_number: transfer.blockNumber,
      event_time: transfer.timestamp.toISOString(),
      payload: {
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
        toAddress: transfer.toAddress,
        amount: transfer.amount.toString(),
      },
    };
  }

  it.each(["future_transfer", "vendor_future", "", null, "transfer_allowed"])(
    "retains unsupported staged kind %s without mirror writes",
    async (kind) => {
      const row = stagedTransfer(kind);
      tableRows("unlinked_ledger_events").push(row);
      const { syncStagedEvents } = await import("../src/supabase-sync");
      await expect(syncStagedEvents()).rejects.toThrow("unsupported kind");
      expect(tableRows("unlinked_ledger_events")).toEqual([row]);
      expect(tableRows("ledger_events")).toEqual([]);
      expect(tableRows("vendors")).toEqual([]);
      expect(tableRows("escalations")).toEqual([]);
      expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
    },
  );

  it("retains legacy transfer_executed payload compatibility without new enrichment", async () => {
    tableRows("unlinked_ledger_events").push(stagedTransfer());
    const { syncStagedEvents } = await import("../src/supabase-sync");
    await syncStagedEvents();
    expect(tableRows("unlinked_ledger_events")).toEqual([]);
    expect(tableRows("ledger_events")).toEqual([
      expect.objectContaining({
        tx_hash: transfer.txHash.toLowerCase(),
        log_index: transfer.logIndex,
        amount_usdc: "1.0",
        status: "allowed",
        policy_snapshot: {},
      }),
    ]);
  });

  it.each([
    { amount: "" },
    { amount: "-1" },
    { txHash: "" },
    { toAddress: "not-an-address" },
    { logIndex: undefined },
  ])("retains malformed legacy transfer payload %j", async (patch) => {
    const row = stagedTransfer();
    row.payload = { ...(row.payload as Row), ...patch };
    tableRows("unlinked_ledger_events").push(row);
    const { syncStagedEvents } = await import("../src/supabase-sync");
    await expect(syncStagedEvents()).rejects.toThrow("invalid transfer payload");
    expect(tableRows("unlinked_ledger_events")).toEqual([row]);
    expect(tableRows("ledger_events")).toEqual([]);
  });

  it.each(["escalation_approval", "escalation_status"])(
    "retains %s when its escalation is missing, then applies and deletes on retry",
    async (kind) => {
      const row = stagedTransfer(kind);
      row.payload = {
        escalationId: "missing-escalation",
        approvalsCount: 2,
        status: "released",
        txHash: transfer.txHash,
        logIndex: transfer.logIndex,
      };
      tableRows("unlinked_ledger_events").push(row);
      const { syncStagedEvents } = await import("../src/supabase-sync");
      await expect(syncStagedEvents()).rejects.toThrow("awaits its escalation");
      expect(tableRows("unlinked_ledger_events")).toEqual([row]);
      expect(tableRows("ledger_events")).toEqual([]);
      tableRows("escalations").push({
        id: "escalation-row",
        escalation_key: "missing-escalation",
        status: "pending",
        approvals_count: 0,
      });
      await syncStagedEvents();
      expect(tableRows("unlinked_ledger_events")).toEqual([]);
      expect(tableRows("escalations")[0]).toMatchObject(
        kind === "escalation_approval"
          ? { approvals_count: 2, status: "pending" }
          : { status: "released", release_tx_hash: transfer.txHash.toLowerCase() },
      );
    },
  );

  it("replays a staged escalation lifecycle in chain order", async () => {
    tables.governed_wallets = [];
    const { syncCheckpoint, syncEscalationApproval, syncEscalationStatus, syncTransferEscalated } =
      await import("../src/supabase-sync");
    const escalationId = "escalation-1";
    await syncTransferEscalated({
      ...transfer,
      escalationId,
      reason: "review",
      policyVersion: "1",
      councilVersion: "1",
      expiresAt: new Date("2025-01-02T00:00:00.000Z"),
      quorumRequired: 2,
    });
    await syncEscalationApproval({
      escalationId,
      approvalsCount: 1,
      blockNumber: 21,
      logIndex: 1,
      txHash: `0x${"cc".repeat(32)}`,
      timestamp: transfer.timestamp,
    });
    await syncEscalationStatus({
      escalationId,
      status: "released",
      blockNumber: 22,
      logIndex: 1,
      txHash: `0x${"dd".repeat(32)}`,
      timestamp: transfer.timestamp,
    });
    tables.governed_wallets.push({
      id: "wallet-1",
      organization_id: "organization-1",
      wallet_address: transfer.walletAddress,
      chain_id: 5042002,
      status: "active",
    });
    await syncCheckpoint(22, 1);
    expect(tableRows("escalations")[0]).toMatchObject({
      status: "released",
      approvals_count: 1,
      release_tx_hash: `0x${"dd".repeat(32)}`,
    });
    expect(tableRows("unlinked_ledger_events")).toHaveLength(0);
  });

  it("replays a staged queue larger than one PostgREST page, in chain order", async () => {
    tables.governed_wallets = [];
    const { syncCheckpoint, syncTransferExecuted } = await import("../src/supabase-sync");
    // Stage in reverse chain order so a partial or unsorted read would show.
    const total = 1_203;
    for (let index = total - 1; index >= 0; index -= 1) {
      await syncTransferExecuted({
        ...transfer,
        txHash: `0x${index.toString(16).padStart(64, "0")}`,
        logIndex: index % 7,
        blockNumber: 100 + Math.floor(index / 7),
        amount: BigInt(index + 1),
      });
    }
    expect(tableRows("unlinked_ledger_events")).toHaveLength(total);

    tables.governed_wallets.push({
      id: "wallet-1",
      organization_id: "organization-1",
      wallet_address: transfer.walletAddress,
      chain_id: 5042002,
      status: "active",
    });
    await syncCheckpoint(300, 1);

    expect(tableRows("unlinked_ledger_events")).toHaveLength(0);
    const ledger = tableRows("ledger_events");
    expect(ledger).toHaveLength(total);
    const amounts = ledger.map((row) => String(row.amount_usdc));
    expect(amounts[0]).toBe("0.000001");
    expect(amounts[total - 1]).toBe(`0.00${String(total).padStart(4, "0")}`);
  });
});

describe("contract enum mappings", () => {
  it("keeps the vendor category ordinal aligned with the shared schema", async () => {
    const { vendorCategoryFromIndex } = await import("../src/supabase-sync");
    expect(categorySchema.options.map((_, index) => vendorCategoryFromIndex(index))).toEqual(
      categorySchema.options,
    );
  });

  it("round-trips every escalation status ordinal", () => {
    for (const [index, status] of ESCALATION_STATUSES.entries()) {
      expect(escalationStatusFromIndex(index)).toBe(status);
      expect(ESCALATION_STATUSES.indexOf(status)).toBe(index);
    }
  });

  it("round-trips every escalation reason ordinal", () => {
    for (const [index, reason] of ESCALATION_REASONS.entries()) {
      expect(escalationReasonFromIndex(index)).toBe(reason);
      expect(ESCALATION_REASONS.indexOf(reason)).toBe(index);
    }
  });
});
