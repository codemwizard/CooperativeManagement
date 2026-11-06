import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
const tempDirectories = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Phase 0 script contracts', () => {
  it('defines each mandatory command and points it at its real operation', () => {
    const commandTargets = new Map([
      ['db:start', 'docker compose up --wait db -d'],
      ['db:stop', 'docker compose stop db'],
      ['db:migrate', 'packages/db/src/migrate.ts'],
      ['db:migrate:test', 'packages/db/src/migrate.ts'],
      ['test:unit', 'vitest run --reporter=verbose'],
      ['test:bdd', 'cucumber-js --config cucumber.cjs'],
      ['verify:trace', 'tools/verify-trace.ts'],
      ['verify:arch', '--config .dependency-cruiser.cjs'],
    ]);

    for (const [name, target] of commandTargets) {
      expect(scripts[name], `${name} must be defined`).toContain(target);
      if (target.endsWith('.ts')) expect(existsSync(path.join(root, target))).toBe(true);
    }
    expect(scripts['test:db:migrations']).toContain('tools/require_migration_test_db.mjs');
    expect(scripts['verify:legacy-floor']).toContain('npm run test');
    expect(scripts['verify:all']).toContain('npm run test:e2e');
  });

  it('runs required Phase 0 checks in order without optional or Phase 1 commands', () => {
    const aggregate = scripts['verify:phase0'];
    const required = [
      'test:toolchain', 'verify:toolchain', 'verify:archive-hygiene', 'typecheck:v4',
      'verify:arch', 'test:unit', 'test:db:migrations', 'test:bdd', 'verify:trace',
      'test:a11y', 'verify:legacy-floor',
    ];
    let previousIndex = -1;
    for (const name of required) {
      const match = new RegExp(`npm run ${name}(?=\\s|$)`).exec(aggregate);
      const index = match?.index ?? -1;
      expect(index, `${name} must be present`).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(aggregate).toContain('&&');
    expect(aggregate).not.toMatch(/--if-present|test:e2e|test:api|purge:seed|test:command/);
  });

  it('proves failure in a mandatory command stops later commands', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'phase0-script-contract-'));
    tempDirectories.push(directory);
    const marker = path.join(directory, 'must-not-exist.txt');
    const childPackage = {
      private: true,
      scripts: {
        fail: 'node -e "process.exit(23)"',
        later: `node -e "require('node:fs').writeFileSync('${marker.replace(/\\/g, '/')}', 'ran')"`,
        aggregate: 'npm run fail && npm run later',
      },
    };
    writeFileSync(path.join(directory, 'package.json'), JSON.stringify(childPackage));
    const npmExecPath = process.env.npm_execpath;
    const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = npmExecPath ? [npmExecPath, 'run', 'aggregate'] : ['run', 'aggregate'];
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: 'utf8',
      shell: !npmExecPath && process.platform === 'win32',
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(marker)).toBe(false);
  });
});
