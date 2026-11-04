/**
 * @symphony/testkit — sequential-ids.ts
 *
 * Deterministic UUID generator for tests. Returns consistent UUIDs derived
 * from a human-readable label so test output is easy to trace.
 *
 * Usage:
 *   const ids = new SequentialIds();
 *   ids.next('org')    // → '00000000-0000-0000-0000-000000000001'
 *   ids.next('user')   // → '00000000-0000-0000-0000-000000000002'
 *   ids.next('org')    // same label → new id (sequential, not cached)
 *   ids.reset()        // reset counter to 0
 */

export class SequentialIds {
  private counter: number = 0;

  /**
   * Return the next sequential UUID. The label is embedded in the UUID
   * as a comment in test output only — it does not affect the UUID value.
   */
  next(_label?: string): string {
    this.counter++;
    return this.toUUID(this.counter);
  }

  /** Reset the counter to zero. */
  reset(): void {
    this.counter = 0;
  }

  /** Current counter value (for assertions). */
  get count(): number {
    return this.counter;
  }

  private toUUID(n: number): string {
    // Pad to 12 hex digits and insert into the last segment of a UUID v4 template
    const hex = n.toString(16).padStart(12, '0');
    return `00000000-0000-0000-0000-${hex}`;
  }
}

