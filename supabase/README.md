# Supabase

Database migrations for the Supabase project that backs the production read
model at [thearcanum.in](https://thearcanum.in).

This public directory contains incremental application migrations, not a complete
empty-database bootstrap or a production database export. Earlier migrations
assume an existing read-model schema. Do not apply the directory to an empty
database and assume that every prerequisite table has been created.

## Layout

| Path | Purpose |
| --- | --- |
| `migrations/` | Ordered SQL migrations, named `YYYYMMDDHHMMSS_description.sql` |

## Applying a migration

Migrations are applied to the Supabase database through the SQL editor or the
Supabase CLI, in filename order. Each file is written to be idempotent where
possible and includes the row-level security and function definitions it needs.

Never run untested SQL against the production database. Test against a
development database first.

## Application security migrations

The revocable-session and distributed-rate-limit migrations are application
security controls, not optional operational examples. Apply them to a
compatible development schema before testing the corresponding API, then review
them before any production rollout. They create service-role-only tables and
RPCs with explicit RLS and grants. Publishing their source does not apply it to
a hosted database.

For revocable sessions, every user must sign in again after rollout: previously
issued cookies have no server-side session record and are intentionally rejected.
The local-only `ARCANUM_SESSION_STORE_MODE=local-test` mode is accepted only in
development or test and is refused in production. Missing schema or storage
configuration fails closed; no cookie is issued when the session store is
unavailable.

The receipt-execution uniqueness migration is also part of the application
schema. If it reports historical duplicate links, stop and review those records;
do not delete evidence automatically to make a uniqueness check pass.

## Security test instructions

To exercise the security invariants without touching an existing database:

```sh
npm ci
bash .github/scripts/security-sql-test.sh /usr/lib/postgresql/17/bin
```

The runner requires PostgreSQL 17 tools, clears inherited database credentials,
starts its own disposable local cluster, and never applies SQL to the hosted
Supabase project.

Check SECURITY DEFINER grants with `node scripts/check-definer-grants.mjs`. The
script uses the existing `psql` executable and `SUPABASE_DB_URL` (or
`DATABASE_URL`); it fails if `anon` can execute a function outside its explicit
allow-list. The equivalent inspection query is:

```sh
psql "$SUPABASE_DB_URL" -c "select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');"
```

## Reconciling doctrine mirrors

The `doctrines` table mirrors each governed wallet's onchain policy, keyed by
the wallet and the chain's `policyVersion()`. If a mirror drifts (a deploy was
recorded from a stale receipt, or a migration changed how a field is derived),
audit it from `packages/api` with `npx tsx scripts/reconcile-doctrines.ts`.
The script needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `ARC_RPC_URL`,
reads every wallet's policy from one chain snapshot, prints a per-wallet drift
table and writes nothing. Pass `--apply` only after reviewing that table and
after every migration up to `20260912170000` has been applied.
