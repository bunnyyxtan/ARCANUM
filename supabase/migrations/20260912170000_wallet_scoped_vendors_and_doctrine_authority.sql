-- Wallet-keyed registry rules and chain-version doctrine authority.
-- Arc's BFT finality makes conflicting event identities a data-divergence error,
-- while wallet-scoped keys preserve each governed wallet's independent rules.

begin;

alter table public.vendors
  add column if not exists wallet_address text,
  add column if not exists rule_sync_block bigint,
  add column if not exists rule_sync_log_index bigint,
  add column if not exists rule_sync_tx_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'vendors_wallet_address_check'
       and conrelid = 'public.vendors'::regclass
  ) then
    alter table public.vendors add constraint vendors_wallet_address_check
      check (wallet_address is null or wallet_address ~ '^0x[0-9a-f]{40}$');
  end if;
end;
$$;

drop index if exists public.vendors_org_domain_address_uidx;
-- Deliberately not a partial index: PostgREST upserts infer the conflict
-- target from the column list alone, and Postgres cannot match a partial
-- index without its predicate. NULL wallet rows (legacy, pre-wallet-scope)
-- never collide under the default NULLS DISTINCT semantics.
create unique index if not exists vendors_wallet_vendor_uidx
  on public.vendors (wallet_address, vendor_address);
create index if not exists vendors_wallet_idx on public.vendors (wallet_address);
create unique index if not exists doctrines_wallet_version_uidx
  on public.doctrines (governed_wallet_id, version);

-- The indexer now stages registry rules and escalation lifecycle events for
-- wallets the read model has not filed yet, replaying them in (block, log)
-- order once the wallet row exists. The staging table's kind check predates
-- those kinds and would reject them, stalling the indexer on the first one.
do $$
begin
  if to_regclass('public.unlinked_ledger_events') is not null then
    alter table public.unlinked_ledger_events
      drop constraint if exists unlinked_ledger_events_event_kind_check;
    alter table public.unlinked_ledger_events
      add constraint unlinked_ledger_events_event_kind_check check (
        event_kind in (
          'transfer_executed', 'transfer_escalated',
          'vendor_added', 'vendor_blocked', 'vendor_removed',
          'escalation_approval', 'escalation_status'
        )
      );
  end if;
end;
$$;

drop function if exists public.record_created_wallet(
  text, text, text, text, integer, numeric, numeric, numeric, numeric, boolean, boolean,
  text[], text[], integer, numeric, text, text, text, text, text
);

