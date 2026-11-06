/**
 * @symphony/domain — identity/__tests__/auth.test.ts
 *
 * Unit tests for the auth-service (Task 1.5.1 — written BEFORE implementation).
 *
 * Tests:
 *   - temporaryCredential_isHashedArgon2id
 *   - temporaryCredential_singleUse
 *   - temporaryCredential_isExpiredAfterDefault72h
 *   - firstLogin_requiresPasswordChange
 *   - authenticationEvent_containsNoPII
 *   - credential_neverAppearsInEventPayload
 *
 * All tests are expected to FAIL until auth-service.ts is implemented.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuthService,
  type IssuedCredential,
  type AuthResult,
  type AuthError,
} from '../auth-service.js';

// ─── Fake clock for expiry control ────────────────────────────────────────────

class TestClock {
  private _now: Date;
  constructor(now = new Date('2024-01-01T12:00:00Z')) {
    this._now = now;
  }
  now(): string { return this._now.toISOString(); }
  advance(hours: number): void {
    this._now = new Date(this._now.getTime() + hours * 3_600_000);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const DEVICE_ID = 'device-abc';
const DEFAULT_TTL_HOURS = 72;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let clock: TestClock;
  let svc: AuthService;

  beforeEach(() => {
    clock = new TestClock();
    svc = new AuthService(clock);
  });

  it('temporaryCredential_isHashedArgon2id', async () => {
    /**
     * issueTemporaryCredential must return a hash of the plaintext using Argon2id.
     * The hash must start with '$argon2id$'. The plaintext must never be retrievable
     * from the returned credential.
     */
    const issued: IssuedCredential = await svc.issueTemporaryCredential(USER_ID, DEFAULT_TTL_HOURS);

    // The stored hash uses Argon2id
    expect(issued.hash).toMatch(/^\$argon2id\$/);

    // The plaintext is returned separately for initial delivery — not stored
    expect(issued.plaintext).toBeTruthy();

    // The plaintext is not embedded in the hash string
    expect(issued.hash).not.toContain(issued.plaintext);

    // The hash field contains no raw plaintext
    expect(issued.plaintext.length).toBeGreaterThan(0);
  });

  it('temporaryCredential_singleUse', async () => {
    /**
     * After a successful login with the temporary credential, a second login
     * with the same plaintext must be rejected with CREDENTIAL_ALREADY_USED.
     */
    const issued = await svc.issueTemporaryCredential(USER_ID, DEFAULT_TTL_HOURS);

    // First login succeeds
    const first: AuthResult = await svc.verifyCredential(
      USER_ID, issued.plaintext, issued, DEVICE_ID,
    );
    expect(first.ok).toBe(true);

    // Second login with same plaintext is rejected
    const second: AuthResult = await svc.verifyCredential(
      USER_ID, issued.plaintext, issued, DEVICE_ID,
    );
    expect(second.ok).toBe(false);
    expect((second as AuthError).code).toBe('CREDENTIAL_ALREADY_USED');
  });

  it('temporaryCredential_isExpiredAfterDefault72h', async () => {
    /**
     * A credential issued with 72h TTL must be rejected when presented 73 hours
     * after issue with error code TEMPORARY_CREDENTIAL_EXPIRED.
     */
    const issued = await svc.issueTemporaryCredential(USER_ID, DEFAULT_TTL_HOURS);

    // Advance clock 73 hours past issue time
    clock.advance(73);

    const result: AuthResult = await svc.verifyCredential(
      USER_ID, issued.plaintext, issued, DEVICE_ID,
    );
    expect(result.ok).toBe(false);
    expect((result as AuthError).code).toBe('TEMPORARY_CREDENTIAL_EXPIRED');
  });

  it('firstLogin_requiresPasswordChange', async () => {
    /**
     * On first login with a temporary credential, the result must include
     * forcedChangeRequired = true. The user cannot issue other commands until
     * they change their password.
     */
    const issued = await svc.issueTemporaryCredential(USER_ID, DEFAULT_TTL_HOURS);

    const result: AuthResult = await svc.verifyCredential(
      USER_ID, issued.plaintext, issued, DEVICE_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.forcedChangeRequired).toBe(true);
    }
  });

  it('authenticationEvent_containsNoPII', async () => {
    /**
     * The authentication event emitted on login must not contain any PII:
     * no name, no NRC pattern (\d{6}/\d{2}/\d), no email address.
     * The payload must only contain { userId, method, result, deviceId, occurredAt }.
     */
    const issued = await svc.issueTemporaryCredential(USER_ID, DEFAULT_TTL_HOURS);

    const authResult: AuthResult = await svc.verifyCredential(
      USER_ID, issued.plaintext, issued, DEVICE_ID,
    );
    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;

    const event = authResult.authenticationEvent;
    const payloadStr = JSON.stringify(event.payload);

    // No NRC pattern
    expect(payloadStr).not.toMatch(/\d{6}\/\d{2}\/\d/);
    // No email pattern
    expect(payloadStr).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    // No credential/password field
    expect(payloadStr).not.toMatch(/"(password|credential|hash|plaintext)"/);

    // Required fields only
    expect(event.payload).toHaveProperty('userId');
    expect(event.payload).toHaveProperty('method');
    expect(event.payload).toHaveProperty('result');
    expect(event.payload).toHaveProperty('deviceId');
    expect(event.payload).toHaveProperty('occurredAt');
  });

  it('credential_neverAppearsInEventPayload', async () => {
    /**
     * When a ChangePassword command is processed, the command receipt payload
     * must not contain the new password or old credential in any form.
     * buildChangePasswordReceipt() must redact both credential fields.
     */
    const receipt = svc.buildChangePasswordReceipt(
      USER_ID,
      { currentCredential: 'old-secret-123', newPassword: 'new-secret-456' },
    );

    const payloadStr = JSON.stringify(receipt.payload);
    expect(payloadStr).not.toContain('old-secret-123');
    expect(payloadStr).not.toContain('new-secret-456');
    // The fields must be replaced with a redaction marker
    expect(payloadStr).toContain('[REDACTED]');
  });
});

