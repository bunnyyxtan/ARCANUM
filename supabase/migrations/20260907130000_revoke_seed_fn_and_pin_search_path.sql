-- rls_auto_enable keeps its existing search_path = pg_catalog; it is an event trigger and
-- resolves nothing from public.
REVOKE ALL ON FUNCTION public.seed_arcanum_demo(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.arcanum_global_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_member(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.seed_arcanum_demo(text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.vendor_flag_apply(uuid, uuid, text, text, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.workspace_add_member(uuid, text, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.workspace_create(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.workspace_remove_member(uuid, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.workspace_rename(uuid, text, text) SET search_path = public, pg_temp;