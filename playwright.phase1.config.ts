import { defineConfig, devices } from '@playwright/test';

const rawTestDatabaseUrl = process.env.PHASE1_TEST_APP_DATABASE_URL ?? process.env.PHASE1_TEST_DATABASE_URL;
if (!rawTestDatabaseUrl) {
  throw new Error('PHASE1_TEST_APP_DATABASE_URL must point to an isolated local PostgreSQL test database.');
}
const workspacePort = Number(process.env.WP5_4_WORKSPACE_PORT ?? 5174);
const apiPort = Number(process.env.WP5_4_API_PORT ?? 3000);
const publicOrigin = `http://127.0.0.1:${workspacePort}`;
const externalServers = process.env.SYMPHONY_WP5_4_EXTERNAL_SERVERS === '1';
let testDatabaseUrl: URL;
try {
  testDatabaseUrl = new URL(rawTestDatabaseUrl);
} catch {
  throw new Error('PHASE1_TEST_APP_DATABASE_URL must be a valid PostgreSQL URL for an isolated test database.');
}
if (
  !['postgres:', 'postgresql:'].includes(testDatabaseUrl.protocol)
  || !['localhost', '127.0.0.1', '::1'].includes(testDatabaseUrl.hostname)
  || !/test/i.test(testDatabaseUrl.pathname)
) {
  throw new Error('Phase 1 browser tests permit only a local PostgreSQL app-role database with a test-scoped name.');
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
    baseURL: publicOrigin,
    trace: 'retain-on-failure',
  },
  webServer: externalServers ? undefined : [
    {
      command: `node ./node_modules/vite/bin/vite.js apps/workspace --config apps/workspace/vite.config.ts --host 127.0.0.1 --port ${workspacePort} --strictPort`,
      url: `${publicOrigin}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_AUTH_API_TARGET: `http://127.0.0.1:${apiPort}` },
    },
    {
      command: 'node --env-file-if-exists=.env.local --env-file-if-exists=.env --import tsx apps/api/src/main.ts',
      url: `http://127.0.0.1:${apiPort}/health/live`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
        PUBLIC_ORIGIN: publicOrigin, PORT: String(apiPort),
        DATABASE_URL: rawTestDatabaseUrl,
        AUTH_THROTTLE_HMAC_KEY: Buffer.alloc(32, 0x53).toString('base64'),
      },
    },
  ],
});
