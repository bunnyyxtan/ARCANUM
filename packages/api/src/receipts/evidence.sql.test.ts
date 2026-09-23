import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Opt-in: only the disposable PostgreSQL 17 cluster created by security-sql-test.sh.
// This suite never reads DATABASE_URL or any Supabase credentials.
const testPort = process.env.ARCANUM_AUTH_SQL_TEST_PORT;
const testDataDir = process.env.ARCANUM_AUTH_SQL_TEST_DATA_DIR;
const execute = promisify(execFile);
const baseMigration = readFileSync(
  new URL("../../../../supabase/migrations/20260910120000_payment_receipts.sql", import.meta.url),
  "utf8",
);
const uniquenessMigration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260918192000_unique_receipt_execution_transactions.sql",
    import.meta.url,
  ),
  "utf8",
);
const orgId = "40000000-0000-4000-8000-000000000004";
const walletId = "30000000-0000-4000-8000-000000000003";
const receiptA = "10000000-0000-4000-8000-000000000001";
const receiptB = "20000000-0000-4000-8000-000000000002";
const txHash = `0x${"ab".repeat(32)}`;
const pending: Promise<unknown>[] = [];
let verifiedCluster = false;

function args(sql: string) {
  if (
    !testPort ||
    !/^[0-9]{4,5}$/.test(testPort) ||
    Number(testPort) < 1024 ||
    Number(testPort) > 65535 ||
    Number(testPort) === 5547
  ) {
    throw new Error("Receipt SQL tests require the disposable local security-test cluster");
  }
  return [
    "-X",
    "-q",
    "-A",
    "-t",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    testPort,
    "-U",
    "arcanum_drill",
    "-d",
    "hardening_sql",
    "-c",
    sql,
  ];
}

function query(sql: string, role?: "service_role") {
  return execFileSync("psql", args(role ? `set role ${role}; ${sql}` : sql), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  }).trim();
}

function background(sql: string) {
  const result = execute("psql", args(`set role service_role; ${sql}`), { timeout: 15_000 })
    .then(({ stdout }) => ({ ok: true as const, output: stdout.trim() }))
    .catch((error: Error & { stderr?: string }) => ({
      ok: false as const,
      output: error.stderr ?? error.message,
    }));
  pending.push(result);
  return result;
}

function receiptRow(id: string, reference: string) {
  return `('${id}', '${orgId}', '${walletId}', 5042002,
    '0x1000000000000000000000000000000000000001',
    '0x3000000000000000000000000000000000000003',
    '0x2000000000000000000000000000000000000002',
    '0x3600000000000000000000000000000000000000',
    12500000, '${reference}', '0x${"11".repeat(32)}', 'allow', 'NONE',
    61000000, '0x${"22".repeat(32)}', 3, now(), 'test',
    '0x${id === receiptA ? "33" : "44"}${(id === receiptA ? "33" : "44").repeat(31)}',
    '0x${"55".repeat(65)}', '{}'::jsonb)`;
}

function executionInsert(receiptId: string, outcome = "executed") {
  return `insert into public.payment_receipt_evidence
    (receipt_id, organization_id, governed_wallet_id, kind, outcome, tx_hash, block_number, details)
    values ('${receiptId}', '${orgId}', '${walletId}', 'execution', '${outcome}',
      '${txHash}', 61000010, '{}'::jsonb);`;
}

describe.skipIf(!testPort)("receipt evidence PostgreSQL integration (isolated cluster)", () => {
  beforeAll(() => {
    expect(testDataDir).toMatch(/^\/tmp\/arc-sql\.[A-Za-z0-9]+\/data$/);
    expect(query("show data_directory;")).toBe(testDataDir);
    expect(query("select current_setting('server_version_num')::integer / 10000 = 17;")).toBe("t");
    verifiedCluster = true;
    query(`
      create table if not exists public.organizations (id uuid primary key);
      create table if not exists public.governed_wallets (
        id uuid primary key,
        organization_id uuid not null references public.organizations(id)
      );
      insert into public.organizations(id) values ('${orgId}') on conflict do nothing;
      insert into public.governed_wallets(id, organization_id)
        values ('${walletId}', '${orgId}') on conflict do nothing;
      ${baseMigration}
      ${uniquenessMigration}
      ${uniquenessMigration}
    `);
  });

  beforeEach(() => {
    query("truncate public.payment_receipt_evidence, public.payment_receipts;");
    query(
      `insert into public.payment_receipts
       (id, organization_id, governed_wallet_id, chain_id, wallet_address,
        agent_signer_address, vendor_address, token_address, amount_base_units,
        reference, request_digest, verdict, reason_code, block_number, block_hash,
        policy_version, evaluated_at, issuer_key_id, receipt_digest, signature, envelope)
       values ${receiptRow(receiptA, "reference-a")}, ${receiptRow(receiptB, "reference-b")};`,
    );
  });

  afterAll(async () => {
    await Promise.all(pending);
    if (verifiedCluster)
      query("truncate public.payment_receipt_evidence, public.payment_receipts;");
  });

  it("atomically allows one receipt to claim an execution hash across concurrent connections", async () => {
    const results = await Promise.all([
      background(executionInsert(receiptA)),
      background(executionInsert(receiptB)),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(
      query(
        `select count(*) from public.payment_receipt_evidence
         where kind='execution' and lower(tx_hash)=lower('${txHash}');`,
      ),
    ).toBe("1");
  });

  it("keeps escalation observations linkable through the original hold transaction", () => {
    query(executionInsert(receiptA), "service_role");
    query(
      `insert into public.payment_receipt_evidence
       (receipt_id, organization_id, governed_wallet_id, kind, outcome, tx_hash,
        block_number, escalation_key, details)
       values ('${receiptA}', '${orgId}', '${walletId}', 'escalation', 'released',
        '${txHash}', 61000010, '0x${"66".repeat(32)}', '{}'::jsonb);`,
      "service_role",
    );
    expect(
      query(
        `select string_agg(kind || ':' || outcome, ',' order by kind)
         from public.payment_receipt_evidence where receipt_id='${receiptA}';`,
      ),
    ).toBe("escalation:released,execution:executed");
  });

  it("fails clearly instead of deleting pre-existing duplicate execution evidence", () => {
    expect(() =>
      query(`
        begin;
        drop index public.payment_receipt_evidence_execution_tx_unique_idx;
        ${executionInsert(receiptA)}
        ${executionInsert(receiptB, "reverted")}
        ${uniquenessMigration}
        rollback;
      `),
    ).toThrow(/Cannot enforce unique receipt execution transactions/);
    expect(
      query(
        "select to_regclass('public.payment_receipt_evidence_execution_tx_unique_idx') is not null;",
      ),
    ).toBe("t");
  });

  it("uses a case-normalized execution hash key", () => {
    expect(
      query(
        `select indexdef from pg_indexes
         where schemaname='public'
           and indexname='payment_receipt_evidence_execution_tx_unique_idx';`,
      ),
    ).toContain("lower(tx_hash)");
  });
});
