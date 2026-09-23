#!/usr/bin/env bash
# Parent runner supplies only its explicit disposable local cluster coordinates.
set -euo pipefail
bin="${1:?explicit PG17 bin required}"
port="${2:?explicit disposable port required}"
data="${3:?explicit disposable data directory required}"
root="${4:?repository root required}"
[[ "$port" =~ ^[0-9]+$ && "$data" = /tmp/* && -f "$data/PG_VERSION" ]]
[[ "$(cat "$data/PG_VERSION")" = 17 ]]
[[ "$("$bin/psql" --version)" = *" 17."* ]]

sql() {
  env -i PATH="$bin:/usr/bin:/bin" "$bin/psql" -X -qAt -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$port" -U arcanum_drill "$@"
}
identity="$(sql -d optimization_sql -c \
  "select current_database() || '|' || session_user || '|' || current_setting('data_directory')")"
[[ "$identity" = "optimization_sql|arcanum_drill|$data" ]] || {
  echo "Refusing non-disposable database" >&2; exit 1;
}

work="$(mktemp -d /tmp/duplicate-index-guard.XXXXXX)"
cleanup() {
  for db in optimization_guard_missing optimization_guard_order optimization_guard_partial; do
    sql -d postgres -c "drop database if exists $db with (force)" >/dev/null 2>&1 || true
  done
  rm -rf "$work"
}
trap cleanup EXIT

run_case() {
  local case_name="$1" db="optimization_guard_$1" mutate="$2"
  sql -d postgres -c "create database $db template optimization_sql"
  sql -d "$db" -c "create index ledger_events_org_idx on public.ledger_events (organization_id)"
  sql -d "$db" -c "$mutate"
  if sql -1 -d "$db" -f "$root/supabase/migrations/20260923162000_remove_duplicate_ledger_indexes.sql" \
      >"$work/$case_name.out" 2>"$work/$case_name.err"; then
    echo "Duplicate-index guard unexpectedly accepted $case_name retained index" >&2
    exit 1
  fi
  grep -Eq 'Refusing to remove ledger_events_org_idx' "$work/$case_name.err"
  [[ "$(sql -d "$db" -c \
    "select (to_regclass('public.ledger_events_org_idx') is not null)::text")" = true ]]
}

run_case missing "drop index public.idx_le_org"
run_case order \
  "drop index public.idx_le_org; create index idx_le_org on public.ledger_events (organization_id desc)"
run_case partial \
  "drop index public.idx_le_org; create index idx_le_org on public.ledger_events (organization_id) where organization_id is not null"

echo "Duplicate-index migration fail-closed cases passed"