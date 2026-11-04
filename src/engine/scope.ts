import { constraintRule } from './data';
import type { Actor, CaseState } from './types';

export function visibleCases(actor: Actor, cases: CaseState[]): CaseState[] {
  if (actor.role !== 'ta') return cases;
  if (actor.cohorts === 'all') return cases;
  const cohorts = actor.cohorts ?? [];
  return cases.filter((caseState) => cohorts.includes(caseState.programme));
}

export function assertCaseVisible(actor: Actor, caseState: CaseState): { ok: true } | { ok: false; code: string; rule: string } {
  if (actor.role !== 'ta' || actor.cohorts === 'all') return { ok: true };
  if ((actor.cohorts ?? []).includes(caseState.programme)) return { ok: true };
  return { ok: false, code: 'ACCESS_DENIED_COHORT', rule: constraintRule('ACCESS_DENIED_COHORT') };
}
