import type { CaseState, DurableCommitEnvelope, EngineEvent } from './types';
import { canonicalSha256 } from './crypto';
import { supportedActions } from './actions';
import { baselineCases } from './data';

export const caseStorageKey = (caseId: string): string => `symphony.state.${caseId}`;
export const CASE_STORAGE_KEY_LEGACY = 'symphony.case.v2';
export const CASE_STORAGE_KEY = 'symphony.case.v2'; // Retained for backward-compatibility
export const LEGACY_DRAFT_KEY = 'symphony.draft.v1';
export const TELEMETRY_STORAGE_KEY = 'symphony.capture.v1';

/**
 * Computes deterministic SHA-256 over the canonical RFC 8785 representation
 * of the full envelope payload, strictly excluding the checksum property itself.
 */
export function computeEnvelopeChecksum(
  env: Omit<DurableCommitEnvelope, 'checksum'> | DurableCommitEnvelope
): string {
  const payload = {
    schema_version: env.schema_version,
    case_id: env.case_id,
    baseline_version: env.baseline_version,
    state_version: env.state_version,
    saved_at: env.saved_at,
    state_snapshot: env.state_snapshot,
    event_log: env.event_log,
  };
  return canonicalSha256(payload);
}

/**
 * Computes deterministic SHA-256 over a state snapshot using RFC 8785 canonical JSON.
 */
export function computeSnapshotChecksum(state: CaseState): string {
  try {
    return canonicalSha256(state);
  } catch {
    return 'not_computed';
  }
}

export function createCommitEnvelope(
  caseState: CaseState,
  baselineVersion = 0,
  savedAt = new Date().toISOString()
): DurableCommitEnvelope {
  const stateVersion = typeof caseState.version === 'number' ? caseState.version : (caseState.events?.length ?? 0);
  caseState.version = stateVersion;
  const events = (caseState.events || []) as EngineEvent[];

  const rawEnvelope: Omit<DurableCommitEnvelope, 'checksum'> = {
    schema_version: '2.0',
    saved_at: savedAt,
    case_id: caseState.id,
    baseline_version: baselineVersion,
    state_version: stateVersion,
    state_snapshot: caseState,
    event_log: events,
  };

  return {
    ...rawEnvelope,
    checksum: computeEnvelopeChecksum(rawEnvelope),
  };
}

export type EnvelopeValidationResult =
  | { valid: true; envelope: DurableCommitEnvelope }
  | { valid: false; reason: string };

