#!/bin/bash
# Post-merge setup: sync dependencies after a task merge.
# Idempotent, non-interactive, fail-fast.
set -e

npm install --no-audit --no-fund
