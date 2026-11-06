import test from 'node:test';
import assert from 'node:assert/strict';
import { validateToolchain } from '../../tools/toolchain-contract.mjs';

const expected = { node: '26.7.0', npm: '11.19.0', postgresqlMajor: 18 };
const packageJson = {
  packageManager: 'npm@11.19.0',
  engines: { node: '>=26.7.0 <27', npm: '>=11.19.0' },
};
const lockfile = { packages: { '': { engines: packageJson.engines } } };
const validSources = {
  expected,
  packageJson,
  lockfile,
  nvmrc: '26.7.0\n',
  readme: 'Node.js 26.7.0, npm 11.19.0, PostgreSQL 18',
  workflow: "node-version: '26.7.0'; npm@11.19.0; image: postgres:18-alpine",
  compose: 'image: postgres:18-alpine',
  actualNode: '26.7.0',
  actualNpm: '11.19.0',
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
    '.nvmrc', 'CI Node versions', 'CI npm version pin', 'CI PostgreSQL versions', 'Docker Compose PostgreSQL versions',
    'running Node (22.16.0)', 'running npm (10.9.2)',
  ]);
});
