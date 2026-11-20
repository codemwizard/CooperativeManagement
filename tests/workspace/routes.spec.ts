import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupWp6_1Fixture, officeActors, organizationId, password, seedWp6_1Fixture, userId } from '../../packages/testkit/src/step-definitions/wp6.1-fixture.js';

test.beforeAll(seedWp6_1Fixture);
test.afterAll(cleanupWp6_1Fixture);
async function signIn(page: Page, accountId = userId, accountPassword = password): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to Symphony' })).toBeVisible();
  await page.getByLabel('Email or user ID').fill(accountId);
  await page.getByLabel('Password').fill(accountPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/workspace(?:\/.*)?$/);
}

async function expectAxeClean(page: Page, route: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations, `axe violations at ${route}`).toEqual([]);
}

test('served component, login and workspace routes have titles, landmarks and keyboard route focus', async ({ page }) => {
  test.setTimeout(90_000);
  const visited: string[] = [];
  await page.goto('/components');
  await expect(page).toHaveTitle('Symphony Component Library — Phase 0 Scaffold');
  await expect(page.getByRole('heading', { level: 1, name: 'Symphony Component Library' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expectAxeClean(page, '/components');
  visited.push('/components');

  await page.goto('/login');
  await expect(page).toHaveTitle('Sign in | Symphony Workspace');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Symphony' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expectAxeClean(page, '/login');
  visited.push('/login');

  await signIn(page);
  await expect(page).toHaveTitle('Overview | Symphony Workspace');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expectAxeClean(page, '/workspace/overview');
  const workflowRoutes = [
    { label: 'Cooperative member', items: ['Overview', 'My activities', 'My household'] },
    { label: 'Secretary', items: ['Overview', 'Identity', 'By-laws and requirements', 'Governance', 'Meetings and resolutions', 'Evidence register', 'Findings and next actions'] },
    { label: 'Internal verifier', items: ['Overview', 'Evidence register', 'Verification queue', 'Findings and next actions'] },
    { label: 'Programme manager', items: ['Pipeline', 'Cohort', 'Directory', 'Legal catalogue review', 'Delegations'] },
    { label: 'Union TA', items: ['Cohort', 'Capability gaps'] },
    { label: 'Self-enroller', items: ['Certificate details', 'Create officer accounts', 'Hand over'] },
  ];
  const contextSelect = page.getByLabel('Current workflow', { exact: true });
  const contextOptions = await contextSelect.locator('option').evaluateAll((options) => options.map((option) => ({
    label: option.textContent ?? '',
    value: (option as HTMLOptionElement).value,
  })));
  console.log(`WP6.1 route list: /components, /login, six API-resolved workflow contexts plus three separately persisted officeholder contexts`);

  for (const workflow of workflowRoutes) {
    const contextOption = contextOptions.find((option) => option.label.startsWith(workflow.label));
    expect(contextOption, `API did not resolve ${workflow.label} workflow context`).toBeTruthy();
    await contextSelect.selectOption(contextOption!.value);
    for (const label of workflow.items) {
      const link = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: new RegExp(`^${label}`) });
      await link.click();
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`${href!.replaceAll('/', '\\/')}$`));
      const heading = page.getByRole('heading', { level: 1, name: label });
    await expect(heading).toBeFocused();
    await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(`${label} | Symphony Workspace`);
      if (workflow.label === 'Secretary' && label === 'Evidence register') {
        await page.getByText('Cooperative-verified (internal)', { exact: true }).click();
        await expect(page.getByText(/Example Cooperative Secretary/)).toBeVisible();
        await expect(page.getByText('Financial statement completeness', { exact: true })).toBeVisible();
        await expect(page.getByText('cooperative-internal', { exact: true })).toBeVisible();
      }
      const visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toMatch(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/);
      // D-18 explicitly permits this qualified chip and its attribution label;
      // broad scans must not reject those approved phrases as generic claims.
      expect(visibleText).not.toMatch(/\bcompliant\b|\bapproved\b/);
      visited.push(href!);
    }
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link')).toHaveCount(workflow.items.length);
  }

  const officeWorkflows = [
    { persona: 'Chairperson', items: ['Overview', 'Governance', 'Meetings and resolutions', 'By-laws and requirements', 'Evidence register', 'Findings and next actions'] },
    { persona: 'Vice-Chairperson', items: ['Overview', 'Governance', 'Meetings and resolutions', 'By-laws and requirements', 'Evidence register', 'Findings and next actions'] },
    { persona: 'Treasurer', items: ['Overview', 'Financial records', 'Meetings and resolutions', 'Evidence register', 'Findings and next actions'] },
  ];
  for (const actor of officeActors) {
    await page.context().clearCookies();
    await signIn(page, actor.userId, actor.password);
    const officeWorkflow = officeWorkflows.find((workflow) => workflow.persona === actor.persona)!;
    const officeContext = page.getByLabel('Current workflow', { exact: true });
    await expect(officeContext.locator('option')).toHaveCount(2);
    const officeOptions = await officeContext.locator('option').evaluateAll((options) => options.map((option) => ({
      label: option.textContent ?? '',
      value: (option as HTMLOptionElement).value,
    })));
    const actorOption = officeOptions.find((option) => option.label.startsWith(actor.persona));
    expect(actorOption, `API did not resolve ${actor.persona} workflow context`).toBeTruthy();
    await officeContext.selectOption(actorOption!.value);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link')).toHaveCount(officeWorkflow.items.length);
    for (const label of officeWorkflow.items) {
      const link = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: new RegExp(`^${label}`) });
      await link.click();
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`${href!.replaceAll('/', '\\/')}$`));
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeFocused();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(`${label} | Symphony Workspace`);
      const visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toMatch(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/);
      expect(visibleText).not.toMatch(/\bcompliant\b|\bapproved\b|\bVerified\b/);
      visited.push(href!);
    }
  }

  await page.context().clearCookies();
  await signIn(page);

  const programmeManagerOption = contextOptions.find((option) => option.label.startsWith('Programme manager'));
  await contextSelect.selectOption(programmeManagerOption!.value);
  await page.goto(`/coop/${organizationId}/directory`);
  await expect(page.getByRole('heading', { level: 1, name: 'Directory' })).toBeFocused();
  expect(await page.locator('nav[aria-label="Primary navigation"] a').count()).toBe(5);

  const secretaryOption = contextOptions.find((option) => option.label.startsWith('Secretary'));
  await contextSelect.selectOption(secretaryOption!.value);
  await page.goto(`/coop/${organizationId}/evidence?filter=open&sort=severity`);
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/coop/${organizationId}/evidence\\?filter=open&sort=severity$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/coop/${organizationId}/evidence\\?filter=open&sort=severity$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await contextSelect.selectOption(secretaryOption!.value);
  await page.goto(`/coop/${organizationId}/evidence?filter=open&sort=severity`);
  await page.locator(`nav[aria-label="Primary navigation"] a[href="/coop/${organizationId}/governance"]`).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/coop/${organizationId}/evidence\\?filter=open&sort=severity$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence register' })).toBeFocused();
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'Governance' })).toBeFocused();
  visited.push(`/coop/${organizationId}/evidence?filter=open&sort=severity`);
  console.log(`WP6.1 served routes exercised: ${visited.join(', ')}`);
});

test('workspace route rejects an unauthenticated browser session', async ({ page }) => {
  await page.goto('/workspace/evidence');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Symphony' })).toBeVisible();
});

test('provenance dialog has an accessible name, contains keyboard focus and restores its trigger on Escape', async ({ page }) => {
  await signIn(page);
  const trigger = page.getByRole('button', { name: 'Provenance' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Provenance' });
  await expect(dialog).toBeVisible();
  const close = page.getByRole('button', { name: 'Close provenance drawer' });
  await expect(close).toBeFocused();
  await expectAxeClean(page, '/workspace/overview (provenance dialog open)');
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
