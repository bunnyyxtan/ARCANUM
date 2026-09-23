#!/usr/bin/env bash
# Usage: bash atomic-ledger-event.concurrent.sh /explicit/pg17/bin PORT DATA_DIR
# No inherited connection environment is used. Parent owns cluster lifecycle.
set -euo pipefail
bin="${1:?explicit PG17 bin required}"
port="${2:?explicit disposable port required}"
data="${3:?explicit disposable data directory required}"
[[ "$port" =~ ^[0-9]+$ && "$data" = /tmp/* && -f "$data/PG_VERSION" ]]
[[ "$(cat "$data/PG_VERSION")" = 17 ]]
[[ "$("$bin/psql" --version)" = *" 17."* ]]
sql() {
  env -i PATH="$bin:/usr/bin:/bin" "$bin/psql" -X -qAt -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$port" -U arcanum_drill -d optimization_sql "$@"
}
identity="$(sql -c "select current_database() || '|' || session_user || '|' || current_setting('data_directory')")"
[[ "$identity" = "optimization_sql|arcanum_drill|$data" ]] || {
  echo "Refusing non-disposable database" >&2; exit 1;
}
work="$(mktemp -d /tmp/atomic-ledger-race.XXXXXX)"
org="$(sql -c 'select gen_random_uuid()')"
cleanup() {
  sql -c "delete from public.organizations where id = '$org'" >/dev/null
  rm -rf "$work"
}
trap cleanup EXIT
sql -c "insert into public.organizations(id,name,slug) values('$org','Atomic race','$org')"
for mode in identical conflict; do
  payload="{\"organization_id\":\"$org\",\"tx_hash\":\"race-$org-$mode\",\"log_index\":1,\"chain_id\":5042002,\"event_time\":\"2025-01-01T00:00:00Z\",\"amount_usdc\":\"1.0\",\"status\":\"allowed\",\"policy_snapshot\":{},\"data_source\":\"live\"}"
  # Winner stays uncommitted until contender is known to be waiting on a lock.
  (
    sql >"$work/winner" <<SQL
begin;
set local role service_role;
select event ->> 'id' from public.insert_ledger_event('$payload') as result(event);
\! touch "$work/inserted"
\! while [ ! -f "$work/release" ]; do sleep 0.05; done
commit;
SQL
  ) &
  winner=$!
  for _ in {1..100}; do [[ -f "$work/inserted" ]] && break; sleep 0.05; done
  [[ -f "$work/inserted" ]] || { kill "$winner"; exit 1; }
  candidate="$payload"
  [[ "$mode" = identical ]] || candidate="${payload/1.0/2.0}"
  (
    sql >"$work/contender" 2>"$work/error" <<SQL
set application_name = 'atomic-ledger-contender';
set role service_role;
select event ->> 'id' from public.insert_ledger_event('$candidate') as result(event);
SQL
  ) &
  contender=$!
  waiting=false
  for _ in {1..100}; do
    if [[ "$(sql -c "select count(*) from pg_stat_activity where application_name='atomic-ledger-contender' and wait_event_type='Lock'")" = 1 ]]; then
      waiting=true; break
    fi
    sleep 0.05
  done
  touch "$work/release"
  wait "$winner"
  [[ "$waiting" = true ]] || { wait "$contender" || true; echo "Contender never blocked" >&2; exit 1; }
  if [[ "$mode" = identical ]]; then
    wait "$contender"
    [[ "$(cat "$work/winner")" = "$(cat "$work/contender")" ]]
    [[ -s "$work/contender" ]]
  else
    if wait "$contender"; then echo "Conflicting race succeeded" >&2; exit 1; fi
    grep -q 'conflicting immutable ledger event' "$work/error"
  fi
  [[ "$(sql -c "select count(*) from public.ledger_events where tx_hash='race-$org-$mode' and amount_usdc=1")" = 1 ]]
  rm "$work/inserted" "$work/release"
done
echo "Atomic ledger identical/conflicting READ COMMITTED races passed"
