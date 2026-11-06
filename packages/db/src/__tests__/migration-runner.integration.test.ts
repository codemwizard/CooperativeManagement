import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeSqlMigration } from '../migration-executor.js';

const testDatabaseUrl = process.env['MIGRATION_TEST_DATABASE_URL'];
const runnerPath = fileURLToPath(new URL('../migrate.ts', import.meta.url));
const migrationDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../migrations');

interface RunnerResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runMigrationProcess(): Promise<RunnerResult> {
  if (testDatabaseUrl === undefined || testDatabaseUrl === '') {
    throw new Error('MIGRATION_TEST_DATABASE_URL is required for migration integration tests.');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', runnerPath], {
      cwd: path.resolve(path.dirname(runnerPath), '..'),
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        DATABASE_SCHEMA: 'symphony',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function runSeedProcess(filename: string): Promise<RunnerResult> {
  if (testDatabaseUrl === undefined || testDatabaseUrl === '') {
    throw new Error('MIGRATION_TEST_DATABASE_URL is required for seed integration tests.');
  }
  const seedPath = path.resolve(path.dirname(runnerPath), 'seeds', filename);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', seedPath], {
      cwd: path.resolve(path.dirname(runnerPath), '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, DATABASE_SCHEMA: 'symphony' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status) => resolve({ status, stdout, stderr }));
  });
}

describe.skipIf(testDatabaseUrl === undefined || testDatabaseUrl === '')(
  'PostgreSQL migration runner integration',
  () => {
    const pool = new pg.Pool({ connectionString: testDatabaseUrl });

    beforeAll(async () => {
      if (testDatabaseUrl === undefined) throw new Error('Missing migration test database URL.');
      const parsed = new URL(testDatabaseUrl);
      const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      if (!databaseName.endsWith('_test') || process.env['DATA_MODE'] !== 'test') {
        throw new Error('Refusing destructive migration setup: use DATA_MODE=test and a *_test database.');
      }
      const identity = await pool.query<{ database_name: string; server_version_num: string }>(
        'SELECT current_database() AS database_name, current_setting(\'server_version_num\') AS server_version_num',
      );
      expect(identity.rows[0]?.database_name).toBe(databaseName);
      expect(Math.floor(Number(identity.rows[0]?.server_version_num) / 10000)).toBe(18);
      await pool.query('DROP SCHEMA IF EXISTS symphony CASCADE');
    }, 30_000);

    afterAll(async () => {
      await pool.end();
    });

    it('serializes concurrent clean installs and makes replay a no-op', async () => {
      const firstRun = await Promise.all([runMigrationProcess(), runMigrationProcess()]);
      for (const result of firstRun) {
        expect(`${result.stdout}\n${result.stderr}`).not.toContain('Migration runner failed:');
        expect(result.status).toBe(0);
      }

      const expectedFiles = (await fs.readdir(migrationDirectory))
        .filter((name) => name.endsWith('.sql'))
        .sort();
      const applied = await pool.query<{ name: string }>(
        'SELECT name FROM symphony.schema_migrations ORDER BY name',
      );
      expect(applied.rows.map((row) => row.name)).toEqual(expectedFiles);

      const appliedLogCount = firstRun
        .flatMap((result) => result.stdout.match(/— applied/g) ?? []).length;
      expect(appliedLogCount).toBe(expectedFiles.length);

      const replay = await runMigrationProcess();
      expect(replay.status).toBe(0);
      expect(replay.stdout).toContain('No new migrations to apply — database is up to date.');
      expect(replay.stdout).not.toContain('— applied');

      const version = await pool.query<{ server_version_num: string }>(
        'SELECT current_setting(\'server_version_num\') AS server_version_num',
      );
      expect(Math.floor(Number(version.rows[0]?.server_version_num) / 10000)).toBe(18);
    }, 90_000);

    it('rolls back a failed PostgreSQL migration without a ledger row and safely retries it', async () => {
      const filename = '9999_phase0_recovery_fixture.sql';
      const client = await pool.connect();
      try {
        await expect(executeSqlMigration(
          client,
          filename,
          'CREATE TABLE "symphony".phase0_recovery_fixture (id INTEGER PRIMARY KEY); INSERT INTO "symphony".phase0_recovery_fixture VALUES (1), (1);',
        )).rejects.toThrow('transaction rolled back');

        const failedTable = await client.query<{ relation: string | null }>(
          "SELECT to_regclass('symphony.phase0_recovery_fixture') AS relation",
        );
        expect(failedTable.rows[0]?.relation).toBeNull();
        const failedLedgerRow = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM symphony.schema_migrations WHERE name = $1',
          [filename],
        );
        expect(failedLedgerRow.rows[0]?.count).toBe('0');

        await executeSqlMigration(
          client,
          filename,
          'CREATE TABLE "symphony".phase0_recovery_fixture (id INTEGER PRIMARY KEY);',
        );
        const retriedTable = await client.query<{ relation: string | null }>(
          "SELECT to_regclass('symphony.phase0_recovery_fixture') AS relation",
        );
        expect(retriedTable.rows[0]?.relation).toBe('phase0_recovery_fixture');
        const retriedLedgerRow = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM symphony.schema_migrations WHERE name = $1',
          [filename],
        );
        expect(retriedLedgerRow.rows[0]?.count).toBe('1');
      } finally {
        await client.query('DROP TABLE IF EXISTS symphony.phase0_recovery_fixture');
        await client.query('DELETE FROM symphony.schema_migrations WHERE name = $1', [filename]);
        client.release();
      }
    });

