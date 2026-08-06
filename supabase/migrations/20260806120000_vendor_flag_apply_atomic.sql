-- The vendor review register must never hold a state change without its audit
-- event, and never record an event for a change that did not land. The REST
-- client the API uses has no transactions, so both writes move into a single
-- database function where Postgres can guarantee they succeed or fail together.
--
-- Re-runnable: create or replace, and the grants are idempotent.

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
set search_path = public
as $$
declare
  v_existing public.vendor_flags%rowtype;
  v_row public.vendor_flags%rowtype;
begin
  if p_action not in ('flag', 'note', 'unflag') then
    raise exception 'unknown vendor flag action: %', p_action;
  end if;

  -- Serialise reviewers working the same vendor: whoever arrives second waits
  -- here and then acts on the first writer's state instead of racing past it.
  select * into v_existing
    from public.vendor_flags
   where organization_id = p_org
     and vendor_address = p_vendor
   for update;

  if p_action = 'flag' then
    -- Re-flagging is a fresh flag: the new flagger owns the note, and the
    -- earlier edit and clearance stamps are superseded. The cycle that came
    -- before survives in the event trail.
    insert into public.vendor_flags (
      organization_id, tenant_id, vendor_address, flagged_by, note,
      note_updated_by, note_updated_at, removed_by, removed_at, created_at
    )
    values (p_org, p_tenant, p_vendor, p_actor, p_note, null, null, null, null, now())
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
    -- Nothing active to edit or clear. The caller decides whether that reads as
    -- not-found or as an idempotent success; either way no event is invented.
    return null;

  elsif p_action = 'note' then
    -- Only the note moves: who flagged the vendor, and when, stays intact.
    update public.vendor_flags
       set note = p_note,
           note_updated_by = p_actor,
           note_updated_at = now()
     where id = v_existing.id
    returning * into v_row;

  else
    update public.vendor_flags
       set removed_by = p_actor,
           removed_at = now()
     where id = v_existing.id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'vendor flag action % changed no row for %', p_action, p_vendor;
  end if;

  -- clock_timestamp(), not now(): now() is the transaction start, so two events
  -- written in one transaction would share a timestamp and the trail would lose
  -- its order.
  insert into public.vendor_flag_events (
    organization_id, tenant_id, vendor_address, event_type, actor, note, created_at
  )
  values (
    p_org,
    p_tenant,
    p_vendor,
    case p_action
      when 'flag' then 'flagged'
      when 'note' then 'note_updated'
      else 'unflagged'
    end,
    p_actor,
    case when p_action = 'unflag' then null else p_note end,
    clock_timestamp()
  );

  return to_jsonb(v_row);
end;
$$;

-- Only the API's service role may touch the register. Browser-facing roles keep
-- no execute right, exactly as they hold no table grants.
revoke all on function public.vendor_flag_apply(uuid, uuid, text, text, text, text) from public;
revoke all on function public.vendor_flag_apply(uuid, uuid, text, text, text, text) from anon;
revoke all on function public.vendor_flag_apply(uuid, uuid, text, text, text, text) from authenticated;
grant execute on function public.vendor_flag_apply(uuid, uuid, text, text, text, text) to service_role;
