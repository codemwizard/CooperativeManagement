import type { CaseState } from './types';

export type MonitoringState = 'current' | 'due' | 'overdue';

export function covenantState(
  covenant: NonNullable<CaseState['financing']>['covenants'][number],
  demoDate: string,
  dueWindowDays: number,
): MonitoringState {
  if (covenant.received) return 'current';
  const remaining = (Date.parse(`${covenant.due_date}T00:00:00Z`) - Date.parse(`${demoDate}T00:00:00Z`)) / 86_400_000;
  if (remaining < 0) return 'overdue';
  if (remaining <= dueWindowDays) return 'due';
  return 'current';
}

export function monitoringState(caseState: CaseState, demoDate: string, dueWindowDays: number): MonitoringState | null {
  if (!caseState.financing) return null;
  let worst: MonitoringState = 'current';
  for (const covenant of caseState.financing.covenants) {
    const state = covenantState(covenant, demoDate, dueWindowDays);
    if (state === 'overdue') return 'overdue';
    if (state === 'due') worst = 'due';
  }
  return worst;
}
