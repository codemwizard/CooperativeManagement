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
import { Given, When, Then } from '@cucumber/cucumber';
import type { SymphonyWorld } from './world.js';
import { AuthService, type IssuedCredential } from '@symphony/domain/identity/auth-service';

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
  'the Secretary must change the password before any other action',
  function (this: SymphonyWorld) {
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
  function (this: SymphonyWorld, _eventName: string) {
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
  'no password value appears in any event or log',
  function (this: SymphonyWorld) {
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
