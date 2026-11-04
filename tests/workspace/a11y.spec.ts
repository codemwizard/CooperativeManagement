/**
 * tests/workspace/a11y.spec.ts
 *
 * Accessibility regression test for the /components stub page.
 *
 * Uses @axe-core/playwright (AxeBuilder) to run axe-core accessibility checks
 * against the Phase 0 component library placeholder page.
 *
 * Run:   npx playwright test tests/workspace/a11y.spec.ts
 * Or:    npm run test:a11y
 *
 * Expected: 1 test passes, 0 axe violations.
 *
 * WP-0.9.4 verifier check: test passes on the placeholder page.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { renderComponentsPage } from '../../apps/workspace/src/components-page.js';

test.describe('/components placeholder page — a11y', () => {
  test('Phase 0 scaffold has zero axe violations', async ({ page }) => {
    // Render the HTML inline — no dev server needed in Phase 0
    const html = renderComponentsPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Run axe-core with WCAG 2.0 AA + 2.1 AA + best-practice rules
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();

    // Report violations clearly for debugging
    if (results.violations.length > 0) {
      for (const v of results.violations) {
        console.error(`axe violation [${v.impact}]: ${v.id} — ${v.description}`);
        for (const node of v.nodes) {
          console.error(`  Affected: ${node.html}`);
        }
      }
    }

    expect(results.violations).toHaveLength(0);

    // Confirm the main content landmark is present
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();

    // Confirm the page title
    await expect(page).toHaveTitle('Symphony Component Library — Phase 0 Scaffold');
  });
});
