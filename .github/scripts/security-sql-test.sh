#!/usr/bin/env bash
set -euo pipefail

# Always re-enter with an empty environment: no inherited database URLs,
# passwords, Supabase/service keys, backup encryption keys, or PG service files.
# Existing npm dependencies are required; this script never installs packages.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pg_bin="${1:-/usr/lib/postgresql/17/bin}"

security_sql_main() {
  set -euo pipefail
  local root="$1" pg_bin="$2" tool version work port
  [[ "$pg_bin" = /* ]] || { echo "PostgreSQL bin directory must be absolute" >&2; exit 1; }
  for tool in postgres initdb pg_ctl psql pg_dump pg_restore; do
    [[ -x "$pg_bin/$tool" ]] || { echo "Missing PostgreSQL tool: $tool" >&2; exit 1; }
    version="$("$pg_bin/$tool" --version)"
    [[ "$version" =~ \(PostgreSQL\)\ 17(\.|$) ]] || {
      echo "PostgreSQL major 17 required for every tool: $tool" >&2
      exit 1
    }
  done
  [[ "$(id -u)" != 0 ]] || { echo "Run disposable PostgreSQL tests as an unprivileged user" >&2; exit 1; }
  [[ -f "$root/node_modules/vitest/vitest.mjs" ]] || {
    echo "Existing npm dependencies required; run npm ci separately in CI" >&2
    exit 1
  }
  work="$(mktemp -d /tmp/arc-sql.XXXXXX)"
  chmod 700 "$work"
  cleanup_security_sql() {
    local status=$? pid
    trap - EXIT INT TERM
    # All SQL suites/restore fixtures inherit this private TMPDIR. On failure
    # or interruption stop only clusters beneath it, never an existing server.
    while IFS= read -r -d '' pid; do
      "$pg_bin/pg_ctl" -D "${pid%/postmaster.pid}" -m immediate -w stop >/dev/null 2>&1 || true
    done < <(find "$work" -type f -name postmaster.pid -print0 2>/dev/null)
    rm -rf -- "$work"
    exit "$status"
  }
  trap cleanup_security_sql EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  mkdir -m 700 "$work/home" "$work/tmp" "$work/socket"
  export HOME="$work/home" TMPDIR="$work/tmp"
  : > "$work/pgpass"
  : > "$work/pg_service.conf"
  chmod 600 "$work/pgpass" "$work/pg_service.conf"
  export PGPASSFILE="$work/pgpass" PGSERVICEFILE="$work/pg_service.conf"
  export NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false
  export PATH="$pg_bin:$PATH"
  port="$(node -e '
    const net = require("node:net");
    const server = net.createServer();
    server.on("error", () => process.exit(1));
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => { if (port === 5547) process.exit(1); console.log(port); });
    });
  ')"
  [[ "$port" =~ ^[0-9]+$ && "$port" -ge 1024 && "$port" -le 65535 && "$port" != 5547 ]]
  "$pg_bin/initdb" -D "$work/data" -U arcanum_drill --auth-local=trust --auth-host=trust \
    --no-locale --encoding=UTF8 >/dev/null
  "$pg_bin/pg_ctl" -D "$work/data" -l "$work/postgres.log" \
    -o "-F -k $work/socket -h 127.0.0.1 -p $port" -w start >/dev/null
  "$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U arcanum_drill -d postgres \
    -c "CREATE DATABASE hardening_sql;" \
    -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;"

  cd "$root"
  export ARCANUM_AUTH_SQL_TEST_PORT="$port"
  export ARCANUM_AUTH_SQL_TEST_DATA_DIR="$work/data"
  echo "Running isolated PostgreSQL 17 auth/rate and receipt tests"
  npm run test --workspace @arcanum/auth -- src/sessions.sql.test.ts
  ARCANUM_RUN_RATE_LIMIT_SQL_TESTS=true npm run test --workspace @arcanum/api -- src/rate-limit.sql.test.ts
  npm run test --workspace @arcanum/api -- src/receipts/evidence.sql.test.ts
  node node_modules/vitest/vitest.mjs run scripts/lib/receipt-execution.test.ts
  # Exit while the trap's private-directory locals are still in scope.
  exit 0
}

exec env -i PATH="$PATH" LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  bash -c "$(declare -f security_sql_main); security_sql_main \"\$@\"" \
  security-sql-test "$root" "$pg_bin"