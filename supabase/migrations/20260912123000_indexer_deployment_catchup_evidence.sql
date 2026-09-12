-- A checkpoint row is event progress and cannot represent a quiet deployment:
-- the baseline requires last_block NOT NULL and there may be no event row at
-- all. Keep the durable /ready proof in a deployment-scoped record instead.
alter table public.indexer_checkpoints
  add column if not exists deployment_id text,
  add column if not exists deployment_start_block bigint,
  add column if not exists deployment_network text,
  add column if not exists deployment_usdc_address text,
  add column if not exists deployment_policy_engine_address text,
  add column if not exists deployment_escalation_manager_address text,
  add column if not exists deployment_anomaly_oracle_address text,
  add column if not exists deployment_vendor_registry_address text,
  add column if not exists deployment_wallet_factory_address text;

alter table public.unlinked_ledger_events
  add column if not exists deployment_id text;

-- The baseline keyed checkpoints only by chain and contract address. Keep one
-- legacy row for that address, while allowing a replacement deployment to
-- retain its own deployment-bound row with the same factory address.
alter table public.indexer_checkpoints
  drop constraint if exists indexer_checkpoints_chain_id_contract_address_key;

create unique index if not exists indexer_checkpoints_legacy_chain_contract_address_key
  on public.indexer_checkpoints (chain_id, contract_address)
  where deployment_id is null;

create unique index if not exists indexer_checkpoints_deployment_chain_contract_address_key
  on public.indexer_checkpoints (deployment_id, chain_id, contract_address)
  where deployment_id is not null;

create table if not exists public.indexer_catchup_evidence (
  deployment_id text primary key,
  chain_id integer not null,
  deployment_network text not null,
  deployment_start_block bigint not null,
  deployment_usdc_address text not null,
  deployment_policy_engine_address text not null,
  deployment_escalation_manager_address text not null,
  deployment_anomaly_oracle_address text not null,
  deployment_vendor_registry_address text not null,
  deployment_wallet_factory_address text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'error')),
  last_seen_at timestamptz,
  last_seen_block bigint,
  error_note text,
  updated_at timestamptz not null default now()
);

alter table public.indexer_catchup_evidence enable row level security;
revoke all on public.indexer_catchup_evidence from public, anon, authenticated, service_role;
grant select on public.indexer_catchup_evidence to service_role;

comment on table public.indexer_catchup_evidence is
  'Durable Ponder /ready evidence, scoped to the exact deployment manifest; not event progress.';

