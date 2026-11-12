/**
 * @symphony/testkit — __tests__/fake-clock.test.ts
 *
 * Unit tests for FakeClock and SequentialIds.
 *
 * Run: npx vitest run packages/testkit/src/__tests__/fake-clock.test.ts
 * Expected: all tests pass
 */

import { describe, it, expect } from 'vitest';
import { FakeClock } from '../fake-clock.js';
import { SequentialIds } from '../sequential-ids.js';

describe('FakeClock', () => {
  it('initialises to the given ISO timestamp', () => {
    const clock = new FakeClock('2026-01-01T09:00:00.000Z');
    expect(clock.nowIso()).toBe('2026-01-01T09:00:00.000Z');
  });

  it('defaults to 2026-01-01T00:00:00.000Z when no timestamp given', () => {
    const clock = new FakeClock();
    expect(clock.nowIso()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns a Date object from now()', () => {
    const clock = new FakeClock('2026-06-15T12:30:00.000Z');
    expect(clock.now()).toBeInstanceOf(Date);
    expect(clock.now().getFullYear()).toBe(2026);
    expect(clock.now().getMonth()).toBe(5); // June = 5 (0-indexed)
  });

  it('advances by the given milliseconds', () => {
    const clock = new FakeClock('2026-01-01T00:00:00.000Z');
    clock.advance(60_000); // 1 minute
    expect(clock.nowIso()).toBe('2026-01-01T00:01:00.000Z');
  });

  it('advances by multiple steps', () => {
    const clock = new FakeClock('2026-01-01T00:00:00.000Z');
    clock.advance(3600_000); // 1 hour
    clock.advance(1800_000); // 30 minutes
    expect(clock.nowIso()).toBe('2026-01-01T01:30:00.000Z');
  });

  it('throws on invalid ISO timestamp', () => {
    expect(() => new FakeClock('not-a-date')).toThrow('invalid ISO timestamp');
  });

  it('throws when advance receives a negative value', () => {
    const clock = new FakeClock();
    expect(() => clock.advance(-1)).toThrow('non-negative');
  });

  it('setTo changes the current time', () => {
    const clock = new FakeClock('2026-01-01T00:00:00.000Z');
    clock.setTo('2026-12-31T23:59:59.000Z');
    expect(clock.nowIso()).toBe('2026-12-31T23:59:59.000Z');
  });
});

describe('SequentialIds', () => {
  it('generates UUIDs in sequence', () => {
    const ids = new SequentialIds();
    expect(ids.next()).toBe('00000000-0000-0000-0000-000000000001');
    expect(ids.next()).toBe('00000000-0000-0000-0000-000000000002');
    expect(ids.next()).toBe('00000000-0000-0000-0000-000000000003');
  });

  it('accepts optional label (does not affect value)', () => {
    const ids = new SequentialIds();
    const a = ids.next('org');
    const b = ids.next('user');
    expect(a).toBe('00000000-0000-0000-0000-000000000001');
    expect(b).toBe('00000000-0000-0000-0000-000000000002');
  });

  it('resets counter to zero', () => {
    const ids = new SequentialIds();
    ids.next();
    ids.next();
    ids.reset();
    expect(ids.next()).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('reports the current count', () => {
    const ids = new SequentialIds();
    ids.next();
    ids.next();
    expect(ids.count).toBe(2);
  });
});

