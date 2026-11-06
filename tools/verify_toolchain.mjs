import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateToolchain } from './toolchain-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relative) => readFile(path.join(root, relative), 'utf8');

try {
  const [expectedText, packageText, lockText, nvmrc, readme, workflow, compose] = await Promise.all([
    readText('toolchain.json'),
    readText('package.json'),
    readText('package-lock.json'),
    readText('.nvmrc'),
    readText('README.md'),
    readText('.github/workflows/ci.yml'),
    readText('docker-compose.yml'),
  ]);
  const npmVersion = process.env.npm_config_user_agent?.match(/(?:^|\s)npm\/([0-9.]+)/)?.[1]
    ?? execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }).trim();
  const failures = validateToolchain({
    expected: JSON.parse(expectedText),
    packageJson: JSON.parse(packageText),
    lockfile: JSON.parse(lockText),
    nvmrc,
    readme,
    workflow,
    compose,
    actualNode: process.versions.node,
    actualNpm: npmVersion,
  });
  if (failures.length) {
    console.error(`Toolchain mismatch in: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: Node ${process.versions.node}, npm ${npmVersion}, PostgreSQL ${JSON.parse(expectedText).postgresqlMajor}.`);
  }
} catch (error) {
  console.error(`Toolchain verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