create or replace function public.finalize_indexer_catchup(
  p_deployment_id text,
  p_chain_id integer,
  p_deployment_network text,
  p_deployment_start_block bigint,
  p_deployment_usdc_address text,
  p_deployment_policy_engine_address text,
  p_deployment_escalation_manager_address text,
  p_deployment_anomaly_oracle_address text,
  p_deployment_vendor_registry_address text,
  p_deployment_wallet_factory_address text,
  p_last_seen_block bigint default null
)
returns table (
  deployment_id text,
  status text,
  last_seen_at timestamptz,
  last_seen_block bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  checkpoint_count integer;
  pending_queue_count integer;
  checkpoint_status text;
  checkpoint_error text;
  checkpoint_start_block bigint;
  checkpoint_network text;
  checkpoint_usdc text;
  checkpoint_policy_engine text;
  checkpoint_escalation_manager text;
  checkpoint_anomaly_oracle text;
  checkpoint_vendor_registry text;
  checkpoint_wallet_factory text;
  evidence public.indexer_catchup_evidence%rowtype;
  current_contract_name text :=
    'arcanum-indexer:' || p_deployment_network || ':' || p_chain_id::text;
begin
  if nullif(trim(p_deployment_id), '') is null then
    raise exception 'deployment identity is required';
  end if;

  -- The top-up stops Ponder before calling this function. The advisory lock
  -- also serializes two manually-dispatched finalizers for this deployment.
  perform pg_advisory_xact_lock(hashtext(p_deployment_id));
  -- Keep the checkpoint and deferred-write snapshots stable while the proof is
  -- evaluated. ROW EXCLUSIVE writes from a still-running handler wait here;
  -- after the top-up has stopped Ponder, this also closes the check/finalize
  -- race for concurrent manual invocations.
  lock table public.indexer_checkpoints in share mode;
  lock table public.unlinked_ledger_events in share mode;

  insert into public.indexer_catchup_evidence as ie (
    deployment_id,
    chain_id,
    deployment_network,
    deployment_start_block,
    deployment_usdc_address,
    deployment_policy_engine_address,
    deployment_escalation_manager_address,
    deployment_anomaly_oracle_address,
    deployment_vendor_registry_address,
    deployment_wallet_factory_address
  )
  values (
    p_deployment_id,
    p_chain_id,
    p_deployment_network,
    p_deployment_start_block,
    lower(p_deployment_usdc_address),
    lower(p_deployment_policy_engine_address),
    lower(p_deployment_escalation_manager_address),
    lower(p_deployment_anomaly_oracle_address),
    lower(p_deployment_vendor_registry_address),
    lower(p_deployment_wallet_factory_address)
  )
  on conflict on constraint indexer_catchup_evidence_pkey do nothing;

  select e.*
    into evidence
    from public.indexer_catchup_evidence as e
   where e.deployment_id = p_deployment_id
   for update;

  if evidence.chain_id <> p_chain_id
     or evidence.deployment_network <> p_deployment_network
     or evidence.deployment_start_block <> p_deployment_start_block
     or evidence.deployment_usdc_address <> lower(p_deployment_usdc_address)
     or evidence.deployment_policy_engine_address <> lower(p_deployment_policy_engine_address)
     or evidence.deployment_escalation_manager_address <> lower(p_deployment_escalation_manager_address)
     or evidence.deployment_anomaly_oracle_address <> lower(p_deployment_anomaly_oracle_address)
     or evidence.deployment_vendor_registry_address <> lower(p_deployment_vendor_registry_address)
     or evidence.deployment_wallet_factory_address <> lower(p_deployment_wallet_factory_address) then
    raise exception 'deployment manifest identity changed for %', p_deployment_id;
  end if;

  -- A checkpoint is optional only for a genuinely quiet deployment. If one
  -- exists, there must be exactly one current row and it must be clean. The
  -- exact deployment id prevents an old high watermark from being reused.
  select count(*)
    into checkpoint_count
    from public.indexer_checkpoints as c
   where c.chain_id = p_chain_id
     and c.deployment_id = p_deployment_id
     and c.contract_name = current_contract_name;

  if checkpoint_count > 1 then
    raise exception 'multiple checkpoint rows exist for deployment %', p_deployment_id;
  end if;

  if checkpoint_count = 1 then
    select
      c.status::text,
      c.error_note,
      c.deployment_start_block,
      c.deployment_network,
      c.deployment_usdc_address,
      c.deployment_policy_engine_address,
      c.deployment_escalation_manager_address,
      c.deployment_anomaly_oracle_address,
      c.deployment_vendor_registry_address,
      c.deployment_wallet_factory_address
      into
        checkpoint_status,
        checkpoint_error,
        checkpoint_start_block,
        checkpoint_network,
        checkpoint_usdc,
        checkpoint_policy_engine,
        checkpoint_escalation_manager,
        checkpoint_anomaly_oracle,
        checkpoint_vendor_registry,
        checkpoint_wallet_factory
      from public.indexer_checkpoints as c
     where c.chain_id = p_chain_id
       and c.deployment_id = p_deployment_id
       and c.contract_name = current_contract_name
     for update;

    if checkpoint_status <> 'synced'
       or nullif(trim(coalesce(checkpoint_error, '')), '') is not null then
      raise exception 'current checkpoint is not clean for deployment %', p_deployment_id;
    end if;
    if checkpoint_start_block is distinct from p_deployment_start_block
       or checkpoint_network is distinct from p_deployment_network
       or checkpoint_usdc is distinct from lower(p_deployment_usdc_address)
       or checkpoint_policy_engine is distinct from lower(p_deployment_policy_engine_address)
       or checkpoint_escalation_manager is distinct from lower(p_deployment_escalation_manager_address)
       or checkpoint_anomaly_oracle is distinct from lower(p_deployment_anomaly_oracle_address)
       or checkpoint_vendor_registry is distinct from lower(p_deployment_vendor_registry_address)
       or checkpoint_wallet_factory is distinct from lower(p_deployment_wallet_factory_address) then
      raise exception 'current checkpoint manifest identity changed for %', p_deployment_id;
    end if;
  end if;

  -- A staged event is an acknowledged durable write, but the read model is
  -- not complete until it has been reconciled. Legacy rows without an identity
  -- are conservatively treated as pending for this chain.
  select count(*)
    into pending_queue_count
    from public.unlinked_ledger_events as q
   where q.chain_id = p_chain_id
     and (q.deployment_id is null or q.deployment_id = p_deployment_id);

  if pending_queue_count > 0 then
    raise exception 'deferred mirror queue is not empty for deployment %', p_deployment_id;
  end if;

  update public.indexer_catchup_evidence as e
     set status = 'ready',
         last_seen_at = now(),
         last_seen_block = p_last_seen_block,
         error_note = null,
         updated_at = now()
    where e.deployment_id = p_deployment_id;

  return query
    select e.deployment_id, e.status, e.last_seen_at, e.last_seen_block
      from public.indexer_catchup_evidence e
     where e.deployment_id = p_deployment_id;
end;
$function$;

revoke all on function public.finalize_indexer_catchup(
  text, integer, text, bigint, text, text, text, text, text, text, bigint
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_indexer_catchup(
  text, integer, text, bigint, text, text, text, text, text, text, bigint
) to service_role;