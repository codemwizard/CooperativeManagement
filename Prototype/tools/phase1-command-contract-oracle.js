import { createHmac, timingSafeEqual } from 'node:crypto';

const SEMANTIC_FIELDS = [
  'tenant_id', 'actor_id', 'command_type', 'command_schema_version',
  'expected_aggregate_version', 'payload',
];

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('lone high surrogate');
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new TypeError('lone low surrogate');
  }
}

function validateJsonValue(value) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { assertValidUnicode(value); return; }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return;
  }
  if (typeof value !== 'object') throw new TypeError('value is not valid JSON data');
  else if (Array.isArray(value)) value.forEach(validateJsonValue);
  else if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError('non-JSON object');
    }
    for (const [key, child] of Object.entries(value)) {
      assertValidUnicode(key);
      validateJsonValue(child);
    }
  }
}

export function parseJsonRejectingDuplicateKeys(source) {
  let offset = 0;
  const skip = () => { while (/\s/.test(source[offset] ?? '') && offset < source.length) offset += 1; };
  const parseString = () => {
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      if (source[offset] === '\\') { offset += 2; continue; }
      if (source[offset] === '"') {
        offset += 1;
        const value = JSON.parse(source.slice(start, offset));
        assertValidUnicode(value);
        return value;
      }
      offset += 1;
    }
    throw new SyntaxError('unterminated JSON string');
  };
  const parseValue = () => {
    skip();
    if (source[offset] === '"') { parseString(); return; }
    if (source[offset] === '{') {
      offset += 1;
      skip();
      const keys = new Set();
      if (source[offset] === '}') { offset += 1; return; }
      while (offset < source.length) {
        skip();
        if (source[offset] !== '"') throw new SyntaxError('object key must be a string');
        const key = parseString();
        if (keys.has(key)) throw new SyntaxError(`duplicate object key: ${key}`);
        keys.add(key);
        skip();
        if (source[offset] !== ':') throw new SyntaxError('expected colon');
        offset += 1;
        parseValue();
        skip();
        if (source[offset] === '}') { offset += 1; return; }
        if (source[offset] !== ',') throw new SyntaxError('expected comma');
        offset += 1;
      }
      throw new SyntaxError('unterminated object');
    }
    if (source[offset] === '[') {
      offset += 1;
      skip();
      if (source[offset] === ']') { offset += 1; return; }
      while (offset < source.length) {
        parseValue();
        skip();
        if (source[offset] === ']') { offset += 1; return; }
        if (source[offset] !== ',') throw new SyntaxError('expected comma');
        offset += 1;
      }
      throw new SyntaxError('unterminated array');
    }
    const start = offset;
    while (offset < source.length && !/[\s,}\]]/.test(source[offset])) offset += 1;
    if (start === offset) throw new SyntaxError('expected JSON value');
    JSON.parse(source.slice(start, offset));
  };
  parseValue();
  skip();
  if (offset !== source.length) throw new SyntaxError('trailing JSON content');
  const value = JSON.parse(source);
  validateJsonValue(value);
  return value;
}

export function canonicalizeJcs(value) {
  validateJsonValue(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJcs).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJcs(value[key])}`).join(',')}}`;
}

export function semanticEnvelope(command) {
  for (const field of ['tenant_id', 'actor_id', 'command_id', 'command_type', 'command_schema_version', 'payload']) {
    if (!(field in command)) throw new TypeError(`missing semantic field ${field}`);
  }
  // command_id is the receipt lookup key, never part of the semantic HMAC input.
  const envelope = Object.fromEntries(SEMANTIC_FIELDS.filter((field) => field in command).map((field) => [field, command[field]]));
  validateJsonValue(envelope);
  return envelope;
}

export function validateAndMaterializeCommandPayload(payload, schema) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || (Object.getPrototypeOf(payload) !== Object.prototype && Object.getPrototypeOf(payload) !== null)) {
    throw new TypeError('command payload must be a JSON object');
  }
  const properties = schema?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new TypeError('command schema properties are required');
  for (const key of Object.keys(payload)) if (!Object.hasOwn(properties, key)) throw new TypeError(`unknown field ${key}`);
  const materialized = {};
  for (const [key, rule] of Object.entries(properties)) {
    let value = Object.hasOwn(payload, key) ? payload[key] : rule.default;
    if (value === undefined) {
      if (rule.required === true) throw new TypeError(`required field ${key} is missing`);
      continue;
    }
    if (value === null) {
      if (rule.nullable !== true) throw new TypeError(`field ${key} cannot be null`);
    } else {
      const validType = rule.type === 'string' ? typeof value === 'string'
        : rule.type === 'boolean' ? typeof value === 'boolean'
          : rule.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
            : rule.type === 'integer' ? Number.isSafeInteger(value)
              : rule.type === 'object' ? typeof value === 'object' && !Array.isArray(value)
                : rule.type === 'array' ? Array.isArray(value)
                  : false;
      if (!validType) throw new TypeError(`field ${key} must be ${rule.type}`);
    }
    validateJsonValue(value);
    materialized[key] = structuredClone(value);
  }
  return materialized;
}

