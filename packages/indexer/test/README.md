Tests live here, not under `src/`.

Ponder loads every file in `src/` as indexing code when it starts, so a test
file there is executed inside the indexer process: importing `vitest` outside a
vitest run throws "Vitest failed to access its internal state" and `ponder
start` exits before indexing a block. Keep `src/` to code Ponder should run.

## Scheduling and finalization contract

The indexer serializes Supabase entry points in invocation order. Checkpoints
still record each successfully handled event height, never an RPC head. Global
staging scans and checkpoint GETs are coalesced for at most five seconds; failed
scans/writes invalidate their caches and reject their callers. Ponder must retain
its handler-failure/retry behavior. The quiet-chain timer retries staged work
every five seconds without changing event progress or catch-up evidence. It
does not keep the process alive and never accumulates timer jobs behind a slow
request. Complete staged queues are read before replay in (block, log) order.

There must still be **one writer per deployment**. This process-local queue/cache
is not a distributed lock, and does not make multiple Ponders safe. Catch-up
finalization remains the database RPC's durable, deployment-scoped decision.

## Handler and persistence contract

Handlers must preserve Ponder's failure and retry semantics: a failed
persistence operation must reject the handler rather than being treated as a
successful event. Event writes are immutable evidence and must retain their
deployment, block, transaction, and log identity; duplicate delivery may be
recognized without overwriting an existing row or changing its payload.

The shared persistence adapter owns the common wallet, organization, event, and
transfer operations. Handler-specific mutations remain next to their event
mapping so that adding an adapter does not silently change event semantics.
Supabase-only mode requires its configured credentials; otherwise the supported
legacy Drizzle mirror remains available for local development. Disabling one
mirror must not disable the other persistence target or make a partially
successful handler look successful.

## Ledger event persistence

The ledger path uses the atomic `public.insert_ledger_event(jsonb)` RPC from
`supabase/migrations/20260923161000_atomic_ledger_event.sql`. It inserts or
returns the row for the `(chain_id, tx_hash, log_index)` identity, checks
immutable fields and known policy claims, and rejects conflicting payloads. The
fast path therefore handles duplicate delivery and concurrent writers without a
client-side read-before-write or an overwrite.

For compatibility with a database that has not exposed that RPC, the adapter
falls back only on the explicit PostgREST missing-function response. That path
does a bounded identity read, inserts when absent, and uses the unique index
from `20260907150000_ledger_event_identity_log_index.sql` to protect races;
returned rows still undergo the same immutable-payload check. Other RPC errors
fail closed rather than silently selecting the fallback.

## Supported persistence modes

`ARCANUM_DISABLE_PG_MIRROR=1` is Supabase-only and requires credentials.
Otherwise legacy Drizzle remains enabled; local development can use it without
Supabase (with the existing warning). Production still requires Supabase.
The shared wallet/organization/event/transfer persistence operations and mode
gate live in `src/legacy-mirror.ts`; handler-specific mutations remain in
`src/index.ts` to avoid an unbounded event-mapping rewrite.
No `@arcanum/db` schema, migrations, auth consumers, or local mirror mode is
removed. This is partial adapter isolation, not legacy retirement.

Run offline focused tests with `npm run test --workspace @arcanum/indexer -- --maxWorkers=1`
from the repository root. No tests require a live database or Supabase credentials.