create or replace function public.record_created_wallet(
  p_wallet_address text,
  p_owner_address text,
  p_label text,
  p_deploy_tx_hash text,
  p_chain_id integer,
  p_per_tx_cap numeric,
  p_daily_cap numeric,
  p_monthly_cap numeric,
  p_escalation_threshold numeric,
  p_allowed_categories text[],
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
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet_address text := lower(trim(p_wallet_address));
  v_owner_address text := lower(trim(p_owner_address));
  v_profile profiles%rowtype;
  v_organization organizations%rowtype;
  v_wallet governed_wallets%rowtype;
  v_doctrine doctrines%rowtype;
  v_public_profile public_wallet_profiles%rowtype;
begin
  if v_wallet_address !~ '^0x[0-9a-f]{40}$'
     or v_owner_address !~ '^0x[0-9a-f]{40}$' then
    raise exception 'record_created_wallet: invalid address' using errcode = '22023';
  end if;
  if p_allowed_categories is null
     or exists (
       select 1 from unnest(p_allowed_categories) category
        where category is null
           or category not in ('api', 'compute', 'data', 'subcontracting', 'other')
     ) then
    raise exception 'record_created_wallet: invalid allowed categories' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_chain_id::text || ':' || v_wallet_address, 0));
  select * into v_wallet from governed_wallets
   where chain_id = p_chain_id and lower(wallet_address) = v_wallet_address for update;
  if v_wallet.id is not null and lower(v_wallet.owner_address) <> v_owner_address then
    raise exception 'record_created_wallet: owner mismatch' using errcode = '42501';
  end if;

  insert into profiles (wallet_address, display_name, updated_at)
  values (v_owner_address, substr(v_owner_address, 1, 6) || '...' || right(v_owner_address, 4),
          clock_timestamp())
  on conflict (lower(wallet_address)) do update set updated_at = excluded.updated_at
  returning * into v_profile;

  select o.* into v_organization from organization_members m
  join organizations o on o.id = m.organization_id
  where m.profile_id = v_profile.id order by m.created_at limit 1 for update of o;
  if v_organization.id is null then
    insert into organizations (name, slug, safe_address, created_by, plan, updated_at)
    values ('Arcanum Workspace', 'arcanum-' || substr(v_owner_address, 3), v_owner_address,
            v_profile.id, 'free', clock_timestamp()) returning * into v_organization;
    insert into organization_members (organization_id, profile_id, role)
    values (v_organization.id, v_profile.id, 'owner');
  end if;

  if v_wallet.id is null then
    insert into governed_wallets (
      organization_id, wallet_address, owner_address, label, deploy_tx_hash, chain_id,
      status, indexer_status, data_source, wallet_factory_address, policy_engine_address,
      vendor_registry_address, escalation_manager_address, anomaly_oracle_address, created_by
    ) values (
      v_organization.id, v_wallet_address, v_owner_address, p_label, lower(p_deploy_tx_hash),
      p_chain_id, 'pending_indexer', 'pending', 'live', lower(p_wallet_factory),
      lower(p_policy_engine), lower(p_vendor_registry), lower(p_escalation_manager),
      lower(p_anomaly_oracle), v_profile.id
    ) returning * into v_wallet;
  else
    update governed_wallets set
      label = p_label, deploy_tx_hash = lower(p_deploy_tx_hash),
      wallet_factory_address = lower(p_wallet_factory),
      policy_engine_address = lower(p_policy_engine),
      vendor_registry_address = lower(p_vendor_registry),
      escalation_manager_address = lower(p_escalation_manager),
      anomaly_oracle_address = lower(p_anomaly_oracle), updated_at = clock_timestamp()
    where id = v_wallet.id returning * into v_wallet;
  end if;

  select * into v_doctrine from doctrines
   where governed_wallet_id = v_wallet.id and version = 1 for update;
  if v_doctrine.id is null then
    insert into doctrines (
      governed_wallet_id, organization_id, name, version, daily_cap_usdc, per_tx_cap_usdc,
      per_vendor_daily_cap_usdc, monthly_cap_usdc, escalate_above_usdc, allowed_categories,
      require_vendor_allowlist, freeze_on_blocked_vendor, signers, escalation_council,
      quorum, status, source, updated_at
    ) values (
      v_wallet.id, v_organization.id, p_label || ' Doctrine', 1, p_daily_cap, p_per_tx_cap,
      p_per_tx_cap, p_monthly_cap, p_escalation_threshold, p_allowed_categories,
      p_require_allowlist, p_freeze_on_blocked_vendor, p_signers, p_council, p_quorum,
      'active', 'on_chain', clock_timestamp()
    ) returning * into v_doctrine;
  else
    update doctrines set
      name = p_label || ' Doctrine', daily_cap_usdc = p_daily_cap,
      per_tx_cap_usdc = p_per_tx_cap, per_vendor_daily_cap_usdc = p_per_tx_cap,
      monthly_cap_usdc = p_monthly_cap, escalate_above_usdc = p_escalation_threshold,
      allowed_categories = p_allowed_categories,
      require_vendor_allowlist = p_require_allowlist,
      freeze_on_blocked_vendor = p_freeze_on_blocked_vendor, signers = p_signers,
      escalation_council = p_council, quorum = p_quorum, updated_at = clock_timestamp()
    where id = v_doctrine.id returning * into v_doctrine;
  end if;

  select * into v_public_profile from public_wallet_profiles
   where lower(wallet_address) = v_wallet_address for update;
  if v_public_profile.id is null then
    insert into public_wallet_profiles (
      governed_wallet_id, wallet_address, show_public_badge, posture_score,
      health_grade, summary, updated_at
    ) values (
      v_wallet.id, v_wallet_address, false, p_posture_score, 'PENDING INDEXER',
      p_label || ' is awaiting indexed onchain history.', clock_timestamp()
    ) returning * into v_public_profile;
  else
    update public_wallet_profiles set governed_wallet_id = v_wallet.id,
      updated_at = clock_timestamp() where id = v_public_profile.id
      returning * into v_public_profile;
  end if;
  return jsonb_build_object('wallet', to_jsonb(v_wallet), 'doctrine', to_jsonb(v_doctrine),
                            'public_profile', to_jsonb(v_public_profile));