export function resolveCommandContractVersions(receipt, available) {
  if (!available?.schemaVersions?.includes(receipt?.command_schema_version)) {
    throw new Error(`missing command schema version ${receipt?.command_schema_version}`);
  }
  if (!available?.canonicalizationVersions?.includes(receipt?.canonicalization_version)) {
    throw new Error(`missing canonicalization version ${receipt?.canonicalization_version}`);
  }
  return {
    schema_version: receipt.command_schema_version,
    canonicalization_version: receipt.canonicalization_version,
  };
}

export function commandDigest(command, key) {
  const canonical = canonicalizeJcs(semanticEnvelope(command));
  return createHmac('sha256', key).update(canonical, 'utf8').digest('hex');
}

export function digestForReceipt(command, keyVersion, historicalKeys) {
  if (!Object.hasOwn(historicalKeys, keyVersion)) throw new Error(`missing historical HMAC key ${keyVersion}`);
  return commandDigest(command, historicalKeys[keyVersion]);
}

export function resolveReceiptAttempts(attempts, key) {
  const receipts = new Map();
  return attempts.map((attempt) => {
    if (!attempt.authorized) return attempt.audit_failure ? 'audit_failure_no_receipt' : 'denied_no_receipt';
    if (attempt.fail_before_commit) return 'failed_no_receipt';
    const lookupKey = `${attempt.tenant_id}\u0000${attempt.command_id}`;
    const receipt = receipts.get(lookupKey);
    const candidate = { tenant_id: attempt.tenant_id, actor_id: attempt.actor_id, digest: commandDigest({
      tenant_id: attempt.tenant_id,
      actor_id: attempt.actor_id,
      command_id: attempt.command_id,
      command_type: attempt.command_type ?? 'membership.update',
      command_schema_version: attempt.command_schema_version ?? 1,
      ...(Object.hasOwn(attempt, 'expected_aggregate_version') ? { expected_aggregate_version: attempt.expected_aggregate_version } : {}),
      payload: attempt.payload,
    }, key) };
    if (!receipt) {
      receipts.set(lookupKey, { ...candidate, result: attempt.terminal_stale ? 'stale_conflict' : 'success' });
      if (attempt.response_lost_after_commit === true) return 'committed_response_lost';
      return attempt.terminal_stale ? 'committed_terminal_conflict' : 'committed';
    }
    if (candidate.tenant_id !== receipt.tenant_id || candidate.actor_id !== receipt.actor_id) return 'non_disclosing_denial';
    const left = Buffer.from(candidate.digest, 'hex');
    const right = Buffer.from(receipt.digest, 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right)) return 'key_reuse_rejected';
    return 'replayed';
  });
}

export function receiptReplayVisibility({ transactionCommitted, resultClassification, safeResult }) {
  if (transactionCommitted !== true || resultClassification === 'pending' || safeResult == null) {
    return { visible: false, replayable: false };
  }
  return { visible: true, replayable: true };
}

export function resolveUncertainCommandCommit({ receiptState }) {
  if (receiptState === 'committed_matching') return 'replay_committed_result';
  if (receiptState === 'committed_mismatching') return 'non_disclosing_key_reuse_denial';
  if (receiptState === 'absent_after_lock') return 'retry_same_id_as_new_owner';
  return 'retry_or_query_same_id_only';
}

export function isSafeReceiptResult(result, allowedFields = ['status', 'aggregate_version', 'reconciliation_id']) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const allowed = new Set(allowedFields);
  const forbiddenKey = /(?:payload|request|password|credential|secret|token|nrc|national.?id|identifier_encrypted)/i;
  const sensitiveValue = /\b[A-Z]{2}\d{4}\/\d{2}\/\d\b/;
  const inspect = (value) => {
    if (typeof value === 'string') return !sensitiveValue.test(value);
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isSafeInteger(value))) return true;
    if (Array.isArray(value)) return value.every(inspect);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.entries(value).every(([key, child]) => !forbiddenKey.test(key) && inspect(child));
    }
    return false;
  };
  return Object.entries(result).every(([key, value]) => allowed.has(key) && !forbiddenKey.test(key) && inspect(value));
}

export function decideReconciliationAccess({ item, actorId, tenantId, memberActive, canReadOwn, canTakeOver, now }) {
  if (item.tenant_id !== tenantId || item.lifecycle !== 'open') return { outcome: 'deny_non_disclosing' };
  if (item.expires_at && Date.parse(item.expires_at) <= Date.parse(now)) return { outcome: 'deny_non_disclosing' };
  if (!memberActive) return { outcome: 'deny_non_disclosing' };
  if (actorId === item.original_actor_id && canReadOwn) return { outcome: 'allow_read_original_actor' };
  if (canTakeOver) return { outcome: 'allow_takeover', audit_required: true };
  return { outcome: 'deny_non_disclosing' };
}

