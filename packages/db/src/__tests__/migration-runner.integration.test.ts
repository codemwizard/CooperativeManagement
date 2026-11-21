import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as argon2 from 'argon2';
import pg from 'pg';
import { ARGON2ID_PARAMETERS, CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeSqlMigration } from '../migration-executor.js';
import {
  PasswordCredentialAlreadyEstablishedError,
  PostgresCredentialRepository,
  TemporaryCredentialUnavailableError,
} from '../repositories/postgres-credential-repository.js';
import { PostgresAuthSessionRepository } from '../repositories/postgres-auth-session-repository.js';

const migrationBaseUrl = process.env['MIGRATION_TEST_DATABASE_URL'];
const adminDatabaseUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const appDatabaseBaseUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'];
let testDatabaseUrl: string | undefined;
let appTestDatabaseUrl: string | undefined;
let isolatedDatabaseName: string | undefined;
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

describe.skipIf(!migrationBaseUrl || !adminDatabaseUrl || process.env['DATA_MODE'] !== 'test')(
  'PostgreSQL migration runner integration',
  () => {
    let pool: pg.Pool;

    beforeAll(async () => {
      if (!migrationBaseUrl || !adminDatabaseUrl || !appDatabaseBaseUrl) {
        throw new Error('Migration integration tests require separate migration, app-role and administrator test URLs.');
      }
      const admin = new pg.Client({ connectionString: adminDatabaseUrl });
      const migrationBase = new URL(migrationBaseUrl);
      const migrationRole = decodeURIComponent(migrationBase.username);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(migrationRole)) {
        throw new Error('Migration integration URL must identify a simple PostgreSQL role name.');
      }
      const sourceDatabase = decodeURIComponent(migrationBase.pathname.replace(/^\//, ''));
      if (!sourceDatabase.endsWith('_test')) {
        throw new Error('Refusing destructive migration setup: use DATA_MODE=test and a *_test database.');
      }
      await admin.connect();
      try {
        const identity = await admin.query<{ database_name: string; server_version_num: string; rolsuper: boolean; rolcreatedb: boolean }>(
          `SELECT current_database() AS database_name,
                  current_setting('server_version_num') AS server_version_num,
                  r.rolsuper,r.rolcreatedb
           FROM pg_roles r WHERE r.rolname=current_user`,
        );
        expect(identity.rows[0]?.database_name).toBe(sourceDatabase);
        expect(Math.floor(Number(identity.rows[0]?.server_version_num) / 10000)).toBe(18);
        if (!identity.rows[0]?.rolsuper && !identity.rows[0]?.rolcreatedb) {
          throw new Error('Migration integration isolation requires an administrator that can create/drop a disposable database.');
        }
        if (!identity.rows[0]?.rolsuper) {
          throw new Error('Migration integration isolation requires a PostgreSQL superuser URL to exercise role ownership migrations safely.');
        }
        isolatedDatabaseName = `symphony_migration_${randomUUID().replaceAll('-', '').slice(0, 20)}_test`;
        const quotedDatabase = `"${isolatedDatabaseName.replaceAll('"', '""')}"`;
        await admin.query(`CREATE DATABASE ${quotedDatabase}`);
        const quotedMigrationRole = `"${migrationRole.replaceAll('"', '""')}"`;
        await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${quotedDatabase} TO ${quotedMigrationRole}`);
        await admin.query(`GRANT CONNECT ON DATABASE ${quotedDatabase} TO symphony_app`);
        const isolatedUrl = new URL(migrationBaseUrl);
        isolatedUrl.pathname = `/${isolatedDatabaseName}`;
        testDatabaseUrl = isolatedUrl.toString();
        const isolatedAppUrl = new URL(appDatabaseBaseUrl);
        isolatedAppUrl.pathname = `/${isolatedDatabaseName}`;
        appTestDatabaseUrl = isolatedAppUrl.toString();
      } finally {
        await admin.end();
      }
      pool = new pg.Pool({ connectionString: testDatabaseUrl });
    }, 30_000);

    afterAll(async () => {
      await pool?.end();
      if (!isolatedDatabaseName || !adminDatabaseUrl) return;
      const admin = new pg.Client({ connectionString: adminDatabaseUrl });
      await admin.connect();
      try {
        if (isolatedDatabaseName) {
          await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [isolatedDatabaseName]);
          const quotedDatabase = `"${isolatedDatabaseName.replaceAll('"', '""')}"`;
          await admin.query(`DROP DATABASE IF EXISTS ${quotedDatabase}`);
        }
      } finally {
        await admin.end();
      }
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

      const outboxFunction = await pool.query<{
        owner: string;
        security_definer: boolean;
        configuration: string[] | null;
        app_execute: boolean;
        public_execute: boolean;
      }>(
        `SELECT pg_catalog.pg_get_userbyid(function_row.proowner) AS owner,
                function_row.prosecdef AS security_definer,
                function_row.proconfig AS configuration,
                EXISTS (
                  SELECT 1 FROM pg_catalog.aclexplode(
                    COALESCE(function_row.proacl, pg_catalog.acldefault('f', function_row.proowner))
                  ) AS privilege
                  WHERE privilege.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
                    AND privilege.privilege_type = 'EXECUTE'
                ) AS app_execute,
                EXISTS (
                  SELECT 1 FROM pg_catalog.aclexplode(
                    COALESCE(function_row.proacl, pg_catalog.acldefault('f', function_row.proowner))
                  ) AS privilege
                  WHERE privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
                ) AS public_execute
         FROM pg_catalog.pg_proc AS function_row
         JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_row.pronamespace
         WHERE function_row.oid = 'symphony.enqueue_command_outbox_message(uuid, uuid)'::regprocedure
           AND namespace.nspname = 'symphony'`,
      );
      expect(outboxFunction.rows).toHaveLength(1);
      expect(outboxFunction.rows[0]).toMatchObject({
        owner: 'symphony_outbox_writer',
        security_definer: true,
        configuration: ['search_path=pg_catalog, symphony'],
        app_execute: true,
        public_execute: false,
      });

      const roleCapabilities = await pool.query<{ migrator_can_set_writer: boolean; app_can_set_writer: boolean }>(
        `SELECT pg_catalog.pg_has_role($1::name, 'symphony_outbox_writer', 'SET') AS migrator_can_set_writer,
                pg_catalog.pg_has_role('symphony_app', 'symphony_outbox_writer', 'SET') AS app_can_set_writer`,
        [decodeURIComponent(new URL(migrationBaseUrl!).username)],
      );
      expect(roleCapabilities.rows).toEqual([{ migrator_can_set_writer: true, app_can_set_writer: false }]);
    }, 90_000);

    it('backfills legacy authority intervals across tenants while restoring forced RLS', async () => {
      const upgradeName = `symphony_wp23_interval_${randomUUID().replaceAll('-', '').slice(0, 16)}_test`;
      const quotedDatabase = `"${upgradeName.replaceAll('"', '""')}"`;
      const admin = new pg.Client({ connectionString: adminDatabaseUrl });
      await admin.connect();
      let migrationPool: pg.Pool | undefined;
      let fixture: pg.Client | undefined;
      try {
        await admin.query(`CREATE DATABASE ${quotedDatabase}`);
        const migrationUser = decodeURIComponent(new URL(migrationBaseUrl!).username);
        await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${quotedDatabase} TO "${migrationUser.replaceAll('"', '""')}"`);
        const migrationUrl = new URL(migrationBaseUrl!);
        migrationUrl.pathname = `/${upgradeName}`;
        migrationPool = new pg.Pool({ connectionString: migrationUrl.toString(), max: 1 });
        const migrationClient = await migrationPool.connect();
        try {
          await migrationClient.query('CREATE SCHEMA symphony');
          await migrationClient.query(`CREATE TABLE symphony.schema_migrations (
            name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
          const files = (await fs.readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
          for (const file of files.filter((name) => name < '0021_wp2_3_capacity_delegation_commands.sql')) {
            await executeSqlMigration(migrationClient, file, await fs.readFile(path.join(migrationDirectory, file), 'utf8'));
          }
        } finally { migrationClient.release(); }

        const fixtureUrl = new URL(adminDatabaseUrl!);
        fixtureUrl.pathname = `/${upgradeName}`;
        fixture = new pg.Client({ connectionString: fixtureUrl.toString() });
        await fixture.connect();
        const tenantIds = [randomUUID(), randomUUID()];
        const orgIds = [randomUUID(), randomUUID()];
        const unionIds = [randomUUID(), randomUUID()];
        const managerIds = [randomUUID(), randomUUID()];
        const delegateeIds = [randomUUID(), randomUUID()];
        for (let index = 0; index < tenantIds.length; index += 1) {
          const tenantId = tenantIds[index]!;
          const orgId = orgIds[index]!;
          const unionId = unionIds[index]!;
          const managerId = managerIds[index]!;
          const delegateeId = delegateeIds[index]!;
          await fixture.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, `legacy-rsl-${index}-${tenantId}`]);
          await fixture.query(
            `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
             VALUES($1,$3,$4,$4,'active'),($2,$3,$5,$5,'active')`,
            [managerId, delegateeId, tenantId, `legacy-manager-${tenantId}@example.invalid`, `legacy-ta-${tenantId}@example.invalid`],
          );
          await fixture.query(
            `INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind)
             VALUES($1,$2,$3,'active','cooperative'),($4,$2,$5,'active','union')`,
            [orgId, tenantId, `legacy-coop-${index}`, unionId, `legacy-union-${index}`],
          );
          await fixture.query(
            `INSERT INTO symphony.capacity_grants(id,user_id,organization_id,capacity_type,granted_by_user_id,granted_at)
             VALUES($1,$2,$3,'field_agent',$4,'2025-01-01T00:00:00Z')`,
            [randomUUID(), delegateeId, orgId, managerId],
          );
          await fixture.query(
            `INSERT INTO symphony.ta_scope_delegations(id,tenant_id,programme_manager_user_id,union_organization_id,
               delegatee_user_id,target_organization_id,granted_at,expires_at,agreement_ref)
             VALUES($1,$2,$3,$4,$5,$6,'2025-02-01T00:00:00Z','2026-02-01T00:00:00Z','legacy-agreement')`,
            [randomUUID(), tenantId, managerId, unionId, delegateeId, orgId],
          );
        }

        const upgradeClient = await migrationPool.connect();
        try {
          const identity = await upgradeClient.query<{ current_user: string }>('SELECT current_user');
          expect(identity.rows[0]?.current_user).toBe(decodeURIComponent(new URL(migrationBaseUrl!).username));
          await executeSqlMigration(
            upgradeClient,
            '0021_wp2_3_capacity_delegation_commands.sql',
            await fs.readFile(path.join(migrationDirectory, '0021_wp2_3_capacity_delegation_commands.sql'), 'utf8'),
          );
        } finally { upgradeClient.release(); }

        const backfilled = await fixture.query<{ capacity_count: number; capacity_dates: boolean; ta_count: number; ta_dates: boolean; capacity_forced: boolean; ta_forced: boolean }>(
          `SELECT
             (SELECT count(*)::int FROM symphony.capacity_grants) AS capacity_count,
             (SELECT bool_and(active_from=granted_at) FROM symphony.capacity_grants) AS capacity_dates,
             (SELECT count(*)::int FROM symphony.ta_scope_delegations) AS ta_count,
             (SELECT bool_and(active_from=granted_at) FROM symphony.ta_scope_delegations) AS ta_dates,
             (SELECT relforcerowsecurity FROM pg_class WHERE oid='symphony.capacity_grants'::regclass) AS capacity_forced,
             (SELECT relforcerowsecurity FROM pg_class WHERE oid='symphony.ta_scope_delegations'::regclass) AS ta_forced`,
        );
        expect(backfilled.rows[0]).toEqual({
          capacity_count: 2, capacity_dates: true, ta_count: 2, ta_dates: true, capacity_forced: true, ta_forced: true,
        });
      } finally {
        await migrationPool?.end();
        await fixture?.end();
        await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [upgradeName]).catch(() => undefined);
        await admin.query(`DROP DATABASE IF EXISTS ${quotedDatabase}`).catch(() => undefined);
        await admin.end();
      }
    }, 120_000);

    it('upgrades from migration 0012 and rolls every migration 0013 effect back before a successful retry', async () => {
      const upgradeDatabaseName = `symphony_wp15_upgrade_${randomUUID().replaceAll('-', '').slice(0, 16)}_test`;
      const quotedDatabase = `"${upgradeDatabaseName.replaceAll('"', '""')}"`;
      const admin = new pg.Client({ connectionString: adminDatabaseUrl });
      const migrationRole = decodeURIComponent(new URL(migrationBaseUrl!).username);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(migrationRole)) throw new Error('Migration URL role name is invalid.');
      await admin.connect();
      let client: pg.Client | undefined;
      try {
        await admin.query(`CREATE DATABASE ${quotedDatabase}`);
        const quotedMigrationRole = `"${migrationRole.replaceAll('"', '""')}"`;
        await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${quotedDatabase} TO ${quotedMigrationRole}`);

        const upgradeUrl = new URL(migrationBaseUrl!);
        upgradeUrl.pathname = `/${upgradeDatabaseName}`;
        client = new pg.Client({ connectionString: upgradeUrl.toString() });
        await client.connect();
        await client.query('CREATE SCHEMA symphony');
        await client.query(`
          CREATE TABLE symphony.schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);

        const migrationFiles = (await fs.readdir(migrationDirectory))
          .filter((name) => name.endsWith('.sql'))
          .sort();
        const migrationsThrough0012 = migrationFiles.filter((name) => name < '0013_tenant_rls_app_role.sql');
        expect(migrationsThrough0012.at(-1)).toBe('0012_reconciliation_inbox.sql');
        for (const filename of migrationsThrough0012) {
          await executeSqlMigration(client as pg.PoolClient, filename, await fs.readFile(path.join(migrationDirectory, filename), 'utf8'));
        }

        const migration0013 = await fs.readFile(path.join(migrationDirectory, '0013_tenant_rls_app_role.sql'), 'utf8');
        const beforePolicies = await client.query(
          `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
           FROM pg_catalog.pg_policies WHERE schemaname = 'symphony'
           ORDER BY tablename, policyname`,
        );
        const beforeGrants = await client.query(
          `SELECT grantee, table_name, privilege_type, is_grantable
           FROM information_schema.role_table_grants
           WHERE table_schema = 'symphony' AND grantee IN ('symphony_app', 'symphony_outbox_writer')
           ORDER BY grantee, table_name, privilege_type`,
        );
        const beforeTriggers = await client.query(
          `SELECT relation.relname AS table_name, trigger_row.tgname AS trigger_name,
                  trigger_row.tgenabled AS enabled, trigger_row.tgfoid::regprocedure::text AS function_name
           FROM pg_catalog.pg_trigger AS trigger_row
           JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_row.tgrelid
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE namespace.nspname = 'symphony' AND NOT trigger_row.tgisinternal
           ORDER BY relation.relname, trigger_row.tgname`,
        );
        const beforeRls = await client.query(
          `SELECT relation.relname AS table_name, relation.relrowsecurity, relation.relforcerowsecurity
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE namespace.nspname = 'symphony' AND relation.relkind IN ('r', 'p')
           ORDER BY relation.relname`,
        );
        await expect(executeSqlMigration(
          client as pg.PoolClient,
          '0013_tenant_rls_app_role.sql',
          `${migration0013}\nSELECT 1 / 0;`,
        )).rejects.toThrow('transaction rolled back');

        const ledger = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM symphony.schema_migrations
           WHERE name = '0013_tenant_rls_app_role.sql'`,
        );
        expect(ledger.rows[0]?.count).toBe('0');
        expect((await client.query("SELECT to_regprocedure('symphony.enqueue_command_outbox_message(uuid,uuid)') AS function_oid")).rows[0]?.function_oid).toBeNull();
        expect((await client.query(
          `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
           FROM pg_catalog.pg_policies WHERE schemaname = 'symphony'
           ORDER BY tablename, policyname`,
        )).rows).toEqual(beforePolicies.rows);
        expect((await client.query(
          `SELECT grantee, table_name, privilege_type, is_grantable
           FROM information_schema.role_table_grants
           WHERE table_schema = 'symphony' AND grantee IN ('symphony_app', 'symphony_outbox_writer')
           ORDER BY grantee, table_name, privilege_type`,
        )).rows).toEqual(beforeGrants.rows);
        expect((await client.query(
          `SELECT relation.relname AS table_name, trigger_row.tgname AS trigger_name,
                  trigger_row.tgenabled AS enabled, trigger_row.tgfoid::regprocedure::text AS function_name
           FROM pg_catalog.pg_trigger AS trigger_row
           JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_row.tgrelid
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE namespace.nspname = 'symphony' AND NOT trigger_row.tgisinternal
           ORDER BY relation.relname, trigger_row.tgname`,
        )).rows).toEqual(beforeTriggers.rows);
        expect((await client.query(
          `SELECT relation.relname AS table_name, relation.relrowsecurity, relation.relforcerowsecurity
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE namespace.nspname = 'symphony' AND relation.relkind IN ('r', 'p')
           ORDER BY relation.relname`,
        )).rows).toEqual(beforeRls.rows);

        await executeSqlMigration(client as pg.PoolClient, '0013_tenant_rls_app_role.sql', migration0013);
        const installed = await client.query<{ owner: string; security_definer: boolean; app_execute: boolean; public_execute: boolean }>(
          `SELECT pg_catalog.pg_get_userbyid(function_row.proowner) AS owner,
                  function_row.prosecdef AS security_definer,
                  EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(function_row.proacl, pg_catalog.acldefault('f', function_row.proowner))) AS acl
                          WHERE acl.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app') AND acl.privilege_type = 'EXECUTE') AS app_execute,
                  EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(function_row.proacl, pg_catalog.acldefault('f', function_row.proowner))) AS acl
                          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_row
           WHERE function_row.oid = 'symphony.enqueue_command_outbox_message(uuid, uuid)'::regprocedure`,
        );
        expect(installed.rows).toEqual([{
          owner: 'symphony_outbox_writer', security_definer: true, app_execute: true, public_execute: false,
        }]);
      } finally {
        await client?.end().catch(() => undefined);
        await admin.query(
          'SELECT pg_catalog.pg_terminate_backend(pid) FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND pid <> pg_catalog.pg_backend_pid()',
          [upgradeDatabaseName],
        ).catch(() => undefined);
        await admin.query(`DROP DATABASE IF EXISTS ${quotedDatabase}`).catch(() => undefined);
        await admin.end();
      }
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
        const retriedTable = await client.query<{ schema_name: string; relation_name: string }>(
          `SELECT namespace.nspname AS schema_name, relation.relname AS relation_name
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           WHERE relation.oid = pg_catalog.to_regclass('symphony.phase0_recovery_fixture')`,
        );
        expect(retriedTable.rows).toEqual([{ schema_name: 'symphony', relation_name: 'phase0_recovery_fixture' }]);
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
        await invariantClient.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
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
      const foreignKeys = await pool.query<{ source_schema: string; source_table: string; target_schema: string; target_table: string; source_columns: string[]; target_columns: string[] }>(
        `SELECT source_namespace.nspname AS source_schema,
                source_relation.relname AS source_table,
                target_namespace.nspname AS target_schema,
                target_relation.relname AS target_table,
                pg_catalog.to_json(array_agg(source_attribute.attname ORDER BY key_columns.ordinality)) AS source_columns,
                pg_catalog.to_json(array_agg(target_attribute.attname ORDER BY key_columns.ordinality)) AS target_columns
         FROM pg_catalog.pg_constraint AS constraint_row
         JOIN pg_catalog.pg_class AS source_relation ON source_relation.oid = constraint_row.conrelid
         JOIN pg_catalog.pg_namespace AS source_namespace ON source_namespace.oid = source_relation.relnamespace
         JOIN pg_catalog.pg_class AS target_relation ON target_relation.oid = constraint_row.confrelid
         JOIN pg_catalog.pg_namespace AS target_namespace ON target_namespace.oid = target_relation.relnamespace
         CROSS JOIN LATERAL unnest(constraint_row.conkey, constraint_row.confkey)
           WITH ORDINALITY AS key_columns(source_number, target_number, ordinality)
         JOIN pg_catalog.pg_attribute AS source_attribute
           ON source_attribute.attrelid = source_relation.oid AND source_attribute.attnum = key_columns.source_number
         JOIN pg_catalog.pg_attribute AS target_attribute
           ON target_attribute.attrelid = target_relation.oid AND target_attribute.attnum = key_columns.target_number
         WHERE constraint_row.conrelid = 'symphony.security_attempts'::regclass
           AND constraint_row.contype = 'f'
         GROUP BY source_namespace.nspname, source_relation.relname, target_namespace.nspname, target_relation.relname`,
      );
      expect(foreignKeys.rows).toEqual([{
        source_schema: 'symphony', source_table: 'security_attempts',
        target_schema: 'symphony', target_table: 'tenants',
        source_columns: ['tenant_id'], target_columns: ['id'],
      }]);
      expect(definitions).not.toMatch(/UNIQUE \(tenant_id, command_id\)/i);
      expect(columns.rows.map((row) => row.column_name)).not.toContain('semantic_digest');
      expect(columns.rows.map((row) => row.column_name)).not.toContain('payload');
      const tableAcl = await pool.query<{ acl: string }>(
        `SELECT COALESCE(relacl::text, '') AS acl FROM pg_class
         WHERE oid = 'symphony.security_attempts'::regclass`,
      );
      expect(tableAcl.rows[0]?.acl).toMatch(/symphony_app=a/i);
      expect(await pool.query("SELECT has_table_privilege('symphony_app','symphony.security_attempts','SELECT') AS select, has_table_privilege('symphony_app','symphony.security_attempts','INSERT') AS insert"))
        .toMatchObject({ rows: [{ select: false, insert: true }] });
    });

    it('installs separate tenant-bound credential tables with fixed expiry, Argon2id hashes and no delete grant', async () => {
      const tables = await pool.query<{ table_name: string; rls_enabled: boolean; rls_forced: boolean }>(
        `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='symphony' AND c.relname = ANY($1::text[]) ORDER BY c.relname`,
        [['temporary_credentials', 'password_credentials']],
      );
      expect(tables.rows).toEqual([
        { table_name: 'password_credentials', rls_enabled: true, rls_forced: true },
        { table_name: 'temporary_credentials', rls_enabled: true, rls_forced: true },
      ]);

      const constraints = await pool.query<{ table_name: string; constraint_name: string; definition: string }>(
        `SELECT relation.relname AS table_name, constraint_row.conname AS constraint_name,
                pg_get_constraintdef(constraint_row.oid) AS definition
         FROM pg_constraint constraint_row
         JOIN pg_class relation ON relation.oid=constraint_row.conrelid
         JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
         WHERE namespace.nspname='symphony'
           AND relation.relname = ANY($1::text[])
         ORDER BY relation.relname, constraint_row.conname`,
        [['temporary_credentials', 'password_credentials']],
      );
      expect(constraints.rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ table_name: 'temporary_credentials', constraint_name: 'temporary_credentials_fixed_lifetime_ck' }),
        expect.objectContaining({ table_name: 'temporary_credentials', constraint_name: 'temporary_credentials_terminal_state_ck' }),
        expect.objectContaining({ table_name: 'temporary_credentials', constraint_name: 'temporary_credentials_user_tenant_fk' }),
        expect.objectContaining({ table_name: 'password_credentials', constraint_name: 'password_credentials_user_tenant_fk' }),
      ]));
      expect(constraints.rows.find((row) => row.constraint_name === 'temporary_credentials_fixed_lifetime_ck')?.definition)
        .toMatch(/72:00:00/);
      expect(constraints.rows.find((row) => row.constraint_name === 'temporary_credentials_secret_hash_check')?.definition)
        .toMatch(/argon2id.*19456.*2.*1/i);

      const grants = await pool.query<{ table_name: string; privilege_type: string }>(
        `SELECT table_name, privilege_type FROM information_schema.role_table_grants
         WHERE table_schema='symphony' AND grantee='symphony_app'
           AND table_name = ANY($1::text[]) ORDER BY table_name, privilege_type`,
        [['temporary_credentials', 'password_credentials']],
      );
      expect(grants.rows).toEqual([
        { table_name: 'password_credentials', privilege_type: 'INSERT' },
        { table_name: 'password_credentials', privilege_type: 'SELECT' },
        { table_name: 'password_credentials', privilege_type: 'UPDATE' },
        { table_name: 'temporary_credentials', privilege_type: 'INSERT' },
        { table_name: 'temporary_credentials', privilege_type: 'SELECT' },
        { table_name: 'temporary_credentials', privilege_type: 'UPDATE' },
      ]);
    });

    it('proves secret redaction while atomically consuming temporary credentials and establishing permanent passwords', async () => {
      const repository = new PostgresCredentialRepository(pool);
      if (!appTestDatabaseUrl) throw new Error('The isolated app-role database URL was not initialized.');
      const appRolePool = new pg.Pool({ connectionString: appTestDatabaseUrl, max: 1 });
      const service = new CredentialLifecycleService({ now: () => new Date().toISOString() });
      const tenantId = randomUUID();
      const primaryUser = randomUUID();
      const rollbackUser = randomUUID();
      const boundaryUser = randomUUID();
      const foreignTenantId = randomUUID();
      const foreignUserId = randomUUID();
      const userIds = [primaryUser, rollbackUser, boundaryUser];

      try {
        await pool.query('INSERT INTO symphony.tenants (id,name) VALUES ($1,$2),($3,$4)', [
          tenantId, 'wp5.2-synthetic', foreignTenantId, 'wp5.2-foreign-synthetic',
        ]);
        for (const [fixtureTenant, fixtureUsers] of [[tenantId, userIds], [foreignTenantId, [foreignUserId]]] as const) {
          const fixtureClient = await pool.connect();
          try {
            await fixtureClient.query('BEGIN');
            await fixtureClient.query("SELECT set_config('app.tenant_id', $1, true)", [fixtureTenant]);
            for (const userId of fixtureUsers) {
              await fixtureClient.query(
                `INSERT INTO symphony.users (id,tenant_id,email,email_normalized,status)
                 VALUES ($1,$2,$3,$3,'active')`,
                [userId, fixtureTenant, `wp5.2-${userId}@example.invalid`],
              );
            }
            await fixtureClient.query('COMMIT');
          } catch (error) {
            await fixtureClient.query('ROLLBACK').catch(() => undefined);
            throw error;
          } finally {
            fixtureClient.release();
          }
        }

        const temporaryPlaintextCanary = `TEMP_CREDENTIAL_CANARY_${randomUUID()}`;
        const temporaryCredentialId = randomUUID();
        const temporaryHash = await argon2.hash(temporaryPlaintextCanary, {
          type: argon2.argon2id,
          ...ARGON2ID_PARAMETERS,
        });
        const storedTemporary = await repository.issueTemporaryCredential({
          credentialId: temporaryCredentialId, tenantId, userId: primaryUser, secretHash: temporaryHash,
        });
        expect(storedTemporary.id).toBe(temporaryCredentialId);
        expect(Date.parse(storedTemporary.expiresAt) - Date.parse(storedTemporary.issuedAt)).toBe(72 * 60 * 60 * 1000);
        const currentTemporary = await repository.findCurrentTemporaryCredential(tenantId, primaryUser);
        expect(currentTemporary).toMatchObject({ id: storedTemporary.id, consumedAt: null, revokedAt: null });
        expect(currentTemporary!.secretHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        const lookupClient = await appRolePool.connect();
        try {
          await lookupClient.query('BEGIN');
          await lookupClient.query('SET LOCAL ROLE symphony_app');
          const loginLookup = await lookupClient.query<{tenant_id:string;temporary_credential_id:string;temporary_secret_hash:string}>(
            'SELECT tenant_id,temporary_credential_id,temporary_secret_hash FROM symphony.lookup_auth_subject($1::uuid)',[primaryUser],
          );
          expect(loginLookup.rows).toEqual([{
            tenant_id:tenantId,temporary_credential_id:storedTemporary.id,temporary_secret_hash:temporaryHash,
          }]);
          await expect(lookupClient.query('SELECT user_id FROM symphony.auth_user_tenant_index WHERE user_id=$1',[primaryUser]))
            .rejects.toMatchObject({code:'42501'});
          await lookupClient.query('ROLLBACK');
        } catch (error) { await lookupClient.query('ROLLBACK').catch(()=>undefined); throw error; }
        finally { lookupClient.release(); }
        expect(JSON.stringify(currentTemporary)).not.toContain(temporaryPlaintextCanary);
        expect(await service.verifyTemporaryCredential(temporaryPlaintextCanary, {
          credentialId: currentTemporary!.id,
          hash: currentTemporary!.secretHash,
          issuedAt: currentTemporary!.issuedAt,
          expiresAt: currentTemporary!.expiresAt,
        })).toBe('valid');
        expect(await service.verifyTemporaryCredential(`WRONG_${temporaryPlaintextCanary}`, {
          credentialId: currentTemporary!.id,
          hash: currentTemporary!.secretHash,
          issuedAt: currentTemporary!.issuedAt,
          expiresAt: currentTemporary!.expiresAt,
        })).toBe('invalid');
        expect((await repository.findCurrentTemporaryCredential(tenantId, primaryUser))?.consumedAt).toBeNull();

        const permanentPasswordCanaryA = `PERMANENT_PASSWORD_CANARY_A_${randomUUID()}`;
        const permanentPasswordCanaryB = `PERMANENT_PASSWORD_CANARY_B_${randomUUID()}`;
        const wrongPasswordCanary = `WRONG_PASSWORD_CANARY_${randomUUID()}`;
        const [passwordA, passwordB] = await Promise.all([
          service.hashPermanentPassword(permanentPasswordCanaryA),
          service.hashPermanentPassword(permanentPasswordCanaryB),
        ]);
        const concurrent = await Promise.allSettled([
          repository.establishPermanentPassword({
            tenantId, userId: primaryUser, temporaryCredentialId: storedTemporary.id, passwordHash: passwordA,
          }),
          repository.establishPermanentPassword({
            tenantId, userId: primaryUser, temporaryCredentialId: storedTemporary.id, passwordHash: passwordB,
          }),
        ]);
        expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect(concurrent.find((result) => result.status === 'rejected'))
          .toMatchObject({ reason: expect.any(TemporaryCredentialUnavailableError) });
        const establishedHash = await repository.findPermanentPasswordHash(tenantId, primaryUser);
        expect(establishedHash === passwordA || establishedHash === passwordB).toBe(true);
        expect(establishedHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        const winningPasswordCanary = establishedHash === passwordA ? permanentPasswordCanaryA : permanentPasswordCanaryB;
        const losingPasswordCanary = establishedHash === passwordA ? permanentPasswordCanaryB : permanentPasswordCanaryA;
        expect(await service.verifyPermanentPassword(winningPasswordCanary, establishedHash!)).toBe(true);
        expect(await service.verifyPermanentPassword(losingPasswordCanary, establishedHash!)).toBe(false);
        expect(await service.verifyPermanentPassword(wrongPasswordCanary, establishedHash!)).toBe(false);

        const persistenceClient = await appRolePool.connect();
        let persistedTemporary: { rows: { secret_hash: string }[] };
        let persistedPermanent: { rows: { secret_hash: string }[] };
        try {
          await persistenceClient.query('BEGIN');
          await persistenceClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          persistedTemporary = await persistenceClient.query<{ secret_hash: string }>(
            'SELECT secret_hash FROM symphony.temporary_credentials WHERE id=$1', [storedTemporary.id],
          );
          persistedPermanent = await persistenceClient.query<{ secret_hash: string }>(
            'SELECT secret_hash FROM symphony.password_credentials WHERE tenant_id=$1 AND user_id=$2', [tenantId, primaryUser],
          );
          await persistenceClient.query('COMMIT');
        } catch (error) {
          await persistenceClient.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          persistenceClient.release();
        }
        expect(persistedTemporary.rows).toHaveLength(1);
        expect(persistedPermanent.rows).toHaveLength(1);
        expect(persistedTemporary.rows[0]!.secret_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        expect(persistedPermanent.rows[0]!.secret_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
        const persistedText = JSON.stringify({
          temporary: persistedTemporary.rows,
          permanent: persistedPermanent.rows,
        });
        for (const canary of [temporaryPlaintextCanary, permanentPasswordCanaryA, permanentPasswordCanaryB]) {
          expect(persistedText).not.toContain(canary);
        }

        const scopedClient = await appRolePool.connect();
        try {
          await scopedClient.query('BEGIN');
          await scopedClient.query('SET LOCAL ROLE symphony_app');
          await scopedClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          expect((await scopedClient.query(
            'SELECT id FROM symphony.temporary_credentials WHERE id=$1', [storedTemporary.id],
          )).rows).toEqual([{ id: storedTemporary.id }]);
          expect((await scopedClient.query(
            'SELECT id FROM symphony.password_credentials WHERE tenant_id=$1 AND user_id=$2', [tenantId, primaryUser],
          )).rowCount).toBe(1);
          await scopedClient.query("SELECT set_config('app.tenant_id', $1, true)", [foreignTenantId]);
          expect((await scopedClient.query(
            'SELECT id FROM symphony.temporary_credentials WHERE id=$1', [storedTemporary.id],
          )).rowCount).toBe(0);
          expect((await scopedClient.query(
            'SELECT id FROM symphony.password_credentials WHERE user_id=$1', [primaryUser],
          )).rowCount).toBe(0);
          await scopedClient.query('ROLLBACK');

          await scopedClient.query('BEGIN');
          await scopedClient.query('SET LOCAL ROLE symphony_app');
          await scopedClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          await expect(scopedClient.query(
            'UPDATE symphony.temporary_credentials SET tenant_id=$1 WHERE id=$2', [foreignTenantId, storedTemporary.id],
          )).rejects.toMatchObject({ code: '42501' });
          await scopedClient.query('ROLLBACK');

          await scopedClient.query('BEGIN');
          await scopedClient.query('SET LOCAL ROLE symphony_app');
          await scopedClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          await expect(scopedClient.query(
            'DELETE FROM symphony.temporary_credentials WHERE id=$1', [storedTemporary.id],
          )).rejects.toMatchObject({ code: '42501' });
          await scopedClient.query('ROLLBACK');
        } finally {
          scopedClient.release();
        }
        await expect(repository.establishPermanentPassword({
          tenantId, userId: primaryUser, temporaryCredentialId: storedTemporary.id, passwordHash: passwordA,
        })).rejects.toBeInstanceOf(TemporaryCredentialUnavailableError);
        await expect(repository.issueTemporaryCredential({
          credentialId: randomUUID(), tenantId, userId: primaryUser, secretHash: temporaryHash,
        }))
          .rejects.toBeInstanceOf(PasswordCredentialAlreadyEstablishedError);

        const rollbackTemporary = await service.issueTemporaryCredential();
        const storedRollbackTemporary = await repository.issueTemporaryCredential({
          credentialId: rollbackTemporary.credentialId, tenantId, userId: rollbackUser, secretHash: rollbackTemporary.hash,
        });
        const existingPassword = await service.hashPermanentPassword('first permanent password phrase');
        const passwordFixture = await pool.connect();
        try {
          await passwordFixture.query('BEGIN');
          await passwordFixture.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          await passwordFixture.query(
            'INSERT INTO symphony.password_credentials (tenant_id,user_id,secret_hash) VALUES ($1,$2,$3)',
            [tenantId, rollbackUser, existingPassword],
          );
          await passwordFixture.query('COMMIT');
        } catch (error) {
          await passwordFixture.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          passwordFixture.release();
        }
        await expect(repository.establishPermanentPassword({
          tenantId,
          userId: rollbackUser,
          temporaryCredentialId: storedRollbackTemporary.id,
          passwordHash: await service.hashPermanentPassword('second permanent password phrase'),
        })).rejects.toBeInstanceOf(PasswordCredentialAlreadyEstablishedError);
        expect((await repository.findCurrentTemporaryCredential(tenantId, rollbackUser))?.consumedAt).toBeNull();
        expect(await repository.findPermanentPasswordHash(tenantId, rollbackUser)).toBe(existingPassword);

        const boundaryTemporary = await service.issueTemporaryCredential();
        const storedBoundaryTemporary = await repository.issueTemporaryCredential({
          credentialId: boundaryTemporary.credentialId, tenantId, userId: boundaryUser, secretHash: boundaryTemporary.hash,
        });
        const boundaryClient = await pool.connect();
        try {
          await boundaryClient.query('BEGIN');
          await boundaryClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          await boundaryClient.query(
            `WITH expiry AS (SELECT transaction_timestamp() AS instant)
             UPDATE symphony.temporary_credentials AS credential
             SET issued_at = expiry.instant - INTERVAL '72 hours', expires_at = expiry.instant
             FROM expiry WHERE credential.id = $1`,
            [storedBoundaryTemporary.id],
          );
          const boundary = await boundaryClient.query<{ is_valid: boolean }>(
            `SELECT expires_at > transaction_timestamp() AS is_valid
             FROM symphony.temporary_credentials WHERE id = $1`,
            [storedBoundaryTemporary.id],
          );
          expect(boundary.rows[0]?.is_valid).toBe(false);
          await boundaryClient.query('ROLLBACK');
        } catch (error) {
          await boundaryClient.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          boundaryClient.release();
        }
      } finally {
        await appRolePool.end();
        const cleanup = await pool.connect();
        try {
          await cleanup.query('BEGIN');
          await cleanup.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
          await cleanup.query('DELETE FROM symphony.temporary_credentials WHERE tenant_id=$1', [tenantId]);
          await cleanup.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1', [tenantId]);
          await cleanup.query('DELETE FROM symphony.users WHERE tenant_id=$1', [tenantId]);
          await cleanup.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]);
          await cleanup.query("SELECT set_config('app.tenant_id', $1, true)", [foreignTenantId]);
          await cleanup.query('DELETE FROM symphony.users WHERE tenant_id=$1', [foreignTenantId]);
          await cleanup.query('DELETE FROM symphony.tenants WHERE id=$1', [foreignTenantId]);
          await cleanup.query('COMMIT');
        } catch (error) {
          await cleanup.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          cleanup.release();
        }
      }
    }, 30_000);

    it('installs only encrypted reconciliation payload and forced tenant RLS', async () => {
      const columns = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = 'symphony' AND table_name = 'reconciliation_inbox' ORDER BY ordinal_position`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'reconciliation_id', 'tenant_id', 'payload_ciphertext', 'encryption_key_ref',
        'reason_code', 'lifecycle', 'created_at', 'updated_at', 'expires_at', 'tombstoned_at',
      ]);
      expect(columns.rows.find((row) => row.column_name === 'payload_ciphertext')).toMatchObject({ data_type: 'bytea', is_nullable: 'YES' });
      expect(columns.rows.find((row) => row.column_name === 'tenant_id')).toMatchObject({ data_type: 'uuid', is_nullable: 'NO' });
      expect(columns.rows.map((row) => row.column_name)).not.toContain('command_id');
      expect(columns.rows.map((row) => row.column_name)).not.toContain('actor_user_id');
      expect(columns.rows.map((row) => row.column_name)).not.toContain('aggregate_id');
      const constraints = await pool.query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = 'symphony.reconciliation_inbox'::regclass`,
      );
      const definitions = constraints.rows.map((row) => row.definition).join('\n');
      expect(definitions).toMatch(/reason_code = 'VERSION_CONFLICT'/i);
      expect(definitions).toMatch(/lifecycle.*open.*resolved.*superseded.*expired/is);
      expect(definitions).toMatch(/lifecycle = 'expired'.*payload_ciphertext IS NULL.*encryption_key_ref IS NULL.*tombstoned_at IS NOT NULL/is);
      expect(definitions).toMatch(/\['resolved'::text, 'superseded'::text\]/i);
      expect(definitions).toMatch(/payload_ciphertext IS NULL.*encryption_key_ref IS NULL.*tombstoned_at IS NOT NULL/is);
      const rls = await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'symphony.reconciliation_inbox'::regclass`,
      );
      expect(rls.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      const policy = await pool.query<{ qual: string | null; with_check: string | null }>(
        `SELECT qual, with_check FROM pg_policies
         WHERE schemaname = 'symphony' AND tablename = 'reconciliation_inbox' AND policyname = 'reconciliation_inbox_tenant_scope'`,
      );
      expect(policy.rows).toHaveLength(1);
      expect(policy.rows[0]?.qual).toContain("current_setting('app.tenant_id'::text, true)");
      expect(policy.rows[0]?.with_check).toContain("current_setting('app.tenant_id'::text, true)");
      const tableAcl = await pool.query<{ acl: string }>(
        `SELECT COALESCE(relacl::text, '') AS acl FROM pg_class WHERE oid = 'symphony.reconciliation_inbox'::regclass`,
      );
      expect(tableAcl.rows[0]?.acl).toMatch(/symphony_app=arw/i);
      expect(tableAcl.rows[0]?.acl).not.toMatch(/symphony_app=[^/]*d/i);
    });

    it('persists opaque sessions, revokes all sessions at password change, and serializes shared throttle delays across pools', async () => {
      const tenantId = randomUUID();
      const userId = randomUUID();
      const tempId = randomUUID();
      if (!appTestDatabaseUrl) throw new Error('The isolated app-role database URL was not initialized.');
      const repoOnePool = new pg.Pool({ connectionString: appTestDatabaseUrl, max: 1 });
      const repoTwoPool = new pg.Pool({ connectionString: appTestDatabaseUrl, max: 1 });
      const repoOne = new PostgresAuthSessionRepository(repoOnePool);
      const repoTwo = new PostgresAuthSessionRepository(repoTwoPool);
      const rawTemporary = `WP53_TEMP_${randomUUID()}`;
      const secretHash = await argon2.hash(rawTemporary, { type: argon2.argon2id, ...ARGON2ID_PARAMETERS });
      const passwordHash = await argon2.hash(`WP53_PASSWORD_${randomUUID()}`, { type: argon2.argon2id, ...ARGON2ID_PARAMETERS });
      const accountHmac = createHash('sha256').update(randomUUID()).digest();
      const sourceHmac = createHash('sha256').update(randomUUID()).digest();
      const resetSourceHmac = createHash('sha256').update(randomUUID()).digest();
      const boundarySourceHmac = createHash('sha256').update(randomUUID()).digest();
      const combinedAccountHmac = createHash('sha256').update(randomUUID()).digest();
      const combinedSourceHmac = createHash('sha256').update(randomUUID()).digest();
      const rawTokenA = randomBytes(32).toString('base64url');
      const rawTokenB = randomBytes(32).toString('base64url');
      const tokenA = createHash('sha256').update(rawTokenA).digest();
      const tokenB = createHash('sha256').update(rawTokenB).digest();
      const tokenC = createHash('sha256').update(randomBytes(32).toString('base64url')).digest();
      const tokenD = createHash('sha256').update(randomBytes(32).toString('base64url')).digest();
      const tokenE = createHash('sha256').update(randomBytes(32).toString('base64url')).digest();
      const tokenF = createHash('sha256').update(randomBytes(32).toString('base64url')).digest();
      const csrfA = createHash('sha256').update(randomUUID()).digest();
      const csrfB = createHash('sha256').update(randomUUID()).digest();
      const csrfC = createHash('sha256').update(randomUUID()).digest();
      const csrfD = createHash('sha256').update(randomUUID()).digest();
      const csrfE = createHash('sha256').update(randomUUID()).digest();
      const csrfF = createHash('sha256').update(randomUUID()).digest();
      const preAuthA = createHash('sha256').update(randomUUID()).digest();
      const preAuthB = createHash('sha256').update(randomUUID()).digest();
      const preAuthD = createHash('sha256').update(randomUUID()).digest();
      const preAuthReplay = createHash('sha256').update(randomUUID()).digest();
      try {
        for (const rolePool of [repoOnePool,repoTwoPool]) {
          const roleClient=await rolePool.connect();
          try { await roleClient.query('SET ROLE symphony_app'); }
          finally { roleClient.release(); }
        }
        await pool.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId,'wp5.3-session-fixture']);
        const fixtureClient = await pool.connect();
        try {
          await fixtureClient.query('BEGIN');
          await fixtureClient.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
          await fixtureClient.query(
            `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status) VALUES($1,$2,$3,$3,'active')`,
            [userId,tenantId,`wp5.3-${userId}@example.invalid`],
          );
          await fixtureClient.query('COMMIT');
        } catch (error) { await fixtureClient.query('ROLLBACK').catch(()=>undefined); throw error; }
        finally { fixtureClient.release(); }
        const credentialRepository = new PostgresCredentialRepository(pool);
        await credentialRepository.issueTemporaryCredential({ credentialId:tempId,tenantId,userId,secretHash });
        const temp = await credentialRepository.findCurrentTemporaryCredential(tenantId,userId);
        expect(temp?.id).toBe(tempId);

        await repoOne.createPreAuthSession(preAuthA,csrfA);
        await repoTwo.createPreAuthSession(preAuthB,csrfB);
        await Promise.all([
          repoOne.createAuthenticatedSession({preAuthTokenHash:preAuthA,tokenHash:tokenA,csrfHash:csrfA,tenantId,userId,deviceId:'device-a',temporaryCredentialId:tempId,forcedChangeRequired:true}),
          repoTwo.createAuthenticatedSession({preAuthTokenHash:preAuthB,tokenHash:tokenB,csrfHash:csrfB,tenantId,userId,deviceId:'device-b',temporaryCredentialId:tempId,forcedChangeRequired:true}),
        ]);
        expect((await repoOne.findSession(tokenA))?.forcedChangeRequired).toBe(true);
        expect((await repoTwo.findSession(tokenB))?.userId).toBe(userId);
        const persistedTokens = await pool.query<{ token_hash: Buffer; csrf_hash: Buffer }>(
          'SELECT token_hash,csrf_hash FROM symphony.auth_sessions WHERE user_id=$1 ORDER BY device_id',[userId],
        );
        expect(persistedTokens.rows).toHaveLength(2);
        expect(persistedTokens.rows.some((row)=>row.token_hash.equals(tokenA))).toBe(true);
        expect(persistedTokens.rows.some((row)=>row.token_hash.toString('base64url')===rawTokenA || row.token_hash.toString('base64url')===rawTokenB)).toBe(false);

        await repoOne.createPreAuthSession(preAuthReplay,csrfA);
        const replayed=await Promise.allSettled([
          repoOne.createAuthenticatedSession({preAuthTokenHash:preAuthReplay,tokenHash:tokenE,csrfHash:csrfE,tenantId,userId,deviceId:'replay-e',temporaryCredentialId:tempId,forcedChangeRequired:true}),
          repoTwo.createAuthenticatedSession({preAuthTokenHash:preAuthReplay,tokenHash:tokenF,csrfHash:csrfF,tenantId,userId,deviceId:'replay-f',temporaryCredentialId:tempId,forcedChangeRequired:true}),
        ]);
        expect(replayed.filter((result)=>result.status==='fulfilled')).toHaveLength(1);
        expect(replayed.filter((result)=>result.status==='rejected')).toHaveLength(1);
        const replaySessions=await pool.query<{token_hash:Buffer}>(
          'SELECT token_hash FROM symphony.auth_sessions WHERE (token_hash=$1 OR token_hash=$2) AND revoked_at IS NULL',[tokenE,tokenF],
        );
        expect(replaySessions.rows).toHaveLength(1);
        await repoOne.revokeSession(replaySessions.rows[0]!.token_hash,tenantId);

        await repoOne.revokeSession(tokenA,tenantId);
        expect((await repoOne.findSession(tokenA))?.revokedAt).not.toBeNull();
        expect((await repoTwo.findSession(tokenB))?.revokedAt).toBeNull();
        expect(await repoOne.rotateAuthenticatedSession({previousTokenHash:tokenB,nextTokenHash:tokenC,nextCsrfHash:csrfC,tenantId})).toBe(true);
        expect((await repoTwo.findSession(tokenB))?.revokedAt).not.toBeNull();
        expect((await repoOne.findSession(tokenC))?.revokedAt).toBeNull();
        await repoOne.createPreAuthSession(preAuthD,csrfD);
        await repoOne.createAuthenticatedSession({preAuthTokenHash:preAuthD,tokenHash:tokenD,csrfHash:csrfD,tenantId,userId,deviceId:'device-d',temporaryCredentialId:tempId,forcedChangeRequired:true});

        await pool.query(
          `WITH instant AS (SELECT clock_timestamp() AS t)
           UPDATE symphony.auth_sessions s SET issued_at=instant.t-INTERVAL '12 hours',
             last_activity_at=instant.t,absolute_expires_at=instant.t
           FROM instant WHERE s.token_hash=$1`,[tokenC],
        );
        expect(await repoTwo.touchSession(tokenC,tenantId)).toBe(false);
        await pool.query('UPDATE symphony.auth_sessions SET last_activity_at=clock_timestamp()-INTERVAL \'30 minutes\' WHERE token_hash=$1',[tokenD]);
        expect(await repoOne.touchSession(tokenD,tenantId)).toBe(false);

        await repoOne.establishPasswordAndRevokeSessions({tenantId,userId,temporaryCredentialId:tempId,passwordHash});
        expect((await repoOne.findSession(tokenA))?.revokedAt).not.toBeNull();
        expect((await repoTwo.findSession(tokenB))?.revokedAt).not.toBeNull();
        expect((await repoOne.findSession(tokenC))?.revokedAt).not.toBeNull();
        expect((await repoOne.findSession(tokenD))?.revokedAt).not.toBeNull();
        expect(await credentialRepository.findPermanentPasswordHash(tenantId,userId)).toBe(passwordHash);

        const steps: number[] = [];
        for (let index=0;index<5;index++) {
          const attempt=await repoOne.reserveAttempt(accountHmac,sourceHmac);
          steps.push(attempt.delayMs);
          await repoOne.finishAttempt({attemptId:attempt.attemptId,accountHmac,sourceHmac,success:false});
        }
        expect(steps).toEqual([0,0,0,0,0]);
        let arrivals=0;let releaseBarrier!:()=>void;
        const barrier=new Promise<void>((resolve)=>{releaseBarrier=resolve;});
        const concurrentReserve=(repository:PostgresAuthSessionRepository)=>{
          arrivals+=1;if(arrivals===2)releaseBarrier();
          return barrier.then(()=>repository.reserveAttempt(accountHmac,sourceHmac));
        };
        const concurrent=await Promise.all([concurrentReserve(repoOne),concurrentReserve(repoTwo)]);
        expect(concurrent.map((attempt)=>attempt.delayMs).sort((a,b)=>a-b)).toEqual([1000,2000]);
        await Promise.all(concurrent.map((attempt)=>repoOne.finishAttempt({attemptId:attempt.attemptId,accountHmac,sourceHmac,success:false})));
        const capped=await repoTwo.reserveAttempt(accountHmac,sourceHmac);
        expect(capped.delayMs).toBe(4_000);
        await repoTwo.finishAttempt({attemptId:capped.attemptId,accountHmac,sourceHmac,success:false});
        const laterDelays: number[] = [];
        for (const expectedDelay of [8_000,16_000,32_000]) {
          const attempt=await repoOne.reserveAttempt(accountHmac,sourceHmac);
          laterDelays.push(attempt.delayMs);
          await repoOne.finishAttempt({attemptId:attempt.attemptId,accountHmac,sourceHmac,success:false});
          expect(attempt.delayMs).toBe(expectedDelay);
        }
        expect(laterDelays).toEqual([8_000,16_000,32_000]);
        const successfulAttempt=await repoOne.reserveAttempt(accountHmac,sourceHmac);
        await repoOne.finishAttempt({attemptId:successfulAttempt.attemptId,accountHmac,sourceHmac,success:true});
        const retainedSource=await repoTwo.reserveAttempt(accountHmac,sourceHmac);
        expect(retainedSource.delayMs).toBe(32_000);
        await repoTwo.finishAttempt({attemptId:retainedSource.attemptId,accountHmac,sourceHmac,success:false});
        const reset=await repoTwo.reserveAttempt(accountHmac,resetSourceHmac);
        expect(reset.delayMs).toBe(0);
        await repoTwo.finishAttempt({attemptId:reset.attemptId,accountHmac,sourceHmac:resetSourceHmac,success:false});

        await pool.query(
          `INSERT INTO symphony.auth_attempt_events(attempt_id,dimension,identity_hmac,state,occurred_at)
           VALUES($1,'account',$2,'failed',clock_timestamp()-INTERVAL '15 minutes'),
                 ($3,'trusted_source',$4,'reserved',clock_timestamp()-INTERVAL '15 minutes')`,
          [randomUUID(),accountHmac,randomUUID(),boundarySourceHmac],
        );
        const boundary=await repoOne.reserveAttempt(accountHmac,boundarySourceHmac);
        expect(boundary.delayMs).toBe(0);
        await repoOne.finishAttempt({attemptId:boundary.attemptId,accountHmac,sourceHmac:boundarySourceHmac,success:true});
        const expiredRows=await pool.query<{count:string}>(
          'SELECT count(*)::text AS count FROM symphony.auth_attempt_events WHERE identity_hmac=$1 OR identity_hmac=$2',[accountHmac,boundarySourceHmac],
        );
        expect(expiredRows.rows[0]?.count).toBe('0');

        for(let index=0;index<6;index++)await pool.query(
          `INSERT INTO symphony.auth_attempt_events(attempt_id,dimension,identity_hmac,state)
           VALUES($1,'account',$2,'failed')`,[randomUUID(),combinedAccountHmac],
        );
        for(let index=0;index<5;index++)await pool.query(
          `INSERT INTO symphony.auth_attempt_events(attempt_id,dimension,identity_hmac,state)
           VALUES($1,'trusted_source',$2,'failed')`,[randomUUID(),combinedSourceHmac],
        );
        const combined=await repoTwo.reserveAttempt(combinedAccountHmac,combinedSourceHmac);
        expect(combined.delayMs).toBe(2_000);
        await repoTwo.finishAttempt({attemptId:combined.attemptId,accountHmac:combinedAccountHmac,sourceHmac:combinedSourceHmac,success:true});
      } finally {
        await pool.query('DELETE FROM symphony.auth_attempt_events WHERE identity_hmac=$1 OR identity_hmac=$2 OR identity_hmac=$3 OR identity_hmac=$4 OR identity_hmac=$5 OR identity_hmac=$6',[accountHmac,sourceHmac,resetSourceHmac,boundarySourceHmac,combinedAccountHmac,combinedSourceHmac]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.auth_sessions WHERE token_hash=$1 OR token_hash=$2',[preAuthA,preAuthB]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.auth_sessions WHERE token_hash=$1',[preAuthD]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.auth_sessions WHERE token_hash=$1',[preAuthReplay]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.auth_sessions WHERE tenant_id=$1',[tenantId]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1',[tenantId]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.temporary_credentials WHERE tenant_id=$1',[tenantId]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.users WHERE tenant_id=$1',[tenantId]).catch(()=>undefined);
        await pool.query('DELETE FROM symphony.tenants WHERE id=$1',[tenantId]).catch(()=>undefined);
        await repoOnePool.end(); await repoTwoPool.end();
      }
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
