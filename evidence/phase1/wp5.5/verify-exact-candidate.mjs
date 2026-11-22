import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidate = process.argv[2];
const preflight = process.argv.includes('--preflight');
assert.match(candidate ?? '', /^[0-9a-f]{40}$/, 'usage: node evidence/phase1/wp5.5/verify-exact-candidate.mjs <implementation-sha> [--preflight]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
assert.equal(git('status', '--porcelain'), '', 'WP5.5 exact-candidate verification requires a clean worktree');
assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0, 'WP5.5 implementation candidate must be an ancestor of evidence HEAD');
for (const changed of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
  assert.match(changed, /^(?:evidence\/phase1\/(?:wp1\.6|wp2\.5|wp5\.4|wp5\.5)\/|tools\/verify_wp2_5_scope\.mjs$|Implementation-Plan-V4\/implementation\/WP2-WP5-IMPLEMENTATION-READINESS-PLAN\.md$)/, `post-candidate change is outside the bounded Phase 1 evidence/status-verifier set: ${changed}`);
}

const evidence = JSON.parse(await readFile('evidence/phase1/wp5.5/task-evidence.json', 'utf8'));
assert.equal(evidence.task_id, 'REM-WP5.5');
assert.equal(evidence.commit, candidate);
assert.equal(evidence.candidate?.implementation_commit, candidate);
assert.equal(evidence.candidate?.status, 'immutable implementation candidate');
assert.equal(evidence.status.implementation, 'complete');
for (const key of ['unit_test', 'integration_test', 'bdd_ui_test']) assert.equal(evidence.status[key], 'passed', `${key} must pass`);
assert.equal(evidence.status.gate_verified, preflight ? 'pending' : 'passed');
assert.deepEqual(evidence.unresolved_decisions, []);
assert.match(evidence.environment.node, /26\.7/);
assert.match(evidence.environment.npm, /12\.2\.0/);
assert.match(evidence.environment.postgres, /18\.0/);

for (const predecessor of ['REM-WP5.2', 'REM-WP5.3', 'REM-WP5.4']) {
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  const record = JSON.parse(await readFile(`evidence/phase1/wp${match[1]}/task-evidence.json`, 'utf8'));
  assert.equal(record.status.gate_verified, 'passed', `${predecessor} must be gate-passed`);
  const sha = record.commit ?? record.candidate?.implementation_commit;
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', sha, candidate], { stdio: 'ignore' }).status, 0, `${predecessor} must be an ancestor of WP5.5 candidate`);
}

const bddCommand = evidence.commands.find((item) => item.command.includes('npm run test:wp5.5'));
assert.ok(bddCommand && bddCommand.result === 'passed', 'passing live WP5.5 BDD command is missing');
const { dirname } = await import('node:path');
const base = dirname(bddCommand.artifact);
const report = JSON.parse(await readFile(`${base}/bdd-enr-004.json`, 'utf8'));
const manifest = JSON.parse(await readFile('evidence/phase1/bdd-scenarios.json', 'utf8'));
const scenario = manifest.scenarios.find((item) => item.id === 'BDD-ENR-004');
assert.ok(scenario, 'BDD-ENR-004 must remain in the frozen manifest');
const { validatePhase1BddReport } = await import('../../../tools/phase1-contracts.js');
const validation = validatePhase1BddReport(report, { ...manifest, scenarios: [scenario] });
assert.deepEqual(validation, [], `WP5.5 report validation errors: ${validation.join('; ')}`);
const elements = report.flatMap((feature) => feature.elements ?? []);
const executed = elements.filter((element) => (element.tags ?? []).some((tag) => tag.name === '@BDD-ENR-004'));
assert.ok(executed.length > 0, 'BDD-ENR-004 must execute');
for (const element of executed) {
  assert.ok(element.steps?.length > 0, 'BDD-ENR-004 must have executable steps');
  assert.ok(element.steps.every((step) => step.result?.status === 'passed'), 'BDD-ENR-004 has a failed, skipped or pending step');
}
const command = await readFile(`${base}/live-bdd-command.log`, 'utf8');
assert.match(command, /1 scenario \(1 passed\)/);
assert.match(command, /15 steps \(15 passed\)/);
const apiLog = await readFile(`${base}/api-redacted.raw.log`, 'utf8');
assert.ok(apiLog.length > 0, 'WP5.5 API log must be nonempty');
const runtimeEnvironment = JSON.parse(await readFile(`${base}/runtime-environment.json`, 'utf8'));
assert.equal(runtimeEnvironment.data_mode, 'test');
const loginRegression = evidence.commands.find((item) => item.command.includes('npm run test:login'));
assert.ok(loginRegression && loginRegression.result === 'passed', 'three carried-forward Playwright login checks must pass');
const loginLog = await readFile(loginRegression.artifact, 'utf8');
assert.match(loginLog, /3 passed/);
for (const testName of [
  'validCredentials_redirectsToWorkspace',
  'invalidCredentials_showsErrorMessage',
  'temporaryCredential_promptsPasswordChange',
]) assert.ok(loginLog.includes(testName), `carried-forward login test is missing: ${testName}`);
const traceCommand = evidence.commands.find((item) => item.command.includes('npm run verify:trace'));
assert.ok(traceCommand && traceCommand.result === 'passed', 'verify:trace must pass');
const traceLog = await readFile(traceCommand.artifact, 'utf8');
assert.match(traceLog, /Traceability gate passed/);
assert.doesNotMatch(traceLog, /Traceability gate FAILED/);
for (const file of [`${base}/api-redacted.raw.log`, `${base}/runtime-environment.json`]) await access(file);
for (const item of evidence.commands) {
  assert.equal(item.result, 'passed', `unpassed WP5.5 command: ${item.command}`);
  await access(item.artifact);
}
console.log(`${preflight ? 'PREFLIGHT PASS' : 'PASS'} REM-WP5.5 exact implementation candidate ${candidate}; evidence HEAD ${head}.`);
console.log('PASS BDD-ENR-004 (15 steps), all 3 carried-forward login Playwright checks, verify:trace, report validation, and closed WP5.2/WP5.3/WP5.4 predecessors.');
if (preflight) console.log('WP5.5 gate remains pending until final exact-candidate verification.');
