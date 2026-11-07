import { defineConfig, devices } from '@playwright/test';

const rawTestDatabaseUrl = process.env.PHASE1_TEST_DATABASE_URL;
if (!rawTestDatabaseUrl) {
  throw new Error('PHASE1_TEST_DATABASE_URL must point to an isolated local PostgreSQL test database.');
}
let testDatabaseUrl: URL;
try {
  testDatabaseUrl = new URL(rawTestDatabaseUrl);
} catch {
  throw new Error('PHASE1_TEST_DATABASE_URL must be a valid PostgreSQL URL for an isolated test database.');
}
if (
  !['postgres:', 'postgresql:'].includes(testDatabaseUrl.protocol)
  || !['localhost', '127.0.0.1', '::1'].includes(testDatabaseUrl.hostname)
  || !/test/i.test(testDatabaseUrl.pathname)
) {
  throw new Error('Phase 1 browser tests permit only a local PostgreSQL database with a test-scoped name.');
}

export default defineConfig({
  testDir: './tests/workspace',
  testMatch: /login-api\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:workspace -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5174/login',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace @symphony/api',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { APP_ENV: 'test', DATA_MODE: 'test', DATABASE_URL: rawTestDatabaseUrl },
    },
  ],
});
