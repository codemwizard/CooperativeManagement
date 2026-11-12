import { describe, expect, it, beforeEach } from 'vitest';
import {
  recordClaim,
  recordAgentObservation,
  attachCorroboratingEvidenceAction,
  assignVerificationAction,
  recordVerificationFindingAction,
  recordFindingAndPromoteAction,
  resolveFindingConflictAction,
  promoteEvidenceLevelAction,
  applyAction,
  resetArtefactRegistry,
  getRegisteredArtefact,
} from '../src/engine/actions';
import { loadCases } from '../src/engine/data';
import type { ActionResult, Actor, CaseState } from '../src/engine/types';

function getFreshCase(id = 'case-1'): CaseState {
  const c = loadCases().find((item) => item.id === id);
  if (!c) throw new Error(`Case ${id} not found`);
  return c;
}

const secretary: Actor = { user_id: 'c1.secretary', role: 'secretary' };
const fieldAgent: Actor = { user_id: 'fa.banda', role: 'field_agent' };
const verifier1: Actor = { user_id: 'vrf.mulenga', role: 'verifier' };
const verifier2: Actor = { user_id: 'vrf.sakala', role: 'verifier' };
const pfiCredit: Actor = { user_id: 'pfi.credit1', role: 'pfi_credit' };

function ok(res: ActionResult): CaseState {
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(`Action failed with code: ${res.code}`);
  return res.caseState;
}

function rejected(res: ActionResult): string {
  expect(res.ok).toBe(false);
  if (res.ok) throw new Error('Expected action to fail');
  return res.code;
}

