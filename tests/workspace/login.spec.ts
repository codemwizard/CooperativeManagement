/**
 * tests/workspace/login.spec.ts
 *
 * Playwright tests for the /login route.
 * WP-1.9.5
 *
 * Tests:
 *  - validCredentials_redirectsToWorkspace
 *  - invalidCredentials_showsErrorMessage
 *  - temporaryCredential_promptsPasswordChange
 */

import { test, expect } from '@playwright/test';

/** The workspace dev server runs on port 5174 under tools/run_e2e.mjs. */
const BASE = 'http://127.0.0.1:5174';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    // These legacy UI-flow tests mock authentication responses and do not start
    // the API server. Keep the page's initial session check and CSRF bootstrap
    // inside that same mocked boundary so Vite never proxies them to port 3000.
    await page.route('**/auth/session', async (route) => route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'UNAUTHENTICATED' }),
    }));
    await page.route('**/auth/csrf', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'test-csrf-token-1234567890123456' }),
    }));
  });

  test('validCredentials_redirectsToWorkspace', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/Symphony/);

    await page.fill('#email', 'secretary@sunrise.coop');
    await page.fill('#password', 'SecurePass1!');
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forcedChangeRequired: false }),
      });
    });
    await page.click('button[type="submit"]');

    // Should redirect to /workspace after successful login
    await expect(page).toHaveURL(/\/workspace/);
  });

  test('invalidCredentials_showsErrorMessage', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await page.fill('#email', 'nobody@sunrise.coop');
    await page.fill('#password', 'wrongpassword');
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'AUTHENTICATION_FAILED' }),
      });
    });
    await page.click('button[type="submit"]');

    // Error message should be visible
    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Sign in failed. Please check your credentials and try again.');

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('temporaryCredential_promptsPasswordChange', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await page.fill('#email', 'newuser@sunrise.coop');
    await page.fill('#password', 'TempPass123!');
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forcedChangeRequired: true }),
      });
    });
    await page.click('button[type="submit"]');

    // Should show the password change prompt
    await expect(page.locator('h1')).toContainText('Change your password');
    await expect(page.getByText('Your account uses a temporary credential. Set a new password before continuing.')).toBeVisible();
  });
});

