import { describe, expect, it } from 'vitest';
import {
  amendClaimAction,
  applyAction,
  assignVerificationAction,
  cancelAssignmentAction,
  evaluateAdmissionChecklist,
  recordAgentObservation,
  recordClaim,
  recordVerificationFindingAction,
  promoteEvidenceLevelAction,
  attachCorroboratingEvidenceAction,
} from '../src/engine/actions';
import { loadCases } from '../src/engine/data';
import type {
  ActionResult,
  Actor,
  CaseState,
  DecisionEvaluationSnapshot,
  DurableCommitEnvelope,
} from '../src/engine/types';
import {
  CASE_STORAGE_KEY,
  commitEnvelopeToStorage,
  createCommitEnvelope,
  loadStoredEnvelope,
} from '../src/engine/persistence';

function getFreshCase(id = 'case-1'): CaseState {
  const c = loadCases().find((item) => item.id === id);
  if (!c) throw new Error(`Case ${id} not found`);
  return c;
}

const secretary: Actor = { user_id: 'c1.secretary', role: 'secretary' };
const fieldAgent: Actor = { user_id: 'fa.banda', role: 'field_agent' };
const coopAgent: Actor = { user_id: 'c1.agent', role: 'coop_field_agent' };
const verifier: Actor = { user_id: 'vrf.mulenga', role: 'verifier' };
const pfiCredit: Actor = { user_id: 'pfi.credit1', role: 'pfi_credit' };

function ok(res: ActionResult): CaseState {
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(`Action failed with code: ${res.code}`);
  return res.caseState;
}

function errorCode(res: ActionResult): string {
  expect(res.ok).toBe(false);
  if (res.ok) throw new Error('Expected action to fail');
  return res.code;
}

