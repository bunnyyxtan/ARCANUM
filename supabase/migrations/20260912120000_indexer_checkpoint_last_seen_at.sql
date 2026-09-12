-- `updated_at` on an indexer checkpoint is event progress: every handled
-- contract event refreshes it. It must not be used as proof that a bounded
-- backfill reached the chain tip.
--
-- `last_seen_at` is written only after Ponder's /ready endpoint confirms a
-- complete catch-up. `last_seen_block` remains the optional cursor captured
-- from Ponder's status endpoint at that same moment.
alter table public.indexer_checkpoints
  add column if not exists last_seen_at timestamptz;

-- Keep this migration self-contained for installations that skipped the
-- earlier reporting-only migration. It is still optional cursor data; the
-- timestamp above is the health proof.
alter table public.indexer_checkpoints
  add column if not exists last_seen_block bigint;

comment on column public.indexer_checkpoints.last_seen_at is
  'Timestamp of the last confirmed full catch-up at Ponder /ready; event progress remains in updated_at.';