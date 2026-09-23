-- F05/F07 read-model authority hardening.
--
-- OwnershipTransferred is chain state, not an ordinary activity annotation.
-- Keep an ordering watermark on the mirror and update it under a row lock so a
-- replay or a late event cannot move a wallet back to an older owner.

begin;

alter table public.governed_wallets
  add column if not exists owner_sync_block bigint,
  add column if not exists owner_sync_log_index bigint,
  add column if not exists owner_sync_tx_hash text;

create index if not exists governed_wallets_owner_sync_order_idx
  on public.governed_wallets (chain_id, wallet_address, owner_sync_block, owner_sync_log_index);

-- The register is reached through the service-role API and must remain
-- inaccessible to browser roles even if platform defaults are replayed while
-- this migration is being rolled forward.
alter table public.vendor_flags enable row level security;
alter table public.vendor_flag_events enable row level security;
revoke all on public.vendor_flags, public.vendor_flag_events from public, anon, authenticated;
grant select, insert, update, delete on public.vendor_flags to service_role;
grant select, insert, update, delete on public.vendor_flag_events to service_role;

create or replace function public.sync_governed_wallet_owner(
  p_wallet_address text,
  p_chain_id integer,
  p_previous_owner text,
  p_new_owner text,
  p_block_number bigint,
  p_log_index bigint,
  p_tx_hash text
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
begin
  if v_wallet_address !~ '^0x[0-9a-f]{40}$'
     or v_previous_owner !~ '^0x[0-9a-f]{40}$'
     or v_new_owner !~ '^0x[0-9a-f]{40}$'
     or v_new_owner = '0x0000000000000000000000000000000000000000'
     or v_tx_hash !~ '^0x[0-9a-f]{64}$'
     or p_block_number < 0
     or p_log_index < 0 then
    raise exception 'sync_governed_wallet_owner: invalid ownership event'
      using errcode = '22023';
  end if;

  select *
    into v_wallet
    from public.governed_wallets
   where chain_id = p_chain_id
     and lower(wallet_address) = v_wallet_address
   for update;

  -- WalletFactory is permissionless. A foreign wallet must not pin the
  -- deployment checkpoint or fail an otherwise valid indexer run.
  if v_wallet.id is null then
    return null;
  end if;

  -- (block, log) is the total order used by the chain event stream. A replay
  -- of the same event and any late event are no-ops.
  if v_wallet.owner_sync_block is not null
     and (
       p_block_number < v_wallet.owner_sync_block
       or (
         p_block_number = v_wallet.owner_sync_block
         and p_log_index <= coalesce(v_wallet.owner_sync_log_index, -1)
       )
     ) then
    return to_jsonb(v_wallet);
  end if;

  -- Do not overwrite a mirror that has diverged from the event stream. The
  -- caller must rescan from the deployment start rather than guessing an
  -- owner; an already-applied transfer is safe to watermark again.
  if lower(v_wallet.owner_address) <> v_previous_owner
     and lower(v_wallet.owner_address) <> v_new_owner then
    raise exception
      'sync_governed_wallet_owner: previous owner mismatch for % (mirror %, event %)',
      v_wallet_address, v_wallet.owner_address, v_previous_owner
      using errcode = '40001';
  end if;

  update public.governed_wallets
     set owner_address = v_new_owner,
         owner_sync_block = p_block_number,
         owner_sync_log_index = p_log_index,
         owner_sync_tx_hash = v_tx_hash,
         updated_at = clock_timestamp()
   where id = v_wallet.id
   returning * into v_wallet;

  return to_jsonb(v_wallet);
end;
$$;

revoke all on function public.sync_governed_wallet_owner(
  text, integer, text, text, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.sync_governed_wallet_owner(
  text, integer, text, text, bigint, bigint, text
) to service_role;

-- F07 defense in depth. The API performs the same capability check from the
-- current membership row, but service-role REST bypasses RLS, so this
-- transaction must independently reject viewers and removed members.
create or replace function public.vendor_flag_apply(
  p_org uuid,
  p_tenant uuid,
  p_vendor text,
  p_action text,
  p_actor text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.vendor_flags%rowtype;
  v_row public.vendor_flags%rowtype;
  v_actor text := lower(trim(coalesce(p_actor, '')));
begin
  if p_action not in ('flag', 'note', 'unflag') then
    raise exception 'unknown vendor flag action: %', p_action;
  end if;

  -- Lock the workspace before checking the membership. The membership RPCs
  -- take this same lock, so a revocation cannot race a review write.
  perform 1
    from public.organizations
   where id = p_org
   for update;
  if not found then
    raise exception 'vendor_flag_apply: workspace does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.organization_members m
      join public.profiles p on p.id = m.profile_id
     where m.organization_id = p_org
       and lower(p.wallet_address) = v_actor
       -- operator is the real backend capability added by
       -- 20260907143000_anomaly_decision_actor; it is not a browser invite role.
       and m.role::text in ('owner', 'admin', 'approver', 'operator')
  ) then
    raise exception
      'vendor_flag_apply: caller lacks vendor review write capability'
      using errcode = '42501';
  end if;

  select *
    into v_existing
    from public.vendor_flags
   where organization_id = p_org
     and vendor_address = p_vendor
   for update;

  if p_action = 'flag' then
    insert into public.vendor_flags (
      organization_id, tenant_id, vendor_address, flagged_by, note,
      note_updated_by, note_updated_at, removed_by, removed_at, created_at
    )
    values (p_org, p_tenant, p_vendor, v_actor, p_note, null, null, null, null, now())
    on conflict (organization_id, vendor_address) do update
      set tenant_id = excluded.tenant_id,
          flagged_by = excluded.flagged_by,
          note = excluded.note,
          note_updated_by = null,
          note_updated_at = null,
          removed_by = null,
          removed_at = null,
          created_at = now()
    returning * into v_row;
  elsif v_existing.id is null or v_existing.removed_at is not null then
    return null;
  elsif p_action = 'note' then
    update public.vendor_flags
       set note = p_note,
           note_updated_by = v_actor,
           note_updated_at = now()
     where id = v_existing.id
    returning * into v_row;
  else
    update public.vendor_flags
       set removed_by = v_actor,
           removed_at = now()
     where id = v_existing.id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'vendor flag action % changed no row for %', p_action, p_vendor;
  end if;

  insert into public.vendor_flag_events (
    organization_id, tenant_id, vendor_address, event_type, actor, note, created_at
  )
  values (
    p_org, p_tenant, p_vendor,
    case p_action
      when 'flag' then 'flagged'
      when 'note' then 'note_updated'
      else 'unflagged'
    end,
    v_actor,
    case when p_action = 'unflag' then null else p_note end,
    clock_timestamp()
  );

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.vendor_flag_apply(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.vendor_flag_apply(
  uuid, uuid, text, text, text, text
) to service_role;

commit;