/**
 * @symphony/api — __tests__/masking-serialiser.test.ts
 *
 * Tests for the role-based masking serialiser (task 1.7.4).
 *
 * Tests:
 *   unionRole_response_containsNoPII
 *   institutionalRole_response_containsNoPII
 *   cooperativeOfficer_response_containsOwnData
 *   publicInspection_showsOnlyStatutoryFields
 */

import { describe, it, expect } from 'vitest';
import { maskMemberRecord, scrubNrcFromString, STATUTORY_FIELDS } from '../serialisers/masking-serialiser.js';
import type { MemberRecord } from '../serialisers/masking-serialiser.js';

const NRC_PATTERN = /\d{6}\/\d{2}\/\d/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

/** A sample member record with all fields. */
const sampleMember: MemberRecord = {
  person_id: 'person-001',
  name: 'Mary Phiri',
  address: 'Plot 12, Chipata',
  occupation: 'Farmer',
  date_registered: '2026-01-15',
  nrc: 'TS0001/01/1',          // synthetic NRC — must be masked for most roles
  email: 'mary@example.com',
  phone: '+260977000001',
  shares: 10,
};

describe('maskMemberRecord', () => {
  it('unionRole_response_containsNoPII', () => {
    const masked = maskMemberRecord(sampleMember, 'union_ta');
    const json = JSON.stringify(masked);

    // No NRC pattern
    expect(NRC_PATTERN.test(json)).toBe(false);
    // No email pattern
    expect(EMAIL_PATTERN.test(json)).toBe(false);
    // The identifier field must be absent or masked
    expect(masked['nrc']).toBeUndefined();
    expect(masked['email']).toBeUndefined();
    // Statutory fields may be present (without PII)
    // but PII-shaped values in statutory fields are also masked
  });

  it('institutionalRole_response_containsNoPII', () => {
    // pfi_analyst is an institutional read-only role
    const masked = maskMemberRecord(sampleMember, 'pfi_analyst');
    const json = JSON.stringify(masked);

    expect(NRC_PATTERN.test(json)).toBe(false);
    expect(EMAIL_PATTERN.test(json)).toBe(false);
    // Non-statutory fields are absent
    expect(masked['nrc']).toBeUndefined();
    expect(masked['email']).toBeUndefined();
    expect(masked['phone']).toBeUndefined();
  });

  it('cooperativeOfficer_response_containsOwnData', () => {
    // Officer viewing their OWN record — sees full data
    const secretary = { ...sampleMember, person_id: 'person-secretary' };
    const masked = maskMemberRecord(secretary, 'secretary', 'person-secretary');

    // Own record — full access
    expect(masked).toMatchObject({
      name: sampleMember.name,
      nrc: sampleMember.nrc,
      email: sampleMember.email,
    });
  });

  it('publicInspection_showsOnlyStatutoryFields', () => {
    const masked = maskMemberRecord(sampleMember, 'public_inspection');

    // Only statutory fields are present
    for (const key of Object.keys(masked)) {
      expect(STATUTORY_FIELDS.has(key)).toBe(true);
    }

    // All 4 statutory fields are present
    expect(masked['name']).toBe(sampleMember['name']);
    expect(masked['address']).toBe(sampleMember['address']);
    expect(masked['occupation']).toBe(sampleMember['occupation']);
    expect(masked['date_registered']).toBe(sampleMember['date_registered']);

    // Sensitive fields are absent
    expect(masked['nrc']).toBeUndefined();
    expect(masked['email']).toBeUndefined();
    expect(masked['phone']).toBeUndefined();
    expect(masked['shares']).toBeUndefined();
    expect(masked['person_id']).toBeUndefined();
  });
});

describe('scrubNrcFromString', () => {
  it('removes NRC pattern from log strings', () => {
    const input = 'Member added NRC 123456/78/1 at 10:00';
    const scrubbed = scrubNrcFromString(input);
    expect(NRC_PATTERN.test(scrubbed)).toBe(false);
    expect(scrubbed).toContain('[REDACTED_NRC]');
  });
});

