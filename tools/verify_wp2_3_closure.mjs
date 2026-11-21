import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidate = process.argv.slice(2).find((value) => /^[0-9a-f]{40}$/.test(value));
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/, 'usage: node tools/verify_wp2_3_closure.mjs <implementation-commit-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP2.3 evidence checkout must be clean');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'Implementation candidate must be an ancestor of the evidence commit');

const evidenceChanges = git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean);
for (const path of evidenceChanges) assert.match(path, /^evidence\/phase1\/(?:wp2\.3|wp1\.6)\//, `Post-candidate change is outside WP2.3/WP1.6 evidence: ${path}`);

const recordPath = 'evidence/phase1/wp2.3/task-evidence.json';
const record = JSON.parse(await readFile(recordPath, 'utf8'));
assert.equal(record.task_id, 'REM-WP2.3');
assert.equal(record.commit, candidate, 'Task evidence must bind to the exact implementation candidate');
assert.equal(record.candidate?.implementation_commit, candidate, 'Candidate record SHA mismatch');
assert.equal(record.status.implementation, 'complete');
for (const key of ['unit_test', 'integration_test', 'bdd_ui_test']) assert.equal(record.status[key], 'passed', `${key} must pass before gate verification`);
assert.equal(record.status.gate_verified, preflight ? 'pending' : 'passed');
assert.equal(record.unresolved_decisions.length, 0);

const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
for (const predecessor of graph.tasks['REM-WP2.3'].depends_on) {
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  assert.ok(match, `Unsupported WP2.3 predecessor: ${predecessor}`);
  const source = `evidence/phase1/wp${match[1]}/task-evidence.json`;
  const predecessorEvidence = JSON.parse(await readFile(source, 'utf8'));
  assert.equal(predecessorEvidence.task_id, predecessor);
  assert.equal(predecessorEvidence.status.implementation, 'complete');
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(predecessorEvidence.status[key]), `${predecessor} ${key} is not passing`);
  }
  const predecessorSha = predecessorEvidence.commit ?? predecessorEvidence.candidate?.implementation_commit;
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', predecessorSha, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} candidate is not an ancestor of WP2.3`);
  for (const command of predecessorEvidence.commands ?? []) {
    assert.equal(command.result, 'passed', `${predecessor} has failed/unrun command: ${command.command}`);
    await access(command.artifact);
  }
}

assert.ok(Array.isArray(record.commands) && record.commands.length > 0);
for (const command of record.commands) {
  assert.equal(command.result, 'passed', `WP2.3 command is not passing: ${command.command}`);
  await access(command.artifact);
  git('cat-file', '-e', `${head}:${command.artifact}`);
}

const bdd = record.commands.find((item) => item.command.includes('--work-package REM-WP1.6'));
assert.ok(bdd, 'WP1.6 mapped BDD evidence is missing');
const bddRaw = await readFile(bdd.artifact, 'utf8');
assert.match(bddRaw, /All 6 selected REM-WP1\.6 scenarios were executed and passed\./);
assert.match(bddRaw, /8 scenarios \(8 passed\)/);
assert.match(bddRaw, /69 steps \(69 passed\)/);
const bddMap = JSON.parse(await readFile('evidence/phase1/bdd-work-package-map.json', 'utf8'));
const mapped = ['BDD-AUD-002', 'BDD-AUD-003', 'BDD-AUD-005', 'BDD-AUD-008', 'BDD-AUD-009', 'BDD-AUD-014'];
for (const id of mapped) {
  assert.ok(bddMap.scenarios.some((scenario) => scenario.id === id && scenario.owner_tasks.includes('REM-WP1.6')), `BDD map is missing mapped owner row ${id}`);
  const features = await readFile('features/09_commands_audit_and_integrity.feature', 'utf8');
  const scenarioText = features.split(new RegExp(`(?=\\s+@[^\\n]*@${id}\\b)`))[1]?.split(/\n\s*@[A-Za-z]/, 1)[0];
  assert.ok(scenarioText && !scenarioText.split('\n').slice(0, 1).join('').includes('@wip'), `${id} must be runnable, not @wip`);
}

console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.3 implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log(`PASS registered capacity/delegation acceptance evidence, ${record.commands.length} retained command artifacts, and direct predecessor candidates.`);
console.log(`PASS WP1.6 mapped acceptance: ${mapped.join(', ')}; 8 Cucumber scenarios and 69 steps.`);
if (preflight) console.log('WP2.3 gate remains pending until final exact-candidate verification.');
