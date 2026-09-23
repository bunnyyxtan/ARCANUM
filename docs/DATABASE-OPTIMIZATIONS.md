# Database read-model optimizations

These changes preserve the public API responses and keep the existing Supabase
database. They do not change contracts, move funds, rewrite ledger history, or
retire the legacy read model.

## Changes

- `scoped_ledger_analytics` computes counts, governed value, spending, and latest
  wallet activity in PostgreSQL instead of downloading complete event histories.
- `scoped_anomaly_counts` returns counts rather than every anomaly row.
- `scoped_current_doctrines` returns the latest doctrine per authorized wallet
  rather than its full version history.
- `insert_ledger_event` inserts or returns an existing event in one request.
  A conflicting immutable event fails instead of overwriting history.
- Five duplicate, non-unique ledger indexes are removed only after their retained
  counterparts pass catalog-equivalence and dependency checks. The unique
  chain/transaction/log index is retained.

The analytics functions intersect server-authorized wallet IDs with the current
factory and the authenticated owner's or authorized organization's wallets.
Organization membership remains verified by the API, not accepted from browser
input. All new functions are callable by `service_role`, not `anon`,
`authenticated`, or `PUBLIC`.

Money returned by aggregate and insertion functions crosses the JSON boundary as
decimal text. Native JSON numbers cannot preserve all values supported by the
database's numeric columns. Replays retain the original row and its ID;
refreshable labels, organization attribution, and snapshot enrichment do not
overwrite historical records.

## Old-schema compatibility

The exhaustive readers and previous insert path remain available only when the
specific new function is absent. Authentication errors, outages, malformed
responses, and conflicting events must propagate. An ambiguous write must never
trigger a second insertion through the compatibility path.

This allows the SQL functions to be installed before the application release.
After deployment, reload the PostgREST schema cache and restart the indexer so a
previously observed missing function is not retained in process-local capability
state. Rolling the application back does not require removing the new functions.

## Isolated verification

PostgreSQL 17 and the existing npm dependencies must be installed.

```sh
npm run test:database-optimizations
```

The runner clears inherited credentials, creates a private temporary PostgreSQL
cluster with synthetic data, and removes it on completion or failure. It accepts
no database URL. Tests check:

- Migration reapplication and function permissions.
- Exact monetary results, window boundaries, latest activity and wallet scope.
- Real JSON serialization, missing-function compatibility, and malformed results.
- Fresh inserts, identical replays, conflicting events, and concurrent races.
- Duplicate-index removal, retained indexes, and fail-closed catalog mismatches.
- Summary payload size against a larger synthetic event history.

For a full schema-only rehearsal, capture the public schema, real auth helpers,
and `auth.users` definition through read-only access, then run:

```sh
bash .github/scripts/database-optimization-test.sh \
  --actual-schema /absolute/public-schema.sql \
  /absolute/auth-helpers.sql /absolute/auth-users.sql
```

No production rows are needed. Restore errors are fatal; the runner does not
replace missing production objects with permissive authentication stubs.

## Rollout

Apply these migrations in order through the existing external Supabase migration
process, after confirming the target deployment and passing the isolated checks:

1. `20260923160000_scoped_analytics.sql`
2. `20260923161000_atomic_ledger_event.sql`
3. `20260923162000_remove_duplicate_ledger_indexes.sql`

The first two files own their transactions. The index-cleanup file must run in a
transaction so its `SET LOCAL` safety timeouts apply, for example with
`psql -X -v ON_ERROR_STOP=1 --single-transaction -f <file>`.
A lock timeout is a failed migration, not permission to disable the timeout or
drop a different index. Check the schema migration tracker against actual state.

After application, verify function permissions, retained index validity, unchanged
ledger rows, and aggregate parity before deploying the API and indexer together.
The old application can continue to run while the additive SQL changes are
installed. Removing a redundant index does not require changing callers.

Synthetic payload reduction is not a production latency benchmark. Evaluate live
query plans and request counts before making latency or capacity claims.
