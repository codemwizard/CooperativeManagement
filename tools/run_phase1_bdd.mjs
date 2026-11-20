import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePhase1BddReport } from './phase1-contracts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'evidence/phase1/bdd-scenarios.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const bddMap = JSON.parse(readFileSync(path.join(root, 'evidence/phase1/bdd-work-package-map.json'), 'utf8'));
function parseArguments(args) {
  let workPackage;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument !== '--work-package') throw new Error(`Unsupported argument: ${argument}`);
    if (workPackage) throw new Error('--work-package may be supplied only once');
    workPackage = args[index + 1];
    if (!workPackage || workPackage.startsWith('--')) throw new Error('--work-package requires a work-package ID');
    index += 1;
  }
  if (workPackage && !['REM-WP1.6', 'REM-WP1'].includes(workPackage)) {
    throw new Error(`Unsupported work-package selector: ${workPackage}`);
  }
  return workPackage;
}
const workPackage = parseArguments(process.argv.slice(2));
const wp1CumulativeIds = new Set(['BDD-AUD-001', 'BDD-AUD-002', 'BDD-AUD-003', 'BDD-AUD-004', 'BDD-AUD-005', 'BDD-AUD-006', 'BDD-AUD-010', 'BDD-AUD-015']);
const selectedScenarios = workPackage === 'REM-WP1.6'
  ? manifest.scenarios.filter((scenario) => bddMap.scenarios.find((entry) => entry.id === scenario.id)?.owner_tasks?.includes(workPackage))
  : workPackage === 'REM-WP1'
    ? manifest.scenarios.filter((scenario) => wp1CumulativeIds.has(scenario.id))
    : manifest.scenarios;
if (workPackage && selectedScenarios.length === 0) throw new Error(`${workPackage} has no scenarios in the frozen Phase 1 manifest`);
const runId = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const artifactDirectory = path.resolve(process.env.PHASE1_BDD_ARTIFACT_DIR
  ?? path.join(root, 'artifacts', 'phase1-bdd', candidate, runId));
mkdirSync(artifactDirectory, { recursive: true });
const runMetadata = {
  candidate,
  work_package: workPackage ?? null,
  selected_scenario_ids: selectedScenarios.map((scenario) => scenario.id),
  branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
  worktree_clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length === 0,
  started_at: new Date().toISOString(),
};
writeFileSync(path.join(artifactDirectory, 'run-metadata.json'), `${JSON.stringify(runMetadata, null, 2)}\n`, 'utf8');
const defaultReportPath = path.join(artifactDirectory, 'default-cucumber.json');
const cucumberCli = path.join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
const liveWorkspaceIds = new Set(['BDD-UXW-001', 'BDD-UXW-002', 'BDD-UXW-003', 'BDD-UXW-004']);
const liveAuthIds = new Set(['BDD-ENR-004']);
const liveTelemetryIds = new Set(['BDD-AUD-007']);
const defaultScenarioIds = selectedScenarios
  .filter((scenario) => !liveWorkspaceIds.has(scenario.id) && !liveAuthIds.has(scenario.id) && !liveTelemetryIds.has(scenario.id))
  .map((scenario) => `@${scenario.id}`);
const defaultTagExpression = `(${defaultScenarioIds.join(' or ')}) and not @wip and not @phase6`;
const liveAuthArtifactDirectory = path.join(artifactDirectory, 'wp5.5');
const liveAuthReportPath = path.join(liveAuthArtifactDirectory, 'bdd-enr-004.json');
const liveWorkspaceArtifactDirectory = path.join(artifactDirectory, 'wp6.1');
const liveWorkspaceReportPath = path.join(liveWorkspaceArtifactDirectory, 'cucumber-report.json');
const liveTelemetryArtifactDirectory = path.join(artifactDirectory, 'ui-telemetry');
const liveTelemetryReportPath = path.join(liveTelemetryArtifactDirectory, 'cucumber-report.json');

function retainProcessOutput(name, result) {
  writeFileSync(path.join(artifactDirectory, `${name}.stdout.log`), result.stdout ?? '', 'utf8');
  writeFileSync(path.join(artifactDirectory, `${name}.stderr.log`), result.stderr ?? '', 'utf8');
}

