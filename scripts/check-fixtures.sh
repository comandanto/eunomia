#!/usr/bin/env bash
# Checks the vendored wasm fixtures against the hashes the repo pins elsewhere:
#   treasury_v4.wasm       == TREASURY_V4_HASH (factory test) == TREASURY_WASM_HASH (web)
#   treasury_registry.wasm == the hash recorded in DEPLOYMENT.md
# Run from anywhere: bash scripts/check-fixtures.sh
set -euo pipefail
cd "$(dirname "$0")/.."

fix=contracts/treasury_factory/fixtures
fail=0

sha() { sha256sum "$1" | cut -d' ' -f1; }

check() { # name actual expected
  if [ -z "$3" ]; then
    echo "FAIL $1: no pinned hash found"; fail=1
  elif [ "$2" = "$3" ]; then
    echo "ok   $1  $2"
  else
    echo "FAIL $1: fixture $2, pinned $3"; fail=1
  fi
}

treasury=$(sha "$fix/treasury_v4.wasm")

# The Rust constant is a byte array; fold it back into hex.
rust=$(awk '/^const TREASURY_V4_HASH/{f=1;next} f&&/^\];/{exit} f' contracts/treasury_factory/src/test.rs \
  | grep -o '0x[0-9a-f]\{2\}' | sed 's/0x//' | tr -d '\n')
web=$(grep -A1 'TREASURY_WASM_HASH =' web/src/lib/treasuryWasm.ts | grep -o '[0-9a-f]\{64\}' || true)

check "treasury_v4.wasm vs TREASURY_V4_HASH (factory test)" "$treasury" "$rust"
check "treasury_v4.wasm vs TREASURY_WASM_HASH (web)" "$treasury" "$web"

registry=$(sha "$fix/treasury_registry.wasm")
# DEPLOYMENT.md abbreviates the hash as `9a83b99c…514c`: compare the first and last 4 bytes.
abbr=$(grep -o 'wasm `[0-9a-f]\{8\}…[0-9a-f]\{4\}`' DEPLOYMENT.md | grep -i "^wasm \`${registry:0:8}…${registry: -4}\`" || true)
if [ -n "$abbr" ]; then
  echo "ok   treasury_registry.wasm vs DEPLOYMENT.md  $registry"
else
  echo "FAIL treasury_registry.wasm: ${registry:0:8}…${registry: -4} not recorded in DEPLOYMENT.md"; fail=1
fi

exit $fail
