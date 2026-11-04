/**
 * @symphony/testkit — builders/an-evidence-version.ts
 * Phase 0 stub — EvidenceVersion aggregate shape.
 * [SYNTHETIC FIXTURE]
 */

export interface EvidenceVersionStub {
  readonly id: string;
  readonly evidenceItemId: string;
  readonly versionNumber: number;
  readonly origin: string;
  readonly stage: string;
  readonly submissionStatus: 'pending';
}

export function anEvidenceVersion(
  overrides: Partial<EvidenceVersionStub> = {},
): EvidenceVersionStub {
  return {
    id: '00000000-0000-0000-0000-000000000080',
    evidenceItemId: '00000000-0000-0000-0000-000000000081',
    versionNumber: 1,
    origin: 'self_declared',
    stage: 'submitted',
    submissionStatus: 'pending',
    ...overrides,
  };
}

