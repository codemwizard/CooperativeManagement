import { describe, expect, it } from 'vitest';
import expectedResults from './expected-results.json';
import expectedPipeline from './expected-pipeline.json';
import forbiddenTerms from '../data/forbidden_terms.json';
import { applyAction } from '../src/engine/actions';
import { monitoringState } from '../src/engine/covenants';
import { baselineCases, destinationById, destinations, loadCases, meta, userFor } from '../src/engine/data';
import { buildDossier, dossierToCsv } from '../src/engine/dossier';
import { evaluate } from '../src/engine/evaluate';
import { cohortSummary, evaluationMap, funnel, gapsClosed, interventionQueue } from '../src/engine/pipeline';
import { assertCaseVisible, visibleCases } from '../src/engine/scope';
import type { ActionResult, Actor, CaseState } from '../src/engine/types';

const demoDate = meta.demo_date;
const actor = (user_id: string, role: Actor['role'], cohorts?: Actor['cohorts']): Actor => ({ user_id, role, cohorts });
const byId = (cases: CaseState[], id: string) => {
  const found = cases.find((caseState) => caseState.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};
const ok = (result: ActionResult): CaseState => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.caseState;
};
const rejected = (result: ActionResult): string => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected rejection');
  expect(result.rule.length).toBeGreaterThan(0);
  return result.code;
};
const evalAll = (cases: CaseState[]) => evaluationMap(cases, destinations, demoDate, evaluate);

function applyT2(caseState: CaseState): CaseState {
  let current = ok(applyAction(caseState, { type: 'upload_minutes' }, actor('c1.secretary', 'secretary')));
  current = ok(applyAction(current, { type: 'signoff_minutes' }, actor('c1.chairman', 'chairman')));
  current = ok(applyAction(current, { type: 'mark_verified', evidence_type: 'governance' }, actor('fa.banda', 'field_agent')));
  current = ok(
    applyAction(
      current,
      {
        type: 'add_evidence',
        evidence_type: 'farming_history',
        level: 'supported',
        item: { seasons: 2, basis: 'Programme records' },
      },
      actor('c1.treasurer', 'treasurer'),
    ),
  );
  return current;
}

