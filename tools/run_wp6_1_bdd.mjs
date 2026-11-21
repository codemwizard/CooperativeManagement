import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
const validLocalTestUrl = (raw) => {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && decodeURIComponent(url.pathname).replace(/^\//, '').toLowerCase().endsWith('_test');
  } catch {
    return false;
  }
};
if (process.env.DATA_MODE !== 'test' || !validLocalTestUrl(adminUrl) || !validLocalTestUrl(appUrl)) {
  throw new Error('WP6.1 Cucumber requires DATA_MODE=test and local admin/app PostgreSQL URLs with _test database names.');
}

const workspacePort = Number(process.env.WP6_1_WORKSPACE_PORT ?? 5176);
const apiPort = Number(process.env.WP6_1_API_PORT ?? 3001);
const origin = `http://127.0.0.1:${workspacePort}`;
const evidenceDirectory = process.env.WP6_1_EVIDENCE_DIR
  ? path.resolve(root, process.env.WP6_1_EVIDENCE_DIR)
  : path.join(root, 'evidence', 'phase1', 'wp6.1');
mkdirSync(evidenceDirectory, { recursive: true });
const reportPath = path.join(evidenceDirectory, 'cucumber-report.json');
const runLogPath = path.join(evidenceDirectory, 'cucumber-run.log');
const apiLogPath = path.join(evidenceDirectory, 'cucumber-api-redacted.log');
const telemetryMode = process.env.WP6_1_SCENARIO_SET === 'telemetry';
writeFileSync(apiLogPath, '');

const environment = {
  ...process.env,
  NODE_ENV: 'test', SYNTHETIC_ONLY: 'true',
  RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
  COMMAND_DIGEST_HMAC_KEY: process.env.COMMAND_DIGEST_HMAC_KEY ?? Buffer.alloc(32, 0x44).toString('base64'),
  PUBLIC_ORIGIN: origin, PORT: String(apiPort), DATABASE_URL: appUrl,
  AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
  WP5_5_API_LOG_PATH: apiLogPath,
  WP6_1_BASE_URL: origin,
  VITE_ENABLE_UI_TELEMETRY: telemetryMode ? 'true' : 'false',
  VITE_AUTH_API_TARGET: `http://127.0.0.1:${apiPort}`,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
};
const children = [];
function start(args, options = {}) {
  const child = spawn(process.execPath, args, { cwd: root, env: environment, windowsHide: true, ...options });
  children.push(child);
  return child;
}
async function waitFor(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`WP6.1 service exited before readiness (${child.exitCode}): ${url}`);
    try { if ((await fetch(url)).ok) return; } catch { /* bounded readiness retry */ }
    await delay(250);
  }
  throw new Error(`WP6.1 service readiness timed out: ${url}`);
}
function runCucumber() {
  const cli = path.join(root, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
  return new Promise((resolve, reject) => {
    const cucumberReportPath = reportPath.replaceAll('\\', '/');
    const child = start([cli, '--config', 'cucumber.cjs', '--profile', telemetryMode ? 'telemetry' : 'wp61', '--format', `json:"${cucumberReportPath}"`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

let exitCode = 1;
try {
  const api = start(['--env-file-if-exists=.env.local', '--env-file-if-exists=.env', '--import', 'tsx', 'apps/api/src/main.ts'], { stdio: 'inherit' });
  const workspace = start(['node_modules/vite/bin/vite.js', 'apps/workspace', '--config', 'apps/workspace/vite.config.ts', '--host', '127.0.0.1', '--port', String(workspacePort), '--strictPort'], { stdio: 'inherit' });
  await Promise.all([waitFor(`http://127.0.0.1:${apiPort}/health/live`, api), waitFor(`${origin}/login`, workspace)]);
  const result = await runCucumber();
  writeFileSync(runLogPath, `${result.stdout}${result.stderr}`);
  exitCode = result.code;

  if (exitCode === 0) {
    let report;
    try { report = JSON.parse(readFileSync(reportPath, 'utf8')); }
    catch (error) { throw new Error(`Cucumber report is missing or invalid: ${error instanceof Error ? error.message : String(error)}`); }
    const elements = report.flatMap((feature) => feature.elements ?? []);
    const requiredIds = telemetryMode ? ['BDD-AUD-007'] : ['BDD-UXW-001', 'BDD-UXW-002', 'BDD-UXW-003', 'BDD-UXW-004'];
    for (const id of requiredIds) {
      const scenarios = elements.filter((scenario) => (scenario.tags ?? []).some((tag) => tag.name === `@${id}`));
      if (!scenarios.length) throw new Error(`Cucumber report contains no executed examples for ${id}.`);
      for (const scenario of scenarios) {
        if (!scenario.steps?.length || scenario.steps.some((step) => step.result?.status !== 'passed')) {
          throw new Error(`${id} contains a zero-step, skipped, pending, undefined or failed example.`);
        }
      }
    }
    if (telemetryMode) {
      if (elements.length !== 1) throw new Error(`Expected one AUD-007 telemetry scenario, observed ${elements.length}.`);
      console.log('WP1.1/WP6.1 live telemetry Cucumber PASS: AUD-007 executed against the served workspace and PostgreSQL.');
    } else {
      const navigationCount = elements.filter((scenario) => (scenario.tags ?? []).some((tag) => tag.name === '@BDD-UXW-001')).length;
      if (navigationCount !== 9) throw new Error(`Expected nine frozen UXW-001 contexts, observed ${navigationCount}.`);
      console.log(`WP6.1 live Cucumber PASS: ${navigationCount} UXW-001 contexts and UXW-002–004 executed.`);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  writeFileSync(runLogPath, `${message}\n`);
  console.error(message);
  exitCode = 1;
} finally {
  for (const child of children.reverse()) if (child.exitCode === null) child.kill('SIGTERM');
  await delay(300);
}
process.exit(exitCode);
