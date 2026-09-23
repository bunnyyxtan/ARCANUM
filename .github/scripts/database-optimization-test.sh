#!/usr/bin/env bash
set -euo pipefail

# Re-enter with an empty environment so a developer's live DB URL, libpq
# service/password settings, and Supabase secrets can never reach this runner.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mode=fixture
snapshot=
auth_helpers=
auth_users=
if [[ "${1:-}" == "--actual-schema" ]]; then
  [[ $# == 4 ]] || {
    echo "usage: $0 [--actual-schema /absolute/public-schema.sql /absolute/auth-helpers.sql /absolute/auth-users.sql]" >&2
    exit 2
  }
  mode=actual
  snapshot="$2"
  auth_helpers="$3"
  auth_users="$4"
elif [[ $# != 0 ]]; then
  echo "usage: $0 [--actual-schema /absolute/public-schema.sql /absolute/auth-helpers.sql /absolute/auth-users.sql]" >&2
  exit 2
fi

database_optimization_main() {
  set -euo pipefail
  local root="$1" mode="$2" snapshot="$3" auth_helpers="$4" auth_users="$5" node_bin="$6"
  local tool version port migration test_file
  pg_bin=
  work=

  pg_bin="$(dirname "$(command -v postgres)")"
  [[ "$node_bin" = /* && -x "$node_bin" ]] || { echo "Node executable missing" >&2; exit 1; }
  [[ "$pg_bin" = /* ]] || { echo "PostgreSQL binaries must resolve to an absolute path" >&2; exit 1; }
  for tool in postgres initdb pg_ctl psql; do
    [[ -x "$pg_bin/$tool" ]] || { echo "Missing PostgreSQL tool: $tool" >&2; exit 1; }
    version="$("$pg_bin/$tool" --version)"
    [[ "$version" =~ \(PostgreSQL\)\ 17(\.|$) ]] || {
      echo "PostgreSQL major 17 required for every tool: $tool" >&2
      exit 1
    }
  done
  [[ "$(id -u)" != 0 ]] || {
    echo "Run disposable PostgreSQL tests as an unprivileged user" >&2
    exit 1
  }
  if [[ "$mode" == actual ]]; then
    [[ "$snapshot" = /* && "$auth_helpers" = /* && "$auth_users" = /* ]] || {
      echo "Actual-schema inputs must be absolute paths" >&2; exit 1;
    }
    [[ -f "$snapshot" && -f "$auth_helpers" && -f "$auth_users" ]] || {
      echo "Actual-schema snapshot, auth helpers, or auth.users DDL missing" >&2; exit 1;
    }
  fi
  for migration in \
    "$root/supabase/migrations/20260923160000_scoped_analytics.sql" \
    "$root/supabase/migrations/20260923161000_atomic_ledger_event.sql" \
    "$root/supabase/migrations/20260923162000_remove_duplicate_ledger_indexes.sql"; do
    [[ -f "$migration" ]] || { echo "Required migration missing: $migration" >&2; exit 1; }
  done
  test_file="$root/packages/api/src/supabase/scoped-analytics.sql.test.ts"
  [[ -f "$test_file" ]] || { echo "Required API SQL test missing: $test_file" >&2; exit 1; }
  [[ -f "$root/node_modules/vitest/vitest.mjs" ]] || {
    echo "Existing npm dependencies required; install them separately in CI" >&2
    exit 1
  }

  work="$(mktemp -d /tmp/arcanum-optimization-sql.XXXXXX)"
  chmod 700 "$work"
  cleanup_database_optimization() {
    local status=$? pid
    trap - EXIT INT TERM
    [[ -n "$work" ]] || exit "$status"
    while IFS= read -r -d '' pid; do
      "$pg_bin/pg_ctl" -D "${pid%/postmaster.pid}" -m immediate -w stop >/dev/null 2>&1 || true
    done < <(find "$work" -type f -name postmaster.pid -print0 2>/dev/null)
    rm -rf -- "$work"
    exit "$status"
  }
  trap cleanup_database_optimization EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  mkdir -m 700 "$work/home" "$work/tmp" "$work/socket"
  : >"$work/pgpass"
  : >"$work/pg_service.conf"
  chmod 600 "$work/pgpass" "$work/pg_service.conf"
  export HOME="$work/home" TMPDIR="$work/tmp"
  export PGPASSFILE="$work/pgpass" PGSERVICEFILE="$work/pg_service.conf"
  export PATH="$pg_bin:$(dirname "$node_bin"):/usr/bin:/bin"
  export NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false

  port="$(node -e '
    const net = require("node:net");
    const server = net.createServer();
    server.on("error", () => process.exit(1));
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => console.log(port));
    });
  ')"
  [[ "$port" =~ ^[0-9]+$ && "$port" -ge 1024 && "$port" -le 65535 ]]
  "$pg_bin/initdb" -D "$work/data" -U arcanum_drill --auth-local=trust --auth-host=trust \
    --no-locale --encoding=UTF8 >/dev/null
  "$pg_bin/pg_ctl" -D "$work/data" -l "$work/postgres.log" \
    -o "-F -k $work/socket -h 127.0.0.1 -p $port" -w start >/dev/null

  psql_safe() {
    "$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 \
      -h 127.0.0.1 -p "$port" -U arcanum_drill "$@"
  }
  psql_safe -d postgres \
    -c "CREATE DATABASE optimization_sql;" \
    -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE postgres NOLOGIN;
        CREATE ROLE authenticator NOLOGIN; CREATE ROLE dashboard_user NOLOGIN;
        CREATE ROLE supabase_admin NOLOGIN; CREATE ROLE supabase_auth_admin NOLOGIN;
        CREATE ROLE supabase_etl_admin NOLOGIN; CREATE ROLE supabase_privileged_role NOLOGIN;
        CREATE ROLE supabase_read_only_user NOLOGIN; CREATE ROLE supabase_realtime_admin NOLOGIN;
        CREATE ROLE supabase_replication_admin NOLOGIN; CREATE ROLE supabase_storage_admin NOLOGIN;"
  if [[ "$mode" == actual ]]; then
    # The captured public-only dump deliberately has no auth schema. Load the
    # separately captured real helpers and auth.users DDL first; any unresolved
    # dependency aborts rather than weakening or faking the production schema.
    psql_safe -d optimization_sql -c "DROP SCHEMA public CASCADE"
    psql_safe -d optimization_sql -f "$auth_helpers"
    psql_safe -d optimization_sql -f "$auth_users"
    psql_safe -d optimization_sql -f "$snapshot"
  else
    psql_safe -d optimization_sql -f "$root/scripts/sql-optimization/relevant-schema.sql"
  fi

  for migration in \
    "$root/supabase/migrations/20260923160000_scoped_analytics.sql" \
    "$root/supabase/migrations/20260923161000_atomic_ledger_event.sql" \
    "$root/supabase/migrations/20260923162000_remove_duplicate_ledger_indexes.sql"; do
    if [[ "$migration" == *20260923162000_remove_duplicate_ledger_indexes.sql ]]; then
      # Its SET LOCAL safety timeouts require a transaction.
      psql_safe -1 -d optimization_sql -f "$migration"
      psql_safe -1 -d optimization_sql -f "$migration"
    else
      psql_safe -d optimization_sql -f "$migration"
      psql_safe -d optimization_sql -f "$migration"
    fi
  done
  psql_safe -d optimization_sql -f "$root/scripts/sql-optimization/verify-permissions.sql"
  psql_safe -d optimization_sql -f "$root/scripts/sql-optimization/duplicate-indexes.integration.sql"
  bash "$root/scripts/sql-optimization/duplicate-indexes-fail-closed.sh" \
    "$pg_bin" "$port" "$work/data" "$root"

  cd "$root"
  export ARCANUM_OPTIMIZATION_SQL_TEST_PORT="$port"
  export ARCANUM_OPTIMIZATION_SQL_TEST_DATA_DIR="$work/data"
  npm run test --workspace @arcanum/api -- src/supabase/scoped-analytics.sql.test.ts --maxWorkers=1
  psql_safe -d optimization_sql -f scripts/sql-optimization/scoped-analytics-benchmark.sql
  psql_safe -d optimization_sql -f packages/indexer/test/atomic-ledger-event.integration.sql
  bash packages/indexer/test/atomic-ledger-event.concurrent.sh "$pg_bin" "$port" "$work/data"
  echo "PostgreSQL 17 database optimization tests passed ($mode schema)"
  exit 0
}

exec env -i PATH="$PATH" LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  bash -c "$(declare -f database_optimization_main); database_optimization_main \"\$@\"" \
  database-optimization-test "$root" "$mode" "$snapshot" "$auth_helpers" "$auth_users" "$(command -v node)"