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

type TablePolicy = {
  table: string;
  classification: string;
  permitted_sql_operations?: string[];
  operation_specific_capabilities?: { name: string; grantee: string }[];
};
type Matrix = { tables: TablePolicy[]; planned_phase1_tables: TablePolicy[] };
type Inventory = { tables: { table: string }[]; planned_phase1_tables: { table: string }[] };
type TestAggregate = AggregateRoot & { readonly label: string };

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
  let matrix: Matrix;
  let inventory: Inventory;
  let manifest: { table_count: number; policy_entries: { table: string; tenant_resolution_sql: string }[] };

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
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), app.end(), admin.end()]);
  }, 30_000);

  it('matches the 55-table migration catalog, frozen policy manifest, and effective application grants', async () => {
    const expectedTables = [...inventory.tables, ...inventory.planned_phase1_tables].map((row) => row.table).sort();
    const actual = await admin.query<{ table_name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='symphony' AND c.relkind IN ('r','p') AND c.relname <> 'schema_migrations'
       ORDER BY c.relname`,
    );
    expect(actual.rows.map((row) => row.table_name)).toEqual(expectedTables);
    expect(actual.rowCount).toBe(55);

    const policies = new Map([...matrix.tables, ...matrix.planned_phase1_tables].map((row) => [row.table, row]));
    const tenantRows = [...policies.values()].filter((row) => row.classification === 'tenant_scoped');
    expect(tenantRows).toHaveLength(37);
    expect(manifest.table_count).toBe(tenantRows.length);
    const catalog = new Map(actual.rows.map((row) => [row.table_name, row]));
    for (const row of tenantRows) {
      expect(catalog.get(row.table)?.relrowsecurity, `${row.table} ENABLE RLS`).toBe(true);
      expect(catalog.get(row.table)?.relforcerowsecurity, `${row.table} FORCE RLS`).toBe(true);
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
    const functions = await admin.query<{ signature: string; app_execute: boolean; public_execute: boolean; owner: string }>(
      `SELECT p.oid::regprocedure::text AS signature,
              has_function_privilege('symphony_app', p.oid, 'EXECUTE') AS app_execute,
              COALESCE((SELECT bool_or(a.grantee=0 AND a.privilege_type='EXECUTE') FROM aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) a), false) AS public_execute,
              pg_get_userbyid(p.proowner) AS owner
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='symphony' ORDER BY signature`,
    );
    const enqueue = functions.rows.find((row) => row.signature === 'symphony.enqueue_command_outbox_message(uuid,uuid)');
    expect(enqueue).toMatchObject({ app_execute: true, public_execute: false, owner: 'symphony_outbox_writer' });
    expect(functions.rows.filter((row) => row.app_execute).map((row) => row.signature)).toEqual(['symphony.enqueue_command_outbox_message(uuid,uuid)']);
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