end;
$$;

revoke all on function public.record_created_wallet(
  text, text, text, text, integer, numeric, numeric, numeric, numeric, text[], boolean, boolean,
  text[], text[], integer, numeric, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_created_wallet(
  text, text, text, text, integer, numeric, numeric, numeric, numeric, text[], boolean, boolean,
  text[], text[], integer, numeric, text, text, text, text, text
) to service_role;

create or replace function public.sync_governed_wallet_owner(
  p_wallet_address text, p_chain_id integer, p_previous_owner text, p_new_owner text,
  p_block_number bigint, p_log_index bigint, p_tx_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.governed_wallets%rowtype;
  v_wallet_address text := lower(trim(coalesce(p_wallet_address, '')));
  v_previous_owner text := lower(trim(coalesce(p_previous_owner, '')));
  v_new_owner text := lower(trim(coalesce(p_new_owner, '')));
  v_tx_hash text := lower(trim(coalesce(p_tx_hash, '')));
  v_new_organization_id uuid;
begin
  if v_wallet_address !~ '^0x[0-9a-f]{40}$'
     or v_previous_owner !~ '^0x[0-9a-f]{40}$'
     or v_new_owner !~ '^0x[0-9a-f]{40}$'
     or v_new_owner = '0x0000000000000000000000000000000000000000'
     or v_tx_hash !~ '^0x[0-9a-f]{64}$' or p_block_number < 0 or p_log_index < 0 then
    raise exception 'sync_governed_wallet_owner: invalid ownership event' using errcode = '22023';
  end if;
  select * into v_wallet from public.governed_wallets
   where chain_id = p_chain_id and lower(wallet_address) = v_wallet_address for update;
  if v_wallet.id is null then return null; end if;

  if v_wallet.owner_sync_block = p_block_number
     and coalesce(v_wallet.owner_sync_log_index, -1) = p_log_index then
    if lower(coalesce(v_wallet.owner_sync_tx_hash, '')) <> v_tx_hash then
      raise exception 'sync_governed_wallet_owner: conflicting transaction at event position'
        using errcode = '40001';
    end if;
    return to_jsonb(v_wallet);
  end if;
  if v_wallet.owner_sync_block is not null and (
    p_block_number < v_wallet.owner_sync_block or
    (p_block_number = v_wallet.owner_sync_block
     and p_log_index < coalesce(v_wallet.owner_sync_log_index, -1))
  ) then return to_jsonb(v_wallet); end if;
  if lower(v_wallet.owner_address) <> v_previous_owner
     and lower(v_wallet.owner_address) <> v_new_owner then
    raise exception 'sync_governed_wallet_owner: previous owner mismatch for % (mirror %, event %)',
      v_wallet_address, v_wallet.owner_address, v_previous_owner using errcode = '40001';
  end if;

  select (array_agg(m.organization_id))[1] into v_new_organization_id
    from public.profiles p join public.organization_members m on m.profile_id = p.id
   where lower(p.wallet_address) = v_new_owner
   having count(*) = 1;
  update public.governed_wallets set owner_address = v_new_owner,
    organization_id = coalesce(v_new_organization_id, organization_id),
    owner_sync_block = p_block_number, owner_sync_log_index = p_log_index,
    owner_sync_tx_hash = v_tx_hash, updated_at = clock_timestamp()
  where id = v_wallet.id returning * into v_wallet;
  return to_jsonb(v_wallet);
end;
$$;

revoke all on function public.sync_governed_wallet_owner(
  text, integer, text, text, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.sync_governed_wallet_owner(
  text, integer, text, text, bigint, bigint, text
) to service_role;

commit;