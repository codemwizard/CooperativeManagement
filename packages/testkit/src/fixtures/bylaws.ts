/**
 * @symphony/testkit — fixtures/bylaws.ts
 *
 * Synthetic by-law fixture for use in BDD step definitions and integration tests.
 *
 * IMPORTANT: This is entirely fictional data.
 * [SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT]
 * No text in this file is taken from any actual cooperative's by-laws.
 * All names, dates, amounts, and clause text are invented for testing only.
 */

export interface BylawClause {
  readonly sectionRef: string;
  readonly text: string;
}

export interface SyntheticBylawVersion {
  readonly label: string;
  readonly clauses: readonly BylawClause[];
}

/**
 * A single synthetic by-law with the minimum clauses required by Schedule I
 * of the Co-operative Societies Act No. 20 of 1998.
 * [SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT]
 */
export const SYNTHETIC_BYLAW_V1: SyntheticBylawVersion = {
  label: '[SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT] Test Cooperative By-laws Version 1',
  clauses: [
    {
      sectionRef: '1',
      text: '[SYNTHETIC] The name of the cooperative society is "Test Cooperative Society" (fictional).',
    },
    {
      sectionRef: '2',
      text: '[SYNTHETIC] The registered address is "1 Test Street, Test District, Zambia" (fictional).',
    },
    {
      sectionRef: '3',
      text:
        '[SYNTHETIC] The objects of the society are: to promote the economic interests of members ' +
        'through collective action in the fictional test domain.',
    },
    {
      sectionRef: '4',
      text:
        '[SYNTHETIC] Membership is open to any adult person resident in the fictional test area ' +
        'who pays the entrance fee of ZMW 50 (fictional amount) and is accepted by the committee.',
    },
    {
      sectionRef: '5',
      text:
        '[SYNTHETIC] The annual general meeting shall be held within four months of the end of ' +
        'each financial year. Notice shall be given at least twenty-one days before the meeting.',
    },
    {
      sectionRef: '6',
      text:
        '[SYNTHETIC] A quorum for the annual general meeting shall be one-third of the total ' +
        'membership or fifteen members, whichever is the lesser.',
    },
    {
      sectionRef: '7',
      text:
        '[SYNTHETIC] The committee shall consist of a Chairperson, Vice-Chairperson, Secretary, ' +
        'Treasurer, and four ordinary members, all elected at the annual general meeting.',
    },
    {
      sectionRef: '8',
      text:
        '[SYNTHETIC] No amendment to these by-laws shall take effect until it has been registered ' +
        'by the Registrar of Co-operative Societies in accordance with the Act.',
    },
  ],
};

/**
 * A minimal synthetic bylaw with only two clauses (used for rejection/validation tests).
 * [SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT]
 */
export const SYNTHETIC_BYLAW_INCOMPLETE: SyntheticBylawVersion = {
  label: '[SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT] Incomplete Test By-laws (validation test)',
  clauses: [
    {
      sectionRef: '1',
      text: '[SYNTHETIC] The name of the society is "Incomplete Test Society" (fictional).',
    },
  ],
};

