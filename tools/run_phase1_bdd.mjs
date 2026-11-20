import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePhase1BddReport } from './phase1-contracts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'evidence/phase1/bdd-scenarios.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'symphony-phase1-bdd-'));
const defaultReportPath = path.join(temporaryDirectory, 'default-cucumber.json');
const cucumberCli = path.join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
const liveWorkspaceIds = new Set(['BDD-UXW-001', 'BDD-UXW-002', 'BDD-UXW-003', 'BDD-UXW-004']);
const defaultScenarioIds = manifest.scenarios.filter((scenario) => !liveWorkspaceIds.has(scenario.id)).map((scenario) => `@${scenario.id}`);
const defaultTagExpression = `(${defaultScenarioIds.join(' or ')}) and not @wip and not @phase6`;
const liveWorkspaceArtifactDirectory = path.join(temporaryDirectory, 'wp6.1');
const liveWorkspaceReportPath = path.join(liveWorkspaceArtifactDirectory, 'cucumber-report.json');

function runCucumber(profile, reportPath, tags) {
  const args = [cucumberCli, '--config', 'cucumber.cjs', '--profile', profile];
  if (tags) args.push('--tags', tags);
  args.push('--format', `json:"${reportPath.replaceAll('\\', '/') }"`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`Cucumber profile ${profile} could not start: ${result.error.message}`);
  return result.status ?? (result.error ? 1 : 0);
}

function runLiveWorkspaceBdd() {
  const runner = path.join(root, 'tools/run_wp6_1_bdd.mjs');
  const result = spawnSync(process.execPath, [runner], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
      WP6_1_EVIDENCE_DIR: path.relative(root, liveWorkspaceArtifactDirectory),
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`WP6.1 Cucumber runner could not start: ${result.error.message}`);
  return result.status ?? (result.error ? 1 : 0);
}

try {
  const defaultStatus = runCucumber('default', defaultReportPath, defaultTagExpression);
  const workspaceStatus = runLiveWorkspaceBdd();
  let reports;
  try {
    reports = [
      ...JSON.parse(readFileSync(defaultReportPath, 'utf8')),
      ...JSON.parse(readFileSync(liveWorkspaceReportPath, 'utf8')),
    ];
  } catch (error) {
    console.error(`Phase 1 BDD report missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
  if (reports) {
    const errors = validatePhase1BddReport(reports, manifest);
    if (errors.length) {
      for (const error of errors) console.error(`FAIL ${error}`);
      process.exitCode = 1;
    } else if (defaultStatus !== 0 || workspaceStatus !== 0) {
      process.exitCode = 1;
    } else {
      console.log(`All ${manifest.scenarios.length} frozen Phase 1 BDD scenarios were executed and passed.`);
    }
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