describe('Phase 1 engine baseline', () => {
  it('matches all 27 expected readiness results', () => {
    const cases = loadCases();
    for (const caseState of cases) {
      for (const destination of destinations) {
        const got = evaluate(caseState, destination, demoDate).summary;
        const exp = expectedResults.expected[caseState.id as keyof typeof expectedResults.expected][destination.id];
        expect(got.ready, `${caseState.id}/${destination.id}.ready`).toEqual(exp.ready);
        expect(got.unresolved, `${caseState.id}/${destination.id}.unresolved`).toEqual(exp.unresolved);
        expect(got.exceptions, `${caseState.id}/${destination.id}.exceptions`).toEqual(exp.exceptions);
        expect(got.not_applicable, `${caseState.id}/${destination.id}.not_applicable`).toEqual(exp.not_applicable);
        expect(got.assessment_time, `${caseState.id}/${destination.id}.assessment_time`).toEqual(exp.assessment_time);
        expect(got.satisfied, `${caseState.id}/${destination.id}.satisfied`).toEqual(exp.satisfied);
      }
    }
  });

  it('T1 switches destination without mutating evidence or events', () => {
    const case1 = byId(loadCases(), 'case-1');
    const evidenceBefore = structuredClone(case1.evidence);
    expect(evaluate(case1, destinationById.A, demoDate).summary.unresolved).toEqual(['A2', 'A6']);
    expect(evaluate(case1, destinationById.B, demoDate).summary.unresolved).toEqual(['B3', 'B4', 'B5', 'B7']);
    expect(evaluate(case1, destinationById.N, demoDate).summary.ready).toBe(true);
    expect(case1.evidence).toEqual(evidenceBefore);
    expect(case1.events).toEqual([]);
  });

  it('T2 closes two gaps and preserves history', () => {
    const remediated = applyT2(byId(loadCases(), 'case-1'));
    expect(evaluate(remediated, destinationById.A, demoDate).summary.ready).toBe(true);
    expect(evaluate(remediated, destinationById.B, demoDate).summary.unresolved).toEqual(['B3', 'B4', 'B5', 'B7']);
    expect(evaluate(remediated, destinationById.N, demoDate).summary.ready).toBe(true);
    expect(remediated.evidence.governance.level).toBe('verified');
    expect(remediated.evidence.governance.verified_by).toBe('fa.banda');
    expect(remediated.evidence.governance.history.length).toBeGreaterThanOrEqual(2);
    expect(remediated.events.map((event) => event.action)).toEqual(['add_evidence', 'signoff_minutes', 'mark_verified', 'add_evidence']);
  });

  it('T3 evaluates stale registration by date', () => {
    const case3 = byId(loadCases(), 'case-3');
    expect(evaluate(case3, destinationById.A, demoDate).summary.exceptions).toEqual(['A1']);
    expect(evaluate(case3, destinationById.B, demoDate).summary.exceptions).toEqual(['B1']);
    expect(evaluate(case3, destinationById.N, demoDate).summary.exceptions).toEqual(['N1']);
    expect(evaluate(case3, destinationById.A, '2026-09-29').summary.ready).toBe(true);
  });

  it('T4 early off-take never blocks readiness', () => {
    const case1 = ok(
      applyAction(
        byId(loadCases(), 'case-1'),
        { type: 'add_evidence', evidence_type: 'offtake', level: 'supported' },
        actor('c1.secretary', 'secretary'),
      ),
    );
    const a10 = evaluate(case1, destinationById.A, demoDate).requirements.find((requirement) => requirement.id === 'A10');
    expect(a10?.state).toBe('assessment_time');
    expect(a10?.provided_early).toBe(true);
    expect(evaluate(case1, destinationById.A, demoDate).summary.unresolved).toEqual(['A2', 'A6']);

    const case5 = ok(
      applyAction(
        byId(loadCases(), 'case-5'),
        { type: 'add_evidence', evidence_type: 'offtake', level: 'supported', valid_until: '2026-01-01' },
        actor('c5.secretary', 'secretary'),
      ),
    );
    expect(evaluate(case5, destinationById.A, demoDate).summary.ready).toBe(true);
  });

  it('T5 enforces verification and confirmation segregation', () => {
    const uploaded = ok(applyAction(byId(loadCases(), 'case-1'), { type: 'upload_minutes' }, actor('c1.secretary', 'secretary')));
    expect(rejected(applyAction(uploaded, { type: 'mark_verified', evidence_type: 'governance' }, actor('c1.secretary', 'secretary')))).toBe(
      'ROLE_NOT_PERMITTED',
    );
    const suppliedByFieldAgent = structuredClone(uploaded);
    suppliedByFieldAgent.evidence.governance.supplied_by = 'fa.banda';
    suppliedByFieldAgent.events.push({ id: 'seed', at: demoDate, actor: actor('c1.chairman', 'chairman'), action: 'signoff_minutes', target: null, before: null, after: null });
    expect(rejected(applyAction(suppliedByFieldAgent, { type: 'mark_verified', evidence_type: 'governance' }, actor('fa.banda', 'field_agent')))).toBe(
      'SELF_VERIFICATION',
    );
    expect(rejected(applyAction(uploaded, { type: 'mark_verified', evidence_type: 'governance' }, actor('fa.banda', 'field_agent')))).toBe(
      'SIGNOFF_REQUIRED',
    );
    expect(rejected(applyAction(uploaded, { type: 'confirm_payment', recorded_by: 'c1.treasurer' }, actor('c1.treasurer', 'treasurer')))).toBe(
      'SELF_CONFIRMATION',
    );
    expect(rejected(applyAction(uploaded, { type: 'add_evidence', evidence_type: 'offtake' }, actor('pfi.credit1', 'pfi_credit')))).toBe('READ_ONLY_ROLE');
    const verifiedAttempt = ok(
      applyAction(uploaded, { type: 'add_evidence', evidence_type: 'offtake', level: 'verified' }, actor('c1.secretary', 'secretary')),
    );
    expect(verifiedAttempt.evidence.offtake.level).toBe('supported');
    const resupplied = ok(applyAction(byId(loadCases(), 'case-5'), { type: 'add_evidence', evidence_type: 'registration' }, actor('c5.secretary', 'secretary')));
    expect(resupplied.evidence.registration.level).toBe('supported');
    expect(resupplied.evidence.registration.verified_by).toBeNull();
  });

  it('T6 restructuring closes one fit and can break another', () => {
    const case1 = ok(
      applyAction(
        byId(loadCases(), 'case-1'),
        { type: 'restructure_request', request: { structure: 'per_group', amount_per_group: 25_000, groups: 6, term_months: 9 } },
        actor('c1.chairman', 'chairman'),
      ),
    );
    expect(evaluate(case1, destinationById.B, demoDate).summary.unresolved).toEqual(['B3', 'B4', 'B5']);
    expect(evaluate(case1, destinationById.A, demoDate).summary.unresolved).toEqual(['A2', 'A6', 'A11']);
  });

  it('T7 gives opposite lender results for case-9', () => {
    const case9 = byId(loadCases(), 'case-9');
    expect(evaluate(case9, destinationById.B, demoDate).summary.ready).toBe(true);
    expect(evaluate(case9, destinationById.A, demoDate).summary.unresolved).toEqual(['A2', 'A4', 'A5', 'A6', 'A11']);
    expect(evaluate(case9, destinationById.N, demoDate).summary.ready).toBe(true);
  });

  it('T8a and D1 seed data integrity hold', () => {
    const cases = loadCases();
    for (const caseState of cases) {
      expect(caseState.evidence.project_definition, caseState.id).toBeTruthy();
      for (const [evidenceType, item] of Object.entries(caseState.evidence)) {
        if (item.level === 'supported' || item.level === 'verified') expect(item.limitation, `${caseState.id}.${evidenceType}`).not.toBe('');
        if (item.level === 'verified') {
          expect(item.verified_by).toBeTruthy();
          expect(item.verified_on).toBeTruthy();
          expect(item.verified_by).not.toBe(item.supplied_by);
        }
      }
      for (const destination of destinations) {
        for (const result of evaluate(caseState, destination, demoDate).requirements) {
          if (result.evidence_ref) expect(caseState.evidence[result.evidence_ref]).toBeTruthy();
        }
      }
      for (const covenant of caseState.financing?.covenants ?? []) {
        expect(destinationById[caseState.financing?.destination as 'A' | 'B' | 'N'].covenants.some((candidate) => candidate.id === covenant.id)).toBe(true);
      }
    }
  });

  it('X1 computes monitoring state', () => {
    expect(monitoringState(byId(loadCases(), 'case-6'), demoDate, meta.monitoring_due_window_days)).toBe('current');
    expect(monitoringState(byId(loadCases(), 'case-7'), demoDate, meta.monitoring_due_window_days)).toBe('overdue');
    const base = byId(loadCases(), 'case-6');
    if (!base.financing) throw new Error('missing financing');
    base.financing.covenants = [{ id: 'quarterly_cash_statement', due_date: '2026-10-20', received: false, last_received: null }];
    expect(monitoringState(base, demoDate, 14)).toBe('due');
    base.financing.covenants[0].due_date = '2026-10-21';
    expect(monitoringState(base, demoDate, 14)).toBe('current');
    base.financing.covenants[0].received = true;
    expect(monitoringState(base, demoDate, 14)).toBe('current');
  });
});

