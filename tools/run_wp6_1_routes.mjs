import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
if (process.env.DATA_MODE !== 'test' || !adminUrl || !appUrl) {
  throw new Error('WP6.1 route acceptance requires DATA_MODE=test and both test-admin and app-role PostgreSQL URLs.');
}
const databaseName = decodeURIComponent(new URL(appUrl).pathname.replace(/^\//, ''));
if (!databaseName.toLowerCase().endsWith('_test')) throw new Error('WP6.1 refuses a database not suffixed _test.');

const workspacePort = Number(process.env.WP6_1_WORKSPACE_PORT ?? 5175);
const apiPort = Number(process.env.WP6_1_API_PORT ?? 3001);
const origin = `http://127.0.0.1:${workspacePort}`;
const artifactDirectory = process.env.WP6_1_ARTIFACT_DIR ?? path.join(root, 'artifacts', 'wp6.1');
mkdirSync(artifactDirectory, { recursive: true });
const apiLogPath = path.join(artifactDirectory, 'api-redacted.raw.log');
writeFileSync(apiLogPath, '');

const environment = {
  ...process.env,
  NODE_ENV: 'test', SYNTHETIC_ONLY: 'true',
  RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
  COMMAND_DIGEST_HMAC_KEY: process.env.COMMAND_DIGEST_HMAC_KEY ?? Buffer.alloc(32, 0x44).toString('base64'),
  PUBLIC_ORIGIN: origin, PORT: String(apiPort), DATABASE_URL: appUrl,
  AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
  WP5_5_API_LOG_PATH: apiLogPath,
  VITE_AUTH_API_TARGET: `http://127.0.0.1:${apiPort}`,
};
const children = [];
function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env: environment, stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}
async function waitFor(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`WP6.1 service exited before readiness (${child.exitCode}).`);
    try { if ((await fetch(url)).ok) return; } catch { /* wait until the bounded readiness deadline */ }
    await delay(250);
  }
  throw new Error(`WP6.1 service readiness timed out: ${url}`);
}
function runPlaywright() {
  return new Promise((resolve, reject) => {
    const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
    const child = start([cli, 'test', '--config', 'playwright.wp6.1.config.ts', 'tests/workspace/routes.spec.ts']);
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  const api = start(['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', '--import', 'tsx', 'apps/api/src/main.ts']);
  const workspace = start(['node_modules/vite/bin/vite.js', 'apps/workspace', '--config', 'apps/workspace/vite.config.ts', '--host', '127.0.0.1', '--port', String(workspacePort), '--strictPort']);
  await Promise.all([waitFor(`http://127.0.0.1:${apiPort}/health/live`, api), waitFor(`${origin}/components`, workspace)]);
  exitCode = await runPlaywright();
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill('SIGTERM');
  await delay(300);
}
process.exit(exitCode);
