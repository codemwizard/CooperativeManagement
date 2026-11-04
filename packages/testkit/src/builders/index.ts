/**
 * @symphony/testkit — builders/index.ts
 *
 * Exports all Phase 0 builder stubs.
 * Phase 0: builders return typed empty objects with sentinel values.
 * Phase 1+: builders will accept overrides and produce database-backed aggregates.
 */

export { aCooperative } from './a-cooperative.js';
export { aSelfEnroller } from './a-self-enroller.js';
export { anEnroller } from './an-enroller.js';
export { aChairperson, aSecretary, aTreasurer } from './officers.js';
export { anInternalVerifier } from './an-internal-verifier.js';
export { aFieldAgent } from './a-field-agent.js';
export { aMember } from './a-member.js';
export { anEvidenceVersion } from './an-evidence-version.js';
export { aMeeting } from './a-meeting.js';
export { aByLawWithClauses } from './a-bylaw-with-clauses.js';

