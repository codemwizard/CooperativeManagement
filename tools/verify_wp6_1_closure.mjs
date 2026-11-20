import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidate = process.argv[2];
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, 'usage: node tools/verify_wp6_1_closure.mjs <candidate-sha> [--preflight]');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
try {
  git('merge-base', '--is-ancestor', candidate, head);
} catch {
  assert.fail('WP6.1 candidate must be an ancestor of evidence HEAD');
}
assert.equal(git('status', '--porcelain'), '', 'candidate worktree must be clean');
const postCandidatePaths = git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean);
for (const changedPath of postCandidatePaths) {
  assert.ok(/^evidence\/phase1\/wp6\.1\//.test(changedPath), `post-candidate change is outside WP6.1 evidence: ${changedPath}`);
}

const [graph, registry, mapping, manifest, evidence] = await Promise.all([
  readFile('evidence/phase1/task-dependencies.yml', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/tasks.json', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/bdd-work-package-map.json', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/bdd-scenarios.json', 'utf8').then(JSON.parse),
  readFile('evidence/phase1/wp6.1/task-evidence.json', 'utf8').then(JSON.parse),
]);
const taskById = new Map(registry.map((record) => [record.task_id, record]));

async function recordFor(taskId) {
  const registryRecord = taskById.get(taskId);
  if (registryRecord) return registryRecord;
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(taskId);
  assert.ok(match, `unsupported task ID ${taskId}`);
  return readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8').then(JSON.parse);
}

const checked = new Set();
async function verifyPredecessor(taskId) {
  if (checked.has(taskId)) return;
  checked.add(taskId);
  const definition = graph.tasks[taskId];
  assert.ok(definition, `dependency graph has no ${taskId}`);
  const record = await recordFor(taskId);
  assert.equal(record.task_id, taskId, `${taskId} evidence ID mismatch`);
  assert.equal(record.status?.implementation, 'complete', `${taskId} implementation is not complete`);
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(record.status?.[key]), `${taskId} ${key} is not passing`);
  }
  assert.match(record.commit ?? record.candidate?.implementation_commit ?? '', /^[0-9a-f]{40}$/i, `${taskId} has no immutable implementation SHA`);
  const commit = record.commit ?? record.candidate.implementation_commit;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, candidate], { stdio: 'ignore' });
  } catch {
    assert.fail(`${taskId} implementation is not an ancestor of candidate`);
  }
  for (const predecessor of definition.depends_on ?? []) await verifyPredecessor(predecessor);
}

assert.equal(evidence.task_id, 'REM-WP6.1');
assert.equal(evidence.commit, candidate, 'WP6.1 evidence must pin the exact candidate SHA');
assert.equal(evidence.status?.implementation, 'complete', 'WP6.1 implementation is not complete');
for (const key of ['unit_test', 'integration_test', 'bdd_ui_test']) {
  assert.equal(evidence.status?.[key], 'passed', `WP6.1 ${key} is not passed`);
}
assert.equal(evidence.status?.gate_verified, preflight ? 'pending' : 'passed', 'WP6.1 gate status does not match verifier mode');
assert.deepEqual(evidence.unresolved_decisions ?? [], [], 'WP6.1 has unresolved decisions');

for (const predecessor of ['REM-WP0.9', 'REM-WP2.2', 'REM-WP5.3']) {
  assert.ok(graph.tasks['REM-WP6.1'].depends_on.includes(predecessor), `WP6.1 graph is missing mandatory predecessor ${predecessor}`);
  await verifyPredecessor(predecessor);
}

const activeIds = ['BDD-UXW-001', 'BDD-UXW-002', 'BDD-UXW-003', 'BDD-UXW-004'];
const feature = await readFile('features/10_workspace_and_capabilities.feature', 'utf8');
const featureLines = feature.split(/\r?\n/);
for (const id of activeIds) {
  const owner = mapping.scenarios.find((scenario) => scenario.id === id);
  assert.deepEqual(owner?.owner_tasks, ['REM-WP6.1'], `${id} ownership differs from the frozen owner map`);
  const manifestEntry = manifest.scenarios.find((scenario) => scenario.id === id);
  assert.ok(manifestEntry, `${id} missing from frozen scenario manifest`);
  assert.ok(feature.includes(`@${id}`), `${id} missing from Feature 10`);
  const tagIndex = featureLines.findIndex((line) => line.includes(`@${id}`));
  const scenarioIndex = featureLines.findIndex((line, index) => index > tagIndex && /^\s*Scenario(?: Outline)?:/.test(line));
  assert.ok(tagIndex >= 0 && scenarioIndex > tagIndex, `${id} has no scenario declaration`);
  assert.ok(!featureLines.slice(tagIndex, scenarioIndex).some((line) => /@wip\b/.test(line)), `${id} is marked @wip`);
}
assert.deepEqual(mapping.scenarios.find((scenario) => scenario.id === 'BDD-UXW-015')?.owner_tasks, ['REM-WP6.3'], 'UXW-015 must remain owned by WP6.3');

const commandEvidence = evidence.commands ?? [];
for (const command of commandEvidence) {
  assert.equal(command.result, 'passed', `non-passing WP6.1 command: ${command.command}`);
  assert.ok(typeof command.artifact === 'string' && command.artifact.length > 0, `command has no retained raw artifact: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
}
const bddArtifact = commandEvidence.find((command) => /live.*bdd|bdd.*live/i.test(command.command));
assert.ok(bddArtifact, 'live Cucumber browser/API/PostgreSQL command evidence is missing');
const cucumberReport = JSON.parse(await readFile(bddArtifact.artifact, 'utf8'));
const elements = cucumberReport.flatMap((entry) => entry.elements ?? []);
for (const id of activeIds) {
  const scenarios = elements.filter((element) => (element.tags ?? []).some((tag) => tag.name === `@${id}`));
  assert.ok(scenarios.length > 0, `${id} has no executed Cucumber examples`);
  for (const scenario of scenarios) {
    assert.ok((scenario.steps ?? []).length > 0, `${id} has zero executable steps`);
    assert.ok(!(scenario.tags ?? []).some((tag) => tag.name === '@wip'), `${id} ran as @wip`);
    assert.ok(scenario.steps.every((step) => step.result?.status === 'passed'), `${id} has a skipped, pending or failed step`);
  }
}

assert.ok(Array.isArray(evidence.claims?.route_inventory) && evidence.claims.route_inventory.length > 0, 'explicit nonempty browser route inventory is required under claims.route_inventory');
for (const required of ['node', 'npm', 'postgres', 'database_role', 'data_mode']) {
  assert.ok(typeof evidence.environment?.[required] === 'string' && evidence.environment[required].length > 0, `environment.${required} is missing`);
}
assert.match(evidence.environment.node, /26\.7/);
assert.match(evidence.environment.npm, /12\.2/);
assert.match(evidence.environment.postgres, /18/);
assert.match(evidence.environment.database_role, /app.role/i);
assert.equal(evidence.environment.data_mode, 'test');

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP6.1 exact candidate ${candidate}.`);
console.log(`PASS mandatory predecessor gates, frozen ownership, active live browser BDD (${activeIds.join(', ')}), candidate-bound artifacts, and toolchain/database evidence.`);
if (preflight) console.log('WP6.1 gate remains pending until final exact-candidate verification is recorded.');
