import {
  ESCALATION_REASONS,
  ESCALATION_STATUSES,
  categorySchema,
  escalationReasonFromIndex,
  escalationStatusFromIndex,
} from "@arcanum/shared";
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
  if (table === "finalize_indexer_catchup" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Row;
    const checkpoints = tableRows("indexer_checkpoints").filter(
      (row) =>
        row.deployment_id === body.p_deployment_id &&
        row.contract_name === `arcanum-indexer:${body.p_deployment_network}:${body.p_chain_id}`,
    );
    const pending = tableRows("unlinked_ledger_events").some(
      (row) => row.deployment_id === null || row.deployment_id === body.p_deployment_id,
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
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
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
