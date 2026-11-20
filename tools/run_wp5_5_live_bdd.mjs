import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePhase1BddReport } from './phase1-contracts.js';
import { readFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const appUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'] ?? process.env['PHASE1_TEST_DATABASE_URL'];
if (process.env['DATA_MODE'] !== 'test' || !adminUrl || !appUrl) {
  throw new Error('WP5.5 live BDD requires test mode and both admin and app-role PostgreSQL URLs.');
}
const database = decodeURIComponent(new URL(appUrl).pathname.replace(/^\//, ''));
if (!database.endsWith('_test')) throw new Error('WP5.5 refuses a database not suffixed _test.');
const artifactDirectory = process.env['WP5_5_ARTIFACT_DIR'] ?? path.join(root, 'artifacts', 'wp5.5');
mkdirSync(artifactDirectory, { recursive: true });
const apiLogPath = path.join(artifactDirectory, 'api-redacted.raw.log');
writeFileSync(apiLogPath, '');
const reportPath = path.join(artifactDirectory, 'bdd-enr-004.json');
const workspacePort = Number(process.env['WP5_5_WORKSPACE_PORT'] ?? 5174);
const apiPort = Number(process.env['WP5_5_API_PORT'] ?? 3000);
const origin = `http://127.0.0.1:${workspacePort}`;
const commonEnv = {
  ...process.env,
  RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
  PUBLIC_ORIGIN: origin,
  PORT: String(apiPort),
  WP5_5_API_LOG_PATH: apiLogPath,
  WP5_5_LIVE_AUTH_BDD: '1',
  WP5_5_PUBLIC_ORIGIN: origin,
  NODE_OPTIONS: [process.env['NODE_OPTIONS'], '--import=tsx'].filter(Boolean).join(' '),
  AUTH_THROTTLE_HMAC_KEY: process.env['AUTH_THROTTLE_HMAC_KEY'] ?? Buffer.alloc(32, 0x53).toString('base64'),
  DATABASE_URL: appUrl,
  VITE_AUTH_API_TARGET: `http://127.0.0.1:${apiPort}`,
};
const children = [];
function start(command, args, env = commonEnv) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
  children.push(child);
  return child;
}
function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
}
async function waitFor(url, child) {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`WP5.5 service exited before becoming ready (${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) { lastError = error; }
    await delay(250);
  }
  throw new Error(`WP5.5 service readiness timed out for ${url}: ${String(lastError ?? 'no healthy response')}`);
}
function runCucumber() {
  return new Promise((resolve, reject) => {
    const cli = path.join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
    const reportSpecifier = `json:"${reportPath.replaceAll('\\', '/') }"`;
    const child = start(process.execPath, [cli, '--config', 'cucumber.cjs', '--profile', 'default', '--tags', '@BDD-ENR-004', '--format', reportSpecifier]);
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
try {
  const api = start(process.execPath, ['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', '--import', 'tsx', 'apps/api/src/main.ts']);
  const workspace = start(process.execPath, ['node_modules/vite/bin/vite.js', 'apps/workspace', '--config', 'apps/workspace/vite.config.ts', '--host', '127.0.0.1', '--port', String(workspacePort), '--strictPort']);
  await Promise.all([waitFor(`http://127.0.0.1:${apiPort}/health/live`, api), waitFor(`${origin}/login`, workspace)]);
  const status = await runCucumber();
  if (status !== 0) exitCode = status;
  else {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(root, 'evidence/phase1/bdd-scenarios.json'), 'utf8'));
    const scenario = manifest.scenarios.find((entry) => entry.id === 'BDD-ENR-004');
    if (!scenario) throw new Error('BDD-ENR-004 is missing from the frozen Phase 1 manifest.');
    const errors = validatePhase1BddReport(report, { ...manifest, scenarios: [scenario] });
    if (errors.length) {
      for (const error of errors) console.error(`FAIL ${error}`);
      exitCode = 1;
    } else {
      console.log('PASS: BDD-ENR-004 executed through workspace, API and PostgreSQL.');
      exitCode = 0;
    }
  }
} finally {
  for (const child of children.reverse()) stop(child);
  await delay(250);
}
process.exit(exitCode);
