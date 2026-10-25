#!/usr/bin/env bash
# Builds the deployable contracts for wasm32v1-none and fails if one is over the size
# budget. Soroban rejects a contract wasm above 128 KiB, so that is the ceiling.
# Run from anywhere: bash scripts/check-wasm-size.sh
set -euo pipefail
cd "$(dirname "$0")/.."

budget=131072
contracts="treasury treasury_factory treasury_registry"

args=()
for c in $contracts; do args+=(-p "$c"); done
cargo build --release --target wasm32v1-none "${args[@]}"

fail=0
for c in $contracts; do
  f=target/wasm32v1-none/release/$c.wasm
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -gt "$budget" ]; then
    echo "FAIL $c.wasm: $size bytes, budget $budget"; fail=1
  else
    echo "ok   $c.wasm: $size bytes (budget $budget)"
  fi
done
exit $fail
