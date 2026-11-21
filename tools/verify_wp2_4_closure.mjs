import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { validateEvidence } from './phase1-contracts.js';

const candidate = process.argv.slice(2).find((value) => /^[0-9a-f]{40}$/.test(value));
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/, 'usage: node tools/verify_wp2_4_closure.mjs <implementation-commit-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP2.4 evidence checkout must be clean');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0,
  'Implementation candidate must be an ancestor of the evidence commit');

const evidenceChanges = git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean);
for (const path of evidenceChanges) assert.match(path, /^evidence\/phase1\/wp2\.4\//, `Post-candidate change is outside WP2.4 evidence: ${path}`);

const recordPath = 'evidence/phase1/wp2.4/task-evidence.json';
const record = JSON.parse(await readFile(recordPath, 'utf8'));
const evidenceSchema = JSON.parse(await readFile('evidence/phase1/task-evidence.schema.json', 'utf8'));
assert.deepEqual(validateEvidence(record, evidenceSchema), [], 'WP2.4 task evidence must match the common schema');
assert.equal(record.task_id, 'REM-WP2.4');
assert.equal(record.commit, candidate, 'Task evidence must bind to the exact implementation candidate');
assert.equal(record.candidate?.implementation_commit, candidate, 'Candidate record SHA mismatch');
assert.equal(record.status.implementation, 'complete');
assert.ok(['passed', 'not_applicable'].includes(record.status.unit_test));
assert.equal(record.status.integration_test, 'passed');
assert.ok(['passed', 'not_applicable'].includes(record.status.bdd_ui_test));
assert.equal(record.status.gate_verified, preflight ? 'pending' : 'passed');
assert.equal(record.unresolved_decisions.length, 0);

const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
const taskRecords = JSON.parse(await readFile('evidence/phase1/tasks.json', 'utf8'));
for (const predecessor of graph.tasks['REM-WP2.4'].depends_on) {
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  assert.ok(match, `Unsupported WP2.4 predecessor: ${predecessor}`);
  const taskPart = Number(match[1].split('.')[0]);
  const source = taskPart === 0
    ? taskRecords.find((item) => item.task_id === predecessor)
    : JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
  assert.ok(source, `${predecessor} evidence is missing`);
  assert.equal(source.task_id, predecessor);
  assert.equal(source.status.implementation, 'complete');
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(source.status[key]), `${predecessor} ${key} is not passing`);
  }
  const predecessorSha = source.commit ?? source.candidate?.implementation_commit;
  assert.match(predecessorSha ?? '', /^[0-9a-f]{40}$/, `${predecessor} candidate SHA is absent`);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', predecessorSha, candidate], { stdio: 'ignore' }).status, 0,
    `${predecessor} candidate is not an ancestor of WP2.4`);
  for (const command of source.commands ?? []) {
    assert.equal(command.result, 'passed', `${predecessor} has failed/unrun command: ${command.command}`);
    await access(command.artifact);
  }
}

assert.ok(Array.isArray(record.commands) && record.commands.length >= 5);
for (const command of record.commands) {
  assert.equal(command.result, 'passed', `WP2.4 command is not passing: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
}

const readArtifact = async (fragment) => {
  const command = record.commands.find((item) => item.artifact.includes(fragment));
  assert.ok(command, `Required WP2.4 artifact is missing: ${fragment}`);
  return readFile(command.artifact, 'utf8');
};
const mutationLog = await readArtifact('postgres-capacity-ta-serialization.log');
for (const phrase of [
  'linearizes a capacity grant after a protected read',
  'linearizes capacity revocation after a protected read',
  'linearizes a TA-scope grant after a protected read',
  'linearizes TA-scope revocation after a protected read',
  'commits capacity grant and revoke before later protected reads',
  'commits TA-scope grant and revoke before later protected reads',
  'treats elapsed expiry as inactive without mutating source',
  'Tests  13 passed',
]) assert.ok(mutationLog.includes(phrase), `Mutation acceptance output is missing: ${phrase}`);
const lockLog = await readArtifact('postgres-authority-scope-infrastructure.log');
assert.match(lockLog, /allows concurrent protected readers and blocks a mutator until both release their FOR SHARE locks/);
assert.match(lockLog, /Tests\s+6 passed/);
const dbLog = await readArtifact('postgres-full-db-suite-with-env.log');
assert.match(dbLog, /Test Files\s+14 passed/);
assert.match(dbLog, /Tests\s+84 passed/);
const contractLog = await readArtifact('phase1-contract-verification.log');
assert.match(contractLog, /Tests\s+112 passed/);
assert.match(contractLog, /authority inventory v3|structurally valid/);
await readArtifact('typecheck.log');

const inventory = JSON.parse(await readFile('evidence/phase1/authority-dependency-inventory.json', 'utf8'));
assert.equal(inventory.version, 3);
const ta = inventory.dependencies.find((item) => item.id === 'ta-scope-delegation-and-revocation');
assert.ok(ta?.scope.includes('one persisted cooperative per command'));
assert.ok(ta?.phase1_mutation_contract.includes('no cohort or nested delegation descendants'));
assert.ok(!inventory.serialization.lock_order.includes('person/shared-identity'));

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.4 implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log('PASS exact predecessor candidates, PostgreSQL serial orders, immutable history, expiry/version behavior, and D-16 infrastructure evidence.');
if (preflight) console.log('WP2.4 gate remains pending until final exact-candidate verification.');
