import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const preflight = process.argv.includes('--preflight');
const supplied = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const evidence = await readFile('evidence/phase1/wp5.3/task-evidence.json', 'utf8').then(JSON.parse);
const candidate = supplied ?? evidence.commit;
assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, 'usage: node tools/verify_wp5_3_closure.mjs <candidate-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'candidate must be an ancestor of evidence HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP5.3 candidate worktree must be clean');
for (const path of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.ok(path.startsWith('evidence/phase1/wp5.3/'), `post-candidate change is outside WP5.3 evidence: ${path}`);
}

assert.equal(evidence.task_id, 'REM-WP5.3');
assert.equal(evidence.commit, candidate, 'WP5.3 evidence must bind to the exact candidate');
assert.equal(evidence.status.implementation, 'complete');
assert.equal(evidence.status.unit_test, 'passed');
assert.equal(evidence.status.integration_test, 'passed');
assert.equal(evidence.status.bdd_ui_test, 'not_applicable');
assert.equal(evidence.status.gate_verified, preflight ? 'pending' : 'passed');
assert.match(evidence.environment?.npm ?? '', /12\.2\.0/, 'WP5.3 candidate evidence must use project-pinned npm 12.2.0');
assert.deepEqual(evidence.unresolved_decisions, []);

const [graph, wp52] = await Promise.all([
  readFile('evidence/phase1/task-dependencies.yml', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/wp5.2/task-evidence.json', 'utf8').then(JSON.parse),
]);
assert.deepEqual(graph.tasks['REM-WP5.3'].depends_on, ['REM-WP0.10', 'REM-WP5.2']);
assert.equal(wp52.task_id, 'REM-WP5.2');
assert.equal(wp52.status.gate_verified, 'passed');
for (const predecessor of graph.tasks['REM-WP5.3'].depends_on) {
  let record = predecessor === 'REM-WP5.2' ? wp52 : undefined;
  if (!record) {
    const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
    assert.ok(match, `unsupported predecessor ${predecessor}`);
    try { record = JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8')); }
    catch { record = (await readFile('evidence/phase1/tasks.json', 'utf8').then(JSON.parse)).find((item) => item.task_id === predecessor); }
  }
  assert.ok(record, `${predecessor} evidence is missing`);
  assert.equal(record.status.implementation, 'complete');
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(record.status[key]), `${predecessor} ${key} is not passing`);
  }
  assert.match(record.commit ?? '', /^[0-9a-f]{40}$/i, `${predecessor} must use an immutable SHA`);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', record.commit, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} implementation is not an ancestor of candidate`);
}

for (const path of [
  'migrations/0015_auth_sessions_and_throttling.sql',
  'packages/db/src/repositories/postgres-auth-session-repository.ts',
  'apps/api/src/authentication-composition.ts',
  'apps/api/src/routes/auth.ts',
]) git('cat-file', '-e', `${candidate}:${path}`);
for (const command of evidence.commands) {
  assert.equal(command.result, 'passed', `non-passing WP5.3 command: ${command.command}`);
  assert.ok(command.artifact, `WP5.3 command lacks raw output: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
}
const raw = async (name) => readFile(`evidence/phase1/wp5.3/${name}`, 'utf8');
assert.match(await raw('api-tests.log'), /25 passed/);
assert.match(await raw('api-tests.log'), /WP5\.3 Fastify and PostgreSQL integration/);
assert.match(await raw('postgres-migration-tests.log'), /17 passed/);
assert.match(await raw('typecheck-v4.log'), /typecheck:v4/);
assert.match(await raw('architecture-check.log'), /no dependency violations found/i);
assert.match(await raw('phase1-contracts.log'), /112 tests/);
assert.equal((await raw('diff-check.log')).trim(), '', 'git diff --check must have no whitespace errors');

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP5.3 exact candidate ${candidate}.`);
console.log('PASS persisted-session API/database evidence, current WP5.2/WP0.10 predecessors, retained raw artifacts, and bounded deferred follow-ups.');
if (preflight) console.log('WP5.3 gate remains pending until final exact-candidate verification is recorded.');
