import { test, expect } from '@playwright/test';

test.describe('Phase 10 — Guided Journey: Cooperative Slice (Phase B)', () => {
  test('complete 8-step cooperative transformation journey', async ({ page }) => {
    await page.goto('/');

    // 1. Login screen
    await expect(page.getByTestId('login-screen')).toBeVisible();
    await expect(page.getByTestId('reset-demo')).toBeVisible();

    // Select Cooperative Secretary
    await page.getByTestId('role-btn-secretary').click();

    // 2. Step 1: Register
    await expect(page.getByTestId('coop-step-1-register')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 1 of 8');
    await page.getByTestId('coop-step-1-continue').click();

    // 3. Step 2: Regulatory
    await expect(page.getByTestId('coop-step-2-regulatory')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 2 of 8');
    await page.getByTestId('coop-step-2-continue').click();

    // 4. Step 3: Members (Enforce prerequisite: at least 1 member enrolled)
    await expect(page.getByTestId('coop-step-3-members')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 3 of 8');
    // case-1 has enrolled members seeded; verify list is visible
    await expect(page.getByTestId('coop-roster-list')).toBeVisible();
    await expect(page.getByTestId('coop-step-3-continue')).toBeEnabled();

    // Verify livestock encumbrance defaults to "Not recorded"
    const encSelect = page.getByTestId('coop-member-encumbrance-select');
    await expect(encSelect).toHaveValue('Not recorded');

    await page.getByTestId('coop-step-3-continue').click();

    // 5. Step 4: Governance & Officers
    await expect(page.getByTestId('coop-step-4-governance')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 4 of 8');
    await expect(page.getByTestId('certificate-officers-form')).toBeVisible();
    await expect(page.getByTestId('current-officers-form')).toBeVisible();

    // Discrepancy card must be visible due to secretary ID mismatch (m-cert-002 vs mbr-002)
    await expect(page.getByTestId('governance-discrepancy-card')).toBeVisible();
    await expect(page.getByTestId('governance-discrepancy-card')).toContainText('Agnes Phiri');
    await expect(page.getByTestId('governance-discrepancy-card')).toContainText('Mary Phiri');

    // Upload minutes
    await page.getByTestId('upload-minutes-btn').click();
    await expect(page.getByTestId('upload-minutes-btn')).toContainText('Minutes Uploaded');

    await page.getByTestId('coop-step-4-continue').click();

    // 6. Step 5: History
    await expect(page.getByTestId('coop-step-5-history')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 5 of 8');
    await page.getByTestId('coop-step-5-continue').click();

    // 7. Step 6: Baseline
    await expect(page.getByTestId('coop-step-6-baseline')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 6 of 8');
    await page.getByTestId('coop-step-6-continue').click();

    // 8. Step 7: Readiness
    await expect(page.getByTestId('coop-step-7-readiness')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 7 of 8');
    // Scoped destination readiness badge
    await expect(page.getByTestId('readiness-verdict-A')).toBeVisible();
    await page.getByTestId('coop-step-7-continue').click();

    // 9. Step 8: Present
    await expect(page.getByTestId('coop-step-8-present')).toBeVisible();
    await expect(page.getByTestId('journey-step-indicator')).toContainText('Step 8 of 8');
    await page.getByTestId('coop-present-btn').click();
    await expect(page.getByTestId('presentation-success')).toBeVisible();

    // 10. Save and exit
    await page.getByTestId('coop-step-8-save-exit').click();
    await expect(page.getByTestId('login-screen')).toBeVisible();

    // Active draft banner should now be visible on login screen
    await expect(page.getByTestId('resume-draft-banner')).toBeVisible();

    // Reset demo
    await page.getByTestId('reset-demo').click();
    await expect(page.getByTestId('resume-draft-banner')).not.toBeVisible();
  });
});