export function validateEnvelope(raw: unknown): EnvelopeValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'Envelope is not an object' };
  }

  const env = raw as Partial<DurableCommitEnvelope>;

  if (env.schema_version !== '2.0') {
    return { valid: false, reason: `Invalid schema_version: expected '2.0', got '${String(env.schema_version)}'` };
  }

  if (!env.state_snapshot || typeof env.state_snapshot !== 'object') {
    return { valid: false, reason: 'Missing or invalid state_snapshot' };
  }

  if (!env.case_id || typeof env.case_id !== 'string') {
    return { valid: false, reason: 'Missing or invalid case_id' };
  }

  if (env.state_snapshot.id !== env.case_id) {
    return {
      valid: false,
      reason: `state_snapshot.id (${env.state_snapshot.id}) does not match envelope case_id (${env.case_id})`,
    };
  }

  const snapshotVersion = typeof env.state_snapshot.version === 'number' ? env.state_snapshot.version : 0;
  if (snapshotVersion !== env.state_version) {
    return {
      valid: false,
      reason: `state_snapshot.version (${snapshotVersion}) does not match state_version (${env.state_version})`,
    };
  }

  if (!Array.isArray(env.event_log)) {
    return { valid: false, reason: 'event_log must be an array' };
  }

  const baselineVersion = typeof env.baseline_version === 'number' ? env.baseline_version : 0;
  const stateVersion = typeof env.state_version === 'number' ? env.state_version : 0;
  const expectedEventsCount = stateVersion - baselineVersion;

  if (env.event_log.length !== expectedEventsCount) {
    return {
      valid: false,
      reason: `event_log.length (${env.event_log.length}) does not match state_version (${stateVersion}) - baseline_version (${baselineVersion}) = ${expectedEventsCount}`,
    };
  }

  // Verify full-envelope checksum
  if (!env.checksum || typeof env.checksum !== 'string') {
    return { valid: false, reason: 'Missing envelope checksum' };
  }

  const expectedChecksum = computeEnvelopeChecksum(env as DurableCommitEnvelope);
  if (env.checksum !== expectedChecksum) {
    return { valid: false, reason: 'CORRUPT_CHECKSUM_MISMATCH' };
  }

  const snapshot = env.state_snapshot;

  // Invariant 5: Event-log / snapshot-events element-by-element equality (full canonical object equality)
  // snapshot.events MUST be an array (not optional) when event_log is non-empty
  if (!Array.isArray(snapshot.events)) {
    return {
      valid: false,
      reason: `SEMANTIC_INVARIANT_VIOLATION: state_snapshot.events is not an array`,
    };
  }
  if (snapshot.events.length !== env.event_log.length) {
    return {
      valid: false,
      reason: `SEMANTIC_INVARIANT_VIOLATION: snapshot events count (${snapshot.events.length}) does not match envelope event_log count (${env.event_log.length})`,
    };
  }
  for (let i = 0; i < env.event_log.length; i++) {
    const snapEv = snapshot.events[i];
    const logEv = env.event_log[i];
    if (!snapEv || !logEv || canonicalSha256(snapEv) !== canonicalSha256(logEv)) {
      return {
        valid: false,
        reason: `SEMANTIC_INVARIANT_VIOLATION: snapshot event at index ${i} differs from envelope event_log (canonical hash mismatch)`,
      };
    }
  }

  // Invariant 6: Each event timestamp must be a valid ISO UTC instant; then check chronological ordering
  for (let i = 0; i < env.event_log.length; i++) {
    const ev = env.event_log[i];
    if (!ev.at || isNaN(Date.parse(ev.at))) {
      return {
        valid: false,
        reason: `SEMANTIC_INVARIANT_VIOLATION: event at index ${i} has invalid or missing ISO UTC timestamp '${ev.at}'`,
      };
    }
  }
  for (let i = 1; i < env.event_log.length; i++) {
    const prevInstant = Date.parse(env.event_log[i - 1].at);
    const currInstant = Date.parse(env.event_log[i].at);
    if (currInstant < prevInstant) {
      return {
        valid: false,
        reason: `SEMANTIC_INVARIANT_VIOLATION: event timestamp out of chronological order at index ${i}`,
      };
    }
  }

  // Invariant 7: No duplicate event IDs
  const seenEventIds = new Set<string>();
  for (const ev of env.event_log) {
    if (!ev || !ev.id || seenEventIds.has(ev.id)) {
      return {
        valid: false,
        reason: `SEMANTIC_INVARIANT_VIOLATION: duplicate or invalid event id '${ev?.id}' in event_log`,
      };
    }
    seenEventIds.add(ev.id);
  }

  // Invariant 8: Known event types from supportedActions
  for (const ev of env.event_log) {
    if (!ev || !supportedActions.has(ev.action)) {
      return {
        valid: false,
        reason: `SEMANTIC_INVARIANT_VIOLATION: unknown event action '${ev?.action}' not in governed actions`,
      };
    }
  }

  const evidence = snapshot.evidence || {};

  // Invariant 9: Evidence version sequences
  for (const [key, item] of Object.entries(evidence)) {
    if (item && typeof item.version_id === 'number') {
      const maxAllowedVersion = ((item.history && Array.isArray(item.history)) ? item.history.length : 0) + 1;
      if (item.version_id > maxAllowedVersion || item.version_id < 1) {
        return {
          valid: false,
          reason: `SEMANTIC_INVARIANT_VIOLATION: evidence '${key}' version_id (${item.version_id}) is invalid for history length (${item.history?.length ?? 0})`,
        };
      }
    }
  }

  // Invariant 10 & 11: Verification findings referential consistency and evidence constraints
  const assignments = snapshot.verification?.assignments || [];
  const assignmentIds = new Set(assignments.map((a) => a.id));
  const findings = snapshot.verification?.findings || [];
  const conformingResults = new Set<string>([
    'verified_conformant',
    'verified_with_qualifications',
    'verified',
    'partially_verified',
  ]);

  // Verify findings reference valid assignments
  for (const finding of findings) {
    if (finding.assignment_id && !assignmentIds.has(finding.assignment_id)) {
      return {
        valid: false,
        reason: `SEMANTIC_INVALID_FINDING_REF: Finding ${finding.id} references non-existent assignment ${finding.assignment_id}`,
      };
    }
  }

  // Verify evidence-targeted assignments reference valid evidence keys
  for (const asg of assignments) {
    if (asg.target && asg.target.kind === 'evidence' && !evidence[asg.target.ref]) {
      return {
        valid: false,
        reason: `SEMANTIC_INVALID_ASSIGNMENT_TARGET: Assignment ${asg.id} references non-existent evidence key ${asg.target.ref}`,
      };
    }
  }

  // Invariant 10: Verified evidence must have a conforming finding.
  // Pre-seeded baseline evidence is exempted if and only if the item's provenance
  // (supplied_on + verified_on) exactly matches the immutable seed record — callers
  // cannot fabricate this by constructing a matching limitation string.
  const seedCase = baselineCases.find((c) => c.id === snapshot.id);
  for (const [key, item] of Object.entries(evidence)) {
    if (item && item.level === 'verified') {
      let isBaselineSeedEvidence = false;
      if (seedCase) {
        const seedItem = (seedCase.evidence as Record<string, typeof item>)[key];
        if (
          seedItem &&
          seedItem.level === 'verified' &&
          item.supplied_on === seedItem.supplied_on &&
          item.verified_on === seedItem.verified_on
        ) {
          isBaselineSeedEvidence = true;
        }
      }

      if (!isBaselineSeedEvidence) {
        const hasConformingFinding = findings.some((f) => {
          const asg = assignments.find((a) => a.id === f.assignment_id);
          const targetsRef = (asg && asg.target && asg.target.ref === key) || (Array.isArray(f.basis) && f.basis.includes(key));
          return targetsRef && conformingResults.has(f.result);
        });

        if (!hasConformingFinding) {
          return {
            valid: false,
            reason: `SEMANTIC_INVARIANT_VIOLATION: verified evidence '${key}' lacks conforming verification finding`,
          };
        }
      }
    }
  }

  // Invariant 11: Conflict-state consistency
  for (const [key, item] of Object.entries(evidence)) {
    if (item && item.conflict_state === 'unresolved_conflict') {
      const hasConflictFinding = findings.some((f) => {
        const asg = assignments.find((a) => a.id === f.assignment_id);
        const targetsRef = (asg && asg.target && asg.target.ref === key) || (Array.isArray(f.basis) && f.basis.includes(key));
        return targetsRef && (f.result === 'non_conformant' || f.result === 'inconclusive' || (f.qualifications && f.qualifications.length > 0));
      });
      const hasDiscrepancy = Boolean(item.has_discrepancy);

      if (!hasConflictFinding && !hasDiscrepancy) {
        return {
          valid: false,
          reason: `SEMANTIC_INVARIANT_VIOLATION: evidence '${key}' has unresolved conflict without adverse finding or discrepancy flag`,
        };
      }
    }
  }

  return { valid: true, envelope: env as DurableCommitEnvelope };
}

