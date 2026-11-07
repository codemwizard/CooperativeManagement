import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WP0_IDS = Array.from({ length: 13 }, (_, index) => `WP0.${index + 1}`);
const MANDATORY_GATE_SCRIPTS = [
  'verify:phase0', 'verify:phase1:contracts', 'typecheck:v4', 'verify:arch', 'test:unit',
  'test:db:migrations', 'test:db --workspace @symphony/db', 'test:api',
  'test:workspace', 'test:bdd:phase1', 'verify:trace', 'test:a11y',
  'test:login:api', 'verify:legacy-floor', 'test:e2e',
];
const SECRET_FIELD = /(?:password|passphrase|secret|token|api[_-]?key|private[_-]?key|connection[_-]?string|credential|nrc|national[_-]?id)/i;
const SENSITIVE_VALUE = /(?:postgres(?:ql)?:\/\/[^\s]+|bearer\s+[^\s]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|token|secret)\s*[:=]\s*[^\s]+)/i;

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function collectUnsafeEvidence(value, location = '$', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeEvidence(item, `${location}[${index}]`, errors));
    return errors;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_FIELD.test(key)) errors.push(`${location}.${key} is not permitted in evidence`);
      collectUnsafeEvidence(nested, `${location}.${key}`, errors);
    }
    return errors;
  }
  if (typeof value === 'string' && SENSITIVE_VALUE.test(value)) errors.push(`${location} contains a secret or unrestricted connection value`);
  return errors;
}

export function validateEvidence(record, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const errors = validate(record) ? [] : (validate.errors ?? []).map((error) => `${error.instancePath || '$'} ${error.message ?? 'is invalid'}`);
  errors.push(...collectUnsafeEvidence(record));
  for (const [index, command] of (record?.commands ?? []).entries()) {
    if (typeof command?.artifact === 'string' && (path.isAbsolute(command.artifact) || command.artifact.split(/[\\/]/).includes('..'))) {
      errors.push(`$.commands[${index}].artifact must be a repository-relative path`);
    }
    if (typeof command?.command === 'string' && SENSITIVE_VALUE.test(command.command)) {
      errors.push(`$.commands[${index}].command contains a secret or connection string`);
    }
  }
  return [...new Set(errors)];
}

function validPassingRecord(record) {
  const status = record?.status;
  if (!status || status.implementation !== 'complete') return false;
  const passed = new Set(['passed', 'not_applicable']);
  return ['unit_test', 'integration_test', 'bdd_ui_test', 'gate_verified'].every((key) => passed.has(status[key]))
    && Array.isArray(record.unresolved_decisions)
    && record.unresolved_decisions.length === 0;
}

