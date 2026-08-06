-- Workspace provisioning and team membership.
--
-- Until now an organisation could only be created by hand, and membership rows
-- were decoration: everything a signed-in wallet could see was scoped to the
-- wallets it owned on chain. A brand new visitor therefore had no way in, and a
-- teammate added to a workspace saw nothing.
--
-- These functions are the write half of that fix. They live in the database
-- rather than in the API because Supabase REST has no transactions: creating a
-- workspace touches three tables, and a half-created workspace -- an
-- organisation with no owner, or an owner with no profile -- would be
-- unrecoverable through the UI. Each function locks the row it is about to
-- change so two concurrent callers cannot both win.
--
-- One wallet belongs to at most one workspace. The read model resolves a
-- caller's workspace from their membership, so a second membership would make
-- "your workspace" ambiguous; the rule is enforced here where it cannot be
-- bypassed rather than in the API where it could be.

-- Create a workspace and make the calling wallet its owner.
create or replace function public.workspace_create(p_wallet text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet text := lower(trim(coalesce(p_wallet, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_profile_id uuid;
  v_org organizations%rowtype;
  v_base text;
  v_slug text;
  v_attempt int := 0;
begin
  if v_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'workspace_create: wallet address is not a valid address'
      using errcode = '22023';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'workspace_create: workspace name must be 2 to 120 characters'
      using errcode = '22023';
  end if;

  insert into profiles (wallet_address, display_name)
  values (v_wallet, substr(v_wallet, 1, 6) || '...' || right(v_wallet, 4))
  on conflict (wallet_address) do update set updated_at = clock_timestamp()
  returning id into v_profile_id;

  -- Locking the profile serialises two simultaneous first-time creates by the
  -- same wallet: the second one waits, then sees the membership below.
  perform 1 from profiles where id = v_profile_id for update;

  if exists (select 1 from organization_members where profile_id = v_profile_id) then
    raise exception 'workspace_create: wallet already belongs to a workspace'
      using errcode = '23505';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'workspace';
  end if;
  v_base := left(v_base, 40);
  v_slug := v_base;

  while exists (select 1 from organizations where slug = v_slug) loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'workspace_create: could not derive a free slug for %', v_name
        using errcode = '23505';
    end if;
    v_slug := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;

  insert into organizations (name, slug, created_by)
  values (v_name, v_slug, v_profile_id)
  returning * into v_org;

  insert into organization_members (organization_id, profile_id, role)
  values (v_org.id, v_profile_id, 'owner');

  return to_jsonb(v_org);
end;
$$;

-- Add a wallet to a workspace, or change the role of someone already in it.
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

  -- Serialise membership writes for this workspace so the owner count below
  -- cannot be read while another call is changing it.
  perform 1 from organizations where id = p_org for update;

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

-- Remove a wallet from a workspace. The last owner cannot be removed: a
-- workspace with no owner could never be administered again.
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

  perform 1 from organizations where id = p_org for update;

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

revoke all on function public.workspace_create(text, text) from public, anon, authenticated;
revoke all on function public.workspace_add_member(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.workspace_remove_member(uuid, text, text) from public, anon, authenticated;

grant execute on function public.workspace_create(text, text) to service_role;
grant execute on function public.workspace_add_member(uuid, text, text, text) to service_role;
grant execute on function public.workspace_remove_member(uuid, text, text) to service_role;
