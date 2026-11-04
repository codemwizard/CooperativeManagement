/**
 * @symphony/testkit — builders/a-cooperative.ts
 * Phase 0 stub — returns a typed placeholder Organization aggregate shape.
 * [SYNTHETIC FIXTURE]
 */

export interface OrganizationStub {
  readonly id: string;
  readonly name: string;
  readonly status: 'workspace_created';
  readonly registrationNumber: string | null;
  readonly tenantId: string;
}

/** Build a stub cooperative Organisation for use in tests. */
export function aCooperative(overrides: Partial<OrganizationStub> = {}): OrganizationStub {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: '[SYNTHETIC] Test Cooperative Society',
    status: 'workspace_created',
    registrationNumber: null,
    tenantId: '00000000-0000-0000-0000-000000000000',
    ...overrides,
  };
}