describe('Phase R3: Atomic Evidence Transitions & Conflict Resolution', () => {
  it('T3.1 Attributable corroboration advances claim from asserted to supported', () => {
    let state = getFreshCase('case-1');
    state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
    expect(state.evidence['livestock_claim'].level).toBe('asserted');

    // Observation alone records attribution but keeps level at asserted
    state = ok(
      recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: 'contact-fa-01',
          has_discrepancy: false,
          notes: 'Visual paddock inspection conducted',
        },
        fieldAgent,
      ),
    );
    expect(state.evidence['livestock_claim'].level).toBe('asserted');
    expect(state.evidence['livestock_claim'].contact_ref_id).toBe('contact-fa-01');

    // Attaching admissible corroborating document promotes claim to supported
    state = ok(
      attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-ear-tags-2026',
          method: 'ear_tag_registry',
          limitation: 'Cooperative self-declared ear tags corroborated by field visit',
        },
        fieldAgent,
      ),
    );
    expect(state.evidence['livestock_claim'].level).toBe('supported');
    expect(state.evidence['livestock_claim'].supporting_artefact_id).toBe('doc-ear-tags-2026');
  });

  it('T3.2 Atomic promotion records finding and promotes to verified in single transaction', () => {
    let state = getFreshCase('case-1');
    state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
    state = ok(
      attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-vet-inspection-2026',
        },
        fieldAgent,
      ),
    );
    expect(state.evidence['livestock_claim'].level).toBe('supported');

    // Assign verifier
    state = ok(
      assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.mulenga',
        },
        pfiCredit,
      ),
    );
    const asg = state.verification.assignments.find((a) => a.target.ref === 'livestock_claim')!;

    // Atomic promotion commit
    state = ok(
      recordFindingAndPromoteAction(
        state,
        {
          assignment_id: asg.id,
          result: 'verified_conformant',
          scope: 'Complete herd count and veterinary inspection',
          limitation: 'Verified against physically stamped ear tag registry',
        },
        verifier1,
      ),
    );

    const claim = state.evidence['livestock_claim'];
    expect(claim.level).toBe('verified');
    expect(claim.verified_by).toBe('vrf.mulenga');
    expect(claim.verified_on).toBeDefined();

    // Verify assignment completed and finding added
    const completedAsg = state.verification.assignments.find((a) => a.id === asg.id)!;
    expect(completedAsg.status).toBe('completed');
    expect(state.verification.findings.some((f) => f.assignment_id === asg.id && f.result === 'verified_conformant')).toBe(true);
  });

  it('T3.3 Opposing findings trigger unresolved conflict and block promotion', () => {
    let state = getFreshCase('case-1');
    state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
    state = ok(
      attachCorroboratingEvidenceAction(
        state,
        { evidence_type: 'livestock_claim', supporting_artefact_id: 'doc-ear-tags-2026' },
        fieldAgent,
      ),
    );

    // Assignment 1: Verifier 1 records non_conformant finding
    state = ok(
      assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.mulenga',
        },
        pfiCredit,
      ),
    );
    const asg1 = state.verification.assignments.find((a) => a.target.ref === 'livestock_claim')!;
    state = ok(
      recordFindingAndPromoteAction(
        state,
        {
          assignment_id: asg1.id,
          result: 'non_conformant',
          scope: 'Head count',
          limitation: 'Count differed significantly from stated roster',
        },
        verifier1,
      ),
    );
    // Claim remains supported, not verified
    expect(state.evidence['livestock_claim'].level).toBe('supported');

    // Assignment 2: Verifier 2 tries to record verified_conformant
    state = ok(
      assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.sakala',
        },
        pfiCredit,
      ),
    );
    const asg2 = state.verification.assignments.filter((a) => a.target.ref === 'livestock_claim')[1];
    // Assignment 2: Verifier 2 records verified_conformant finding
    state = ok(
      recordVerificationFindingAction(
        state,
        {
          assignment_id: asg2.id,
          result: 'verified_conformant',
          scope: 'Secondary audit',
          limitation: 'Recount completed',
        },
        verifier2,
      ),
    );
    // Opposing findings on this version trigger unresolved_conflict
    expect(state.evidence['livestock_claim'].conflict_state).toBe('unresolved_conflict');
    expect(state.evidence['livestock_claim'].level).toBe('supported');

    // Attempting direct promotion via promoteEvidenceLevelAction must fail with PROMOTE_CONFLICTING_FINDING
    const fnd2 = state.verification.findings.find((f) => f.assignment_id === asg2.id)!;
    const directPromoteRes = promoteEvidenceLevelAction(
      state,
      { evidence_type: 'livestock_claim', finding_id: fnd2.id },
      pfiCredit,
    );
    expect(rejected(directPromoteRes)).toBe('PROMOTE_CONFLICTING_FINDING');

    // And attempting atomic record_finding_and_promote on a new assignment fails with UNRESOLVED_FINDING_CONFLICT
    state = ok(
      assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.sakala',
        },
        pfiCredit,
      ),
    );
    const asg3 = state.verification.assignments.filter((a) => a.target.ref === 'livestock_claim')[2];
    const atomicConflictRes = recordFindingAndPromoteAction(
      state,
      {
        assignment_id: asg3.id,
        result: 'verified_conformant',
        scope: 'Tertiary audit',
        limitation: 'Recount completed',
      },
      verifier2,
    );
    expect(rejected(atomicConflictRes)).toBe('UNRESOLVED_FINDING_CONFLICT');
  });

  it('T3.4 Attributable conflict resolution restores promotion eligibility and applies disposition', () => {
    let state = getFreshCase('case-1');
    state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
    state = ok(
      attachCorroboratingEvidenceAction(
        state,
        { evidence_type: 'livestock_claim', supporting_artefact_id: 'doc-ear-tags-2026' },
        fieldAgent,
      ),
    );

    // Verifier 1 non_conformant
    state = ok(
      assignVerificationAction(
        state,
        { target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 }, assigned_to: 'vrf.mulenga' },
        pfiCredit,
      ),
    );
    const asg1 = state.verification.assignments.find((a) => a.target.ref === 'livestock_claim')!;
    state = ok(
      recordVerificationFindingAction(
        state,
        { assignment_id: asg1.id, result: 'non_conformant', scope: 'Inspection 1', limitation: 'Paddock 1 only' },
        verifier1,
      ),
    );

    // Verifier 2 conformant
    state = ok(
      assignVerificationAction(
        state,
        { target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 }, assigned_to: 'vrf.sakala' },
        pfiCredit,
      ),
    );
    const asg2 = state.verification.assignments.find((a) => a.id !== asg1.id && a.target.ref === 'livestock_claim')!;
    state = ok(
      recordVerificationFindingAction(
        state,
        { assignment_id: asg2.id, result: 'verified_conformant', scope: 'Inspection 2', limitation: 'Full farm' },
        verifier2,
      ),
    );

    const f1 = state.verification.findings.find((f) => f.assignment_id === asg1.id)!;
    const f2 = state.verification.findings.find((f) => f.assignment_id === asg2.id)!;

    // Resolve conflict with attribution
    state = ok(
      resolveFindingConflictAction(
        state,
        {
          evidence_type: 'livestock_claim',
          resolved_findings: [f1.id, f2.id],
          disposition: 'upheld',
          rationale: 'Secondary full-farm inspection by vrf.sakala confirmed cattle were in outer paddock during inspection 1.',
        },
        pfiCredit,
      ),
    );

    expect(state.evidence['livestock_claim'].conflict_state).toBe('resolved');
    expect(state.evidence['livestock_claim'].level).toBe('verified');
    expect(state.evidence['livestock_claim'].verified_by).toBe('pfi.credit1');
  });

  it('T3.5 Adverse observation flags discrepancy and preserves supported level with history append', () => {
    let state = getFreshCase('case-1');
    state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
    state = ok(
      attachCorroboratingEvidenceAction(
        state,
        { evidence_type: 'livestock_claim', supporting_artefact_id: 'doc-ear-tags-2026' },
        fieldAgent,
      ),
    );
    expect(state.evidence['livestock_claim'].level).toBe('supported');

    // Record adverse observation
    state = ok(
      recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: 'contact-fa-02',
          has_discrepancy: true,
          notes: 'Count short by 12 head during morning check',
        },
        fieldAgent,
      ),
    );

    const claim = state.evidence['livestock_claim'];
    expect(claim.level).toBe('supported'); // Never drops to asserted
    expect(claim.has_discrepancy).toBe(true);
    expect(claim.limitation).toContain('[Discrepancy Reported]');
    expect(claim.history.length).toBeGreaterThan(0);
  });

  describe('Gate G2: B7 Artefact Admissibility via Local Seeded Registry', () => {
    beforeEach(() => {
      resetArtefactRegistry();
    });

    it('G2-1. ID absent from registry -> rejected ARTEFACT_NOT_FOUND', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      const res = attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-phantom-does-not-exist',
        },
        fieldAgent,
      );
      expect(rejected(res)).toBe('ARTEFACT_NOT_FOUND');
      // Evidence level remains at asserted
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
    });

    it('G2-2. ID in registry, digest mismatch -> rejected INTEGRITY_MISMATCH', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      // Pass wrong digest
      const res = attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-ear-tags-2026',
          artefact_hash: 'bad000000000000000000000000000000000000000000000000000000000dead',
        },
        fieldAgent,
      );
      expect(rejected(res)).toBe('INTEGRITY_MISMATCH');
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
    });

    it('G2-3. ID in registry, digest matches, claim type not admissible -> rejected ARTEFACT_NOT_ADMISSIBLE', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'land_right' }, secretary));

      // Attempt to corroborate land_right with ear tag document
      const res = attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'land_right',
          supporting_artefact_id: 'doc-ear-tags-2026',
        },
        fieldAgent,
      );
      expect(rejected(res)).toBe('ARTEFACT_NOT_ADMISSIBLE');
      expect(state.evidence['land_right'].level).toBe('asserted');
    });

    it('G2-4. All three checks pass -> promoted to supported', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      expect(state.evidence['livestock_claim'].level).toBe('asserted');

      const res = attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-ear-tags-2026',
        },
        fieldAgent,
      );
      state = ok(res);
      expect(state.evidence['livestock_claim'].level).toBe('supported');
      expect(state.evidence['livestock_claim'].supporting_artefact_id).toBe('doc-ear-tags-2026');
    });

    it('G2-5. Generic add_evidence with level: "supported" but no artefact fields -> falls back to prior level, does not promote', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      expect(state.evidence['livestock_claim'].level).toBe('asserted');

      // Generic mutation bypass attempt: caller passes level: 'supported' without corroborating artefact
      const res = applyAction(
        state,
        {
          type: 'add_evidence',
          evidence_type: 'livestock_claim',
          level: 'supported',
        },
        secretary,
      );
      state = ok(res);
      // Strictly prohibited from promoting: remains at prior level (asserted)
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
    });

    it('G2-6. record_agent_observation with any level field -> level unchanged', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      expect(state.evidence['livestock_claim'].level).toBe('asserted');

      // Observation passing level: 'supported'
      const res = recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: 'contact-fa-03',
          level: 'supported',
          notes: 'Agent observation asserting supported level directly',
        } as any,
        fieldAgent,
      );
      state = ok(res);
      // Observation records attribution but does not promote level
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
      expect(state.evidence['livestock_claim'].contact_ref_id).toBe('contact-fa-03');
    });
  });

  describe('Gate G12b: Full Application Byte-Level Tamper Detection', () => {
    beforeEach(() => {
      resetArtefactRegistry();
    });

    it('Mutating one byte of artefact in registry causes action rejection and prevents promotion', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      expect(state.evidence['livestock_claim'].level).toBe('asserted');

      // 1. Verify that before tampering, promotion works with a test artefact
      const art = getRegisteredArtefact('doc-ear-tags-2026')!;
      expect(art).toBeDefined();

      // 2. Tamper with one byte of the artefact content in storage/registry
      art.content = art.content.slice(0, -1) + 'X'; // mutate last byte

      // 3. Re-run attach_corroborating_evidence with the same artefact ID
      const tamperedRes = attachCorroboratingEvidenceAction(
        state,
        {
          evidence_type: 'livestock_claim',
          supporting_artefact_id: 'doc-ear-tags-2026',
        },
        fieldAgent,
      );

      // 4. Assert action rejected with INTEGRITY_MISMATCH
      expect(rejected(tamperedRes)).toBe('INTEGRITY_MISMATCH');

      // 5. Assert evidence level remains at pre-promotion state (asserted)
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
      expect(state.evidence['livestock_claim'].supporting_artefact_id).toBeUndefined();
    });
  });
});
