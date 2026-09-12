import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  process.env.MIGRATION_PATH ??
    new URL(
      "../../supabase/migrations/20260912123000_indexer_deployment_catchup_evidence.sql",
      import.meta.url,
    ),
  "utf8",
);
const db = new PGlite();
const address = "0x1111111111111111111111111111111111111111";
const identity = {
  chain: 5042002,
  network: "arc-testnet",
  start: 60951839,
  usdc: "0x3600000000000000000000000000000000000000",
  policy: "0x7777ac24a19202e619bf67b92375e714e72033a4",
  escalation: "0xb5907700df79b9030fafdaa48c26ae355512cccd",
  oracle: "0x2eae369c3f93ebf5bbe62fbe6d2cd976977f7ae8",
  vendor: "0xea4597b02ea2958a80afc47c417422598b9c548c",
  factory: address,
};
const args = (deploymentId, lastSeenBlock = null) => [
  deploymentId,
  identity.chain,
  identity.network,
  identity.start,
  identity.usdc,
  identity.policy,
  identity.escalation,
  identity.oracle,
  identity.vendor,
  identity.factory,
  lastSeenBlock,
];
const finalize = (deploymentId, lastSeenBlock = null) =>
  db.query(
    `select * from public.finalize_indexer_catchup(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )`,
    args(deploymentId, lastSeenBlock),
  );
