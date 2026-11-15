import test from 'node:test';
import assert from 'node:assert/strict';
import { validateToolchain } from '../../tools/toolchain-contract.mjs';

const expected = { node: '26.7.0', npm: '12.2.0', postgresqlVersion: '18.0', postgresqlPackageVersion: '18.0-2' };
const packageJson = {
  packageManager: 'npm@12.2.0',
  engines: { node: '>=26.7.0 <27', npm: '12.2.0' },
};
const lockfile = { packages: { '': { engines: packageJson.engines } } };
const validSources = {
  expected,
  packageJson,
  lockfile,
  nvmrc: '26.7.0\n',
  readme: 'Node.js 26.7.0, npm 12.2.0, PostgreSQL 18.0, package build 18.0-2',
  workflow: "defaults:\n  run:\n    shell: bash\nnode-version: '26.7.0'; run: bash tools/prepare_ci_npm.sh; test \"$(command -v npm)\" = \"$NPM_BIN\"; npm --version; image: postgres:18.0-alpine",
  compose: 'image: postgres:18.0-alpine',
  ciNpmSetup: 'npm install --prefix "$npm_root" --no-save --no-package-lock "npm@$expected_npm"; node "$npm_cli" --version; npm_bin="$RUNNER_TEMP/symphony-npm/bin"; printf #!/usr/bin/env bash; exec node "%s" "$@"; printf "%s\\n" "$npm_bin" >> "$GITHUB_PATH"; printf NPM_BIN=%s/npm >> "$GITHUB_ENV"',
  actualNode: '26.7.0',
  actualNpm: '12.2.0',
};

test('accepts a fully aligned local and CI matrix', () => {
  assert.deepEqual(validateToolchain(validSources), []);
});

test('rejects global npm installation in the CI helper', () => {
  const failures = validateToolchain({
    ...validSources,
    ciNpmSetup: `${validSources.ciNpmSetup}\nnpm install -g npm@12.2.0`,
  });
  assert.ok(failures.includes('CI npm setup must never install npm globally'));
});

test('reports mismatched declarations and actual runtime versions', () => {
  const failures = validateToolchain({
    ...validSources,
    nvmrc: '22\n',
    workflow: "node-version: '22'; image: postgres:17-alpine",
    ciNpmSetup: '',
    compose: 'image: postgres:17-alpine',
    actualNode: '22.16.0',
    actualNpm: '10.9.2',
  });
  assert.deepEqual(failures, [
    '.nvmrc', 'CI Node versions', 'CI must prepare the pinned local npm CLI',
    'Every CI Node job must prepare its pinned local npm CLI',
    'CI must verify the installed npm runtime', 'CI npm must be installed under RUNNER_TEMP, not globally',
    'CI npm setup must verify, wrap, and expose the exact local npm CLI',
    'CI must assert the npm executable path before running npm commands', 'CI run steps must default to Bash with pipefail',
    'CI PostgreSQL versions', 'Docker Compose PostgreSQL versions',
    'running Node (22.16.0)', 'running npm (10.9.2)',
  ]);
});

test('rejects an npm compatibility range when the project requires an exact runtime pin', () => {
  const failures = validateToolchain({
    ...validSources,
    packageJson: { ...packageJson, engines: { ...packageJson.engines, npm: '>=12.2.0 <13' } },
    lockfile: { packages: { '': { engines: { ...packageJson.engines, npm: '>=12.2.0 <13' } } } },
  });
  assert.ok(failures.includes('package.json npm engine'));
});

test('rejects floating major-only and mismatched minor PostgreSQL image tags', () => {
  for (const version of ['18-alpine', '18.6-alpine', '17.6-alpine']) {
    assert.ok(validateToolchain({
      ...validSources,
      workflow: `defaults:\n  run:\n    shell: bash\nnode-version: '26.7.0'; run: bash tools/prepare_ci_npm.sh; test \"$(command -v npm)\" = \"$NPM_BIN\"; npm --version; image: postgres:${version}`,
      compose: `image: postgres:${version}`,
    }).includes('CI PostgreSQL versions'));
  }
  assert.ok(validateToolchain({
    ...validSources,
    workflow: "defaults:\n  run:\n    shell: bash\nnode-version: '26.7.0'; run: bash tools/prepare_ci_npm.sh; test \"$(command -v npm)\" = \"$NPM_BIN\"; npm --version; image: postgres:18.0-alpine",
    compose: 'image: postgres:18.0-alpine',
  }).length === 0);
});
