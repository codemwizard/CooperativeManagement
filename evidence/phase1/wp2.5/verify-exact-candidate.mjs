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
  assert.match(changed, /^(?:evidence\/phase1\/(?:wp1\.6|wp2\.5|wp5\.4|wp5\.5)\/|tools\/verify_wp2_5_scope\.mjs$|Implementation-Plan-V4\/implementation\/WP2-WP5-IMPLEMENTATION-READINESS-PLAN\.md$)/, `post-candidate change is outside the bounded Phase 1 evidence/status-verifier set: ${changed}`);
}

const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
for (const predecessor of graph.tasks['REM-WP2.5'].depends_on) {
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  assert.ok(match, `unsupported WP2.5 predecessor ${predecessor}`);
  const record = JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
  assert.equal(record.task_id, predecessor);
  assert.equal(record.status.implementation, 'complete', `${predecessor} implementation must be complete`);
  assert.equal(record.status.gate_verified, 'passed', `${predecessor} gate must be passed`);
  const predecessorSha = record.commit ?? record.candidate?.implementation_commit;
  assert.match(predecessorSha ?? '', /^[0-9a-f]{40}$/);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', predecessorSha, candidate], { stdio: 'ignore' }).status, 0,
    `${predecessor} candidate must be an ancestor of the WP2.5 implementation candidate`);
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
const { dirname } = await import('node:path');
const base = dirname(bddCommand.artifact);
const run = JSON.parse(await readFile(`${base}/run-metadata.json`, 'utf8'));
const summary = JSON.parse(await readFile(`${base}/validator-summary.json`, 'utf8'));
assert.equal(run.candidate, candidate);
assert.equal(run.work_package, 'REM-WP2.5');
assert.equal(run.worktree_clean, true);
assert.deepEqual(run.selected_scenario_ids, ['BDD-UNI-001', 'BDD-UNI-002']);
assert.equal(summary.passed, true);
assert.equal(summary.exit_code, 0);
assert.deepEqual(summary.validation_errors, []);
const report = JSON.parse(await readFile(`${base}/default-cucumber.json`, 'utf8'));
const manifest = JSON.parse(await readFile('evidence/phase1/bdd-scenarios.json', 'utf8'));
const selectedScenarios = manifest.scenarios.filter((scenario) => run.selected_scenario_ids.includes(scenario.id));
const { validatePhase1BddReport } = await import('../../../tools/phase1-contracts.js');
const reportErrors = validatePhase1BddReport(report, { ...manifest, scenarios: selectedScenarios });
assert.deepEqual(reportErrors, [], `WP2.5 raw Cucumber report errors: ${reportErrors.join('; ')}`);
for (const file of [
  `${base}/default-cucumber.json`,
  `${base}/cucumber-wp25.stdout.log`,
  `${base}/cucumber-wp25.stderr.log`,
  'evidence/phase1/wp2.5/local/2026-11-22/wp25-scope-audit.log',
  'evidence/phase1/wp2.4/local/2026-11-21/postgres-capacity-ta-serialization.log',
]) await access(file);

const wp16Evidence = JSON.parse(await readFile('evidence/phase1/wp1.6/task-evidence.json', 'utf8'));
const wp16RunCommand = wp16Evidence.commands.find((item) => item.command.includes('--work-package REM-WP1.6'));
assert.ok(wp16RunCommand && wp16RunCommand.result === 'passed', 'WP1.6 must retain its own passing mapped HTTP acceptance');
const source = await readFile(wp16RunCommand.artifact, 'utf8');
assert.match(source, /8 scenarios \(8 passed\)/);
assert.match(source, /69 steps \(69 passed\)/);
const wp16RunDirectory = dirname(wp16RunCommand.artifact);
const wp16Metadata = JSON.parse(await readFile(`${wp16RunDirectory}/run-metadata.json`, 'utf8'));
assert.equal(wp16Metadata.candidate, wp16Evidence.commit);
assert.equal(wp16Metadata.work_package, 'REM-WP1.6');
assert.equal(wp16Metadata.worktree_clean, true);
assert.deepEqual(wp16Metadata.selected_scenario_ids, [
  'BDD-AUD-002', 'BDD-AUD-003', 'BDD-AUD-005', 'BDD-AUD-008', 'BDD-AUD-009', 'BDD-AUD-014',
]);

const audit = spawnSync(process.execPath, ['tools/verify_wp2_5_scope.mjs', candidate], { encoding: 'utf8' });
assert.equal(audit.status, 0, `${audit.stdout}\n${audit.stderr}`);
console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP2.5 exact implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log('PASS clean-candidate direct-cooperative BDD (2 scenarios, 22 steps), scope/traceability audit, WP1.6 mapped HTTP evidence, and WP2.4 serialization evidence.');
if (preflight) console.log('WP2.5 gate remains pending until final exact-candidate verification.');