describe('Phase 1 Domain, State, and Evidence Contracts (Gate 1)', () => {
  describe('1. Claim Recording & Initial State Isolation', () => {
    it('records claim at asserted v1 with prohibited direct promotion', () => {
      let state = getFreshCase('case-1');
      const res = recordClaim(
        state,
        {
          claim_id: 'livestock_herd',
          item: { description: '65 Boran Cattle', quantity: 65 },
        },
        secretary,
      );
      state = ok(res);
      const claim = state.evidence['livestock_herd'];
      expect(claim).toBeDefined();
      expect(claim.level).toBe('asserted');
      expect(claim.version_id).toBe(1);
      expect(claim.verified_by).toBeNull();
      expect(claim.verified_on).toBeNull();

      // Prohibited: Cooperative actor cannot record agent observation or mark verified
      const directObs = recordAgentObservation(
        state,
        { claim_id: 'livestock_herd', contact_ref_id: 'contact-fa-01' },
        secretary,
      );
      expect(errorCode(directObs)).toBe('ROLE_NOT_PERMITTED');

      const directVerified = applyAction(
        state,
        { type: 'mark_verified', evidence_type: 'livestock_herd' },
        secretary,
      );
      expect(errorCode(directVerified)).toBe('ROLE_NOT_PERMITTED');
    });
  });

  describe('2. Attributable Corroboration & Observation Conditioning', () => {
    it('requires contact_ref_id for attributable observations', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      // Attempt observation without contact_ref_id
      const noContact = recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: '',
          has_discrepancy: false,
          notes: 'Visual tag inspection completed',
        },
        coopAgent,
      );
      expect(errorCode(noContact)).toBe('CONTACT_REF_REQUIRED');
    });

    it('2a: non-adverse observation on asserted claim preserves asserted level; corroborating evidence advances to supported', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      const res = recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: 'contact-fa-01',
          has_discrepancy: false,
          notes: 'Ear tags counted and verified in paddock',
        },
        fieldAgent,
      );
      state = ok(res);
      const claim = state.evidence['livestock_claim'];
      expect(claim.level).toBe('asserted');
      expect(claim.has_discrepancy).toBe(false);
      expect(claim.contact_ref_id).toBe('contact-fa-01');
      // Prohibited side effects: cannot mark verified or affect unrelated claims
      expect(claim.verified_by).toBeNull();
      expect(state.evidence['registration'].level).toBe('verified'); // unaffected

      // Attaching corroborating evidence promotes to supported
      state = ok(
        attachCorroboratingEvidenceAction(
          state,
          {
            evidence_type: 'livestock_claim',
            supporting_artefact_id: 'doc-ear-tags-2026',
            method: 'visual_inspection',
          },
          fieldAgent,
        ),
      );
      expect(state.evidence['livestock_claim'].level).toBe('supported');
    });

    it('2b: adverse observation on asserted claim strictly preserves asserted level and flags discrepancy', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      const res = recordAgentObservation(
        state,
        {
          claim_id: 'livestock_claim',
          contact_ref_id: 'contact-fa-01',
          has_discrepancy: true,
          notes: 'Count was only 40 cattle, not 65',
        },
        coopAgent,
      );
      state = ok(res);
      const claim = state.evidence['livestock_claim'];
      // Prohibited from advancing to supported
      expect(claim.level).toBe('asserted');
      expect(claim.has_discrepancy).toBe(true);
    });

    it('2c & 2d: corroborating vs adverse observation on supported preserves supported level', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      state = ok(
        attachCorroboratingEvidenceAction(
          state,
          {
            evidence_type: 'livestock_claim',
            supporting_artefact_id: 'doc-ear-tags-2026',
          },
          coopAgent,
        ),
      );
      expect(state.evidence['livestock_claim'].level).toBe('supported');

      state = ok(
        recordAgentObservation(
          state,
          { claim_id: 'livestock_claim', contact_ref_id: 'contact-fa-01', has_discrepancy: false },
          coopAgent,
        ),
      );
      expect(state.evidence['livestock_claim'].level).toBe('supported');

      // 2c: Second corroborating non-adverse observation
      state = ok(
        recordAgentObservation(
          state,
          { claim_id: 'livestock_claim', contact_ref_id: 'contact-fa-02', has_discrepancy: false },
          coopAgent,
        ),
      );
      expect(state.evidence['livestock_claim'].level).toBe('supported');
      expect(state.evidence['livestock_claim'].history.length).toBeGreaterThan(0);

      // 2d: Conflicting adverse observation on supported
      state = ok(
        recordAgentObservation(
          state,
          { claim_id: 'livestock_claim', contact_ref_id: 'contact-fa-03', has_discrepancy: true },
          coopAgent,
        ),
      );
      // Strictly preserves supported (does not drop to asserted)
      expect(state.evidence['livestock_claim'].level).toBe('supported');
      expect(state.evidence['livestock_claim'].has_discrepancy).toBe(true);
    });
  });

  describe('3. 5-State Assignment Lifecycle & Scoped Verification', () => {
    it('enforces duplicate assignment guard on (claim_id, version_id)', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      const assign1 = assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.mulenga',
          scope: 'Verify herd size',
        },
        pfiCredit,
      );
      state = ok(assign1);
      const asg = state.verification.assignments.find((a) => a.target.ref === 'livestock_claim');
      expect(asg).toBeDefined();
      expect(asg?.status).toBe('assigned');

      // Duplicate assignment attempt on same version while assigned must be rejected
      const assignDuplicate = assignVerificationAction(
        state,
        {
          target: { kind: 'evidence', ref: 'livestock_claim', version_id: 1 },
          assigned_to: 'vrf.mulenga',
          scope: 'Second attempt',
        },
        pfiCredit,
      );
      expect(errorCode(assignDuplicate)).toBe('DUPLICATE_ASSIGNMENT');
    });

    it('Assertion 5 (updated): records finding without mutating level, then explicit promotion promotes to verified', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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
      const findingRes = recordVerificationFindingAction(
        state,
        {
          assignment_id: asg.id,
          result: 'verified_conformant',
          scope: 'Physical herd count',
          limitation: 'Sighted in pasture with GPS collar',
          method_and_evidence_examined: 'Physical inspection and tag ledger',
        },
        verifier,
      );
      state = ok(findingRes);

      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('completed');
      const claimAfterFinding = state.evidence['livestock_claim'];
      // G3 auto-promotion is removed: level remains 'asserted'
      expect(claimAfterFinding.level).toBe('asserted');
      expect(state.events[state.events.length - 1].action).toBe('record_verification_finding');

      const finding = state.verification.findings.find((f) => f.assignment_id === asg.id)!;
      const promoteRes = promoteEvidenceLevelAction(
        state,
        {
          evidence_type: 'livestock_claim',
          finding_id: finding.id,
        },
        verifier,
      );
      state = ok(promoteRes);

      const claimAfterPromotion = state.evidence['livestock_claim'];
      expect(claimAfterPromotion.level).toBe('verified');
      expect(claimAfterPromotion.verified_by).toBe('vrf.mulenga');
      const eventActions = state.events.map((e) => e.action);
      expect(eventActions).toContain('record_verification_finding');
      expect(eventActions).toContain('promote_evidence_level');
    });

    it('promotes to verified with caveats for verified_with_qualifications upon explicit promotion', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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
      const findingRes = recordVerificationFindingAction(
        state,
        {
          assignment_id: asg.id,
          result: 'verified_with_qualifications',
          scope: 'Herd count with perimeter caveat',
          limitation: 'Boundary fencing partially down',
          qualifications: ['Temporary paddock fencing', 'Missing 2 calf tags'],
        },
        verifier,
      );
      state = ok(findingRes);

      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('completed');
      expect(state.evidence['livestock_claim'].level).toBe('asserted');

      const finding = state.verification.findings.find((f) => f.assignment_id === asg.id)!;
      state = ok(
        promoteEvidenceLevelAction(
          state,
          {
            evidence_type: 'livestock_claim',
            finding_id: finding.id,
          },
          verifier,
        ),
      );

      const claim = state.evidence['livestock_claim'];
      expect(claim.level).toBe('verified');
      expect(claim.qualifications).toEqual(['Temporary paddock fencing', 'Missing 2 calf tags']);
    });

    it('neg_promote_1: rejects promotion without qualifying finding', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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
      state = ok(
        recordVerificationFindingAction(
          state,
          {
            assignment_id: asg.id,
            result: 'non_conformant',
            scope: 'Herd inspection',
            limitation: 'Count could not be reconciled with health card',
          },
          verifier,
        ),
      );
      const finding = state.verification.findings.find((f) => f.assignment_id === asg.id)!;
      const res = promoteEvidenceLevelAction(
        state,
        { evidence_type: 'livestock_claim', finding_id: finding.id },
        verifier,
      );
      expect(errorCode(res)).toBe('PROMOTE_NO_QUALIFYING_FINDING');
    });

    it('neg_promote_2: rejects promotion when cited finding references a different version', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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
      state = ok(
        recordVerificationFindingAction(
          state,
          {
            assignment_id: asg.id,
            result: 'verified_conformant',
            scope: 'Physical herd count',
            limitation: 'Sighted in pasture with GPS collar',
          },
          verifier,
        ),
      );
      const v1Finding = state.verification.findings.find((f) => f.assignment_id === asg.id)!;

      // Enterprise amends claim to v2
      state = ok(
        amendClaimAction(
          state,
          { claim_id: 'livestock_claim', item: { quantity: 80 } },
          secretary,
        ),
      );
      expect(state.evidence['livestock_claim'].version_id).toBe(2);

      // Attempt to promote v2 evidence citing v1 finding must fail with PROMOTE_VERSION_MISMATCH
      const res = promoteEvidenceLevelAction(
        state,
        { evidence_type: 'livestock_claim', finding_id: v1Finding.id },
        verifier,
      );
      expect(errorCode(res)).toBe('PROMOTE_VERSION_MISMATCH');
    });

    it('neg_promote_3: rejects promotion when a conflicting non-conformant finding exists on same version', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));

      // Two findings on version 1: one verified_conformant, one non_conformant
      state.verification.findings.push({
        id: 'find-conf-1',
        assignment_id: 'asg-1',
        result: 'verified_conformant',
        scope: 'Inspection 1',
        basis: ['livestock_claim'],
        limitation: 'None',
        verifier: 'vrf.mulenga',
        recorded_on: '2026-10-06',
        version_id: 1,
      });
      state.verification.findings.push({
        id: 'find-conflict-2',
        assignment_id: 'asg-2',
        result: 'non_conformant',
        scope: 'Inspection 2',
        basis: ['livestock_claim'],
        limitation: 'Count dispute',
        verifier: 'vrf.sakala',
        recorded_on: '2026-10-06',
        version_id: 1,
      });

      const res = promoteEvidenceLevelAction(
        state,
        { evidence_type: 'livestock_claim', finding_id: 'find-conf-1' },
        verifier,
      );
      expect(errorCode(res)).toBe('PROMOTE_CONFLICTING_FINDING');
    });

    it('preserves prior level on non_conformant and inconclusive findings (zero downgrade)', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
      state = ok(
        attachCorroboratingEvidenceAction(
          state,
          {
            evidence_type: 'livestock_claim',
            supporting_artefact_id: 'doc-ear-tags-2026',
          },
          coopAgent,
        ),
      );
      state = ok(
        recordAgentObservation(
          state,
          { claim_id: 'livestock_claim', contact_ref_id: 'contact-fa-01', has_discrepancy: false },
          coopAgent,
        ),
      );
      expect(state.evidence['livestock_claim'].level).toBe('supported');

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

      const nonConf = recordVerificationFindingAction(
        state,
        {
          assignment_id: asg.id,
          result: 'non_conformant',
          scope: 'Herd inspection',
          limitation: 'Count could not be reconciled with health card',
        },
        verifier,
      );
      state = ok(nonConf);

      // Prior level strictly preserved (zero silent downgrade)
      expect(state.evidence['livestock_claim'].level).toBe('supported');
      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('completed');
      expect(state.verification.findings.find((f) => f.assignment_id === asg.id)?.result).toBe('non_conformant');
      // No dispute created automatically
      expect(state.disputes.some((d) => d.evidence_type === 'livestock_claim')).toBe(false);
    });

    it('handles claim amendment to v2, transitions open assignment to superseded_target, and accepts late finding', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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
      expect(asg.status).toBe('assigned');

      // Enterprise amends claim to v2 while assignment on v1 is open
      state = ok(
        amendClaimAction(
          state,
          {
            claim_id: 'livestock_claim',
            item: { quantity: 80, description: 'Updated herd count 80' },
          },
          secretary,
        ),
      );

      const v2Claim = state.evidence['livestock_claim'];
      expect(v2Claim.version_id).toBe(2);
      expect(v2Claim.level).toBe('asserted');
      // Assignment on v1 transitions to superseded_target
      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('superseded_target');

      // Late finding on superseded_target is accepted but marks finding historical and does NOT verify v2
      const lateFinding = recordVerificationFindingAction(
        state,
        {
          assignment_id: asg.id,
          result: 'verified_conformant',
          scope: 'Late finding on original v1 herd',
          limitation: 'Historical inspection record',
        },
        verifier,
      );
      state = ok(lateFinding);

      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('completed_superseded');
      const finding = state.verification.findings.find((f) => f.assignment_id === asg.id)!;
      expect(finding.historical).toBe(true);
      expect(finding.version_id).toBe(1);
      // Active claim v2 remains asserted and untouched!
      expect(state.evidence['livestock_claim'].version_id).toBe(2);
      expect(state.evidence['livestock_claim'].level).toBe('asserted');
    });

    it('allows cancelling an assignment and blocks subsequent findings', () => {
      let state = getFreshCase('case-1');
      state = ok(recordClaim(state, { claim_id: 'livestock_claim' }, secretary));
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

      state = ok(cancelAssignmentAction(state, { assignment_id: asg.id }, pfiCredit));
      expect(state.verification.assignments.find((a) => a.id === asg.id)?.status).toBe('cancelled');

      // Blocked from recording finding on cancelled assignment
      const attemptFinding = recordVerificationFindingAction(
        state,
        {
          assignment_id: asg.id,
          result: 'verified_conformant',
          scope: 'Herd',
          limitation: 'Cancelled test',
        },
        verifier,
      );
      expect(errorCode(attemptFinding)).toBe('ASSIGNMENT_COMPLETED');
    });
  });

  describe('4. Durable Persistence & Reproducibility Snapshot Contracts', () => {
    it('validates 1-to-1 event-to-version increment invariant in DurableCommitEnvelope', () => {
      let state = getFreshCase('case-1');
      state.version = 0;
      const baselineVersion = 0;

      state = ok(recordClaim(state, { claim_id: 'claim_alpha' }, secretary));
      state = ok(
        recordAgentObservation(
          state,
          { claim_id: 'claim_alpha', contact_ref_id: 'contact-fa-01', has_discrepancy: false },
          coopAgent,
        ),
      );

      const envelope: DurableCommitEnvelope = {
        schema_version: '1.0',
        timestamp: new Date().toISOString(),
        saved_at: new Date().toISOString(),
        case_id: state.id,
        baseline_version: baselineVersion,
        state_version: state.version ?? 0,
        state_snapshot: state,
        event_log: state.events,
        checksum: 'dummy-sha256-hash',
      };

      // Invariant: state_version === baseline_version + event_log.length
      // Here baseline_version is 0, each action appended 1 event and incremented version by 1
      expect(envelope.state_version).toBe(state.events.length);
      expect(envelope.state_version).toBe(envelope.baseline_version + envelope.event_log.length);
    });

    it('records admission evaluation checklist separately without mutating governed evidence', () => {
      let state = getFreshCase('case-1');
      const prevLevel = state.evidence['registration'].level;

      state = ok(
        evaluateAdmissionChecklist(
          state,
          {
            evidence_type: 'registration',
            status: 'accepted',
          },
          pfiCredit,
        ),
      );

      expect(state.lender.admissions.length).toBe(1);
      expect(state.lender.admissions[0].status).toBe('accepted');
      // Governed evidence level remains completely unchanged
      expect(state.evidence['registration'].level).toBe(prevLevel);
    });

    it('verifies DecisionEvaluationSnapshot captures complete audit reproducibility inputs', () => {
      const snapshot: DecisionEvaluationSnapshot = {
        snapshot_id: 'snap-c1-001',
        case_id: 'case-1',
        destination_id: 'A',
        decided_at: '2026-10-14T00:00:00Z',
        decided_by: 'pfi.credit1',
        evaluation_ruleset_version: 'rules-v2.1',
        checklist_version: 'chk-lender-a-1.0',
        lender_policy_version: 'pol-production-2026',
        admission_evaluation: {
          evaluation_id: 'adm-001',
          outcome: 'accepted',
          evaluated_at: '2026-10-14T00:00:00Z',
          checklist_responses: {
            legal_status: 'passed',
            membership_verified: 'passed',
            land_right_confirmed: 'passed',
          },
        },
        claims_evaluated: [
          {
            claim_id: 'registration',
            version_id: 1,
            evidence_level: 'verified',
            verification_outcome: 'verified_conformant',
            qualifications: [],
            validity_state: 'current',
            dispute_state: 'undisputed',
          },
        ],
        relied_findings: [
          {
            finding_id: 'fnd-1',
            claim_id: 'registration',
            version_id: 1,
            verifier: 'vrf.mulenga',
            result: 'verified_conformant',
            qualifications: [],
            recorded_on: '2026-08-12',
          },
        ],
        governance_state: {
          has_discrepancy: false,
          officer_transition_status: 'clean',
          resolution_supplied: false,
        },
        outcome: 'approved',
        rationale: 'All primary covenants satisfied under Lender A cooperative facility',
      };

      expect(snapshot.destination_id).toBe('A');
      expect(snapshot.admission_evaluation.checklist_responses.legal_status).toBe('passed');
      expect(snapshot.relied_findings.length).toBe(1);
      expect(snapshot.outcome).toBe('approved');
    });
  });

  describe('10. Persistence and Reset (§6.1)', () => {
    class MemoryStorage implements Storage {
      private store: Record<string, string> = {};
      get length() {
        return Object.keys(this.store).length;
      }
      clear() {
        this.store = {};
      }
      getItem(key: string) {
        return this.store[key] ?? null;
      }
      key(index: number) {
        return Object.keys(this.store)[index] ?? null;
      }
      removeItem(key: string) {
        delete this.store[key];
      }
      setItem(key: string, value: string) {
        this.store[key] = value;
      }
    }

    it('persistence_10a: writes a valid envelope and restores state on load', () => {
      const storage = new MemoryStorage();
      const state = getFreshCase('case-1');
      state.version = 2;
      state.events = [
        {
          id: 'ev-1',
          action: 'record_claim',
          actor: secretary,
          at: '2026-10-06T09:00:00Z',
          target: { kind: 'evidence', ref: 'c1' },
          before: null,
          after: null,
        },
        {
          id: 'ev-2',
          action: 'record_claim',
          actor: secretary,
          at: '2026-10-06T09:05:00Z',
          target: { kind: 'evidence', ref: 'c2' },
          before: null,
          after: null,
        },
      ];

      const envelope = createCommitEnvelope(state, 0, '2026-10-06T09:10:00Z');
      const writeResult = commitEnvelopeToStorage(envelope, storage);
      expect(writeResult.ok).toBe(true);

      const loadResult = loadStoredEnvelope(storage);
      expect(loadResult.ok).toBe(true);
      if (loadResult.ok) {
        expect(loadResult.envelope.schema_version).toBe('2.0');
        expect(loadResult.envelope.case_id).toBe('case-1');
        expect(loadResult.envelope.state_snapshot.id).toBe('case-1');
        expect(loadResult.envelope.state_version).toBe(2);
        expect(loadResult.envelope.event_log.length).toBe(2);
      }
    });

    it('persistence_10b: failed storage write retains in-memory state and returns save error', () => {
      const storage = new MemoryStorage();
      storage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const state = getFreshCase('case-1');
      const envelope = createCommitEnvelope(state, 0);
      const writeResult = commitEnvelopeToStorage(envelope, storage);

      expect(writeResult.ok).toBe(false);
      if (!writeResult.ok) {
        expect(writeResult.error).toContain('QuotaExceededError');
      }
      // Stored key is untouched
      expect(storage.getItem(CASE_STORAGE_KEY)).toBeNull();
    });

    it('persistence_10c: rejects structurally invalid envelope (event count mismatch) and clears key', () => {
      const storage = new MemoryStorage();
      const state = getFreshCase('case-1');
      state.version = 5;

      const corruptEnvelope: DurableCommitEnvelope = {
        schema_version: '2.0',
        saved_at: '2026-10-06T09:00:00Z',
        case_id: 'case-1',
        baseline_version: 0,
        state_version: 5,
        state_snapshot: state,
        event_log: [
          {
            id: 'ev-1',
            action: 'test',
            actor: secretary,
            at: '2026-10-06T09:00:00Z',
            target: { kind: 'evidence', ref: 'c1' },
            before: null,
            after: null,
          },
          {
            id: 'ev-2',
            action: 'test',
            actor: secretary,
            at: '2026-10-06T09:01:00Z',
            target: { kind: 'evidence', ref: 'c2' },
            before: null,
            after: null,
          },
        ],
        checksum: 'fake-checksum',
      };

      storage.setItem(CASE_STORAGE_KEY, JSON.stringify(corruptEnvelope));
      const loadResult = loadStoredEnvelope(storage);

      expect(loadResult.ok).toBe(false);
      if (!loadResult.ok) {
        expect(loadResult.cleared).toBe(true);
      }
      expect(storage.getItem(CASE_STORAGE_KEY)).toBeNull();
    });

    it('persistence_10d: rejects corrupt non-JSON content and clears key', () => {
      const storage = new MemoryStorage();
      storage.setItem(CASE_STORAGE_KEY, 'not valid json');

      const loadResult = loadStoredEnvelope(storage);
      expect(loadResult.ok).toBe(false);
      if (!loadResult.ok) {
        expect(loadResult.cleared).toBe(true);
      }
      expect(storage.getItem(CASE_STORAGE_KEY)).toBeNull();
    });
  });
});
