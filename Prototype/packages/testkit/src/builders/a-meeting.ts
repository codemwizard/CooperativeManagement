/**
 * @symphony/testkit — builders/a-meeting.ts
 * Phase 0 stub — Meeting aggregate shape.
 * [SYNTHETIC FIXTURE]
 */

export interface MeetingStub {
  readonly id: string;
  readonly organizationId: string;
  readonly meetingType: string;
  readonly scheduledAt: string;
  readonly quorumRequired: number;
  readonly attendeeCount: number;
}

export function aMeeting(overrides: Partial<MeetingStub> = {}): MeetingStub {
  return {
    id: '00000000-0000-0000-0000-000000000090',
    organizationId: '00000000-0000-0000-0000-000000000001',
    meetingType: 'annual_general_meeting',
    scheduledAt: '2026-07-01T10:00:00.000Z',
    quorumRequired: 5,
    attendeeCount: 9,
    ...overrides,
  };
}

