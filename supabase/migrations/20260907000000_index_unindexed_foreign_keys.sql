CREATE INDEX IF NOT EXISTS escalations_ledger_event_id_idx
  ON public.escalations USING btree (ledger_event_id);

CREATE INDEX IF NOT EXISTS governance_events_governed_wallet_id_idx
  ON public.governance_events USING btree (governed_wallet_id);

CREATE INDEX IF NOT EXISTS vendors_approved_by_idx
  ON public.vendors USING btree (approved_by);

CREATE INDEX IF NOT EXISTS demo_seed_state_organization_id_idx
  ON public.demo_seed_state USING btree (organization_id);