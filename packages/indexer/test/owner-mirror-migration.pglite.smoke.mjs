/*
 * Isolated SQL proof for 20260912130000_owner_mirror_and_vendor_capability.sql.
 *
 * This is deliberately a standalone smoke script rather than an indexer source
 * test. It uses an already-installed PGlite module only; no Supabase, Replit,
 * network, or production database is contacted. Set PGLITE_MODULE when the
 * local checkout keeps PGlite in a different existing node_modules tree.
 *
 * Example:
 *   PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js \
 *     node packages/indexer/test/owner-mirror-migration.pglite.smoke.mjs
 */
import { readFile } from "node:fs/promises";

const pgliteModule =
  process.env.PGLITE_MODULE ??
  "/home/runner/workspace/arcanum/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pgliteModule);

const ownerMigration = await readFile(
  new URL(
    "../../../supabase/migrations/20260912130000_owner_mirror_and_vendor_capability.sql",
    import.meta.url,
  ),
  "utf8",
);
const vendorCapMigration = await readFile(
  new URL("../../../supabase/migrations/20260912150000_vendor_cap_base_units.sql", import.meta.url),
  "utf8",
);
const authorityMigration = await readFile(
  new URL(
    "../../../supabase/migrations/20260912170000_wallet_scoped_vendors_and_doctrine_authority.sql",
    import.meta.url,
  ),
  "utf8",
);
const priorVendorRpc = await readFile(
  new URL(
    "../../../supabase/migrations/20260806120000_vendor_flag_apply_atomic.sql",
    import.meta.url,
  ),
  "utf8",
);

const db = new PGlite();

const ORG = "10000000-0000-4000-8000-000000000001";
const TENANT = "20000000-0000-4000-8000-000000000002";
const WALLET_ID = "30000000-0000-4000-8000-000000000003";
const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FOREIGN_WALLET = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FACTORY = "0xf000000000000000000000000000000000000000";
const OLD_OWNER = "0x1111111111111111111111111111111111111111";
const NEW_OWNER = "0x2222222222222222222222222222222222222222";
const THIRD_OWNER = "0x3333333333333333333333333333333333333333";
const OWNER = "0x4444444444444444444444444444444444444444";
const ADMIN = "0x5555555555555555555555555555555555555555";
const APPROVER = "0x6666666666666666666666666666666666666666";
const OPERATOR = "0x7777777777777777777777777777777777777777";
const VIEWER = "0x8888888888888888888888888888888888888888";
const REMOVED = "0x9999999999999999999999999999999999999999";
const FUNCTION_SIGNATURE = "public.vendor_flag_apply(uuid,uuid,text,text,text,text)";
const FUNCTION = `'${FUNCTION_SIGNATURE}'::regprocedure`;

