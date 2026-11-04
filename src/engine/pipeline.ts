import interventionsData from '../../data/interventions.json';
import { monitoringState } from './covenants';
import type { CaseState, Destination, Evaluation } from './types';

type EvaluationsByCase = Record<string, Record<string, Evaluation>>;

export function evaluationMap(cases: CaseState[], destinations: Destination[], demoDate: string, evaluateFn: (c: CaseState, d: Destination, date: string) => Evaluation): EvaluationsByCase {
  return Object.fromEntries(
    cases.map((caseState) => [
      caseState.id,
      Object.fromEntries(destinations.map((destination) => [destination.id, evaluateFn(caseState, destination, demoDate)])),
    ]),
  ) as EvaluationsByCase;
}

export function funnel(cases: CaseState[], results: EvaluationsByCase) {
  const stage = (key: string, filtered: CaseState[]) => [key, { count: filtered.length, cases: filtered.map((caseState) => caseState.id) }];
  return Object.fromEntries([
    stage('enrolled', cases),
    stage('ready_programme', cases.filter((caseState) => results[caseState.id].N.summary.ready)),
    stage('ready_lender', cases.filter((caseState) => results[caseState.id].A.summary.ready || results[caseState.id].B.summary.ready)),
    stage('presented', cases.filter((caseState) => caseState.presentation || caseState.financing)),
    stage(
      'lender_response_recorded',
      cases.filter((caseState) => Boolean((caseState.presentation as { lender_response?: unknown } | null)?.lender_response) || Boolean(caseState.financing)),
    ),
    stage('financed', cases.filter((caseState) => caseState.financing?.status === 'financed')),
  ]);
}

export function cohortSummary(cases: CaseState[], current: EvaluationsByCase, baseline: EvaluationsByCase = current) {
  const cohorts = [...new Set(cases.map((caseState) => caseState.programme))];
  return Object.fromEntries(
    cohorts.map((cohort) => {
      const cohortCases = cases.filter((caseState) => caseState.programme === cohort);
      const groups = ['legal', 'governance', 'membership', 'project', 'environment', 'inclusion'];
      return [
        cohort,
        {
          cases: cohortCases.length,
          programme_ready: cohortCases.filter((caseState) => current[caseState.id].N.summary.ready).length,
          satisfied_by_group: Object.fromEntries(
            groups.map((group) => [
              group,
              cohortCases.filter((caseState) => {
                const reqs = current[caseState.id].N.requirements.filter((requirement) => requirement.group === group);
                return reqs.length > 0 && reqs.every((requirement) => requirement.state === 'satisfied');
              }).length,
            ]),
          ),
          baseline_programme_ready: cohortCases.filter((caseState) => baseline[caseState.id].N.summary.ready).length,
        },
      ];
    }),
  );
}

export function interventionQueue(cases: CaseState[], results: EvaluationsByCase, destination: Destination) {
  const rows = cases.flatMap((caseState) =>
    destination.requirements.flatMap((requirement) => {
      const result = results[caseState.id][destination.id].requirements.find((candidate) => candidate.id === requirement.id);
      if (!result || (result.state !== 'unresolved' && result.state !== 'exception')) return [];
      const fit = interventionsData.fit;
      const byEvidenceType = interventionsData.by_evidence_type as Record<string, { class: string; owner_role: string; action: string }>;
      const config =
        result.state === 'exception'
          ? { class: 'blocked', owner_role: byEvidenceType[result.evidence_ref ?? '']?.owner_role ?? 'field_agent', action: 'Resolve the exception' }
          : requirement.rule.kind === 'fit'
            ? fit
            : byEvidenceType[requirement.rule.kind === 'assessment_time' ? '' : requirement.rule.evidence_type];
      return [
        {
          case_id: caseState.id,
          requirement_id: requirement.id,
          class: config.class,
          owner_role: config.owner_role,
          action: config.action,
        },
      ];
    }),
  );
  const counts = { standard: 0, specialist: 0, restructure: 0, blocked: 0 };
  for (const row of rows) counts[row.class as keyof typeof counts] += 1;
  return { rows, counts };
}

