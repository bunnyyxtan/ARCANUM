ALTER TYPE public.escalation_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.escalation_status ADD VALUE IF NOT EXISTS 'invalidated';
ALTER TYPE public.escalation_status ADD VALUE IF NOT EXISTS 'rejected';