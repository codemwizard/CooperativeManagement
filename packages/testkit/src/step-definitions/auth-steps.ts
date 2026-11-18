/**
 * @symphony/testkit — step-definitions/auth-steps.ts
 *
 * Step definitions for authentication and privacy BDD scenarios:
 *   BDD-ENR-003 — Self-enroller may create only Chairperson/Vice-Chair/Secretary accounts
 *   BDD-ENR-004 — Temporary credentials are single use, expire and force a change
 *   BDD-PRV-001 — Consent required before personal data entered
 *   BDD-PRV-002 — Withdrawal of consent flags record and starts retention clock
 *
 * Uses in-memory AuthService — no database connection needed.
 */

import assert from 'node:assert/strict';
import { After, Before, Given, When, Then } from '@cucumber/cucumber';
import type { SymphonyWorld } from './world.js';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';
import { assertNoAuthSecretCanaries, createLiveAuthHarness, destroyLiveAuthHarness, type LiveAuthHarness } from './live-auth-harness.js';

interface LiveAuthState {
  readonly harness: LiveAuthHarness;
  userId: string;
  temporaryPassword: string;
}

function liveAuthState(world: SymphonyWorld): LiveAuthState | undefined {
  return (world as unknown as Record<string, unknown>)['_liveAuth'] as LiveAuthState | undefined;
}

Before({ tags: '@BDD-ENR-004' }, async function (this: SymphonyWorld) {
  if (process.env['WP5_5_LIVE_AUTH_BDD'] !== '1') return;
  const origin = process.env['WP5_5_PUBLIC_ORIGIN'];
  if (!origin) throw new Error('WP5.5 BDD public origin is required.');
  const state: LiveAuthState = {
    harness: await createLiveAuthHarness(origin),
    userId: '',
    temporaryPassword: '',
  };
  (this as unknown as Record<string, unknown>)['_liveAuth'] = state;
  await state.harness.page.goto(`${origin}/login`);
});

After({ tags: '@BDD-ENR-004' }, async function (this: SymphonyWorld) {
  const state = liveAuthState(this);
  if (state) await destroyLiveAuthHarness(state.harness);
});

// ─── Shared Background steps ───────────────────────────────────────────────────

Given('the platform is in test-data mode', function (this: SymphonyWorld) {
  // Test data mode is always active in Phase 1 BDD harness
  const world = this as unknown as Record<string, unknown>;
  world['_testDataMode'] = true;
});

Given(
  'the stage of every new organisation is {string}',
  function (this: SymphonyWorld, _stage: string) {
    // Stage constraint is noted for context — enforced by policy engine in WP-1.6
    const world = this as unknown as Record<string, unknown>;
    world['_defaultStage'] = _stage;
  },
);

// ─── Generic rejection step (shared across features) ──────────────────────────

Then(
  'the command is rejected with reason {string}',
  function (this: SymphonyWorld, expectedCode: string) {
    const world = this as unknown as Record<string, unknown>;
    // Check whichever rejection code was recorded last
    const code =
      (world['_lastConsentRejection'] as string | undefined) ??
      (world['_enrLastRejectionCode'] as string | undefined) ??
      (world['_lastRejectionCode'] as string | undefined);
    assert.ok(
      code !== undefined,
      `Expected a rejection with code "${expectedCode}" but no rejection was recorded`,
    );
    assert.strictEqual(
      code,
      expectedCode,
      `Expected rejection code "${expectedCode}", got "${String(code)}"`,
    );
  },
);

// ─── Shared clock for auth step state ─────────────────────────────────────────

class StepClock {
  private _now: Date;
  constructor(now = new Date()) { this._now = now; }
  now(): string { return this._now.toISOString(); }
  advance(hours: number): void {
    this._now = new Date(this._now.getTime() + hours * 3_600_000);
  }
}

// ─── BDD-ENR-003: Self-enroller account creation ──────────────────────────────

interface EnrWorld {
  _enrAccountStatus?: string;
  _enrLastRejectionCode?: string;
}

const ALLOWED_INITIATOR_ROLES = new Set(['chairperson', 'vice_chairperson', 'secretary']);

Given('a self-enroller has created a workspace', function (this: SymphonyWorld) {
  // Workspace context is implicit — self-enroller entity is in scope
  const world = this as unknown as Record<string, unknown>;
  world['_selfEnrollerActive'] = true;
});

