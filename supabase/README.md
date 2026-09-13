# Supabase

Database migrations for the Supabase project that backs the production read
model at [thearcanum.in](https://thearcanum.in).

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
