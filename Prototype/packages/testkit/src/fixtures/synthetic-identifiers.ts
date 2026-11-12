/**
 * @symphony/testkit — fixtures/synthetic-identifiers.ts
 *
 * Test-mode identifier patterns for use in synthetic fixtures.
 *
 * Rules (ADR-016, O-20):
 *
 * NRC (National Registration Card):
 *   Real format: 123456/78/1 (6 digits / 2 digits / check digit)
 *   Test-mode:   TS[A-Z0-9]{4}/\d{2}/[123]  — prefix TS marks synthetic
 *   Example:     TS0001/01/1
 *   NOTE: Real NRC format must be REJECTED in test mode.
 *
 * Cooperative registration number (O-20):
 *   Format:      11 digits numerals only (^\d{11}$)
 *   Test-mode:   leading zeros to make intent clear (e.g., 00000000001)
 *   NOTE: Must NOT look like a real registration number; real numbers
 *   are issued by the Registrar and do not start with 10+ leading zeros.
 *
 * Passport (Zambia):
 *   Real format: ZA followed by 7 digits
 *   Test-mode:   TS followed by 7 digits (e.g., TS0000001)
 */

/** Pattern for synthetic NRC in test mode. */
export const SYNTHETIC_NRC_PATTERN = /^TS[A-Z0-9]{4}\/\d{2}\/[123]$/;

/** Pattern for cooperative registration number (O-20): 11 numerals only. */
export const COOPERATIVE_REG_NUMBER_PATTERN = /^\d{11}$/;

/** Pattern that real NRC must NOT match in test mode. */
export const REAL_NRC_PATTERN = /^\d{6}\/\d{2}\/[123]$/;

/** Generate a synthetic NRC for test cooperative member N (1-based). */
export function syntheticNrc(n: number): string {
  if (n < 1 || n > 9999) {
    throw new Error(`syntheticNrc: n must be 1–9999, got ${n}`);
  }
  const seq = n.toString(10).padStart(4, '0');
  const district = '01';
  const check = '1';
  return `TS${seq}/${district}/${check}`;
}

/** Generate a synthetic cooperative registration number for test cooperative N (1-based). */
export function syntheticCoopRegNumber(n: number): string {
  if (n < 1 || n > 99999999999) {
    throw new Error(`syntheticCoopRegNumber: n out of range, got ${n}`);
  }
  // Leading zeros make the synthetic nature obvious
  return n.toString(10).padStart(11, '0');
}

/** Generate a synthetic passport for test person N (1-based). */
export function syntheticPassport(n: number): string {
  if (n < 1 || n > 9999999) {
    throw new Error(`syntheticPassport: n must be 1–9999999, got ${n}`);
  }
  return `TS${n.toString(10).padStart(7, '0')}`;
}

/** Assert that a given string is a valid synthetic NRC (not a real one). */
export function assertSyntheticNrc(nrc: string): void {
  if (REAL_NRC_PATTERN.test(nrc)) {
    throw new Error(
      `Real NRC format detected in test mode: '${nrc}'. ` +
        `Use syntheticNrc() to generate test-mode NRCs.`,
    );
  }
  if (!SYNTHETIC_NRC_PATTERN.test(nrc)) {
    throw new Error(
      `'${nrc}' is not a valid synthetic NRC. Expected pattern: TS[A-Z0-9]{4}/\\d{2}/[123]`,
    );
  }
}