    it('retains required schema invariants and applies the Phase 0 global seeds', async () => {
      const indexes = await pool.query<{ indexname: string; indexdef: string }>(
        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'symphony' AND indexname IN ('appointments_exclusive_position_uk', 'evidence_disputes_one_open_per_version') ORDER BY indexname",
      );
      expect(indexes.rows).toHaveLength(2);
      expect(indexes.rows.find((row) => row.indexname === 'appointments_exclusive_position_uk')?.indexdef)
        .toMatch(/WHERE.*ended_at IS NULL.*enforce_exclusive = true/i);
      expect(indexes.rows.find((row) => row.indexname === 'evidence_disputes_one_open_per_version')?.indexdef)
        .toMatch(/WHERE \(status = 'open'::text\)/i);

      const defaultValue = await pool.query<{ column_default: string | null }>(
        "SELECT column_default FROM information_schema.columns WHERE table_schema = 'symphony' AND table_name = 'precedence_policies' AND column_name = 'default_release_trigger'",
      );
      expect(defaultValue.rows[0]?.column_default).toContain('registered_current');
      const eventForeignKey = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE contype = 'f'
            AND conrelid = 'symphony.event_outbox'::regclass
            AND confrelid = 'symphony.domain_events'::regclass
        ) AS exists`,
      );
      expect(eventForeignKey.rows[0]?.exists).toBe(true);

      const tenant = await pool.query<{ id: string }>(
        "INSERT INTO symphony.tenants (name) VALUES ('phase0-invariant-fixture') RETURNING id",
      );
      const tenantId = tenant.rows[0]?.id;
      if (!tenantId) throw new Error('Could not create tenant for append-only invariant test.');
      const invariantClient = await pool.connect();
      try {
        await invariantClient.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenantId]);
        const event = await invariantClient.query<{ id: string }>(
          `INSERT INTO symphony.domain_events
            (tenant_id, aggregate_id, aggregate_type, event_type, occurred_at, sequence)
           VALUES ($1, gen_random_uuid(), 'phase0', 'InvariantFixture', now(), 1)
           RETURNING id`,
          [tenantId],
        );
        await expect(invariantClient.query(
          'UPDATE symphony.domain_events SET payload = $1 WHERE id = $2',
          [{ changed: true }, event.rows[0]?.id],
        )).rejects.toThrow('append-only');
      } finally {
        invariantClient.release();
      }

      for (const filename of ['precedence-policies.ts', 'membership-rules.ts']) {
        const result = await runSeedProcess(filename);
        expect(`${result.stdout}\n${result.stderr}`).not.toContain('Seed failed:');
        expect(result.status).toBe(0);
      }
      const precedence = await pool.query<{ value: string }>(
        'SELECT default_release_trigger AS value FROM symphony.precedence_policies WHERE organization_id IS NULL ORDER BY id LIMIT 1',
      );
      expect(precedence.rows[0]?.value).toBe('registered_current');
      const membership = await pool.query<{ value: string }>(
        "SELECT rule_value::text AS value FROM symphony.membership_rules WHERE organization_id IS NULL AND rule_type = 'allow_minor_members' ORDER BY id LIMIT 1",
      );
      expect(membership.rows[0]?.value).toBe('false');
    });
  },
);