export function reconciliationExpiryDisposition({ now, expiresAt, lifecycle }) {
  if (lifecycle !== 'open') return { action: 'retain_terminal_tombstone', payloadAccessible: false };
  if (Date.parse(expiresAt) <= Date.parse(now)) return { action: 'delete_active_payload_and_retain_tombstone', payloadAccessible: false };
  return { action: 'retain_encrypted_active_payload', payloadAccessible: true };
}

export function correctedCommandUsesFreshId(originalCommandId, correctedCommandId) {
  return typeof correctedCommandId === 'string' && correctedCommandId.length > 0 && correctedCommandId !== originalCommandId;
}

export function checkPurgePreflight(input) {
  const errors = [];
  if (input.runtimeProfile !== 'test') errors.push('runtime_profile_not_test');
  if (input.dataMode !== 'test') errors.push('data_mode_not_test');
  if (input.syntheticOnly !== true) errors.push('data_not_confirmed_synthetic');
  if (!input.expectedDatabase || input.database !== input.expectedDatabase) errors.push('database_identity_mismatch');
  if (!input.expectedSchema || input.schema !== input.expectedSchema) errors.push('schema_identity_mismatch');
  if (!input.expectedMarker || input.marker !== input.expectedMarker) errors.push('disposable_marker_mismatch');
  if (!input.role || input.role !== input.expectedPurgeRole) errors.push('dedicated_purge_role_required');
  if (input.roleConnectDatabase !== input.expectedDatabase) errors.push('purge_role_database_scope_mismatch');
  if (input.roleCapabilities?.isOwner !== false) errors.push('purge_role_must_not_own_target_objects');
  if (input.roleCapabilities?.superuser !== false || input.roleCapabilities?.createdb !== false || input.roleCapabilities?.createrole !== false || input.roleCapabilities?.bypassrls !== false)
    errors.push('purge_role_has_forbidden_cluster_privilege');
  if (input.roleCapabilities?.canConnectProduction !== false) errors.push('purge_role_production_scope_not_excluded');
  if (input.roleCapabilities?.canDdl !== false || input.roleCapabilities?.isApplicationRole !== false || input.roleCapabilities?.deleteOutsideAllowlist !== false || input.roleCapabilities?.mutateAudit !== false)
    errors.push('purge_role_grants_exceed_contract');
  if (!Array.isArray(input.allowlist) || input.allowlist.length === 0) errors.push('explicit_allowlist_required');
  if (input.allowlist?.includes(input.auditLedger)) errors.push('audit_ledger_must_be_excluded');
  if (input.unknownTables?.length) errors.push('unknown_tables_in_inventory');
  if (input.cascade === true) errors.push('cascade_prohibited');
  return { allowed: errors.length === 0, errors, destructiveSqlMayRun: errors.length === 0 };
}

export function authorizeDemoMutation(input) {
  const allowed = input.runtimeProfile === 'demo'
    && input.dataMode === 'test'
    && input.syntheticOnly === true
    && input.actorId === input.configuredActorId
    && input.tenantId === input.configuredTenantId
    && input.operation === 'demo.reset'
    && input.serverAuthorized === true;
  return { allowed, reason: allowed ? 'allowed' : 'denied_non_disclosing' };
}

export function sessionValidity({ nowMs, issuedAtMs, lastActivityAtMs, revokedAtMs = null, idleLimitMs, absoluteLimitMs }) {
  if (revokedAtMs !== null) return { valid: false, reason: 'revoked' };
  if (nowMs >= issuedAtMs + absoluteLimitMs) return { valid: false, reason: 'absolute_expiry' };
  if (nowMs >= lastActivityAtMs + idleLimitMs) return { valid: false, reason: 'idle_expiry' };
  return { valid: true, reason: 'active' };
}

const FORCED_CHANGE_ROUTES = new Set([
  'GET /auth/csrf',
  'GET /auth/session',
  'POST /auth/change-password',
  'POST /auth/logout',
]);

export function forcedChangeRouteAllowed(method, pathname) {
  return FORCED_CHANGE_ROUTES.has(`${String(method).toUpperCase()} ${pathname}`);
}

export function validateUnsafeSessionRequest({ method, origin, expectedOrigin, csrfToken, expectedCsrfToken }) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())) return { allowed: true, reason: 'safe_method' };
  if (!origin || origin !== expectedOrigin) return { allowed: false, reason: 'origin_denied' };
  if (!csrfToken || !expectedCsrfToken || csrfToken !== expectedCsrfToken) return { allowed: false, reason: 'csrf_denied' };
  return { allowed: true, reason: 'validated' };
}

export function authorityRaceOutcome({ linearizationOrder, authorityActiveBeforeCommand }) {
  if (linearizationOrder === 'protected-command-first') {
    return authorityActiveBeforeCommand
      ? { command: 'commits_before_authority_change', change: 'waits_then_commits' }
      : { command: 'denied', change: 'commits' };
  }
  if (linearizationOrder === 'authority-change-first') {
    return { command: 'denied_after_recheck', change: 'commits_first' };
  }
  return { command: 'denied_invalid_order', change: 'not_applied' };
}
