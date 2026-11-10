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

    it('installs the WP1.1 receipt schema constraints', async () => {
      const receiptColumns = await pool.query<{ column_name: string; is_nullable: string; data_type: string }>(
        `SELECT column_name, is_nullable, data_type
         FROM information_schema.columns
         WHERE table_schema = 'symphony' AND table_name = 'command_receipts'
         ORDER BY ordinal_position`,
      );
      const receiptNames = receiptColumns.rows.map((row) => row.column_name);
      expect(receiptNames).toEqual([
        'command_id', 'tenant_id', 'actor_user_id', 'command_type', 'recorded_at',
        'command_schema_version', 'canonicalization_version', 'digest_key_version',
        'semantic_digest', 'result_classification', 'result_schema_version', 'safe_result',
      ]);
      expect(receiptNames).not.toContain('payload');
      expect(receiptNames).not.toContain('device_id');
      expect(receiptNames).not.toContain('expected_version');
      expect(receiptNames).not.toContain('occurred_at');
      expect(receiptColumns.rows.every((row) => row.is_nullable === 'NO')).toBe(true);

      const receiptConstraints = await pool.query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
         WHERE conrelid = 'symphony.command_receipts'::regclass
         ORDER BY conname`,
      );
      const definitions = receiptConstraints.rows.map((row) => row.definition).join('\n');
      expect(definitions).toMatch(/PRIMARY KEY \(tenant_id, command_id\)/i);
      expect(definitions).toMatch(/octet_length\(semantic_digest\) = 32/i);
      expect(definitions).toMatch(/result_classification.*committed_success.*terminal_rejection/is);
      expect(definitions).not.toMatch(/UNIQUE \(command_id\)/i);

    });

    it('installs the minimized WP1.2 security-attempt table without business-command binding', async () => {
      const columns = await pool.query<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string; udt_name: string }>(
        `SELECT column_name, is_nullable, column_default, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'symphony' AND table_name = 'security_attempts'
         ORDER BY ordinal_position`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'security_attempt_id', 'tenant_id', 'actor_user_id', 'observed_command_id',
        'observed_command_type', 'denial_code', 'recorded_at',
      ]);
      expect(columns.rows.filter((row) => row.column_name !== 'observed_command_id' && row.column_name !== 'observed_command_type')
        .every((row) => row.is_nullable === 'NO')).toBe(true);
      expect(columns.rows.find((row) => row.column_name === 'security_attempt_id')?.column_default).toContain('gen_random_uuid');
      const byName = new Map(columns.rows.map((row) => [row.column_name, row]));
      expect(byName.get('security_attempt_id')).toMatchObject({ data_type: 'uuid', udt_name: 'uuid', is_nullable: 'NO' });
      expect(byName.get('tenant_id')).toMatchObject({ data_type: 'uuid', udt_name: 'uuid', is_nullable: 'NO' });
      expect(byName.get('actor_user_id')).toMatchObject({ data_type: 'uuid', udt_name: 'uuid', is_nullable: 'NO' });
      expect(byName.get('observed_command_id')).toMatchObject({ data_type: 'uuid', udt_name: 'uuid', is_nullable: 'YES' });
      expect(byName.get('observed_command_type')).toMatchObject({ data_type: 'text', udt_name: 'text', is_nullable: 'YES' });
      expect(byName.get('denial_code')).toMatchObject({ data_type: 'text', udt_name: 'text', is_nullable: 'NO' });
      expect(byName.get('recorded_at')).toMatchObject({ data_type: 'timestamp with time zone', udt_name: 'timestamptz', is_nullable: 'NO' });
      expect(byName.get('recorded_at')?.column_default).toMatch(/now\(\)/i);
      const constraints = await pool.query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = 'symphony.security_attempts'::regclass`,
      );
      const definitions = constraints.rows.map((row) => row.definition).join('\n');
      expect(definitions).toMatch(/PRIMARY KEY \(security_attempt_id\)/i);
      expect(definitions).toMatch(/AUTHORIZATION_DENIED/);
      expect(definitions).toMatch(/NOT_AUTHORISED_FOR_ORGANISATION/);
      expect(definitions).toMatch(/TENANT_MISMATCH/);
      expect(definitions).toMatch(/READ_ONLY_ROLE/);
      const foreignKeys = await pool.query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = 'symphony.security_attempts'::regclass AND contype = 'f'`,
      );
      expect(foreignKeys.rows.map((row) => row.definition)).toEqual(['FOREIGN KEY (tenant_id) REFERENCES tenants(id)']);
      expect(definitions).not.toMatch(/UNIQUE \(tenant_id, command_id\)/i);
      expect(columns.rows.map((row) => row.column_name)).not.toContain('semantic_digest');
      expect(columns.rows.map((row) => row.column_name)).not.toContain('payload');
      const tableAcl = await pool.query<{ acl: string }>(
        `SELECT COALESCE(relacl::text, '') AS acl FROM pg_class
         WHERE oid = 'symphony.security_attempts'::regclass`,
      );
      expect(tableAcl.rows[0]?.acl).not.toMatch(/symphony_app|(?:^|[,{])=/i);
    });

    it('aborts WP1.1 migration on a non-empty legacy receipt table without changing it', async () => {
      const fixtureSchema = 'wp1_receipt_guard_fixture';
      const sqlText = await fs.readFile(path.join(migrationDirectory, '0009_command_receipts_v2.sql'), 'utf8');
      const fixtureSql = sqlText
        .replaceAll('symphony.', '"wp1_receipt_guard_fixture".')
        .replaceAll("'symphony.command_receipts'", "'wp1_receipt_guard_fixture.command_receipts'");
      const client = await pool.connect();
      try {
        await client.query(`CREATE SCHEMA "${fixtureSchema}"`);
        await client.query(`CREATE TABLE "${fixtureSchema}".tenants (id UUID PRIMARY KEY)`);
        await client.query(`
          CREATE TABLE "${fixtureSchema}".command_receipts (
            command_id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            actor_user_id UUID NOT NULL,
            type TEXT NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}',
            occurred_at TIMESTAMPTZ NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            device_id TEXT,
            expected_version INT,
            result JSONB
          )
        `);
        const commandId = '24a679a7-e2e0-4788-9f96-6c1874406792';
        await client.query(
          `INSERT INTO "${fixtureSchema}".command_receipts
            (command_id, tenant_id, actor_user_id, type, occurred_at, payload)
           VALUES ($1, $2, $3, 'membership.update', now(), '{"sentinel":true}')`,
          [commandId, '4b92e2ac-b6b6-4ef8-981d-f92a9d1140ec', '69ec8dbd-8517-4cf7-ac59-3db4d6fc2065'],
        );

        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO "${fixtureSchema}", public`);
        await expect(client.query(fixtureSql)).rejects.toThrow(/non-empty command_receipts/i);
        await client.query('ROLLBACK');

        const preserved = await client.query<{ command_id: string; payload: { sentinel: boolean } }>(
          `SELECT command_id, payload FROM "${fixtureSchema}".command_receipts`,
        );
        expect(preserved.rows).toEqual([{ command_id: commandId, payload: { sentinel: true } }]);
        const columns = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = 'command_receipts' ORDER BY ordinal_position`,
          [fixtureSchema],
        );
        expect(columns.rows.map((row) => row.column_name)).toContain('payload');
        expect(columns.rows.map((row) => row.column_name)).not.toContain('safe_result');
      } finally {
        await client.query('ROLLBACK').catch(() => undefined);
        await client.query(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);
        client.release();
      }
    });
  },
);
