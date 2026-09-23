\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
-- Synthetic transport-size benchmark only. It runs in the disposable database,
-- makes no latency/production claims, and rolls back every generated row.
BEGIN;

INSERT INTO public.organizations (id, name, slug)
VALUES ('b0000000-0000-4000-8000-000000000001', 'Synthetic benchmark', 'synthetic-benchmark');

INSERT INTO public.governed_wallets (
  id, organization_id, wallet_address, owner_address, chain_id, wallet_factory_address
)
SELECT
  ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'b0000000-0000-4000-8000-000000000001',
  '0x' || lpad(to_hex(n), 40, '0'),
  '0x1111111111111111111111111111111111111111',
  5042002,
  '0x4444444444444444444444444444444444444444'
FROM generate_series(1, 4) AS n;

INSERT INTO public.ledger_events (
  organization_id, governed_wallet_id, tx_hash, log_index, event_time,
  amount_usdc, status, decision_reason, chain_id, policy_snapshot, data_source
)
SELECT
  'b0000000-0000-4000-8000-000000000001',
  ('b0000000-0000-4000-8000-' || lpad((1 + ((n - 1) % 4))::text, 12, '0'))::uuid,
  'synthetic-benchmark-' || n,
  n,
  '2026-09-23T00:00:00Z',
  1.000001,
  'allowed',
  'synthetic',
  5042002,
  '{}'::jsonb,
  'live'
FROM generate_series(1, 10000) AS n;

CREATE TEMP TABLE scoped_benchmark_result ON COMMIT DROP AS
WITH raw AS (
  SELECT count(*)::bigint AS row_count,
    octet_length(jsonb_agg(
      to_jsonb(e) || jsonb_build_object('amount_usdc', e.amount_usdc::text)
      ORDER BY e.log_index
    )::text)::bigint AS raw_bytes
  FROM public.ledger_events e
  WHERE e.organization_id = 'b0000000-0000-4000-8000-000000000001'
), scoped AS (
  SELECT public.scoped_ledger_analytics(
    ARRAY[
      'b0000000-0000-4000-8000-000000000001'::uuid,
      'b0000000-0000-4000-8000-000000000002'::uuid,
      'b0000000-0000-4000-8000-000000000003'::uuid,
      'b0000000-0000-4000-8000-000000000004'::uuid
    ],
    '0x1111111111111111111111111111111111111111',
    'b0000000-0000-4000-8000-000000000001',
    '0x4444444444444444444444444444444444444444',
    '2026-09-22T00:00:00Z',
    '2026-09-24T00:00:00Z',
    true
  ) AS summary
)
SELECT raw.row_count, raw.raw_bytes,
  octet_length(scoped.summary::text)::bigint AS summary_bytes,
  scoped.summary
FROM raw CROSS JOIN scoped;

DO $$
DECLARE
  result scoped_benchmark_result;
  wallet jsonb;
BEGIN
  SELECT * INTO STRICT result FROM scoped_benchmark_result;
  IF result.row_count <> 10000
     OR (result.summary ->> 'total')::bigint <> 10000
     OR (result.summary ->> 'movementCount')::bigint <> 10000
     OR (result.summary ->> 'denied')::bigint <> 0
     OR (result.summary ->> 'blocked24h')::bigint <> 0
     OR result.summary ->> 'valueBaseUnits' <> '10000010000'
     OR jsonb_array_length(result.summary -> 'activity') <> 4 THEN
    RAISE EXCEPTION 'synthetic aggregate totals were not exact: %', result.summary;
  END IF;
  FOR wallet IN SELECT value FROM jsonb_array_elements(result.summary -> 'activity')
  LOOP
    IF wallet ->> 'spendBaseUnits' <> '2500002500' THEN
      RAISE EXCEPTION 'synthetic per-wallet money was not exact: %', wallet;
    END IF;
  END LOOP;
  IF result.summary_bytes >= result.raw_bytes THEN
    RAISE EXCEPTION 'scoped response was not smaller than raw JSON';
  END IF;
END
$$;

SELECT jsonb_build_object(
  'benchmark', 'synthetic_scoped_analytics_transport_bytes',
  'row_count', row_count,
  'raw_json_bytes', raw_bytes,
  'summary_json_bytes', summary_bytes,
  'exact_value_base_units', summary ->> 'valueBaseUnits'
)
FROM scoped_benchmark_result;

ROLLBACK;