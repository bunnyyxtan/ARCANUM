ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'operator';

ALTER TABLE public.anomalies
  ADD COLUMN IF NOT EXISTS decided_by text,
  ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS decision_reason text;