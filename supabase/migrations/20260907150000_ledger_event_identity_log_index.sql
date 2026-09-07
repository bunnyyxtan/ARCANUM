-- Run with every indexer stopped: the old writer upserts on tx_hash alone and must not race
-- the identity change. The column is added NOT NULL with a default so existing rows are
-- backfilled in the same statement; the default is dropped immediately so a writer that
-- omits log_index fails instead of silently colliding on 0.
begin;

alter table public.ledger_events
  add column if not exists log_index integer not null default 0;

alter table public.ledger_events
  alter column log_index drop default;

create unique index if not exists ledger_events_chain_tx_log_unique
  on public.ledger_events (chain_id, tx_hash, log_index);

drop index if exists public.ledger_events_tx_hash_unique;

commit;
