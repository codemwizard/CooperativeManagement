import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { sql } from 'kysely';
import { createDb } from '../db/client.js';
import { acquireAuthorityScopeLocks } from '../repositories/postgres-authority-scope-locks.js';
import type { AuthorityScopeLockRequest } from '../repositories/postgres-authority-scope-locks.js';
import { checkAuthorityScopeReadiness } from '../repositories/postgres-authority-scope-readiness.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import type { PostgresCommandTransactionContext } from '../repositories/postgres-repository.js';
import type { SymphonyDatabase } from '../types/database.js';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;

describe.skipIf(!adminUrl || !appUrl)('REM-WP2.6 PostgreSQL authority scope infrastructure', () => {
  const admin = new pg.Pool({ connectionString: adminUrl, max: 4 });
  const app = new pg.Pool({ connectionString: appUrl, max: 4 });
  const db = createDb(appUrl ?? '', { max: 5 });
  const recoveryDb = createDb(appUrl ?? '', { max: 2 });
  const runner = new PostgresCommandTransactionRunner(db, { recoveryDb });
  const tenantId = randomUUID();
  const actorUserId = randomUUID();
  const affectedActorUserId = randomUUID();
  const organizationId = randomUUID();
  const secondOrganizationId = randomUUID();
  const request: AuthorityScopeLockRequest = {
    tenantId,
    actorUserId,
    organizationIds: [organizationId, secondOrganizationId],
    affectedActorUserIds: [affectedActorUserId],
    actionId: 'capacity.grant',
    mode: 'protected_read',
  };

  beforeAll(async () => {
    if (process.env.DATA_MODE !== 'test') throw new Error('REM-WP2.6 integration tests require DATA_MODE=test.');
    const identity = await admin.query<{ current_database: string; server_version_num: string }>(
      "SELECT current_database(), current_setting('server_version_num') AS server_version_num",
    );
    expect(identity.rows[0]?.current_database.endsWith('_test')).toBe(true);
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    const migration = await admin.query<{ applied: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM symphony.schema_migrations WHERE name='0019_authority_scope_versions.sql') AS applied",
    );
    expect(migration.rows[0]?.applied).toBe(true);
    const appIdentity = await app.query<{ current_user: string; current_database: string }>(
      'SELECT current_user, current_database()',
    );
    expect(appIdentity.rows[0]).toEqual({ current_user: 'symphony_app', current_database: identity.rows[0]?.current_database });

    await admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, 'wp2.6-scope-fixture']);
    await admin.query(
      `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
       VALUES($1,$3,$4,$4,'active'),($2,$3,$5,$5,'active')`,
      [actorUserId, affectedActorUserId, tenantId, `wp2.6-${actorUserId}@example.invalid`, `wp2.6-${affectedActorUserId}@example.invalid`],
    );
    await admin.query('INSERT INTO symphony.organizations(id,tenant_id,name) VALUES($1,$2,$3)', [organizationId, tenantId, 'wp2.6-scope-fixture']);
    await admin.query('INSERT INTO symphony.organizations(id,tenant_id,name) VALUES($1,$2,$3)', [secondOrganizationId, tenantId, 'wp2.6-scope-fixture-2']);
    await admin.query(
      `INSERT INTO symphony.authority_scope_versions(scope_type,tenant_id,scope_id)
       VALUES('actor',NULL,$1),('actor',NULL,$2)
       ON CONFLICT (scope_type,tenant_id,scope_id) DO NOTHING`,
      [actorUserId, affectedActorUserId],
    );
  }, 30_000);

  afterAll(async () => {
    if (adminUrl) {
      await admin.query('DELETE FROM symphony.authority_scope_versions WHERE tenant_id=$1 OR (scope_type=\'actor\' AND scope_id=ANY($2::uuid[]))', [tenantId, [actorUserId, affectedActorUserId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organizations WHERE id=$1', [organizationId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organizations WHERE id=$1', [secondOrganizationId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.users WHERE id=ANY($1::uuid[])', [[actorUserId, affectedActorUserId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]).catch(() => undefined);
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), app.end(), admin.end()]);
  });

  it('sets the transaction-local actor from the trusted command principal and passes the WP2.6 readiness boundary', async () => {
    expect(await checkAuthorityScopeReadiness(app)).toBe(true);
    const observed = await runner.run(tenantId, async (context) => {
      const transaction = (context as PostgresCommandTransactionContext).kyselyTransaction;
      const result = await sql<{ actor_user_id: string }>`SELECT current_setting('app.actor_user_id', true) AS actor_user_id`.execute(transaction);
      return result.rows[0]?.actor_user_id;
    }, undefined, actorUserId);
    expect(observed).toBe(actorUserId);
  });

  it('resolves persisted tenant/org/actor references and provisions the same canonical lock order for shuffled inputs', async () => {
    const probe = await app.connect();
    try {
      await probe.query('BEGIN');
      await probe.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
      await probe.query("SELECT set_config('app.actor_user_id',$1,true)", [actorUserId]);
      const sentinel = await probe.query(
        `SELECT scope_type,tenant_id,scope_id FROM symphony.authority_scope_versions
          WHERE scope_type='global_policy' AND tenant_id IS NOT DISTINCT FROM NULL::uuid
            AND scope_id='00000000-0000-0000-0000-000000000001'::uuid FOR SHARE`,
      );
      expect(sentinel.rowCount).toBe(1);
      await probe.query('ROLLBACK');
    } finally {
      await probe.query('ROLLBACK').catch(() => undefined);
      probe.release();
    }
    const run = (organizationIds: string[]) => db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      return acquireAuthorityScopeLocks(trx, { ...request, organizationIds });
    });
    const forward = await run([organizationId, secondOrganizationId]);
    const reverse = await run([secondOrganizationId, organizationId]);
    expect(forward.scopes.map((scope) => `${scope.scopeType}|${scope.tenantId ?? '~'}|${scope.scopeId}`))
      .toEqual(reverse.scopes.map((scope) => `${scope.scopeType}|${scope.tenantId ?? '~'}|${scope.scopeId}`));
    expect(forward.scopes.map((scope) => scope.scopeType)).toEqual([
      'global_policy', 'organization', 'organization', 'tenant', 'actor_tenant', 'actor_tenant', 'actor',
    ]);
    expect([...forward.versions.values()]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    const persisted = await admin.query<{ scope_type: string; scope_id: string; version: string }>(
      `SELECT scope_type,scope_id,version FROM symphony.authority_scope_versions
        WHERE tenant_id=$1 ORDER BY scope_type,scope_id`,
      [tenantId],
    );
    expect(persisted.rows.map((row) => row.scope_type)).toEqual([
      'actor_tenant', 'actor_tenant', 'organization', 'organization', 'tenant',
    ]);
  });

  it('rejects cross-tenant references and forbids protected-read version increments', async () => {
    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      return acquireAuthorityScopeLocks(trx, { ...request, organizationIds: [randomUUID()] });
    })).rejects.toThrow('Authority context is unavailable');

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${affectedActorUserId}, true)`.execute(trx);
      return acquireAuthorityScopeLocks(trx, request);
    })).rejects.toThrow('Authority context is unavailable');

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      const locks = await acquireAuthorityScopeLocks(trx, request);
      await locks.incrementChangedScopes([locks.scopes[0]!]);
    })).rejects.toThrow('Protected reads cannot increment authority scope versions');
  });

  it('restricts the application role to D-16 scope columns and denies DML on frozen or not-yet-registered authority sources', async () => {
    const tableNames = [
      'tenants', 'users', 'user_role_assignments', 'platform_roles', 'organization_memberships', 'user_person_links',
      'appointments', 'organizations', 'enrolment_sessions', 'enroller_assignments', 'institutional_role_assignments',
      'ta_scope_delegations', 'programme_manager_scopes', 'capacity_grants', 'delegations', 'membership_rules',
      'acceptance_policies', 'enforcement_policies', 'approval_policies', 'retention_policies', 'precedence_policies',
      'duty_matrix_rows',
    ];
    for (const table of tableNames) {
      const result = await app.query<{ privilege: boolean }>(
        'SELECT has_table_privilege(current_user,$1,$2) AS privilege',
        [`symphony.${table}`, 'INSERT'],
      );
      expect(result.rows[0]?.privilege, `${table} INSERT`).toBe(false);
      await expect(app.query(`INSERT INTO symphony.${table} DEFAULT VALUES`), `${table} actual INSERT`).rejects.toMatchObject({ code: '42501' });
      const updatePrivilege = await app.query<{ privilege: boolean }>(
        'SELECT has_table_privilege(current_user,$1,$2) AS privilege', [`symphony.${table}`, 'UPDATE'],
      );
      expect(updatePrivilege.rows[0]?.privilege, `${table} UPDATE`).toBe(false);
      await expect(app.query(`UPDATE symphony.${table} SET id=id WHERE false`), `${table} actual UPDATE`).rejects.toMatchObject({ code: '42501' });
      const deletePrivilege = await app.query<{ privilege: boolean }>(
        'SELECT has_table_privilege(current_user,$1,$2) AS privilege', [`symphony.${table}`, 'DELETE'],
      );
      expect(deletePrivilege.rows[0]?.privilege, `${table} DELETE`).toBe(false);
      await expect(app.query(`DELETE FROM symphony.${table} WHERE false`), `${table} actual DELETE`).rejects.toMatchObject({ code: '42501' });
      const truncatePrivilege = await app.query<{ privilege: boolean }>(
        'SELECT has_table_privilege(current_user,$1,$2) AS privilege', [`symphony.${table}`, 'TRUNCATE'],
      );
      expect(truncatePrivilege.rows[0]?.privilege, `${table} TRUNCATE`).toBe(false);
      await expect(app.query(`TRUNCATE symphony.${table}`), `${table} actual TRUNCATE`).rejects.toMatchObject({ code: '42501' });
    }
    const scopePrivileges = await app.query<{ select_ok: boolean; insert_ok: boolean; update_ok: boolean; delete_ok: boolean; truncate_ok: boolean }>(
      `SELECT has_table_privilege(current_user,'symphony.authority_scope_versions','SELECT') AS select_ok,
              has_table_privilege(current_user,'symphony.authority_scope_versions','INSERT') AS insert_ok,
              has_table_privilege(current_user,'symphony.authority_scope_versions','UPDATE') AS update_ok,
              has_table_privilege(current_user,'symphony.authority_scope_versions','DELETE') AS delete_ok,
              has_table_privilege(current_user,'symphony.authority_scope_versions','TRUNCATE') AS truncate_ok`,
    );
    expect(scopePrivileges.rows[0]).toEqual({ select_ok: true, insert_ok: false, update_ok: false, delete_ok: false, truncate_ok: false });

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      await sql`UPDATE symphony.authority_scope_versions SET version=version+1
        WHERE scope_type='actor' AND tenant_id IS NULL AND scope_id=${actorUserId}::uuid`.execute(trx);
    })).rejects.toMatchObject({ code: '42501' });

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`INSERT INTO symphony.authority_scope_versions(scope_type,tenant_id,scope_id,version)
        VALUES('tenant',${tenantId}::uuid,${tenantId}::uuid,41)`.execute(trx);
    })).rejects.toMatchObject({ code: '42501' });
  });

  it('increments changed scopes once and rolls the version back with the surrounding transaction', async () => {
    const before = await admin.query<{ version: string }>(
      `SELECT version FROM symphony.authority_scope_versions
        WHERE scope_type='tenant' AND tenant_id=$1 AND scope_id=$1`,
      [tenantId],
    );
    const tenantScope = { scopeType: 'tenant' as const, tenantId, scopeId: tenantId };
    await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      const locks = await acquireAuthorityScopeLocks(trx, { ...request, mode: 'authority_mutation' });
      await locks.incrementChangedScopes([tenantScope]);
    });
    const committed = await admin.query<{ version: string }>(
      `SELECT version FROM symphony.authority_scope_versions
        WHERE scope_type='tenant' AND tenant_id=$1 AND scope_id=$1`,
      [tenantId],
    );
    expect(Number(committed.rows[0]?.version)).toBe(Number(before.rows[0]?.version) + 1);

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      await sql`UPDATE symphony.authority_scope_versions SET version=version+2
        WHERE scope_type='tenant' AND tenant_id=${tenantId}::uuid AND scope_id=${tenantId}::uuid`.execute(trx);
    })).rejects.toThrow('authority scope version must advance by exactly one');

    await expect(db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      const locks = await acquireAuthorityScopeLocks(trx, { ...request, mode: 'authority_mutation' });
      await locks.incrementChangedScopes([tenantScope]);
      throw new Error('force scope rollback');
    })).rejects.toThrow('force scope rollback');
    const afterRollback = await admin.query<{ version: string }>(
      `SELECT version FROM symphony.authority_scope_versions
        WHERE scope_type='tenant' AND tenant_id=$1 AND scope_id=$1`,
      [tenantId],
    );
    expect(afterRollback.rows[0]?.version).toBe(committed.rows[0]?.version);
  });

  it('allows concurrent protected readers and blocks a mutator until both release their FOR SHARE locks', async () => {
    const readerReady: Promise<void>[] = [];
    const readerRelease: Promise<void>[] = [];
    const signalReady: (() => void)[] = [];
    const unblock: (() => void)[] = [];
    for (let index = 0; index < 2; index += 1) {
      readerReady.push(new Promise<void>((resolve) => signalReady[index] = resolve));
      readerRelease.push(new Promise<void>((resolve) => unblock[index] = resolve));
    }
    const readers = [0, 1].map((index) => db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      await acquireAuthorityScopeLocks(trx, request);
      signalReady[index]!();
      await readerRelease[index];
    }));
    await Promise.all(readerReady);

    let mutationEntered!: () => void;
    const mutationStarted = new Promise<void>((resolve) => { mutationEntered = resolve; });
    let mutationAcquired = false;
    const mutator = db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`.execute(trx);
      const pidResult = await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx);
      const pid = pidResult.rows[0]!.pid;
      mutationEntered();
      await acquireAuthorityScopeLocks(trx, { ...request, mode: 'authority_mutation' });
      mutationAcquired = true;
      return pid;
    });
    await mutationStarted;

    const mutatorPid = await waitForMutatorPid(admin);
    let observedBlocker = false;
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const state = await admin.query<{ blocked: boolean }>(
        'SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked',
        [mutatorPid],
      );
      if (state.rows[0]?.blocked) { observedBlocker = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(observedBlocker).toBe(true);
    expect(mutationAcquired).toBe(false);
    unblock.forEach((release) => release());
    await Promise.all(readers);
    await mutator;
    expect(mutationAcquired).toBe(true);
  });
});

async function waitForMutatorPid(pool: pg.Pool): Promise<number> {
  // This query identifies the one blocked app-role transaction by its active
  // scope-lock statement; it creates a database-observed barrier, not a sleep.
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await pool.query<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity
        WHERE datname=current_database() AND usename='symphony_app'
          AND query LIKE '%authority_scope_versions%' AND state='active'
        ORDER BY query_start DESC LIMIT 1`,
    );
    if (result.rows[0]) return result.rows[0].pid;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('REM-WP2.6 mutator did not reach the authority scope lock query');
}
