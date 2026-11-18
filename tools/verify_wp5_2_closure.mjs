import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';

const candidateCommit = process.argv[2];
assert.match(candidateCommit ?? '', /^[0-9a-f]{40}$/, 'usage: node tools/verify_wp5_2_closure.mjs <implementation-commit-sha>');
const runGit = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const currentHead = runGit('rev-parse', 'HEAD');
assert.equal(runGit('status', '--porcelain'), '', 'evidence candidate worktree must be clean');
assert.equal(runGit('merge-base', '--is-ancestor', candidateCommit, currentHead), '', 'candidate must be an ancestor of evidence HEAD');

const evidenceOnlyDiff = runGit('diff', '--name-only', `${candidateCommit}..${currentHead}`)
  .split(/\r?\n/).filter(Boolean);
for (const changedPath of evidenceOnlyDiff) {
  assert.ok(
    /^evidence\/phase1\/wp5\.[12]\//.test(changedPath)
      || changedPath === 'Implementation-Plan-V4/implementation/WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md',
    `post-candidate change is not WP5.1/WP5.2 closeout evidence: ${changedPath}`,
  );
}

const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
const phaseOneRecords = JSON.parse(await readFile('evidence/phase1/tasks.json', 'utf8'));
const phaseOneById = new Map(phaseOneRecords.map((record) => [record.task_id, record]));

async function recordFor(taskId) {
  if (phaseOneById.has(taskId)) return phaseOneById.get(taskId);
  const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(taskId);
  assert.ok(match, `unsupported task ID in dependency graph: ${taskId}`);
  const recordPath = `evidence/phase1/wp${match[1]}/task-evidence.json`;
  return JSON.parse(await readFile(recordPath, 'utf8'));
}

function assertPassingRecord(record, taskId) {
  assert.equal(record.task_id, taskId, `${taskId} evidence ID mismatch`);
  assert.equal(record.status.implementation, 'complete', `${taskId} implementation is not complete`);
  for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
    assert.ok(['passed', 'not_applicable'].includes(record.status[key]), `${taskId} ${key} is not passing`);
  }
  assert.match(record.commit, /^[0-9a-f]{40}$/, `${taskId} evidence must pin an immutable commit`);
  const relation = spawnSync('git', ['merge-base', '--is-ancestor', record.commit, candidateCommit], { stdio: 'ignore' });
  assert.equal(relation.status, 0, `${taskId} pinned commit ${record.commit} is not an ancestor of ${candidateCommit}`);
  for (const command of record.commands ?? []) {
    assert.equal(command.result, 'passed', `${taskId} has a non-passing command: ${command.command}`);
    assert.match(command.artifact, /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.?\/(?:|$))[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/);
  }
  return record.commit;
}

const checked = new Set();
async function checkTaskAndDirectDependencies(taskId) {
  if (checked.has(taskId)) return;
  checked.add(taskId);
  const definition = graph.tasks[taskId];
  assert.ok(definition, `task missing from authoritative graph: ${taskId}`);
  const record = await recordFor(taskId);
  assertPassingRecord(record, taskId);
  for (const predecessor of definition.depends_on ?? []) {
    const predecessorDefinition = graph.tasks[predecessor];
    assert.ok(predecessorDefinition, `${taskId} references unknown predecessor ${predecessor}`);
    const predecessorRecord = await recordFor(predecessor);
    assertPassingRecord(predecessorRecord, predecessor);
  }
}

const wp51 = JSON.parse(await readFile('evidence/phase1/wp5.1/task-evidence.json', 'utf8'));
const wp52 = JSON.parse(await readFile('evidence/phase1/wp5.2/task-evidence.json', 'utf8'));
assert.equal(wp51.commit, candidateCommit, 'WP5.1 predecessor record must bind to the implementation candidate');
assert.equal(wp52.commit, candidateCommit, 'WP5.2 record must bind to the implementation candidate');
assert.equal(wp51.status.gate_verified, 'passed');
assert.equal(wp52.status.implementation, 'complete');
assert.equal(wp52.status.unit_test, 'passed');
assert.equal(wp52.status.integration_test, 'passed');
assert.equal(wp52.status.gate_verified, 'passed');