function runCucumber(profile, reportPath, tags) {
  const args = [cucumberCli, '--config', 'cucumber.cjs', '--profile', profile];
  if (tags) args.push('--tags', tags);
  args.push('--format', `json:"${reportPath.replaceAll('\\', '/') }"`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      RUNTIME_PROFILE: 'test',
      APP_ENV: 'test',
      DATA_MODE: 'test',
      SYNTHETIC_ONLY: 'true',
      AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
    },
  });
  retainProcessOutput(`cucumber-${profile}`, result);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`Cucumber profile ${profile} could not start: ${result.error.message}`);
  return result.status ?? (result.error ? 1 : 0);
}

function runLiveAuthBdd() {
  const runner = path.join(root, 'tools/run_wp5_5_live_bdd.mjs');
  const result = spawnSync(process.execPath, [runner], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      RUNTIME_PROFILE: 'test',
      APP_ENV: 'test',
      DATA_MODE: 'test',
      SYNTHETIC_ONLY: 'true',
      WP5_5_ARTIFACT_DIR: liveAuthArtifactDirectory,
      AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' '),
    },
  });
  retainProcessOutput('live-wp5.5', result);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`WP5.5 live authentication runner could not start: ${result.error.message}`);
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
  retainProcessOutput('live-wp6.1', result);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`WP6.1 Cucumber runner could not start: ${result.error.message}`);
  return result.status ?? (result.error ? 1 : 0);
}

function runLiveTelemetryBdd() {
  const runner = path.join(root, 'tools/run_wp6_1_bdd.mjs');
  const result = spawnSync(process.execPath, [runner], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      AUTH_THROTTLE_HMAC_KEY: process.env.AUTH_THROTTLE_HMAC_KEY ?? Buffer.alloc(32, 0x61).toString('base64'),
      WP6_1_SCENARIO_SET: 'telemetry',
      WP6_1_EVIDENCE_DIR: path.relative(root, liveTelemetryArtifactDirectory),
    },
  });
  retainProcessOutput('live-ui-telemetry', result);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) console.error(`Live UI telemetry runner could not start: ${result.error.message}`);
  return result.status ?? (result.error ? 1 : 0);
}

const validatorSummary = { ...runMetadata, profile_exit_codes: {}, validation_errors: [], passed: false };
try {
  if (workPackage) console.log(`Running ${workPackage}: ${selectedScenarios.length} mapped scenarios [${selectedScenarios.map((scenario) => scenario.id).join(', ')}]. Artifacts: ${artifactDirectory}`);
  const defaultStatus = runCucumber('default', defaultReportPath, defaultTagExpression);
  const authStatus = workPackage ? 0 : runLiveAuthBdd();
  const workspaceStatus = workPackage ? 0 : runLiveWorkspaceBdd();
  const telemetryStatus = workPackage ? 0 : runLiveTelemetryBdd();
  validatorSummary.profile_exit_codes = { default: defaultStatus, live_auth: authStatus, live_workspace: workspaceStatus, live_telemetry: telemetryStatus };
  let reports;
  try {
    reports = [
      ...JSON.parse(readFileSync(defaultReportPath, 'utf8')),
      ...(workPackage ? [] : JSON.parse(readFileSync(liveAuthReportPath, 'utf8'))),
      ...(workPackage ? [] : JSON.parse(readFileSync(liveWorkspaceReportPath, 'utf8'))),
      ...(workPackage ? [] : JSON.parse(readFileSync(liveTelemetryReportPath, 'utf8'))),
    ];
  } catch (error) {
    console.error(`Phase 1 BDD report missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
    validatorSummary.validation_errors.push(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
  if (reports) {
    const validationManifest = workPackage ? { ...manifest, scenarios: selectedScenarios } : manifest;
    const errors = validatePhase1BddReport(reports, validationManifest);
    if (errors.length) {
      validatorSummary.validation_errors = errors;
      for (const error of errors) console.error(`FAIL ${error}`);
      process.exitCode = 1;
    } else if (defaultStatus !== 0 || authStatus !== 0 || workspaceStatus !== 0 || telemetryStatus !== 0) {
      process.exitCode = 1;
    } else {
      validatorSummary.passed = true;
      console.log(workPackage
        ? `All ${selectedScenarios.length} selected ${workPackage} scenarios were executed and passed.`
        : `All ${manifest.scenarios.length} frozen Phase 1 BDD scenarios were executed and passed.`);
    }
  }
} finally {
  validatorSummary.finished_at = new Date().toISOString();
  validatorSummary.exit_code = process.exitCode ?? 0;
  writeFileSync(path.join(artifactDirectory, 'validator-summary.json'), `${JSON.stringify(validatorSummary, null, 2)}\n`, 'utf8');
  console.log(`BDD artifacts retained at ${artifactDirectory}`);
}