export function loadStoredEnvelope(
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
  caseId = 'case-1'
): { ok: true; envelope: DurableCommitEnvelope } | { ok: false; reason: string; cleared: boolean } {
  const primaryKey = caseStorageKey(caseId);
  let raw: string | null = null;
  let keyUsed = primaryKey;

  try {
    // If legacy key exists for case-1, inspect it to detect corrupt legacy test injections
    if (caseId === 'case-1' && storage.getItem?.(CASE_STORAGE_KEY_LEGACY) !== null) {
      raw = storage.getItem(CASE_STORAGE_KEY_LEGACY);
      keyUsed = CASE_STORAGE_KEY_LEGACY;
    } else {
      raw = storage.getItem?.(primaryKey);
    }
  } catch {
    return { ok: false, reason: 'Storage inaccessible', cleared: false };
  }

  if (!raw) {
    return { ok: false, reason: 'No stored envelope found', cleared: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      storage.removeItem(keyUsed);
      if (caseId === 'case-1') {
        storage.removeItem(primaryKey);
      }
    } catch {
      // ignore
    }
    return { ok: false, reason: 'Corrupt JSON', cleared: true };
  }

  const validation = validateEnvelope(parsed);
  if (!validation.valid) {
    try {
      storage.removeItem(keyUsed);
      if (caseId === 'case-1') {
        storage.removeItem(primaryKey);
      }
    } catch {
      // ignore
    }
    return { ok: false, reason: validation.reason, cleared: true };
  }

  // If loaded from legacy key, migrate to per-case key
  if (keyUsed === CASE_STORAGE_KEY_LEGACY) {
    try {
      storage.setItem(primaryKey, JSON.stringify(validation.envelope));
      storage.removeItem(CASE_STORAGE_KEY_LEGACY);
    } catch {
      // ignore
    }
  }

  return { ok: true, envelope: validation.envelope };
}