await checkTaskAndDirectDependencies('REM-WP5.1');
await checkTaskAndDirectDependencies('REM-WP5.2');
// Verify the prerequisites of WP5.1 as well as the direct WP5.2 predecessors.
for (const predecessor of graph.tasks['REM-WP5.1'].depends_on ?? []) {
  for (const transitivePredecessor of graph.tasks[predecessor]?.depends_on ?? []) {
    const transitiveRecord = await recordFor(transitivePredecessor);
    assertPassingRecord(transitiveRecord, transitivePredecessor);
  }
}
// WP5.3 may start only after the ratified WP0.10 record and this completed WP5.2 record.
for (const predecessor of graph.tasks['REM-WP5.3'].depends_on ?? []) {
  const predecessorRecord = await recordFor(predecessor);
  assertPassingRecord(predecessorRecord, predecessor);
}

const artifacts = [...wp51.commands, ...wp52.commands].map((command) => command.artifact);
for (const artifact of new Set(artifacts)) {
  await access(artifact);
  runGit('cat-file', '-e', `${currentHead}:${artifact}`);
}

const wp52Raw = await readFile('evidence/phase1/wp5.2/credential-migration-integration.log', 'utf8');
assert.match(wp52Raw, /Tests\s+16 passed/);
assert.match(wp52Raw, /proves secret redaction while atomically consuming temporary credentials and establishing permanent passwords/);
const wp51Raw = await readFile('evidence/phase1/wp5.1/api-contract-tests.log', 'utf8');
assert.match(wp51Raw, /Tests\s+21 passed/);
const wp52ApiRaw = await readFile('evidence/phase1/wp5.2/api-log-redaction-tests.log', 'utf8');
assert.match(wp52ApiRaw, /Tests\s+21 passed/);
assert.match(wp52ApiRaw, /API authentication log redaction/);

const manifest = JSON.parse(await readFile('evidence/phase1/wp5.2/blocklist/manifest.json', 'utf8'));
const corpus = await readFile(manifest.output.path);
const source = await readFile('evidence/phase1/wp5.2/blocklist/100k-most-used-passwords-NCSC.txt');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();
assert.equal(sha256(source), manifest.source.sourceSha256);
assert.equal(sha256(corpus), manifest.output.sha256);
assert.equal(manifest.version, 'phase1-ncsc-top100k-v1');
runGit('cat-file', '-e', `${currentHead}:${manifest.output.path}`);
runGit('cat-file', '-e', `${currentHead}:evidence/phase1/wp5.2/blocklist/100k-most-used-passwords-NCSC.txt`);
runGit('cat-file', '-e', `${currentHead}:evidence/phase1/wp5.2/blocklist/SECLISTS-LICENSE.txt`);

const ownerApproval = await readFile('evidence/phase1/wp5.2/argon2-interim-owner-approval.md', 'utf8');
assert.match(ownerApproval, /Approved this interim profile/);
const benchmark = JSON.parse((await readFile('evidence/phase1/wp5.2/argon2id-interim-sustained.raw.log', 'utf8')).replace(/^npm notice[^\r\n]*\r?\n(?:npm notice[^\r\n]*\r?\n)?/, ''));
assert.equal(benchmark.sustained.concurrency, 8);
assert.equal(benchmark.sustained.requestedDurationMs, 60_000);
assert.equal(benchmark.sustained.verificationUnderOneSecond, true);
for (const p of ['p50', 'p95', 'p99']) assert.ok(benchmark.sustained.latencyMs[p] < 1000);

console.log(`PASS REM-WP5.2 candidate ${candidateCommit}; evidence HEAD ${currentHead}.`);
console.log('PASS WP5.1 and WP1.2 predecessor evidence; all direct graph dependencies of WP5.1/WP5.2 and WP5.3 entry dependencies are immutable passing ancestors.');
console.log(`PASS ${new Set(artifacts).size} retained command artifacts exist and are tracked at evidence HEAD.`);
console.log(`PASS blocklist ${manifest.version}: ${manifest.entryCount} entries; source/data SHA-256 match manifest.`);
console.log(`PASS approved interim Argon2id qualification: ${benchmark.sustained.concurrency} concurrent workers, 60 seconds, all verifications under one second.`);
