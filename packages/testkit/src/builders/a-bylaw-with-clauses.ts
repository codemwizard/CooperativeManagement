/**
 * @symphony/testkit — builders/a-bylaw-with-clauses.ts
 * Phase 0 stub — BylawVersion with provisions.
 * [SYNTHETIC FIXTURE]
 */

import { SYNTHETIC_BYLAW_V1 } from '../fixtures/bylaws.js';

export interface BylawVersionStub {
  readonly id: string;
  readonly organizationId: string;
  readonly versionNumber: number;
  readonly status: 'draft';
  readonly clauseCount: number;
  readonly label: string;
}

export function aByLawWithClauses(
  overrides: Partial<BylawVersionStub> = {},
): BylawVersionStub {
  return {
    id: '00000000-0000-0000-0000-0000000000a0',
    organizationId: '00000000-0000-0000-0000-000000000001',
    versionNumber: 1,
    status: 'draft',
    clauseCount: SYNTHETIC_BYLAW_V1.clauses.length,
    label: SYNTHETIC_BYLAW_V1.label,
    ...overrides,
  };
}

