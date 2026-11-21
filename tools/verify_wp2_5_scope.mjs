import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), 'utf8');
const readJson = async (relativePath) => JSON.parse(await read(relativePath));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('rev-parse', 'HEAD');
const candidate = process.argv.slice(2).find((value) => /^[0-9a-f]{40}$/.test(value));

const expected = new Map([
  ['BDD-UNI-001', ['REM-WP2.2', 'REM-WP2.3']],
  ['BDD-UNI-002', ['REM-WP2.3', 'REM-WP2.4']],
  ['BDD-AUD-002', ['REM-WP2.3', 'REM-WP1.6']],
  ['BDD-AUD-003', ['REM-WP2.3', 'REM-WP1.6']],
  ['BDD-AUD-005', ['REM-WP2.2', 'REM-WP2.3', 'REM-WP1.6']],
  ['BDD-AUD-008', ['REM-WP2.1', 'REM-WP2.2', 'REM-WP2.3', 'REM-WP1.6']],
  ['BDD-AUD-009', ['REM-WP2.1', 'REM-WP2.2', 'REM-WP2.3', 'REM-WP1.6']],
  ['BDD-AUD-014', ['REM-WP2.1', 'REM-WP2.2', 'REM-WP1.6']],
]);
const failures = [];
const fail = (message) => failures.push(message);

if (candidate) {
  assert.equal(git('status', '--porcelain'), '', 'Exact-candidate verification requires a clean evidence worktree');
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', candidate, head], { stdio: 'ignore' }).status, 0,
    'Implementation candidate must be an ancestor of the evidence HEAD');
  for (const file of git('diff', '--name-only', `${candidate}..${head}`).split(/\r?\n/).filter(Boolean)) {
    assert.match(file, /^evidence\/phase1\/wp2\.5\//, `Post-candidate change is outside WP2.5 evidence: ${file}`);
  }
}

const graph = await readJson('evidence/phase1/task-dependencies.yml');
const manifest = await readJson('evidence/phase1/bdd-scenarios.json');
const map = await readJson('evidence/phase1/bdd-work-package-map.json');
const traceability = await read('Implementation-Plan-V4/traceability-matrix.md');
const d19 = await read('Implementation-Plan-V4/02-decision-register.md');
const manifestIds = new Set(manifest.scenarios.map((scenario) => scenario.id));
const mapRows = new Map(map.scenarios.map((scenario) => [scenario.id, scenario]));
const tasks = graph.tasks['REM-WP2.5'];
assert.ok(tasks, 'Dependency graph does not declare REM-WP2.5');

for (const [id, requiredOwners] of expected) {
  const frozen = manifest.scenarios.find((scenario) => scenario.id === id);
  const mapped = mapRows.get(id);
  if (!manifestIds.has(id) || !frozen) fail(`${id}: missing from the frozen Phase 1 BDD inventory`);
  if (!mapped) {
    fail(`${id}: missing from the BDD work-package map`);
    continue;
  }
  if (mapped.feature !== frozen?.feature) fail(`${id}: feature path differs between manifest and work-package map`);
  if (id.startsWith('BDD-UNI-')
      && (!frozen?.proves?.toLowerCase().includes('cooperative') || !mapped.scenario.toLowerCase().includes('cooperative'))) {
    fail(`${id}: manifest proof statement or owner-map title is missing the direct cooperative scope`);
  }
  const scenarioCode = id.replace(/^BDD-/, '');
  const traced = mapped.requirements.some((requirement) => {
    const requirementCode = requirement.replace(/^REQ-/, '');
    const row = traceability.split(/\r?\n/).find((line) => line.startsWith(`| ${requirementCode} |`));
    return row?.split('|')[2]?.split(',').some((entry) => entry.trim() === scenarioCode) ?? false;
  });
  if (!traced) fail(`${id}: requirement/scenario pair is absent from Implementation-Plan-V4/traceability-matrix.md`);
  for (const owner of requiredOwners) {
    if (!mapped.owner_tasks.includes(owner)) fail(`${id}: missing required owner ${owner}`);
  }

  const source = await read(mapped.feature);
  const lines = source.split(/\r?\n/);
  const tagLineIndex = lines.findIndex((line) => line.trimStart().startsWith('@') && new RegExp(`@${id}(?:\\s|$)`).test(line));
  if (tagLineIndex < 0) {
    fail(`${id}: no tagged runnable feature scenario in ${mapped.feature}`);
    continue;
  }
  const tagLine = lines[tagLineIndex];
  if (/@wip\b/.test(tagLine)) fail(`${id}: frozen Phase 1 scenario remains @wip`);
  if (tagLineIndex + 1 >= lines.length || !/^\s*Scenario(?: Outline)?:/.test(lines[tagLineIndex + 1])) {
    fail(`${id}: identifier tag is not attached to a scenario declaration`);
  } else if (lines[tagLineIndex + 1].replace(/^\s*Scenario(?: Outline)?:\s*/, '') !== mapped.scenario) {
    fail(`${id}: feature scenario title does not match the owner-map title`);
  }
  const nextTag = lines.findIndex((line, index) => index > tagLineIndex + 1 && line.trimStart().startsWith('@'));
  const scenarioBody = lines.slice(tagLineIndex, nextTag < 0 ? lines.length : nextTag).join('\n');
  if (/cohort/i.test(scenarioBody)) fail(`${id}: scenario retains superseded cohort wording instead of D-19 direct cooperative scope`);
}

if (!d19.includes('BDD-UNI-001 and BDD-UNI-002 remain in the frozen Phase 1 acceptance set')) {
  fail('D-19: decision register does not record that both frozen Union TA acceptance IDs remain in Phase 1 under direct cooperative scope');
}

