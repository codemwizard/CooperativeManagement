import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const suppliedCandidate = process.argv.slice(2).find((value) => /^[0-9a-f]{40}$/i.test(value));
const preflight = process.argv.includes('--preflight');
const evidencePath = 'evidence/phase1/wp2.6/task-evidence.json';
const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const candidate = suppliedCandidate ?? evidence.commit;
assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, 'usage: node tools/verify_wp2_6_closure.mjs <implementation-candidate-sha> [--preflight]');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'implementation candidate must be an ancestor of evidence HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP2.6 evidence worktree must be clean');
for (const changedPath of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.ok(changedPath.startsWith('evidence/phase1/wp2.6/'), `post-candidate change is outside WP2.6 evidence: ${changedPath}`);
}

const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
const records = JSON.parse(await readFile('evidence/phase1/tasks.json', 'utf8'));
assert.deepEqual(graph.tasks['REM-WP2.6']?.depends_on, ['REM-WP0.4', 'REM-WP2.1', 'REM-WP2.2'], 'WP2.6 dependency graph differs from the approved entry criteria');
assert.equal(evidence.task_id, 'REM-WP2.6');
assert.equal(evidence.commit, candidate, 'WP2.6 evidence must pin the implementation candidate SHA');
assert.equal(evidence.status?.implementation, 'complete');
assert.equal(evidence.status?.unit_test, 'passed');
assert.equal(evidence.status?.integration_test, 'passed');
assert.equal(evidence.status?.bdd_ui_test, 'not_applicable');
assert.equal(evidence.status?.gate_verified, preflight ? 'pending' : 'passed', 'WP2.6 gate status does not match verifier mode');
assert.deepEqual(evidence.unresolved_decisions, []);
assert.match(evidence.environment?.npm ?? '', /12\.2\.0/);
assert.match(evidence.environment?.postgres ?? '', /PostgreSQL 18/i);
assert.equal(evidence.environment?.data_mode, 'test');

async function recordFor(taskId) {
  const registered = records.find((record) => record.task_id === taskId);
  if (registered) return registered;
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(taskId);
  assert.ok(match, `unsupported predecessor ID ${taskId}`);
  return JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
}

for (const predecessor of graph.tasks['REM-WP2.6'].depends_on) {
  const record = await recordFor(predecessor);
  assert.equal(record.task_id, predecessor, `${predecessor} task evidence ID mismatch`);
  assert.equal(record.status?.implementation, 'complete', `${predecessor} implementation is incomplete`);
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(record.status?.[key]), `${predecessor} ${key} is not passing`);
  }
  assert.match(record.commit ?? '', /^[0-9a-f]{40}$/i, `${predecessor} evidence has no immutable commit`);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', record.commit, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} candidate is not an ancestor of WP2.6 candidate`);
  assert.equal(evidence.claims?.predecessors?.[predecessor]?.result, 'passed', `${predecessor} pass is not reconciled in WP2.6 evidence`);
}

const sourcePaths = [
  'migrations/0019_authority_scope_versions.sql',
  'migrations/0020_authority_scope_frozen_lock_policy.sql',
  'packages/db/src/repositories/postgres-authority-scope-locks.ts',
  'packages/db/src/repositories/postgres-authority-scope-readiness.ts',
  'packages/db/src/__tests__/postgres-authority-scope-locks.integration.test.ts',
];
for (const sourcePath of sourcePaths) git('cat-file', '-e', `${candidate}:${sourcePath}`);

const commandArtifacts = new Map();
for (const command of evidence.commands ?? []) {
  assert.equal(command.result, 'passed', `non-passing WP2.6 command: ${command.command}`);
  assert.ok(command.artifact, `command has no retained output: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
  commandArtifacts.set(command.command, await readFile(command.artifact, 'utf8'));
}

function artifactMatching(pattern, message) {
  const item = [...commandArtifacts.entries()].find(([command]) => pattern.test(command));
  assert.ok(item, message);
  return item[1];
}

assert.match(artifactMatching(/migration.*apply|db:migrate/i, 'migration application output is missing'), /0019_authority_scope_versions\.sql[\s\S]*0019_authority_scope_versions\.sql|0019_authority_scope_versions\.sql[\s\S]*0020_authority_scope_frozen_lock_policy\.sql|No new migrations to apply/i);
assert.match(artifactMatching(/test:db:migrations|migration.*suite/i, 'PostgreSQL migration suite output is missing'), /Tests\s+17 passed/);
assert.match(artifactMatching(/test:db\b|postgres.*database suite/i, 'PostgreSQL database suite output is missing'), /Test Files\s+13 passed[\s\S]*Tests\s+71 passed/);
assert.match(commandArtifacts.get('npm run verify:phase1:contracts'), /112 tests[\s\S]*10 canonical\/runnable Phase 1 feature pairs[\s\S]*46 task nodes/);
assert.match(commandArtifacts.get('npm run typecheck:v4'), /typecheck/);

const localEvidence = 'evidence/phase1/wp2.6/local/2026-11-20/working-tree-verification.json';
const verification = JSON.parse(await readFile(localEvidence, 'utf8'));
assert.equal(verification.candidate_commit, candidate, 'local evidence manifest must identify exact candidate');
assert.equal(verification.working_tree_base_commit, git('rev-parse', `${candidate}^`));
assert.equal(verification.working_tree_dirty, true, 'the local run must disclose it was captured before candidate commit');
for (const [name, expectedHash] of Object.entries(verification.artifacts_sha256 ?? {})) {
  const actual = await readFile(`evidence/phase1/wp2.6/local/2026-11-20/${name}`);
  assert.equal(createHash('sha256').update(actual).digest('hex'), expectedHash.toLowerCase(), `${name} SHA-256 differs from local manifest`);
}

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.6 exact implementation candidate ${candidate}.`);
console.log('PASS predecessor gate evidence and ancestry, D-16 migrations/lock-service source, PostgreSQL 18 runtime-role evidence, retained artifact hashes, and bounded infrastructure-only scope.');
if (preflight) console.log('WP2.6 gate remains pending until final exact-candidate verification is recorded.');
