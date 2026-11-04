import { test, expect } from '@playwright/test';

test.describe('Design Changes & Journeys (SYMPHONY-DESIGN-PLAN-002)', () => {
  test('Landing Page: prominent demo sign-in banner, USSD shortcode text, 2-column layout and coop field agent', async ({ page }) => {
    await page.goto('/');

    // 1. Prominent Demo Sign-In banner
    const banner = page.getByTestId('demo-signin-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Demo Sign-In: Select a role below — no password required');

    // 2. USSD Shortcode text
    const ussd = page.getByTestId('ussd-shortcode-text');
    await expect(ussd).toBeVisible();
    await expect(ussd).toContainText('Dial *123# for members\' self-enroll directly');

    // 3. 2-Column layout
    const columns = page.getByTestId('role-columns');
    await expect(columns).toBeVisible();

    // 4. Cooperative Field Agent button in left column
    const cfaBtn = page.getByTestId('role-btn-coop_field_agent');
    await expect(cfaBtn).toBeVisible();
    await expect(cfaBtn).toContainText('Cooperative Field Agent');
  });

  test('Create Account Journey: 8-step wizard with agent identity and claims review', async ({ page }) => {
    await page.goto('/');

    // Click Create Account link
    await page.getByTestId('link-create-account').click();

    // Verify Create Account journey renders
    await expect(page.getByTestId('create-account-journey')).toBeVisible();

    // Verify Agent Identity Banner
    const agentBanner = page.getByTestId('coop-field-agent-identity');
    await expect(agentBanner).toBeVisible();
    await expect(agentBanner).toContainText('Assisted by: Cooperative Field Agent (cfa.banda)');

    // Step 1: Registration (Evidence Drawer hidden)
    await expect(page.getByTestId('coop-step-1-register')).toBeVisible();
    await expect(page.getByTestId('coop-step-1-evidence-info')).not.toBeVisible();
    await page.getByTestId('coop-step-1-continue').click();

    // Step 2: Regulatory
    await expect(page.getByTestId('coop-step-2-regulatory')).toBeVisible();
    await page.getByTestId('coop-step-2-continue').click();

    // Step 3: Members
    await expect(page.getByTestId('coop-step-3-members')).toBeVisible();
    // Advance to Step 4
    await page.getByTestId('coop-step-3-continue').click();

    // Step 4: Governance (no RoleGate for field agent in Create Account wizard)
    await expect(page.getByTestId('coop-step-4-governance')).toBeVisible();
    await page.getByTestId('coop-step-4-continue').click();

    // Step 5: History
    await expect(page.getByTestId('coop-step-5-history')).toBeVisible();
    await page.getByTestId('coop-step-5-continue').click();

    // Step 6: Baseline
    await expect(page.getByTestId('coop-step-6-baseline')).toBeVisible();
    await page.getByTestId('coop-step-6-continue').click();

    // Step 7: Claims & Evidence table
    await expect(page.getByTestId('coop-claims-step')).toBeVisible();
    await page.getByTestId('coop-claims-submit').click();

    // Step 8: Registration Submitted Exit screen
    await expect(page.getByTestId('create-account-exit-step')).toBeVisible();
    await expect(page.getByTestId('create-account-exit-step')).toContainText('Registration submitted. A Technical Assistance Officer will schedule verification.');

    // Exit back to Sign-In
    await page.getByTestId('create-account-exit-btn').click();
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('Cooperative Member Journey: View-only profile, self-enrolment, pending notice, and loan proposals', async ({ page }) => {
    await page.goto('/');

    // Select Cooperative Member
    await page.getByTestId('role-btn-member').click();

    // Step 1: View-only Profile & Registration
    await expect(page.getByTestId('coop-step-1-register')).toBeVisible();
    await expect(page.getByTestId('view-only-badge')).toBeVisible();
    await expect(page.getByTestId('coop-step-1-name')).toBeDisabled();
    await page.getByTestId('coop-step-1-continue').click();

    // Step 2: Member Self-Enrolment (4-block form)
    await expect(page.getByTestId('coop-step-3-members')).toBeVisible();
    // Role selector is hidden for member self-enrol
    await expect(page.getByTestId('coop-member-select-role')).not.toBeVisible();
    await expect(page.getByTestId('coop-member-add-btn')).toContainText('Save My Information');

    // Fill own member details
    await page.getByTestId('coop-member-input-name').fill('Grace Musonda');
    await page.getByTestId('coop-member-add-btn').click();

    // Verify self-enrol pending notice appears
    const notice = page.getByTestId('self-enrol-pending-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Your information has been submitted for review. A Field Agent will assess and approve your record.');

    // Continue to Step 3: Loan Proposals
    await page.getByTestId('coop-step-3-continue').click();

    // Step 3: Loan Proposals
    await expect(page.getByTestId('member-loan-proposals-step')).toBeVisible();
    await expect(page.getByTestId('loan-card-prop-001')).toBeVisible();

    // Approve loan prop-001
    await page.getByTestId('member-approve-loan-prop-001').click();
    await expect(page.getByTestId('loan-status-prop-001')).toContainText('Approved ✓');

    // Exit to login
    await page.getByTestId('member-loans-save-exit').click();
    await expect(page.getByTestId('login-screen')).toBeVisible();
  });

  test('Cooperative Field Agent: routes to Cooperative Journey and blocked by RoleGate on Step 4', async ({ page }) => {
    await page.goto('/');

    // Select Cooperative Field Agent
    await page.getByTestId('role-btn-coop_field_agent').click();

    // Step 1: Register (shows evidence drawer unlike Create Account)
    await expect(page.getByTestId('coop-step-1-register')).toBeVisible();
    await expect(page.getByTestId('coop-step-1-evidence-info')).toBeVisible();
    await page.getByTestId('coop-step-1-continue').click();

    // Step 2: Regulatory
    await expect(page.getByTestId('coop-step-2-regulatory')).toBeVisible();
    await page.getByTestId('coop-step-2-continue').click();

    // Step 3: Members (roster list has provenance badges)
    await expect(page.getByTestId('coop-step-3-members')).toBeVisible();
    await expect(page.getByTestId('coop-roster-list')).toBeVisible();
    await page.getByTestId('coop-step-3-continue').click();

    // Step 4: RoleGate blocks coop_field_agent
    await expect(page.getByTestId('role-gate-blocked')).toBeVisible();
    await expect(page.getByTestId('role-gate-blocked')).toContainText('Access Restricted');
  });
});
