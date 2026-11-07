import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateEvidence,
  validateDependencyGraph,
  validateDeferredFollowups,
  validatePhase1Gate,
  validatePhase1BddReport,
  validateBddOwnerMap,
  validateRuntimeMode,
  validateTenantTableInventory,
  validateTenantPolicyMatrix,
  validateAuthorityDependencyInventory,
  validatePurgeTablePolicyMatrix,
} from '../../tools/phase1-contracts.js';
import {
  canonicalizeJcs,
  commandDigest,
  digestForReceipt,
  parseJsonRejectingDuplicateKeys,
  resolveReceiptAttempts,
  semanticEnvelope,
  decideReconciliationAccess,
  correctedCommandUsesFreshId,
  checkPurgePreflight,
  authorizeDemoMutation,
  sessionValidity,
  reconciliationExpiryDisposition,
  forcedChangeRouteAllowed,
  validateUnsafeSessionRequest,
  receiptReplayVisibility,
  isSafeReceiptResult,
  authorityRaceOutcome,
  validateAndMaterializeCommandPayload,
  resolveCommandContractVersions,
  resolveUncertainCommandCommit,
} from '../../tools/phase1-command-contract-oracle.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = (relativePath: string): any => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

describe('WP0.1 executable command contract vectors', () => {
  const vectors = readJson('evidence/phase1/command-contract-vectors.json');

  it('canonicalizes the approved semantic envelope and matches the fixed HMAC-SHA-256 vector', () => {
    const envelope = semanticEnvelope(vectors.semantic_command);
    expect(canonicalizeJcs(envelope)).toBe(vectors.expected_canonical_semantic_json);
    expect(commandDigest(vectors.semantic_command, vectors.fixture_key)).toBe(vectors.expected_hmac_sha256);
    expect(envelope).not.toHaveProperty('command_id');
  });

  it('materializes schema defaults before canonicalization, preserves null semantics, and rejects unknown fields', () => {
    const schema = { properties: { name: { type: 'string', required: true }, active: { type: 'boolean', default: true }, note: { type: 'string', nullable: true } } };
    const defaulted = validateAndMaterializeCommandPayload({ name: 'Co-op' }, schema);
    const explicit = validateAndMaterializeCommandPayload({ name: 'Co-op', active: true }, schema);
    expect(canonicalizeJcs(defaulted)).toBe(canonicalizeJcs(explicit));
    expect(canonicalizeJcs(validateAndMaterializeCommandPayload({ name: 'Co-op' }, schema)))
      .not.toBe(canonicalizeJcs(validateAndMaterializeCommandPayload({ name: 'Co-op', note: null }, schema)));
    expect(() => validateAndMaterializeCommandPayload({ name: 'Co-op', ownerRole: 'admin' }, schema)).toThrow(/unknown field/);
    expect(() => validateAndMaterializeCommandPayload({ active: true }, schema)).toThrow(/required field/);
  });

  it('loads the receipt schema and canonicalizer versions and fails closed when either version is missing', () => {
    const available = { schemaVersions: [1], canonicalizationVersions: ['jcs-rfc8785-v1'] };
    expect(resolveCommandContractVersions({ command_schema_version: 1, canonicalization_version: 'jcs-rfc8785-v1' }, available))
      .toEqual({ schema_version: 1, canonicalization_version: 'jcs-rfc8785-v1' });
    expect(() => resolveCommandContractVersions({ command_schema_version: 0, canonicalization_version: 'jcs-rfc8785-v1' }, available)).toThrow(/schema version/);
    expect(() => resolveCommandContractVersions({ command_schema_version: 1, canonicalization_version: 'retired' }, available)).toThrow(/canonicalization version/);
  });

  it('excludes client timestamps, device, request, trace and correlation metadata from command identity', () => {
    const changedMetadata = structuredClone(vectors.semantic_command);
    for (const field of vectors.metadata_fields) changedMetadata[field] = `changed-${field}`;
    expect(commandDigest(changedMetadata, vectors.fixture_key)).toBe(vectors.expected_hmac_sha256);
  });

  it('changes semantic identity when semantic fields change but excludes command_id lookup identity', () => {
    const changedLookupId = structuredClone(vectors.semantic_command);
    changedLookupId.command_id = 'command-02';
    expect(commandDigest(changedLookupId, vectors.fixture_key)).toBe(vectors.expected_hmac_sha256);
    expect(semanticEnvelope(changedLookupId)).not.toHaveProperty('command_id');

    for (const change of [
      (command: any) => { command.actor_id = 'actor-02'; },
      (command: any) => { command.command_type = 'membership.delete'; },
      (command: any) => { command.command_schema_version = 2; },
      (command: any) => { command.expected_aggregate_version = 8; },
      (command: any) => { command.payload.name = 'Changed'; },
    ]) {
      const changed = structuredClone(vectors.semantic_command);
      change(changed);
      expect(commandDigest(changed, vectors.fixture_key)).not.toBe(vectors.expected_hmac_sha256);
    }
  });

  it('uses tenant plus command ID as lookup identity, with no binding after denial or pre-commit failure', () => {
    const attempts = [
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: {}, authorized: false },
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: {}, authorized: true },
      { tenant_id: 'tenant-01', command_id: 'command-02', actor_id: 'actor-01', payload: {}, authorized: true },
      { tenant_id: 'tenant-02', command_id: 'command-01', actor_id: 'actor-01', payload: {}, authorized: true },
    ];
    expect(resolveReceiptAttempts(attempts, vectors.fixture_key)).toEqual(['denied_no_receipt', 'committed', 'committed', 'committed']);
  });

  it('commits authorized stale conflict as terminal replayable outcome without accepting a second result', () => {
    const attempts = [
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: { name: 'stale' }, authorized: true, terminal_stale: true },
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: { name: 'stale' }, authorized: true },
    ];
    expect(resolveReceiptAttempts(attempts, vectors.fixture_key)).toEqual(['committed_terminal_conflict', 'replayed']);
  });

  it('keeps uncommitted receipts invisible and resolves a lost post-commit response with the same ID', () => {
    expect(receiptReplayVisibility({ transactionCommitted: false, resultClassification: 'success', safeResult: { status: 'ok' } }))
      .toEqual({ visible: false, replayable: false });
    expect(receiptReplayVisibility({ transactionCommitted: true, resultClassification: 'pending', safeResult: null }))
      .toEqual({ visible: false, replayable: false });
    expect(receiptReplayVisibility({ transactionCommitted: true, resultClassification: 'success', safeResult: { status: 'ok' } }))
      .toEqual({ visible: true, replayable: true });
    expect(resolveReceiptAttempts([
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: {}, authorized: true, response_lost_after_commit: true },
      { tenant_id: 'tenant-01', command_id: 'command-01', actor_id: 'actor-01', payload: {}, authorized: true },
    ], vectors.fixture_key)).toEqual(['committed_response_lost', 'replayed']);
  });

  it('resolves uncertain commit only from authoritative receipt state and never retries under a new ID', () => {
    expect(resolveUncertainCommandCommit({ receiptState: 'committed_matching' })).toEqual('replay_committed_result');
    expect(resolveUncertainCommandCommit({ receiptState: 'committed_mismatching' })).toEqual('non_disclosing_key_reuse_denial');
    expect(resolveUncertainCommandCommit({ receiptState: 'absent_after_lock' })).toEqual('retry_same_id_as_new_owner');
    expect(resolveUncertainCommandCommit({ receiptState: 'unknown' })).toEqual('retry_or_query_same_id_only');
  });

  it('accepts only allowlisted safe receipt fields and rejects raw request payloads and NRC canaries', () => {
    expect(isSafeReceiptResult({ status: 'conflict', aggregate_version: 4, reconciliation_id: 'opaque-ref' })).toBe(true);
    expect(isSafeReceiptResult({ status: 'ok', payload: { name: 'Raw request' } })).toBe(false);
    expect(isSafeReceiptResult({ status: 'ok', detail: 'NRC TS0001/01/1' }, ['status', 'detail'])).toBe(false);
  });

  it('verifies an existing receipt with its retained key version and fails closed if that key is missing', () => {
    expect(digestForReceipt(vectors.semantic_command, vectors.historical_key_version, {
      [vectors.historical_key_version]: vectors.historical_fixture_key,
      [vectors.key_version]: vectors.fixture_key,
    })).toBe(vectors.expected_historical_hmac_sha256);
    expect(() => digestForReceipt(vectors.semantic_command, 'retired-too-early', {
      [vectors.key_version]: vectors.fixture_key,
    })).toThrow(/missing historical HMAC key/);
  });

  it('uses JCS object-key ordering, stable array ordering, and ECMAScript number serialization', () => {
    expect(canonicalizeJcs({ z: 333333333.33333329, a: -0, list: [2, 1] }))
      .toBe('{"a":0,"list":[2,1],"z":333333333.3333333}');
  });

  it('rejects duplicate JSON member names, invalid Unicode, non-finite and non-JSON values', () => {
    expect(() => parseJsonRejectingDuplicateKeys('{"a":1,"a":2}')).toThrow(/duplicate object key/);
    expect(() => parseJsonRejectingDuplicateKeys('{"x":"\\ud800"}')).toThrow(/surrogate/);
    expect(() => canonicalizeJcs({ n: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
    expect(() => canonicalizeJcs({ n: undefined })).toThrow(/valid JSON/);
  });

  for (const race of vectors.races) it(`matches the ${race.id} attempt/receipt outcome vector`, () => {
    expect(resolveReceiptAttempts(race.attempts, vectors.fixture_key)).toEqual(race.expected);
  });
});

describe('WP0.2 executable reconciliation contract vectors', () => {
  const vectors = readJson('evidence/phase1/reconciliation-contract-vectors.json');

  for (const testCase of vectors.access_cases) it(`enforces ${testCase.id} with current tenant membership and permission`, () => {
    const item = {
      ...vectors.open_item,
      lifecycle: testCase.item_lifecycle ?? vectors.open_item.lifecycle,
      expires_at: testCase.item_expires_at ?? vectors.open_item.expires_at,
    };
    const actual = decideReconciliationAccess({
      item,
      actorId: testCase.actor_id,
      tenantId: testCase.tenant_id,
      memberActive: testCase.member_active,
      canReadOwn: testCase.can_read_own,
      canTakeOver: testCase.can_take_over,
      now: vectors.now,
    });
    expect(actual).toEqual(testCase.expected);
  });

  for (const testCase of vectors.fresh_command_id_cases) it(`enforces ${testCase.id}`, () => {
    expect(correctedCommandUsesFreshId(testCase.original, testCase.corrected)).toBe(testCase.expected);
  });

  it('retains encrypted payload before policy expiry and deletes active payload at the exact expiry boundary', () => {
    expect(reconciliationExpiryDisposition({ now: '2030-01-01T23:59:59.999Z', expiresAt: vectors.open_item.expires_at, lifecycle: 'open' }))
      .toEqual({ action: 'retain_encrypted_active_payload', payloadAccessible: true });
    expect(reconciliationExpiryDisposition({ now: vectors.open_item.expires_at, expiresAt: vectors.open_item.expires_at, lifecycle: 'open' }))
      .toEqual({ action: 'delete_active_payload_and_retain_tombstone', payloadAccessible: false });
    expect(reconciliationExpiryDisposition({ now: '2030-01-02T00:00:00.001Z', expiresAt: vectors.open_item.expires_at, lifecycle: 'open' }))
      .toEqual({ action: 'delete_active_payload_and_retain_tombstone', payloadAccessible: false });
  });
});

describe('WP0.5 purge preflight decision vectors', () => {
  const baseline = {
    runtimeProfile: 'test', dataMode: 'test', syntheticOnly: true,
    database: 'symphony_phase1_test', expectedDatabase: 'symphony_phase1_test',
    schema: 'symphony', expectedSchema: 'symphony', marker: 'symphony-disposable-test:v1', expectedMarker: 'symphony-disposable-test:v1',
    role: 'symphony_phase1_purger', expectedPurgeRole: 'symphony_phase1_purger',
    roleConnectDatabase: 'symphony_phase1_test',
    roleCapabilities: { isOwner: false, superuser: false, createdb: false, createrole: false, bypassrls: false, canConnectProduction: false, canDdl: false, isApplicationRole: false, deleteOutsideAllowlist: false, mutateAudit: false },
    allowlist: ['tenant_records'], auditLedger: 'purge_audit',
    unknownTables: [], cascade: false,
  };

  it('allows destructive SQL only after every independent target and privilege guard passes', () => {
    expect(checkPurgePreflight(baseline)).toEqual({ allowed: true, errors: [], destructiveSqlMayRun: true });
  });

  it.each([
    ['wrong profile', { runtimeProfile: 'production' }, 'runtime_profile_not_test'],
    ['real-data mode', { dataMode: 'real' }, 'data_mode_not_test'],
    ['non-synthetic data', { syntheticOnly: false }, 'data_not_confirmed_synthetic'],
    ['wrong database', { database: 'symphony' }, 'database_identity_mismatch'],
    ['wrong schema', { schema: 'public' }, 'schema_identity_mismatch'],
    ['missing marker', { marker: null }, 'disposable_marker_mismatch'],
    ['application role', { role: 'symphony_app' }, 'dedicated_purge_role_required'],
    ['wrong marker', { marker: 'wrong-marker' }, 'disposable_marker_mismatch'],
    ['wrong role database', { roleConnectDatabase: 'production' }, 'purge_role_database_scope_mismatch'],
    ['owner role', { roleCapabilities: { ...baseline.roleCapabilities, isOwner: true } }, 'purge_role_must_not_own_target_objects'],
    ['cluster privilege', { roleCapabilities: { ...baseline.roleCapabilities, bypassrls: true } }, 'purge_role_has_forbidden_cluster_privilege'],
    ['production-capable credential', { roleCapabilities: { ...baseline.roleCapabilities, canConnectProduction: true } }, 'purge_role_production_scope_not_excluded'],
    ['DDL privilege', { roleCapabilities: { ...baseline.roleCapabilities, canDdl: true } }, 'purge_role_grants_exceed_contract'],
    ['application role reuse', { roleCapabilities: { ...baseline.roleCapabilities, isApplicationRole: true } }, 'purge_role_grants_exceed_contract'],
    ['missing allowlist', { allowlist: [] }, 'explicit_allowlist_required'],
    ['audit ledger in allowlist', { allowlist: ['tenant_records', 'purge_audit'] }, 'audit_ledger_must_be_excluded'],
    ['unknown table', { unknownTables: ['new_table'] }, 'unknown_tables_in_inventory'],
    ['cascade delete', { cascade: true }, 'cascade_prohibited'],
  ])('refuses before destructive SQL for %s', (_name, overrides, error) => {
    const result = checkPurgePreflight({ ...baseline, ...overrides });
    expect(result.allowed).toBe(false);
    expect(result.destructiveSqlMayRun).toBe(false);
    expect(result.errors).toContain(error);
  });
});

describe('WP0.6 server-side demo authorization vectors', () => {
  const baseline = {
    runtimeProfile: 'demo', dataMode: 'test', syntheticOnly: true,
    actorId: 'demo-actor', configuredActorId: 'demo-actor',
    tenantId: 'demo-tenant', configuredTenantId: 'demo-tenant',
    operation: 'demo.reset', serverAuthorized: true,
  };

  it('allows only the configured synthetic actor and tenant for the demo reset operation', () => {
    expect(authorizeDemoMutation({ ...baseline, clientClaimedRole: 'admin' }))
      .toEqual({ allowed: true, reason: 'allowed' });
  });

  it.each([
    ['production profile', { runtimeProfile: 'production' }],
    ['real-data mode', { dataMode: 'real' }],
    ['non-synthetic data', { syntheticOnly: false }],
    ['wrong actor despite forged admin header', { actorId: 'attacker', clientClaimedRole: 'admin' }],
    ['wrong tenant', { tenantId: 'other-tenant' }],
    ['purge operation', { operation: 'purge:seed' }],
    ['failed server authorization', { serverAuthorized: false }],
  ])('denies %s without revealing scope', (_name, overrides) => {
    expect(authorizeDemoMutation({ ...baseline, ...overrides }))
      .toEqual({ allowed: false, reason: 'denied_non_disclosing' });
  });
});

describe('WP0.10 session policy boundary vectors', () => {
  const policy = { idleLimitMs: 30 * 60 * 1000, absoluteLimitMs: 12 * 60 * 60 * 1000 };
  const issuedAtMs = 1_000_000;

  it('accepts immediately before both expiry boundaries', () => {
    expect(sessionValidity({ nowMs: issuedAtMs + policy.idleLimitMs - 1, issuedAtMs, lastActivityAtMs: issuedAtMs, ...policy }))
      .toEqual({ valid: true, reason: 'active' });
    expect(sessionValidity({ nowMs: issuedAtMs + policy.absoluteLimitMs - 1, issuedAtMs, lastActivityAtMs: issuedAtMs + policy.absoluteLimitMs - 1, ...policy }))
      .toEqual({ valid: true, reason: 'active' });
  });

  it('rejects exactly at and after idle or absolute expiry and always rejects revoked sessions', () => {
    expect(sessionValidity({ nowMs: issuedAtMs + policy.idleLimitMs, issuedAtMs, lastActivityAtMs: issuedAtMs, ...policy }))
      .toEqual({ valid: false, reason: 'idle_expiry' });
    expect(sessionValidity({ nowMs: issuedAtMs + policy.absoluteLimitMs, issuedAtMs, lastActivityAtMs: issuedAtMs + policy.absoluteLimitMs - 1, ...policy }))
      .toEqual({ valid: false, reason: 'absolute_expiry' });
    expect(sessionValidity({ nowMs: issuedAtMs + 1, issuedAtMs, lastActivityAtMs: issuedAtMs, revokedAtMs: issuedAtMs + 1, ...policy }))
      .toEqual({ valid: false, reason: 'revoked' });
  });

  it('allows only the exact forced-change auth endpoints and rejects protected product routes', () => {
    for (const [method, route] of [
      ['GET', '/auth/csrf'], ['GET', '/auth/session'],
      ['POST', '/auth/change-password'], ['POST', '/auth/logout'],
    ]) expect(forcedChangeRouteAllowed(method, route), `${method} ${route}`).toBe(true);
    for (const [method, route] of [
      ['POST', '/auth/login'], ['GET', '/members'], ['POST', '/commands'],
      ['POST', '/auth/logout/'], ['GET', '/auth/change-password'],
    ]) expect(forcedChangeRouteAllowed(method, route), `${method} ${route}`).toBe(false);
  });

  it('requires both same-origin and synchronizer token on every unsafe session request', () => {
    const baseline = { method: 'POST', origin: 'https://app.example.test', expectedOrigin: 'https://app.example.test', csrfToken: 'token-a', expectedCsrfToken: 'token-a' };
    expect(validateUnsafeSessionRequest(baseline)).toEqual({ allowed: true, reason: 'validated' });
    expect(validateUnsafeSessionRequest({ ...baseline, origin: 'https://attacker.example' })).toEqual({ allowed: false, reason: 'origin_denied' });
    expect(validateUnsafeSessionRequest({ ...baseline, csrfToken: 'token-b' })).toEqual({ allowed: false, reason: 'csrf_denied' });
    expect(validateUnsafeSessionRequest({ ...baseline, csrfToken: undefined })).toEqual({ allowed: false, reason: 'csrf_denied' });
    expect(validateUnsafeSessionRequest({ ...baseline, method: 'GET', csrfToken: undefined, origin: undefined })).toEqual({ allowed: true, reason: 'safe_method' });
  });

  it('matches the approved auth matrix values and exact forced-change endpoint set', () => {
    const matrix = readJson('evidence/phase1/authentication-session-policy-matrix.json');
    expect(matrix.session.cookie).toEqual({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(matrix.session.idle_timeout_seconds).toBe(1800);
    expect(matrix.session.absolute_timeout_seconds).toBe(43200);
    expect(matrix.temporary_credential.lifetime_seconds).toBe(259200);
    expect(matrix.unsafe_request_protection.synchronizer_token_required).toBe(true);
    expect(matrix.unsafe_request_protection.origin_required).toBe(true);
    for (const route of matrix.forced_change_allowlist) expect(forcedChangeRouteAllowed(route.method, route.path)).toBe(true);
    for (const route of matrix.explicitly_denied_while_forced_change) expect(forcedChangeRouteAllowed(route.method, route.path)).toBe(false);
    expect(matrix.rate_limit.numeric_parameters).toMatch(/not specified/);
    expect(matrix.password_policy.rule).toMatch(/not specified/);
  });
});

describe('WP0.12 evidence contract', () => {
  it('accepts the published example against the versioned JSON Schema', () => {
    const schema = readJson('evidence/phase1/task-evidence.schema.json');
    const example = readJson('evidence/phase1/examples/wp0-12.example.json');
    expect(validateEvidence(example, schema)).toEqual([]);
  });

  it.each([
    ['missing required task ID', (record: Record<string, unknown>) => { delete record.task_id; }],
    ['invalid status', (record: Record<string, any>) => { record.status.implementation = 'done'; }],
    ['secret-shaped property', (record: Record<string, any>) => { record.claims.api_key = 'not-a-real-secret'; }],
    ['absolute artifact path', (record: Record<string, any>) => { record.commands[0].artifact = 'C:/private/run.log'; }],
  ])('rejects %s', (_name, mutate) => {
    const schema = readJson('evidence/phase1/task-evidence.schema.json');
    const record = structuredClone(readJson('evidence/phase1/examples/wp0-12.example.json')) as Record<string, any>;
    mutate(record);
    expect(validateEvidence(record, schema).length).toBeGreaterThan(0);
  });

  it('accepts a downstream product-path follow-up without treating it as an unresolved WP0 decision', () => {
    const schema = readJson('evidence/phase1/task-evidence.schema.json');
    const record = structuredClone(readJson('evidence/phase1/examples/wp0-12.example.json')) as Record<string, any>;
    record.deferred_followups = [{
      task_id: 'WP1.2',
      scope: 'Exercise receipt atomicity against the PostgreSQL transaction adapter.',
      acceptance_evidence: 'Focused PostgreSQL integration suite proves rollback and no partial receipt/event/outbox rows.',
    }];
    expect(validateEvidence(record, schema)).toEqual([]);
  });

  it('rejects a downstream follow-up without an owning task or acceptance evidence', () => {
    const schema = readJson('evidence/phase1/task-evidence.schema.json');
    const record = structuredClone(readJson('evidence/phase1/examples/wp0-12.example.json')) as Record<string, any>;
    record.deferred_followups = [{ scope: 'Test PostgreSQL behavior later.' }];
    expect(validateEvidence(record, schema).join(' ')).toMatch(/deferred_followups/);
  });
});

describe('WP0.13 dependency gate', () => {
  it('requires all WP0 tasks, known nodes, justified acyclic edges, and passing predecessors', () => {
    const graph = readJson('evidence/phase1/task-dependencies.yml');
    const records = Object.fromEntries((readJson('evidence/phase1/tasks.json') as Array<Record<string, any>>).map((record) => [record.task_id, record]));
    const readiness = readJson('evidence/phase1/wp0-closure-readiness.json');
    expect(validateDependencyGraph(graph, records, 'WP0.13', readiness)).toContain('WP0.13 Phase 0 candidate must be a clean exact commit');
    expect(validateDependencyGraph(graph, records, 'WP1.1')).toContain('WP0.13 has no passing completion record');
  });

  it('rejects a cycle, an unknown predecessor, and a predecessor without a reason', () => {
    const invalid = {
      version: 1,
      tasks: {
        'WP0.1': { depends_on: ['WP0.2'], edge_reasons: { 'WP0.2': 'fixture reason' } },
        'WP0.2': { depends_on: ['WP0.1'], edge_reasons: { 'WP0.1': 'fixture reason' } },
      },
    };
    expect(validateDependencyGraph(invalid, {}, 'WP0.1').join(' ')).toMatch(/cycle/i);
    expect(validateDependencyGraph({ version: 1, tasks: { 'WP0.1': { depends_on: ['WP9.9'], edge_reasons: {} } } }, {}, 'WP0.1').join(' ')).toMatch(/unknown/i);
  });

  it('does not let WP0.13 pass without explicit owner, Phase 0, decision, and independent-review sign-off', () => {
    const graph = readJson('evidence/phase1/task-dependencies.yml');
    expect(validateDependencyGraph(graph, {}, 'WP0.13', {}).join(' ')).toContain('project_owner_signed is not confirmed');
  });

  it('rejects a dirty Phase 0 candidate even when every reviewer and owner flag is true', () => {
    const graph = readJson('evidence/phase1/task-dependencies.yml');
    const readiness = {
      project_owner_signed: true, phase0_candidate_passed: true, phase0_candidate_worktree_dirty: true,
      phase0_candidate_commit: 'c25b616fa2e0f75b14327d87747880a227cbb8b2', all_contract_decisions_resolved: true,
      independent_reviewer_named: true, reviewer_independent: true, reviewer_available: true,
    };
    expect(validateDependencyGraph(graph, {}, 'WP0.13', readiness).join(' ')).toContain('must be a clean exact commit');
  });
});

describe('WP0 phase-boundary evidence', () => {
  it('requires product-path deferrals to name a real downstream task and acceptance evidence', () => {
    const graph = readJson('evidence/phase1/task-dependencies.yml');
    const records = readJson('evidence/phase1/tasks.json') as Array<Record<string, any>>;
    expect(validateDeferredFollowups(records, graph)).toEqual([]);
  });

  it('rejects a missing or self-owned deferred product-path test', () => {
    const graph = { tasks: { 'WP0.1': {}, 'WP1.2': {} } };
    const record = {
      task_id: 'WP0.1',
      status: { integration_test: 'not_applicable', bdd_ui_test: 'not_applicable' },
      deferred_followups: [{ task_id: 'WP0.1' }],
    };
    expect(validateDeferredFollowups([record], graph).join(' ')).toMatch(/cannot be owned by the same task/);
  });
});

describe('Phase 1 BDD discovery', () => {
  it('fails instead of accepting zero discovery or a missing frozen scenario', () => {
    const manifest = readJson('evidence/phase1/bdd-scenarios.json');
    const errors = validatePhase1BddReport([], manifest);
    expect(errors).toContain('BDD-ENR-004 was not executed (missing, filtered, or still @wip)');
  });

  it('accepts a scenario only when it is reported with every step passed', () => {
    const manifest = { scenarios: [{ id: 'BDD-AUD-001' }] };
    const passed = [{ elements: [{ tags: [{ name: '@BDD-AUD-001' }], steps: [{ result: { status: 'passed' } }] }] }];
    const pending = [{ elements: [{ tags: [{ name: '@BDD-AUD-001' }], steps: [{ result: { status: 'pending' } }] }] }];
    expect(validatePhase1BddReport(passed, manifest)).toEqual([]);
    expect(validatePhase1BddReport(pending, manifest)).toContain('BDD-AUD-001 did not pass every step');
  });

  it('maps every frozen scenario exactly once to a source requirement, real owner task, and required path', () => {
    const manifest = readJson('evidence/phase1/bdd-scenarios.json');
    const mapping = readJson('evidence/phase1/bdd-work-package-map.json');
    const graph = readJson('evidence/phase1/task-dependencies.yml');
    expect(validateBddOwnerMap(mapping, manifest, graph)).toEqual([]);
  });

  it('fails closed if a frozen scenario is omitted or its owner is not in the task graph', () => {
    const manifest = { scenarios: [{ id: 'BDD-AUD-001', feature: 'features/09_commands_audit_and_integrity.feature' }] };
    const graph = { tasks: { 'WP1.2': {} } };
    const missing = { scenarios: [] };
    expect(validateBddOwnerMap(missing, manifest, graph).join(' ')).toContain('exactly one owner/path mapping');
    const invalid = { scenarios: [{ id: 'BDD-AUD-001', feature: manifest.scenarios[0].feature, requirements: ['REQ-AUD-001'], owner_tasks: ['WP9.9'], required_path: 'real API path with observable assertions', assertion_rule: 'observable assertions required' }] };
    expect(validateBddOwnerMap(invalid, manifest, graph).join(' ')).toContain('unknown owner WP9.9');
  });
});

describe('WP0.11 runtime/data mode contract', () => {
  const matrix = readJson('evidence/phase1/runtime-mode-matrix.json');

  it('accepts each documented profile only when its critical composition guard is present', () => {
    for (const profile of matrix.profiles) {
      const config = {
        RUNTIME_PROFILE: profile.id,
        APP_ENV: profile.APP_ENV,
        DATA_MODE: profile.DATA_MODE,
        key_provider: profile.key_provider,
        synthetic_only: profile.DATA_MODE === 'test',
        residency_approved: profile.DATA_MODE === 'real',
        demo_controls: false,
        demo_actor_tenant_configured: profile.demo === 'designated-actor-and-tenant-only',
        purge_enabled: false,
        purge_role_dedicated: false,
        database_isolated_disposable: profile.database.includes('disposable'),
        persistent_database: profile.DATA_MODE === 'real',
        app_role_least_privilege: true,
      };
      expect(validateRuntimeMode(matrix, config), profile.id).toEqual([]);
    }
  });

  it.each([
    ['test', 'real'], ['development', 'real'], ['staging', 'test'], ['production', 'test'],
  ])('rejects unratified profile %s/%s', (APP_ENV, DATA_MODE) => {
    expect(validateRuntimeMode(matrix, { APP_ENV, DATA_MODE }).join(' ')).toMatch(/unsupported or missing RUNTIME_PROFILE/);
  });

  it('rejects contradictory key, residency, demo, purge and synthetic-data settings', () => {
    const baseline = { database_isolated_disposable: true, app_role_least_privilege: true, persistent_database: false, purge_role_dedicated: false, demo_actor_tenant_configured: false };
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'production', APP_ENV: 'production', DATA_MODE: 'real', key_provider: 'local-test', residency_approved: true, demo_controls: true, purge_enabled: true }).join(' ')).toMatch(/local\/test.*prohibits demo.*prohibits purge/);
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'demo', APP_ENV: 'development', DATA_MODE: 'test', key_provider: 'local-development', synthetic_only: false })).toContain('demo requires synthetic_only=true');
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'real-data-staging', APP_ENV: 'staging', DATA_MODE: 'real', key_provider: 'approved-managed', residency_approved: false, persistent_database: true })).toContain('real-data-staging requires approved residency before startup');
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'production', APP_ENV: 'staging', DATA_MODE: 'real' })).toContain('production requires APP_ENV=production and DATA_MODE=real');
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'demo', APP_ENV: 'development', DATA_MODE: 'test', key_provider: 'ephemeral-test', synthetic_only: true })).toContain('demo requires key_provider=development-demo');
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test', key_provider: 'ephemeral-test', synthetic_only: true, purge_enabled: true })).toContain('test purge requires a dedicated purge role');
    expect(validateRuntimeMode(matrix, { ...baseline, RUNTIME_PROFILE: 'demo', APP_ENV: 'development', DATA_MODE: 'test', key_provider: 'development-demo', synthetic_only: true, demo_controls: true })).toContain('demo requires configured demo actor and tenant');
    expect(validateRuntimeMode(matrix, { ...baseline, app_role_least_privilege: false, RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test', key_provider: 'ephemeral-test', synthetic_only: true })).toContain('test requires a least-privilege application role');
    expect(validateRuntimeMode(matrix, { ...baseline, database_isolated_disposable: false, RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test', key_provider: 'ephemeral-test', synthetic_only: true })).toContain('test requires an isolated disposable database');
    expect(validateRuntimeMode(matrix, { ...baseline, persistent_database: false, RUNTIME_PROFILE: 'production', APP_ENV: 'production', DATA_MODE: 'real', key_provider: 'approved-production', synthetic_only: false, residency_approved: true })).toContain('production requires a persistent database');
  });
});

describe('WP0.3 migrated table inventory', () => {
  it('classifies every actual migration table and reports current ENABLE plus FORCE RLS accurately', () => {
    const inventory = readJson('evidence/phase1/tenant-table-inventory.json');
    const migrationDirectory = path.join(root, 'migrations');
    const migrations = readdirSync(migrationDirectory)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => readFileSync(path.join(migrationDirectory, name), 'utf8'));
    expect(validateTenantTableInventory(inventory, migrations)).toEqual([]);
    expect(inventory.tables.length).toBeGreaterThan(40);
    expect(inventory.tables.filter((table: { rls_current: boolean }) => table.rls_current).map((table: { table: string }) => table.table).sort()).toEqual(['command_receipts', 'domain_events']);
  });

  it('defines a least-privilege RLS/grant policy for every migrated table without pretending it is deployed', () => {
    const inventory = readJson('evidence/phase1/tenant-table-inventory.json');
    const matrix = readJson('evidence/phase1/tenant-table-policy-matrix.json');
    expect(validateTenantPolicyMatrix(matrix, inventory)).toEqual([]);
    expect(matrix.tables).toHaveLength(53);
    expect(matrix.roles.application).toContain('not provisioned');
  });
});

describe('WP0.4 authority dependency inventory', () => {
  it('covers every agreed mutable authorization dependency, its change paths and both serial orders', () => {
    const inventory = readJson('evidence/phase1/authority-dependency-inventory.json');
    const tables = readJson('evidence/phase1/tenant-table-inventory.json');
    expect(validateAuthorityDependencyInventory(inventory, tables)).toEqual([]);
    for (const dependency of inventory.dependencies) {
      for (const testCase of dependency.required_race_cases) {
        if (!testCase.includes('first-then')) continue;
        const protectedFirst = testCase.startsWith('protected-command-first-');
        const result = authorityRaceOutcome({
          linearizationOrder: protectedFirst ? 'protected-command-first' : 'authority-change-first',
          authorityActiveBeforeCommand: true,
        });
        expect(result.command, `${dependency.id}:${testCase}`).toBe(protectedFirst ? 'commits_before_authority_change' : 'denied_after_recheck');
      }
    }
  });
});

describe('WP0.7 privacy requirement-to-persistence trace', () => {
  it('maps every frozen privacy BDD ID to normative requirements, fields/gaps, actor audience and retention', () => {
    const mapping = readJson('evidence/phase1/privacy-field-requirement-map.json');
    const manifest = readJson('evidence/phase1/bdd-scenarios.json');
    const privacyScenarios = (manifest.scenarios as Array<{ id: string; feature: string }>).filter((scenario) => scenario.id.startsWith('BDD-PRV-'));
    const frozenPrivacyIds = privacyScenarios.map((scenario) => scenario.id).sort();
    const mappedIds = mapping.mappings.flatMap((row: { bdd_ids: string[] }) => row.bdd_ids).sort();
    expect(mappedIds).toEqual(frozenPrivacyIds);
    for (const row of mapping.mappings) {
      expect(row.requirements.length).toBeGreaterThan(0);
      expect(row.current_entity_fields.length).toBeGreaterThan(0);
      expect(row.command_or_transition.length).toBeGreaterThan(0);
      expect(row.audience.length).toBeGreaterThan(0);
      expect(row.lawful_basis.length).toBeGreaterThan(0);
      expect(row.retention.length).toBeGreaterThan(0);
      expect(row.status.length).toBeGreaterThan(0);
      const sourceText = row.bdd_ids.map((id: string) => {
        const sourceScenario = privacyScenarios.find((entry) => entry.id === id);
        return readFileSync(path.join(root, sourceScenario!.feature), 'utf8');
      });
      for (const requirement of row.requirements) expect(sourceText.some((source: string) => source.includes(`@${requirement}`))).toBe(true);
      for (const id of row.bdd_ids) {
        const scenario = privacyScenarios.find((entry) => entry.id === id);
        expect(scenario, `frozen source for ${id}`).toBeDefined();
      }
    }
  });
});

describe('WP0.5 purge allowlist and preservation matrix', () => {
  it('covers every migration table exactly once with explicit safe deletion or preservation semantics', () => {
    const matrix = readJson('evidence/phase1/purge-table-policy-matrix.json');
    const inventory = readJson('evidence/phase1/tenant-table-inventory.json');
    expect(validatePurgeTablePolicyMatrix(matrix, inventory)).toEqual([]);
    expect(matrix.target.marker_installed).toBe(false);
    expect(matrix.purge_role_contract.status).toContain('not provisioned');
    expect(matrix.delete_tables).toHaveLength(47);
    expect(matrix.preserve_tables).toHaveLength(6);
  });
});

describe('WP0.9 Phase 1 gate contract', () => {
  it('names real mandatory checks and preserves child failures without optional-script semantics', () => {
    const pkg = readJson('package.json');
    const gate = validatePhase1Gate(pkg, root);
    expect(gate).toEqual([]);
  });

  it('proves a failing fixture command prevents later gate commands from running', async () => {
    const { spawnSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync, existsSync, rmSync } = await import('node:fs');
    const os = await import('node:os');
    const directory = mkdtempSync(path.join(os.tmpdir(), 'phase1-gate-contract-'));
    try {
      const marker = path.join(directory, 'must-not-run.txt');
      writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
        private: true,
        scripts: {
          fail: 'node -e "process.exit(29)"',
          later: `node -e "require('node:fs').writeFileSync('${marker.replace(/\\/g, '/')}', 'ran')"`,
          aggregate: 'npm run fail && npm run later',
        },
      }));
      const npmExecPath = process.env.npm_execpath;
      const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const args = npmExecPath ? [npmExecPath, 'run', 'aggregate'] : ['run', 'aggregate'];
      const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', shell: !npmExecPath && process.platform === 'win32' });
      expect(result.status).not.toBe(0);
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
