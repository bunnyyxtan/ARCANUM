-- One mined transaction can be affirmative execution evidence for one receipt
-- only. Arcanum deploys one chain per receipt database, so the normalized
-- transaction hash is the complete chain-scoped identity here.
--
-- Do not silently choose a winner if historical duplicates already exist:
-- operators must review and resolve them before this migration can activate.
do $$
declare
  duplicate_hash text;
begin
  select lower(tx_hash)
    into duplicate_hash
    from public.payment_receipt_evidence
   where kind = 'execution' and tx_hash is not null
   group by lower(tx_hash)
  having count(*) > 1
   order by lower(tx_hash)
   limit 1;

  if duplicate_hash is not null then
    raise exception
      'Cannot enforce unique receipt execution transactions: hash % has multiple execution evidence rows',
      duplicate_hash
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists payment_receipt_evidence_execution_tx_unique_idx
  on public.payment_receipt_evidence ((lower(tx_hash)))
  where kind = 'execution' and tx_hash is not null;