#!/usr/bin/env bash
# Restores lib/ at the exact commits the contracts are built and audited against.
# Tags are mutable; commits are not.
set -euo pipefail

cd "$(dirname "$0")/.."

restore() {
  local dir="$1" repo="$2" commit="$3"
  rm -rf "lib/$dir"
  git init -q "lib/$dir"
  git -C "lib/$dir" fetch -q --depth 1 "https://github.com/$repo" "$commit"
  git -C "lib/$dir" checkout -q FETCH_HEAD
  rm -rf "lib/$dir/.git"
}

restore forge-std foundry-rs/forge-std 77041d2ce690e692d6e03cc812b57d1ddaa4d505                                   # v1.9.7
restore openzeppelin-contracts OpenZeppelin/openzeppelin-contracts dbb6104ce834628e473d2173bbc9d47f81a9eec3         # v5.0.2
restore openzeppelin-contracts-upgradeable OpenZeppelin/openzeppelin-contracts-upgradeable 723f8cab09cdae1aca9ec9cc1cfa040c2d4b06c1 # v5.0.2
restore solady Vectorized/solady 65e87c72a5ee4a6708946b25611ec5f980ceba70                                          # v0.1.22