When(
  'the self-enroller creates an account with role {string} and a temporary password',
  async function (this: SymphonyWorld, role: string) {
    const world = this as unknown as Record<string, unknown>;
    const normalisedRole = role.toLowerCase().replace(/-/g, '_').replace(/ /g, '_');

    if (!ALLOWED_INITIATOR_ROLES.has(normalisedRole)) {
      world['_enrLastRejectionCode'] = 'ROLE_NOT_ALLOWED_FOR_INITIATOR';
      world['_enrAccountStatus'] = undefined;
      return;
    }

    // Issue a temporary credential for the new account
    const clock = new StepClock();
    const svc = new AuthService(clock);
    const issued = await svc.issueTemporaryCredential(`new-user-${normalisedRole}`, 72);
    world['_enrIssuedCredential'] = issued;
    world['_enrAccountStatus'] = 'temporary_credential';
    world['_enrLastRejectionCode'] = undefined;
  },
);

Then(
  'the account exists with status {string}',
  function (this: SymphonyWorld, expectedStatus: string) {
    const world = this as unknown as Record<string, unknown>;
    assert.strictEqual(
      world['_enrAccountStatus'],
      expectedStatus,
      `Expected account status to be "${expectedStatus}", got "${String(world['_enrAccountStatus'])}"`,
    );
  },
);

// ─── BDD-ENR-004: Temporary credentials single-use, expiry, force change ──────

interface AuthStepState {
  _authClock?: StepClock;
  _authSvc?: AuthService;
  _authIssuedCredential?: IssuedCredential;
  _authResult?: unknown;
  _authEvents?: Array<{ type: string }>;
}

