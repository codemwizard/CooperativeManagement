import type { CaseState, Destination, EffectiveLevel, Evaluation, EvidenceItem, EvidenceLevel, Requirement } from './types';

const rank: Record<EvidenceLevel, number> = { none: 0, asserted: 1, supported: 2, verified: 3 };

function valueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function applies(requirement: Requirement, caseState: CaseState): boolean {
  return !requirement.applies_when || valueAtPath(caseState, requirement.applies_when.field) === requirement.applies_when.equals;
}

export function effectiveState(caseState: CaseState, evidenceType: string, demoDate: string): { state: EffectiveLevel; level: EvidenceLevel } {
  const item = caseState.evidence[evidenceType];
  if (!item) return { state: 'none', level: 'none' };
  if (caseState.disputes.some((dispute) => dispute.evidence_type === evidenceType && dispute.status === 'open')) {
    return { state: 'disputed', level: item.level };
  }
  if (item.valid_until && demoDate > item.valid_until) {
    return { state: 'stale', level: item.level };
  }
  return { state: item.level, level: item.level };
}

function evidenceResult(requirement: Requirement, item: EvidenceItem | undefined, caseState: CaseState, demoDate: string) {
  if (requirement.rule.kind !== 'evidence' && requirement.rule.kind !== 'evidence_count') {
    throw new Error('not an evidence rule');
  }
  const effective = effectiveState(caseState, requirement.rule.evidence_type, demoDate);
  const result = {
    id: requirement.id,
    title: requirement.title,
    state: 'unresolved' as const,
    evidence_ref: item ? requirement.rule.evidence_type : null,
    effective_level: effective.state,
    min_level: requirement.rule.min_level,
    provided_early: false,
    reason: null as string | null,
    group: requirement.group,
  };

  if (effective.state === 'disputed' || effective.state === 'stale') {
    return { ...result, state: 'exception' as const, reason: `Evidence is ${effective.state}` };
  }

  let ok = rank[effective.level] >= rank[requirement.rule.min_level];
  if (requirement.rule.kind === 'evidence_count' && ok) {
    const countValue = Number(item?.[requirement.rule.count_field] ?? 0);
    ok = countValue >= requirement.rule.min_count;
    if (!ok) result.reason = `${requirement.rule.count_field} below ${requirement.rule.min_count}`;
  }
  return { ...result, state: ok ? ('satisfied' as const) : ('unresolved' as const) };
}

function fitResult(requirement: Requirement, caseState: CaseState) {
  if (requirement.rule.kind !== 'fit') throw new Error('not a fit rule');
  const request = caseState.project.request;
  const ok =
    requirement.rule.check === 'single_request'
      ? request.structure === 'single' &&
        Number(request.amount) >= requirement.rule.min_amount &&
        Number(request.amount) <= requirement.rule.max_amount &&
        Number(request.term_months) > 0 &&
        Number(request.term_months) <= Number(requirement.rule.max_term_months)
      : request.structure === 'per_group' &&
        Number(request.amount_per_group) >= requirement.rule.min_amount &&
        Number(request.amount_per_group) <= requirement.rule.max_amount &&
        Number(request.term_months) >= Number(requirement.rule.min_term_months) &&
        Number(request.term_months) <= Number(requirement.rule.max_term_months);

  return {
    id: requirement.id,
    title: requirement.title,
    state: ok ? ('satisfied' as const) : ('unresolved' as const),
    evidence_ref: null,
    effective_level: null,
    min_level: null,
    provided_early: false,
    reason: ok ? null : 'Request outside product range or structure',
    group: requirement.group,
  };
}

export function evaluate(caseState: CaseState, destination: Destination, demoDate: string): Evaluation {
  const requirements = destination.requirements.map((requirement) => {
    if (!applies(requirement, caseState)) {
      return {
        id: requirement.id,
        title: requirement.title,
        state: 'not_applicable' as const,
        evidence_ref: null,
        effective_level: null,
        min_level: null,
        provided_early: false,
        reason: requirement.why || 'Applicability rule excludes it',
        group: requirement.group,
      };
    }

    if (requirement.rule.kind === 'evidence' || requirement.rule.kind === 'evidence_count') {
      return evidenceResult(requirement, caseState.evidence[requirement.rule.evidence_type], caseState, demoDate);
    }

    if (requirement.rule.kind === 'assessment_time') {
      const item = caseState.evidence[requirement.rule.evidence_type];
      const effective = item ? effectiveState(caseState, requirement.rule.evidence_type, demoDate) : null;
      return {
        id: requirement.id,
        title: requirement.title,
        state: 'assessment_time' as const,
        evidence_ref: item ? requirement.rule.evidence_type : null,
        effective_level: effective?.state ?? null,
        min_level: null,
        provided_early: Boolean(item),
        reason: null,
        group: requirement.group,
      };
    }

    return fitResult(requirement, caseState);
  });

  const byState = (state: string) => requirements.filter((requirement) => requirement.state === state).map((requirement) => requirement.id);
  const unresolved = byState('unresolved');
  const exceptions = byState('exception');
  return {
    destination_id: destination.id,
    requirements,
    summary: {
      ready: unresolved.length === 0 && exceptions.length === 0,
      unresolved,
      exceptions,
      not_applicable: byState('not_applicable'),
      assessment_time: byState('assessment_time'),
      satisfied: byState('satisfied').length,
      total: requirements.length,
    },
  };
}
