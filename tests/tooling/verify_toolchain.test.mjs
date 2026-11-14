import test from 'node:test';
import assert from 'node:assert/strict';
import { validateToolchain } from '../../tools/toolchain-contract.mjs';

const expected = { node: '26.7.0', npm: '12.2.0', postgresqlVersion: '18.0', postgresqlPackageVersion: '18.0-2' };
const packageJson = {
  packageManager: 'npm@12.2.0',
  engines: { node: '>=26.7.0 <27', npm: '>=12.2.0 <13' },
};
const lockfile = { packages: { '': { engines: packageJson.engines } } };
const validSources = {
  expected,
  packageJson,
  lockfile,
  nvmrc: '26.7.0\n',
  readme: 'Node.js 26.7.0, npm 12.2.0, PostgreSQL 18.0, package build 18.0-2',
  workflow: "node-version: '26.7.0'; npm@12.2.0; npm --version; image: postgres:18.0-alpine",
  compose: 'image: postgres:18.0-alpine',
  actualNode: '26.7.0',
  actualNpm: '12.2.0',
};

test('accepts a fully aligned local and CI matrix', () => {
  assert.deepEqual(validateToolchain(validSources), []);
});

test('reports mismatched declarations and actual runtime versions', () => {
  const failures = validateToolchain({
    ...validSources,
    nvmrc: '22\n',
    workflow: "node-version: '22'; image: postgres:17-alpine",
    compose: 'image: postgres:17-alpine',
    actualNode: '22.16.0',
    actualNpm: '10.9.2',
  });
  assert.deepEqual(failures, [
    '.nvmrc', 'CI Node versions', 'CI npm version pin',
    'CI must verify the installed npm runtime', 'CI PostgreSQL versions', 'Docker Compose PostgreSQL versions',
    'running Node (22.16.0)', 'running npm (10.9.2)',
  ]);
});

test('rejects floating major-only and mismatched minor PostgreSQL image tags', () => {
  for (const version of ['18-alpine', '18.6-alpine', '17.6-alpine']) {
    assert.ok(validateToolchain({
      ...validSources,
    workflow: `node-version: '26.7.0'; npm@12.2.0; npm --version; image: postgres:${version}`,
      compose: `image: postgres:${version}`,
    }).includes('CI PostgreSQL versions'));
  }
  assert.ok(validateToolchain({
    ...validSources,
    workflow: "node-version: '26.7.0'; npm@12.2.0; npm --version; image: postgres:18.0-alpine",
    compose: 'image: postgres:18.0-alpine',
  }).length === 0);
});
