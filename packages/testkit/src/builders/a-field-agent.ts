/**
 * @symphony/testkit — builders/a-field-agent.ts
 * Phase 0 stub — Field Agent with CapacityGrant.
 * [SYNTHETIC FIXTURE]
 */

export interface FieldAgentStub {
  readonly userId: string;
  readonly personId: string;
  readonly email: string;
  readonly capacityType: 'field_agent';
  readonly grantId: string;
}

export function aFieldAgent(overrides: Partial<FieldAgentStub> = {}): FieldAgentStub {
  return {
    userId: '00000000-0000-0000-0000-000000000070',
    personId: '00000000-0000-0000-0000-000000000071',
    email: 'field-agent@test.invalid',
    capacityType: 'field_agent',
    grantId: '00000000-0000-0000-0000-000000000072',
    ...overrides,
  };
}