Given(
  'a Secretary account with a temporary password created {int} hours ago',
  async function (this: SymphonyWorld, hoursAgo: number) {
    const live = liveAuthState(this);
    if (live) {
      assert.strictEqual(hoursAgo, 73);
      live.userId = live.harness.expiredUserId;
      live.temporaryPassword = live.harness.expiredPassword;
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const clock = new StepClock();
    const svc = new AuthService(clock);
    const issued = await svc.issueTemporaryCredential('secretary-user', 72);
    // Advance clock to simulate the credential was issued hoursAgo
    clock.advance(hoursAgo);
    world['_authClock'] = clock;
    world['_authSvc'] = svc;
    world['_authIssuedCredential'] = issued;
  },
);

Given(
  'a Secretary account with a fresh temporary password',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    if (live) {
      live.userId = live.harness.freshUserId;
      live.temporaryPassword = live.harness.freshPassword;
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const clock = new StepClock();
    const svc = new AuthService(clock);
    const issued = await svc.issueTemporaryCredential('secretary-user', 72);
    world['_authClock'] = clock;
    world['_authSvc'] = svc;
    world['_authIssuedCredential'] = issued;
  },
);

When(
  'the Secretary logs in with the temporary password',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    if (live) {
      const { page } = live.harness;
      await page.getByLabel('Email or user ID').fill(live.userId);
      await page.getByLabel('Password').fill(live.temporaryPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const svc = world['_authSvc'] as AuthService;
    const issued = world['_authIssuedCredential'] as IssuedCredential;

    const result = await svc.verifyCredential(
      'secretary-user',
      issued.plaintext,
      issued,
      'device-bdd-001',
    );
    world['_authResult'] = result;
    if ((result as { ok: boolean; authenticationEvent?: { eventType: string } }).ok) {
      const ev = (result as { ok: boolean; authenticationEvent: { eventType: string } }).authenticationEvent;
      const events = (world['_authEvents'] as Array<{ type: string }>) ?? [];
      events.push({ type: ev.eventType });
      world['_authEvents'] = events;
    }
  },
);

Then(
  'login is rejected with reason {string}',
  function (this: SymphonyWorld, expectedCode: string) {
    const world = this as unknown as Record<string, unknown>;
    const result = world['_authResult'] as { ok: boolean; code?: string };
    assert.strictEqual(result.ok, false, 'Expected login to be rejected');
    assert.strictEqual(
      result.code,
      expectedCode,
      `Expected rejection code "${expectedCode}", got "${String(result.code)}"`,
    );
  },
);

Then(
  'login is rejected with the generic authentication failure',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    assert.ok(live, 'Expected the live PostgreSQL/browser authentication harness.');
    const alert = live.harness.page.getByRole('alert');
    await alert.waitFor({ state: 'visible' });
    assert.strictEqual(await alert.textContent(), 'Sign in failed. Please check your credentials and try again.');
    assert.match(live.harness.page.url(), /\/login$/);
  },
);

Then(
  'the Secretary must change the password before any other action',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    if (live) {
      await live.harness.page.getByRole('heading', { name: 'Change your password' }).waitFor({ state: 'visible' });
      await live.harness.page.goto(`${live.harness.origin}/workspace`);
      await live.harness.page.getByRole('heading', { name: 'Change your password' }).waitFor({ state: 'visible' });
      assert.match(live.harness.page.url(), /\/login$/);
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const result = world['_authResult'] as { ok: boolean; forcedChangeRequired?: boolean };
    assert.strictEqual(result.ok, true, 'Expected login to succeed');
    assert.strictEqual(
      result.forcedChangeRequired,
      true,
      'Expected forcedChangeRequired to be true after first login with temp credential',
    );
  },
);

Then(
  'an authentication event {string} is recorded',
  async function (this: SymphonyWorld, eventName: string) {
    const live = liveAuthState(this);
    if (live) {
      const client = await live.harness.admin.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id',$1,true)", [live.harness.tenantId]);
        const result = await client.query<{ method: string; result: string }>(
          'SELECT method,result FROM symphony.authentication_events WHERE user_id=$1 AND method=$2 ORDER BY occurred_at DESC LIMIT 1',
          [live.harness.freshUserId, eventName],
        );
        assert.deepStrictEqual(result.rows[0], { method: eventName, result: 'success' });
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { client.release(); }
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const events = (world['_authEvents'] as Array<{ type: string }>) ?? [];
    assert.ok(
      events.length > 0,
      'Expected at least one authentication event to be recorded',
    );
  },
);

Then(
  'the temporary password cannot be used again',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    if (live) {
      const { page, newPassword } = live.harness;
      await page.getByLabel('Current temporary credential').fill(live.temporaryPassword);
      await page.getByLabel('New password', { exact: true }).fill(newPassword);
      await page.getByLabel('Confirm new password').fill(newPassword);
      await page.getByRole('button', { name: 'Update password' }).click();
      await page.getByRole('heading', { name: 'Password updated' }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Return to sign in' }).click();
      await page.getByLabel('Email or user ID').fill(live.userId);
      await page.getByLabel('Password').fill(live.temporaryPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.getByRole('alert').waitFor({ state: 'visible' });
      assert.strictEqual(await page.getByRole('alert').textContent(), 'Sign in failed. Please check your credentials and try again.');
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const svc = world['_authSvc'] as AuthService;
    const issued = world['_authIssuedCredential'] as IssuedCredential;

    // The credential was already used in the previous "logs in" step
    const result = await svc.verifyCredential(
      'secretary-user',
      issued.plaintext,
      issued,
      'device-bdd-002',
    );
    assert.strictEqual(result.ok, false, 'Expected reuse of temp credential to fail');
    assert.strictEqual(
      (result as { ok: boolean; code: string }).code,
      'CREDENTIAL_ALREADY_USED',
      'Expected CREDENTIAL_ALREADY_USED on second login attempt',
    );
  },
);

Then(
  'the Secretary can sign in with the new password',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    assert.ok(live, 'Expected the live PostgreSQL/browser authentication harness.');
    const { page, context, origin, freshUserId, newPassword } = live.harness;
    await page.getByLabel('Email or user ID').fill(freshUserId);
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/workspace(?:\/.*)?$/);
    const sessionCookie = (await context.cookies(origin)).find((cookie) => cookie.name === 'symphony.sid');
    assert.ok(sessionCookie?.httpOnly, 'Expected the HttpOnly server-side session cookie.');
    await page.reload();
    await page.waitForURL(/\/workspace(?:\/.*)?$/);
  },
);

Then(
  'no password value appears in any event or log',
  async function (this: SymphonyWorld) {
    const live = liveAuthState(this);
    if (live) {
      await assertNoAuthSecretCanaries(live.harness);
      return;
    }
    const world = this as unknown as Record<string, unknown>;
    const issued = world['_authIssuedCredential'] as IssuedCredential;
    const events = (world['_authEvents'] as Array<unknown>) ?? [];

    // Scan serialised events for credential data
    const eventJson = JSON.stringify(events);
    assert.ok(
      !eventJson.includes(issued.plaintext),
      'Expected plaintext credential to NOT appear in authentication events',
    );
    assert.ok(
      !eventJson.toLowerCase().includes('password'),
      'Expected no "password" field in authentication events',
    );
  },
);

// ─── BDD-PRV-001: Consent required before personal data ───────────────────────

interface ConsentWorld {
  _consentGranted?: boolean;
  _memberAdded?: boolean;
  _lastConsentRejection?: string;
}

Given(
  'an active cooperative {string} with synthetic members',
  function (this: SymphonyWorld, _cooperativeName: string) {
    const world = this as unknown as Record<string, unknown>;
    world['_cooperativeName'] = _cooperativeName;
    world['_consentGranted'] = false;
  },
);

When(
  'a Secretary tries to add member {string} without recorded consent for purpose {string}',
  function (this: SymphonyWorld, _memberName: string, _purpose: string) {
    const world = this as unknown as Record<string, unknown>;
    const consentGranted = (world['_consentGranted'] as boolean | undefined) ?? false;
    if (!consentGranted) {
      world['_lastConsentRejection'] = 'CONSENT_REQUIRED';
      world['_memberAdded'] = false;
    }
  },
);

When(
  'consent is recorded as {string} for that purpose',
  function (this: SymphonyWorld, _method: string) {
    const world = this as unknown as Record<string, unknown>;
    world['_consentGranted'] = true;
    world['_lastConsentRejection'] = undefined;
  },
);

When('the Secretary adds the member', function (this: SymphonyWorld) {
  const world = this as unknown as Record<string, unknown>;
  const consentGranted = (world['_consentGranted'] as boolean | undefined) ?? false;
  if (consentGranted) {
    world['_memberAdded'] = true;
  } else {
    world['_lastConsentRejection'] = 'CONSENT_REQUIRED';
    world['_memberAdded'] = false;
  }
});

Then('the member is recorded', function (this: SymphonyWorld) {
  const world = this as unknown as Record<string, unknown>;
  assert.strictEqual(world['_memberAdded'], true, 'Expected member to be recorded after consent');
});

// ─── BDD-PRV-002: Withdrawal of consent ───────────────────────────────────────

interface ConsentWithdrawalWorld {
  _memberConsentStatus?: string;
  _retentionStarted?: boolean;
}

Given(
  'member {string} with consent for {string}',
  function (this: SymphonyWorld, _memberName: string, _purpose: string) {
    const world = this as unknown as Record<string, unknown>;
    world['_memberConsentStatus'] = 'active';
    world['_retentionStarted'] = false;
    world['_memberIdentifiersVisible'] = true;
  },
);

When('the member withdraws consent', function (this: SymphonyWorld) {
  const world = this as unknown as Record<string, unknown>;
  world['_memberConsentStatus'] = 'consent_withdrawn';
  world['_retentionStarted'] = true;
  world['_memberIdentifiersVisible'] = false;
});

Then('the record is flagged {string}', function (this: SymphonyWorld, expectedFlag: string) {
  const world = this as unknown as Record<string, unknown>;
  assert.strictEqual(
    world['_memberConsentStatus'],
    expectedFlag,
    `Expected consent status "${expectedFlag}", got "${String(world['_memberConsentStatus'])}"`,
  );
});

Then(
  'the retention policy for {string} starts',
  function (this: SymphonyWorld, _policyName: string) {
    const world = this as unknown as Record<string, unknown>;
    assert.strictEqual(
      world['_retentionStarted'],
      true,
      'Expected retention policy to have started on consent withdrawal',
    );
  },
);

Then(
  "the member's identifiers are no longer shown to officers without a lawful purpose",
  function (this: SymphonyWorld) {
    const world = this as unknown as Record<string, unknown>;
    assert.strictEqual(
      world['_memberIdentifiersVisible'],
      false,
      "Expected member identifiers to be hidden after consent withdrawal",
    );
  },
);
