begin;

-- Server-only read-model aggregates. Authorized wallet IDs, owner, membership
-- organization and current factory MUST be supplied by the API, not browser
-- input. The single-tenant database has no tenant identity column; tenant auth
-- remains the API's responsibility. Invoker security retains ordinary table
-- permissions/RLS and only service_role can execute these functions.
CREATE OR REPLACE FUNCTION public.scoped_ledger_analytics(
  p_wallet_ids uuid[], p_owner_address text, p_organization_id uuid,
  p_factory_address text, p_since timestamptz, p_until timestamptz,
  p_all_time boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_since IS NULL OR p_until IS NULL OR p_since > p_until OR p_all_time IS NULL THEN
    RAISE EXCEPTION 'Invalid analytics window' USING ERRCODE = '22023';
  END IF;
  RETURN (
    WITH authorized AS (
      SELECT w.id FROM public.governed_wallets w
      WHERE w.id = ANY(p_wallet_ids)
        AND nullif(p_owner_address, '') IS NOT NULL
        AND lower(w.wallet_factory_address) = lower(nullif(p_factory_address, ''))
        AND (lower(w.owner_address) = lower(p_owner_address)
          OR w.organization_id = p_organization_id)
    ), facts AS (
      SELECT e.governed_wallet_id AS wallet_id, e.event_time,
        CASE
          WHEN lower(e.status::text) IN ('deny','denied','blocked','rejected') THEN 'DENY'
          WHEN lower(e.status::text) IN ('freeze','frozen') THEN 'FREEZE'
          WHEN lower(e.status::text) IN ('escalate','escalated') THEN 'ESCALATE'
          ELSE 'ALLOW'
        END AS verdict,
        -- Native numeric(28,6) stores signed USDC, never legacy base-unit
        -- strings. Multiply before JSON serialization, preserving negatives
        -- and values beyond JS safe integers. PostgreSQL applies column-scale
        -- rounding on insertion (including scientific-notation inputs).
        -- Legacy textual heuristics belong ONLY to the old-schema JS reader.
        coalesce(e.amount_usdc, 0) * 1000000 AS amount,
        -- JS Date drops sub-millisecond precision before mapper comparisons.
        -- The bounded raw-query predicate below intentionally remains exact,
        -- as it was in the standalone daily compatibility reader.
        date_trunc('milliseconds', e.event_time) >= p_since
          AND date_trunc('milliseconds', e.event_time) <= p_until AS in_window
      FROM public.ledger_events e JOIN authorized w ON w.id = e.governed_wallet_id
      WHERE p_all_time OR (e.event_time >= p_since AND e.event_time <= p_until)
    ), per_wallet AS (
      SELECT wallet_id, max(event_time) AS last_activity,
        coalesce(sum(amount) FILTER (WHERE in_window AND verdict = 'ALLOW'), 0) AS spend
      FROM facts GROUP BY wallet_id
    )
    SELECT jsonb_build_object(
      'total', count(*),
      'denied', count(*) FILTER (WHERE verdict = 'DENY'),
      'blocked24h', count(*) FILTER (WHERE in_window AND verdict IN ('DENY','FREEZE')),
      'movementCount', count(*) FILTER (WHERE in_window AND verdict = 'ALLOW'),
      'valueBaseUnits', trunc(coalesce(sum(amount) FILTER (WHERE in_window AND verdict = 'ALLOW'), 0))::text,
      'activity', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'walletId', wallet_id, 'spendBaseUnits', trunc(spend)::text,
        'lastActivityAt', last_activity
      ) ORDER BY wallet_id), '[]'::jsonb) FROM per_wallet)
    ) FROM facts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.scoped_anomaly_counts(
  p_wallet_ids uuid[], p_owner_address text, p_organization_id uuid, p_factory_address text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'danger', count(*) FILTER (WHERE lower(a.severity::text) IN ('critical','high','danger'))
  )
  FROM public.anomalies a JOIN public.governed_wallets w ON w.id = a.governed_wallet_id
  WHERE w.id = ANY(p_wallet_ids)
    AND nullif(p_owner_address, '') IS NOT NULL
    AND lower(w.wallet_factory_address) = lower(nullif(p_factory_address, ''))
    AND (lower(w.owner_address) = lower(p_owner_address) OR w.organization_id = p_organization_id)
    AND lower(coalesce(a.status::text, 'open')) <> 'dismissed';
$$;

-- One row per authorized wallet rather than every historic doctrine version.
-- Unique (governed_wallet_id, version) makes selection deterministic.
CREATE OR REPLACE FUNCTION public.scoped_current_doctrines(
  p_wallet_ids uuid[], p_owner_address text, p_organization_id uuid, p_factory_address text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY w.id), '[]'::jsonb)
  FROM public.governed_wallets w
  CROSS JOIN LATERAL (
    SELECT doctrine.* FROM public.doctrines doctrine
    WHERE doctrine.governed_wallet_id = w.id
    ORDER BY doctrine.version DESC LIMIT 1
  ) d
  WHERE w.id = ANY(p_wallet_ids)
    AND nullif(p_owner_address, '') IS NOT NULL
    AND lower(w.wallet_factory_address) = lower(nullif(p_factory_address, ''))
    AND (lower(w.owner_address) = lower(p_owner_address) OR w.organization_id = p_organization_id);
$$;

REVOKE ALL ON FUNCTION public.scoped_ledger_analytics(uuid[],text,uuid,text,timestamptz,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoped_anomaly_counts(uuid[],text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scoped_current_doctrines(uuid[],text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scoped_ledger_analytics(uuid[],text,uuid,text,timestamptz,timestamptz,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoped_anomaly_counts(uuid[],text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.scoped_current_doctrines(uuid[],text,uuid,text) TO service_role;

commit;