const wp23 = await readJson('evidence/phase1/wp2.3/task-evidence.json');
const wp16Run = wp23.commands.find((command) => command.command.includes('--work-package REM-WP1.6'));
if (!wp16Run || wp16Run.result !== 'passed') fail('REM-WP1.6: WP2.3 evidence does not contain a passing mapped BDD runner result');
else {
  const log = await read(wp16Run.artifact);
  for (const required of [
    'Candidate: 86feb09f334f8c6374ea364850631b8eccbafc5a',
    'BDD-AUD-002, BDD-AUD-003, BDD-AUD-005, BDD-AUD-008, BDD-AUD-009, BDD-AUD-014',
    '8 scenarios (8 passed)',
    '69 steps (69 passed)',
    'All 6 selected REM-WP1.6 scenarios were executed and passed.',
  ]) if (!log.includes(required)) fail(`REM-WP1.6: retained mapped runner artifact is missing expected evidence: ${required}`);
  const candidateMatch = /Candidate: ([0-9a-f]{40})/.exec(log);
  if (!candidateMatch || spawnSync('git', ['merge-base', '--is-ancestor', candidateMatch[1], head], { stdio: 'ignore' }).status !== 0) {
    fail('REM-WP1.6: mapped scenario evidence candidate is missing or is not an ancestor of current HEAD');
  }
}

const wp25Evidence = await readJson('evidence/phase1/wp2.5/task-evidence.json');
if (wp25Evidence.task_id !== 'REM-WP2.5') fail('WP2.5 task evidence has an unexpected task ID');
const wp25Bdd = wp25Evidence.commands.find((command) => command.command.includes('--work-package REM-WP2.5'));
if (!wp25Bdd || wp25Bdd.result !== 'passed') fail('WP2.5: passing mapped BDD-UNI-001/002 run is missing from task evidence');
else {
  const runLog = await read(wp25Bdd.artifact);
  for (const expectedText of [
    '2 scenarios (2 passed)',
    '22 steps (22 passed)',
  ]) if (!runLog.includes(expectedText)) fail(`WP2.5 mapped run artifact is missing: ${expectedText}`);
  const validatorPath = 'evidence/phase1/wp2.5/local/2026-11-21/wp25-validator-summary.json';
  const validator = await readJson(validatorPath);
  if (validator.work_package !== 'REM-WP2.5'
      || validator.selected_scenario_ids?.join(',') !== 'BDD-UNI-001,BDD-UNI-002'
      || validator.passed !== true
      || validator.exit_code !== 0
      || validator.validation_errors?.length !== 0) {
    fail('WP2.5 runner validator summary does not prove both mapped scenarios passed without validation errors');
  }
}

const wp24Evidence = await readJson('evidence/phase1/wp2.4/task-evidence.json');
const wp24Race = wp24Evidence.commands.find((command) => command.artifact.endsWith('postgres-capacity-ta-serialization.log'));
if (!wp24Race || wp24Race.result !== 'passed') fail('REM-WP2.4: retained PostgreSQL TA scope serialization evidence is missing');
else {
  const raceLog = await read(wp24Race.artifact);
  for (const phrase of [
    'linearizes a TA-scope grant after a protected read',
    'linearizes TA-scope revocation after a protected read',
    'commits TA-scope grant and revoke before later protected reads',
    'Tests  13 passed',
  ]) if (!raceLog.includes(phrase)) fail(`REM-WP2.4: both serial orders and immutable mutation tests are not demonstrated: ${phrase}`);
}

for (const predecessor of tasks.depends_on) {
  if (predecessor === 'REM-WP1.6') continue;
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(predecessor);
  if (!match) {
    fail(`Unsupported WP2.5 predecessor ${predecessor}`);
    continue;
  }
  const evidence = await readJson(`evidence/phase1/wp${match[1]}/task-evidence.json`);
  if (evidence.task_id !== predecessor) fail(`${predecessor}: evidence task ID mismatch`);
  for (const key of ['implementation', 'unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    const accepted = key === 'implementation' ? ['complete'] : ['passed', 'not_applicable'];
    if (!accepted.includes(evidence.status?.[key])) fail(`${predecessor}: ${key} is ${evidence.status?.[key] ?? 'missing'}`);
  }
  const sha = evidence.commit ?? evidence.candidate?.implementation_commit;
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || spawnSync('git', ['merge-base', '--is-ancestor', sha, head], { stdio: 'ignore' }).status !== 0) {
    fail(`${predecessor}: passing candidate is absent or is not an ancestor of current HEAD`);
  }
  for (const command of evidence.commands ?? []) {
    if (command.result !== 'passed') {
      const expectedRed = predecessor === 'REM-WP2.1'
        && command.command.includes('expected test-first red before production implementation')
        && command.artifact.endsWith('red-policy-default-allow.log');
      if (expectedRed) {
        const redLog = await read(command.artifact);
        if (!redLog.includes("expected 'allow' to be 'deny'")) fail(`${predecessor}: documented test-first red artifact is malformed`);
      } else fail(`${predecessor}: retained command is not passing: ${command.command}`);
    }
    try { await access(new URL(command.artifact, root)); }
    catch { fail(`${predecessor}: missing evidence artifact ${command.artifact}`); }
  }
}

if (failures.length) {
  console.error(`FAIL REM-WP2.5 scope audit at ${head}`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('No frozen scenario was removed, retagged, or silently re-scoped.');
  process.exitCode = 1;
} else {
  console.log(`PASS REM-WP2.5 scope and traceability audit at ${head}`);
  console.log(`PASS ${expected.size} mapped Phase 1 authorization scenarios and retained WP1.6 HTTP-path evidence.`);
}
