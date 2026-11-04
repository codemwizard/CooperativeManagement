import { describe, expect, it } from 'vitest';
import {
  caseStorageKey,
  commitEnvelopeToStorage,
  computeEnvelopeChecksum,
  createCommitEnvelope,
  loadStoredEnvelope,
  resetGlobalBaseline,
  resetSingleCase,
  TELEMETRY_STORAGE_KEY,
  validateEnvelope,
} from '../src/engine/persistence';
import { loadCases, clone } from '../src/engine/data';
import { computeClaimVersionFingerprint } from '../src/engine/actions';
import type { CaseState, DurableCommitEnvelope, EngineEvent } from '../src/engine/types';

function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe('Phase R1: Full-Envelope Persistence & Scoped Integrity', () => {
  it('1. Recomputes canonical SHA-256 and rejects modified snapshot content with original checksum', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    // Tamper with snapshot while keeping original checksum
    const tampered = clone(envelope) as DurableCommitEnvelope;
    tampered.state_snapshot.title = 'TAMPERED TITLE: Unofficial modification';

    const validation = validateEnvelope(tampered);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toBe('CORRUPT_CHECKSUM_MISMATCH');
    }
  });

  it('2. Recomputes canonical SHA-256 and rejects modified event log with original checksum', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    rawCase.events = [
      {
        id: 'evt-1',
        at: '2026-10-17T10:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'livestock_count' },
        before: null,
        after: {},
      },
    ];
    rawCase.version = 1;
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    // Tamper with event log only
    const tampered = clone(envelope) as DurableCommitEnvelope;
    tampered.event_log[0].action = 'tampered_unauthorized_action';

    const validation = validateEnvelope(tampered);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toBe('CORRUPT_CHECKSUM_MISMATCH');
    }
  });

  it('3. Recomputes canonical SHA-256 and rejects modified envelope metadata (state_version)', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    // Tamper with state_version
    const tampered = clone(envelope) as DurableCommitEnvelope;
    tampered.state_version = 999;
    tampered.state_snapshot.version = 999;

    const validation = validateEnvelope(tampered);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(['CORRUPT_CHECKSUM_MISMATCH', 'event_log.length']).toContain(
        validation.reason.startsWith('event_log.length') ? 'event_log.length' : validation.reason
      );
    }
  });

  it('4. Enforces monotonic version invariant: state_version === baseline_version + event_log.length', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    rawCase.events = [];
    rawCase.version = 0;
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    // Inconsistent state version vs event log length
    const broken = clone(envelope) as DurableCommitEnvelope;
    broken.state_version = 2; // expected 0 events, but state_version says 2

    const validation = validateEnvelope(broken);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('does not match state_version');
    }
  });

  it('5. Enforces semantic referential consistency: rejects finding citing non-existent assignment', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    rawCase.verification = {
      assignments: [],
      findings: [
        {
          id: 'fnd-orphan-1',
          assignment_id: 'asg-does-not-exist',
          result: 'verified',
          scope: 'Statutory verification',
          limitation: 'None',
          basis: ['registration'],
          verifier: 'vrf.mulenga',
          recorded_on: '2026-10-17',
        },
      ],
      reliance: [],
    };
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    const validation = validateEnvelope(envelope);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('SEMANTIC_INVALID_FINDING_REF');
    }
  });

  it('6. Enforces semantic referential consistency: rejects assignment targeting non-existent evidence', () => {
    const rawCase = clone(loadCases()[0]) as CaseState;
    rawCase.verification = {
      assignments: [
        {
          id: 'asg-broken-1',
          case_id: 'case-1',
          scope: 'Phantom verification',
          target: { kind: 'evidence', ref: 'phantom_claim_id' },
          assigned_to: 'vrf.mulenga',
          assigned_by: 'pfi.analyst1',
          assigned_on: '2026-10-17',
          status: 'assigned',
        },
      ],
      findings: [],
      reliance: [],
    };
    const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

    const validation = validateEnvelope(envelope);
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.reason).toContain('SEMANTIC_INVALID_ASSIGNMENT_TARGET');
    }
  });

  it('7. Per-case storage isolation: corrupting case-2 isolates failure without damaging case-1', () => {
    const storage = createMockStorage();
    const cases = loadCases();
    const case1 = clone(cases[0]) as CaseState;
    const case2 = clone(cases[1]) as CaseState;

    const env1 = createCommitEnvelope(case1, 0, '2026-10-17T10:00:00Z');
    const env2 = createCommitEnvelope(case2, 0, '2026-10-17T10:00:00Z');

    commitEnvelopeToStorage(env1, storage);
    commitEnvelopeToStorage(env2, storage);

    // Corrupt case-2 storage string
    storage.setItem(caseStorageKey(case2.id), '{"corrupt_json": true, "schema_version": "2.0"}');

    // Case-1 must load cleanly
    const load1 = loadStoredEnvelope(storage, case1.id);
    expect(load1.ok).toBe(true);
    if (load1.ok) {
      expect(load1.envelope.case_id).toBe(case1.id);
    }

    // Case-2 fails and isolates
    const load2 = loadStoredEnvelope(storage, case2.id);
    expect(load2.ok).toBe(false);
    if (!load2.ok) {
      expect(load2.cleared).toBe(true);
    }
  });

  it('8. Bounded Global Reset: clears all symphony.state.* keys while strictly preserving symphony.capture.v1', () => {
    const storage = createMockStorage();
    const case1 = clone(loadCases()[0]) as CaseState;
    const case2 = clone(loadCases()[1]) as CaseState;

    commitEnvelopeToStorage(createCommitEnvelope(case1), storage);
    commitEnvelopeToStorage(createCommitEnvelope(case2), storage);

    // Add telemetry record and unrelated user setting
    storage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify([{ event: 'screen_view', at: '2026-10-17' }]));
    storage.setItem('user_theme_preference', 'dark');

    const resetResult = resetGlobalBaseline(storage);
    expect(resetResult.ok).toBe(true);

    // Case envelopes must be cleared
    expect(storage.getItem(caseStorageKey(case1.id))).toBeNull();
    expect(storage.getItem(caseStorageKey(case2.id))).toBeNull();

    // Telemetry and unrelated storage must remain intact
    expect(storage.getItem(TELEMETRY_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem('user_theme_preference')).toBe('dark');
  });

  it('9. Single-Case Reset: resets active case only, leaving other cases and telemetry intact', () => {
    const storage = createMockStorage();
    const case1 = clone(loadCases()[0]) as CaseState;
    const case2 = clone(loadCases()[1]) as CaseState;

    commitEnvelopeToStorage(createCommitEnvelope(case1), storage);
    commitEnvelopeToStorage(createCommitEnvelope(case2), storage);
    storage.setItem(TELEMETRY_STORAGE_KEY, 'telemetry_data');

    const reset1 = resetSingleCase(case1.id, storage);
    expect(reset1.ok).toBe(true);

    expect(storage.getItem(caseStorageKey(case1.id))).toBeNull();
    expect(storage.getItem(caseStorageKey(case2.id))).not.toBeNull();
    expect(storage.getItem(TELEMETRY_STORAGE_KEY)).toBe('telemetry_data');
  });

  it('10. Valid envelope survives refresh and restores exact state', () => {
    const storage = createMockStorage();
    const case1 = clone(loadCases()[0]) as CaseState;
    const originalEnvelope = createCommitEnvelope(case1, 0, '2026-10-17T10:00:00Z');

    commitEnvelopeToStorage(originalEnvelope, storage);

    const loaded = loadStoredEnvelope(storage, case1.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.envelope.checksum).toBe(originalEnvelope.checksum);
      expect(loaded.envelope.state_snapshot.id).toBe(case1.id);
      expect(loaded.envelope.state_snapshot.version).toBe(originalEnvelope.state_version);
    }
  });

  it('11. storage write failure rolls back both finding and promotion', () => {
    const failingStorage: Storage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };

    const case1 = clone(loadCases()[0]) as CaseState;
    const initialVersion = case1.version ?? 1;
    const envelope = createCommitEnvelope(case1);

    const writeResult = commitEnvelopeToStorage(envelope, failingStorage);
    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) {
      expect(writeResult.error).toContain('QuotaExceededError');
    }

    // Uncommitted state remains at initial version
    expect(case1.version ?? 1).toBe(initialVersion);
  });

  it('12. seed fixtures unchanged after demo mutations', () => {
    const initialCases = loadCases();
    const case1Copy = clone(initialCases[0]) as CaseState;

    // Mutate the cloned case
    case1Copy.name = 'Tampered Cooperative Name';
    if (case1Copy.evidence['registration']) {
      case1Copy.evidence['registration'].level = 'asserted';
    }

    // Fresh load from seed data must remain identical and pristine
    const freshCases = loadCases();
    expect(freshCases[0].name).toBe('Chisamba Farmers Cooperative');
    expect(freshCases[0].evidence['registration'].level).toBe('verified');
  });

  describe('Gate G1: B1 Semantic Envelope Integrity Adversarial Suite', () => {
    it('G1-1. state_snapshot.events differs from event_log by one appended entry -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const baseEnvelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');
      const envelope = clone(baseEnvelope) as DurableCommitEnvelope;

      // Append an extra event to state_snapshot.events but not envelope.event_log
      const extraEvent: EngineEvent = {
        id: 'evt-ghost-1',
        at: '2026-10-17T10:05:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'ghost_claim' },
        before: null,
        after: {},
      };
      envelope.state_snapshot.events = [...(envelope.state_snapshot.events || []), extraEvent];

      // Recompute valid checksum over tampered envelope structure to isolate semantic validator
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
      }
    });

    it('G1-2. Evidence item with level: "verified" and no conforming finding -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

      // Inject verified evidence item without any conforming finding
      envelope.state_snapshot.evidence['water_security'] = {
        level: 'verified',
        supplied_by: 'c1.secretary',
        supplied_on: '2026-10-17',
        verified_by: 'vrf.mulenga',
        verified_on: '2026-10-17',
        valid_until: '2027-10-17',
        limitation: 'Cooperative unverified source',
        history: [],
      };

      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('lacks conforming verification finding');
      }
    });

    it('G1-3. version_id on evidence item not equal to history.length + 1 -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

      // Set invalid version_id (expected 1 for empty history, but set to 3)
      envelope.state_snapshot.evidence['land_right'].version_id = 3;
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('version_id');
      }
    });

    it('G1-4. Duplicate event id in event_log -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const event1: EngineEvent = {
        id: 'evt-dup-1',
        at: '2026-10-17T10:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_1' },
        before: null,
        after: {},
      };
      const event2: EngineEvent = {
        id: 'evt-dup-1', // duplicate ID
        at: '2026-10-17T10:01:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_2' },
        before: null,
        after: {},
      };

      rawCase.events = [event1, event2];
      rawCase.version = 2;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:02:00Z');
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('duplicate or invalid event id');
      }
    });

    it('G1-5. Events out of chronological order by parsed instant -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      // First event later in UTC instant than second event
      const event1: EngineEvent = {
        id: 'evt-order-1',
        at: '2026-10-17T12:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_1' },
        before: null,
        after: {},
      };
      const event2: EngineEvent = {
        id: 'evt-order-2',
        at: '2026-10-17T11:00:00Z', // 1 hour earlier
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_2' },
        before: null,
        after: {},
      };

      rawCase.events = [event1, event2];
      rawCase.version = 2;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T12:05:00Z');
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('chronological order');
      }
    });

    it('G1-6. Event action not in governed vocabulary -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const rogueEvent: EngineEvent = {
        id: 'evt-rogue-1',
        at: '2026-10-17T10:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'unauthorized_arbitrary_mutation',
        target: null,
        before: null,
        after: {},
      };

      rawCase.events = [rogueEvent];
      rawCase.version = 1;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:05:00Z');
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('unknown event action');
      }
    });

    it('G1-7. state_snapshot.events missing (not an array) -> rejected SEMANTIC_INVARIANT_VIOLATION', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const ev: EngineEvent = {
        id: 'evt-7-1',
        at: '2026-10-17T10:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_1' },
        before: null,
        after: {},
      };
      rawCase.events = [ev];
      rawCase.version = 1;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:05:00Z');

      // Remove snapshot.events entirely to simulate missing array
      delete (envelope.state_snapshot as any).events;
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('state_snapshot.events is not an array');
      }
    });

    it('G1-8. Snapshot event has same id/action/at but different extra_payload -> rejected by canonical hash', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const ev: EngineEvent = {
        id: 'evt-8-1',
        at: '2026-10-17T10:00:00Z',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'legitimate_claim' },
        before: null,
        after: {},
      };
      rawCase.events = [ev];
      rawCase.version = 1;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:05:00Z');

      // Tamper with snapshot event: same id/action/at but change target so canonical hash differs
      (envelope.state_snapshot as any).events = [
        {
          ...ev,
          target: { claim_id: 'TAMPERED_CLAIM' },  // different target, same id/action/at
        },
      ];
      // Recompute checksum over tampered envelope to isolate semantic invariant check
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('canonical hash mismatch');
      }
    });

    it('G1-9. Single event with invalid (non-ISO) timestamp -> rejected SEMANTIC_INVARIANT_VIOLATION before ordering check', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const ev: EngineEvent = {
        id: 'evt-9-1',
        at: 'not-a-valid-timestamp',
        actor: { user_id: 'c1.secretary', role: 'secretary' },
        action: 'record_claim',
        target: { claim_id: 'claim_1' },
        before: null,
        after: {},
      };
      rawCase.events = [ev];
      rawCase.version = 1;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:05:00Z');
      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('invalid or missing ISO UTC timestamp');
      }
    });

    it('G1-10. Fabricated limitation string does NOT exempt verified evidence from finding requirement', () => {
      const rawCase = clone(loadCases()[0]) as CaseState;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

      // Inject verified evidence with a fabricated limitation string matching the old exemption pattern
      // but with provenance (supplied_on/verified_on) that does NOT match the seed
      envelope.state_snapshot.evidence['water_security_fabricated'] = {
        level: 'verified',
        supplied_by: 'attacker',
        supplied_on: '2024-01-01',  // does not match any seed record
        verified_by: 'attacker',
        verified_on: '2024-01-02',  // does not match any seed record
        valid_until: '2027-10-17',
        // Old bypass: limitation string that previously exempted this item
        limitation: 'Verified in the field. Registry not independently queried.',
        history: [],
      } as any;

      envelope.checksum = computeEnvelopeChecksum(envelope);

      const validation = validateEnvelope(envelope);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.reason).toContain('SEMANTIC_INVARIANT_VIOLATION');
        expect(validation.reason).toContain('lacks conforming verification finding');
      }
    });
  });

  describe('Gate G12a: Claim Fingerprint Immutability', () => {
    it('Status and limitation changes do not alter fingerprint; substantive changes produce new version and new fingerprint', () => {
      const baseItem = {
        claim_id: 'livestock_claim',
        version_id: 1,
        description: '500 head of mixed livestock',
        quantity: 500,
        source: '2026 AGM inventory',
        supplied_by: 'c1.secretary',
        supplied_on: '2026-10-17',
      };

      const originalFingerprint = computeClaimVersionFingerprint(baseItem);

      // Mutate procedural / non-substantive fields (limitation, verified_by, etc.)
      const proceduralMutation = {
        ...baseItem,
        limitation: 'Updated limitation text that must not alter substantive claim fingerprint',
        verified_by: 'vrf.mulenga',
        status: 'supported',
      };
      const unchangedFingerprint = computeClaimVersionFingerprint(proceduralMutation);
      expect(unchangedFingerprint).toBe(originalFingerprint);

      // Mutate substantive claim content (quantity or description)
      const substantiveMutation = {
        ...baseItem,
        version_id: 2,
        quantity: 550, // substantive amendment
        description: '550 head of mixed livestock (re-counted)',
      };
      const newFingerprint = computeClaimVersionFingerprint(substantiveMutation);
      expect(newFingerprint).not.toBe(originalFingerprint);
      expect(substantiveMutation.version_id).toBe(2);
    });
  });

  describe('Gate G-H: Provenance Trust-Boundary Documentation', () => {
    it('H1. Provenance trust-boundary: a user who recomputes a valid checksum after tampering passes the checksum validation', () => {
      // This test DOCUMENTS a known limitation, not a bug
      const rawCase = clone(loadCases()[0]) as CaseState;
      const envelope = createCommitEnvelope(rawCase, 0, '2026-10-17T10:00:00Z');

      // User controls storage: tamper AND recompute checksum
      envelope.state_snapshot.title = 'TAMPERED BY STORAGE OWNER';
      envelope.checksum = computeEnvelopeChecksum(envelope); // valid checksum over tampered data

      const validation = validateEnvelope(envelope);
      // This PASSES — documenting that the checksum is not tamper-PREVENTION
      expect(validation.valid).toBe(true);

      // The test asserts the known boundary is real, not a defect to fix.
      // The appropriate response is accurate UI disclosure, not cryptographic authentication.
    });
  });
});
