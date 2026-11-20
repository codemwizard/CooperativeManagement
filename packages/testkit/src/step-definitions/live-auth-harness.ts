import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { PostgresCredentialRepository } from '@symphony/db';

export interface LiveAuthHarness {
  readonly browser: Browser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly admin: pg.Pool;
  readonly app: pg.Pool;
  readonly tenantId: string;
  readonly expiredUserId: string;
  readonly expiredPassword: string;
  readonly freshUserId: string;
  readonly freshPassword: string;
  readonly newPassword: string;
  readonly origin: string;
  readonly logPath: string;
  readonly throttleHmacKey: Buffer;
}

export async function createLiveAuthHarness(origin: string): Promise<LiveAuthHarness> {
  const adminUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
  const appUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'];
  if (process.env['DATA_MODE'] !== 'test' || !adminUrl || !appUrl) {
    throw new Error('WP5.5 requires DATA_MODE=test and the restricted app plus test-admin PostgreSQL URLs.');
  }
  const databaseName = decodeURIComponent(new URL(appUrl).pathname.replace(/^\//, ''));
  if (!databaseName.endsWith('_test')) throw new Error('WP5.5 refuses a database not suffixed _test.');
  const logPath = process.env['WP5_5_API_LOG_PATH'];
  if (!logPath) throw new Error('WP5.5 requires an isolated API log capture file.');
  const throttleHmacKey = Buffer.from(process.env['AUTH_THROTTLE_HMAC_KEY'] ?? Buffer.alloc(32, 0x53).toString('base64'), 'base64');
  if (throttleHmacKey.length < 32) throw new Error('WP5.5 throttle HMAC key must contain at least 32 bytes.');

  const admin = new pg.Pool({ connectionString: adminUrl, max: 2 });
  const app = new pg.Pool({ connectionString: appUrl, max: 2 });
  const tenantId = randomUUID();
  const expiredUserId = randomUUID();
  const freshUserId = randomUUID();
  const expiredPassword = `Temporary ${randomUUID()} credential`;
  const freshPassword = `Temporary ${randomUUID()} credential`;
  const newPassword = `New passphrase ${randomUUID()} for Symphony`;
  const credentials = new CredentialLifecycleService({ now: () => new Date().toISOString() });
  const credentialRepository = new PostgresCredentialRepository(app);
  const expiredMaterial = await credentials.issueTemporaryCredential();
  const freshMaterial = await credentials.issueTemporaryCredential();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let committed = false;
  let fixtureClientReleased = false;
  const fixtureClient = await admin.connect();
  try {
    await fixtureClient.query('BEGIN');
    await fixtureClient.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, `wp5.5-bdd-${tenantId}`]);
    await fixtureClient.query(
      `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
       VALUES($1,$3,$2,$2,'active'),($4,$3,$5,$5,'active')`,
      [expiredUserId, `expired-${expiredUserId}@example.invalid`, tenantId, freshUserId, `fresh-${freshUserId}@example.invalid`],
    );
    await fixtureClient.query('COMMIT');
    committed = true;
    const expiredRow = await credentialRepository.issueTemporaryCredential({
      credentialId: expiredMaterial.credentialId, tenantId, userId: expiredUserId, secretHash: expiredMaterial.hash,
    });
    await credentialRepository.issueTemporaryCredential({
      credentialId: freshMaterial.credentialId, tenantId, userId: freshUserId, secretHash: freshMaterial.hash,
    });
    const expiredIssuedAt = new Date(Date.now() - 73 * 60 * 60_000);
    await admin.query(
      `UPDATE symphony.temporary_credentials SET issued_at=$2::timestamptz,expires_at=$2::timestamptz + INTERVAL '72 hours'
        WHERE id=$1 AND tenant_id=$3`,
      [expiredRow.id, expiredIssuedAt, tenantId],
    );
    return {
      browser, context, page, admin, app, tenantId, expiredUserId, expiredPassword: expiredMaterial.plaintext,
      freshUserId, freshPassword: freshMaterial.plaintext, newPassword, origin, logPath, throttleHmacKey,
    };
  } catch (error) {
    if (!committed) await fixtureClient.query('ROLLBACK').catch(() => undefined);
    fixtureClient.release();
    fixtureClientReleased = true;
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await app.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
    throw error;
  } finally {
    if (!fixtureClientReleased) fixtureClient.release();
  }
}

export async function assertNoAuthSecretCanaries(harness: LiveAuthHarness): Promise<void> {
  const events = await harness.admin.query<{ event_json: string }>(
    `SELECT to_jsonb(e)::text AS event_json FROM symphony.authentication_events e
      WHERE e.user_id=ANY($1::uuid[])`,
    [[harness.expiredUserId, harness.freshUserId]],
  );
  const logs = readFileSync(harness.logPath, 'utf8');
  if (!logs.includes('request completed') || !logs.includes('/auth/login') || !logs.includes('/auth/change-password')) {
    throw new Error('Captured API log is empty or does not prove the live authentication route path.');
  }
  for (const secret of [harness.expiredPassword, harness.freshPassword, harness.newPassword]) {
    if (events.rows.some((row) => row.event_json.includes(secret))) throw new Error('Authentication event contains a password canary.');
    if (logs.includes(secret)) throw new Error('Application logs contain a password canary.');
  }
}

export async function destroyLiveAuthHarness(harness: LiveAuthHarness): Promise<void> {
  await harness.context.close().catch(() => undefined);
  await harness.browser.close().catch(() => undefined);
  const accountKeys = [harness.expiredUserId, harness.freshUserId].map((userId) =>
    createHmac('sha256', harness.throttleHmacKey).update(`account:${userId.toLowerCase()}`).digest(),
  );
  const sourceKey = createHmac('sha256', harness.throttleHmacKey).update('trusted_source:127.0.0.1').digest();
  try {
    await harness.admin.query('DELETE FROM symphony.auth_sessions WHERE tenant_id=$1', [harness.tenantId]);
    await harness.admin.query('DELETE FROM symphony.authentication_events WHERE user_id=ANY($1::uuid[])', [[harness.expiredUserId, harness.freshUserId]]);
    await harness.admin.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1', [harness.tenantId]);
    await harness.admin.query('DELETE FROM symphony.temporary_credentials WHERE tenant_id=$1', [harness.tenantId]);
    await harness.admin.query('DELETE FROM symphony.users WHERE tenant_id=$1', [harness.tenantId]);
    await harness.admin.query('DELETE FROM symphony.tenants WHERE id=$1', [harness.tenantId]);
    for (const identityHmac of [...accountKeys, sourceKey]) {
      await harness.admin.query('DELETE FROM symphony.auth_attempt_events WHERE identity_hmac=$1', [identityHmac]);
    }
  } finally {
    await harness.app.end().catch(() => undefined);
    await harness.admin.end().catch(() => undefined);
  }
}
