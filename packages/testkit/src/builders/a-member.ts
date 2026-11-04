/**
 * @symphony/testkit — builders/a-member.ts
 * Phase 0 stub — cooperative member user + membership record.
 * [SYNTHETIC FIXTURE]
 */

export interface MemberStub {
  readonly userId: string;
  readonly personId: string;
  readonly email: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly nrc: string;
}

export function aMember(n: number = 1, overrides: Partial<MemberStub> = {}): MemberStub {
  const pad = n.toString().padStart(3, '0');
  return {
    userId: `00000000-0000-0000-0000-0000000001${pad}`,
    personId: `00000000-0000-0000-0000-0000000002${pad}`,
    email: `member-${pad}@test.invalid`,
    organizationId: '00000000-0000-0000-0000-000000000001',
    membershipId: `00000000-0000-0000-0000-0000000003${pad}`,
    nrc: `TS${pad}0/01/1`,
    ...overrides,
  };
}

