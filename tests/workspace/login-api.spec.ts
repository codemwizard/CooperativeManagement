import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { PostgresCredentialRepository } from '@symphony/db';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL ?? process.env.PHASE1_TEST_DATABASE_URL;
if (!adminUrl || !appUrl) throw new Error('WP5.4 browser acceptance requires admin and restricted app PostgreSQL URLs.');

const admin = new pg.Pool({ connectionString: adminUrl, max: 2 });
const app = new pg.Pool({ connectionString: appUrl, max: 2 });
const tenantId = randomUUID();
const userId = randomUUID();
const newPassword = `New passphrase ${randomUUID()} for Symphony`;
let temporaryPassword: string;
const apiLogPath = process.env.WP5_5_API_LOG_PATH;

function assertSecretsAbsentFromCapturedApiLog(...secrets: string[]): void {
  if (!apiLogPath) throw new Error('WP5.4 requires an isolated API log capture file.');
  const log = readFileSync(apiLogPath, 'utf8');
  expect(log.length, 'expected actual API request records in the captured log').toBeGreaterThan(0);
  expect(log).toContain('request completed');
  expect(log).toContain('/auth/login');
  expect(log).toContain('/auth/change-password');
  for (const secret of secrets) expect(log).not.toContain(secret);
}

test.beforeAll(async () => {
  await admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, `wp5.4-browser-${tenantId}`]);
  await admin.query(
    `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
     VALUES($1,$2,$3,$3,'active')`, [userId, tenantId, `wp54-${userId}@example.invalid`],
  );
  const material = await new CredentialLifecycleService({ now: () => new Date().toISOString() }).issueTemporaryCredential();
  if (material.plaintext.length === 0) throw new Error('Temporary credential fixture was not issued.');
  await new PostgresCredentialRepository(app).issueTemporaryCredential({
    credentialId: material.credentialId, tenantId, userId, secretHash: material.hash,
  });
  temporaryPassword = material.plaintext;
});

test.afterAll(async () => {
  const key = Buffer.alloc(32, 0x53);
  const accountKey = createHmac('sha256', key).update(`account:${userId.toLowerCase()}`).digest();
  const sourceKey = createHmac('sha256', key).update('trusted_source:127.0.0.1').digest();
  await admin.query('DELETE FROM symphony.auth_sessions WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.authentication_events WHERE user_id=$1', [userId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.temporary_credentials WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.users WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]).catch(() => undefined);
  for (const identityHmac of [accountKey, sourceKey]) {
    await admin.query('DELETE FROM symphony.auth_attempt_events WHERE identity_hmac=$1', [identityHmac]).catch(() => undefined);
  }
  await app.end();
  await admin.end();
});

function getTemporaryPassword(): string {
  if (!temporaryPassword) throw new Error('Temporary credential fixture is unavailable.');
  return temporaryPassword;
}

async function signIn(page: Page, password: string): Promise<void> {
  await page.getByLabel('Email or user ID').fill(userId);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('temporary login requires password change, revokes its session, then fresh login survives refresh', async ({ page, context }) => {
  const requestKeys: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/auth/login' && request.method() === 'POST') {
      requestKeys.push(...Object.keys(request.postDataJSON() as Record<string, unknown>).sort());
    }
  });
  await page.goto('/login');
  const loginA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(loginA11y.violations, 'login page accessibility violations').toEqual([]);
  const loginResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/auth/login' && response.request().method() === 'POST');
  await signIn(page, getTemporaryPassword());
  const firstLogin = await loginResponse;
  expect(firstLogin.status()).toBe(200);
  expect(requestKeys).toEqual(['credential', 'deviceId', 'userId']);
  expect(await firstLogin.text()).not.toContain(getTemporaryPassword());
  expect(Object.keys(await firstLogin.json()).sort()).toEqual(['forcedChangeRequired']);
  const forcedSessionCookies = await context.cookies();
  expect(forcedSessionCookies.map((cookie) => cookie.name)).toEqual(['symphony.sid']);
  expect(forcedSessionCookies[0]).toMatchObject({ httpOnly: true, secure: false, sameSite: 'Lax', path: '/' });
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  const forcedChangeA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(forcedChangeA11y.violations, 'forced password-change accessibility violations').toEqual([]);

  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Current temporary credential').fill(getTemporaryPassword());
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(`${newPassword} mismatch`);
  await page.getByLabel('Confirm new password').press('Enter');
  await expect(page.getByRole('alert')).toContainText('The new passwords do not match.');
  await page.getByLabel('Confirm new password').fill(newPassword);
  const changeResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/auth/change-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  expect((await changeResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  const afterChangeCookies = await context.cookies();
  expect(afterChangeCookies.some((cookie) => cookie.name === 'symphony.sid')).toBe(false);

  await page.getByRole('button', { name: 'Return to sign in' }).click();
  await signIn(page, getTemporaryPassword());
  await expect(page.getByRole('alert')).toContainText('Sign in failed. Please check your credentials and try again.');

  await signIn(page, newPassword);
  await page.waitForURL(/\/workspace(?:\/.*)?$/);
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'symphony.sid');
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.secure).toBe(false); // Explicit test profile; production adds Secure.
  await page.reload();
  await page.waitForURL(/\/workspace(?:\/.*)?$/);

  const event = await admin.query<{ method: string; result: string; device_id: string }>(
    'SELECT method,result,device_id FROM symphony.authentication_events WHERE user_id=$1 AND method=$2 ORDER BY occurred_at DESC LIMIT 1',
    [userId, 'first_login'],
  );
  expect(event.rows[0]).toMatchObject({ method: 'first_login', result: 'success', device_id: expect.any(String) });
  expect(JSON.stringify(event.rows)).not.toContain(getTemporaryPassword());
  expect(JSON.stringify(event.rows)).not.toContain(newPassword);
  assertSecretsAbsentFromCapturedApiLog(getTemporaryPassword(), newPassword);
});

test('unknown accounts show a non-enumerating failure through the real API', async ({ page }) => {
  const unknownUser = randomUUID();
  const unknownPassword = `Unknown ${randomUUID()} credential`;
  await page.goto('/login');
  await page.getByLabel('Email or user ID').fill(unknownUser);
  await page.getByLabel('Password').fill(unknownPassword);
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/auth/login' && response.request().method() === 'POST');
  await page.getByLabel('Password').press('Enter');
  const response = await responsePromise;
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain(unknownPassword);
  await expect(page.getByRole('alert')).toContainText('Sign in failed. Please check your credentials and try again.');
  await expect(page).toHaveURL(/\/login$/);
  assertSecretsAbsentFromCapturedApiLog(unknownPassword);
});
