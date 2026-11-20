import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { After, AfterAll, Before, BeforeAll, Given, Then, When, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Page } from '@playwright/test';
import {
  cleanupWp6_1Fixture,
  independentlyVerifiedFindingId,
  officeActors,
  organizationId,
  password,
  seedWp6_1Fixture,
  selfSuppliedFindingId,
  userId,
} from './wp6.1-fixture.js';
import { SymphonyWorld } from './world.js';

const baseUrl = process.env.WP6_1_BASE_URL ?? 'http://127.0.0.1:5175';
const routeInventory = (JSON.parse(readFileSync('evidence/phase1/wp6.1/task-evidence.json', 'utf8')) as {
  claims?: { route_inventory?: string[] };
}).claims?.route_inventory ?? [];

const navigationByPersona: Record<string, readonly string[]> = {
  'cooperative member': ['Overview', 'My activities', 'My household'],
  chairperson: ['Overview', 'Governance', 'Meetings and resolutions', 'By-laws and requirements', 'Evidence register', 'Findings and next actions'],
  'vice-chairperson': ['Overview', 'Governance', 'Meetings and resolutions', 'By-laws and requirements', 'Evidence register', 'Findings and next actions'],
  secretary: ['Overview', 'Identity', 'By-laws and requirements', 'Governance', 'Meetings and resolutions', 'Evidence register', 'Findings and next actions'],
  treasurer: ['Overview', 'Financial records', 'Meetings and resolutions', 'Evidence register', 'Findings and next actions'],
  'internal verifier': ['Overview', 'Evidence register', 'Verification queue', 'Findings and next actions'],
  'programme manager': ['Pipeline', 'Cohort', 'Directory', 'Legal catalogue review', 'Delegations'],
  'union ta': ['Cohort', 'Capability gaps'],
  'self-enroller': ['Certificate details', 'Create officer accounts', 'Hand over'],
};

setDefaultTimeout(90_000);

BeforeAll(async () => {
  assert.equal(process.env.DATA_MODE, 'test', 'WP6.1 Cucumber requires DATA_MODE=test.');
  assert.ok(routeInventory.length > 0, 'WP6.1 requires a non-empty explicit route inventory.');
  await seedWp6_1Fixture();
});

AfterAll(async () => cleanupWp6_1Fixture());

Before(async function (this: SymphonyWorld) {
  this.baseUrl = baseUrl;
  this.browser = await chromium.launch({ headless: true });
  this.browserContext = await this.browser.newContext();
  this.page = await this.browserContext.newPage();
  this.organizationId = organizationId;
});

After(async function (this: SymphonyWorld) {
  await this.browserContext?.close();
  await this.browser?.close();
});

Given('the workspace is running with seed data in test mode', function (this: SymphonyWorld) {
  assert.equal(process.env.DATA_MODE, 'test');
  assert.ok(this.page, 'Cucumber browser was not initialized.');
  assert.ok(this.organizationId, 'PostgreSQL fixture was not initialized.');
});

