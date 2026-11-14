#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?GitHub Actions RUNNER_TEMP is required}"
: "${GITHUB_PATH:?GitHub Actions GITHUB_PATH is required}"

expected_node="$(node --input-type=module -e "import { readFileSync } from 'node:fs'; process.stdout.write(JSON.parse(readFileSync('toolchain.json', 'utf8')).node)")"
expected_npm="$(node --input-type=module -e "import { readFileSync } from 'node:fs'; process.stdout.write(JSON.parse(readFileSync('toolchain.json', 'utf8')).npm)")"
actual_node="$(node --version)"
if [[ "$actual_node" != "v$expected_node" ]]; then
  echo "Node toolchain mismatch: expected v$expected_node, found $actual_node" >&2
  exit 1
fi

npm_root="$RUNNER_TEMP/symphony-npm"
npm install --prefix "$npm_root" --no-save --no-package-lock "npm@$expected_npm"
npm_cli="$npm_root/node_modules/npm/bin/npm-cli.js"
npm_bin="$npm_root/node_modules/.bin"
actual_npm="$(node "$npm_cli" --version)"
if [[ "$actual_npm" != "$expected_npm" ]]; then
  echo "npm toolchain mismatch: expected $expected_npm, found $actual_npm" >&2
  exit 1
fi

printf '%s\n' "$npm_bin" >> "$GITHUB_PATH"
echo "Prepared Node $expected_node and local npm $actual_npm; no global npm installation was performed."
