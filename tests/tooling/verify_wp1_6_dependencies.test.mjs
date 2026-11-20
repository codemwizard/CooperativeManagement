import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWp16DependencyData } from '../../tools/verify_wp1_6_dependencies.mjs';

const sha = 'a'.repeat(40);
const ids = ['REM-WP1.1', 'REM-WP1.2', 'REM-WP1.3', 'REM-WP1.4', 'REM-WP1.5', 'REM-WP2.2', 'REM-WP5.3'];

function fixture() {
  const tasks = Object.fromEntries(ids.map((id) => [id, { depends_on: [], edge_reasons: {} }]));
  tasks['REM-WP1.6'] = {
    depends_on: ids,
    edge_reasons: Object.fromEntries(ids.map((id) => [id, `Required integration boundary: ${id}.`])),
  };
  tasks['REM-WP1.2'].depends_on = ['REM-WP1.1'];
  tasks['REM-WP1.2'].edge_reasons = { 'REM-WP1.1': 'Receipt schema precedes the transaction adapter.' };
  tasks['REM-WP1.1'].depends_on = ['REM-WP0.1'];
  tasks['REM-WP1.1'].edge_reasons = { 'REM-WP0.1': 'Accepted command identity precedes persistence.' };
  tasks['REM-WP0.1'] = { depends_on: [], edge_reasons: {} };

  const records = Object.keys(tasks).filter((id) => id !== 'REM-WP1.6').map((taskId) => ({
    schema_version: 1,
    task_id: taskId,
    status: {
      implementation: 'complete', unit_test: 'passed', integration_test: 'not_applicable',
      bdd_ui_test: 'not_applicable', gate_verified: 'passed',
    },
    commit: sha,
    environment: {
      node: 'v26.7.0', npm: '12.2.0', postgres: 'PostgreSQL 18.0',
      database_role: 'not-applicable', data_mode: 'test', key_provider: 'unknown',
    },
    commands: [{ command: 'fixture check', result: 'passed', artifact: 'fixture.log' }],
    claims: {
      behavior_proved: 'fixture', path_proved: 'fixture', configuration_proved: 'fixture',
      coverage_limitations: [],
    },
    limitations: [], unresolved_decisions: [], reviewer: 'fixture',
  }));
  const wp12 = records.find((record) => record.task_id === 'REM-WP1.2');
  wp12.commands = [
    'domain.log', 'typecheck.log', 'architecture.log', 'security-audit-tests.log',
    'command-transaction-tests.log', 'migration-tests.log',
  ].map((artifact) => ({ command: `fixture ${artifact}`, result: 'passed', artifact }));
  wp12.sub_gates = [
    { gate_id: 'REM-WP1.2-A', status: 'passed', commands: [{ command: 'fixture WP1.2-A', result: 'passed', artifact: 'domain.log' }] },
    { gate_id: 'REM-WP1.2-B', status: 'passed', commands: [
      { command: 'fixture audit', result: 'passed', artifact: 'security-audit-tests.log' },
      { command: 'fixture transaction', result: 'passed', artifact: 'command-transaction-tests.log' },
      { command: 'fixture migration', result: 'passed', artifact: 'migration-tests.log' },
    ] },
  ];
  return {
    graph: { tasks },
    taskRecords: records,
    candidate: sha,
    commitExists: () => true,
    isAncestor: () => true,
    artifactExists: () => true,
  };
}

test('fails when any direct predecessor record is missing', () => {
  const data = fixture();
  data.taskRecords = data.taskRecords.filter((record) => record.task_id !== 'REM-WP2.2');
  assert.throws(() => validateWp16DependencyData(data), /REM-WP2\.2 predecessor evidence is missing/);
});

test('fails when a predecessor record does not match the evidence schema', () => {
  const data = fixture();
  data.taskRecords.find((record) => record.task_id === 'REM-WP1.3').unexpected_field = true;
  assert.throws(() => validateWp16DependencyData(data), /evidence fails task-evidence schema/);
});

test('rejects a working-tree pseudo SHA', () => {
  const data = fixture();
  data.taskRecords.find((record) => record.task_id === 'REM-WP1.1').commit = 'working-tree';
  assert.throws(() => validateWp16DependencyData(data), /no immutable candidate SHA/);
});

test('rejects missing or non-ancestor commits', () => {
  const missing = fixture();
  missing.commitExists = (commit) => commit !== sha;
  assert.throws(() => validateWp16DependencyData(missing), /candidate commit .* does not exist/);

  const nonAncestor = fixture();
  nonAncestor.isAncestor = (commit) => commit !== sha;
  assert.throws(() => validateWp16DependencyData(nonAncestor), /is not an ancestor/);
});

test('fails when a transitive predecessor is not gate-passed', () => {
  const data = fixture();
  data.taskRecords.find((record) => record.task_id === 'REM-WP0.1').status.gate_verified = 'pending';
  assert.throws(() => validateWp16DependencyData(data), /REM-WP0\.1 gate_verified is not passing/);
});

test('fails when a referenced predecessor artifact is missing', () => {
  const data = fixture();
  data.artifactExists = (artifact) => artifact !== 'fixture.log';
  assert.throws(() => validateWp16DependencyData(data), /evidence artifact is missing/);
});

test('fails when a cited predecessor record artifact is missing', () => {
  const data = fixture();
  data.taskRecords.find((record) => record.task_id === 'REM-WP1.1').claims.predecessors = {
    'REM-WP0.1': { result: 'passed', artifact: 'predecessor.json' },
  };
  data.artifactExists = (artifact) => artifact !== 'predecessor.json';
  assert.throws(() => validateWp16DependencyData(data), /predecessor artifact for REM-WP0\.1 is missing/);
});

test('allows retained red-phase evidence when the same task has passing green evidence', () => {
  const data = fixture();
  const record = data.taskRecords.find((entry) => entry.task_id === 'REM-WP0.1');
  record.commands = [
    { command: 'red phase', result: 'failed', artifact: 'red-green.md' },
    { command: 'green phase', result: 'passed', artifact: 'red-green.md' },
  ];
  assert.doesNotThrow(() => validateWp16DependencyData(data));
});

test('does not allow a task whose only verification command failed', () => {
  const data = fixture();
  const record = data.taskRecords.find((entry) => entry.task_id === 'REM-WP0.1');
  record.commands = [{ command: 'only run', result: 'failed', artifact: 'red-green.md' }];
  assert.throws(() => validateWp16DependencyData(data), /REM-WP0\.1 has no passing verification command/);
});

test('rejects a cyclic dependency graph', () => {
  const data = fixture();
  data.graph.tasks['REM-WP0.1'].depends_on = ['REM-WP1.1'];
  data.graph.tasks['REM-WP0.1'].edge_reasons = { 'REM-WP1.1': 'Invalid fixture cycle.' };
  assert.throws(() => validateWp16DependencyData(data), /contains a cycle/);
});

test('accepts complete, schema-valid direct and transitive predecessor evidence', () => {
  const result = validateWp16DependencyData(fixture());
  assert.deepEqual(result.checkedTaskIds, ['REM-WP0.1', ...ids].sort());
  assert.equal(result.candidates.size, 8);
});
