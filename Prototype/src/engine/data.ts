import casesData from '../../data/cases.json';
import destinationsData from '../../data/destinations.json';
import rolesData from '../../data/roles.json';
import metaData from '../../data/meta.json';
import verificationSeed from '../../data/verification_seed.json';
import type { Actor, Assignment, CaseState, Destination } from './types';

export const meta = metaData;
export const roles = rolesData;
export const destinations = destinationsData.destinations as Destination[];
export const destinationById = Object.fromEntries(destinations.map((destination) => [destination.id, destination])) as Record<
  'A' | 'B' | 'N',
  Destination
>;
export const claims = verificationSeed.claims;
export const verifierUsers = verificationSeed.verifier_users;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function constraintRule(code: string): string {
  return rolesData.constraints.find((constraint) => constraint.code === code)?.rule ?? code;
}

export function userFor(userId: string): Actor | undefined {
  const user = rolesData.users.find((candidate) => candidate.user_id === userId);
  return user ? ({ user_id: user.user_id, role: user.role, cohorts: user.cohorts } as Actor) : undefined;
}

export function loadCases(): CaseState[] {
  const assignments = verificationSeed.assignments as Assignment[];
  return clone(casesData.cases).map((caseState) => ({
    ...caseState,
    version: (caseState as any).version ?? 0,
    events: (caseState as any).events ?? [],
    disputes: [],
    verification: {
      assignments: assignments.filter((assignment) => assignment.case_id === caseState.id),
      findings: [],
      reliance: [],
    },
    lender: {
      admissions: [],
      requests: [],
      findings: [],
      outcomes: [],
    },
  })) as unknown as CaseState[];
}

export const baselineCases = Object.freeze(loadCases());
