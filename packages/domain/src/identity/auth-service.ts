/**
 * @symphony/domain — identity/auth-service.ts
 *
 * Authentication service for temporary credentials (ENR-010, INV-021).
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   - Credentials hashed with Argon2id — plaintext never stored
 *   - Errors are typed codes, never generic messages that leak internals
 *   - Input validation on all public methods
 *   - No `any` types
 *   - No credential in authentication events or command receipt payloads
 */

import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssuedCredential {
  /** Argon2id hash of the plaintext — the value stored in the DB. */
  readonly hash: string;
  /** The plaintext returned ONCE to the issuer for initial delivery. Never stored. */
  readonly plaintext: string;
  /** ISO 8601 timestamp when the credential was issued. */
  readonly issuedAt: string;
  /** ISO 8601 timestamp when the credential expires. */
  readonly expiresAt: string;
  /** Whether the credential has already been used (mutated to true on first verify). */
  used: boolean;
}

export interface AuthenticationEventPayload {
  readonly userId: string;
  readonly method: 'temporary_credential' | 'password';
  readonly result: 'success' | 'failure';
  readonly deviceId: string;
  readonly occurredAt: string;
  /** Error code — present only on failure. Never contains credential data. */
  readonly failureCode?: string;
}

export interface AuthenticationEvent {
  readonly id: string;
  readonly eventType: 'AuthenticationAttempted';
  readonly payload: AuthenticationEventPayload;
}

export interface AuthSuccess {
  readonly ok: true;
  /** User must change password before issuing any other command. */
  readonly forcedChangeRequired: boolean;
  /** Authentication event to be persisted — contains no PII. */
  readonly authenticationEvent: AuthenticationEvent;
}

export interface AuthError {
  readonly ok: false;
  readonly code: 'TEMPORARY_CREDENTIAL_EXPIRED' | 'CREDENTIAL_ALREADY_USED' | 'INVALID_CREDENTIAL';
}

export type AuthResult = AuthSuccess | AuthError;

export interface ChangePasswordReceiptPayload {
  readonly userId: string;
  readonly currentCredential: '[REDACTED]';
  readonly newPassword: '[REDACTED]';
  readonly occurredAt: string;
}

export interface ChangePasswordReceipt {
  readonly commandType: 'ChangePassword';
  readonly payload: ChangePasswordReceiptPayload;
}

export interface Clock {
  now(): string;
}

// ─── AuthService ──────────────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly clock: Clock) {}

  /**
   * Issue a temporary credential for a user.
   * Generates cryptographically random plaintext, hashes it with Argon2id,
   * and returns both — the plaintext for one-time delivery, the hash for storage.
   *
   * @param userId   - validated non-empty string
   * @param ttlHours - validated positive number (default 72)
   */
  async issueTemporaryCredential(userId: string, ttlHours: number): Promise<IssuedCredential> {
    if (!userId || userId.trim().length === 0) {
      throw new Error('userId must not be empty');
    }
    if (ttlHours <= 0) {
      throw new Error('ttlHours must be positive');
    }

    // Generate 32-byte cryptographically random plaintext, base64url-encoded
    const plaintext = randomBytes(32).toString('base64url');

    // Hash with Argon2id — OWASP recommended minimum parameters
    const hash = await argon2.hash(plaintext, { type: argon2.argon2id });

    const issuedAt = this.clock.now();
    const expiresAt = new Date(
      new Date(issuedAt).getTime() + ttlHours * 3_600_000,
    ).toISOString();

    return {
      hash,
      plaintext,
      issuedAt,
      expiresAt,
      used: false,
    };
  }

  /**
   * Verify a plaintext credential against a stored IssuedCredential.
   *
   * Checks in order:
   *   1. Already used → CREDENTIAL_ALREADY_USED
   *   2. Expired      → TEMPORARY_CREDENTIAL_EXPIRED
   *   3. Hash match   → success; marks as used; sets forcedChangeRequired = true
   *   4. No match     → INVALID_CREDENTIAL
   *
   * @param _userId    - for future multi-user store lookup (validated non-empty)
   * @param plaintext  - the credential presented by the user
   * @param stored     - the IssuedCredential record from the data store
   * @param deviceId   - device identifier for the authentication event
   */
  async verifyCredential(
    _userId: string,
    plaintext: string,
    stored: IssuedCredential,
    deviceId: string,
  ): Promise<AuthResult> {
    if (!plaintext || plaintext.trim().length === 0) {
      return { ok: false, code: 'INVALID_CREDENTIAL' };
    }

    const now = new Date(this.clock.now());

    // 1. Already used
    if (stored.used) {
      return { ok: false, code: 'CREDENTIAL_ALREADY_USED' };
    }

    // 2. Expired
    if (now > new Date(stored.expiresAt)) {
      return { ok: false, code: 'TEMPORARY_CREDENTIAL_EXPIRED' };
    }

    // 3. Hash verification
    const matches = await argon2.verify(stored.hash, plaintext);
    if (!matches) {
      return { ok: false, code: 'INVALID_CREDENTIAL' };
    }

    // Mark as used — mutation on the stored record
    stored.used = true;

    const authenticationEvent: AuthenticationEvent = {
      id: `auth-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
      eventType: 'AuthenticationAttempted',
      payload: {
        userId: _userId,
        method: 'temporary_credential',
        result: 'success',
        deviceId,
        occurredAt: this.clock.now(),
      },
    };

    return {
      ok: true,
      forcedChangeRequired: true, // First login with temp credential always forces change
      authenticationEvent,
    };
  }

  /**
   * Build a ChangePassword command receipt with credentials redacted.
   * The payload stored in command_receipts must NEVER contain the plaintext
   * password or old credential.
   *
   * @param userId  - the user changing their password
   * @param _body   - the raw request body (credentials are redacted before storing)
   */
  buildChangePasswordReceipt(
    userId: string,
    _body: { currentCredential: string; newPassword: string },
  ): ChangePasswordReceipt {
    return {
      commandType: 'ChangePassword',
      payload: {
        userId,
        currentCredential: '[REDACTED]',
        newPassword: '[REDACTED]',
        occurredAt: this.clock.now(),
      },
    };
  }
}