const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const mustReject = async (operation, label) => {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly succeeded`);
};

const asRole = async (role, operation) => {
  await db.query(`set role ${role}`);
  try {
    return await operation();
  } finally {
    await db.query("reset role");
  }
};

const syncOwner = async (previousOwner, newOwner, blockNumber, logIndex, suffix) => {
  const txHash = `0x${suffix.repeat(64 / suffix.length)}`;
  return db.query("select public.sync_governed_wallet_owner($1,$2,$3,$4,$5,$6,$7) as result", [
    WALLET,
    5_042_002,
    previousOwner,
    newOwner,
    blockNumber,
    logIndex,
    txHash,
  ]);
};

const ownerRow = async () => {
  const result = await db.query(
    `select organization_id, owner_address, owner_sync_block, owner_sync_log_index, owner_sync_tx_hash
       from public.governed_wallets
      where id = $1`,
    [WALLET_ID],
  );
  return result.rows[0];
};

const applyVendor = async (actor, action, vendor, note = null) =>
  db.query("select public.vendor_flag_apply($1,$2,$3,$4,$5,$6) as result", [
    ORG,
    TENANT,
    vendor,
    action,
    actor,
    note,
  ]);

try {
  await db.exec(`
    create sequence fixture_uuid_seq;
    create function fixture_uuid() returns uuid language sql volatile as $$
      select ('90000000-0000-4000-8000-' ||
              lpad(nextval('fixture_uuid_seq')::text, 12, '0'))::uuid
    $$;
    create role anon;
    create role authenticated;
    create role service_role bypassrls;

    create type public.org_role as enum ('owner', 'admin', 'approver', 'viewer', 'operator');

    create table public.organizations (
      id uuid primary key default fixture_uuid(),
      name text not null,
      slug text unique,
      safe_address text,
      created_by uuid,
      plan text,
      updated_at timestamptz default now()
    );
    create table public.profiles (
      id uuid primary key default fixture_uuid(),
      wallet_address text not null,
      display_name text,
      updated_at timestamptz default now()
    );
    create unique index profiles_wallet_lower_uidx on public.profiles(lower(wallet_address));
    create table public.organization_members (
      id uuid primary key default fixture_uuid(),
      organization_id uuid not null references public.organizations(id),
      profile_id uuid not null references public.profiles(id),
      role public.org_role not null,
      created_at timestamptz not null default now(),
      unique (organization_id, profile_id)
    );
    create table public.governed_wallets (
      id uuid primary key default fixture_uuid(),
      organization_id uuid not null references public.organizations(id),
      chain_id integer not null,
      wallet_address text not null,
      owner_address text not null,
      wallet_factory_address text not null,
      label text not null,
      deploy_tx_hash text,
      status text not null,
      indexer_status text,
      data_source text,
      policy_engine_address text,
      vendor_registry_address text,
      escalation_manager_address text,
      anomaly_oracle_address text,
      created_by uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (chain_id, wallet_address)
    );
    create table public.vendors (
      id uuid primary key default fixture_uuid(),
      organization_id uuid not null references public.organizations(id),
      name text not null,
      domain text,
      vendor_address text,
      category text,
      confidential boolean default false,
      status text,
      data_source text,
      source text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    create unique index vendors_org_domain_address_uidx on public.vendors
      (organization_id, coalesce(lower(domain), ''), coalesce(lower(vendor_address), ''));
    create table public.doctrines (
      id uuid primary key default fixture_uuid(),
      governed_wallet_id uuid not null references public.governed_wallets(id),
      organization_id uuid not null references public.organizations(id),
      name text not null,
      version integer not null,
      daily_cap_usdc numeric,
      per_tx_cap_usdc numeric,
      per_vendor_daily_cap_usdc numeric,
      monthly_cap_usdc numeric,
      escalate_above_usdc numeric,
      allowed_categories text[],
      require_vendor_allowlist boolean,
      freeze_on_blocked_vendor boolean default false,
      signers text[],
      escalation_council text[],
      quorum integer,
      status text,
      source text,
      updated_at timestamptz default now(),
      created_at timestamptz default now()
    );
    create table public.public_wallet_profiles (
      id uuid primary key default fixture_uuid(),
      governed_wallet_id uuid references public.governed_wallets(id),
      wallet_address text not null,
      show_public_badge boolean,
      posture_score numeric,
      health_grade text,
      summary text,
      updated_at timestamptz default now()
    );
    create table public.governance_events (
      id bigint generated by default as identity primary key,
      organization_id uuid not null references public.organizations(id),
      governed_wallet_id uuid not null references public.governed_wallets(id),
      event_type text not null,
      severity text not null,
      payload jsonb not null,
      block_number bigint not null,
      tx_hash text not null,
      chain_id integer not null,
      event_time timestamptz not null,
      data_source text not null
    );
    create table public.vendor_flags (
      id bigint generated by default as identity primary key,
      organization_id uuid not null references public.organizations(id),
      tenant_id uuid not null,
      vendor_address varchar(64) not null,
      flagged_by text not null,
      note text,
      note_updated_by text,
      note_updated_at timestamptz,
      removed_by text,
      removed_at timestamptz,
      created_at timestamptz not null default now(),
      unique (organization_id, vendor_address)
    );
    create table public.vendor_flag_events (
      id bigint generated by default as identity primary key,
      organization_id uuid not null references public.organizations(id),
      tenant_id uuid not null,
      vendor_address varchar(64) not null,
      event_type text not null check (event_type in ('flagged', 'note_updated', 'unflagged')),
      actor text,
      note text,
      created_at timestamptz not null default now()
    );

    -- Supabase-style direct grants are intentionally present before the
    -- hardening migration. The migration must remove them on replay.
    grant all on public.vendor_flags, public.vendor_flag_events
      to anon, authenticated, service_role;
    grant all on public.organizations, public.profiles, public.organization_members,
      public.governed_wallets, public.governance_events, public.vendors,
      public.doctrines, public.public_wallet_profiles to service_role;
    grant usage, select on all sequences in schema public to service_role;
  `);

  await db.exec(priorVendorRpc);
  await db.exec(ownerMigration);
  await db.exec(vendorCapMigration);
  await db.exec(authorityMigration);

  // Simulate platform defaults being reintroduced during a replay. The new
  // migration must restore both direct-table and function fail-closed grants.
  await db.exec(`
    grant all on public.vendor_flags, public.vendor_flag_events
      to anon, authenticated;
    grant execute on function ${FUNCTION_SIGNATURE} to anon, authenticated;
  `);
  await db.exec(ownerMigration);
  await db.exec(vendorCapMigration);
  await db.exec(authorityMigration);

  const grants = await db.query(`
    select
      has_table_privilege('service_role', 'public.vendor_flags', 'SELECT') as service_flag_select,
      has_table_privilege('service_role', 'public.vendor_flags', 'INSERT') as service_flag_insert,
      has_table_privilege('anon', 'public.vendor_flags', 'INSERT') as anon_flag_insert,
      has_table_privilege('authenticated', 'public.vendor_flag_events', 'INSERT') as authenticated_event_insert,
      has_function_privilege('service_role', ${FUNCTION}, 'EXECUTE') as service_execute,
      has_function_privilege('anon', ${FUNCTION}, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', ${FUNCTION}, 'EXECUTE') as authenticated_execute
  `);
  const grantRow = grants.rows[0];
  must(
    grantRow.service_flag_select &&
      grantRow.service_flag_insert &&
      !grantRow.anon_flag_insert &&
      !grantRow.authenticated_event_insert &&
      grantRow.service_execute &&
      !grantRow.anon_execute &&
      !grantRow.authenticated_execute,
    `vendor grants are not fail-closed: ${JSON.stringify(grantRow)}`,
  );

  await db.query(`insert into public.organizations (id, name) values ($1, 'Security workspace')`, [
    ORG,
  ]);
  const members = [
    [OWNER, "owner"],
    [ADMIN, "admin"],
    [APPROVER, "approver"],
    [OPERATOR, "operator"],
    [VIEWER, "viewer"],
  ];
  for (const [index, [address, role]] of members.entries()) {
    const profileId = `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    const memberId = `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    await db.query("insert into public.profiles (id, wallet_address) values ($1, $2)", [
      profileId,
      address,
    ]);
    await db.query(
      `insert into public.organization_members (id, organization_id, profile_id, role)
       values ($1, $2, $3, $4::public.org_role)`,
      [memberId, ORG, profileId, role],
    );
  }
  const removedProfile = "40000000-0000-4000-8000-000000000006";
  await db.query("insert into public.profiles (id, wallet_address) values ($1, $2)", [
    removedProfile,
    REMOVED,
  ]);
  await db.query(
    `insert into public.governed_wallets
       (id, organization_id, chain_id, wallet_address, owner_address,
        wallet_factory_address, label, status)
     values ($1, $2, $3, $4, $5, $6, 'Transfer test wallet', 'active')`,
    [WALLET_ID, ORG, 5_042_002, WALLET, OLD_OWNER, FACTORY],
  );

  // Service-only owner mirror controls.
  await asRole("service_role", async () => {
    await syncOwner(OLD_OWNER, NEW_OWNER, 100, 10, "a");
    let row = await ownerRow();
    must(
      row.owner_address === NEW_OWNER &&
        row.organization_id === ORG &&
        row.owner_sync_block === 100 &&
        row.owner_sync_log_index === 10,
      "newer ownership event did not advance the mirror",
    );

    // Same-block lower log and older block must not roll the owner back.
    await syncOwner(OLD_OWNER, OLD_OWNER, 100, 9, "b");
    await syncOwner(NEW_OWNER, OLD_OWNER, 99, 999, "c");
    row = await ownerRow();
    must(
      row.owner_address === NEW_OWNER &&
        row.owner_sync_block === 100 &&
        row.owner_sync_log_index === 10,
      "older or same-block lower ownership event rolled the mirror back",
    );

    // Same-block newer log applies; replay is a no-op.
    await syncOwner(NEW_OWNER, THIRD_OWNER, 100, 11, "d");
    await syncOwner(NEW_OWNER, THIRD_OWNER, 100, 11, "d");
    row = await ownerRow();
    must(
      row.owner_address === THIRD_OWNER &&
        row.owner_sync_block === 100 &&
        row.owner_sync_log_index === 11,
      "same-block newer event or replay handling is incorrect",
    );

    await mustReject(
      () => syncOwner(OLD_OWNER, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", 101, 1, "e"),
      "ownership event with a divergent previous owner",
    );
    row = await ownerRow();
    must(row.owner_address === THIRD_OWNER, "divergent ownership event changed the mirror");
  });

  await asRole("service_role", async () => {
    const foreignResult = await db.query(
      `select public.sync_governed_wallet_owner(
        $1,$2,$3,$4,$5,$6,$7
      ) as result`,
      [FOREIGN_WALLET, 5_042_002, OLD_OWNER, NEW_OWNER, 300, 1, `0x${"f".repeat(64)}`],
    );
    must(foreignResult.rows[0].result === null, "foreign wallet was not skipped");
  });

  // Every real workspace writer can flag, edit, and clear; the RPC itself,
  // rather than the API role snapshot, owns this capability decision.
  const writerVendors = [OWNER, ADMIN, APPROVER, OPERATOR].map(
    (_, index) => `0x${String(index + 1).repeat(40)}`,
  );
  await asRole("service_role", async () => {
    for (const [index, actor] of [OWNER, ADMIN, APPROVER, OPERATOR].entries()) {
      const vendor = writerVendors[index];
      await applyVendor(actor, "flag", vendor, `flagged by ${actor}`);
      await applyVendor(actor, "note", vendor, `noted by ${actor}`);
      await applyVendor(actor, "unflag", vendor);
    }
  });

  const history = await db.query(
    "select event_type, actor from public.vendor_flag_events order by id",
  );
  must(history.rows.length === 12, "writer actions did not produce all audit events");
  for (const actor of [OWNER, ADMIN, APPROVER, OPERATOR]) {
    const actorEvents = history.rows.filter((row) => row.actor === actor);
    must(
      actorEvents.map((row) => row.event_type).join(",") === "flagged,note_updated,unflagged",
      `writer ${actor} did not complete flag/note/unflag`,
    );
  }

  await asRole("service_role", async () => {
    for (const actor of [VIEWER, REMOVED]) {
      const vendor = `0x${actor.slice(2, 6)}${"0".repeat(36)}`;
      for (const action of ["flag", "note", "unflag"]) {
        await mustReject(
          () => applyVendor(actor, action, vendor, "must be rejected"),
          `${actor} ${action}`,
        );
      }
    }
  });
  const deniedHistory = await db.query(
    "select count(*)::int as count from public.vendor_flag_events",
  );
  must(deniedHistory.rows[0].count === 12, "denied members changed the audit trail");

  await asRole("anon", async () => {
    await mustReject(
      () => applyVendor(VIEWER, "flag", `0x${"a".repeat(40)}`, "anonymous"),
      "anonymous vendor RPC",
    );
    await mustReject(
      () =>
        db.query(
          `insert into public.vendor_flags
             (organization_id, tenant_id, vendor_address, flagged_by)
           values ($1,$2,$3,$4)`,
          [ORG, TENANT, `0x${"b".repeat(40)}`, VIEWER],
        ),
      "anonymous direct vendor insert",
    );
  });
  await asRole("authenticated", async () => {
    await mustReject(
      () =>
        db.query(
          `insert into public.vendor_flag_events
             (organization_id, tenant_id, vendor_address, event_type, actor)
           values ($1,$2,$3,'flagged',$4)`,
          [ORG, TENANT, `0x${"c".repeat(40)}`, VIEWER],
        ),
      "authenticated direct event insert",
    );
  });

  await asRole("service_role", async () => {
    const finalRows = await db.query(
      "select count(*)::int as count from public.vendor_flags where removed_at is not null",
    );
    must(finalRows.rows[0].count === 4, "writer unflag state was not persisted");
  });

  await asRole("service_role", async () => {
    await mustReject(
      () => syncOwner(THIRD_OWNER, THIRD_OWNER, 100, 11, "e"),
      "same event position with a different transaction",
    );

    const secondOrg = "10000000-0000-4000-8000-000000000099";
    const newProfile = "40000000-0000-4000-8000-000000000099";
    await db.query("insert into public.organizations (id, name) values ($1, 'New owner org')", [
      secondOrg,
    ]);
    await db.query("insert into public.profiles (id, wallet_address) values ($1,$2)", [
      newProfile,
      NEW_OWNER,
    ]);
    await db.query(
      `insert into public.organization_members (id, organization_id, profile_id, role)
       values ('50000000-0000-4000-8000-000000000099',$1,$2,'owner')`,
      [secondOrg, newProfile],
    );
    await syncOwner(THIRD_OWNER, NEW_OWNER, 101, 1, "f");
    const rehomed = await db.query(
      "select organization_id from public.governed_wallets where id = $1",
      [WALLET_ID],
    );
    must(rehomed.rows[0].organization_id === secondOrg, "single-membership owner was not rehomed");

    const thirdProfile = "40000000-0000-4000-8000-000000000098";
    await db.query("insert into public.profiles (id, wallet_address) values ($1,$2)", [
      thirdProfile,
      THIRD_OWNER,
    ]);
    await db.query(
      `insert into public.organization_members (id, organization_id, profile_id, role)
       values
       ('50000000-0000-4000-8000-000000000097',$1,$3,'owner'),
       ('50000000-0000-4000-8000-000000000098',$2,$3,'owner')`,
      [ORG, secondOrg, thirdProfile],
    );
    await syncOwner(NEW_OWNER, THIRD_OWNER, 102, 1, "a1");
    const ambiguousRehome = await ownerRow();
    must(
      ambiguousRehome.organization_id === secondOrg,
      "two-membership owner unexpectedly changed organization",
    );

    const vendor = "0xdddddddddddddddddddddddddddddddddddddddd";
    const wallet2 = "0xcccccccccccccccccccccccccccccccccccccccc";
    await db.query(
      `insert into public.vendors (organization_id,wallet_address,vendor_address,name)
       values ($1,$2,$3,'one'),($1,$4,$3,'two')`,
      [secondOrg, WALLET, vendor, wallet2],
    );
    await mustReject(
      () =>
        db.query(
          `insert into public.vendors (organization_id,wallet_address,vendor_address,name)
           values ($1,$2,$3,'duplicate')`,
          [secondOrg, WALLET, vendor],
        ),
      "same wallet and vendor",
    );

    await db.query(
      `insert into public.doctrines
       (governed_wallet_id,organization_id,name,version) values ($1,$2,'v1',1)`,
      [WALLET_ID, secondOrg],
    );
    await mustReject(
      () =>
        db.query(
          `insert into public.doctrines
           (governed_wallet_id,organization_id,name,version) values ($1,$2,'duplicate',1)`,
          [WALLET_ID, secondOrg],
        ),
      "duplicate wallet doctrine version",
    );

    const createdWallet = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const createdOwner = "0xabababababababababababababababababababab";
    const args = [
      createdWallet,
      createdOwner,
      "Created",
      `0x${"1".repeat(64)}`,
      5_042_002,
      1,
      2,
      3,
      4,
      ["api", "compute", "data", "subcontracting", "other"],
      true,
      false,
      [createdOwner],
      [createdOwner],
      1,
      50,
      FACTORY,
      WALLET,
      wallet2,
      FOREIGN_WALLET,
      vendor,
    ];
    await db.query(
      `select public.record_created_wallet(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )`,
      args,
    );
    const categories = await db.query(
      `select allowed_categories from public.doctrines d
       join public.governed_wallets w on w.id=d.governed_wallet_id
       where w.wallet_address=$1`,
      [createdWallet],
    );
    must(
      categories.rows[0].allowed_categories.includes("subcontracting"),
      "record_created_wallet omitted subcontracting",
    );
    await mustReject(
      () =>
        db.query(
          `select public.record_created_wallet(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
          )`,
          args.map((value, index) => (index === 9 ? ["unknown"] : value)),
        ),
      "unknown creation category",
    );
  });

  console.log("PGlite wallet authority migration smoke: PASS");
} finally {
  await db.close();
}