const mustReject = async (operation, label) => {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
};

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create type public.checkpoint_status as enum ('syncing', 'synced', 'error', 'failed');
    create table public.indexer_checkpoints (
      id uuid default gen_random_uuid() primary key,
      chain_id integer not null,
      contract_name text not null,
      contract_address text not null,
      last_block bigint not null default 0,
      status public.checkpoint_status not null default 'syncing',
      updated_at timestamptz not null default now(),
      error_note text,
      constraint indexer_checkpoints_contract_address_check
        check (contract_address = lower(contract_address)),
      constraint indexer_checkpoints_chain_id_contract_address_key
        unique (chain_id, contract_address)
    );
    create table public.unlinked_ledger_events (
      id uuid default gen_random_uuid() primary key,
      chain_id integer not null,
      deployment_id text,
      wallet_address text not null,
      event_kind text not null,
      event_key text not null
    );
    alter table public.indexer_checkpoints enable row level security;
    create policy checkpoint_service_role on public.indexer_checkpoints
      for all to service_role using (true) with check (true);
    grant all on public.indexer_checkpoints to service_role;
    grant all on public.unlinked_ledger_events to service_role;
  `);
  await db.exec(migration);

  // Simulate a platform default grant being present when an additive migration
  // is replayed: the migration must revoke it on every run.
  await db.exec(`
    grant all on public.indexer_catchup_evidence to anon, authenticated, service_role;
  `);
  await db.exec(migration);
  const grants = await db.query(`
    select
      has_table_privilege('service_role', 'public.indexer_catchup_evidence', 'SELECT') as service_select,
      has_table_privilege('anon', 'public.indexer_catchup_evidence', 'INSERT') as anon_insert,
      has_function_privilege(
        'service_role',
        'public.finalize_indexer_catchup(text,integer,text,bigint,text,text,text,text,text,text,bigint)'::regprocedure,
        'EXECUTE'
      ) as service_execute,
      has_function_privilege(
        'anon',
        'public.finalize_indexer_catchup(text,integer,text,bigint,text,text,text,text,text,text,bigint)'::regprocedure,
        'EXECUTE'
      ) as anon_execute
  `);
  const grantRow = grants.rows[0];
  if (
    !grantRow.service_select ||
    grantRow.anon_insert ||
    !grantRow.service_execute ||
    grantRow.anon_execute
  ) {
    throw new Error("catch-up evidence grants are not fail-closed");
  }

  await db.exec(`
    reset role;
    insert into public.indexer_checkpoints (
      chain_id, contract_name, contract_address, last_block, status
    ) values (
      5042002, 'arcanum-indexer:arc-testnet:5042002', '${address}', 10, 'synced'
    );
  `);
  await db.query(
    `insert into public.indexer_checkpoints
      (chain_id, contract_name, contract_address, last_block, status,
       deployment_id, deployment_start_block, deployment_network,
       deployment_usdc_address, deployment_policy_engine_address,
       deployment_escalation_manager_address, deployment_anomaly_oracle_address,
       deployment_vendor_registry_address, deployment_wallet_factory_address)
     values ($1, $2, $3, 11, 'synced', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      identity.chain,
      "arcanum-indexer:arc-testnet:5042002",
      address,
      "current-deployment",
      identity.start,
      identity.network,
      identity.usdc,
      identity.policy,
      identity.escalation,
      identity.oracle,
      identity.vendor,
      identity.factory,
    ],
  );
  const checkpointCount = await db.query(
    "select count(*)::int as count from public.indexer_checkpoints where chain_id = $1 and contract_address = $2",
    [identity.chain, address],
  );
  if (checkpointCount.rows[0].count !== 2) {
    throw new Error("legacy and deployment-bound checkpoints did not coexist");
  }

  await db.query("set role service_role");
  const quiet = await finalize("quiet-deployment", null);
  if (quiet.rows[0].status !== "ready" || quiet.rows[0].last_seen_block !== null) {
    throw new Error("quiet finalization did not produce a ready null-cursor row");
  }
  const clean = await finalize("current-deployment", 123);
  if (clean.rows[0].status !== "ready" || clean.rows[0].last_seen_block !== 123) {
    throw new Error("clean finalization did not produce ready evidence");
  }
  await db.query(
    "insert into public.indexer_checkpoints (chain_id, contract_name, contract_address, status, deployment_id, deployment_start_block, deployment_network, deployment_usdc_address, deployment_policy_engine_address, deployment_escalation_manager_address, deployment_anomaly_oracle_address, deployment_vendor_registry_address, deployment_wallet_factory_address) values ($1, $2, $3, 'error', 'dirty-deployment', $4, $5, $6, $7, $8, $9, $10, $11)",
    [
      identity.chain,
      "arcanum-indexer:arc-testnet:5042002",
      address,
      identity.start,
      identity.network,
      identity.usdc,
      identity.policy,
      identity.escalation,
      identity.oracle,
      identity.vendor,
      identity.factory,
    ],
  );
  await mustReject(() => finalize("dirty-deployment"), "dirty finalization");
  await db.query(
    "insert into public.unlinked_ledger_events (chain_id, deployment_id, wallet_address, event_kind, event_key) values ($1, 'pending-deployment', $2, 'transfer_executed', 'pending-1')",
    [identity.chain, address],
  );
  await mustReject(() => finalize("pending-deployment"), "pending finalization");
  const raceOne = await finalize("race-deployment", 1);
  const raceTwo = await finalize("race-deployment", 2);
  if (raceOne.rows.length !== 1 || raceTwo.rows.length !== 1) {
    throw new Error("serialized repeat finalization did not return one evidence row");
  }

  await db.query("set role anon");
  await mustReject(() => finalize("anon-deployment"), "anonymous RPC");
  await mustReject(
    () =>
      db.query(
        "insert into public.indexer_catchup_evidence (deployment_id, chain_id, deployment_network, deployment_start_block, deployment_usdc_address, deployment_policy_engine_address, deployment_escalation_manager_address, deployment_anomaly_oracle_address, deployment_vendor_registry_address, deployment_wallet_factory_address) values ('anon-direct', $1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [
          identity.chain,
          identity.network,
          identity.start,
          identity.usdc,
          identity.policy,
          identity.escalation,
          identity.oracle,
          identity.vendor,
          identity.factory,
        ],
      ),
    "anonymous direct insert",
  );
  await db.query("set role service_role");
  const readable = await db.query(
    "select count(*)::int as count from public.indexer_catchup_evidence",
  );
  if (readable.rows[0].count < 2) {
    throw new Error("service_role cannot read evidence");
  }
  await db.query("reset role");
  console.log("PGlite catch-up evidence smoke: PASS");
} finally {
  await db.close();
}
