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
const reportPath = path.join(temporaryDirectory, 'cucumber.json');
const cucumberCli = path.join(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js');
const scenarioIds = manifest.scenarios.map((scenario) => `@${scenario.id}`);
const tagExpression = `(${scenarioIds.join(' or ')}) and not @wip`;

try {
  const result = spawnSync(process.execPath, [
    cucumberCli,
    '--config', 'cucumber.cjs',
    '--profile', 'default',
    '--tags', tagExpression,
    '--format', `json:"${reportPath.replaceAll('\\', '/') }"`,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=tsx'].filter(Boolean).join(' ') },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else {
    let report;
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch (error) {
      console.error(`Phase 1 BDD report missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    if (report) {
      const errors = validatePhase1BddReport(report, manifest);
      if (errors.length) {
        for (const error of errors) console.error(`FAIL ${error}`);
        process.exitCode = 1;
      } else {
        console.log(`All ${manifest.scenarios.length} frozen Phase 1 BDD scenarios were executed and passed.`);
      }
    }
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
