\set ON_ERROR_STOP on
DO $$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.scoped_ledger_analytics(uuid[],text,uuid,text,timestamp with time zone,timestamp with time zone,boolean)',
    'public.scoped_anomaly_counts(uuid[],text,uuid,text)',
    'public.scoped_current_doctrines(uuid[],text,uuid,text)',
    'public.insert_ledger_event(jsonb)'
  ] LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE')
       OR has_function_privilege('authenticated', signature, 'EXECUTE')
       OR NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'unsafe function execute grants: %', signature;
    END IF;
  END LOOP;
END
$$;