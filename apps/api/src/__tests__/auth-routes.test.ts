/**
 * @symphony/api — __tests__/auth-routes.test.ts
 *
 * Integration tests for auth routes using Fastify's built-in inject().
 *
 * Tests:
 *   - POST /auth/login with valid temp cred → 200; bearer token is not returned
 *   - POST /auth/login with expired cred → generic 401 authentication failure
 *   - POST /auth/login twice with same temp cred → generic 401 authentication failure
 *   - Response body contains no NRC pattern (\d{6}/\d{2}/\d)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';
import * as argon2 from 'argon2';
import { authRoutes, credentialStore, passwordCredentialStore } from '../routes/auth.js';

// ─── Shared clock for consistent time between route and test ──────────────────

class SharedClock {
  private _now: Date;
  constructor(now = new Date()) { this._now = now; }
  now(): string { return this._now.toISOString(); }
  advance(hours: number): void {
    this._now = new Date(this._now.getTime() + hours * 3_600_000);
  }
}

const USER_ID = 'test-user-route-001';
const DEVICE_ID = 'device-test-001';

let app: FastifyInstance;
let clock: SharedClock;

beforeEach(async () => {
  clock = new SharedClock();
  credentialStore.clear();
  passwordCredentialStore.clear();

  app = Fastify();
  // Inject the shared clock so the route uses the same "now" as the test
  await app.register(authRoutes, { clock });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  credentialStore.clear();
  passwordCredentialStore.clear();
});

// ─── Helper — seed a credential using the shared clock ────────────────────────

async function seedCredential(
  userId: string,
  options: { ttlHours?: number; preUsed?: boolean } = {},
): Promise<IssuedCredential> {
  const svc = new AuthService(clock);
  const issued = await svc.issueTemporaryCredential(userId, options.ttlHours ?? 72);
  if (options.preUsed) {
    issued.used = true;
  }
  credentialStore.set(userId, issued);
  return issued;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('validTempCredential_returns200WithoutBearerToken', async () => {
    /**
     * A valid, unexpired, unused temporary credential must return 200
     * with a sessionToken and forcedChangeRequired = true.
     * No credential appears in the response body.
     */
    const issued = await seedCredential(USER_ID);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: USER_ID, credential: issued.plaintext, deviceId: DEVICE_ID },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sessionToken');
    expect(body['forcedChangeRequired']).toBe(true);

    // Credential must NOT appear in response
    expect(response.body).not.toContain(issued.plaintext);
  });

  it('expiredCredential_returnsGenericAuthenticationFailure', async () => {
    /**
     * A credential issued and then clock advanced past expiry must be rejected
     * with 401 and error code TEMPORARY_CREDENTIAL_EXPIRED.
     */
    const issued = await seedCredential(USER_ID, { ttlHours: 72 });

    // Advance shared clock 73h — both route and test share this clock
    clock.advance(73);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: USER_ID, credential: issued.plaintext, deviceId: DEVICE_ID },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: 'AUTHENTICATION_FAILED' });
  });

  it('sameCredentialTwice_secondCallUsesGenericAuthenticationFailure', async () => {
    /**
     * After a successful login, the same temp credential must be rejected
     * with 401 and CREDENTIAL_ALREADY_USED on second use.
     */
    const issued = await seedCredential(USER_ID);

    // First call succeeds
    const first = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: USER_ID, credential: issued.plaintext, deviceId: DEVICE_ID },
    });
    expect(first.statusCode).toBe(200);

    // Second call rejected
    const second = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: USER_ID, credential: issued.plaintext, deviceId: DEVICE_ID },
    });
    expect(second.statusCode).toBe(401);
    expect(second.json()).toEqual({ code: 'AUTHENTICATION_FAILED' });
  });

  it('responseBody_containsNoNrcPattern', async () => {
    /**
     * PRV-001: No NRC pattern (\d{6}/\d{2}/\d) must appear in any response.
     */
    const issued = await seedCredential(USER_ID);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: USER_ID, credential: issued.plaintext, deviceId: DEVICE_ID },
    });

    expect(response.body).not.toMatch(/\d{6}\/\d{2}\/\d/);
  });

  it('unknownUser_usesGenericAuthenticationError', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { userId: 'unknown-user', credential: 'wrong', deviceId: DEVICE_ID },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: 'AUTHENTICATION_FAILED' });
    expect(response.body).not.toContain('unknown-user');
    expect(response.body).not.toContain('No credential on file');
  });
});

describe('POST /auth/change-password legacy adapter', () => {
  it('stores a permanent password separately without issuing a temporary credential', async () => {
    const issued = await seedCredential(USER_ID);
    const newPassword = 'new secure passphrase 2036';

    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: { userId: USER_ID, currentCredential: issued.plaintext, newPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(credentialStore.has(USER_ID)).toBe(false);
    const permanentHash = passwordCredentialStore.get(USER_ID);
    expect(permanentHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await argon2.verify(permanentHash!, newPassword)).toBe(true);
    expect(response.body).not.toContain(issued.plaintext);
    expect(response.body).not.toContain(newPassword);
  });
});
