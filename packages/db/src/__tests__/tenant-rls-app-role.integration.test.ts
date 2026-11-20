import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { AggregateRoot, DomainEvent, OutboxMessage } from '@symphony/domain';
import { createDb } from '../db/client.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import type { SymphonyDatabase } from '../types/database.js';
import { canonicalPostgresPolicyExpression, tenantPolicyTableSetErrors } from '../testing/tenant-policy-manifest.js';

type TablePolicy = {
  table: string;
  classification: string;
  permitted_sql_operations?: string[];
  operation_specific_capabilities?: { name: string; grantee: string }[];
};
type Matrix = { tables: TablePolicy[]; planned_phase1_tables: TablePolicy[] };
type Inventory = { tables: { table: string }[]; planned_phase1_tables: { table: string }[] };
type TenantPolicyEntry = {
  table: string;
  parent_tables: string[];
  tenant_resolution_sql: string;
  insert_with_check: string;
  update_using: string;
  update_with_check: string;
};
type PolicyManifest = {
  table_count: number;
  required_tenant_scoped_count: number;
  policy_entries: TenantPolicyEntry[];
  outbox_policy: {
    table: string; rls_enabled: boolean; rls_forced: boolean; name: string;
    permissive: boolean; command: string; roles: string[]; using: string | null; with_check: string;
    function: {
      signature: string; owner: string; security_definer: boolean; search_path: string;
      public_execute: boolean; app_execute: boolean;
    };
  };
};
type TestAggregate = AggregateRoot & { readonly label: string };

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const databaseName = appUrl ? decodeURIComponent(new URL(appUrl).pathname.slice(1)) : '';

