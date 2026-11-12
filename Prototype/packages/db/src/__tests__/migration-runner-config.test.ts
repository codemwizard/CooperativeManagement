import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertMigrationSchema, isMigrationFilename, quoteMigrationSchema } from '../migration-safety.js';

const migrationRunner = fileURLToPath(new URL('../migrate.ts', import.meta.url));

describe('migration runner configuration safety', () => {
  it('accepts and safely quotes only the canonical schema', () => {
    expect(assertMigrationSchema('symphony')).toBe('symphony');
    expect(quoteMigrationSchema('symphony')).toBe('"symphony"');
    expect(isMigrationFilename('0006b_governance_stub.sql')).toBe(true);
    expect(isMigrationFilename('not-a-migration.sql')).toBe(false);
  });

  it.each(['public', 'symphony; DROP SCHEMA public CASCADE', '"symphony"']) (
    'rejects schema %j before opening a database connection',
    (schema) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', migrationRunner],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/symphony_test',
            DATABASE_SCHEMA: schema,
          },
          timeout: 10_000,
        },
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'DATABASE_SCHEMA must be exactly "symphony"',
      );
      expect(`${result.stdout}\n${result.stderr}`).not.toContain('ECONNREFUSED');
    },
  );
});