export function gapsClosed(baseline: Evaluation, current: Evaluation): string[] {
  return baseline.requirements
    .filter((requirement) => requirement.state === 'unresolved' || requirement.state === 'exception')
    .filter((requirement) => current.requirements.find((candidate) => candidate.id === requirement.id)?.state === 'satisfied')
    .map((requirement) => requirement.id);
}

export function portfolioSummary(cases: CaseState[], results: EvaluationsByCase, demoDate: string, dueWindowDays: number) {
  const financed = cases.filter((caseState) => caseState.financing?.status === 'financed');
  const monitoring = financed.reduce(
    (counts, caseState) => {
      const state = monitoringState(caseState, demoDate, dueWindowDays);
      if (state) counts[state] += 1;
      return counts;
    },
    { current: 0, due: 0, overdue: 0 },
  );
  const readyByDestination = Object.fromEntries(
    ['A', 'B', 'N'].map((destinationId) => [
      destinationId,
      cases.filter((caseState) => results[caseState.id][destinationId].summary.ready).map((caseState) => caseState.id),
    ]),
  );
  return {
    cooperatives: cases.length,
    financed: financed.length,
    exposure: financed.reduce((sum, caseState) => sum + (caseState.financing?.facility.amount ?? 0), 0),
    monitoring,
    readyByDestination,
  };
}


export function blockingExceptions(caseState: CaseState, destination: Destination, demoDate: string): string[] {
  const exceptions: string[] = [];

  for (const req of destination.requirements) {
    if (req.rule.kind === 'evidence' || req.rule.kind === 'evidence_count') {
      const evType = (req.rule as { evidence_type: string }).evidence_type;
      const evItem = caseState.evidence?.[evType];
      if (evItem) {
        if (evItem.disputed) {
          exceptions.push(`${req.id}: evidence '${evType}' is disputed`);
        }
        if (evItem.valid_until && demoDate > evItem.valid_until) {
          exceptions.push(`${req.id}: evidence '${evType}' is stale`);
        }
      }
    }
  }

  const govEv = caseState.evidence?.['governance_officers'] as { has_discrepancy?: boolean } | undefined;
  if (govEv?.has_discrepancy) {
    exceptions.push('governance_officers: open officer discrepancy');
  }

  return exceptions;
}

export type PipelineWorkflowState =
  | 'remediation_required'
  | 'assessment_ready'
  | 'initial_record'
  | 'evidence_progressing';

export function workflowState(
  caseState: CaseState,
  destination: Destination,
  demoDate: string,
  evaluation: Evaluation
): PipelineWorkflowState {
  const blocking = blockingExceptions(caseState, destination, demoDate);
  if (blocking.length > 0) {
    return 'remediation_required';
  }

  if (evaluation.summary.ready) {
    return 'assessment_ready';
  }

  const reqEvidenceTypes = destination.requirements
    .filter(r => r.rule.kind === 'evidence' || r.rule.kind === 'evidence_count')
    .map(r => (r.rule as { evidence_type: string }).evidence_type);

  const hasAboveAsserted = reqEvidenceTypes.some(t => {
    const ev = caseState.evidence?.[t];
    return ev && (ev.level === 'supported' || ev.level === 'verified');
  });

  if (!hasAboveAsserted) {
    return 'initial_record';
  }

  return 'evidence_progressing';
}

export function stateDistribution(
  cases: CaseState[],
  destination: Destination,
  demoDate: string,
  evaluateFn: (c: CaseState, d: Destination, date: string) => Evaluation
): Record<PipelineWorkflowState, { count: number; cases: CaseState[] }> {
  const dist: Record<PipelineWorkflowState, { count: number; cases: CaseState[] }> = {
    remediation_required: { count: 0, cases: [] },
    assessment_ready: { count: 0, cases: [] },
    initial_record: { count: 0, cases: [] },
    evidence_progressing: { count: 0, cases: [] },
  };

  for (const c of cases) {
    const evalResult = evaluateFn(c, destination, demoDate);
    const state = workflowState(c, destination, demoDate, evalResult);
    dist[state].count += 1;
    dist[state].cases.push(c);
  }

  return dist;
}
