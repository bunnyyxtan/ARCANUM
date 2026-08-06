-- Close a check-then-act window in the workspace write functions.
--
-- The membership functions verified that the caller was an owner and only then
-- took the row lock. Between those two steps another owner could revoke them,
-- so a just-demoted owner could still complete one more write -- exactly the
-- write the revocation was meant to stop. The lock now comes first and
-- ownership is proved while holding it, which is what makes revocation take
-- effect immediately rather than "usually".
--
-- Renaming had the same shape one layer up: the API read membership, then sent
-- a separate PATCH. It moves into a function here for the same reason.

create or replace function public.workspace_add_member(
  p_org uuid,
  p_actor text,
  p_wallet text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := lower(trim(coalesce(p_actor, '')));
  v_wallet text := lower(trim(coalesce(p_wallet, '')));
  -- A teammate arrives read-only. Granting anything more is a deliberate act by
  -- the owner, not the default for anyone whose address gets typed in.
  v_role text := lower(trim(coalesce(nullif(p_role, ''), 'viewer')));
  v_profile_id uuid;
  v_existing_org uuid;
  v_member organization_members%rowtype;
begin
  if v_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'workspace_add_member: wallet address is not a valid address'
      using errcode = '22023';
  end if;

  -- Roles are an enum in the schema; validating against the enum itself means
  -- this function keeps working when a role is added there.
  if not exists (
    select 1 from unnest(enum_range(null::org_role)) as allowed where allowed::text = v_role
  ) then
    raise exception 'workspace_add_member: unknown role %', v_role using errcode = '22023';
  end if;

  -- Lock first, then prove ownership under the lock: a concurrent
  -- workspace_remove_member cannot slip between the two.
  perform 1 from organizations where id = p_org for update;
  if not found then
    raise exception 'workspace_add_member: workspace does not exist' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from organization_members m
    join profiles p on p.id = m.profile_id
    where m.organization_id = p_org
      and lower(p.wallet_address) = v_actor
      and m.role = 'owner'
  ) then
    raise exception 'workspace_add_member: only a workspace owner can change membership'
      using errcode = '42501';
  end if;

  insert into profiles (wallet_address, display_name)
  values (v_wallet, substr(v_wallet, 1, 6) || '...' || right(v_wallet, 4))
  on conflict (wallet_address) do update set updated_at = clock_timestamp()
  returning id into v_profile_id;

  select m.organization_id into v_existing_org
  from organization_members m
  where m.profile_id = v_profile_id and m.organization_id <> p_org
  limit 1;

  if v_existing_org is not null then
    raise exception 'workspace_add_member: wallet already belongs to another workspace'
      using errcode = '23505';
  end if;

  insert into organization_members (organization_id, profile_id, role)
  values (p_org, v_profile_id, v_role::org_role)
  on conflict (organization_id, profile_id) do update set role = excluded.role
  returning * into v_member;

  return jsonb_build_object('member', to_jsonb(v_member), 'wallet_address', v_wallet);
end;
$$;

create or replace function public.workspace_remove_member(
  p_org uuid,
  p_actor text,
  p_wallet text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := lower(trim(coalesce(p_actor, '')));
  v_wallet text := lower(trim(coalesce(p_wallet, '')));
  v_profile_id uuid;
  v_member organization_members%rowtype;
  v_owner_count int;
begin
  perform 1 from organizations where id = p_org for update;
  if not found then
    raise exception 'workspace_remove_member: workspace does not exist' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from organization_members m
    join profiles p on p.id = m.profile_id
    where m.organization_id = p_org
      and lower(p.wallet_address) = v_actor
      and m.role = 'owner'
  ) then
    raise exception 'workspace_remove_member: only a workspace owner can change membership'
      using errcode = '42501';
  end if;

  select id into v_profile_id from profiles where lower(wallet_address) = v_wallet;
  if v_profile_id is null then
    return null;
  end if;

  select * into v_member
  from organization_members
  where organization_id = p_org and profile_id = v_profile_id;

  if not found then
    -- Nothing to remove; saying so is not an error.
    return null;
  end if;

  if v_member.role = 'owner' then
    select count(*) into v_owner_count
    from organization_members
    where organization_id = p_org and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'workspace_remove_member: a workspace must keep at least one owner'
        using errcode = '23514';
    end if;
  end if;

  delete from organization_members where id = v_member.id;

  return jsonb_build_object('member', to_jsonb(v_member), 'wallet_address', v_wallet);
end;
$$;

-- Rename a workspace. Authorisation and the write happen in one transaction so
-- an owner revoked mid-request cannot land the rename anyway.
create or replace function public.workspace_rename(p_org uuid, p_actor text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor text := lower(trim(coalesce(p_actor, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_org organizations%rowtype;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'workspace_rename: workspace name must be 2 to 120 characters'
      using errcode = '22023';
  end if;

  select * into v_org from organizations where id = p_org for update;
  if not found then
    raise exception 'workspace_rename: workspace does not exist' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from organization_members m
    join profiles p on p.id = m.profile_id
    where m.organization_id = p_org
      and lower(p.wallet_address) = v_actor
      and m.role = 'owner'
  ) then
    raise exception 'workspace_rename: only a workspace owner can rename this workspace'
      using errcode = '42501';
  end if;

  -- The slug is deliberately left alone: it is how existing links and stored
  -- references find this workspace, and a rename should not break them.
  update organizations
  set name = v_name, updated_at = clock_timestamp()
  where id = p_org
  returning * into v_org;

  return to_jsonb(v_org);
end;
$$;

revoke all on function public.workspace_rename(uuid, text, text) from public, anon, authenticated;
grant execute on function public.workspace_rename(uuid, text, text) to service_role;