function graphErrors(graph) {
  const errors = [];
  if (!graph || graph.version !== 1 || !graph.tasks || typeof graph.tasks !== 'object') return ['dependency graph must contain version 1 and a tasks map'];
  for (const id of WP0_IDS) if (!(id in graph.tasks)) errors.push(`required task ${id} is missing from dependency graph`);
  for (const [id, task] of Object.entries(graph.tasks)) {
    if (!/^WP\d+(?:\.\d+)?$/.test(id)) errors.push(`invalid task ID ${id}`);
    if (!task || !Array.isArray(task.depends_on) || !task.edge_reasons || typeof task.edge_reasons !== 'object') {
      errors.push(`${id} must declare depends_on and edge_reasons`);
      continue;
    }
    if (new Set(task.depends_on).size !== task.depends_on.length) errors.push(`${id} repeats a predecessor`);
    for (const predecessor of task.depends_on) {
      if (!(predecessor in graph.tasks)) errors.push(`${id} has unknown predecessor ${predecessor}`);
      const reason = task.edge_reasons[predecessor];
      if (typeof reason !== 'string' || reason.trim().length < 30 || /chronology.only|sequence.only|because it is earlier/i.test(reason)) {
        errors.push(`${id} edge from ${predecessor} has no substantive prerequisite reason`);
      }
    }
    for (const predecessor of Object.keys(task.edge_reasons)) {
      if (!task.depends_on.includes(predecessor)) errors.push(`${id} has an edge reason for non-predecessor ${predecessor}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id, stack = []) => {
    if (visiting.has(id)) {
      errors.push(`dependency cycle: ${[...stack, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id) || !graph.tasks[id]) return;
    visiting.add(id);
    for (const predecessor of graph.tasks[id].depends_on ?? []) visit(predecessor, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of Object.keys(graph.tasks)) visit(id);
  const aggregateDeps = graph.tasks['WP0.13']?.depends_on ?? [];
  for (const id of WP0_IDS.slice(0, 12)) if (!aggregateDeps.includes(id)) errors.push(`WP0.13 must depend on ${id}`);
  return [...new Set(errors)];
}

export function validateDeferredFollowups(records, graph) {
  const errors = [];
  const knownTasks = new Set(Object.keys(graph?.tasks ?? {}));
  for (const record of records ?? []) {
    for (const [index, followup] of (record?.deferred_followups ?? []).entries()) {
      if (followup?.task_id === record.task_id) {
        errors.push(`${record.task_id} deferred follow-up ${index} cannot be owned by the same task`);
      } else if (!knownTasks.has(followup?.task_id)) {
        errors.push(`${record.task_id} deferred follow-up ${index} names unknown owner ${followup?.task_id}`);
      }
    }
    if (/^WP0\.(?:[1-9]|1[01])$/.test(record?.task_id ?? '')
      && ['integration_test', 'bdd_ui_test'].some((level) => record.status?.[level] === 'not_applicable')
      && !(record.deferred_followups?.length > 0)) {
      errors.push(`${record.task_id} marks a product-path test not_applicable without naming downstream acceptance evidence`);
    }
  }
  return [...new Set(errors)];
}

function collectAncestors(graph, target) {
  const ancestors = new Set();
  const visit = (id) => {
    for (const predecessor of graph.tasks[id]?.depends_on ?? []) {
      if (!ancestors.has(predecessor)) {
        ancestors.add(predecessor);
        visit(predecessor);
      }
    }
  };
  visit(target);
  return ancestors;
}

export function validateDependencyGraph(graph, records, targetTask, closureReadiness) {
  const errors = graphErrors(graph);
  if (!targetTask) return errors;
  if (!graph?.tasks?.[targetTask]) return [...errors, `unknown target task ${targetTask}`];
  for (const predecessor of collectAncestors(graph, targetTask)) {
    if (!validPassingRecord(records?.[predecessor])) errors.push(`${predecessor} has no passing completion record`);
  }
  if (targetTask === 'WP0.13') {
    const required = ['project_owner_signed', 'phase0_candidate_passed', 'all_contract_decisions_resolved', 'independent_reviewer_named', 'reviewer_independent', 'reviewer_available'];
    for (const key of required) if (closureReadiness?.[key] !== true) errors.push(`WP0.13 closure readiness ${key} is not confirmed`);
    if (closureReadiness?.phase0_candidate_worktree_dirty !== false) errors.push('WP0.13 Phase 0 candidate must be a clean exact commit');
    if (!/^[0-9a-f]{40}$/i.test(String(closureReadiness?.phase0_candidate_commit ?? ''))) errors.push('WP0.13 Phase 0 candidate commit must be a full Git SHA');
  }
  return [...new Set(errors)];
}

export function validatePhase1BddReport(report, manifest) {
  const errors = [];
  const expected = manifest?.scenarios ?? [];
  if (expected.length === 0) errors.push('Phase 1 BDD scenario manifest is empty');
  const elements = (report ?? []).flatMap((feature) => feature.elements ?? []);
  const actual = new Map();
  for (const element of elements) {
    for (const tag of element.tags ?? []) {
      const id = String(tag.name ?? '').replace(/^@/, '');
      if (id.startsWith('BDD-')) actual.set(id, element);
    }
  }
  for (const scenario of expected) {
    const element = actual.get(scenario.id);
    if (!element) {
      errors.push(`${scenario.id} was not executed (missing, filtered, or still @wip)`);
      continue;
    }
    if ((element.steps ?? []).some((step) => step.result?.status !== 'passed')) errors.push(`${scenario.id} did not pass every step`);
  }
  return errors;
}

export function validateBddOwnerMap(mapping, manifest, graph) {
  const errors = [];
  const expected = new Map((manifest?.scenarios ?? []).map((scenario) => [scenario.id, scenario]));
  const mapped = mapping?.scenarios ?? [];
  const ids = mapped.map((scenario) => scenario?.id);
  if (new Set(ids).size !== ids.length) errors.push('BDD owner map contains duplicate scenario IDs');
  for (const [id, scenario] of expected) {
    const entries = mapped.filter((entry) => entry?.id === id);
    if (entries.length !== 1) { errors.push(`${id} must have exactly one owner/path mapping`); continue; }
    const entry = entries[0];
    if (entry.feature !== scenario.feature) errors.push(`${id} feature path differs from the frozen manifest`);
    if (!Array.isArray(entry.requirements) || entry.requirements.length === 0) errors.push(`${id} has no normative requirement mapping`);
    if (!Array.isArray(entry.owner_tasks) || entry.owner_tasks.length === 0) errors.push(`${id} has no owning work package`);
    for (const owner of entry.owner_tasks ?? []) if (!(owner in (graph?.tasks ?? {}))) errors.push(`${id} names unknown owner ${owner}`);
    if (typeof entry.required_path !== 'string' || entry.required_path.trim().length < 20) errors.push(`${id} lacks a concrete required test path`);
    if (typeof entry.assertion_rule !== 'string' || !/observable assertions/i.test(entry.assertion_rule)) errors.push(`${id} does not require observable assertions`);
  }
  for (const id of ids) if (!expected.has(id)) errors.push(`${id} is not in the frozen BDD manifest`);
  return [...new Set(errors)];
}

export function validateRuntimeMode(matrix, config) {
  const profile = matrix?.profiles?.find((candidate) => candidate.id === config?.RUNTIME_PROFILE);
  if (!profile) return [`unsupported or missing RUNTIME_PROFILE: ${config?.RUNTIME_PROFILE ?? '<missing>'}`];
  const errors = [];
  if (profile.APP_ENV !== config?.APP_ENV || profile.DATA_MODE !== config?.DATA_MODE) {
    errors.push(`${profile.id} requires APP_ENV=${profile.APP_ENV} and DATA_MODE=${profile.DATA_MODE}`);
  }
  if (profile.key_provider !== config?.key_provider) {
    errors.push(`${profile.id} requires key_provider=${profile.key_provider}`);
  }
  if (profile.DATA_MODE === 'test' && config.synthetic_only !== true) errors.push(`${profile.id} requires synthetic_only=true`);
  if (profile.DATA_MODE === 'real' && config.residency_approved !== true) errors.push(`${profile.id} requires approved residency before startup`);
  if (profile.DATA_MODE === 'real' && /^(?:local|test)/i.test(String(config.key_provider ?? ''))) errors.push(`${profile.id} cannot use a local/test key provider`);
  if (config.database_isolated_disposable !== true && profile.database.includes('disposable')) errors.push(`${profile.id} requires an isolated disposable database`);
  if (config.app_role_least_privilege !== true) errors.push(`${profile.id} requires a least-privilege application role`);
  if (profile.DATA_MODE === 'real' && config.persistent_database !== true) errors.push(`${profile.id} requires a persistent database`);
  if (profile.demo === 'disabled' && config.demo_controls === true) errors.push(`${profile.id} prohibits demo controls`);
  if (profile.demo === 'designated-actor-and-tenant-only' && config.demo_controls === true && config.demo_actor_tenant_configured !== true) errors.push(`${profile.id} requires configured demo actor and tenant`);
  if (profile.purge === 'disabled' && config.purge_enabled === true) errors.push(`${profile.id} prohibits purge`);
  if (profile.purge === 'dedicated-purge-role-only' && config.purge_enabled === true && config.purge_role_dedicated !== true) errors.push(`${profile.id} purge requires a dedicated purge role`);
  if (config.key_provider && config.key_provider !== profile.key_provider) errors.push(`${profile.id} requires key provider ${profile.key_provider}`);
  return errors;
}

export function validateTenantTableInventory(inventory, migrationTexts) {
  const errors = [];
  const entries = inventory?.tables ?? [];
  const names = entries.map((entry) => entry.table);
  if (new Set(names).size !== names.length) errors.push('tenant table inventory contains duplicate table names');
  const allowedClasses = new Set(['tenant_scoped', 'global_catalogue_read_only', 'control_plane_restricted']);
  for (const entry of entries) {
    if (!allowedClasses.has(entry.classification)) errors.push(`${entry.table} has an invalid classification`);
    if (typeof entry.scope_basis !== 'string' || entry.scope_basis.trim().length < 20) errors.push(`${entry.table} lacks a concrete scope basis`);
    if (typeof entry.rls_current !== 'boolean') errors.push(`${entry.table} lacks an RLS inventory value`);
  }
  const created = new Set();
  const enabled = new Set();
  const forced = new Set();
  for (const source of migrationTexts) {
    for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:symphony\.)?([a-z_][a-z0-9_]*)/gi)) created.add(match[1].toLowerCase());
    for (const match of source.matchAll(/ALTER\s+TABLE\s+(?:symphony\.)?([a-z_][a-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)) enabled.add(match[1].toLowerCase());
    for (const match of source.matchAll(/ALTER\s+TABLE\s+(?:symphony\.)?([a-z_][a-z0-9_]*)\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi)) forced.add(match[1].toLowerCase());
  }
  for (const name of created) if (!names.includes(name)) errors.push(`migration table ${name} is not classified`);
  for (const name of names) if (!created.has(name)) errors.push(`inventory table ${name} does not exist in migrations`);
  for (const entry of entries) {
    const effectiveRls = enabled.has(entry.table) && forced.has(entry.table);
    if (entry.rls_current !== effectiveRls) errors.push(`${entry.table} RLS status disagrees with migration ENABLE/FORCE statements`);
  }
  return [...new Set(errors)];
}

export function validateTenantPolicyMatrix(matrix, inventory) {
  const errors = [];
  const entries = matrix?.tables ?? [];
  const byName = new Map(entries.map((entry) => [entry.table, entry]));
  const source = new Map((inventory?.tables ?? []).map((entry) => [entry.table, entry]));
  if (byName.size !== entries.length) errors.push('tenant policy matrix contains duplicate table names');
  if (byName.size !== source.size) errors.push('tenant policy matrix does not cover the complete migration inventory');
  for (const [name, sourceEntry] of source) {
    const entry = byName.get(name);
    if (!entry) { errors.push(`${name} has no proposed access policy`); continue; }
    if (entry.classification !== sourceEntry.classification) errors.push(`${name} classification differs from migration inventory`);
    if (entry.current_rls_enabled_and_forced !== sourceEntry.rls_current) errors.push(`${name} current RLS evidence differs from migration inventory`);
    if (entry.delete_grant !== false) errors.push(`${name} must not grant unrestricted DELETE to ordinary application role`);
    if (sourceEntry.classification === 'tenant_scoped') {
      if (entry.required_rls !== 'ENABLE+FORCE') errors.push(`${name} tenant policy must require both ENABLE and FORCE RLS`);
      if (entry.explicit_tenant_predicate !== true) errors.push(`${name} requires an explicit tenant predicate in addition to RLS`);
      if (typeof entry.scope_resolution !== 'string' || entry.scope_resolution.trim().length < 20) errors.push(`${name} lacks a tenant resolution path`);
      if (!(entry.permitted_sql_operations ?? []).includes('SELECT')) errors.push(`${name} lacks an explicit tenant read grant`);
    } else if (sourceEntry.classification === 'global_catalogue_read_only') {
      if (JSON.stringify(entry.permitted_sql_operations) !== '["SELECT"]') errors.push(`${name} global catalogue must be SELECT-only`);
    } else if ((entry.permitted_sql_operations ?? []).length !== 0 || entry.ordinary_runtime_role !== 'no ordinary application grant') {
      errors.push(`${name} control-plane table must have no ordinary application-role grant`);
    }
  }
  for (const name of byName.keys()) if (!source.has(name)) errors.push(`${name} is not present in the migration inventory`);
  return [...new Set(errors)];
}

export function validateAuthorityDependencyInventory(inventory, migrationInventory) {
  const required = new Set([
    'tenant-membership', 'platform-role-assignment', 'appointment-and-source-status',
    'capacity-grant-and-revocation', 'delegation-chain-and-revocation', 'organization-and-cohort-scope',
    'identity-conflict-and-ineligibility-facts', 'policy-and-configuration-version',
  ]);
  const errors = [];
  const rows = inventory?.dependencies ?? [];
  const ids = rows.map((row) => row.id);
  if (new Set(ids).size !== ids.length) errors.push('authority dependency inventory has duplicate IDs');
  for (const id of required) if (!ids.includes(id)) errors.push(`authority dependency ${id} is missing`);
  const tables = new Set((migrationInventory?.tables ?? []).map((table) => table.table));
  for (const row of rows) {
    if (!row.mutable) errors.push(`${row.id} must explicitly classify mutability`);
    if (!Array.isArray(row.mutation_paths) || row.mutation_paths.length === 0) errors.push(`${row.id} lacks mutation/change paths`);
    if (!Array.isArray(row.required_race_cases) || !row.required_race_cases.some((test) => test.includes('first-then')))
      errors.push(`${row.id} lacks a protected-command-first race case`);
    if (!Array.isArray(row.required_race_cases) || !row.required_race_cases.some((test) => test.includes('first-then-protected-command')))
      errors.push(`${row.id} lacks a change-first race case`);
    if (row.proof_owner !== 'WP2.4') errors.push(`${row.id} race proof must be owned by WP2.4`);
    for (const table of row.source_tables ?? []) if (!tables.has(table)) errors.push(`${row.id} references unknown source table ${table}`);
    if (typeof row.serialization_target !== 'string' || row.serialization_target.trim().length < 20) errors.push(`${row.id} lacks a precise serialization target`);
  }
  return [...new Set(errors)];
}

export function validatePurgeTablePolicyMatrix(matrix, inventory) {
  const errors = [];
  const expectedDelete = new Set((inventory?.tables ?? []).filter((entry) => entry.classification === 'tenant_scoped').map((entry) => entry.table));
  for (const name of ['tenants', 'event_outbox', 'enroller_assignments', 'requirement_definitions', 'enforcement_policies', 'duty_matrix_rows', 'precedence_policies', 'membership_rules', 'acceptance_policies', 'meeting_rules', 'resolution_class_rules']) expectedDelete.add(name);
  const expectedPreserve = new Set((inventory?.tables ?? []).filter((entry) => entry.classification === 'global_catalogue_read_only').map((entry) => entry.table));
  for (const name of ['legal_sources', 'position_combination_rules', 'retention_policies']) expectedPreserve.add(name);
  const deleteRows = matrix?.delete_tables ?? [];
  const order = matrix?.delete_dependency_order ?? [];
  const deletes = deleteRows.map((entry) => entry.table);
  const preserve = matrix?.preserve_tables ?? [];
  if (new Set(deletes).size !== deletes.length) errors.push('purge allowlist has duplicate tables');
  if (new Set(order).size !== order.length || order.length !== deletes.length || order.some((name, index) => name !== deletes[index])) errors.push('purge deletion order must include every allowed table exactly once in declared order');
  for (const name of expectedDelete) if (!deletes.includes(name)) errors.push(`${name} is missing from the purge delete policy`);
  for (const name of deletes) if (!expectedDelete.has(name)) errors.push(`${name} is not approved for purge deletion`);
  if (JSON.stringify([...preserve].sort()) !== JSON.stringify([...expectedPreserve].sort())) errors.push('purge preservation set differs from the approved global/control catalogue set');
  if (deletes.includes(matrix?.audit_ledger?.table)) errors.push('purge audit ledger must never be in the delete allowlist');
  for (const entry of deleteRows) {
    if (typeof entry.predicate !== 'string' || entry.predicate.trim().length < 10) errors.push(`${entry.table} lacks an explicit deletion predicate`);
    if (entry.table === 'requirement_definitions' && !entry.predicate.includes('cooperative_id')) errors.push('requirement_definitions must preserve global definitions and delete only test-tenant definitions');
    if (['enforcement_policies', 'duty_matrix_rows', 'precedence_policies', 'membership_rules', 'acceptance_policies', 'meeting_rules', 'resolution_class_rules'].includes(entry.table) && !entry.predicate.includes('organization_id')) errors.push(`${entry.table} must delete only organization-scoped test rows`);
  }
  if (matrix?.target?.database !== 'symphony_phase1_test' || matrix?.target?.schema !== 'symphony') errors.push('purge target must be the explicitly isolated symphony_phase1_test.symphony target');
  if (matrix?.target?.database_marker !== 'symphony-disposable-test:v1') errors.push('purge target marker value is missing or incorrect');
  if (matrix?.purge_role_contract?.name !== 'symphony_phase1_purger' || matrix?.purge_role_contract?.status !== 'capability contract proposed; role not provisioned') errors.push('dedicated purge role contract must be explicit and must not claim provisioning');
  if ((matrix?.execution_constraints ?? []).some((line) => /CASCADE|TRUNCATE|DROP SCHEMA|dynamic all-table/i.test(line)) === false) errors.push('purge contract must explicitly prohibit broad destructive SQL');
  if (new Set([...deletes, ...preserve]).size !== (inventory?.tables ?? []).length) errors.push('purge policy must classify every migration table as delete or preserve');
  return [...new Set(errors)];
}

export function validatePhase1Gate(packageJson, repoRoot = ROOT) {
  const errors = [];
  const scripts = packageJson?.scripts ?? {};
  const aggregate = scripts['verify:phase1'] ?? '';
  if (!aggregate) return ['verify:phase1 script is missing'];
  if (/--if-present/.test(aggregate)) errors.push('verify:phase1 may not use optional-script semantics');
  let previousIndex = -1;
  for (const required of MANDATORY_GATE_SCRIPTS) {
    const match = new RegExp(`npm run ${required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).exec(aggregate);
    const index = match?.index ?? -1;
    if (index < 0) errors.push(`verify:phase1 omits mandatory check ${required}`);
    else if (index <= previousIndex) errors.push(`verify:phase1 runs ${required} out of required order`);
    else previousIndex = index;
  }
  if (!aggregate.includes('&&')) errors.push('verify:phase1 must stop on the first failed mandatory check');
  if (!aggregate.trim().startsWith('npm run verify:phase0 &&')) errors.push('verify:phase1 must begin with the complete Phase 0 gate');
  const mustHaveScripts = ['verify:phase1:contracts', 'test:api', 'test:workspace', 'test:bdd:phase1', 'test:login:api'];
  for (const name of mustHaveScripts) if (!scripts[name]) errors.push(`mandatory npm script ${name} is missing`);
  const targetFiles = [
    'tools/phase1-contracts.js', 'tools/run_phase1_bdd.mjs', 'tools/phase1-command-contract-oracle.js',
    'tests/tooling/phase1_contracts.test.ts', 'evidence/phase1/command-contract-vectors.json',
    'tests/workspace/login.spec.ts', 'tests/workspace/login-api.spec.ts', 'playwright.phase1.config.ts',
    'tests/workspace/a11y.spec.ts', 'features/09_commands_audit_and_integrity.feature',
    'features/02_identity_privacy_and_access.feature', 'features/10_workspace_and_capabilities.feature',
    'apps/api/package.json', 'apps/workspace/package.json', 'tools/verify-trace.ts',
    'docs/phase1/API_CONTRACT.md', 'docs/phase1/PHASE1_CONTRACT_BASELINE.md', 'evidence/phase1/runtime-mode-matrix.json',
    'evidence/phase1/bdd-work-package-map.json', 'evidence/phase1/authority-dependency-inventory.json',
    'evidence/phase1/privacy-field-requirement-map.json', 'evidence/phase1/tenant-table-policy-matrix.json',
    'evidence/phase1/authentication-session-policy-matrix.json',
    'evidence/phase1/purge-table-policy-matrix.json',
  ];
  for (const relativePath of targetFiles) if (!existsSync(path.join(repoRoot, relativePath))) errors.push(`mandatory target ${relativePath} is missing`);
  if (!String(scripts['test:api']).includes('@symphony/api')) errors.push('test:api must invoke the API workspace suite');
  if (!String(scripts['test:workspace']).includes('@symphony/workspace')) errors.push('test:workspace must invoke the workspace unit suite');
  if (!String(scripts['test:login:api']).includes('tests/workspace/login-api.spec.ts') || !String(scripts['test:login:api']).includes('playwright.phase1.config.ts')) errors.push('test:login:api must run the no-mock browser-to-API acceptance spec with its dedicated composition config');
  if (!String(scripts['test:bdd:phase1']).includes('tools/run_phase1_bdd.mjs')) errors.push('test:bdd:phase1 must enforce the frozen scenario manifest and zero-discovery failure');

  const workspaceApiScripts = readJson('apps/api/package.json').scripts ?? {};
  const workspaceScripts = readJson('apps/workspace/package.json').scripts ?? {};
  const operationChecks = [
    [scripts['verify:phase0'], 'test:phase0-contract'],
    [scripts['verify:phase0'], 'verify:archive-hygiene'],
    [scripts['typecheck:v4'], 'tsc --build --force'],
    [scripts['verify:arch'], 'depcruise'],
    [scripts['test:unit'], 'vitest run'],
    [scripts['test:db:migrations'], 'tools/require_migration_test_db.mjs'],
    [scripts['test:db'], 'vitest run'],
    [scripts['test:api'], '@symphony/api'],
    [workspaceApiScripts['test:api'], 'vitest run'],
    [scripts['test:workspace'], '@symphony/workspace'],
    [workspaceScripts['test:unit'], 'vitest run'],
    [scripts['test:bdd:phase1'], 'tools/run_phase1_bdd.mjs'],
    [scripts['verify:trace'], 'tools/verify-trace.ts'],
    [scripts['test:a11y'], 'tests/workspace/a11y.spec.ts'],
    [scripts['test:login:api'], 'tests/workspace/login-api.spec.ts'],
    [scripts['verify:legacy-floor'], 'npm run build'],
    [scripts['test:e2e'], 'tools/run_e2e.mjs'],
  ];
  for (const [command, target] of operationChecks) {
    if (typeof command !== 'string' || !command.includes(target)) errors.push(`mandatory operation is missing or no-op; expected target ${target}`);
    if (typeof command === 'string' && /--if-present|(?:^|\s)(?:echo|Write-Output)\s/i.test(command)) errors.push(`mandatory operation for ${target} is optional or a no-op`);
  }
  const loginApiSpec = path.join(repoRoot, 'tests/workspace/login-api.spec.ts');
  if (existsSync(loginApiSpec) && /page\.route\s*\(|route\.fulfill\s*\(/.test(readFileSync(loginApiSpec, 'utf8'))) {
    errors.push('test:login:api may not intercept or fulfill the authentication request');
  }

  const manifestPath = path.join(repoRoot, 'evidence/phase1/bdd-scenarios.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const seen = new Set();
    for (const scenario of manifest.scenarios ?? []) {
      if (seen.has(scenario.id)) errors.push(`duplicate Phase 1 BDD scenario ${scenario.id}`);
      seen.add(scenario.id);
      if (!existsSync(path.join(repoRoot, scenario.feature))) errors.push(`${scenario.id} feature source is missing: ${scenario.feature}`);
      else {
        const source = readFileSync(path.join(repoRoot, scenario.feature), 'utf8');
        if (!source.includes(`@${scenario.id}`)) errors.push(`${scenario.id} is not present in ${scenario.feature}`);
      }
      if (typeof scenario.proves !== 'string' || scenario.proves.trim().length < 20) errors.push(`${scenario.id} needs an observable acceptance purpose`);
    }
  } else errors.push('Phase 1 BDD scenario manifest is missing');
  return [...new Set(errors)];
}

function main() {
  const schema = readJson('evidence/phase1/task-evidence.schema.json');
  const example = readJson('evidence/phase1/examples/wp0-12.example.json');
  const graph = readJson('evidence/phase1/task-dependencies.yml');
  const records = readJson('evidence/phase1/tasks.json');
  const readiness = readJson('evidence/phase1/wp0-closure-readiness.json');
  const modeMatrix = readJson('evidence/phase1/runtime-mode-matrix.json');
  const tenantInventory = readJson('evidence/phase1/tenant-table-inventory.json');
  const tenantPolicyMatrix = readJson('evidence/phase1/tenant-table-policy-matrix.json');
  const authorityInventory = readJson('evidence/phase1/authority-dependency-inventory.json');
  const purgeMatrix = readJson('evidence/phase1/purge-table-policy-matrix.json');
  const bddManifest = readJson('evidence/phase1/bdd-scenarios.json');
  const bddOwnerMap = readJson('evidence/phase1/bdd-work-package-map.json');
  const migrationFiles = readdirSync(path.join(ROOT, 'migrations')).filter((filename) => filename.endsWith('.sql'));
  const migrationTexts = migrationFiles.map((filename) => readFileSync(path.join(ROOT, 'migrations', filename), 'utf8'));
  const errors = [
    ...validateEvidence(example, schema).map((error) => `evidence example: ${error}`),
    ...records.flatMap((record) => validateEvidence(record, schema).map((error) => `${record.task_id}: ${error}`)),
    ...validateDeferredFollowups(records, graph).map((error) => `deferred follow-up: ${error}`),
    ...validateDependencyGraph(graph, {}).map((error) => `dependency graph: ${error}`),
    ...validatePhase1Gate(readJson('package.json')).map((error) => `Phase 1 gate: ${error}`),
    ...validateTenantTableInventory(tenantInventory, migrationTexts).map((error) => `tenant inventory: ${error}`),
    ...validateTenantPolicyMatrix(tenantPolicyMatrix, tenantInventory).map((error) => `tenant policy matrix: ${error}`),
    ...validateAuthorityDependencyInventory(authorityInventory, tenantInventory).map((error) => `authority inventory: ${error}`),
    ...validatePurgeTablePolicyMatrix(purgeMatrix, tenantInventory).map((error) => `purge matrix: ${error}`),
    ...validateBddOwnerMap(bddOwnerMap, bddManifest, graph).map((error) => `BDD owner map: ${error}`),
  ];
  if (records.length !== WP0_IDS.length || WP0_IDS.some((id) => !records.some((record) => record.task_id === id))) {
    errors.push('task evidence must include exactly one common-schema record for every WP0.1-WP0.13 task');
  }
  const recordMap = Object.fromEntries(records.map((record) => [record.task_id, record]));
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('Phase 1 WP0 contract artifacts are structurally valid.');
  console.log(`Dependency graph: ${Object.keys(graph.tasks).length} task nodes; all edges are known, justified and acyclic.`);
  console.log('Phase 1 gate manifest: all mandatory commands and BDD scenario source IDs resolve.');
  console.log(`Runtime mode contract: ${modeMatrix.profiles.length} allowed profiles; every other pair is rejected.`);
  const rlsProtected = tenantInventory.tables.filter((entry) => entry.rls_current).length;
  console.log(`Tenant inventory: ${tenantInventory.tables.length} migrated tables classified; ${rlsProtected} currently have ENABLE+FORCE RLS.`);
  const closureBlockers = validateDependencyGraph(graph, recordMap, 'WP0.13', readiness);
  console.log(`WP0.13 is ${closureBlockers.length ? `BLOCKED (${closureBlockers.length} unmet prerequisites)` : 'eligible for owner sign-off'}.`);
  for (const blocker of closureBlockers) console.log(`WP0.13 unmet: ${blocker}`);
  console.log(`Project owner: ${readiness.project_owner_signed ? 'signed' : 'pending'}; independent reviewer: ${readiness.independent_reviewer_named ? 'identified' : 'not identified'}; WP1 remains blocked until WP0.13 passes.`);
  console.log('This validates the gate structure only; it does not claim WP0 acceptance or Phase 1 product behavior.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
