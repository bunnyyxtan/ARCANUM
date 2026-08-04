#!/usr/bin/env bash
# Runs the workspace test suites (including the append-only vendor review
# trail integration tests in packages/api), ensuring the dev database
# schema is up to date first.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  echo "The vendor-flags integration tests need the dev Postgres database." >&2
  echo "Run this from the Replit workspace shell where DATABASE_URL is provided." >&2
  exit 1
fi

echo "==> Applying database migrations (npm run db:migrate)..."
if ! npm run db:migrate; then
  echo "ERROR: database migrations failed — fix migrations before running tests." >&2
  exit 1
fi

echo "==> Running workspace test suites..."
if command -v forge >/dev/null 2>&1; then
  npm run test
else
  echo "NOTE: Foundry (forge) not installed — skipping @arcanum/contracts tests."
  for ws in $(npm query .workspace | node -e '
    const pkgs = JSON.parse(require("fs").readFileSync(0, "utf8"));
    for (const p of pkgs) {
      if (p.name === "@arcanum/contracts") continue;
      if (p.scripts && p.scripts.test) console.log(p.name);
    }
  '); do
    npm run test --workspace "$ws"
  done
fi
