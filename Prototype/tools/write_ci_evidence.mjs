import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const outcome = process.env.PHASE0_GATE_OUTCOME;
if (!['success', 'failure', 'cancelled', 'skipped'].includes(outcome ?? '')) {
  throw new Error('PHASE0_GATE_OUTCOME must be supplied by the Phase 0 workflow step.');
}

const outputDirectory = path.resolve('artifacts');
await mkdir(outputDirectory, { recursive: true });
const rawLogPath = path.join(outputDirectory, 'phase0-gate.raw.log');
let rawLog = '';
try {
  rawLog = await readFile(rawLogPath, 'utf8');
} catch {
  // A cancelled workflow may end before the gate step creates a log.
}
const sanitizedLog = rawLog
  .replace(/(postgres(?:ql)?:\/\/[^:/@\s]+:)[^@\s]+(@)/gi, '$1[REDACTED]$2')
  .replace(/((?:PASSWORD|PASSWD|TOKEN|SECRET|CREDENTIAL|PRIVATE_KEY|PEPPER|ROOT_KEY)(?:_\w+)?\s*[=:]\s*)[^\s]+/gi, '$1[REDACTED]');
const npm = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
}).trim();

let postgresServerVersion = null;
if (process.env.MIGRATION_TEST_DATABASE_URL) {
  let pool;
  try {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: process.env.MIGRATION_TEST_DATABASE_URL, connectionTimeoutMillis: 3000 });
    const result = await pool.query("SELECT current_setting('server_version') AS version");
    postgresServerVersion = result.rows[0]?.version ?? null;
  } catch {
    postgresServerVersion = null;
  } finally {
    await pool?.end();
  }
}

await writeFile(path.join(outputDirectory, 'phase0-gate.sanitized.log'), sanitizedLog, 'utf8');
const evidence = {
  gate: 'phase0',
  status: outcome === 'success' ? 'PASS' : outcome.toUpperCase(),
  commit: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  node: process.versions.node,
  npm,
  postgresServerVersion,
  requiredGateCommand: 'npm run verify:phase0',
  bddScenarios: Number(sanitizedLog.match(/(\d+) scenarios? \(\d+ passed\)/)?.[1] ?? 0),
  migrationFilesApplied: [...sanitizedLog.matchAll(/✅\s+([^\s]+\.sql) — applied/g)].map((match) => match[1]),
  testSummaries: [...sanitizedLog.matchAll(/Tests\s+(\d+) passed[^\n]*/g)].map((match) => match[0].trim()),
  generatedAt: new Date().toISOString(),
};
await writeFile(path.join(outputDirectory, 'phase0-ci-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`Wrote sanitized Phase 0 CI evidence (${evidence.status}).`);
