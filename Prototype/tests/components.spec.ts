import { expect, test } from '@playwright/test';

test.describe('Phase 2 component shell', () => {
  test('opens the governed requirement chain and evidence drawer in two clicks', async ({ page }) => {
    await page.goto('/components');

    await page.getByTestId('state-badge-demo-verified').click();
    await expect(page.getByTestId('requirement-chain')).toBeVisible();
    await expect(page.getByTestId('chain-step-evidence')).toBeVisible();

    await page.getByTestId('open-evidence-drawer').click();
    await expect(page.getByTestId('evidence-drawer')).toBeVisible();
    await expect(page.getByText('Verified in the field. Registry not independently queried.').first()).toBeVisible();
  });

  test('renders mandatory guidance and accessible help text', async ({ page }) => {
    await page.goto('/components');

    await expect(page.getByText('Illustrative products.')).toBeVisible();

    await page.getByRole('button', { name: 'More information' }).first().click();
    await expect(page.getByRole('region', { name: 'Help' })).toContainText('active but poorly evidenced cooperative');
  });

  test('tour launcher starts, advances, and exits tours from tour data', async ({ page }) => {
    await page.goto('/components');

    await page.getByTestId('start-nabii-tour').click();
    await expect(page.getByTestId('tour-bubble')).toHaveAttribute('data-tour', 'nabii');
    const firstText = await page.getByTestId('tour-bubble').textContent();

    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-bubble')).not.toHaveText(firstText ?? '');

    await page.getByTestId('tour-exit').click();
    await expect(page.getByTestId('tour-launcher')).toBeVisible();
  });
});
