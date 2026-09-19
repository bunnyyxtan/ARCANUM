-- Service-only abuse counters. Keys are SHA-256 digests, never raw caller identities.
create table if not exists public.rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  request_count integer not null check (request_count between 1 and 1000001),
  expires_at timestamptz not null
);
create index if not exists rate_limit_buckets_expiry_idx
  on public.rate_limit_buckets (expires_at, key_hash);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated, service_role;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_ms integer)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '2s'
set lock_timeout = '1s'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_expiry timestamptz;
begin
  if p_key is null or length(p_key) <> 64 or p_key !~ '^[0-9a-f]{64}$'
    or p_limit is null or p_limit < 1 or p_limit > 1000000
    or p_window_ms is null or p_window_ms < 1000 or p_window_ms > 3600000 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  -- ON CONFLICT locks the row. Concurrent instances cannot read the same count
  -- then both admit a caller; increments and expiry resets are serialized.
  insert into public.rate_limit_buckets as b (key_hash, request_count, expires_at)
  values (p_key, 1, v_now + p_window_ms * interval '1 millisecond')
  on conflict (key_hash) do update set
    request_count = case when b.expires_at <= v_now then 1
      else least(b.request_count + 1, p_limit + 1) end,
    expires_at = case when b.expires_at <= v_now
      then v_now + p_window_ms * interval '1 millisecond' else b.expires_at end
  returning b.request_count, b.expires_at into v_count, v_expiry;

  -- Every request makes bounded progress, including throttled callers. The
  -- expiry index and SKIP LOCKED avoid one busy row starving cleanup. Clean
  -- AFTER locking the quota row, so cleaners never deadlock on later upserts.
  with expired as (
    select b.key_hash
    from public.rate_limit_buckets b
    where b.expires_at <= v_now
    order by b.expires_at, b.key_hash
    limit 32
    for update skip locked
  )
  delete from public.rate_limit_buckets b
  using expired e where b.key_hash = e.key_hash;

  return query select v_count <= p_limit,
    greatest(1, ceil(extract(epoch from (v_expiry - v_now)))::integer);
end;
$function$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;