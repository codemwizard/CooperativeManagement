import Ajv2020 from 'ajv/dist/2020.js';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';

const taskEvidenceSchema = JSON.parse(await readFile('evidence/phase1/task-evidence.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateTaskEvidence = ajv.compile(taskEvidenceSchema);

export function validateWp16DependencyData({
  graph,
  taskRecords,
  candidate,
  commitExists,
  isAncestor,
  artifactExists,
  taskEvidenceValidator = validateTaskEvidence,
  bddMap,
  taskId = 'REM-WP1.6',
}) {
  assert.ok(graph?.tasks && typeof graph.tasks === 'object', 'dependency graph has no task map');
  assert.ok(Array.isArray(taskRecords), 'task evidence registry must be an array');
  assert.match(candidate ?? '', /^[0-9a-f]{40}$/i, 'candidate must be a full immutable commit SHA');

  for (const [id, task] of Object.entries(graph.tasks)) {
    assert.ok(task && Array.isArray(task.depends_on), `${id} has no dependency list`);
    assert.equal(new Set(task.depends_on).size, task.depends_on.length, `${id} has duplicate dependencies`);
    for (const dependency of task.depends_on) {
      assert.ok(graph.tasks[dependency], `${id} refers to unknown dependency ${dependency}`);
      assert.ok(task.edge_reasons?.[dependency]?.trim(), `${id} has no rationale for edge ${dependency}`);
    }
    assert.deepEqual(Object.keys(task.edge_reasons ?? {}).sort(), [...task.depends_on].sort(), `${id} edge rationales differ from its dependency list`);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    assert.ok(!visiting.has(id), `dependency graph contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.tasks[id].depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of Object.keys(graph.tasks)) visit(id);

  const records = new Map(taskRecords.map((record) => [record.task_id, record]));
  const directPredecessors = graph.tasks[taskId]?.depends_on;
  assert.ok(Array.isArray(directPredecessors) && directPredecessors.length > 0, `${taskId} has no graph-defined predecessors`);

  const checked = new Set();
  const candidates = new Map();
  function verify(id) {
    if (checked.has(id)) return;
    checked.add(id);
    const record = records.get(id);
    assert.ok(record, `${id} predecessor evidence is missing`);
    assert.equal(record.task_id, id, `${id} evidence task ID mismatch`);
    assert.ok(taskEvidenceValidator(record), `${id} evidence fails task-evidence schema: ${JSON.stringify(taskEvidenceValidator.errors ?? [])}`);
    assert.equal(record.status.implementation, 'complete', `${id} implementation is not complete`);
    for (const key of ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified']) {
      assert.ok(['passed', 'not_applicable'].includes(record.status[key]), `${id} ${key} is not passing`);
    }
    assert.equal(record.status.gate_verified, 'passed', `${id} gate is not closed`);
    const sha = record.commit ?? record.candidate?.implementation_commit;
    assert.match(sha ?? '', /^[0-9a-f]{40}$/i, `${id} has no immutable candidate SHA`);
    assert.ok(commitExists(sha), `${id} candidate commit ${sha} does not exist`);
    assert.ok(isAncestor(sha, candidate), `${id} candidate ${sha} is not an ancestor of ${candidate}`);
    candidates.set(id, sha);
    const commands = record.commands ?? [];
    assert.ok(commands.some((command) => command.result === 'passed'), `${id} has no passing verification command`);
    for (const command of commands) {
      assert.ok(['passed', 'failed'].includes(command.result), `${id} has a blocked or unrun command: ${command.command}`);
      assert.ok(command.artifact, `${id} command has no retained artifact: ${command.command}`);
      assert.ok(artifactExists(command.artifact), `${id} evidence artifact is missing: ${command.artifact}`);
    }
    for (const [predecessorId, predecessor] of Object.entries(record.claims.predecessors ?? {})) {
      assert.ok(artifactExists(predecessor.artifact), `${id} predecessor artifact for ${predecessorId} is missing: ${predecessor.artifact}`);
    }
    for (const predecessor of graph.tasks[id].depends_on) verify(predecessor);
  }

  for (const predecessor of directPredecessors) verify(predecessor);
  if (bddMap) {
    assert.ok(Array.isArray(bddMap.scenarios), 'BDD owner map has no scenario list');
    for (const scenario of bddMap.scenarios.filter((entry) => entry.owner_tasks?.includes(taskId))) {
      for (const owner of scenario.owner_tasks) {
        if (owner !== taskId) {
          assert.ok(checked.has(owner), `${taskId} BDD scenario ${scenario.id} owner ${owner} is not a graph predecessor`);
        }
      }
    }
  }
  return { checkedTaskIds: [...checked].sort(), candidates };
}

async function main() {
  const candidateArg = process.argv.find((arg) => arg.startsWith('--candidate='))?.slice('--candidate='.length);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const candidate = candidateArg ?? git('rev-parse', 'HEAD');
  const graph = JSON.parse(await readFile('evidence/phase1/task-dependencies.yml', 'utf8'));
  const registry = JSON.parse(await readFile('evidence/phase1/tasks.json', 'utf8'));
  const taskRecords = [...registry];
  const bddMap = JSON.parse(await readFile('evidence/phase1/bdd-work-package-map.json', 'utf8'));
  const required = new Set();
  function collect(id) {
    if (required.has(id)) return;
    required.add(id);
    for (const dependency of graph.tasks[id]?.depends_on ?? []) collect(dependency);
  }
  for (const id of graph.tasks['REM-WP1.6']?.depends_on ?? []) collect(id);
  for (const id of required) {
    if (taskRecords.some((record) => record.task_id === id)) continue;
    const match = /^REM-WP(\d+(?:\.\d+)?)$/.exec(id);
    assert.ok(match, `unsupported task ID ${id}`);
    const evidencePath = `evidence/phase1/wp${match[1]}/task-evidence.json`;
    try {
      taskRecords.push(JSON.parse(await readFile(evidencePath, 'utf8')));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`${id} predecessor evidence is missing at ${evidencePath}; the REM-WP1.6 predecessor gate cannot pass.`, { cause: error });
      }
      throw new Error(`${id} predecessor evidence could not be read from ${evidencePath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  const result = validateWp16DependencyData({
    graph,
    taskRecords,
    bddMap,
    candidate,
    commitExists: (sha) => spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }).status === 0,
    isAncestor: (sha, head) => spawnSync('git', ['merge-base', '--is-ancestor', sha, head], { stdio: 'ignore' }).status === 0,
    artifactExists: (artifact) => {
      try { return statSync(artifact).isFile(); } catch { return false; }
    },
  });
  // Resolve artifact existence asynchronously after the pure validation confirms paths.
  for (const id of result.checkedTaskIds) {
    const record = taskRecords.find((entry) => entry.task_id === id);
    for (const command of record.commands ?? []) await access(command.artifact);
  }
  console.log(`PASS REM-WP1.6 predecessor gate at ${candidate}.`);
  console.log(`PASS ${result.checkedTaskIds.length} direct/transitive task records, schema, artifacts and candidate ancestry.`);
}

if (process.argv[1]?.endsWith('verify_wp1_6_dependencies.mjs')) await main();
