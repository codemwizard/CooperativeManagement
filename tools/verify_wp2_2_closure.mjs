import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const suppliedCandidate = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const preflight = process.argv.includes('--preflight');
const candidate = suppliedCandidate ?? await readFile('evidence/phase1/wp2.2/task-evidence.json', 'utf8').then(JSON.parse).then((record) => record.commit);
assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, 'usage: node tools/verify_wp2_2_closure.mjs <candidate-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'candidate must be an ancestor of evidence HEAD');
assert.equal(git('status', '--porcelain'), '', 'candidate evidence worktree must be clean');
for (const path of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.ok(path.startsWith('evidence/phase1/wp2.2/'), `post-candidate change is outside WP2.2 evidence: ${path}`);
}

const [graph, evidence] = await Promise.all([
  readFile('evidence/phase1/task-dependencies.yml', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/wp2.2/task-evidence.json', 'utf8').then(JSON.parse),
]);
assert.equal(evidence.task_id, 'REM-WP2.2');
assert.equal(evidence.commit, candidate, 'WP2.2 record must bind to the exact implementation candidate');
assert.equal(evidence.status.implementation, 'complete');
assert.equal(evidence.status.unit_test, 'not_applicable');
assert.equal(evidence.status.integration_test, 'passed');
assert.equal(evidence.status.bdd_ui_test, 'not_applicable');
assert.equal(evidence.status.gate_verified, preflight ? 'pending' : 'passed');
assert.match(evidence.environment?.npm ?? '', /12\.2\.0/, 'WP2.2 candidate evidence must use project-pinned npm 12.2.0');
assert.deepEqual(evidence.unresolved_decisions, []);
assert.deepEqual(graph.tasks['REM-WP2.2'].depends_on, ['REM-WP1.1', 'REM-WP1.2', 'REM-WP1.5', 'REM-WP2.1']);

async function recordFor(taskId) {
  if (taskId === 'REM-WP1.2') return readFile('evidence/phase1/wp1.2/task-evidence.json', 'utf8').then(JSON.parse);
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(taskId);
  assert.ok(match, `unsupported dependency ${taskId}`);
  const path = `evidence/phase1/wp${match[1]}/task-evidence.json`;
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return (await readFile('evidence/phase1/tasks.json', 'utf8').then(JSON.parse)).find((record) => record.task_id === taskId); }
}

for (const predecessor of graph.tasks['REM-WP2.2'].depends_on) {
  const record = await recordFor(predecessor);
  assert.ok(record, `${predecessor} evidence record is missing`);
  assert.equal(record.status.implementation, 'complete', `${predecessor} implementation is incomplete`);
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(record.status[key]), `${predecessor} ${key} is not passing`);
  }
  assert.match(record.commit ?? '', /^[0-9a-f]{40}$/i, `${predecessor} evidence is not bound to an immutable commit`);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', record.commit, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} implementation is not an ancestor of candidate`);
}

const requiredPaths = [
  'migrations/0016_trusted_authority_context.sql',
  'packages/db/src/repositories/postgres-workspace-context-repository.ts',
  'packages/contracts/src/workspace-context.ts',
  'apps/api/src/routes/workspace-context.ts',
  'evidence/phase1/wp2.2/trusted-authority-contract.md',
  'evidence/phase1/wp2.2/trusted-authority-dto.schema.json',
];
for (const path of requiredPaths) git('cat-file', '-e', `${candidate}:${path}`);

for (const command of evidence.commands) {
  assert.equal(command.result, 'passed', `non-passing WP2.2 command: ${command.command}`);
  assert.ok(command.artifact, `WP2.2 command lacks raw evidence: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
}
const raw = async (name) => readFile(`evidence/phase1/wp2.2/${name}`, 'utf8');
assert.match(await raw('api-integration.log'), /25 passed/);
assert.match(await raw('api-integration.log'), /\/workspace\/context/);
assert.match(await raw('postgres-migration.log'), /17 passed/);
assert.match(await raw('tenant-rls.log'), /5 passed/);
assert.match(await raw('tenant-rls.log'), /all 44 PostgreSQL tenant policy expressions/i);
assert.match(await raw('typecheck.log'), /typecheck:v4/);
assert.match(await raw('architecture.log'), /No dependency violations|No dependency violations found|No dependency violations\b/i);

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.2 exact candidate ${candidate}.`);
console.log(`PASS persisted identity/authority contract, app-role API resolution, 44-table RLS inventory, and immutable predecessor evidence.`);
if (preflight) console.log('WP2.2 gate remains pending until final exact-candidate verification is recorded.');
