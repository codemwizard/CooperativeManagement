/**
 * @symphony/testkit — builders/an-internal-verifier.ts
 * Phase 0 stub — Internal Field Verifier (IFV) with CapacityGrant.
 * [SYNTHETIC FIXTURE]
 */

export interface InternalVerifierStub {
  readonly userId: string;
  readonly personId: string;
  readonly email: string;
  readonly capacityType: 'internal_verifier';
  readonly organizationId: string;
  readonly grantId: string;
}

export function anInternalVerifier(
  overrides: Partial<InternalVerifierStub> = {},
): InternalVerifierStub {
  return {
    userId: '00000000-0000-0000-0000-000000000060',
    personId: '00000000-0000-0000-0000-000000000061',
    email: 'verifier@test.invalid',
    capacityType: 'internal_verifier',
    organizationId: '00000000-0000-0000-0000-000000000001',
    grantId: '00000000-0000-0000-0000-000000000062',
    ...overrides,
  };
}

