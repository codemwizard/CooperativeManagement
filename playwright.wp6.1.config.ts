import { defineConfig, devices } from '@playwright/test';

const appDatabaseUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
if (!appDatabaseUrl) throw new Error('WP6.1 requires PHASE1_TEST_APP_DATABASE_URL.');
let databaseUrl: URL;
try { databaseUrl = new URL(appDatabaseUrl); }
catch { throw new Error('WP6.1 requires a valid test database URL.'); }
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
  || !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)
  || !databaseUrl.pathname.toLowerCase().includes('_test')) {
  throw new Error('WP6.1 permits only a local PostgreSQL test database with a _test suffix.');
}

const port = Number(process.env.WP6_1_WORKSPACE_PORT ?? 5175);

export default defineConfig({
  testDir: './tests/workspace',
  testMatch: /routes\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
});
