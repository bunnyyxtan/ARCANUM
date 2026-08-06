-- Vendor review register.
--
-- The application keeps vendor review state -- a flag per vendor, an optional
-- note, and an append-only trail of every flag, note edit and unflag. Only part
-- of that shape was ever created here: `vendor_flags` exists with a minimal set
-- of columns and `vendor_flag_events` was missing entirely, so every call to
-- the review register failed against this database and the flag controls on the
-- ledger reported an outage instead of working.
--
-- This migration brings the register up to the shape the application expects
-- and closes public access to it. Re-running it is safe.

begin;

-- 1. The columns the register needs. Ownership is tracked by organisation,
--    matching every other table the read model scopes by.
alter table public.vendor_flags
  add column if not exists organization_id uuid,
  add column if not exists note text,
  add column if not exists note_updated_by text,
  add column if not exists note_updated_at timestamptz,
  add column if not exists removed_by text,
  add column if not exists removed_at timestamptz;

-- One row per vendor per organisation: re-flagging updates that row rather than
-- accumulating duplicates the read side would have to de-duplicate.
create unique index if not exists vendor_flags_org_vendor_key
  on public.vendor_flags (organization_id, vendor_address);

-- 2. The audit trail. The flag row carries current state; these rows record how
--    it got there, so a flag -> unflag -> re-flag cycle keeps its history.
create table if not exists public.vendor_flag_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  tenant_id uuid,
  vendor_address varchar(64) not null,
  event_type text not null check (event_type in ('flagged', 'note_updated', 'unflagged')),
  actor text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_flag_events_lookup_idx
  on public.vendor_flag_events (organization_id, vendor_address, created_at desc);

-- 3. Lock the register down. The anonymous key ships inside the browser bundle,
--    so anything it can reach is public. The register had full table privileges
--    granted to anon and authenticated, leaving row level security as the only
--    thing standing between a public key and other tenants' review notes. The
--    API reaches these tables with the service role, which bypasses row level
--    security, so neither role needs any privilege at all.
alter table public.vendor_flags enable row level security;
alter table public.vendor_flag_events enable row level security;

revoke all on public.vendor_flags from anon, authenticated;
revoke all on public.vendor_flag_events from anon, authenticated;

commit;
