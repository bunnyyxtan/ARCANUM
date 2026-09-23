-- Run ONLY on the parent's disposable restored PG17 schema, after migration.
\set ON_ERROR_STOP on
begin;
savepoint fixtures;
do $test$
declare
  org uuid := gen_random_uuid();
  other_org uuid := gen_random_uuid();
  wallet uuid := gen_random_uuid();
  payload jsonb;
  original jsonb;
  replay jsonb;
  change jsonb;
begin
  if current_database() <> 'optimization_sql' or session_user <> 'arcanum_drill' then
    raise exception 'disposable test database required';
  end if;
  insert into public.organizations(id, name, slug) values(org, 'SQL test', org::text);
  insert into public.organizations(id, name, slug) values(other_org, 'SQL test', other_org::text);
  insert into public.governed_wallets(id, organization_id, wallet_address, chain_id)
    values(wallet, org, '0x' || replace(wallet::text, '-', ''), 5042002);
  payload := jsonb_build_object(
    'organization_id', org, 'governed_wallet_id', wallet,
    'tx_hash', 'atomic-test-' || org, 'chain_id', 5042002, 'log_index', 7,
    'event_time', '2025-01-01T00:00:00Z', 'amount_usdc', '1234567890123456789.123456',
    'status', 'allowed', 'decision_reason', 'allowed', 'block_number', '9007199254740993',
    'counterparty_address', '0xabc', 'policy_snapshot',
    '{"policyVersion":"1","councilVersion":"2","escalationId":"3","deploymentId":"this"}'::jsonb,
    'data_source', 'live'
  );
  select * into strict original from public.insert_ledger_event(payload);
  if jsonb_typeof(original -> 'amount_usdc') <> 'string'
    or original ->> 'amount_usdc' <> '1234567890123456789.123456'
    or jsonb_typeof(original -> 'block_number') <> 'string'
    or original ->> 'block_number' <> '9007199254740993'
    or jsonb_typeof(original -> 'chain_id') <> 'number'
    or jsonb_typeof(original -> 'log_index') <> 'number'
    or jsonb_typeof(original -> 'id') <> 'string' then
    raise exception 'RPC transport lost exact financial/event identity values';
  end if;
  select * into strict replay from public.insert_ledger_event(payload ||
    '{"amount_usdc":"1234567890123456789.1234560","event_time":"2025-01-01T01:00:00+01:00","agent_label":"renamed"}');
  if original is distinct from replay then raise exception 'replay changed existing row'; end if;
  for change in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('governed_wallet_id', null),
    '{"event_time":"2025-01-02T00:00:00Z"}'::jsonb,
    '{"counterparty_address":"0xdef"}'::jsonb,
    '{"amount_usdc":"1234567890123456789.123457"}'::jsonb,
    '{"status":"blocked"}'::jsonb,
    '{"decision_reason":"different"}'::jsonb,
    '{"block_number":21}'::jsonb,
    '{"policy_snapshot":{"deploymentId":"foreign"}}'::jsonb,
    '{"policy_snapshot":{"escalationId":"other"}}'::jsonb,
    '{"policy_snapshot":{"policyVersion":"other"}}'::jsonb,
    '{"policy_snapshot":{"councilVersion":"other"}}'::jsonb,
    '{"data_source":"demo"}'::jsonb
  )) loop
    begin
      perform public.insert_ledger_event(payload || change);
      raise exception 'conflict accepted: %', change;
    exception
      when check_violation or not_null_violation then null;
    end;
  end loop;
  select * into strict replay from public.insert_ledger_event(payload ||
    jsonb_build_object('organization_id', other_org, 'policy_snapshot',
      '{"enriched":"metadata"}'::jsonb, 'agent_label', 'renamed'));
  if original is distinct from replay then raise exception 'mirror replay changed row'; end if;
  -- The three identity columns identify distinct events, not conflicting payloads.
  perform public.insert_ledger_event(payload || '{"log_index":8}');
  perform public.insert_ledger_event(payload || '{"chain_id":5042003}');
  perform public.insert_ledger_event(payload || '{"tx_hash":"another-test-hash"}');
  if (select count(*) from public.ledger_events where organization_id = org) <> 4 then
    raise exception 'identity key incorrectly conflated events';
  end if;
  if has_function_privilege('anon', 'public.insert_ledger_event(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.insert_ledger_event(jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.insert_ledger_event(jsonb)', 'EXECUTE')
    or exists (
      select 1 from pg_proc p, lateral aclexplode(p.proacl) a
       where p.oid = 'public.insert_ledger_event(jsonb)'::regprocedure
         and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then raise exception 'RPC execute privilege leakage'; end if;
  if not exists (
    select 1 from pg_proc where oid = 'public.insert_ledger_event(jsonb)'::regprocedure
      and prosecdef and proconfig = array['search_path=pg_catalog']
  ) then raise exception 'unsafe function configuration'; end if;
end;
$test$;
rollback to fixtures;

savepoint legacy_unique;
create unique index atomic_test_legacy_tx on public.ledger_events(tx_hash);
do $test$
declare
  org uuid := gen_random_uuid();
  payload jsonb;
  original_id uuid;
  replay_id uuid;
begin
  insert into public.organizations(id, name, slug) values(org, 'Legacy test', org::text);
  payload := jsonb_build_object(
    'organization_id', org, 'tx_hash', org::text, 'chain_id', 5042002,
    'log_index', 1, 'event_time', '2025-01-01T00:00:00Z', 'status', 'allowed',
    'policy_snapshot', '{}'::jsonb, 'data_source', 'live'
  );
  select event ->> 'id' into strict original_id
    from public.insert_ledger_event(payload) as result(event);
  select event ->> 'id' into strict replay_id
    from public.insert_ledger_event(payload) as result(event);
  if exists (
    select 1 from public.insert_ledger_event(payload) as result(event)
    where event -> 'amount_usdc' <> 'null'::jsonb
      or event -> 'block_number' <> 'null'::jsonb
  ) then raise exception 'nullable amount/block transport changed nulls'; end if;
  if original_id <> replay_id then raise exception 'legacy replay changed ID'; end if;
  begin
    perform public.insert_ledger_event(payload || '{"log_index":2}');
    raise exception 'tx-only constraint silently swallowed second log';
  exception when unique_violation then null;
  end;
end;
$test$;
rollback to legacy_unique;

-- Capability exists but schema is unsafe: these errors MUST NOT become success.
savepoint missing_index;
drop index public.ledger_events_chain_tx_log_unique;
do $test$
begin
  begin
    perform public.insert_ledger_event('{"chain_id":1,"tx_hash":"x","log_index":0}');
    raise exception 'missing index accepted';
  exception when invalid_column_reference then null;
  end;
end;
$test$;
rollback to missing_index;

savepoint missing_column;
alter table public.ledger_events drop column log_index cascade;
do $test$
begin
  begin
    perform public.insert_ledger_event('{"chain_id":1,"tx_hash":"x","log_index":0}');
    raise exception 'missing log_index accepted';
  exception when undefined_column then null;
  end;
end;
$test$;
rollback to missing_column;
rollback;
