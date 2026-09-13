-- Payment decision receipts.
--
-- A receipt is a signed statement of what the policy stack decided for one
-- signed payment intent at one pinned block. The API stores the envelope
-- exactly as issued and re-verifies it on the way out, so this table is an
-- append-only, immutable record: rows are never updated or deleted, and the
-- (chain, wallet, signer, reference) key makes a signed reference idempotent
-- across retries.
--
-- Evidence rows link a receipt to what later happened onchain (an execution,
-- an escalation and its outcome). They are append-only as well; a new
-- observation is a new row, never an edit.

create table if not exists public.payment_receipts (
  id uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  governed_wallet_id uuid not null references public.governed_wallets (id) on delete restrict,
  chain_id integer not null,
  wallet_address text not null check (wallet_address = lower(wallet_address)),
  agent_signer_address text not null check (agent_signer_address = lower(agent_signer_address)),
  vendor_address text not null check (vendor_address = lower(vendor_address)),
  token_address text not null check (token_address = lower(token_address)),
  amount_base_units numeric(78, 0) not null check (amount_base_units >= 0),
  reference text not null check (length(reference) between 1 and 128),
  request_digest text not null check (request_digest ~ '^0x[0-9a-f]{64}$'),
  verdict text not null check (verdict in ('allow', 'escalate', 'deny', 'freeze')),
  reason_code text not null,
  block_number bigint not null check (block_number >= 0),
  block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  policy_version bigint not null check (policy_version >= 0),
  evaluated_at timestamptz not null,
  issuer_key_id text not null,
  receipt_digest text not null check (receipt_digest ~ '^0x[0-9a-f]{64}$'),
  signature text not null check (signature ~ '^0x[0-9a-f]+$'),
  envelope jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.payment_receipts is
  'Signed payment decision receipts, stored exactly as issued. Immutable and append-only.';

-- One receipt per signed reference. The same signed intent replays the stored
-- receipt; a different intent under the same reference is rejected.
create unique index if not exists payment_receipts_request_key_idx
  on public.payment_receipts (chain_id, wallet_address, agent_signer_address, reference);

create unique index if not exists payment_receipts_receipt_digest_idx
  on public.payment_receipts (receipt_digest);

-- Keyset listing per wallet and per signer, newest first.
create index if not exists payment_receipts_wallet_created_idx
  on public.payment_receipts (governed_wallet_id, created_at desc, id desc);

create index if not exists payment_receipts_signer_created_idx
  on public.payment_receipts (chain_id, agent_signer_address, created_at desc, id desc);

create table if not exists public.payment_receipt_evidence (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.payment_receipts (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  governed_wallet_id uuid not null references public.governed_wallets (id) on delete restrict,
  kind text not null check (kind in ('execution', 'escalation')),
  outcome text not null check (
    outcome in (
      'executed', 'escalated', 'frozen', 'reverted', 'pending', 'released',
      'rejected', 'expired', 'denied', 'cancelled', 'invalidated'
    )
  ),
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer check (log_index is null or log_index >= 0),
  block_number bigint check (block_number is null or block_number >= 0),
  escalation_key text check (escalation_key is null or escalation_key ~ '^0x[0-9a-f]{64}$'),
  calldata_names_receipt boolean,
  details jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

comment on table public.payment_receipt_evidence is
  'Onchain observations linked to a payment receipt (executions, escalations, outcomes). Append-only.';

-- The same observation is recorded once. Evidence without a transaction hash
-- (an escalation outcome read from the manager, for example) is keyed on the
-- empty string so it also stays unique per receipt.
create unique index if not exists payment_receipt_evidence_observation_idx
  on public.payment_receipt_evidence (receipt_id, kind, outcome, coalesce(tx_hash, ''));

create index if not exists payment_receipt_evidence_receipt_idx
  on public.payment_receipt_evidence (receipt_id, observed_at, id);

create index if not exists payment_receipt_evidence_tx_idx
  on public.payment_receipt_evidence (tx_hash)
  where tx_hash is not null;

-- Immutability. A receipt that could be edited after issuance would be worth
-- nothing, so updates and deletes are refused at the database, not merely
-- avoided by the API.
create or replace function public.payment_receipts_reject_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception '% rows are immutable (% refused)', tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

revoke all on function public.payment_receipts_reject_mutation() from public, anon, authenticated;

drop trigger if exists payment_receipts_immutable on public.payment_receipts;
create trigger payment_receipts_immutable
  before update or delete on public.payment_receipts
  for each row execute function public.payment_receipts_reject_mutation();

drop trigger if exists payment_receipt_evidence_immutable on public.payment_receipt_evidence;
create trigger payment_receipt_evidence_immutable
  before update or delete on public.payment_receipt_evidence
  for each row execute function public.payment_receipts_reject_mutation();

-- Access. The anonymous key ships in the browser bundle, so nothing it can
-- reach is private; the API reads and writes receipts with the service role,
-- which bypasses row level security, and enforces workspace membership,
-- signer identity and council membership itself. Neither browser role needs
-- any privilege here.
alter table public.payment_receipts enable row level security;
alter table public.payment_receipt_evidence enable row level security;

revoke all on public.payment_receipts from anon, authenticated;
revoke all on public.payment_receipt_evidence from anon, authenticated;

grant select, insert on public.payment_receipts to service_role;
grant select, insert on public.payment_receipt_evidence to service_role;
