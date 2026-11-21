import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'] ?? process.env['PHASE1_TEST_DATABASE_URL'];
const adminUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
if (process.env['DATA_MODE'] !== 'test' || !appUrl || !adminUrl) {
  throw new Error('WP5.4 browser acceptance requires test mode and app-role/admin PostgreSQL URLs.');
}
const databaseName = decodeURIComponent(new URL(appUrl).pathname.replace(/^\//, ''));
if (!databaseName.endsWith('_test')) throw new Error('WP5.4 refuses a database not suffixed _test.');
const workspacePort = Number(process.env['WP5_4_WORKSPACE_PORT'] ?? 5174);
const apiPort = Number(process.env['WP5_4_API_PORT'] ?? 3000);
const origin = `http://127.0.0.1:${workspacePort}`;
const artifactDirectory = process.env['WP5_4_ARTIFACT_DIR'] ?? path.join(root, 'artifacts', 'wp5.4');
mkdirSync(artifactDirectory, { recursive: true });
const apiLogPath = path.join(artifactDirectory, 'api-redacted.raw.log');
writeFileSync(apiLogPath, '');
const environment = {
  ...process.env,
  NODE_ENV: 'test', SYNTHETIC_ONLY: 'true',
  RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
  PUBLIC_ORIGIN: origin, PORT: String(apiPort), DATABASE_URL: appUrl,
  COMMAND_DIGEST_HMAC_KEY: process.env['COMMAND_DIGEST_HMAC_KEY'] ?? Buffer.alloc(32, 0x44).toString('base64'),
  AUTH_THROTTLE_HMAC_KEY: process.env['AUTH_THROTTLE_HMAC_KEY'] ?? Buffer.alloc(32, 0x53).toString('base64'),
  WP5_5_API_LOG_PATH: apiLogPath,
  VITE_AUTH_API_TARGET: `http://127.0.0.1:${apiPort}`,
  WP5_4_WORKSPACE_PORT: String(workspacePort), WP5_4_API_PORT: String(apiPort),
  SYMPHONY_WP5_4_EXTERNAL_SERVERS: '1',
};
const children = [];
function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env: environment, stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}
async function waitFor(url, child) {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`WP5.4 service exited before readiness (${child.exitCode}).`);
    try { if ((await fetch(url)).ok) return; } catch { /* retry until the bounded readiness deadline */ }
    await delay(250);
  }
  throw new Error(`WP5.4 service readiness timed out: ${url}`);
}
function runBrowser() {
  return new Promise((resolve, reject) => {
    const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
    const child = start([cli, 'test', '--config', 'playwright.phase1.config.ts', 'tests/workspace/login-api.spec.ts']);
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  const api = start(['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', '--import', 'tsx', 'apps/api/src/main.ts']);
  const workspace = start(['node_modules/vite/bin/vite.js', 'apps/workspace', '--config', 'apps/workspace/vite.config.ts', '--host', '127.0.0.1', '--port', String(workspacePort), '--strictPort']);
  await Promise.all([waitFor(`http://127.0.0.1:${apiPort}/health/live`, api), waitFor(`${origin}/login`, workspace)]);
  exitCode = await runBrowser();
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  await delay(300);
}
process.exit(exitCode);
