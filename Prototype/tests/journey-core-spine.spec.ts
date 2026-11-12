import { test, expect, Page } from '@playwright/test';

test.describe('Evidence Provenance Happy Path Slice — Core Spine (R1–R6)', () => {
  test.describe.serial('Spine Happy Path Journey', () => {
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
    });

    test.afterAll(async () => {
      await page.close();
    });

    test('spine_1_open_chisamba_claim: Coop screen shows livestock count claim with scope and supported badge', async () => {
      await page.goto('/');

      // Launch Create Account wizard to inspect claims
      await page.getByTestId('link-create-account').click();
      await expect(page.getByTestId('create-account-journey')).toBeVisible();

      // Advance to Step 7 (Claims table)
      await page.getByTestId('coop-step-1-continue').click();
      await page.getByTestId('coop-step-2-continue').click();
      await page.getByTestId('coop-step-3-continue').click();
      await page.getByTestId('coop-step-4-continue').click();
      await page.getByTestId('coop-step-5-continue').click();
      await page.getByTestId('coop-step-6-continue').click();

      await expect(page.getByTestId('coop-claims-step')).toBeVisible();

      // Verify livestock count claim row with supported badge
      const lcRow = page.getByTestId('claim-row-livestock_count');
      await expect(lcRow).toBeVisible();
      await expect(lcRow).toContainText('supported');
      await expect(page.getByTestId('inspect-provenance-livestock_count')).toBeVisible();
    });

    test('spine_2_inspect_provenance_drawer: Drawer opens; three tabs visible; demo-actor label present; Integrity shows Not checked', async () => {
      // Click "Inspect provenance" for livestock_count
      await page.getByTestId('inspect-provenance-livestock_count').click();
      const drawer = page.getByTestId('provenance-drawer');
      await expect(drawer).toBeVisible();

      // 3 tabs visible
      await expect(page.getByTestId('tab-summary')).toBeVisible();
      await expect(page.getByTestId('tab-history')).toBeVisible();
      await expect(page.getByTestId('tab-integrity')).toBeVisible();

      // Demo-actor label present
      await expect(drawer.getByText(/fa\.banda|Gift Mulenga/i)).toBeVisible();
      await expect(drawer.getByText(/simulated, not authenticated/i)).toBeVisible();

      // Integrity tab shows "Not checked"
      await page.getByTestId('tab-integrity').click();
      await expect(page.getByTestId('integrity-status-display')).toContainText('Not checked');

      // Run local check: without stored fingerprint, displays Not comparable and disclaimer
      await page.getByTestId('run-integrity-check-btn').click();
      await expect(page.getByTestId('integrity-status-display')).toContainText('Not comparable');
      await expect(page.getByTestId('integrity-check-message')).toContainText('No reference fingerprint stored');
      await expect(page.getByTestId('integrity-disclaimer')).toBeVisible();

      // Close drawer and exit to login
      await page.getByTestId('close-provenance-drawer').click();
      await expect(drawer).not.toBeVisible();
      await page.getByTestId('coop-claims-save-exit').click();
      await expect(page.getByTestId('login-screen')).toBeVisible();
    });

    test('spine_3_request_verification: PFI user clicks request; confirmation shows Request recorded — not a verification result', async () => {
      // Sign in as PFI Credit Officer
      await page.getByTestId('role-btn-pfi_credit').click();
      await expect(page.getByTestId('pfi-discovery-step')).toBeVisible();

      // Go to Step 3: Query or verify
      await page.getByText('3. Query or verify').click();
      await expect(page.getByTestId('pfi-verify-step')).toBeVisible();

      // Dispatch verification
      await page.getByTestId('assign-verification-btn').click();

      // Confirmation shows Request recorded — not a verification result
      await expect(page.getByText(/Request recorded — not a verification result/i)).toBeVisible();
      await page.getByTestId('change-confirmation-close-btn').click();

      // Inline confirmation notice also rendered
      await expect(page.getByTestId('request-confirmation-inline')).toBeVisible();

      // Exit back to login
      await page.getByTestId('journey-exit-demo').click();
      await expect(page.getByTestId('login-screen')).toBeVisible();
    });

    test('spine_4_record_finding: VVB workbench shows correct assignment and version; finding submitted; evidence level remains supported', async () => {
      // Login as Independent Verifier
      await page.getByTestId('role-btn-verifier').click();
      await expect(page.getByTestId('vvb-step-queue')).toBeVisible();

      // Open livestock count assignment in queue
      await expect(page.getByTestId('assignment-row-livestock_count')).toBeVisible();
      await page.getByTestId('assignment-row-livestock_count').click();

      await expect(page.getByTestId('vvb-step-workbench')).toBeVisible();
      await expect(page.getByText('livestock_count')).toBeVisible();

      // Fill form fields
      await page.getByTestId('finding-result-select').selectOption('verified_conformant');
      await page.getByTestId('finding-scope-input').fill('Count of 500 head across three categories confirmed by physical muster.');
      await page.getByTestId('finding-limitation-input').fill('Count only. Encumbrance and valuation not established by this finding.');

      // Submit finding
      await page.getByTestId('finding-submit-btn').click();
      await expect(page.getByTestId('finding-success')).toBeVisible();
      await expect(page.getByText('Evidence level has NOT changed. A separate promotion step is required.')).toBeVisible();

      // Inspect provenance: level remains supported
      await page.getByTestId('vvb-inspect-provenance-btn').click();
      await expect(page.getByTestId('provenance-level-badge')).toHaveText('supported');
      await page.getByTestId('close-provenance-drawer').click();
    });

    test('spine_5_explicit_promotion: Promote button clicked; evidence level becomes verified; drawer History shows two events', async () => {
      // Click confirm promotion on the open workbench
      await expect(page.getByTestId('confirm-promotion-btn')).toBeVisible();
      await page.getByTestId('confirm-promotion-btn').click();

      await expect(page.getByTestId('promotion-success')).toBeVisible();
      await expect(page.getByText('Promoted to Verified.')).toBeVisible();

      // Open provenance drawer
      await page.getByTestId('vvb-inspect-provenance-btn').click();
      await expect(page.getByTestId('provenance-level-badge')).toHaveText('verified');

      // Switch to History tab: shows both finding and promotion events
      await page.getByTestId('tab-history').click();
      await expect(page.getByTestId('history-entry-record_verification_finding')).toBeVisible();
      await expect(page.getByTestId('history-entry-promote_evidence_level')).toBeVisible();
      await page.getByTestId('close-provenance-drawer').click();

      // Exit back to login
      await page.getByTestId('journey-exit-demo').click();
      await expect(page.getByTestId('login-screen')).toBeVisible();
    });

    test('spine_6_pfi_readiness_updated: PFI readiness view shows livestock_count requirement as satisfied', async () => {
      // Sign in as PFI Credit Officer
      await page.getByTestId('role-btn-pfi_credit').click();
      await expect(page.getByTestId('pfi-discovery-step')).toBeVisible();

      // Inspect Chisamba
      await page.getByTestId('pfi-step-inspect').click();
      await expect(page.getByTestId('pfi-inspect-step')).toBeVisible();

      // Livestock count requirement is now satisfied — chip label is 'Met', gap column shows 'None'
      await expect(page.getByText('Livestock count verified')).toBeVisible();
      const reqRow = page.locator('.ev-row:has-text("Livestock count verified")');
      await expect(reqRow).toBeVisible();
      // requirementChip('satisfied') returns label:'Met'; gap column renders 'None' for satisfied rows
      await expect(reqRow).toContainText('Met');
      await expect(reqRow).toContainText('None');
    });

    test('spine_7_refresh_restores_state: page.reload() preserves verified state without re-running steps', async () => {
      // Reload page
      await page.reload();

      // Re-enter PFI view if on login screen
      if (await page.getByTestId('role-btn-pfi_credit').isVisible()) {
        await page.getByTestId('role-btn-pfi_credit').click();
        await page.getByTestId('pfi-step-inspect').click();
      }

      // State is restored from persistent storage
      await expect(page.locator('.ev-row:has-text("Livestock count verified")')).toContainText('satisfied');
    });

    test('spine_8_reset_restores_seed: Reset button clicked restores livestock_count back to supported and clears event log', async () => {
      // Click reset demo in header
      await page.getByTestId('reset-demo').click();

      // Reset notification banner shown on login
      await expect(page.getByTestId('reset-banner')).toBeVisible();

      // Re-enter PFI Inspect view
      await page.getByTestId('role-btn-pfi_credit').click();
      await page.getByTestId('pfi-step-inspect').click();

      // Livestock count requirement is back to unresolved (needs verified; has supported)
      const reqRow = page.locator('.ev-row:has-text("Livestock count verified")');
      await expect(reqRow).toContainText('unresolved');
    });

    test('spine_9_replay_works: Re-running steps 3-5 from reset baseline succeeds identically', async () => {
      // 1. PFI dispatches verification
      await page.getByText('3. Query or verify').click();
      await page.getByTestId('assign-verification-btn').click();
      await page.getByTestId('change-confirmation-close-btn').click();

      // 2. Verifier records finding and promotes
      await page.getByTestId('journey-exit-demo').click();
      await page.getByTestId('role-btn-verifier').click();
      await page.getByTestId('assignment-row-livestock_count').click();

      await page.getByTestId('finding-result-select').selectOption('verified_conformant');
      await page.getByTestId('finding-scope-input').fill('Replay test muster scope.');
      await page.getByTestId('finding-limitation-input').fill('Replay test limitation.');
      await page.getByTestId('finding-submit-btn').click();

      await page.getByTestId('confirm-promotion-btn').click();
      await expect(page.getByTestId('promotion-success')).toBeVisible();

      // 3. PFI inspect view shows satisfied again
      await page.getByTestId('journey-exit-demo').click();
      await page.getByTestId('role-btn-pfi_credit').click();
      await page.getByTestId('pfi-step-inspect').click();
      await expect(page.locator('.ev-row:has-text("Livestock count verified")')).toContainText('satisfied');
    });
  });

  // Negative-Case Tests (10 - 14)
  test.describe('Negative Cases', () => {
    test('neg_promote_without_finding: promote dispatched with no finding returns PROMOTE_NO_QUALIFYING_FINDING', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('role-btn-verifier').click();

      const result = await page.evaluate(() => {
        const runner = (window as any).__SYMPHONY_RUN_ACTION__;
        return runner({
          type: 'promote_evidence_level',
          evidence_type: 'livestock_count',
          finding_id: 'non-existent-finding-id',
        });
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('PROMOTE_NO_QUALIFYING_FINDING');
    });

    test('neg_promote_wrong_version: finding on version 1 cannot promote version 2', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('role-btn-verifier').click();

      const result = await page.evaluate(() => {
        const cases = (window as any).__SYMPHONY_CASES__;
        const c = cases[0];
        c.evidence.livestock_count.version_id = 2;
        c.verification.findings.push({
          id: 'fnd-v1-test',
          assignment_id: 'asg-test',
          verifier: 'vrf.mulenga',
          at: '2026-10-16',
          result: 'verified_conformant',
          scope: 'Test',
          basis: ['Test'],
          version_id: 1,
        });

        const runner = (window as any).__SYMPHONY_RUN_ACTION__;
        return runner({
          type: 'promote_evidence_level',
          evidence_type: 'livestock_count',
          finding_id: 'fnd-v1-test',
        });
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('PROMOTE_VERSION_MISMATCH');
    });

    test('neg_duplicate_assignment: second request for same version returns DUPLICATE_ASSIGNMENT', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('role-btn-pfi_credit').click();

      // Call assign_verification with guard_duplicate twice
      const firstRes = await page.evaluate(() => {
        const runner = (window as any).__SYMPHONY_RUN_ACTION__;
        return runner({
          type: 'assign_verification',
          target: { kind: 'evidence', ref: 'livestock_count', version_id: 1 },
          assigned_to: 'vrf.mulenga',
          scope: 'First assignment',
          guard_duplicate: true,
        });
      });
      expect(firstRes.ok).toBe(true);

      const secondRes = await page.evaluate(() => {
        const runner = (window as any).__SYMPHONY_RUN_ACTION__;
        return runner({
          type: 'assign_verification',
          target: { kind: 'evidence', ref: 'livestock_count', version_id: 1 },
          assigned_to: 'vrf.mulenga',
          scope: 'Duplicate assignment',
          guard_duplicate: true,
        });
      });
      expect(secondRes.ok).toBe(false);
      expect(secondRes.error).toBe('DUPLICATE_ASSIGNMENT');
    });

    test('neg_failed_write_no_update: failed localStorage write shows save error banner without corrupting state', async ({ page }) => {
      await page.goto('/');

      // Mock localStorage.setItem to throw QuotaExceededError
      await page.evaluate(() => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key: string, value: string) {
          if (key.includes('symphony.case.v2')) {
            throw new Error('QuotaExceededError');
          }
          return orig.call(this, key, value);
        };
      });

      // Sign in as PFI Credit Officer and perform an action
      await page.getByTestId('role-btn-pfi_credit').click();
      await page.getByText('3. Query or verify').click();
      await page.getByTestId('assign-verification-btn').click();

      // Verify save error banner is visible
      await expect(page.getByTestId('save-error-banner')).toBeVisible();
      await expect(page.getByText(/Not saved — last accepted state retained/i)).toBeVisible();
    });

    test('neg_corrupt_envelope_recovery: corrupt localStorage key is cleared and reset banner shown', async ({ page }) => {
      await page.goto('/');

      // Write corrupted string to localStorage
      await page.evaluate(() => {
        localStorage.setItem('symphony.case.v2', 'corrupted-data-not-json');
      });

      // Reload page
      await page.reload();

      // Recovery storage notice banner is displayed and baseline loaded
      await expect(page.getByTestId('storage-notice-banner')).toBeVisible();
      await expect(page.getByText(/Stored state was inconsistent and has been cleared/i)).toBeVisible();

      // Verify localStorage key was cleared
      const val = await page.evaluate(() => localStorage.getItem('symphony.case.v2'));
      expect(val).toBeNull();
    });
  });
});
