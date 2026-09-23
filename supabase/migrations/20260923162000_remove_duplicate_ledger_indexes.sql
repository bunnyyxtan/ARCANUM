-- Keep one copy of each existing non-unique ledger index. Do not substitute
-- a differently ordered, partial, invalid, or constraint-backed index.
-- The short lock timeout makes a busy database fail rather than block writers.
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $$
declare
  candidate record;
  remove_oid oid;
  keep_oid oid;
  equivalent boolean;
begin
  for candidate in
    select * from (values
      ('ledger_events_org_idx', 'idx_le_org'),
      ('ledger_events_status_idx', 'idx_le_status'),
      ('ledger_events_time_idx', 'idx_le_event_time'),
      ('ledger_events_tx_hash_idx', 'idx_le_tx_hash'),
      ('ledger_events_wallet_idx', 'idx_le_wallet')
    ) as names(remove_name, keep_name)
  loop
    remove_oid := to_regclass(format('public.%I', candidate.remove_name));
    if remove_oid is null then
      continue;
    end if;
    keep_oid := to_regclass(format('public.%I', candidate.keep_name));
    if keep_oid is null then
      raise exception 'Refusing to remove % without its retained index %',
        candidate.remove_name, candidate.keep_name;
    end if;

    select
      r.indrelid = 'public.ledger_events'::regclass
      and r.indrelid = k.indrelid
      and rc.relam = kc.relam
      and r.indkey = k.indkey
      and r.indclass = k.indclass
      and r.indcollation = k.indcollation
      and r.indoption = k.indoption
      and r.indnatts = k.indnatts
      and r.indnkeyatts = k.indnkeyatts
      and r.indnullsnotdistinct = k.indnullsnotdistinct
      and r.indexprs::text is not distinct from k.indexprs::text
      and r.indpred::text is not distinct from k.indpred::text
      and not r.indisunique and not k.indisunique
      and not r.indisexclusion and not k.indisexclusion
      and not r.indisprimary and not k.indisprimary
      and not r.indisreplident and not r.indisclustered
      and r.indisvalid and r.indisready
      and k.indisvalid and k.indisready and k.indislive
      and not exists (
        select 1 from pg_constraint c where c.conindid = remove_oid
      )
      and not exists (
        select 1 from pg_depend d
        where d.refclassid = 'pg_class'::regclass and d.refobjid = remove_oid
      )
    into equivalent
    from pg_index r
    join pg_class rc on rc.oid = r.indexrelid
    cross join pg_index k
    join pg_class kc on kc.oid = k.indexrelid
    where r.indexrelid = remove_oid and k.indexrelid = keep_oid;

    if equivalent is distinct from true then
      raise exception 'Refusing to remove %: retained index % is not a safe equivalent',
        candidate.remove_name, candidate.keep_name;
    end if;
    execute format('drop index public.%I', candidate.remove_name);
  end loop;
end
$$;