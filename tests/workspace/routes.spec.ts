import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { NAV_AREAS } from '../../apps/workspace/src/shell/LeftNav.js';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
if (!adminUrl || !appUrl) throw new Error('WP6.1 route tests require both test-admin and app-role PostgreSQL URLs.');

const admin = new pg.Pool({ connectionString: adminUrl, max: 2 });
const app = new pg.Pool({ connectionString: appUrl, max: 2 });
const tenantId = randomUUID();
const userId = randomUUID();
const password = `WP6.1 route password ${randomUUID()}`;
const throttleKey = Buffer.from(process.env.AUTH_THROTTLE_HMAC_KEY!, 'base64');

test.beforeAll(async () => {
  await admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, `wp6.1-routes-${tenantId}`]);
  await admin.query(
    `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
     VALUES($1,$2,$3,$3,'active')`, [userId, tenantId, `wp61-${userId}@example.invalid`],
  );
  const lifecycle = new CredentialLifecycleService({ now: () => new Date().toISOString() });
  const passwordHash = await lifecycle.hashPermanentPassword(password);
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    await client.query(
      'INSERT INTO symphony.password_credentials(tenant_id,user_id,secret_hash) VALUES($1,$2,$3)',
      [tenantId, userId, passwordHash],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

test.afterAll(async () => {
  const accountKey = createHmac('sha256', throttleKey).update(`account:${userId.toLowerCase()}`).digest();
  const sourceKey = createHmac('sha256', throttleKey).update('trusted_source:127.0.0.1').digest();
  await admin.query('DELETE FROM symphony.auth_sessions WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.authentication_events WHERE user_id=$1', [userId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.auth_attempt_events WHERE identity_hmac=ANY($1::bytea[])', [[accountKey, sourceKey]]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.users WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]).catch(() => undefined);
  await app.end();
  await admin.end();
});

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to Symphony' })).toBeVisible();
  await page.getByLabel('Email or user ID').fill(userId);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/workspace(?:\/.*)?$/);
}

async function expectAxeClean(page: Page, route: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations, `axe violations at ${route}`).toEqual([]);
}

test('served component, login and workspace routes have titles, landmarks and keyboard route focus', async ({ page }) => {
  const visited: string[] = [];
  await page.goto('/components');
  await expect(page).toHaveTitle('Symphony Component Library — Phase 0 Scaffold');
  await expect(page.getByRole('heading', { level: 1, name: 'Symphony Component Library' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expectAxeClean(page, '/components');
  visited.push('/components');

  await page.goto('/login');
  await expect(page).toHaveTitle('Sign in | Symphony Workspace');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Symphony' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expectAxeClean(page, '/login');
  visited.push('/login');

  await signIn(page);
  await expect(page).toHaveTitle('Overview | Symphony Workspace');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expectAxeClean(page, '/workspace/overview');
  expect(NAV_AREAS.length).toBeGreaterThan(0);
  console.log(`WP6.1 route list: /components, /login, ${NAV_AREAS.map((area) => area.path).join(', ')}`);

  for (const area of NAV_AREAS) {
    await page.locator(`nav[aria-label="Primary navigation"] a[href="${area.path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${area.path.replaceAll('/', '\\/')}$`));
    const heading = page.getByRole('heading', { level: 1, name: area.label });
    await expect(heading).toBeFocused();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(`${area.label} | Symphony Workspace`);
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toMatch(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/);
    expect(visibleText).not.toMatch(/\bcompliant\b|\bapproved\b|\bVerified\b/);
    visited.push(area.path);
  }

  await page.goto('/coop/org-1/evidence?filter=open&sort=severity');
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await expect(page).toHaveURL(/\/coop\/org-1\/evidence\?filter=open&sort=severity$/);
  await page.reload();
  await expect(page).toHaveURL(/\/coop\/org-1\/evidence\?filter=open&sort=severity$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await page.locator('nav[aria-label="Primary navigation"] a[href="/coop/org-1/governance"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/coop\/org-1\/evidence\?filter=open&sort=severity$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeFocused();
  visited.push('/coop/org-1/evidence?filter=open&sort=severity');
  console.log(`WP6.1 served routes exercised: ${visited.join(', ')}`);
});

test('workspace route rejects an unauthenticated browser session', async ({ page }) => {
  await page.goto('/workspace/evidence');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Symphony' })).toBeVisible();
});

test('provenance dialog has an accessible name, contains keyboard focus and restores its trigger on Escape', async ({ page }) => {
  await signIn(page);
  const trigger = page.getByRole('button', { name: 'Provenance' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Provenance' });
  await expect(dialog).toBeVisible();
  const close = page.getByRole('button', { name: 'Close provenance drawer' });
  await expect(close).toBeFocused();
  await expectAxeClean(page, '/workspace/overview (provenance dialog open)');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
