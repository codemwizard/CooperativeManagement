import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidate = process.argv[2];
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/, 'usage: node evidence/phase1/wp2.5/verify-exact-candidate.mjs <implementation-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP2.5 exact-candidate verification requires a clean worktree');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'WP2.5 implementation candidate must be an ancestor of evidence HEAD');
for (const changed of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.match(changed, /^evidence\/phase1\/wp2\.5\//, `post-candidate change is outside WP2.5 evidence: ${changed}`);
}

const evidence = JSON.parse(await readFile('evidence/phase1/wp2.5/task-evidence.json', 'utf8'));
assert.equal(evidence.task_id, 'REM-WP2.5');
assert.equal(evidence.commit, candidate);
assert.equal(evidence.candidate?.implementation_commit, candidate);
assert.equal(evidence.status.implementation, 'complete');
for (const key of ['integration_test', 'bdd_ui_test']) assert.equal(evidence.status[key], 'passed', `${key} must pass`);
assert.equal(evidence.status.gate_verified, preflight ? 'pending' : 'passed');
assert.deepEqual(evidence.unresolved_decisions, []);

const bddCommand = evidence.commands.find((item) => item.command.includes('--work-package REM-WP2.5'));
assert.ok(bddCommand && bddCommand.result === 'passed');
const runLog = await readFile(bddCommand.artifact, 'utf8');
assert.match(runLog, /2 scenarios \(2 passed\)/);
assert.match(runLog, /22 steps \(22 passed\)/);
const base = 'evidence/phase1/wp2.5/local/2026-11-22/candidate-76bec16-clean';
const run = JSON.parse(await readFile(`${base}/run-metadata.json`, 'utf8'));
const summary = JSON.parse(await readFile(`${base}/validator-summary.json`, 'utf8'));
assert.equal(run.candidate, candidate);
assert.equal(run.work_package, 'REM-WP2.5');
assert.equal(run.worktree_clean, true);
assert.deepEqual(run.selected_scenario_ids, ['BDD-UNI-001', 'BDD-UNI-002']);
assert.equal(summary.passed, true);
assert.equal(summary.exit_code, 0);
assert.deepEqual(summary.validation_errors, []);
for (const file of [
  `${base}/default-cucumber.json`,
  `${base}/cucumber-wp25.stdout.log`,
  `${base}/cucumber-wp25.stderr.log`,
  'evidence/phase1/wp2.5/local/2026-11-22/wp25-scope-audit.log',
  'evidence/phase1/wp2.4/local/2026-11-21/postgres-capacity-ta-serialization.log',
]) await access(file);

const source = await readFile('evidence/phase1/wp1.6/local/2026-11-21/wp2.3-candidate-86feb09.mapped-runner.log', 'utf8');
for (const id of ['BDD-AUD-002', 'BDD-AUD-003', 'BDD-AUD-005', 'BDD-AUD-008', 'BDD-AUD-009', 'BDD-AUD-014']) assert.ok(source.includes(id));
assert.match(source, /8 scenarios \(8 passed\)/);
assert.match(source, /69 steps \(69 passed\)/);

const audit = spawnSync(process.execPath, ['tools/verify_wp2_5_scope.mjs'], { encoding: 'utf8' });
assert.equal(audit.status, 0, `${audit.stdout}\n${audit.stderr}`);
console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.5 exact implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log('PASS clean-candidate direct-cooperative BDD (2 scenarios, 22 steps), scope/traceability audit, WP1.6 mapped HTTP evidence, and WP2.4 serialization evidence.');
if (preflight) console.log('WP2.5 gate remains pending until final exact-candidate verification.');