describe('Phase 1 disputes', () => {
  it('P1 and P2 raise and resolve a dispute without evidence mutation on raise', () => {
    const case8 = byId(loadCases(), 'case-8');
    const beforeEvidence = structuredClone(case8.evidence.income_records);
    const disputed = ok(
      applyAction(
        case8,
        { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'verifier_concern', note: 'Needs independent re-check' },
        actor('pfi.credit1', 'pfi_credit'),
      ),
    );
    expect(evaluate(disputed, destinationById.A, demoDate).summary).toMatchObject({ ready: false, exceptions: ['A7'], unresolved: [] });
    expect(evaluate(disputed, destinationById.B, demoDate).summary).toEqual(evaluate(case8, destinationById.B, demoDate).summary);
    expect(evaluate(disputed, destinationById.N, demoDate).summary).toEqual(evaluate(case8, destinationById.N, demoDate).summary);
    expect(disputed.evidence.income_records).toEqual(beforeEvidence);

    const resolved = ok(applyAction(disputed, { type: 'resolve_dispute', evidence_type: 'income_records' }, actor('fa.mulenga', 'field_agent')));
    expect(resolved.disputes[0].status).toBe('resolved');
    expect(resolved.evidence.income_records.level).toBe('verified');
    expect(resolved.evidence.income_records.verified_by).toBe('fa.mulenga');
    expect(resolved.evidence.income_records.history.length).toBeGreaterThan(0);
    expect(evaluate(resolved, destinationById.A, demoDate).summary.ready).toBe(true);
  });

  it('P3 blocks same verifier then allows another field agent', () => {
    const disputed = ok(
      applyAction(
        byId(loadCases(), 'case-6'),
        { type: 'raise_dispute', evidence_type: 'registration', reason_code: 'out_of_date', note: 'Check renewal' },
        actor('pfi.credit1', 'pfi_credit'),
      ),
    );
    expect(rejected(applyAction(disputed, { type: 'resolve_dispute', evidence_type: 'registration' }, actor('fa.banda', 'field_agent')))).toBe('SAME_VERIFIER');
    const resolved = ok(applyAction(disputed, { type: 'resolve_dispute', evidence_type: 'registration' }, actor('fa.mulenga', 'field_agent')));
    expect(evaluate(resolved, destinationById.A, demoDate).summary.ready).toBe(true);
    expect(evaluate(resolved, destinationById.N, demoDate).summary.ready).toBe(true);
    expect(resolved.evidence.registration.limitation).toBe(meta.mandatory_limitations.registration_verified);
  });

  it('P4 applies dispute constraint codes', () => {
    const case8 = byId(loadCases(), 'case-8');
    expect(rejected(applyAction(case8, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: '' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'DISPUTE_REASON_REQUIRED',
    );
    expect(rejected(applyAction(case8, { type: 'raise_dispute', evidence_type: 'missing', reason_code: 'other', note: 'x' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'NO_SUCH_EVIDENCE',
    );
    const disputed = ok(
      applyAction(case8, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'x' }, actor('pfi.credit1', 'pfi_credit')),
    );
    expect(rejected(applyAction(disputed, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'x' }, actor('pfi.analyst1', 'pfi_analyst')))).toBe(
      'DISPUTE_ALREADY_OPEN',
    );
    const ownEvidenceCase = structuredClone(case8);
    ownEvidenceCase.evidence.income_records.supplied_by = 'fa.mulenga';
    expect(rejected(applyAction(ownEvidenceCase, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'x' }, actor('fa.mulenga', 'field_agent')))).toBe(
      'SELF_DISPUTE',
    );
    expect(rejected(applyAction(case8, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'approved', note: 'x' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'DISPUTE_REASON_REQUIRED',
    );
    expect(rejected(applyAction(disputed, { type: 'resolve_dispute', evidence_type: 'income_records' }, actor('c8.treasurer', 'treasurer')))).toBe(
      'ROLE_NOT_PERMITTED',
    );
    expect(rejected(applyAction(disputed, { type: 'withdraw_dispute', evidence_type: 'income_records' }, actor('pfi.analyst1', 'pfi_analyst')))).toBe(
      'NOT_DISPUTE_RAISER',
    );
    expect(rejected(applyAction(case8, { type: 'not_a_real_action' }, actor('pfi.credit1', 'pfi_credit')))).toBe('UNSUPPORTED_ACTION');
  });

  it('P5 preserves presented snapshot after live dispute', () => {
    const case8 = byId(loadCases(), 'case-8');
    const snapshot = structuredClone(case8.presentation);
    const disputed = ok(
      applyAction(case8, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'after present' }, actor('pfi.credit1', 'pfi_credit')),
    );
    expect(disputed.presentation).toEqual(snapshot);
    expect(disputed.disputes[0].status).toBe('open');
  });
});

describe('Phase 1 verification, scope, pipeline, and export', () => {
  it('L1 keeps lender requests and outcomes separate from presentation state', () => {
    const case8 = byId(loadCases(), 'case-8');
    const beforePresentation = structuredClone(case8.presentation);
    const requested = ok(
      applyAction(
        case8,
        { type: 'request_evidence', requirement_id: 'A7', evidence_type: 'income_records', note: 'Need statements.' },
        actor('pfi.credit1', 'pfi_credit'),
      ),
    );
    expect(requested.presentation).toEqual(beforePresentation);
    expect(requested.lender.requests).toHaveLength(1);
    expect(requested.lender.requests[0]).toMatchObject({ requirement_id: 'A7', evidence_type: 'income_records', status: 'open' });

    const approved = ok(
      applyAction(requested, { type: 'record_outcome', outcome: 'approved', note: 'Lender-owned outcome.' }, actor('pfi.credit1', 'pfi_credit')),
    );
    expect(approved.presentation).toEqual(beforePresentation);
    expect(approved.lender.outcomes[0]).toMatchObject({ outcome: 'approved', recorded_by: 'pfi.credit1' });

    expect(rejected(applyAction(byId(loadCases(), 'case-1'), { type: 'record_outcome', outcome: 'approved' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'PRESENTATION_REQUIRED',
    );
    expect(
      rejected(
        applyAction(
          byId(loadCases(), 'case-1'),
          { type: 'request_evidence', requirement_id: 'A7', evidence_type: 'income_records', note: 'Need statements.' },
          actor('pfi.credit1', 'pfi_credit'),
        ),
      ),
    ).toBe('PRESENTATION_REQUIRED');
  });

  it('V1-V3 record finding and reliance without evidence changes', () => {
    const case8 = byId(loadCases(), 'case-8');
    const beforeEvidence = structuredClone(case8.evidence.income_records);
    const found = ok(
      applyAction(
        case8,
        { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'Income records', limitation: 'Records incomplete' },
        actor('vrf.mulenga', 'verifier'),
      ),
    );
    expect(found.verification.assignments.find((assignment) => assignment.id === 'asg-1')?.status).toBe('completed');
    expect(found.verification.findings[0].result).toBe('not_verified');
    expect(found.evidence.income_records).toEqual(beforeEvidence);

    const relied = ok(applyAction(found, { type: 'record_reliance', finding_id: 'fnd-1', reliance: 'relied' }, actor('pfi.credit1', 'pfi_credit')));
    expect(relied.verification.reliance[0].reliance).toBe('relied');
    expect(rejected(applyAction(relied, { type: 'record_reliance', finding_id: 'fnd-1', reliance: 'relied' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'RELIANCE_ALREADY_RECORDED',
    );
    expect(rejected(applyAction(found, { type: 'record_reliance', finding_id: 'fnd-1', reliance: 'relied' }, actor('c8.secretary', 'secretary')))).toBe(
      'ROLE_NOT_PERMITTED',
    );
    expect(rejected(applyAction(case8, { type: 'record_reliance', finding_id: 'missing', reliance: 'relied' }, actor('pfi.credit1', 'pfi_credit')))).toBe('NO_FINDING');
    expect(rejected(applyAction(found, { type: 'record_reliance', finding_id: 'fnd-1', reliance: 'approved' }, actor('pfi.analyst1', 'pfi_credit')))).toBe(
      'INVALID_RELIANCE',
    );
  });

  it('V2 and V4 enforce verification constraints', () => {
    const case8 = byId(loadCases(), 'case-8');
    expect(
      rejected(
        applyAction(
          case8,
          { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'x', limitation: 'x' },
          actor('vrf.sakala', 'verifier'),
        ),
      ),
    ).toBe('NOT_ASSIGNEE');
    const found = ok(
      applyAction(
        case8,
        { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'x', limitation: 'x' },
        actor('vrf.mulenga', 'verifier'),
      ),
    );
    expect(
      rejected(
        applyAction(
          found,
          { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'x', limitation: 'x' },
          actor('vrf.mulenga', 'verifier'),
        ),
      ),
    ).toBe('ASSIGNMENT_COMPLETED');
    expect(
      rejected(
        applyAction(case8, { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'x', limitation: '' }, actor('vrf.mulenga', 'verifier')),
      ),
    ).toBe('FINDING_FIELDS_REQUIRED');
    expect(
      rejected(
        applyAction(case8, { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'approved', scope: 'x', limitation: 'x' }, actor('vrf.mulenga', 'verifier')),
      ),
    ).toBe('FINDING_FIELDS_REQUIRED');
    const selfVerification = structuredClone(case8);
    selfVerification.verification.assignments[0].assigned_to = 'c8.treasurer';
    expect(
      rejected(
        applyAction(
          selfVerification,
          { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'x', limitation: 'x' },
          actor('c8.treasurer', 'verifier'),
        ),
      ),
    ).toBe('SELF_VERIFICATION');

    const case1 = byId(loadCases(), 'case-1');
    const initialAssignmentCount = case1.verification.assignments.length;
    expect(
      ok(
        applyAction(
          case1,
          { type: 'assign_verification', target: { kind: 'claim', ref: 'claim-1' }, assigned_to: 'vrf.sakala', scope: 'Area only' },
          actor('ta.officer1', 'ta', ['Readiness Cohort 1']),
        ),
      ).verification.assignments.length,
    ).toBe(initialAssignmentCount + 1);
    expect(rejected(applyAction(case1, { type: 'assign_verification', target: { kind: 'claim', ref: 'claim-1' }, assigned_to: 'vrf.sakala' }, actor('c1.secretary', 'secretary')))).toBe(
      'ROLE_NOT_PERMITTED',
    );
    expect(rejected(applyAction(case1, { type: 'assign_verification', target: { kind: 'claim', ref: 'claim-1' }, assigned_to: 'pfi.credit1' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'NO_SUCH_VERIFIER',
    );
    expect(rejected(applyAction(case1, { type: 'assign_verification', target: { kind: 'claim', ref: 'missing' }, assigned_to: 'vrf.sakala' }, actor('pfi.credit1', 'pfi_credit')))).toBe(
      'NO_SUCH_TARGET',
    );
  });

  it('F1-F3 compute funnel, cohorts, and interventions from engine output', () => {
    const cases = loadCases();
    const results = evalAll(cases);
    expect(funnel(cases, results)).toEqual(expectedPipeline.funnel);
    expect(cohortSummary(cases, results)).toMatchObject(expectedPipeline.cohorts);
    for (const destination of destinations) {
      expect(interventionQueue(cases, results, destination).counts).toEqual(expectedPipeline.open_interventions_by_destination[destination.id]);
    }
    expect(interventionQueue(cases, results, destinationById.N).rows.find((row) => row.case_id === 'case-3' && row.requirement_id === 'N1')?.class).toBe('blocked');
    expect(interventionQueue(cases, results, destinationById.B).rows.filter((row) => row.requirement_id === 'B7').every((row) => row.class === 'restructure')).toBe(true);
  });

  it('F4 updates gaps closed and lender-ready funnel after T2', () => {
    const baseline = loadCases();
    const current = loadCases();
    current[0] = applyT2(current[0]);
    const baselineResults = evalAll(baseline);
    const currentResults = evalAll(current);
    expect(gapsClosed(baselineResults['case-1'].A, currentResults['case-1'].A)).toEqual(['A2', 'A6']);
    expect(gapsClosed(baselineResults['case-1'].B, currentResults['case-1'].B)).toEqual([]);
    expect(gapsClosed(baselineResults['case-1'].N, currentResults['case-1'].N)).toEqual([]);
    expect(funnel(current, currentResults).ready_lender.count).toBe(6);
  });

  it('U2 pipeline and cohort numbers change when state changes', () => {
    const baseline = loadCases();
    const current = loadCases();
    const baselineResults = evalAll(baseline);
    const originalCurrent = evalAll(current);
    expect(funnel(current, originalCurrent).ready_lender.count).toBe(expectedPipeline.funnel.ready_lender.count);
    expect(cohortSummary(current, originalCurrent, baselineResults)['Readiness Cohort 1'].programme_ready).toBe(
      expectedPipeline.cohorts['Readiness Cohort 1'].programme_ready,
    );

    current[0] = applyT2(current[0]);
    const changedCurrent = evalAll(current);
    expect(funnel(current, changedCurrent).ready_lender.count).toBe(expectedPipeline.funnel.ready_lender.count + 1);
    expect(cohortSummary(current, changedCurrent, baselineResults)['Readiness Cohort 1'].programme_ready).toBe(
      expectedPipeline.cohorts['Readiness Cohort 1'].programme_ready,
    );
    expect(gapsClosed(baselineResults['case-1'].A, changedCurrent['case-1'].A)).toEqual(['A2', 'A6']);
  });

  it('R1 and R2 enforce scoped views', () => {
    const cases = loadCases();
    const ta = userFor('ta.officer1');
    const fundManager = userFor('fm.officer1');
    if (!ta || !fundManager) throw new Error('missing users');
    expect(visibleCases(ta, cases).map((caseState) => caseState.id)).toEqual(['case-1', 'case-2', 'case-3', 'case-4', 'case-5', 'case-10']);
    expect(assertCaseVisible(ta, byId(cases, 'case-8'))).toMatchObject({ ok: false, code: 'ACCESS_DENIED_COHORT' });
    expect(rejected(applyAction(byId(cases, 'case-1'), { type: 'add_evidence', evidence_type: 'offtake' }, ta))).toBe('READ_ONLY_ROLE');
    expect(visibleCases(fundManager, cases).length).toBe(10);
    expect(rejected(applyAction(byId(cases, 'case-1'), { type: 'raise_dispute', evidence_type: 'governance', reason_code: 'other', note: 'x' }, fundManager))).toBe(
      'ROLE_NOT_PERMITTED',
    );
  });

  it('E1 and E2 export readiness records', () => {
    const dossier = buildDossier(byId(loadCases(), 'case-1'), destinationById.A, demoDate);
    const csv = dossierToCsv(dossier);
    expect(csv.split('\n')[0].split(',')).toEqual([
      'requirement_id',
      'title',
      'state',
      'applicability_reason',
      'evidence_type',
      'evidence_level',
      'supplied_by',
      'supplied_on',
      'verified_by',
      'verified_on',
      'limitation',
      'dispute_status',
      'finding_result',
    ]);
    expect(csv.split('\n')).toHaveLength(destinationById.A.requirements.length + 1);
    expect(csv).not.toContain('demo_role');
    expect(csv).not.toContain('notes');

    const disputed = ok(
      applyAction(
        byId(loadCases(), 'case-8'),
        { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'x' },
        actor('pfi.credit1', 'pfi_credit'),
      ),
    );
    const found = ok(
      applyAction(
        disputed,
        { type: 'record_verification_finding', assignment_id: 'asg-1', result: 'not_verified', scope: 'Income records', limitation: 'Records incomplete' },
        actor('vrf.mulenga', 'verifier'),
      ),
    );
    const exported = JSON.stringify(buildDossier(found, destinationById.A, demoDate));
    expect(exported).toContain('"illustrative":true');
    expect(exported).toContain('Symphony establishes and governs readiness evidence');
    expect(exported).toContain('income_records');
    expect(exported).toContain('not_verified');
    expect(exported).not.toContain('demo_role');
    expect(exported).not.toContain('notes');
    for (const term of forbiddenTerms.terms) expect(exported.toLowerCase()).not.toContain(term.toLowerCase());

    const resolved = ok(applyAction(found, { type: 'resolve_dispute', evidence_type: 'income_records' }, actor('fa.mulenga', 'field_agent')));
    const reopened = ok(
      applyAction(resolved, { type: 'raise_dispute', evidence_type: 'income_records', reason_code: 'other', note: 'new concern' }, actor('pfi.credit1', 'pfi_credit')),
    );
    const reopenedDossier = buildDossier(reopened, destinationById.A, demoDate);
    expect(reopenedDossier.requirements.find((requirement) => requirement.id === 'A7')?.dispute_status).toBe('open');
  });

  it('E3 uses an actual presented snapshot when one exists', () => {
    const case1 = byId(loadCases(), 'case-1');
    const presented = ok(
      applyAction(case1, { type: 'present_to_destination', destination: 'A', snapshot: evaluate(case1, destinationById.A, demoDate) }, actor('c1.chairman', 'chairman')),
    );
    const remediatedAfterPresentation = applyT2(presented);
    const snapshotDossier = buildDossier(remediatedAfterPresentation, destinationById.A, demoDate, 'presented_snapshot');
    const liveDossier = buildDossier(remediatedAfterPresentation, destinationById.A, demoDate, 'live_state');
    expect(snapshotDossier.readiness.ready).toBe(false);
    expect(snapshotDossier.readiness.unresolved).toEqual(['A2', 'A6']);
    expect(liveDossier.readiness.ready).toBe(true);
  });

  it('baseline cases are loadable with V3 state extensions', () => {
    expect(baselineCases).toHaveLength(10);
    expect(baselineCases.every((caseState) => Array.isArray(caseState.disputes))).toBe(true);
    expect(byId([...baselineCases], 'case-8').verification.assignments.map((assignment) => assignment.id)).toContain('asg-1');
  });
});
