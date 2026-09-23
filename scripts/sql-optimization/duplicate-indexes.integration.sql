\set ON_ERROR_STOP on
-- Recreate the production duplicates only inside a transaction.  The migration
-- must remove exactly those five, preserve retained/identity indexes, and be
-- safe to apply again.  ROLLBACK leaves the shared disposable DB unchanged.
BEGIN;
CREATE INDEX ledger_events_org_idx ON public.ledger_events (organization_id);
CREATE INDEX ledger_events_status_idx ON public.ledger_events (status);
CREATE INDEX ledger_events_time_idx ON public.ledger_events (event_time DESC);
CREATE INDEX ledger_events_tx_hash_idx ON public.ledger_events (tx_hash);
CREATE INDEX ledger_events_wallet_idx ON public.ledger_events (governed_wallet_id);

\ir ../../supabase/migrations/20260923162000_remove_duplicate_ledger_indexes.sql
\ir ../../supabase/migrations/20260923162000_remove_duplicate_ledger_indexes.sql

DO $$
DECLARE
  index_name text;
BEGIN
  FOREACH index_name IN ARRAY ARRAY[
    'ledger_events_org_idx', 'ledger_events_status_idx',
    'ledger_events_time_idx', 'ledger_events_tx_hash_idx',
    'ledger_events_wallet_idx'
  ] LOOP
    IF to_regclass('public.' || index_name) IS NOT NULL THEN
      RAISE EXCEPTION 'duplicate index was not removed: %', index_name;
    END IF;
  END LOOP;
  FOREACH index_name IN ARRAY ARRAY[
    'idx_le_org', 'idx_le_status', 'idx_le_event_time', 'idx_le_tx_hash',
    'idx_le_wallet', 'ledger_events_chain_tx_log_unique'
  ] LOOP
    IF to_regclass('public.' || index_name) IS NULL THEN
      RAISE EXCEPTION 'required index was removed: %', index_name;
    END IF;
  END LOOP;
  IF NOT (SELECT indisunique FROM pg_index
          WHERE indexrelid = 'public.ledger_events_chain_tx_log_unique'::regclass) THEN
    RAISE EXCEPTION 'ledger identity index is no longer unique';
  END IF;
END
$$;
ROLLBACK;