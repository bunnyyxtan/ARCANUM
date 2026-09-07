ALTER TABLE public.doctrines
  ADD COLUMN IF NOT EXISTS freeze_on_blocked_vendor boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.record_created_wallet(
  p_wallet_address text,
  p_owner_address text,
  p_label text,
  p_deploy_tx_hash text,
  p_chain_id integer,
  p_per_tx_cap numeric,
  p_daily_cap numeric,
  p_monthly_cap numeric,
  p_escalation_threshold numeric,
  p_require_allowlist boolean,
  p_freeze_on_blocked_vendor boolean,
  p_signers text[],
  p_council text[],
  p_quorum integer,
  p_posture_score numeric,
  p_wallet_factory text,
  p_policy_engine text,
  p_vendor_registry text,
  p_escalation_manager text,
  p_anomaly_oracle text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet_address text := lower(trim(p_wallet_address));
  v_owner_address text := lower(trim(p_owner_address));
  v_profile profiles%rowtype;
  v_organization organizations%rowtype;
  v_wallet governed_wallets%rowtype;
  v_doctrine doctrines%rowtype;
  v_public_profile public_wallet_profiles%rowtype;
BEGIN
  IF v_wallet_address !~ '^0x[0-9a-f]{40}$'
     OR v_owner_address !~ '^0x[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'record_created_wallet: invalid address' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_chain_id::text || ':' || v_wallet_address, 0));

  SELECT * INTO v_wallet
  FROM governed_wallets
  WHERE chain_id = p_chain_id AND lower(wallet_address) = v_wallet_address
  FOR UPDATE;

  IF v_wallet.id IS NOT NULL AND lower(v_wallet.owner_address) <> v_owner_address THEN
    RAISE EXCEPTION 'record_created_wallet: owner mismatch' USING ERRCODE = '42501';
  END IF;

  INSERT INTO profiles (wallet_address, display_name, updated_at)
  VALUES (
    v_owner_address,
    substr(v_owner_address, 1, 6) || '...' || right(v_owner_address, 4),
    clock_timestamp()
  )
  ON CONFLICT (lower(wallet_address)) DO UPDATE SET updated_at = excluded.updated_at
  RETURNING * INTO v_profile;

  SELECT o.* INTO v_organization
  FROM organization_members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.profile_id = v_profile.id
  ORDER BY m.created_at
  LIMIT 1
  FOR UPDATE OF o;

  IF v_organization.id IS NULL THEN
    INSERT INTO organizations (name, slug, safe_address, created_by, plan, updated_at)
    VALUES (
      'Arcanum Workspace',
      'arcanum-' || substr(v_owner_address, 3),
      v_owner_address,
      v_profile.id,
      'free',
      clock_timestamp()
    )
    RETURNING * INTO v_organization;

    INSERT INTO organization_members (organization_id, profile_id, role)
    VALUES (v_organization.id, v_profile.id, 'owner');
  END IF;

  IF v_wallet.id IS NULL THEN
    INSERT INTO governed_wallets (
      organization_id, wallet_address, owner_address, label, deploy_tx_hash, chain_id,
      status, indexer_status, data_source, wallet_factory_address, policy_engine_address,
      vendor_registry_address, escalation_manager_address, anomaly_oracle_address, created_by
    )
    VALUES (
      v_organization.id, v_wallet_address, v_owner_address, p_label, lower(p_deploy_tx_hash),
      p_chain_id, 'pending_indexer', 'pending', 'live', lower(p_wallet_factory),
      lower(p_policy_engine), lower(p_vendor_registry), lower(p_escalation_manager),
      lower(p_anomaly_oracle), v_profile.id
    )
    RETURNING * INTO v_wallet;
  ELSE
    UPDATE governed_wallets
    SET label = p_label,
        deploy_tx_hash = lower(p_deploy_tx_hash),
        wallet_factory_address = lower(p_wallet_factory),
        policy_engine_address = lower(p_policy_engine),
        vendor_registry_address = lower(p_vendor_registry),
        escalation_manager_address = lower(p_escalation_manager),
        anomaly_oracle_address = lower(p_anomaly_oracle),
        updated_at = clock_timestamp()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
  END IF;

  SELECT * INTO v_doctrine
  FROM doctrines
  WHERE governed_wallet_id = v_wallet.id AND version = 1
  FOR UPDATE;

  IF v_doctrine.id IS NULL THEN
    INSERT INTO doctrines (
      governed_wallet_id, organization_id, name, version, daily_cap_usdc, per_tx_cap_usdc,
      per_vendor_daily_cap_usdc, monthly_cap_usdc, escalate_above_usdc, allowed_categories,
      require_vendor_allowlist, freeze_on_blocked_vendor, signers, escalation_council,
      quorum, status, source, updated_at
    )
    VALUES (
      v_wallet.id, v_organization.id, p_label || ' Doctrine', 1, p_daily_cap, p_per_tx_cap,
      p_per_tx_cap, p_monthly_cap, p_escalation_threshold,
      ARRAY['api', 'compute', 'data', 'other'], p_require_allowlist,
      p_freeze_on_blocked_vendor, p_signers, p_council, p_quorum, 'active', 'on_chain',
      clock_timestamp()
    )
    RETURNING * INTO v_doctrine;
  ELSE
    UPDATE doctrines
    SET name = p_label || ' Doctrine',
        daily_cap_usdc = p_daily_cap,
        per_tx_cap_usdc = p_per_tx_cap,
        per_vendor_daily_cap_usdc = p_per_tx_cap,
        monthly_cap_usdc = p_monthly_cap,
        escalate_above_usdc = p_escalation_threshold,
        require_vendor_allowlist = p_require_allowlist,
        freeze_on_blocked_vendor = p_freeze_on_blocked_vendor,
        signers = p_signers,
        escalation_council = p_council,
        quorum = p_quorum,
        updated_at = clock_timestamp()
    WHERE id = v_doctrine.id
    RETURNING * INTO v_doctrine;
  END IF;

  SELECT * INTO v_public_profile
  FROM public_wallet_profiles
  WHERE lower(wallet_address) = v_wallet_address
  FOR UPDATE;

  IF v_public_profile.id IS NULL THEN
    INSERT INTO public_wallet_profiles (
      governed_wallet_id, wallet_address, show_public_badge, posture_score,
      health_grade, summary, updated_at
    )
    VALUES (
      v_wallet.id, v_wallet_address, false, p_posture_score, 'PENDING INDEXER',
      p_label || ' is awaiting indexed onchain history.', clock_timestamp()
    )
    RETURNING * INTO v_public_profile;
  ELSE
    UPDATE public_wallet_profiles
    SET governed_wallet_id = v_wallet.id, updated_at = clock_timestamp()
    WHERE id = v_public_profile.id
    RETURNING * INTO v_public_profile;
  END IF;

  RETURN jsonb_build_object(
    'wallet', to_jsonb(v_wallet),
    'doctrine', to_jsonb(v_doctrine),
    'public_profile', to_jsonb(v_public_profile)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_created_wallet(
  text, text, text, text, integer, numeric, numeric, numeric, numeric, boolean, boolean,
  text[], text[], integer, numeric, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_created_wallet(
  text, text, text, text, integer, numeric, numeric, numeric, numeric, boolean, boolean,
  text[], text[], integer, numeric, text, text, text, text, text
) TO service_role;