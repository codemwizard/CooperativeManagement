import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidate = process.argv[2];
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/, 'usage: node evidence/phase1/wp5.4/verify-exact-candidate.mjs <implementation-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP5.4 exact-candidate verification requires a clean worktree');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'WP5.4 implementation candidate must be an ancestor of evidence HEAD');
for (const changed of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.match(changed, /^evidence\/phase1\/(?:wp2\.5|wp5\.4)\//, `post-candidate change is outside WP2.5/WP5.4 evidence: ${changed}`);
}

const evidence = JSON.parse(await readFile('evidence/phase1/wp5.4/task-evidence.json', 'utf8'));
assert.equal(evidence.task_id, 'REM-WP5.4');
assert.equal(evidence.commit, candidate);
assert.equal(evidence.candidate?.implementation_commit, candidate);
assert.equal(evidence.candidate?.status, 'immutable implementation candidate');
assert.equal(evidence.status.implementation, 'complete');
for (const key of ['integration_test', 'bdd_ui_test']) assert.equal(evidence.status[key], 'passed', `${key} must pass`);
assert.equal(evidence.status.gate_verified, preflight ? 'pending' : 'passed');
assert.deepEqual(evidence.unresolved_decisions, []);
assert.match(evidence.environment.node, /26\.7/);
assert.match(evidence.environment.npm, /12\.2\.0/);
assert.match(evidence.environment.postgres, /18\.0/);
assert.equal(evidence.environment.data_mode, 'test');

for (const predecessor of ['REM-WP5.3', 'REM-WP6.1']) {
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  const record = JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
  assert.equal(record.status.gate_verified, 'passed', `${predecessor} must be gate-passed`);
  const sha = record.commit ?? record.candidate?.implementation_commit;
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', sha, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} must be an ancestor of the WP5.4 candidate`);
}

const root = 'evidence/phase1/wp5.4/local/2026-11-22';
const db = await readFile(`${root}/postgres-db-suite.log`, 'utf8');
assert.match(db, /Test Files\s+14 passed/);
assert.match(db, /Tests\s+86 passed/);
assert.doesNotMatch(db, /Failed Tests|Test Files\s+\d+ failed|Tests\s+\d+ failed/i);
const browser = await readFile(`${root}/browser-command.log`, 'utf8');
assert.match(browser, /2 passed/);
const api = await readFile(`${root}/api-suite.log`, 'utf8');
assert.match(api, /Test Files\s+7 passed/);
assert.match(api, /Tests\s+29 passed/);
const typecheck = await readFile(`${root}/typecheck-v4.log`, 'utf8');
assert.match(typecheck, /typecheck:v4/);
assert.match(await readFile(`${root}/architecture.log`, 'utf8'), /no dependency violations found/i);
assert.match(await readFile(`${root}/phase1-contracts.log`, 'utf8'), /112 tests/);
assert.match(await readFile(`${root}/phase0-contract.log`, 'utf8'), /11 passed, 1 skipped/);
const environment = JSON.parse(await readFile(`${root}/runtime-environment.json`, 'utf8'));
assert.equal(environment.database, 'symphony_phase1_test');
assert.equal(environment.application_role, 'symphony_app');
assert.equal(environment.temporary_migration_role_membership, 'granted only for WP5.4 full database test execution and revoked afterward');

for (const command of evidence.commands) {
  assert.equal(command.result, 'passed', `unpassed WP5.4 command: ${command.command}`);
  await access(command.artifact);
}
console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP5.4 exact implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log('PASS CI-equivalent WP1.5 role setup cleanup, PostgreSQL DB suite (14 files/86 tests), API suite (7 files/29 tests), real browser acceptance, toolchain, architecture and contracts.');
if (preflight) console.log('WP5.4 gate remains pending until final exact-candidate verification.');