When('{string} signs in', async function (this: SymphonyWorld, persona: string) {
  const page = requiredPage(this);
  const key = persona.trim().toLowerCase();
  const actor = key === 'chairperson' ? officeActors.find((x) => x.authority === 'chairperson')
    : key === 'vice-chairperson' ? officeActors.find((x) => x.authority === 'vice_chairperson')
      : key === 'treasurer' ? officeActors.find((x) => x.authority === 'treasurer') : undefined;
  const loginId = actor?.userId ?? userId;
  const loginPassword = actor?.password ?? password;
  await page.goto(`${this.baseUrl}/login`);
  await page.getByLabel('Email or user ID').fill(loginId);
  await page.getByLabel('Password').fill(loginPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/workspace(?:\/.*)?$/);

  const contextSelect = page.getByLabel('Current workflow', { exact: true });
  const option = contextSelect.locator('option').filter({ hasText: new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  await option.waitFor({ state: 'attached' });
  const contextValue = await option.getAttribute('value');
  assert.ok(contextValue, `No server-derived ${persona} context was rendered.`);
  await contextSelect.selectOption(contextValue);
  this.activePersona = key;
});

Then('the primary navigation shows {string}', async function (this: SymphonyWorld, expected: string) {
  const expectedItems = expected.split(',').map((label) => label.trim());
  const labels = await requiredPage(this).locator('nav[aria-label="Primary navigation"] a > span:first-child').allTextContents();
  assert.deepEqual(labels.map((label) => label.trim()), expectedItems, `Wrong navigation for ${this.activePersona}.`);
});

Then('each item opens a route with one h1 and a document title', async function (this: SymphonyWorld) {
  const page = requiredPage(this);
  const links = page.locator('nav[aria-label="Primary navigation"] a');
  const count = await links.count();
  assert.ok(count > 0, 'Navigation must be nonempty.');
  const expectedLabels = navigationByPersona[this.activePersona ?? ''];
  assert.ok(expectedLabels && expectedLabels.length === count, 'No frozen navigation expectation for this persona.');
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute('href');
    assert.ok(href?.startsWith('/'), 'Every navigation item must have an application URL.');
    await link.click();
    await page.waitForURL(new RegExp(`${escapeRegExp(href!)}$`));
    const heading = page.locator('#main-content h1');
    assert.equal(await heading.count(), 1, `${href} must render exactly one h1.`);
    await heading.waitFor({ state: 'visible' });
    assert.equal(await heading.innerText(), expectedLabels[index], `Unexpected heading for ${href}.`);
    assert.equal(await heading.evaluate((element) => document.activeElement === element), true, `${href} must focus its h1.`);
    assert.equal(await page.title(), `${expectedLabels[index]} | Symphony Workspace`);
  }
});

When('the user opens {string} and presses Back and Forward', async function (this: SymphonyWorld, route: string) {
  const page = requiredPage(this);
  await signInAsBase(page, this.baseUrl!);
  const original = `${route.replace('org-1', organizationId)}?filter=open&sort=severity`;
  await page.goto(`${this.baseUrl}${original}`);
  await page.getByRole('heading', { level: 1, name: 'Evidence register' }).waitFor({ state: 'visible' });
  const focusResults = [await focusedHeading(page)];
  await page.goto(`${this.baseUrl}/coop/${organizationId}/governance`);
  await page.getByRole('heading', { level: 1, name: 'Governance' }).waitFor({ state: 'visible' });
  focusResults.push(await focusedHeading(page));
  await page.goBack();
  await page.getByRole('heading', { level: 1, name: 'Evidence register' }).waitFor({ state: 'visible' });
  focusResults.push(await focusedHeading(page));
  await page.goForward();
  await page.getByRole('heading', { level: 1, name: 'Governance' }).waitFor({ state: 'visible' });
  focusResults.push(await focusedHeading(page));
  await page.goto(`${this.baseUrl}${original}`);
  await page.reload();
  this.routeFocusResults = focusResults;
  this.visitedRouteTexts = [original];
});

Then('focus moves to the page h1 each time', function (this: SymphonyWorld) {
  assert.ok(this.routeFocusResults.length >= 4, 'Back/Forward route focus observations are missing.');
  assert.ok(this.routeFocusResults.every(Boolean), 'A route transition did not focus its h1.');
  assert.equal(requiredPage(this).url(), `${this.baseUrl}/coop/${organizationId}/evidence?filter=open&sort=severity`);
});

Then('filters and sort order persist in the URL query', function (this: SymphonyWorld) {
  const current = new URL(requiredPage(this).url());
  assert.equal(current.searchParams.get('filter'), 'open');
  assert.equal(current.searchParams.get('sort'), 'severity');
});

When('every route is rendered with seed data', async function (this: SymphonyWorld) {
  const page = requiredPage(this);
  await signInAsBase(page, this.baseUrl!);
  assert.ok(routeInventory.length > 0, 'Explicit route inventory cannot be empty.');
  this.visitedRouteTexts = [];
  for (const template of routeInventory) {
    const route = template.replace(':cooperativeId', organizationId);
    const response = await page.goto(`${this.baseUrl}${route}`);
    assert.ok(response && response.status() < 400, `Route did not load: ${route}`);
    await page.locator('body').waitFor({ state: 'visible' });
    this.visitedRouteTexts.push(await page.locator('body').innerText());
  }
});

Then('no rendered text contains snake_case enum values', function (this: SymphonyWorld) {
  assert.ok(this.visitedRouteTexts.length > 0, 'No route DOM text was inspected.');
  for (const text of this.visitedRouteTexts) assert.doesNotMatch(text, /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/);
});

Then('no rendered text contains the phrases {string}, {string} without authority or a bare {string}', function (this: SymphonyWorld, first: string, second: string, third: string) {
  for (const text of this.visitedRouteTexts) {
    assert.doesNotMatch(text, new RegExp(`\\b${escapeRegExp(first)}\\b`, 'i'));
    assert.doesNotMatch(text, new RegExp(`\\b${escapeRegExp(second)}\\b`, 'i'));
    assert.doesNotMatch(text, new RegExp(`\\b${escapeRegExp(third)}\\b`));
  }
});

When('an item verified by the internal verifier is expanded', async function (this: SymphonyWorld) {
  const page = requiredPage(this);
  await signInAsBase(page, this.baseUrl!);
  const contexts = page.getByLabel('Current workflow', { exact: true });
  const option = contexts.locator('option').filter({ hasText: /Internal verifier/i }).first();
  const value = await option.getAttribute('value');
  assert.ok(value, 'No persisted internal-verifier context was supplied by the API.');
  await contexts.selectOption(value);
  await page.goto(`${this.baseUrl}/coop/${organizationId}/evidence`);
  await page.getByRole('heading', { level: 1, name: 'Evidence register' }).waitFor({ state: 'visible' });
  await page.getByText('Cooperative-verified (internal)', { exact: true }).click();
});

Then('the chip text includes the verifier, scope, version and {string}', async function (this: SymphonyWorld, assuranceLabel: string) {
  const page = requiredPage(this);
  await page.getByText(/Example Cooperative Secretary/).waitFor({ state: 'visible' });
  await page.getByText('Financial statement completeness', { exact: true }).waitFor({ state: 'visible' });
  await page.getByText('version 1', { exact: false }).first().waitFor({ state: 'visible' });
  await page.getByText(assuranceLabel, { exact: true }).waitFor({ state: 'visible' });
  const rows = page.getByRole('list', { name: 'Assigned verification findings' }).getByRole('listitem');
  assert.equal(await rows.count(), 8, 'Only persisted findings should be projected; the assignment with no finding must be absent.');
  const summaries = await rows.locator('summary').allInnerTexts();
  assert.equal(summaries.filter((text) => text.includes('Claim not supported')).length, 1);
  assert.equal(summaries.filter((text) => text.includes('Inconclusive')).length, 1);
  assert.equal(summaries.filter((text) => text.includes('Provenance incomplete')).length, 4);
  assert.equal(summaries.filter((text) => text.includes('No qualified result')).length, 1);
  assert.equal(summaries.filter((text) => text.includes('Cooperative-verified (internal)')).length, 1);
  for (const row of await rows.all()) {
    const summary = await row.locator('summary').innerText();
    if (!summary.includes('Cooperative-verified (internal)')) {
      assert.equal(await row.getByText('Cooperative-verified (internal)', { exact: true }).count(), 0, `${summary} rendered a positive chip.`);
    }
  }
  const projected = await page.evaluate(async (cooperativeId) => {
    const response = await fetch(`/workspace/verified-findings?organizationId=${encodeURIComponent(cooperativeId)}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Verified-finding API returned ${response.status}.`);
    const envelope = await response.json() as { data: Array<{ findingId: string; verified: boolean }> };
    return envelope.data;
  }, organizationId);
  assert.equal(projected.find((finding) => finding.findingId === independentlyVerifiedFindingId)?.verified, true,
    'A distinct evidence supplier and assigned verifier should retain the positive finding result.');
  assert.equal(projected.find((finding) => finding.findingId === selfSuppliedFindingId)?.verified, false,
    'The assigned verifier must not receive a positive result for evidence they supplied.');
});

function requiredPage(world: SymphonyWorld) {
  assert.ok(world.page, 'The WP6.1 browser page is not initialized.');
  return world.page;
}

async function signInAsBase(page: Page, url: string): Promise<void> {
  await page.goto(`${url}/login`);
  await page.getByLabel('Email or user ID').fill(userId);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/workspace(?:\/.*)?$/);
}

async function focusedHeading(page: Page): Promise<boolean> {
  return page.locator('#main-content h1').evaluate((element) => document.activeElement === element);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
