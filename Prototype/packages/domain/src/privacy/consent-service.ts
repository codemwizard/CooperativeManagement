/**
 * @symphony/domain — privacy/consent-service.ts
 *
 * Consent command handlers (PRV-001, PRV-002, PRV-010).
 *
 * Implements:
 *   RecordConsent    — records lawful basis and method; enables PII storage
 *   WithdrawConsent  — sets withdrawn_at; triggers retention-policy evaluation
 *                      HARD: cannot withdraw legal_obligation basis fields (O-19, Act s.28)
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   - No `any` types
 *   - Errors classified (PRECONDITION_FAILED, CANNOT_WITHDRAW_LEGAL_OBLIGATION)
 *   - Pure domain logic — no I/O
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LawfulBasis = 'consent' | 'legal_obligation' | 'legitimate_interest' | 'vital_interests';

export type ConsentMethod =
  | 'enroller_witnessed'
  | 'member_signed'
  | 'guardian_signed'
  | 'statutory'
  | 'officer_attested';

export interface RecordConsentCommand {
  readonly personId: string;
  readonly purpose: string;
  readonly lawfulBasis: LawfulBasis;
  readonly method: ConsentMethod;
  readonly recordedAt: string; // ISO 8601
}

export interface WithdrawConsentCommand {
  readonly personId: string;
  readonly purpose: string;
  readonly withdrawnAt: string; // ISO 8601
}

export interface ConsentCheckRequest {
  readonly personId: string;
  readonly purpose: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface ConsentEvent {
  readonly eventType: 'ConsentRecorded' | 'ConsentWithdrawn';
  readonly payload: ConsentRecordedPayload | ConsentWithdrawnPayload;
}

export interface ConsentRecordedPayload {
  readonly personId: string;
  readonly purpose: string;
  readonly lawfulBasis: LawfulBasis;
  readonly method: ConsentMethod;
  readonly recordedAt: string;
}

export interface ConsentWithdrawnPayload {
  readonly personId: string;
  readonly purpose: string;
  readonly withdrawnAt: string;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export type ConsentErrorCode =
  | 'PRECONDITION_FAILED'
  | 'CANNOT_WITHDRAW_LEGAL_OBLIGATION'
  | 'CONSENT_NOT_FOUND'
  | 'INVALID_INPUT';

export interface ConsentSuccess {
  readonly ok: true;
  readonly events: readonly ConsentEvent[];
  readonly retentionEvaluationRequired: boolean;
}

export interface ConsentFailure {
  readonly ok: false;
  readonly code: ConsentErrorCode;
  readonly detail: string;
}

export type ConsentResult = ConsentSuccess | ConsentFailure;

export interface ConsentCheckSuccess {
  readonly ok: true;
}

export interface ConsentCheckFailure {
  readonly ok: false;
  readonly code: ConsentErrorCode;
  readonly detail: string;
}

export type ConsentCheckResult = ConsentCheckSuccess | ConsentCheckFailure;

// ─── ConsentService ───────────────────────────────────────────────────────────

/**
 * ConsentRecord — in-memory representation of a recorded consent.
 * In production this is persisted in the consent_records table.
 */
interface ConsentRecord {
  readonly personId: string;
  readonly purpose: string;
  readonly lawfulBasis: LawfulBasis;
  readonly method: ConsentMethod;
  readonly recordedAt: string;
  withdrawnAt: string | null;
}

export class ConsentService {
  /** In-memory consent store — replaced by DB persistence in production. */
  private readonly store = new Map<string, ConsentRecord>();

  private static key(personId: string, purpose: string): string {
    return `${personId}:${purpose}`;
  }

  /**
   * Check whether consent (or legal obligation basis) exists for a person/purpose
   * before PII is stored. Returns PRECONDITION_FAILED if no active consent exists.
   */
  async checkConsentBeforePii(req: ConsentCheckRequest): Promise<ConsentCheckResult> {
    const record = this.store.get(ConsentService.key(req.personId, req.purpose));

    if (!record || record.withdrawnAt !== null) {
      return {
        ok: false,
        code: 'PRECONDITION_FAILED',
        detail: `No active consent for person "${req.personId}" and purpose "${req.purpose}"`,
      };
    }

    return { ok: true };
  }

  /**
   * RecordConsent — creates a consent record for a person/purpose pair.
   * Idempotent: re-recording the same purpose updates the method and timestamp.
   */
  async recordConsent(cmd: RecordConsentCommand): Promise<ConsentResult> {
    if (!cmd.personId || cmd.personId.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'personId must not be empty' };
    }
    if (!cmd.purpose || cmd.purpose.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'purpose must not be empty' };
    }

    const record: ConsentRecord = {
      personId: cmd.personId,
      purpose: cmd.purpose,
      lawfulBasis: cmd.lawfulBasis,
      method: cmd.method,
      recordedAt: cmd.recordedAt,
      withdrawnAt: null,
    };
    this.store.set(ConsentService.key(cmd.personId, cmd.purpose), record);

    const event: ConsentEvent = {
      eventType: 'ConsentRecorded',
      payload: {
        personId: cmd.personId,
        purpose: cmd.purpose,
        lawfulBasis: cmd.lawfulBasis,
        method: cmd.method,
        recordedAt: cmd.recordedAt,
      } satisfies ConsentRecordedPayload,
    };

    return { ok: true, events: [event], retentionEvaluationRequired: false };
  }

  /**
   * WithdrawConsent — marks consent as withdrawn and triggers retention evaluation.
   * HARD: Fields with lawfulBasis = 'legal_obligation' cannot be withdrawn via consent.
   * They remain until the legal obligation lapses (e.g. Act s.28 register obligation ends).
   */
  async withdrawConsent(cmd: WithdrawConsentCommand): Promise<ConsentResult> {
    if (!cmd.personId || cmd.personId.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'personId must not be empty' };
    }
    if (!cmd.purpose || cmd.purpose.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'purpose must not be empty' };
    }

    const record = this.store.get(ConsentService.key(cmd.personId, cmd.purpose));

    if (!record) {
      return {
        ok: false,
        code: 'CONSENT_NOT_FOUND',
        detail: `No consent record found for person "${cmd.personId}" and purpose "${cmd.purpose}"`,
      };
    }

    // HARD: legal_obligation basis cannot be withdrawn by the data subject
    if (record.lawfulBasis === 'legal_obligation') {
      return {
        ok: false,
        code: 'CANNOT_WITHDRAW_LEGAL_OBLIGATION',
        detail: `Purpose "${cmd.purpose}" is based on legal obligation (Act s.28) and cannot be withdrawn via consent mechanism`,
      };
    }

    record.withdrawnAt = cmd.withdrawnAt;

    const event: ConsentEvent = {
      eventType: 'ConsentWithdrawn',
      payload: {
        personId: cmd.personId,
        purpose: cmd.purpose,
        withdrawnAt: cmd.withdrawnAt,
      } satisfies ConsentWithdrawnPayload,
    };

    return {
      ok: true,
      events: [event],
      // Withdrawal triggers retention-policy evaluation (PRV-002)
      retentionEvaluationRequired: true,
    };
  }
}

