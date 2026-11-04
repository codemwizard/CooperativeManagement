/**
 * @symphony/testkit — __tests__/synthetic-identifiers.test.ts
 *
 * Unit tests confirming test-mode identifier patterns.
 *
 * Run: npx vitest run packages/testkit/src/__tests__/synthetic-identifiers.test.ts
 * Expected: all tests pass
 */

import { describe, it, expect } from 'vitest';
import {
  SYNTHETIC_NRC_PATTERN,
  REAL_NRC_PATTERN,
  COOPERATIVE_REG_NUMBER_PATTERN,
  syntheticNrc,
  syntheticCoopRegNumber,
  syntheticPassport,
  assertSyntheticNrc,
} from '../fixtures/synthetic-identifiers.js';

describe('NRC patterns', () => {
  it('synthetic NRC pattern accepts valid test-mode NRCs', () => {
    expect(SYNTHETIC_NRC_PATTERN.test('TS0001/01/1')).toBe(true);
    expect(SYNTHETIC_NRC_PATTERN.test('TS9999/99/3')).toBe(true);
    expect(SYNTHETIC_NRC_PATTERN.test('TSABCD/12/2')).toBe(true);
  });

  it('synthetic NRC pattern rejects real NRC format', () => {
    expect(SYNTHETIC_NRC_PATTERN.test('123456/78/1')).toBe(false);
    expect(SYNTHETIC_NRC_PATTERN.test('000001/01/1')).toBe(false);
  });

  it('real NRC pattern matches real format', () => {
    expect(REAL_NRC_PATTERN.test('123456/78/1')).toBe(true);
    expect(REAL_NRC_PATTERN.test('000000/01/1')).toBe(true);
  });

  it('real NRC pattern rejects synthetic format', () => {
    // This is the key test: real NRC format MUST be rejected in test mode
    expect(REAL_NRC_PATTERN.test('TS0001/01/1')).toBe(false);
  });
});

describe('syntheticNrc()', () => {
  it('generates a valid synthetic NRC for n=1', () => {
    const nrc = syntheticNrc(1);
    expect(SYNTHETIC_NRC_PATTERN.test(nrc)).toBe(true);
    expect(nrc).toBe('TS0001/01/1');
  });

  it('generates distinct NRCs for different n values', () => {
    expect(syntheticNrc(1)).not.toBe(syntheticNrc(2));
  });

  it('throws for n=0', () => {
    expect(() => syntheticNrc(0)).toThrow();
  });

  it('throws for n > 9999', () => {
    expect(() => syntheticNrc(10000)).toThrow();
  });
});

describe('Cooperative registration number (O-20)', () => {
  it('pattern accepts 11-digit numerals', () => {
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('00000000001')).toBe(true);
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('12345678901')).toBe(true);
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('99999999999')).toBe(true);
  });

  it('pattern rejects fewer than 11 digits', () => {
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('1234567890')).toBe(false);
  });

  it('pattern rejects more than 11 digits', () => {
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('123456789012')).toBe(false);
  });

  it('pattern rejects non-numeric characters', () => {
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('1234567890A')).toBe(false);
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test('12345/67890')).toBe(false);
  });

  it('syntheticCoopRegNumber generates 11-digit strings', () => {
    const reg = syntheticCoopRegNumber(1);
    expect(reg).toBe('00000000001');
    expect(COOPERATIVE_REG_NUMBER_PATTERN.test(reg)).toBe(true);
    expect(reg).toHaveLength(11);
  });
});

describe('syntheticPassport()', () => {
  it('generates a recognisably synthetic passport number', () => {
    expect(syntheticPassport(1)).toBe('TS0000001');
  });

  it('throws for n=0', () => {
    expect(() => syntheticPassport(0)).toThrow();
  });
});

describe('assertSyntheticNrc()', () => {
  it('passes for a valid synthetic NRC', () => {
    expect(() => assertSyntheticNrc('TS0001/01/1')).not.toThrow();
  });

  it('throws when given a real NRC format', () => {
    expect(() => assertSyntheticNrc('123456/78/1')).toThrow('Real NRC format detected');
  });
});

