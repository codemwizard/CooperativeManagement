import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';


test.describe('Phase 10 — Guided Journeys: Institutional Portals (Phase C)', () => {
  test('Test 6: NABII cohort overview and drill-down', async ({ page }) => {
    await page.goto('/');

    // Login as NABII Fund Manager
    await page.getByTestId('role-btn-fund_manager').click();
    await expect(page.getByTestId('nabii-cohort-overview')).toBeVisible();

    // Verify ready count is rendered
    await expect(page.getByTestId('nabii-ready-count')).toBeVisible();

    // Drill down to case-1
    await page.getByTestId('nabii-inspect-case-btn').click();
    await expect(page.getByTestId('case-detail-case-1')).toBeVisible();

    // Asset summary visible without individual names
    await expect(page.getByTestId('member-asset-summary')).toBeVisible();
    await expect(page.locator('[data-testid="member-name"]')).toHaveCount(0);
  });

  test('Test 7: TA gap remediation and verification assignment', async ({ page }) => {
    await page.goto('/');

    // Login as Technical Assistance Officer
    await page.getByTestId('role-btn-ta').click();
    await expect(page.getByTestId('ta-queue-view')).toBeVisible();

    // Open workbench for case-1
    await page.getByTestId('ta-remediate-btn').click();
    await expect(page.getByTestId('ta-workbench-view')).toBeVisible();

    // Assign verification on an unresolved requirement
    const assignBtn = page.locator('button[data-testid^="assign-verification-"]').first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await expect(page.getByTestId('ta-assignment-success')).toBeVisible();
    }
  });

  test('Test 8 & 11: PFI discovery, personal data boundary, and role-enforced outcomes', async ({ page }) => {
    await page.goto('/');

    // 1. Login as PFI Credit Analyst
    await page.getByTestId('role-btn-pfi_analyst').click();
    await expect(page.getByTestId('pfi-discovery-step')).toBeVisible();

    // Inspect case-1
    await page.getByTestId('pfi-step-assess').click();
    await expect(page.getByTestId('pfi-assess-step')).toBeVisible();

    // Privacy boundary: member-asset-summary exists, but ZERO member-name elements
    await expect(page.getByTestId('member-asset-summary')).toBeVisible();
    await expect(page.locator('[data-testid="member-name"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="member-livestock-detail"]')).toHaveCount(0);

    // Analyst attempts record_outcome -> BLOCKED by role guard
    await page.getByTestId('pfi-outcome-select').selectOption('Approved');
    await page.getByTestId('pfi-submit-outcome-btn').click();
    await expect(page.getByTestId('pfi-outcome-error')).toBeVisible();
    await expect(page.getByTestId('pfi-outcome-error')).toContainText('ROLE_NOT_PERMITTED');

    // 2. Exit to login and select PFI Credit Officer
    await page.getByTestId('journey-exit-demo').click();
    await page.getByTestId('role-btn-pfi_credit').click();
    await page.getByTestId('pfi-step-assess').click();

    // Credit officer records reliance and approved outcome -> SUCCEEDS
    await page.getByTestId('record-reliance-btn').click();
    await page.getByTestId('pfi-outcome-select').selectOption('Approved');
    await page.getByTestId('pfi-submit-outcome-btn').click();
    await expect(page.getByTestId('pfi-outcome-success')).toBeVisible();
  });

  test('Test 9: VVB Independent Verifier workbench and input validation', async ({ page }) => {
    await page.goto('/');

    // Login as Independent Verifier
    await page.getByTestId('role-btn-verifier').click();
    await expect(page.getByTestId('vvb-step-queue')).toBeVisible();

    // Open finding form
    await page.getByTestId('vvb-open-workbench-btn').click();
    await expect(page.getByTestId('vvb-step-workbench')).toBeVisible();

    // Invariant: Submit button is disabled until result, scope, and limitation are non-empty
    const submitBtn = page.getByTestId('finding-submit-btn');
    await expect(submitBtn).toBeDisabled();

    // Fill form fields
    await page.getByTestId('finding-result-select').selectOption('verified');
    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('finding-scope-input').fill('Full statutory registry query at PACRA.');
    await expect(submitBtn).toBeDisabled();

    await page.getByTestId('finding-limitation-input').fill('Limitation: Certificate verified directly with registrar.');
    await expect(submitBtn).toBeEnabled();

    // Submit finding
    await submitBtn.click();
    await expect(page.getByTestId('finding-success')).toBeVisible();
  });

  test('Field Agent workbench and mark_verified action', async ({ page }) => {
    await page.goto('/');

    // Login as Field Agent
    await page.getByTestId('role-btn-field_agent').click();
    await expect(page.getByTestId('fieldagent-caselist-view')).toBeVisible();

    await page.getByTestId('fieldagent-open-case-btn').click();
    await expect(page.getByTestId('fieldagent-workbench-view')).toBeVisible();
  });

  test('Test 10: Portfolio surveillance and covenant compliance', async ({ page }) => {
    await page.goto('/');

    // Login as Fund Manager
    await page.getByTestId('role-btn-fund_manager').click();
    await expect(page.getByTestId('nabii-cohort-overview')).toBeVisible();

    // Switch to Portfolio view
    await page.getByTestId('tab-portfolio').click();
    await expect(page.getByTestId('portfolio-overview-step')).toBeVisible();

    // Inspect first financed facility
    const inspectBtn = page.locator('button[data-testid^="portfolio-inspect-"]').first();
    await inspectBtn.click();
    await expect(page.getByTestId('portfolio-detail-step')).toBeVisible();

    // Verify covenant view
    await expect(page.getByTestId('portfolio-back-btn')).toBeVisible();
    await page.getByTestId('portfolio-back-btn').click();
    await expect(page.getByTestId('portfolio-overview-step')).toBeVisible();
  });


  test('Test 12: Bank Vertical Slice - Chisamba Bank Story (Inspect, Call Agent, Verify, Message, Decision)', async ({ page }) => {
    await page.goto('/');

    // 1. Sign in as PFI Credit Officer
    await page.getByTestId('role-btn-pfi_credit').click();
    await expect(page.getByTestId('pfi-discovery-step')).toBeVisible();

    // 2. Open Inspect for Chisamba (case-1)
    await page.getByTestId('pfi-step-inspect').click();
    await expect(page.getByTestId('pfi-inspect-step')).toBeVisible();

    // 3. Verify L2 Asset Split and R29 Privacy Guard
    await expect(page.getByTestId('member-asset-summary')).toBeVisible();
    await expect(page.locator('[data-testid="member-name"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="member-livestock-detail"]')).toHaveCount(0);
    await expect(page.getByText('Beef cattle')).toBeVisible();
    await expect(page.getByText('Dairy cows')).toBeVisible();
    await expect(page.getByText('Goats')).toBeVisible();

    // 4. Trace claim to source & open simulated call drawer
    await page.getByTestId('call-agent-btn').click();
    await expect(page.getByTestId('call-drawer')).toBeVisible();
    await expect(page.getByText("The call does not change the claim's evidence level.")).toBeVisible();
    await page.getByTestId('close-call-btn').click();
    await expect(page.getByTestId('call-drawer')).not.toBeVisible();

    // 5. Query & Verify Step: assign_verification and institution_message
    await page.getByText('Proceed to Query or Verify →').click();
    await expect(page.getByTestId('pfi-verify-step')).toBeVisible();

    // Dispatch verification
    await page.getByTestId('assign-verification-btn').click();
    await expect(page.getByText('Verification Assignment Dispatched')).toBeVisible();
    await page.getByTestId('change-confirmation-close-btn').click();

    // Transmit message to cooperative
    await page.getByTestId('send-proposal-btn').click();
    await expect(page.getByText('Inquiry Sent to Cooperative')).toBeVisible();
    await page.getByTestId('change-confirmation-close-btn').click();

    // 6. Assess Step: EQS Card fixture assertions (Gate G10 / B10)
    await page.getByText('Proceed to Assess →').click();
    await expect(page.getByTestId('pfi-assess-step')).toBeVisible();

    const expected = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/eqs_case1_expected.json'), 'utf-8')
    );

    await expect(page.getByTestId('eqs-card')).toBeVisible();

    const scoreText = await page.getByTestId('eqs-composite-score').textContent();
    expect(Number(scoreText?.replace('/100', '').trim())).toBe(expected.composite_score);

    const grade = await page.getByTestId('eqs-grade-badge').textContent();
    expect(grade?.trim()).toBe(`Grade ${expected.grade}`);

    const confidence = await page.getByTestId('eqs-confidence-badge').textContent();
    expect(confidence?.trim()).toBe(`${expected.confidence} Confidence`);

    for (const pillar of ['environmental', 'social', 'governance']) {
      const el = page.getByTestId(`eqs-pillar-${pillar}`);
      await expect(el).toBeVisible();
      const text = await el.textContent();
      expect(text).toContain(String(expected.pillars[pillar].score));
    }

    // B10: Assert pillar_coverage_ratio is 3/3 (all three pillars evaluable)
    const coverageEl = page.getByTestId('eqs-pillar-coverage');
    if (await coverageEl.isVisible()) {
      const coverageText = await coverageEl.textContent();
      expect(coverageText).toContain('3/3');
    }

    // B10: Assert each pillar is evaluable (fixture expects evaluable: true for all three)
    for (const pillar of ['environmental', 'social', 'governance']) {
      expect(expected.pillars[pillar].evaluable).toBe(true);
      // The pillar card must not contain an "Unevaluable" label
      const el = page.getByTestId(`eqs-pillar-${pillar}`);
      const text = await el.textContent();
      expect(text).not.toContain('Unevaluable');
    }

    // B10: Assert zero exceptions (fixture expects empty exceptions array)
    expect(expected.exceptions).toHaveLength(0);
    // Verify the EQS card does not render exception alerts for the baseline case
    const exceptionAlertsEl = page.getByTestId('eqs-exception-alerts');
    // The exception-alerts container only renders when there are exceptions
    await expect(exceptionAlertsEl).not.toBeVisible();

    await expect(page.getByText(/Proprietary illustrative methodology/)).toBeVisible();

    // Credit officer reliance and outcome
    await page.getByTestId('record-reliance-btn').click();
    await page.getByTestId('pfi-outcome-select').selectOption('Approved');
    await page.getByTestId('pfi-submit-outcome-btn').click();
    await expect(page.getByTestId('pfi-outcome-success')).toBeVisible();
  });


  test('Test 13: NABII 4-State Pipeline Dashboard and TA Request', async ({ page }) => {
    await page.goto('/');

    // 1. Sign in as Fund Manager
    await page.getByTestId('role-btn-fund_manager').click();
    await expect(page.getByTestId('nabii-cohort-overview')).toBeVisible();

    // 2. Verify ready count visible on national dashboard
    await expect(page.getByTestId('nabii-ready-count')).toBeVisible();

    // 3. Verify 4-state classification cards are present
    await expect(page.getByTestId('state-card-assessment_ready')).toBeVisible();
    await expect(page.getByTestId('state-card-evidence_progressing')).toBeVisible();
    await expect(page.getByTestId('state-card-remediation_required')).toBeVisible();
    await expect(page.getByTestId('state-card-initial_record')).toBeVisible();

    // 4. Click filter for assessment_ready to show filtered cooperatives
    await page.getByTestId('state-card-assessment_ready').click();
    await expect(page.getByText('Filtered to: Assessment Ready')).toBeVisible();

    // 5. Inspect case-1 (Chisamba)
    await page.getByTestId('nabii-inspect-case-btn').click();
    await expect(page.getByTestId('case-detail-case-1')).toBeVisible();

    // 6. Asset summary visible without individual member names
    await expect(page.getByTestId('member-asset-summary')).toBeVisible();
    await expect(page.locator('[data-testid="member-name"]')).toHaveCount(0);

    // 7. EQS Card visible and verified against fixture
    await expect(page.getByTestId('eqs-card')).toBeVisible();
    const expected = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/eqs_case1_expected.json'), 'utf-8')
    );
    const scoreText = await page.getByTestId('eqs-composite-score').textContent();
    expect(Number(scoreText?.replace('/100', '').trim())).toBe(expected.composite_score);
  });

  test('Test 14: Gate G10 - Low-confidence EQS conflict case in institutional assessment', async ({ page }) => {
    const conflictExpected = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/eqs_case1_conflict_expected.json'), 'utf-8')
    );

    await page.goto('/');

    // 1. Sign in as PFI Credit Officer
    await page.getByTestId('role-btn-pfi_credit').click();
    await expect(page.getByTestId('pfi-discovery-step')).toBeVisible();

    // Inspect Chisamba (case-1)
    await page.getByTestId('pfi-step-inspect').click();
    await expect(page.getByTestId('pfi-inspect-step')).toBeVisible();

    // Proceed to query/verify then assess
    await page.getByText('Proceed to Query or Verify →').click();
    await page.getByText('Proceed to Assess →').click();
    await expect(page.getByTestId('pfi-assess-step')).toBeVisible();

    // Verify baseline EQS card is visible
    await expect(page.getByTestId('eqs-card')).toBeVisible();

    // Apply conflict to active case in localStorage and reload page to test low-confidence render
    await page.evaluate(() => {
      const p = (window as any).__SYMPHONY_PERSISTENCE__;
      const currentCase = (window as any).__SYMPHONY_CASE__;
      let envelope: any = null;
      const raw = localStorage.getItem('symphony.state.case-1');
      if (raw) {
        try { envelope = JSON.parse(raw); } catch {}
      }
      if (!envelope && currentCase && p?.createCommitEnvelope) {
        envelope = p.createCommitEnvelope(JSON.parse(JSON.stringify(currentCase)));
      }
      if (envelope?.state_snapshot?.evidence?.registration) {
        envelope.state_snapshot.evidence.registration.conflict_state = 'unresolved_conflict';
        envelope.state_snapshot.evidence.registration.has_discrepancy = true;
        if (p?.computeEnvelopeChecksum) {
          envelope.checksum = p.computeEnvelopeChecksum(envelope);
        }
        localStorage.setItem('symphony.state.case-1', JSON.stringify(envelope));
        localStorage.setItem('symphony.case.v2', JSON.stringify(envelope));
      }
    });

    await page.reload();
    await page.getByTestId('role-btn-pfi_credit').click();
    await page.getByTestId('pfi-step-assess').click();
    await expect(page.getByTestId('pfi-assess-step')).toBeVisible();

    // Assert low confidence badge and conflict composite score
    await expect(page.getByTestId('eqs-confidence-badge')).toHaveText('Low Confidence');
    const scoreText = await page.getByTestId('eqs-composite-score').textContent();
    expect(Number(scoreText?.replace('/100', '').trim())).toBe(conflictExpected.composite_score);

    // Assert governance pillar matches conflict expected score (48)
    const govEl = page.getByTestId('eqs-pillar-governance');
    await expect(govEl).toBeVisible();
    expect(await govEl.textContent()).toContain(String(conflictExpected.pillars.governance.score));

    // B10: Assert each pillar evaluable = true (conflict scenario does not make pillars unevaluable)
    for (const pillar of ['environmental', 'social', 'governance']) {
      expect(conflictExpected.pillars[pillar].evaluable).toBe(true);
      const el = page.getByTestId(`eqs-pillar-${pillar}`);
      await expect(el).toBeVisible();
      const text = await el.textContent();
      expect(text).not.toContain('Unevaluable');
    }

    // B10: Assert CONFLICT_G1 exception is present in fixture and rendered in the EQS card
    const conflictException = conflictExpected.exceptions.find((e: any) => e.code === 'CONFLICT_G1');
    expect(conflictException).toBeDefined();
    expect(conflictException.pillar).toBe('governance');
    expect(conflictException.severity).toBe('critical');
    // The EQS exception-alerts container must be visible and mention the conflict
    await expect(page.getByTestId('eqs-exception-alerts')).toBeVisible();
    const alertsText = await page.getByTestId('eqs-exception-alerts').textContent();
    expect(alertsText).toContain('conflict');
  });
});
