/**
 * @symphony/testkit — builders/officers.ts
 * Phase 0 stubs — Chairperson, Secretary, Treasurer.
 * [SYNTHETIC FIXTURE]
 */

export interface OfficerStub {
  readonly userId: string;
  readonly personId: string;
  readonly email: string;
  readonly position: 'chairperson' | 'secretary' | 'treasurer';
  readonly organizationId: string;
  readonly appointmentId: string;
}

export function aChairperson(overrides: Partial<OfficerStub> = {}): OfficerStub {
  return {
    userId: '00000000-0000-0000-0000-000000000030',
    personId: '00000000-0000-0000-0000-000000000031',
    email: 'chairperson@test.invalid',
    position: 'chairperson',
    organizationId: '00000000-0000-0000-0000-000000000001',
    appointmentId: '00000000-0000-0000-0000-000000000032',
    ...overrides,
  };
}

export function aSecretary(overrides: Partial<OfficerStub> = {}): OfficerStub {
  return {
    userId: '00000000-0000-0000-0000-000000000040',
    personId: '00000000-0000-0000-0000-000000000041',
    email: 'secretary@test.invalid',
    position: 'secretary',
    organizationId: '00000000-0000-0000-0000-000000000001',
    appointmentId: '00000000-0000-0000-0000-000000000042',
    ...overrides,
  };
}

export function aTreasurer(overrides: Partial<OfficerStub> = {}): OfficerStub {
  return {
    userId: '00000000-0000-0000-0000-000000000050',
    personId: '00000000-0000-0000-0000-000000000051',
    email: 'treasurer@test.invalid',
    position: 'treasurer',
    organizationId: '00000000-0000-0000-0000-000000000001',
    appointmentId: '00000000-0000-0000-0000-000000000052',
    ...overrides,
  };
}

