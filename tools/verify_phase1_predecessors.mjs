import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
const registry = JSON.parse(await readFile('evidence/phase1/tasks.json', 'utf8'));
const checked = new Set();
const candidates = new Map();

async function evidenceFor(taskId) {
  const registered = registry.find((entry) => entry.task_id === taskId);
  if (registered) return registered;
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(taskId);
  assert.ok(match, `unsupported predecessor task ${taskId}`);
  return JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
}

async function verify(taskId) {
  if (checked.has(taskId)) return;
  checked.add(taskId);
  assert.ok(graph.tasks[taskId], `dependency graph is missing ${taskId}`);
  const evidence = await evidenceFor(taskId);
  assert.equal(evidence.task_id, taskId, `${taskId} evidence task ID mismatch`);
  assert.equal(evidence.status?.implementation, 'complete', `${taskId} implementation is incomplete`);
  for (const status of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(evidence.status?.[status]), `${taskId} ${status} is not passing`);
  }
  const candidate = evidence.commit ?? evidence.candidate?.implementation_commit;
  assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, `${taskId} evidence has no immutable candidate SHA`);
  candidates.set(taskId, candidate);
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' });
  } catch {
    assert.fail(`${taskId} candidate ${candidate} is not an ancestor of ${head}`);
  }
  for (const predecessor of graph.tasks[taskId].depends_on ?? []) await verify(predecessor);
}

for (const taskId of ['REM-WP2.2', 'REM-WP5.3']) await verify(taskId);

for (const [taskId, path] of [
  ['REM-WP2.2', 'evidence/phase1/wp2.2/closure-verification.log'],
  ['REM-WP5.3', 'evidence/phase1/wp5.3/closure-final.log'],
]) {
  const output = await readFile(path, 'utf8');
  const recorded = output.match(new RegExp(`PASS ${taskId.replace('.', '\\.')} exact candidate ([0-9a-f]{40})\\.`));
  assert.ok(recorded, `${taskId} historical final closure proof is not retained`);
  assert.equal(recorded[1], candidates.get(taskId), `${taskId} final proof SHA differs from its approved evidence record`);
}

console.log(`PASS Phase 1 predecessor records and candidate ancestry at ${head}.`);
console.log('PASS WP2.2 and WP5.3 historical exact-candidate final proofs are retained; their historical verifiers were not rerun against later commits.');
