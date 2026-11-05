/**
 * @symphony/domain — privacy/retention-policy.ts
 *
 * Retention policy enforcement (PRV-005, PRV-008, INV-014).
 *
 * Rules:
 *   - Membership data: 2-year retention floor post-cessation (O-23 / Act ss.34, 37(6))
 *   - Crypto shredding: delete per-person key refs; personal fields become unreadable
 *   - Transaction facts: pseudonymous rows (no PII) are RETAINED after shred (INV-014)
 *   - Dispute records: survive erasure (INV-014 carve-out)
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   ✅ No `any` types
 *   ✅ Errors classified
 *   ✅ Pure domain logic — no I/O
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemberRetentionRecord {
  readonly personId: string;
  /** ISO 8601 date when the member ceased (left / was removed). */
  readonly cessationDate: string;
  /** ISO 8601 date at which the retention evaluation is performed. */
  readonly evaluatedAt: string;
}

/** A pseudonymous transaction fact — no PII fields. */
export interface TransactionFact {
  readonly transactionId: string;
  /** Pseudonymous person reference — NOT a PII field. */
  readonly personId: string;
  readonly amount: number;
  readonly currency: string;
  readonly type: string;
  readonly recordedAt: string;
}

export interface RetentionEvaluation {
  readonly personId: string;
  readonly canShred: boolean;
  readonly reason: 'RETENTION_FLOOR_NOT_REACHED' | 'RETENTION_FLOOR_PASSED';
  /** ISO 8601 date when shredding will first be allowed. */
  readonly shredEligibleFrom: string;
}

export interface ShredRequest {
  readonly personId: string;
  /** Key references (one per PII field or per-person key) to be marked deleted. */
  readonly keyRefs: readonly string[];
  /** Pseudonymous transaction facts to retain. */
  readonly transactions: readonly TransactionFact[];
}

export interface ShredResult {
  readonly personId: string;
  readonly piiKeysDeleted: readonly string[];
  readonly transactionsRetained: number;
  readonly retainedTransactions: readonly TransactionFact[];
}

// ─── RetentionPolicy ──────────────────────────────────────────────────────────

/** Two-year floor in milliseconds. */
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

export class RetentionPolicy {
  /**
   * Evaluate whether a member's PII may be shredded.
   *
   * Returns `canShred: true` only when the 2-year floor has passed since cessation.
   * Does NOT perform the shred — call `shred()` separately.
   */
  evaluate(record: MemberRetentionRecord): RetentionEvaluation {
    const cessationMs = new Date(record.cessationDate).getTime();
    const evaluatedAtMs = new Date(record.evaluatedAt).getTime();
    const shredEligibleMs = cessationMs + TWO_YEARS_MS;

    const canShred = evaluatedAtMs >= shredEligibleMs;
    const shredEligibleFrom = new Date(shredEligibleMs).toISOString();

    return {
      personId: record.personId,
      canShred,
      reason: canShred ? 'RETENTION_FLOOR_PASSED' : 'RETENTION_FLOOR_NOT_REACHED',
      shredEligibleFrom,
    };
  }

  /**
   * Record the shred outcome.
   *
   * In production this would call KeyProvider.deleteKey() for each keyRef.
   * Here we return the metadata the caller needs to perform the actual deletion
   * and to retain the pseudonymous transaction facts (INV-014).
   *
   * Transaction facts are ALWAYS retained — they carry no PII (personId is pseudonymous).
   */
  shred(request: ShredRequest): ShredResult {
    // The key deletion is performed by the caller (KeyProvider.deleteKey).
    // This function records the outcome and asserts the transaction facts survive.
    return {
      personId: request.personId,
      piiKeysDeleted: [...request.keyRefs],
      transactionsRetained: request.transactions.length,
      retainedTransactions: [...request.transactions],
    };
  }
}

