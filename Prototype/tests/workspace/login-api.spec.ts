import { expect, test } from '@playwright/test';

test('login submits the shared request contract to a running API without route interception', async ({ page }) => {
  let requestShape: string[] | undefined;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname !== '/auth/login' || request.method() !== 'POST') return;
    const body = request.postDataJSON() as Record<string, unknown>;
    requestShape = Object.keys(body).sort();
  });

  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/auth/login' && response.request().method() === 'POST');
  await page.goto('/login');
  await page.getByLabel(/email or user id/i).fill('phase1-contract-user');
  await page.getByLabel('Password').fill('invalid-test-credential');
  await page.getByRole('button', { name: /sign in/i }).click();

  const response = await responsePromise;
  expect(requestShape).toEqual(['credential', 'deviceId', 'userId']);
  expect(response.headers()['content-type']).toContain('application/json');
  expect([400, 401]).toContain(response.status());
  const body = await response.json() as Record<string, unknown>;
  expect(typeof body.code).toBe('string');
  expect(JSON.stringify(body)).not.toContain('invalid-test-credential');
  await expect(page).toHaveURL(/\/login$/);
});
