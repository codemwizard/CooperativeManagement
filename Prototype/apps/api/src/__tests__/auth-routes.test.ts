/**
 * @symphony/api — __tests__/auth-routes.test.ts
 *
 * Integration tests for auth routes using Fastify's built-in inject().
 *
 * Tests:
 *   - POST /auth/login with valid temp cred → 200; session token returned
 *   - POST /auth/login with expired cred → 401; TEMPORARY_CREDENTIAL_EXPIRED
 *   - POST /auth/login twice with same temp cred → second call 401 CREDENTIAL_ALREADY_USED
 *   - Response body contains no NRC pattern (\d{6}/\d{2}/\d)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';
import { authRoutes, credentialStore } from '../routes/auth.js';

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

  app = Fastify();
  // Inject the shared clock so the route uses the same "now" as the test
  await app.register(authRoutes, { clock });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  credentialStore.clear();
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
  it('validTempCredential_returns200WithSessionToken', async () => {
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
    expect(body).toHaveProperty('sessionToken');
    expect(typeof body['sessionToken']).toBe('string');
    expect(body['forcedChangeRequired']).toBe(true);

    // Credential must NOT appear in response
    expect(response.body).not.toContain(issued.plaintext);
  });

  it('expiredCredential_returns401WithExpiredCode', async () => {
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
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body['code']).toBe('TEMPORARY_CREDENTIAL_EXPIRED');
  });

  it('sameCredentialTwice_secondCallReturns401AlreadyUsed', async () => {
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
    const body = JSON.parse(second.body) as Record<string, unknown>;
    expect(body['code']).toBe('CREDENTIAL_ALREADY_USED');
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
});
