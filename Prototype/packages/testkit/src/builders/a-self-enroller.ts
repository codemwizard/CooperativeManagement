/**
 * @symphony/testkit — builders/a-self-enroller.ts
 * Phase 0 stub — self-enroller user shape.
 * [SYNTHETIC FIXTURE]
 */

export interface SelfEnrollerStub {
  readonly id: string;
  readonly email: string;
  readonly scope: 'self_enroller';
  readonly organizationId: string;
}

export function aSelfEnroller(overrides: Partial<SelfEnrollerStub> = {}): SelfEnrollerStub {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'self-enroller@test.invalid',
    scope: 'self_enroller',
    organizationId: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  };
}

