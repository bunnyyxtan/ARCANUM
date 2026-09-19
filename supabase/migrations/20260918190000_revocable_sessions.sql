-- Deploy before the application. All existing untracked SIWE cookies are
-- intentionally rejected after rollout: every user must sign in again.
-- This is a shared session registry, NOT multi-tenant identity provisioning.
create table if not exists public.auth_sessions (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  wallet_address text not null check (wallet_address = lower(wallet_address)),
  tenant_id text not null,
  role text not null check (role in ('owner', 'council', 'signer', 'viewer')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '12 hours')
);
create index if not exists auth_sessions_wallet_tenant_idx
  on public.auth_sessions (tenant_id, wallet_address);
create index if not exists auth_sessions_expiry_idx on public.auth_sessions (expires_at);
alter table public.auth_sessions enable row level security;
revoke all on public.auth_sessions from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.auth_sessions to service_role;
comment on table public.auth_sessions is
  'Server-only revocable 12-hour SIWE sessions. SHA-256 identifiers only. Old cookies require sign-in again. Expired rows may be pruned by an operator.';

-- One small revocation watermark per identity serializes issuance/logout-all.
-- Keep watermarks when pruning sessions: removing one would reopen an in-flight
-- pre-revocation login. This is session metadata, not an identity directory.
create table if not exists public.auth_session_scopes (
  tenant_id text not null,
  wallet_address text not null check (wallet_address = lower(wallet_address)),
  revoked_before timestamptz not null default '-infinity',
  primary key (tenant_id, wallet_address)
);
alter table public.auth_session_scopes enable row level security;
revoke all on public.auth_session_scopes from public, anon, authenticated, service_role;
grant select, insert, update on public.auth_session_scopes to service_role;

create or replace function public.create_auth_session(
  p_session_hash text,
  p_wallet_address text,
  p_tenant_id text,
  p_role text,
  p_expires_at timestamptz
) returns setof public.auth_sessions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_revoked_before timestamptz;
begin
  insert into public.auth_session_scopes (tenant_id, wallet_address)
    values (p_tenant_id, p_wallet_address) on conflict do nothing;
  select revoked_before into v_revoked_before from public.auth_session_scopes
    where tenant_id = p_tenant_id and wallet_address = p_wallet_address for update;
  -- expiry is fixed to login-request start + 12h, not the time its async work
  -- finishes. A concurrent logout-all wins over all earlier login requests.
  if p_expires_at - interval '12 hours' <= v_revoked_before then
    raise exception 'Login preceded session revocation; sign in again' using errcode = '28000';
  end if;
  -- At most 100 expired rows per successful create. SKIP LOCKED prevents
  -- parallel issuance from blocking on another pruning transaction.
  with expired as (
    select session_hash from public.auth_sessions
    where expires_at <= clock_timestamp()
    order by expires_at limit 100 for update skip locked
  )
  delete from public.auth_sessions s using expired e where s.session_hash = e.session_hash;
  return query insert into public.auth_sessions (
    session_hash, wallet_address, tenant_id, role, expires_at
  ) values (
    p_session_hash, p_wallet_address, p_tenant_id, p_role, p_expires_at
  ) returning *;
end;
$$;

create or replace function public.revoke_all_auth_sessions(
  p_session_hash text,
  p_wallet_address text,
  p_tenant_id text
) returns setof public.auth_sessions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz;
begin
  -- Same lock order as create_auth_session. Recheck caller under the lock:
  -- application validation alone is not sufficient for concurrent requests.
  perform 1 from public.auth_session_scopes
    where tenant_id = p_tenant_id and wallet_address = p_wallet_address for update;
  if not found then return; end if;
  perform 1 from public.auth_sessions
    where session_hash = p_session_hash and tenant_id = p_tenant_id
      and wallet_address = p_wallet_address and revoked_at is null
      and expires_at > clock_timestamp() for update;
  if not found then return; end if;
  v_now := clock_timestamp();
  update public.auth_session_scopes set revoked_before = greatest(revoked_before, v_now)
    where tenant_id = p_tenant_id and wallet_address = p_wallet_address;
  return query update public.auth_sessions set revoked_at = v_now
    where tenant_id = p_tenant_id and wallet_address = p_wallet_address
    returning *;
end;
$$;

revoke all on function public.create_auth_session(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.revoke_all_auth_sessions(text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_auth_session(text, text, text, text, timestamptz)
  to service_role;
grant execute on function public.revoke_all_auth_sessions(text, text, text)
  to service_role;