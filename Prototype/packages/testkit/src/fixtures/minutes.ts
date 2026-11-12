/**
 * @symphony/testkit — fixtures/minutes.ts
 *
 * Synthetic meeting minutes fixture for use in BDD step definitions and tests.
 *
 * IMPORTANT: This is entirely fictional data.
 * [SYNTHETIC FIXTURE — NOT REAL MEETING MINUTES]
 * All attendee names, dates, and resolutions are invented for testing only.
 * No real cooperative's data is represented here.
 */

export interface SyntheticAttendee {
  readonly pseudonymId: string;
  readonly role: string;
}

export interface SyntheticResolution {
  readonly ref: string;
  readonly text: string;
  readonly votesFor: number;
  readonly votesAgainst: number;
  readonly abstentions: number;
  readonly passed: boolean;
}

export interface SyntheticMinutes {
  readonly meetingType: string;
  readonly meetingDate: string;
  readonly venue: string;
  readonly quorumPresent: boolean;
  readonly attendees: readonly SyntheticAttendee[];
  readonly resolutions: readonly SyntheticResolution[];
  readonly label: string;
}

/**
 * Synthetic general meeting minutes.
 * [SYNTHETIC FIXTURE — NOT REAL MEETING MINUTES]
 */
export const SYNTHETIC_AGM_MINUTES: SyntheticMinutes = {
  label: '[SYNTHETIC FIXTURE — NOT REAL MEETING MINUTES] Test AGM 2026-07-01',
  meetingType: 'annual_general_meeting',
  meetingDate: '2026-07-01T10:00:00.000Z',
  venue: '[SYNTHETIC] Test Hall, 1 Test Street, Test District',
  quorumPresent: true,
  attendees: [
    { pseudonymId: 'TS-CHAIR-001', role: 'chairperson' },
    { pseudonymId: 'TS-SEC-001', role: 'secretary' },
    { pseudonymId: 'TS-TREAS-001', role: 'treasurer' },
    { pseudonymId: 'TS-MBR-001', role: 'member' },
    { pseudonymId: 'TS-MBR-002', role: 'member' },
    { pseudonymId: 'TS-MBR-003', role: 'member' },
    { pseudonymId: 'TS-MBR-004', role: 'member' },
    { pseudonymId: 'TS-MBR-005', role: 'member' },
    { pseudonymId: 'TS-MBR-006', role: 'member' },
  ],
  resolutions: [
    {
      ref: 'RES-2026-001',
      text: '[SYNTHETIC] That the financial statements for the period ending 31 December 2025 be adopted.',
      votesFor: 8,
      votesAgainst: 0,
      abstentions: 1,
      passed: true,
    },
    {
      ref: 'RES-2026-002',
      text: '[SYNTHETIC] That the by-laws be amended to increase the entrance fee to ZMW 100 (fictional amount).',
      votesFor: 6,
      votesAgainst: 2,
      abstentions: 1,
      passed: true,
    },
  ],
};

/**
 * Synthetic special general meeting minutes (no quorum — for rejection tests).
 * [SYNTHETIC FIXTURE — NOT REAL MEETING MINUTES]
 */
export const SYNTHETIC_SGM_NO_QUORUM: SyntheticMinutes = {
  label: '[SYNTHETIC FIXTURE — NOT REAL MEETING MINUTES] Test SGM 2026-09-15 (no quorum)',
  meetingType: 'special_general_meeting',
  meetingDate: '2026-09-15T14:00:00.000Z',
  venue: '[SYNTHETIC] Test Hall, 1 Test Street, Test District',
  quorumPresent: false,
  attendees: [
    { pseudonymId: 'TS-CHAIR-001', role: 'chairperson' },
    { pseudonymId: 'TS-MBR-001', role: 'member' },
  ],
  resolutions: [],
};

