-- The indexer advances `last_block` only while handling one of Arcanum's own
-- contract events, so on a quiet chain the checkpoint sits at the last event
-- and looks like it is lagging by however long the chain has been quiet.
-- `last_seen_block` records how far the read model is known to be level with
-- the chain regardless of events: the catch-up job writes Ponder's reported
-- chain position once /ready confirms the backfill reached the tip.
--
-- `last_block` keeps its meaning (the height the indexer actually processed)
-- and the indexer's skip rule still keys off it; this column is reporting only.
alter table public.indexer_checkpoints
  add column if not exists last_seen_block bigint;

comment on column public.indexer_checkpoints.last_seen_block is
  'Highest chain block the read model is confirmed level with (written by the catch-up job at /ready); last_block is the last block that carried an Arcanum event.';