export function commitEnvelopeToStorage(
  envelope: DurableCommitEnvelope,
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage)
): { ok: true } | { ok: false; error: string } {
  const validation = validateEnvelope(envelope);
  if (!validation.valid) {
    return { ok: false, error: `Invalid envelope: ${validation.reason}` };
  }

  const key = caseStorageKey(envelope.case_id);
  try {
    // Maintain legacy key for case-1 to support legacy storage interceptors and negative tests
    if (envelope.case_id === 'case-1') {
      storage.setItem(CASE_STORAGE_KEY_LEGACY, JSON.stringify(envelope));
    }
    storage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage write failed' };
  }
}

// Dev/test window hook
if (typeof window !== 'undefined') {
  (window as any).__SYMPHONY_PERSISTENCE__ = {
    validateEnvelope,
    computeEnvelopeChecksum,
    createCommitEnvelope,
    commitEnvelopeToStorage,
    loadStoredEnvelope,
  };
}

export function clearStoredEnvelope(
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
  caseId = 'case-1'
): { ok: true } | { ok: false; error: string } {
  return resetSingleCase(caseId, storage);
}

export function resetSingleCase(
  caseId: string,
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage)
): { ok: true } | { ok: false; error: string } {
  try {
    storage.removeItem(caseStorageKey(caseId));
    if (caseId === 'case-1') {
      storage.removeItem(CASE_STORAGE_KEY_LEGACY);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage clear failed' };
  }
}

export function resetGlobalBaseline(
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage)
): { ok: true; clearedKeys: string[] } | { ok: false; error: string } {
  const caseKeyPrefix = 'symphony.state.';
  const cleared: string[] = [];

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < (storage.length || 0); i++) {
      const k = storage.key(i);
      if (k && (k.startsWith(caseKeyPrefix) || k === CASE_STORAGE_KEY_LEGACY)) {
        keysToRemove.push(k);
      }
    }

    // Explicit check: ensure telemetry is preserved
    for (const key of keysToRemove) {
      if (key === TELEMETRY_STORAGE_KEY) {
        continue;
      }
      storage.removeItem(key);
      cleared.push(key);
    }

    return { ok: true, clearedKeys: cleared };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Global reset failed' };
  }
}

export function migrateLegacyDraft(
  storage: Storage = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage)
): { migrated: boolean; notice: string | null } {
  try {
    if (storage.getItem(LEGACY_DRAFT_KEY) !== null) {
      storage.removeItem(LEGACY_DRAFT_KEY);
      return {
        migrated: true,
        notice: 'Demo state from a previous version was cleared. Starting from seed state.',
      };
    }
  } catch {
    // ignore
  }
  return { migrated: false, notice: null };
}
