import { expect, test, type Page } from '@playwright/test';

const COMPONENT_READY_TIMEOUT_MS = 45_000;

async function openComponents(page: Page): Promise<void> {
  // Vite may need to compile the legacy route's dependency graph on a fresh CI
  // worker. Wait for the response commit, then for the hydrated UI we exercise.
  const response = await page.goto('/components', { waitUntil: 'commit' });
  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId('tour-launcher')).toBeVisible({ timeout: COMPONENT_READY_TIMEOUT_MS });
}

test.describe('Phase 2 component shell', () => {
  test.describe.configure({ timeout: 60_000 });

  test('opens the governed requirement chain and evidence drawer in two clicks', async ({ page }) => {
    await openComponents(page);

    await page.getByTestId('state-badge-demo-verified').click();
    await expect(page.getByTestId('requirement-chain')).toBeVisible();
    await expect(page.getByTestId('chain-step-evidence')).toBeVisible();

    await page.getByTestId('open-evidence-drawer').click();
    await expect(page.getByTestId('evidence-drawer')).toBeVisible();
    await expect(page.getByText('Verified in the field. Registry not independently queried.').first()).toBeVisible();
  });

  test('renders mandatory guidance and accessible help text', async ({ page }) => {
    await openComponents(page);

    await expect(page.getByText('Illustrative products.')).toBeVisible();

    await page.getByRole('button', { name: 'More information' }).first().click();
    await expect(page.getByRole('region', { name: 'Help' })).toContainText('active but poorly evidenced cooperative');
  });

  test('tour launcher starts, advances, and exits tours from tour data', async ({ page }) => {
    await openComponents(page);

    await page.getByTestId('start-nabii-tour').click();
    await expect(page.getByTestId('tour-bubble')).toHaveAttribute('data-tour', 'nabii');
    const firstText = await page.getByTestId('tour-bubble').textContent();

    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-bubble')).not.toHaveText(firstText ?? '');

    await page.getByTestId('tour-exit').click();
    await expect(page.getByTestId('tour-launcher')).toBeVisible();
  });
});
