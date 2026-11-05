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

/** The workspace dev server runs on port 5174 */
const BASE = 'http://127.0.0.1:5174';

test.describe('Login page', () => {
  test('validCredentials_redirectsToWorkspace', async ({ page }) => {
    // Intercept the login API call and return success
    await page.route('**/auth/login', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, requiresPasswordChange: false }),
      });
    });

    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/Symphony/);

    await page.fill('#email', 'secretary@sunrise.coop');
    await page.fill('#password', 'SecurePass1!');
    await page.click('button[type="submit"]');

    // Should redirect to /workspace after successful login
    await expect(page).toHaveURL(/\/workspace/);
  });

  test('invalidCredentials_showsErrorMessage', async ({ page }) => {
    // Intercept the login API call and return 401
    await page.route('**/auth/login', (route) => {
      void route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, detail: 'Invalid credentials' }),
      });
    });

    await page.goto(`${BASE}/login`);

    await page.fill('#email', 'nobody@sunrise.coop');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message should be visible
    const errorEl = page.locator('[data-testid="login-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText('Invalid credentials');

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('temporaryCredential_promptsPasswordChange', async ({ page }) => {
    // Intercept and return success with requiresPasswordChange=true
    await page.route('**/auth/login', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, requiresPasswordChange: true }),
      });
    });

    await page.goto(`${BASE}/login`);

    await page.fill('#email', 'newuser@sunrise.coop');
    await page.fill('#password', 'TempPass123!');
    await page.click('button[type="submit"]');

    // Should show the password change prompt
    await expect(page.locator('h1')).toContainText('Change your password');
    await expect(page.locator('text=temporary credential')).toBeVisible();
  });
});

