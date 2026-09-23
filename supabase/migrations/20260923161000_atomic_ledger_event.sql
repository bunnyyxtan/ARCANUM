-- No upsert updates: immutable event rows and their downstream IDs survive replay.
-- A separate SELECT statement is essential: a DO NOTHING CTE's original
-- snapshot can miss a concurrent winner after waiting on its unique-index lock.
begin;

create or replace function public.insert_ledger_event(p_event jsonb)
returns setof jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  candidate public.ledger_events;
  found_event public.ledger_events;
begin
  candidate := pg_catalog.jsonb_populate_record(null::public.ledger_events, p_event);
  if candidate.chain_id is null or candidate.tx_hash is null
     or candidate.log_index is null then
    raise exception 'ledger event identity is required' using errcode = '23514';
  end if;

  loop
    insert into public.ledger_events (
      organization_id, governed_wallet_id, tx_hash, log_index, event_time,
      agent_label, category, counterparty_address, amount_usdc, status,
      decision_reason, block_number, chain_id, policy_snapshot, data_source
    ) values (
      candidate.organization_id, candidate.governed_wallet_id, candidate.tx_hash,
      candidate.log_index, candidate.event_time, candidate.agent_label,
      candidate.category, candidate.counterparty_address, candidate.amount_usdc,
      candidate.status, candidate.decision_reason, candidate.block_number,
      candidate.chain_id, candidate.policy_snapshot, candidate.data_source
    )
    on conflict (chain_id, tx_hash, log_index) do nothing
    returning * into found_event;

    if not found then
      select * into found_event from public.ledger_events
       where chain_id = candidate.chain_id and tx_hash = candidate.tx_hash
         and log_index = candidate.log_index
       for share;
      -- At READ COMMITTED this statement sees a winner committed during INSERT.
      -- If a privileged concurrent delete removed it, retry the insertion.
      if not found then continue; end if;
    end if;

    if row(
      found_event.governed_wallet_id,
      found_event.tx_hash, found_event.log_index, found_event.event_time,
      found_event.counterparty_address, found_event.amount_usdc, found_event.status,
      found_event.decision_reason, found_event.block_number, found_event.chain_id,
      found_event.data_source
    ) is distinct from row(
      candidate.governed_wallet_id,
      candidate.tx_hash, candidate.log_index, candidate.event_time,
      candidate.counterparty_address, candidate.amount_usdc, candidate.status,
      candidate.decision_reason, candidate.block_number, candidate.chain_id,
      candidate.data_source
    ) or exists (
      -- Labels, organization attribution and snapshot enrichment can evolve.
      -- Compare known claims only when both old and incoming snapshots carry
      -- them; legacy absence must not become a new identity requirement.
      select 1
      from pg_catalog.unnest(array[
        'escalationId', 'policyVersion', 'councilVersion', 'deploymentId'
      ]) as claim(key)
      where found_event.policy_snapshot -> claim.key is not null
        and found_event.policy_snapshot -> claim.key <> 'null'::jsonb
        and candidate.policy_snapshot -> claim.key is not null
        and candidate.policy_snapshot -> claim.key <> 'null'::jsonb
        and (found_event.policy_snapshot -> claim.key)
          is distinct from (candidate.policy_snapshot -> claim.key)
    ) then
      raise exception 'conflicting immutable ledger event' using errcode = '23514';
    end if;
    -- PostgREST serializes native numeric/bigint columns as JSON numbers.
    -- Preserve their exact values across JavaScript's JSON.parse boundary.
    -- int4 chain_id/log_index are always safe JSON integers; UUIDs are strings.
    return next pg_catalog.to_jsonb(found_event) || pg_catalog.jsonb_build_object(
      'amount_usdc', found_event.amount_usdc::text,
      'block_number', found_event.block_number::text
    );
    return;
  end loop;
end;
$$;

revoke all on function public.insert_ledger_event(jsonb) from public, anon, authenticated;
grant execute on function public.insert_ledger_event(jsonb) to service_role;
commit;
