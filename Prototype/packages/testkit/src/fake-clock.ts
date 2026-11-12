/**
 * @symphony/testkit — fake-clock.ts
 *
 * Deterministic clock for tests. Accepts a fixed ISO timestamp so that
 * time-dependent domain logic produces reproducible results.
 *
 * Usage:
 *   const clock = new FakeClock('2026-01-01T09:00:00.000Z');
 *   clock.now()           // → Date object at that instant
 *   clock.nowIso()        // → '2026-01-01T09:00:00.000Z'
 *   clock.advance(60_000) // advance by 60 seconds
 */

export class FakeClock {
  private currentMs: number;

  constructor(isoTimestamp: string = '2026-01-01T00:00:00.000Z') {
    const parsed = Date.parse(isoTimestamp);
    if (Number.isNaN(parsed)) {
      throw new Error(`FakeClock: invalid ISO timestamp '${isoTimestamp}'`);
    }
    this.currentMs = parsed;
  }

  /** Return the current fake time as a Date. */
  now(): Date {
    return new Date(this.currentMs);
  }

  /** Return the current fake time as an ISO 8601 string. */
  nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  /** Advance the clock by the given number of milliseconds. */
  advance(ms: number): void {
    if (ms < 0) {
      throw new Error(`FakeClock.advance: ms must be non-negative, got ${ms}`);
    }
    this.currentMs += ms;
  }

  /** Set the clock to a specific ISO timestamp. */
  setTo(isoTimestamp: string): void {
    const parsed = Date.parse(isoTimestamp);
    if (Number.isNaN(parsed)) {
      throw new Error(`FakeClock.setTo: invalid ISO timestamp '${isoTimestamp}'`);
    }
    this.currentMs = parsed;
  }
}