describe('WP1.5 actual restricted-role tenant isolation', () => {
  // Keep one owner connection so each tenant-scoped fixture can set a known
  // context. This also lets the local migration owner run the gate under FORCE
  // RLS when a separate superuser URL is unavailable.
  const admin = new pg.Pool({ connectionString: adminUrl, max: 1 });
  const app = new pg.Pool({ connectionString: appUrl, max: 1 });
  const db = createDb(appUrl ?? '', { max: 1 });
  const recoveryDb = createDb(appUrl ?? '', { max: 1 });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const itemA = randomUUID();
  const itemB = randomUUID();
  const runner = new PostgresCommandTransactionRunner(db, { recoveryDb });
  const repository = new PostgresRepository<TestAggregate>(db, 'Wp15TenantIsolationFixture');
  const appliedIds: { aggregateId: string; eventId: string; outboxId: string }[] = [];
  let adminOutboxInspectionPolicyInstalled = false;
  let matrix: Matrix;
  let inventory: Inventory;
  let manifest: PolicyManifest;

  beforeAll(async () => {
    if (!adminUrl || !migrationUrl || !appUrl) {
      throw new Error('WP1.5 gate requires PHASE1_TEST_ADMIN_DATABASE_URL, MIGRATION_TEST_DATABASE_URL, and PHASE1_TEST_APP_DATABASE_URL; it never falls back to the owner role.');
    }
    if (process.env.DATA_MODE !== 'test' || !databaseName.endsWith('_test')) {
      throw new Error('WP1.5 gate requires DATA_MODE=test and an isolated *_test database.');
    }
    const [matrixText, inventoryText, manifestText] = await Promise.all([
      readFile(path.join(root, 'evidence/phase1/tenant-table-policy-matrix.json'), 'utf8'),
      readFile(path.join(root, 'evidence/phase1/tenant-table-inventory.json'), 'utf8'),
      readFile(path.join(root, 'evidence/phase1/wp1.5-tenant-policy-manifest.json'), 'utf8'),
    ]);
    matrix = JSON.parse(matrixText) as Matrix;
    inventory = JSON.parse(inventoryText) as Inventory;
    manifest = JSON.parse(manifestText) as typeof manifest;
    expect(manifest.table_count).toBe(manifest.policy_entries.length);

    const appIdentity = await app.query<{ current_user: string; current_database: string; server_version_num: string }>(
      "SELECT current_user, current_database(), current_setting('server_version_num') AS server_version_num",
    );
    expect(appIdentity.rows[0]).toMatchObject({ current_user: 'symphony_app', current_database: databaseName, server_version_num: '180000' });

    // FORCE RLS intentionally gives the application no outbox read path. Add a
    // test-database-only inspection policy for the fixture administrator so
    // assertions can distinguish an inserted row from an RLS-hidden row.
    // The application role is not a member of this policy's target role.
    await admin.query('DROP POLICY IF EXISTS wp1_5_test_admin_outbox_inspection ON symphony.event_outbox');
    await admin.query(`DO $policy$
      BEGIN
        EXECUTE format(
          'CREATE POLICY wp1_5_test_admin_outbox_inspection ON symphony.event_outbox FOR ALL TO %I USING (true) WITH CHECK (true)',
          current_user
        );
      END
      $policy$`);
    adminOutboxInspectionPolicyInstalled = true;

    await admin.query('INSERT INTO symphony.tenants (id, name) VALUES ($1, $2), ($3, $4)', [tenantA, 'wp1.5-a', tenantB, 'wp1.5-b']);
    await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    await admin.query('INSERT INTO symphony.organizations (id, tenant_id, name) VALUES ($1, $2, $3)', [organizationA, tenantA, 'wp1.5-org-a']);
    await admin.query(
      'INSERT INTO symphony.users (id, tenant_id, email, email_normalized, status) VALUES ($1,$2,$3,$3,$4)',
      [userA, tenantA, `wp1.5-${userA}@example.invalid`, 'active'],
    );
    await admin.query('INSERT INTO symphony.evidence_items (id, organization_id, track, evidence_type) VALUES ($1,$2,$3,$4)', [itemA, organizationA, 'C', 'wp1.5-fixture']);
    await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);
    await admin.query('INSERT INTO symphony.organizations (id, tenant_id, name) VALUES ($1, $2, $3)', [organizationB, tenantB, 'wp1.5-org-b']);
    await admin.query(
      'INSERT INTO symphony.users (id, tenant_id, email, email_normalized, status) VALUES ($1,$2,$3,$3,$4)',
      [userB, tenantB, `wp1.5-${userB}@example.invalid`, 'active'],
    );
    await admin.query('INSERT INTO symphony.evidence_items (id, organization_id, track, evidence_type) VALUES ($1,$2,$3,$4)', [itemB, organizationB, 'C', 'wp1.5-fixture']);
  }, 30_000);

  afterAll(async () => {
    if (adminUrl) {
      for (const item of appliedIds) {
        await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]).catch(() => undefined);
        await admin.query('DELETE FROM symphony.event_outbox WHERE id = $1', [item.outboxId]).catch(() => undefined);
        await admin.query('DELETE FROM symphony.aggregate_states WHERE id = $1', [item.aggregateId]).catch(() => undefined);
        await admin.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability').catch(() => undefined);
        await admin.query('DELETE FROM symphony.domain_events WHERE id = $1', [item.eventId]).catch(() => undefined);
        await admin.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability').catch(() => undefined);
      }
      await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.evidence_items WHERE id = $1', [itemA]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.users WHERE id = $1', [userA]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organizations WHERE id = $1', [organizationA]).catch(() => undefined);
      await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.evidence_items WHERE id = $1', [itemB]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.users WHERE id = $1', [userB]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organizations WHERE id = $1', [organizationB]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]).catch(() => undefined);
      if (adminOutboxInspectionPolicyInstalled) {
        await admin.query('DROP POLICY wp1_5_test_admin_outbox_inspection ON symphony.event_outbox').catch(() => undefined);
      }
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), app.end(), admin.end()]);
  }, 30_000);

  it('matches all migrated tables, all 44 PostgreSQL tenant policy expressions, the frozen manifest, and effective grants', async () => {
    const expectedTables = [...inventory.tables, ...inventory.planned_phase1_tables].map((row) => row.table).sort();
    const actual = await admin.query<{ table_name: string; table_owner: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS table_owner,
              c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='symphony' AND c.relkind IN ('r','p') AND c.relname <> 'schema_migrations'
       ORDER BY c.relname`,
    );
    expect(actual.rows.map((row) => row.table_name)).toEqual(expectedTables);
    expect(actual.rowCount).toBe(expectedTables.length);

    const policies = new Map([...matrix.tables, ...matrix.planned_phase1_tables].map((row) => [row.table, row]));
    const tenantRows = [...policies.values()].filter((row) => row.classification === 'tenant_scoped');
    expect(tenantRows).toHaveLength(44);
    expect(manifest.table_count).toBe(tenantRows.length);
    expect(manifest.required_tenant_scoped_count).toBe(tenantRows.length);
    expect(tenantPolicyTableSetErrors(
      tenantRows.map((row) => row.table),
      manifest.policy_entries.map((entry) => entry.table),
    )).toEqual([]);
    const catalog = new Map(actual.rows.map((row) => [row.table_name, row]));
    for (const row of tenantRows) {
      expect(catalog.get(row.table)?.relrowsecurity, `${row.table} ENABLE RLS`).toBe(true);
      expect(catalog.get(row.table)?.relforcerowsecurity, `${row.table} FORCE RLS`).toBe(true);
    }

    const policyCatalog = await admin.query<{
      schemaname: string; tablename: string; policyname: string; permissive: string;
      roles: string[]; cmd: string; qual: string | null; with_check: string | null;
    }>(
      `SELECT n.nspname AS schemaname, c.relname AS tablename, p.polname AS policyname,
              CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive,
              to_json(ARRAY(SELECT CASE WHEN role_oid=0 THEN 'public' ELSE pg_get_userbyid(role_oid) END
                    FROM unnest(p.polroles) AS role_oid ORDER BY 1)) AS roles,
              CASE p.polcmd WHEN '*' THEN 'ALL' WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                    WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' END AS cmd,
              pg_get_expr(p.polqual, p.polrelid) AS qual,
              pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
       FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='symphony' ORDER BY c.relname, p.polname`,
    );
    const actualTenantPolicies = policyCatalog.rows.filter((row) => policies.get(row.tablename)?.classification === 'tenant_scoped');
    expect(actualTenantPolicies).toHaveLength(tenantRows.length * 2);

    // PostgreSQL parses each frozen manifest expression on a transaction-only
    // structural clone, then deparses both expected and installed policies.
    // This avoids substring/regex acceptance and leaves no schema behind.
    const oracleSchema = `wp15_policy_oracle_${randomUUID().replaceAll('-', '')}`;
    const oracleClient = await admin.connect();
    try {
      await oracleClient.query('BEGIN');
      await oracleClient.query(`CREATE SCHEMA ${quoteIdentifier(oracleSchema)}`);
      for (const entry of manifest.policy_entries) {
        const expectedPolicyName = `${entry.table}_tenant_scope`;
        const actualTablePolicies = actualTenantPolicies.filter((row) => row.tablename === entry.table);
        expect(actualTablePolicies.map((row) => row.policyname).sort(), `${entry.table} has only the admission and scope policies`)
          .toEqual([`${entry.table}_tenant_admission`, expectedPolicyName].sort());
        const actualScope = actualTablePolicies.find((row) => row.policyname === expectedPolicyName);
        const actualAdmission = actualTablePolicies.find((row) => row.policyname === `${entry.table}_tenant_admission`);
        expect(actualScope, `${entry.table} restrictive scope policy exists`).toMatchObject({
          permissive: 'RESTRICTIVE', roles: ['public'], cmd: 'ALL',
        });
        expect(actualAdmission, `${entry.table} expected admission policy exists`).toMatchObject({
          permissive: 'PERMISSIVE',
          cmd: entry.table === 'security_attempts' ? 'INSERT' : 'ALL',
        });
        const expectedAdmissionRoles = ['symphony_app', catalog.get(entry.table)!.table_owner];
        if (entry.table === 'domain_events') expectedAdmissionRoles.push('symphony_outbox_writer');
        expect(actualAdmission?.roles.sort(), `${entry.table} admission roles are exactly the app, owner, and approved writer identities`)
          .toEqual(expectedAdmissionRoles.sort());
        expect(entry.insert_with_check, `${entry.table} INSERT check matches the frozen tenant expression`).toBe(entry.tenant_resolution_sql);
        expect(entry.update_using, `${entry.table} UPDATE USING matches the frozen tenant expression`).toBe(entry.tenant_resolution_sql);
        expect(entry.update_with_check, `${entry.table} UPDATE check matches the frozen tenant expression`).toBe(entry.tenant_resolution_sql);

        const oracleTable = `${quoteIdentifier(oracleSchema)}.${quoteIdentifier(entry.table)}`;
        await oracleClient.query(`CREATE TABLE ${oracleTable} (LIKE symphony.${quoteIdentifier(entry.table)})`);
        await oracleClient.query(
          `CREATE POLICY ${quoteIdentifier(expectedPolicyName)} ON ${oracleTable}
           AS RESTRICTIVE FOR ALL TO PUBLIC USING (${entry.update_using}) WITH CHECK (${entry.update_with_check})`,
        );
        const oracle = await oracleClient.query<{ qual: string | null; with_check: string | null }>(
          'SELECT qual, with_check FROM pg_policies WHERE schemaname=$1 AND tablename=$2 AND policyname=$3',
          [oracleSchema, entry.table, expectedPolicyName],
        );
        expect(oracle.rowCount, `${entry.table} manifest expression parses as one policy`).toBe(1);
        expect(actualScope?.qual, `${entry.table} has a USING predicate`).not.toBeNull();
        expect(actualScope?.with_check, `${entry.table} has a WITH CHECK predicate`).not.toBeNull();
        expect(
          canonicalPostgresPolicyExpression(actualScope!.qual!, 'symphony', entry.table),
          `${entry.table} actual USING equals the parsed manifest expression`,
        ).toBe(canonicalPostgresPolicyExpression(oracle.rows[0]!.qual!, oracleSchema, entry.table));
        expect(
          canonicalPostgresPolicyExpression(actualScope!.with_check!, 'symphony', entry.table),
          `${entry.table} actual WITH CHECK equals the parsed manifest expression`,
        ).toBe(canonicalPostgresPolicyExpression(oracle.rows[0]!.with_check!, oracleSchema, entry.table));
      }
    } finally {
      await oracleClient.query('ROLLBACK').catch(() => undefined);
      oracleClient.release();
    }
    expect(actualTenantPolicies.map((row) => row.tablename).sort()).toEqual(
      manifest.policy_entries.map((entry) => entry.table).flatMap((table) => [table, table]).sort(),
    );

    const outboxSpec = manifest.outbox_policy;
    const outboxRelation = await admin.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='symphony' AND c.relname=$1`,
      [outboxSpec.table],
    );
    expect(outboxRelation.rows[0], 'event_outbox itself must enable and force RLS').toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    const outboxPolicies = policyCatalog.rows.filter((row) => row.tablename === outboxSpec.table);
    expect(outboxPolicies.map((row) => row.policyname).sort()).toEqual([
      outboxSpec.name, 'wp1_5_test_admin_outbox_inspection',
    ].sort());
    const writerPolicy = outboxPolicies.find((row) => row.policyname === outboxSpec.name);
    expect(writerPolicy, 'the approved writer policy must be installed').toMatchObject({
      permissive: outboxSpec.permissive ? 'PERMISSIVE' : 'RESTRICTIVE',
      roles: outboxSpec.roles,
      cmd: outboxSpec.command,
      qual: outboxSpec.using,
    });
    expect(writerPolicy?.with_check).not.toBeNull();

    const outboxOracleSchema = `wp15_outbox_oracle_${randomUUID().replaceAll('-', '')}`;
    const outboxOracleClient = await admin.connect();
    try {
      await outboxOracleClient.query('BEGIN');
      await outboxOracleClient.query(`CREATE SCHEMA ${quoteIdentifier(outboxOracleSchema)}`);
      const oracleOutboxTable = `${quoteIdentifier(outboxOracleSchema)}.${quoteIdentifier(outboxSpec.table)}`;
      await outboxOracleClient.query(`CREATE TABLE ${oracleOutboxTable} (LIKE symphony.${quoteIdentifier(outboxSpec.table)})`);
      await outboxOracleClient.query(
        `CREATE POLICY ${quoteIdentifier(outboxSpec.name)} ON ${oracleOutboxTable}
         FOR INSERT TO symphony_outbox_writer WITH CHECK (${outboxSpec.with_check})`,
      );
      const oracleOutbox = await outboxOracleClient.query<{ with_check: string | null }>(
        'SELECT with_check FROM pg_policies WHERE schemaname=$1 AND tablename=$2 AND policyname=$3',
        [outboxOracleSchema, outboxSpec.table, outboxSpec.name],
      );
      expect(oracleOutbox.rowCount).toBe(1);
      expect(canonicalPostgresPolicyExpression(writerPolicy!.with_check!, 'symphony', outboxSpec.table))
        .toBe(canonicalPostgresPolicyExpression(oracleOutbox.rows[0]!.with_check!, outboxOracleSchema, outboxSpec.table));
    } finally {
      await outboxOracleClient.query('ROLLBACK').catch(() => undefined);
      outboxOracleClient.release();
    }

    const permissions = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] as const;
    for (const [table, row] of policies) {
      const expected = new Set(row.permitted_sql_operations ?? []);
      for (const permission of permissions) {
        const result = await app.query<{ allowed: boolean }>(
          'SELECT has_table_privilege(current_user, $1, $2) AS allowed',
          [`symphony.${table}`, permission],
        );
        expect(result.rows[0]?.allowed, `${table} ${permission}`).toBe(expected.has(permission));
      }
    }

    const schema = await app.query<{ usage: boolean; create: boolean }>(
      "SELECT has_schema_privilege(current_user, 'symphony', 'USAGE') AS usage, has_schema_privilege(current_user, 'symphony', 'CREATE') AS create",
    );
    expect(schema.rows[0]).toEqual({ usage: true, create: false });
    const columnGrants = await admin.query(
      `SELECT 1
       FROM pg_attribute a
       JOIN pg_class c ON c.oid=a.attrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       CROSS JOIN LATERAL aclexplode(a.attacl) acl
       WHERE n.nspname='symphony' AND c.relkind IN ('r','p')
         AND a.attnum>0 AND NOT a.attisdropped
         AND acl.grantee IN (0, (SELECT oid FROM pg_roles WHERE rolname='symphony_app'))
       LIMIT 1`,
    );
    expect(columnGrants.rowCount).toBe(0);
    const publicTableGrants = await admin.query(
      "SELECT 1 FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_schema='symphony' LIMIT 1",
    );
    expect(publicTableGrants.rowCount).toBe(0);
    const sequences = await admin.query<{ sequence_name: string }>(
      "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='symphony'",
    );
    for (const sequence of sequences.rows) {
      const result = await app.query<{ allowed: boolean }>(
        'SELECT has_sequence_privilege(current_user, $1, $2) AS allowed',
        [`symphony.${sequence.sequence_name}`, 'USAGE'],
      );
      expect(result.rows[0]?.allowed, sequence.sequence_name).toBe(false);
    }
    const functions = await admin.query<{
      signature: string; is_enqueue: boolean; is_auth_lookup: boolean; app_execute: boolean; public_execute: boolean;
      owner: string; oid: string; security_definer: boolean; function_settings: string[] | null;
    }>(
      `SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes)) AS signature,
              p.oid = 'symphony.enqueue_command_outbox_message(uuid, uuid)'::regprocedure AS is_enqueue,
              p.oid IN ('symphony.lookup_auth_subject(uuid)'::regprocedure, 'symphony.lookup_auth_session(bytea)'::regprocedure) AS is_auth_lookup,
              p.oid::text AS oid,
              has_function_privilege('symphony_app', p.oid, 'EXECUTE') AS app_execute,
              COALESCE((SELECT bool_or(a.grantee=0 AND a.privilege_type='EXECUTE') FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a), false) AS public_execute,
              pg_get_userbyid(p.proowner) AS owner,
              p.prosecdef AS security_definer,
              p.proconfig AS function_settings
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='symphony' ORDER BY signature`,
    );
    const enqueue = functions.rows.find((row) => row.is_enqueue);
    expect(enqueue).toMatchObject({
      app_execute: manifest.outbox_policy.function.app_execute,
      public_execute: manifest.outbox_policy.function.public_execute,
      owner: manifest.outbox_policy.function.owner,
      security_definer: manifest.outbox_policy.function.security_definer,
      function_settings: [`search_path=${manifest.outbox_policy.function.search_path}`],
    });
    expect(enqueue?.signature.replaceAll(/\s+/g, '')).toBe(manifest.outbox_policy.function.signature.replaceAll(/\s+/g, ''));
    const authLookups = functions.rows.filter((row) => row.is_auth_lookup);
    expect(authLookups).toHaveLength(2);
    for (const lookup of authLookups) {
      expect(lookup).toMatchObject({
        app_execute: true,
        public_execute: false,
        security_definer: true,
        function_settings: ['search_path=pg_catalog, symphony'],
      });
    }
    expect(functions.rows.filter((row) => row.app_execute).map((row) => row.oid).sort()).toEqual(
      [enqueue?.oid, ...authLookups.map((row) => row.oid)].sort(),
    );
    expect(functions.rows.some((row) => row.public_execute)).toBe(false);
    const defaultPrivileges = await admin.query("SELECT 1 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole WHERE r.rolname IN ('symphony_app','symphony_outbox_writer') LIMIT 1");
    expect(defaultPrivileges.rowCount).toBe(0);

    const role = await admin.query<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolinherit: boolean; rolbypassrls: boolean; rolcanlogin: boolean; memberships: number; owned_objects: number }>(
      `SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolbypassrls,r.rolcanlogin,
              (SELECT count(*)::int FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
              (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='symphony' AND c.relowner=r.oid)
              +(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='symphony' AND p.proowner=r.oid) AS owned_objects
       FROM pg_roles r WHERE r.rolname='symphony_app'`,
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolbypassrls: false, rolcanlogin: true, memberships: 0, owned_objects: 0 });
    const writer = await admin.query<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolinherit: boolean; rolbypassrls: boolean; rolcanlogin: boolean; memberships: number; owns_function: boolean }>(
      `SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolbypassrls,r.rolcanlogin,
              (SELECT count(*)::int FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
              EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='symphony' AND p.proname='enqueue_command_outbox_message' AND p.proowner=r.oid) AS owns_function
       FROM pg_roles r WHERE r.rolname='symphony_outbox_writer'`,
    );
    expect(writer.rows[0]).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolbypassrls: false, rolcanlogin: false, memberships: 0, owns_function: true });
    const writerPrivileges = await admin.query<{ table_name: string; privilege_type: string }>(
      "SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='symphony_outbox_writer' AND table_schema='symphony' ORDER BY table_name,privilege_type",
    );
    expect(writerPrivileges.rows).toEqual([
      { table_name: 'domain_events', privilege_type: 'SELECT' },
      { table_name: 'event_outbox', privilege_type: 'INSERT' },
    ]);
    await expect(app.query('SET ROLE symphony_outbox_writer')).rejects.toMatchObject({ code: '42501' });
  });

  it('fails closed for missing, empty, mismatched, and cross-tenant inherited scopes', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      const tenantTables = [...matrix.tables, ...matrix.planned_phase1_tables]
        .filter((row) => row.classification === 'tenant_scoped');
      for (const row of tenantTables) {
        if (!(row.permitted_sql_operations ?? []).includes('SELECT')) {
          await expect(client.query(`SELECT 1 FROM symphony.${row.table} LIMIT 1`))
            .rejects.toMatchObject({ code: '42501' });
          await client.query('ROLLBACK');
          await client.query('BEGIN');
          continue;
        }
        const result = await client.query(`SELECT count(*)::int AS n FROM symphony.${row.table}`);
        expect(result.rows[0]?.n, `${row.table} with unset tenant context`).toBe(0);
      }
      await client.query("SELECT set_config('app.tenant_id', '', true)");
      for (const row of tenantTables) {
        if (!(row.permitted_sql_operations ?? []).includes('SELECT')) {
          await expect(client.query(`SELECT 1 FROM symphony.${row.table} LIMIT 1`))
            .rejects.toMatchObject({ code: '42501' });
          await client.query('ROLLBACK');
          await client.query('BEGIN');
          await client.query("SELECT set_config('app.tenant_id', '', true)");
          continue;
        }
        const result = await client.query(`SELECT count(*)::int AS n FROM symphony.${row.table}`);
        expect(result.rows[0]?.n, `${row.table} with empty tenant context`).toBe(0);
      }
      await client.query('ROLLBACK');

      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      const visible = await client.query('SELECT id FROM symphony.evidence_items ORDER BY id');
      expect(visible.rows.map((row) => row.id)).toEqual([itemA]);
      await expect(client.query(
        'INSERT INTO symphony.evidence_items (id, organization_id, track, evidence_type) VALUES ($1,$2,$3,$4)',
        [randomUUID(), organizationB, 'C', 'wrong-tenant-parent'],
      )).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      await expect(client.query('UPDATE symphony.evidence_items SET organization_id=$1 WHERE id=$2', [organizationB, itemA]))
        .rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });

  it('uses unfiltered app-role reads to cover every distinct manifested tenant-parent chain', async () => {
    const ids = Object.fromEntries([
      'state', 'person', 'personIdentifier', 'platformRole', 'roleAssignment', 'event',
      'capacityGrant', 'delegation', 'enrolmentSession', 'approvalPolicy', 'organizationEnrollment',
      'handover', 'evidenceVersion', 'supportItem', 'admission', 'verificationAssignment',
      'finding', 'userPersonLink', 'requirement', 'requirementLink', 'appointment', 'bylawDocument', 'bylawVersion', 'bylawProvision',
      'temporaryCredential', 'passwordCredential',
    ].map((key) => [key, randomUUID()]));
    const fixtureRows: { table: string; id: string }[] = [];
    const insert = async (table: string, id: string, statement: string, values: unknown[]) => {
      await admin.query(statement, values);
      fixtureRows.push({ table, id });
    };

    try {
      await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantB]);
      await insert('aggregate_states', ids.state!,
        'INSERT INTO symphony.aggregate_states (id, tenant_id, aggregate_type) VALUES ($1,$2,$3)',
        [ids.state, tenantB, 'Wp15TenantScopeFixture']);
      await insert('persons', ids.person!,
        'INSERT INTO symphony.persons (id, tenant_id, pseudonym_id) VALUES ($1,$2,$3)',
        [ids.person, tenantB, `wp15-person-${ids.person}`]);
      await insert('person_identifiers', ids.personIdentifier!,
        'INSERT INTO symphony.person_identifiers (id, person_id, identifier_type, identifier_encrypted, blind_index, is_primary) VALUES ($1,$2,$3,$4,$5,false)',
        [ids.personIdentifier, ids.person, 'none', Buffer.from('synthetic'), Buffer.from('fixture')]);
      await insert('platform_roles', ids.platformRole!,
        'INSERT INTO symphony.platform_roles (id, code, name) VALUES ($1,$2,$3)',
        [ids.platformRole, `wp15-${ids.platformRole}`, 'WP1.5 synthetic role']);
      await insert('user_role_assignments', ids.roleAssignment!,
        'INSERT INTO symphony.user_role_assignments (id, user_id, platform_role_id, tenant_id) VALUES ($1,$2,$3,$4)',
        [ids.roleAssignment, userB, ids.platformRole, tenantB]);
      const authenticationEventId = randomUUID();
      await insert('authentication_events', authenticationEventId,
        'INSERT INTO symphony.authentication_events (id, user_id, method, result) VALUES ($1,$2,$3,$4)',
        [authenticationEventId, userB, 'wp15-fixture', 'success']);
      await insert('temporary_credentials', ids.temporaryCredential!,
        `WITH issuance AS (SELECT clock_timestamp() AS issued_at)
         INSERT INTO symphony.temporary_credentials (id,tenant_id,user_id,secret_hash,issued_at,expires_at)
         SELECT $1,$2,$3,$4,issued_at,issued_at + INTERVAL '72 hours' FROM issuance`,
        [ids.temporaryCredential, tenantB, userB, '$argon2id$v=19$m=19456,t=2,p=1$YWJj$YWJj']);
      await insert('password_credentials', ids.passwordCredential!,
        'INSERT INTO symphony.password_credentials (id,tenant_id,user_id,secret_hash) VALUES ($1,$2,$3,$4)',
        [ids.passwordCredential, tenantB, userB, '$argon2id$v=19$m=19456,t=2,p=1$YWJj$YWJj']);
      await insert('domain_events', ids.event!,
        `INSERT INTO symphony.domain_events (id, tenant_id, aggregate_id, aggregate_type, event_type, occurred_at, sequence)
         VALUES ($1,$2,$3,$4,$5,now(),1)`,
        [ids.event, tenantB, randomUUID(), 'Wp15TenantScopeFixture', 'Wp15FixtureCreated']);
      await insert('capacity_grants', ids.capacityGrant!,
        'INSERT INTO symphony.capacity_grants (id,user_id,organization_id,capacity_type,granted_by_user_id,source_event_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [ids.capacityGrant, userB, organizationB, 'wp15_fixture', userB, ids.event]);
      await insert('delegations', ids.delegation!,
        'INSERT INTO symphony.delegations (id,delegator_user_id,delegatee_user_id,organization_id) VALUES ($1,$2,$3,$4)',
        [ids.delegation, userB, userB, organizationB]);
      await insert('enrolment_sessions', ids.enrolmentSession!,
        'INSERT INTO symphony.enrolment_sessions (id,tenant_id,enroller_user_id,organization_id,representative_person_id) VALUES ($1,$2,$3,$4,$5)',
        [ids.enrolmentSession, tenantB, userB, organizationB, ids.person]);
      await insert('approval_policies', ids.approvalPolicy!,
        'INSERT INTO symphony.approval_policies (id,organization_id,record_class) VALUES ($1,$2,$3)',
        [ids.approvalPolicy, organizationB, 'wp15-fixture']);
      await insert('organization_enrollment', ids.organizationEnrollment!,
        'INSERT INTO symphony.organization_enrollment (id,organization_id,enrolment_mode,initiator_user_id) VALUES ($1,$2,$3,$4)',
        [ids.organizationEnrollment, organizationB, 'assisted', userB]);
      await insert('enrolment_handovers', ids.handover!,
        'INSERT INTO symphony.enrolment_handovers (id,organization_id,outgoing_user_id,incoming_user_id) VALUES ($1,$2,$3,$4)',
        [ids.handover, organizationB, userB, userB]);
      await insert('evidence_versions', ids.evidenceVersion!,
        'INSERT INTO symphony.evidence_versions (id,evidence_item_id,version_number,supplier_user_id,origin,stage) VALUES ($1,$2,$3,$4,$5,$6)',
        [ids.evidenceVersion, itemB, 917, userB, 'wp15_fixture', 'submitted']);
      await insert('evidence_support_items', ids.supportItem!,
        'INSERT INTO symphony.evidence_support_items (id,evidence_version_id,support_type) VALUES ($1,$2,$3)',
        [ids.supportItem, ids.evidenceVersion, 'wp15_fixture']);
      await insert('evidence_admissions', ids.admission!,
        'INSERT INTO symphony.evidence_admissions (id,evidence_version_id,admitted_by_user_id,admission_kind) VALUES ($1,$2,$3,$4)',
        [ids.admission, ids.evidenceVersion, userB, 'claim_admission']);
      await insert('verification_assignments', ids.verificationAssignment!,
        'INSERT INTO symphony.verification_assignments (id,evidence_item_id,assigned_to_user_id,evidence_version_id,completed_at) VALUES ($1,$2,$3,$4,now() - interval \'30 seconds\')',
        [ids.verificationAssignment, itemB, userB, ids.evidenceVersion]);
      await insert('appointments', ids.appointment!,
        'INSERT INTO symphony.appointments (id,organization_id,person_id,position_id,started_at,source_ref) VALUES ($1,$2,$3,$4,now() - interval \'1 minute\',$5)',
        [ids.appointment, organizationB, ids.person, '00000000-0000-4000-8000-000000000003', `wp15-source-${ids.appointment}`]);
      await insert('user_person_links', ids.userPersonLink!,
        'INSERT INTO symphony.user_person_links (id,tenant_id,user_id,person_id,linked_at,source_ref,linked_by_user_id) VALUES ($1,$2,$3,$4,now() - interval \'2 minutes\',$5,$3)',
        [ids.userPersonLink, tenantB, userB, ids.person, `wp15-link-${ids.userPersonLink}`]);
      await insert('verification_findings', ids.finding!,
        'INSERT INTO symphony.verification_findings (id,assignment_id,evidence_version_id,assurance_class,result) VALUES ($1,$2,$3,$4,$5)',
        [ids.finding, ids.verificationAssignment, ids.evidenceVersion, 'wp15_fixture', 'pass']);
      await insert('requirement_definitions', ids.requirement!,
        'INSERT INTO symphony.requirement_definitions (id,source_tier,description) VALUES ($1,$2,$3)',
        [ids.requirement, 'catalogue', 'Synthetic WP1.5 tenant policy fixture']);
      await insert('evidence_requirement_links', ids.requirementLink!,
        'INSERT INTO symphony.evidence_requirement_links (id,evidence_item_id,requirement_id) VALUES ($1,$2,$3)',
        [ids.requirementLink, itemB, ids.requirement]);
      await insert('bylaw_documents', ids.bylawDocument!,
        'INSERT INTO symphony.bylaw_documents (id,organization_id) VALUES ($1,$2)',
        [ids.bylawDocument, organizationB]);
      await insert('bylaw_versions', ids.bylawVersion!,
        'INSERT INTO symphony.bylaw_versions (id,bylaw_document_id,version_number,status) VALUES ($1,$2,1,$3)',
        [ids.bylawVersion, ids.bylawDocument, 'draft']);
      await insert('bylaw_provisions', ids.bylawProvision!,
        'INSERT INTO symphony.bylaw_provisions (id,bylaw_version_id,section_ref,text,confirmed_by_user_id) VALUES ($1,$2,$3,$4,$5)',
        [ids.bylawProvision, ids.bylawVersion, 'wp15-fixture', 'Synthetic policy fixture', userB]);

      const relationshipCoverage: { table: string; parentTables: string[]; id: string }[] = [
        { table: 'aggregate_states', parentTables: [], id: ids.state! },
        { table: 'temporary_credentials', parentTables: [], id: ids.temporaryCredential! },
        { table: 'password_credentials', parentTables: [], id: ids.passwordCredential! },
        { table: 'person_identifiers', parentTables: ['persons'], id: ids.personIdentifier! },
        { table: 'user_role_assignments', parentTables: ['users'], id: ids.roleAssignment! },
        { table: 'authentication_events', parentTables: ['users'], id: fixtureRows.find((row) => row.table === 'authentication_events')!.id },
        { table: 'capacity_grants', parentTables: ['organizations', 'users', 'domain_events'], id: ids.capacityGrant! },
        { table: 'delegations', parentTables: ['organizations', 'users'], id: ids.delegation! },
        { table: 'enrolment_sessions', parentTables: ['organizations', 'users', 'persons'], id: ids.enrolmentSession! },
        { table: 'approval_policies', parentTables: ['organizations'], id: ids.approvalPolicy! },
        { table: 'evidence_versions', parentTables: ['evidence_items', 'organizations', 'users'], id: ids.evidenceVersion! },
        { table: 'evidence_support_items', parentTables: ['evidence_versions', 'evidence_items', 'organizations'], id: ids.supportItem! },
        { table: 'evidence_admissions', parentTables: ['evidence_versions', 'evidence_items', 'organizations', 'users'], id: ids.admission! },
        { table: 'verification_assignments', parentTables: ['evidence_items', 'organizations', 'evidence_versions', 'users'], id: ids.verificationAssignment! },
        { table: 'verification_findings', parentTables: ['verification_assignments', 'evidence_items', 'organizations'], id: ids.finding! },
        { table: 'evidence_requirement_links', parentTables: ['evidence_items', 'organizations'], id: ids.requirementLink! },
        { table: 'appointments', parentTables: ['organizations', 'persons'], id: ids.appointment! },
        { table: 'bylaw_versions', parentTables: ['bylaw_documents', 'organizations'], id: ids.bylawVersion! },
        { table: 'bylaw_provisions', parentTables: ['bylaw_versions', 'bylaw_documents', 'organizations', 'users'], id: ids.bylawProvision! },
      ];
      const manifestClasses = new Set(manifest.policy_entries.map((entry) => JSON.stringify(entry.parent_tables)));
      const fixtureClasses = new Set(relationshipCoverage.map((entry) => JSON.stringify(entry.parentTables)));
      expect([...fixtureClasses].sort(), 'fixture coverage includes each distinct manifest parent chain')
        .toEqual([...manifestClasses].sort());

      const appClient = await app.connect();
      try {
        for (const fixture of relationshipCoverage) {
          await appClient.query('BEGIN');
          await appClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
          const foreignRows = await appClient.query(`SELECT id FROM symphony.${fixture.table} WHERE id=$1`, [fixture.id]);
          expect(foreignRows.rows, `${fixture.table} unfiltered tenant-A probe hides tenant-B row (${fixture.parentTables.join(' > ') || 'direct tenant'})`).toEqual([]);
          await appClient.query('ROLLBACK');

          await appClient.query('BEGIN');
          await appClient.query("SELECT set_config('app.tenant_id', $1, true)", [tenantB]);
          const tenantRows = await appClient.query(`SELECT id FROM symphony.${fixture.table} WHERE id=$1`, [fixture.id]);
          expect(tenantRows.rows.map((row) => row.id), `${fixture.table} valid tenant-B parent chain remains visible`).toEqual([fixture.id]);
          await appClient.query('ROLLBACK');
        }
      } finally {
        await appClient.query('ROLLBACK').catch(() => undefined);
        appClient.release();
      }
    } finally {
      for (const fixture of [...fixtureRows].reverse()) {
        if (fixture.table === 'evidence_versions') await admin.query('ALTER TABLE symphony.evidence_versions DISABLE TRIGGER evidence_versions_immutability');
        if (fixture.table === 'domain_events') await admin.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability');
        await admin.query(`DELETE FROM symphony.${fixture.table} WHERE id=$1`, [fixture.id]);
        if (fixture.table === 'evidence_versions') await admin.query('ALTER TABLE symphony.evidence_versions ENABLE TRIGGER evidence_versions_immutability');
        if (fixture.table === 'domain_events') await admin.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability');
      }
    }
  }, 30_000);

  it('keeps app.tenant_id transaction-local across pool reuse and rollback', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      expect((await client.query('SELECT count(*)::int AS n FROM symphony.evidence_items')).rows[0]?.n).toBe(1);
      await client.query('ROLLBACK');

      await client.query('BEGIN');
      expect((await client.query('SELECT count(*)::int AS n FROM symphony.evidence_items')).rows[0]?.n).toBe(0);
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantB]);
      expect((await client.query('SELECT count(*)::int AS n FROM symphony.evidence_items')).rows[0]?.n).toBe(1);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('denies direct outbox access and keeps command event/outbox writes atomic through the real repository adapter', async () => {
    await expect(app.query('SELECT * FROM symphony.event_outbox')).rejects.toMatchObject({ code: '42501' });
    await expect(app.query("INSERT INTO symphony.event_outbox (id,event_id,status) VALUES ($1,$2,'pending')", [randomUUID(), randomUUID()]))
      .rejects.toMatchObject({ code: '42501' });
    const aggregateId = randomUUID();
    const eventId = randomUUID();
    const outboxId = randomUUID();
    appliedIds.push({ aggregateId, eventId, outboxId });
    const event: DomainEvent = {
      id: eventId, tenantId: tenantA, aggregateId, aggregateType: 'Wp15TenantIsolationFixture',
      eventType: 'Wp15Created', payload: { synthetic: true }, occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(), sequence: 1,
    };
    const outbox: OutboxMessage = {
      id: outboxId, eventId, status: 'pending', createdAt: new Date().toISOString(),
    };
    const aggregate: TestAggregate = { id: aggregateId, tenantId: tenantA, version: 1, label: 'synthetic' };
    await runner.run(tenantA, async (context) => repository.save(aggregate, 0, [event], [outbox], context));
    await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const persisted = await admin.query<{ events: number; outbox: number }>(
      `SELECT (SELECT count(*)::int FROM symphony.domain_events WHERE id=$1) AS events,
              (SELECT count(*)::int FROM symphony.event_outbox WHERE id=$2 AND status='pending') AS outbox`,
      [eventId, outboxId],
    );
    expect(persisted.rows[0]).toEqual({ events: 1, outbox: 1 });

    const failedAggregateId = randomUUID();
    const failedEventId = randomUUID();
    const failedOutboxId = randomUUID();
    appliedIds.push({ aggregateId: failedAggregateId, eventId: failedEventId, outboxId: failedOutboxId });
    const failedEvent: DomainEvent = { ...event, id: failedEventId, aggregateId: failedAggregateId };
    const failedOutbox: OutboxMessage = { ...outbox, id: failedOutboxId, eventId: failedEventId };
    await expect(runner.run(tenantA, async (context) => {
      await repository.save({ ...aggregate, id: failedAggregateId }, 0, [failedEvent], [failedOutbox], context);
      throw new Error('WP1.5 atomic rollback sentinel');
    })).rejects.toThrow('WP1.5 atomic rollback sentinel');
    await admin.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
    const rolledBack = await admin.query<{ states: number; events: number; outbox: number }>(
      `SELECT (SELECT count(*)::int FROM symphony.aggregate_states WHERE id=$1) AS states,
              (SELECT count(*)::int FROM symphony.domain_events WHERE id=$2) AS events,
              (SELECT count(*)::int FROM symphony.event_outbox WHERE id=$3) AS outbox`,
      [failedAggregateId, failedEventId, failedOutboxId],
    );
    expect(rolledBack.rows[0]).toEqual({ states: 0, events: 0, outbox: 0 });
  }, 30_000);
});
