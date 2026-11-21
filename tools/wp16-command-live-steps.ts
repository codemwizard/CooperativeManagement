import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { After, Before, Given, Then, When, setDefaultTimeout } from '@cucumber/cucumber';
import pg from 'pg';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
import { createAuthComposition } from '../apps/api/src/authentication-composition.js';
import { buildApiServer } from '../apps/api/src/server.js';
import { loadApiRuntimeConfig } from '../apps/api/src/runtime-config.js';
import { createPostgresCommandComposition } from '../apps/api/src/command-composition.js';
import { createCommandRoutes } from '../apps/api/src/routes/commands.js';
import type { SymphonyWorld } from '../packages/testkit/src/step-definitions/world.js';

type Actor = { userId: string; tenantId: string; organizationId: string; role: string; password: string };
type GrantRequest = { commandId: string; organizationId: string; occurredAt: string; expectedVersion: number | null; schemaVersion: 1; type: 'GrantCapacity'; payload: { capacityGrantId: string; targetUserId: string; capacityType: 'field_agent'; activeFrom: string; activeTo: string; sourceRef: string } };
type LiveState = {
  admin: pg.Pool; appPool: pg.Pool; database: string; adminUrl: string; appUrl: string;
  tenantA: string; tenantB: string; orgA: string; orgB: string; secretary: Actor; chair: Actor; targetUserA: string; targetUserB: string;
  app: import('fastify').FastifyInstance; commands: ReturnType<typeof createPostgresCommandComposition>;
  session?: { cookie: string; csrf: string; actor: Actor };
  lastResponse?: { statusCode: number; body: Record<string, unknown> };
  request?: GrantRequest; eventCountBefore?: number; auditCommandId?: string;
  orgBSnapshot?: { evidence: string; capacities: string; events: string };
};
const stateOf = (world: SymphonyWorld): LiveState | undefined => (world as unknown as { _wp16Live?: LiveState })._wp16Live;
const liveTag = '@wp16-live';

setDefaultTimeout(120_000);

Before({ tags: liveTag }, async function (this: SymphonyWorld) {
  const adminBase = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
  const appBase = process.env.PHASE1_TEST_APP_DATABASE_URL;
  const migrationBase = process.env.MIGRATION_TEST_DATABASE_URL;
  if (process.env.DATA_MODE !== 'test' || !adminBase || !appBase || !migrationBase) {
    throw new Error('Mapped WP1.6 command scenarios require DATA_MODE=test and isolated test-admin, app-role and migration PostgreSQL URLs.');
  }
  const sourceName = decodeURIComponent(new URL(adminBase).pathname.replace(/^\//, ''));
  if (!sourceName.endsWith('_test')) throw new Error('Refusing to create the WP1.6 database from a non-test PostgreSQL database.');
  const database = `phase1_aud_${randomUUID().replaceAll('-', '').slice(0, 16)}_test`;
  const admin = new pg.Pool({ connectionString: adminBase, max: 3 });
  const quoted = `"${database.replaceAll('"', '""')}"`;
  await admin.query(`CREATE DATABASE ${quoted}`);
  const migrationRole = decodeURIComponent(new URL(migrationBase).username);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(migrationRole)) throw new Error('Migration role is not a valid PostgreSQL identifier.');
  await admin.query(`GRANT CONNECT, CREATE ON DATABASE ${quoted} TO "${migrationRole}"`);
  await admin.query(`GRANT CONNECT ON DATABASE ${quoted} TO symphony_app`);
  const isolatedMigrationUrl = new URL(migrationBase); isolatedMigrationUrl.pathname = `/${database}`;
  const migrated = await runMigration(isolatedMigrationUrl.toString());
  if (migrated.status !== 0) throw new Error(`WP1.6 isolated PostgreSQL migrations failed: ${migrated.stderr}\n${migrated.stdout}`);
  const isolatedAdminUrl = new URL(adminBase); isolatedAdminUrl.pathname = `/${database}`;
  const isolatedAppUrl = new URL(appBase); isolatedAppUrl.pathname = `/${database}`;
  const state: LiveState = {
    admin: new pg.Pool({ connectionString: isolatedAdminUrl.toString(), max: 3 }),
    appPool: new pg.Pool({ connectionString: isolatedAppUrl.toString(), max: 3 }),
    database, adminUrl: isolatedAdminUrl.toString(), appUrl: isolatedAppUrl.toString(),
    tenantA: randomUUID(), tenantB: randomUUID(), orgA: randomUUID(), orgB: randomUUID(), targetUserA: randomUUID(), targetUserB: randomUUID(),
    secretary: makeActor(randomUUID(), '', '', 'secretary'), chair: makeActor(randomUUID(), '', '', 'chairperson'),
    app: undefined as never, commands: undefined as never,
  };
  state.secretary = { ...state.secretary, tenantId: state.tenantA, organizationId: state.orgA };
  state.chair = { ...state.chair, tenantId: state.tenantA, organizationId: state.orgA };
  const env: NodeJS.ProcessEnv = {
    ...process.env, DATABASE_URL: state.appUrl, RUNTIME_PROFILE: 'test', APP_ENV: 'test', DATA_MODE: 'test',
    NODE_ENV: 'test', SYNTHETIC_ONLY: 'true', PUBLIC_ORIGIN: 'http://localhost:5174',
    COMMAND_DIGEST_HMAC_KEY: Buffer.alloc(32, 0x44).toString('base64'),
    AUTH_THROTTLE_HMAC_KEY: Buffer.alloc(32, 0x53).toString('base64'),
  };
  const config = loadApiRuntimeConfig(env);
  const auth = createAuthComposition({ pool: state.appPool, config, throttleHmacKey: Buffer.alloc(32, 0x53) });
  state.commands = createPostgresCommandComposition(env);
  state.app = buildApiServer({ config, routes: {
    authentication: auth.authentication, verifyCsrf: auth.verifyCsrf, authorize: auth.authorize,
    rotateSession: auth.rotateSession, commands: createCommandRoutes(state.commands),
  } });
  await state.app.ready();
  await state.admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2),($3,$4)', [state.tenantA, `WP1.6-A-${state.tenantA}`, state.tenantB, `WP1.6-B-${state.tenantB}`]);
  await state.admin.query(
    `INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind)
     VALUES($1,$2,'WP1.6 Org A','active','cooperative'),($3,$4,'WP1.6 Org B','active','cooperative')`,
    [state.orgA, state.tenantA, state.orgB, state.tenantB],
  );
  await state.admin.query('INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status) VALUES($1,$2,$3,$3,\'active\'),($4,$5,$6,$6,\'active\')',
    [state.targetUserA, state.tenantA, `target-${state.targetUserA}@example.invalid`, state.targetUserB, state.tenantB, `target-${state.targetUserB}@example.invalid`]);
  await insertActor(state, state.secretary, false);
  await insertActor(state, state.chair, true);
  (this as unknown as { _wp16Live: LiveState })._wp16Live = state;
  this.organisations['Org A'] = { id: state.orgA, tenantId: state.tenantA };
  this.organisations['Org B'] = { id: state.orgB, tenantId: state.tenantB };
});

After({ tags: liveTag }, async function (this: SymphonyWorld) {
  const state = stateOf(this); if (!state) return;
  await state.app.close().catch(() => undefined);
  await state.commands.close().catch(() => undefined);
  await state.appPool.end().catch(() => undefined);
  await state.admin.end().catch(() => undefined);
  const adminBase = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
  if (adminBase) {
    const root = new pg.Pool({ connectionString: adminBase, max: 1 });
    try {
      await root.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [state.database]);
      await root.query(`DROP DATABASE IF EXISTS "${state.database.replaceAll('"', '""')}"`);
    } finally { await root.end(); }
  }
});

Given('a persisted Chairperson session in {string}', async function (this: SymphonyWorld, _org: string) {
  const state = requireLive(this); state.session = await login(state, state.chair); this.currentActor = { userId: state.chair.userId, tenantId: state.tenantA, role: 'chairperson' };
});

Given('a registered GrantCapacity command has been applied', async function (this: SymphonyWorld) {
  const state = requireLive(this); if (!state.session) state.session = await login(state, state.chair);
  state.request = grantRequest(state, state.orgA);
  state.request.payload.targetUserId = state.targetUserA;
  const before = await eventCount(state, state.request.payload.capacityGrantId); state.eventCountBefore = before;
  state.lastResponse = await post(state, state.request, state.session);
  if (state.lastResponse.statusCode !== 200) {
    const diagnostics = await chairAuthorityFacts(state);
    throw new Error(`Initial registered command must succeed through HTTP: ${JSON.stringify(state.lastResponse.body)}; persisted chair authority facts=${JSON.stringify(diagnostics)}`);
  }
  this.lastCommandId = state.request.commandId;
});

When('the same registered command is submitted again', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.ok(state.request && state.session);
  state.lastResponse = await post(state, state.request, state.session);
});

Then('the HTTP result is a replay of the original command result', function (this: SymphonyWorld) {
  const state = requireLive(this); assert.equal(state.lastResponse?.statusCode, 200);
  assert.equal(state.lastResponse?.body.replayed, true); assert.deepEqual(state.lastResponse?.body.data, { operation: 'granted', sourceId: state.request?.payload.capacityGrantId });
});

Then('no additional event is written for the replay', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.ok(state.request); assert.equal(await eventCount(state, state.request.payload.capacityGrantId), state.eventCountBefore! + 1);
});

When('a registered command reuses the id with a different payload', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.ok(state.request && state.session);
  state.lastResponse = await post(state, { ...state.request, payload: { ...state.request.payload, sourceRef: 'changed-provenance' } }, state.session);
});

Then('the HTTP command result is {string}', function (this: SymphonyWorld, expected: string) {
  const state = requireLive(this); assert.equal(state.lastResponse?.body.code, expected);
  assert.equal(state.lastResponse?.statusCode, expected === 'NOT_AUTHORIZED' ? 403 : expected === 'INVALID_COMMAND' ? 400 : 409);
});

When('the Secretary in {string} submits GrantCapacity for {string}', async function (this: SymphonyWorld, _actorOrg: string, targetOrg: string) {
  const state = requireLive(this); const actor = state.secretary; state.session = await login(state, actor);
  const targetId = targetOrg === 'Org B' ? state.orgB : state.orgA;
  state.orgBSnapshot = await orgBSnapshot(state);
  const targetUser = targetOrg === 'Org B' ? state.targetUserB : state.targetUserA;
  const base = grantRequest(state, targetId);
  const request = { ...base, commandId: randomUUID(), organizationId: targetId, payload: { ...base.payload, targetUserId: targetUser } };
  state.auditCommandId = request.commandId; state.lastResponse = await post(state, request, state.session);
});

When('they submit the registered {string} command', async function (this: SymphonyWorld, commandType: string) {
  assert.equal(commandType, 'GrantCapacity'); const state = requireLive(this);
  const role = (this as unknown as { _wp16ReadonlyRole?: string })._wp16ReadonlyRole ?? 'pfi_analyst';
  const actor = await createReadOnlyActor(state, role); state.session = await login(state, actor);
  const request = grantRequest(state, state.orgA); request.payload.targetUserId = state.targetUserA; state.auditCommandId = request.commandId;
  state.lastResponse = await post(state, request, state.session);
});

When('a client submits a registered command with injected {string}: {string}', async function (this: SymphonyWorld, field: string, value: string) {
  const state = requireLive(this); state.session = await login(state, state.chair);
  const request = grantRequest(state, state.orgA); request.payload.targetUserId = state.targetUserA;
  const accepted = await post(state, request, state.session);
  assert.equal(accepted.statusCode, 200, 'The source-backed capacity state must be created by an accepted command before testing the injected status.');
  state.request = request;
  const body = { ...request, payload: { ...request.payload, [field]: value } };
  state.eventCountBefore = await eventCount(state, request.payload.capacityGrantId);
  state.lastResponse = await post(state, body, state.session);
});

Then('the client-supplied status is rejected by the command schema', function (this: SymphonyWorld) {
  const state = requireLive(this); assert.equal(state.lastResponse?.statusCode, 400); assert.equal(state.lastResponse?.body.code, 'INVALID_COMMAND');
});

Then('the persisted capacity remains linked to its committed domain event', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.ok(state.request);
  const rows = await state.admin.query<{ source_event_id: string | null; event_id: string | null; receipts: number; outbox: number }>(
    `SELECT g.source_event_id::text source_event_id,e.id::text event_id,
            (SELECT count(*)::int FROM symphony.command_receipts r WHERE r.tenant_id=$2 AND r.command_id=$3) receipts,
            (SELECT count(*)::int FROM symphony.event_outbox o JOIN symphony.domain_events oe ON oe.id=o.event_id WHERE oe.aggregate_id=$4) outbox
       FROM symphony.capacity_grants g LEFT JOIN symphony.domain_events e ON e.id=g.source_event_id
      WHERE g.id=$1 AND g.organization_id=$5`, [state.request.payload.capacityGrantId, state.tenantA, state.request.commandId, state.request.payload.capacityGrantId, state.orgA]);
  assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0]!.source_event_id, rows.rows[0]!.event_id);
  assert.equal(rows.rows[0]!.receipts, 1); assert.equal(rows.rows[0]!.outbox, 1);
  assert.equal(await eventCount(state, state.request.payload.capacityGrantId), state.eventCountBefore);
});

Then('the rejected request writes no capacity, event, receipt or outbox state', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.equal(state.lastResponse?.body.code, 'INVALID_COMMAND');
  assert.ok(state.request);
  const rows = await state.admin.query<{ source_event_id: string | null; event_id: string | null; receipts: number; outbox: number }>(
    `SELECT g.source_event_id::text source_event_id,e.id::text event_id,
            (SELECT count(*)::int FROM symphony.command_receipts r WHERE r.tenant_id=$2 AND r.command_id=$3) receipts,
            (SELECT count(*)::int FROM symphony.event_outbox o JOIN symphony.domain_events oe ON oe.id=o.event_id WHERE oe.aggregate_id=$4) outbox
       FROM symphony.capacity_grants g LEFT JOIN symphony.domain_events e ON e.id=g.source_event_id
      WHERE g.id=$1 AND g.tenant_id=$2`, [state.request.payload.capacityGrantId, state.tenantA, state.request.commandId, state.request.payload.capacityGrantId]);
  assert.equal(rows.rowCount, 1); assert.equal(rows.rows[0]!.source_event_id, rows.rows[0]!.event_id);
  assert.equal(rows.rows[0]!.receipts, 1); assert.equal(rows.rows[0]!.outbox, 1);
  assert.equal(await eventCount(state, state.request.payload.capacityGrantId), state.eventCountBefore);
});

When('a Secretary sends GrantCapacity with a forged platform-admin role header', async function (this: SymphonyWorld) {
  const state = requireLive(this); state.session = await login(state, state.secretary);
  const request = grantRequest(state, state.orgA); request.payload.targetUserId = state.targetUserA; state.auditCommandId = request.commandId;
  state.lastResponse = await post(state, request, state.session, { 'x-role': 'platform_admin' });
});

Then('the same authenticated Secretary is denied without the forged header', async function (this: SymphonyWorld) {
  const state = requireLive(this); assert.ok(state.session);
  const request = grantRequest(state, state.orgA); request.payload.targetUserId = state.targetUserA; request.commandId = randomUUID(); state.auditCommandId = request.commandId;
  const plain = await post(state, request, state.session);
  assert.equal(plain.statusCode, state.lastResponse?.statusCode); assert.deepEqual(plain.body, state.lastResponse?.body);
});

Then('no business command state was written', async function (this: SymphonyWorld) {
  const state = requireLive(this);
  const rows = await state.admin.query<{ grants: number; events: number; receipts: number }>(
    `SELECT (SELECT count(*)::int FROM symphony.capacity_grants WHERE organization_id=$1) grants,
            (SELECT count(*)::int FROM symphony.domain_events WHERE tenant_id=$2) events,
            (SELECT count(*)::int FROM symphony.command_receipts WHERE tenant_id=$2) receipts`, [state.orgA, state.tenantA]);
  assert.deepEqual(rows.rows[0], { grants: 0, events: 0, receipts: 0 });
});

export function liveState(world: SymphonyWorld): LiveState | undefined { return stateOf(world); }

export async function orgBSnapshot(state: LiveState): Promise<{ evidence: string; capacities: string; events: string }> {
  const counts = await state.admin.query<{ evidence: string; capacities: string; events: string }>(
    `SELECT (SELECT count(*)::text FROM symphony.evidence_items WHERE organization_id=$1) evidence,
            (SELECT count(*)::text FROM symphony.capacity_grants WHERE organization_id=$1) capacities,
            (SELECT count(*)::text FROM symphony.domain_events WHERE tenant_id=$2) events`, [state.orgB, state.tenantB]);
  return counts.rows[0]!;
}

async function chairAuthorityFacts(state: LiveState): Promise<unknown> {
  const client = await state.appPool.connect();
  try {
    await client.query('BEGIN'); await client.query("SELECT set_config('app.tenant_id',$1,true)", [state.tenantA]);
    const facts = await client.query(`SELECT u.status,
      (SELECT count(*)::int FROM symphony.user_person_links l WHERE l.tenant_id=$1 AND l.user_id=$2 AND l.unlinked_at IS NULL) links,
      (SELECT array_agg(DISTINCT p.code) FROM symphony.appointments a JOIN symphony.position_catalog p ON p.id=a.position_id
        WHERE a.organization_id=$3 AND a.person_id IN (SELECT person_id FROM symphony.user_person_links WHERE tenant_id=$1 AND user_id=$2)) positions,
      (SELECT count(*)::int FROM symphony.appointments a JOIN symphony.position_catalog p ON p.id=a.position_id
        WHERE a.organization_id=$3 AND a.person_id IN (SELECT person_id FROM symphony.user_person_links WHERE tenant_id=$1 AND user_id=$2)
          AND a.started_at <= transaction_timestamp() AND (a.ended_at IS NULL OR a.ended_at > transaction_timestamp())) appointments,
      (SELECT count(*)::int FROM symphony.organization_memberships m WHERE m.tenant_id=$1 AND m.organization_id=$3
        AND m.person_id IN (SELECT person_id FROM symphony.user_person_links WHERE tenant_id=$1 AND user_id=$2)
        AND m.status='active' AND m.joined_at <= transaction_timestamp() AND (m.ended_at IS NULL OR m.ended_at > transaction_timestamp())) memberships
      FROM symphony.users u WHERE u.tenant_id=$1 AND u.id=$2`, [state.tenantA, state.chair.userId, state.orgA]);
    let audit: unknown = null;
    if (state.request) {
      try { audit = (await state.admin.query('SELECT denial_code FROM symphony.security_attempts WHERE observed_command_id=$1', [state.request.commandId])).rows[0] ?? null; }
      catch (error) { audit = { unavailable: error instanceof Error ? error.message : String(error) }; }
    }
    await client.query('COMMIT'); return { actor: facts.rows[0] ?? null, denialAudit: audit };
  } finally { client.release(); }
}

async function insertActor(state: LiveState, actor: Actor, officeholder: boolean): Promise<void> {
  await state.admin.query('INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status) VALUES($1,$2,$3,$3,\'active\')', [actor.userId, actor.tenantId, `${actor.role}-${actor.userId}@example.invalid`]);
  const personId = randomUUID();
  await state.admin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)', [personId, actor.tenantId, `wp16-${personId}`]);
  await state.admin.query('INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id) VALUES($1,$2,$3,\'wp16-bdd-fixture\',$2)', [actor.tenantId, actor.userId, personId]);
  await state.admin.query("INSERT INTO symphony.authority_scope_versions(scope_type,tenant_id,scope_id) VALUES('actor',NULL,$1) ON CONFLICT DO NOTHING", [actor.userId]);
  await state.admin.query('INSERT INTO symphony.organization_memberships(tenant_id,organization_id,person_id,status,joined_at,source_ref) VALUES($1,$2,$3,\'active\',clock_timestamp()-interval \'1 day\',\'wp16-bdd-fixture\')', [actor.tenantId, actor.organizationId, personId]);
  if (officeholder) await state.admin.query('INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref) VALUES($1,$2,\'00000000-0000-4000-8000-000000000001\',clock_timestamp()-interval \'1 hour\',\'wp16-bdd-fixture\')', [actor.organizationId, personId]);
  if (actor.role !== 'chairperson' && actor.role !== 'secretary') {
    const role = await state.admin.query<{ id: string }>('INSERT INTO symphony.platform_roles(code,name) VALUES($1,$1) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id', [actor.role]);
    await state.admin.query('INSERT INTO symphony.user_role_assignments(user_id,platform_role_id,tenant_id) VALUES($1,$2,$3)', [actor.userId, role.rows[0]!.id, actor.tenantId]);
  }
  const lifecycle = new CredentialLifecycleService({ now: () => new Date().toISOString() });
  const hash = await lifecycle.hashPermanentPassword(actor.password);
  const client = await state.appPool.connect();
  try { await client.query('BEGIN'); await client.query("SELECT set_config('app.tenant_id',$1,true)", [actor.tenantId]); await client.query('INSERT INTO symphony.password_credentials(tenant_id,user_id,secret_hash) VALUES($1,$2,$3)', [actor.tenantId, actor.userId, hash]); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
}

export async function createReadOnlyActor(state: LiveState, role: string): Promise<Actor> {
  const actor = makeActor(randomUUID(), state.tenantA, state.orgA, role); await insertActor(state, actor, false);
  if (role === 'union_ta') {
    const unionId = randomUUID(); await state.admin.query("INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind) VALUES($1,$2,'WP1.6 Union','active','union')", [unionId, state.tenantA]);
    await state.admin.query("INSERT INTO symphony.institutional_role_assignments(tenant_id,user_id,institution_organization_id,role_code,granted_at,source_ref) VALUES($1,$2,$3,'union_ta',clock_timestamp(),'wp16-bdd-fixture')", [state.tenantA, actor.userId, unionId]);
  }
  return actor;
}

async function login(state: LiveState, actor: Actor): Promise<{ cookie: string; csrf: string; actor: Actor }> {
  const csrfResponse = await state.app.inject({ method: 'GET', url: '/auth/csrf' });
  const token = csrfResponse.json<{ csrfToken: string }>().csrfToken; const cookie = getCookie(csrfResponse.headers['set-cookie']);
  const response = await state.app.inject({ method: 'POST', url: '/auth/login', headers: { cookie, origin: 'http://localhost:5174', 'x-csrf-token': token }, payload: { userId: actor.userId, credential: actor.password, deviceId: 'wp16-cucumber' } });
  assert.equal(response.statusCode, 200, `Test actor login failed for ${actor.role}.`);
  const sessionCookie = getCookie(response.headers['set-cookie']);
  const session = await state.app.inject({ method: 'GET', url: '/auth/session', headers: { cookie: sessionCookie } });
  assert.equal(session.statusCode, 200);
  return { cookie: sessionCookie, csrf: session.json<{ csrfToken: string }>().csrfToken, actor };
}

function grantRequest(state: LiveState, organizationId: string): GrantRequest {
  return { commandId: randomUUID(), organizationId, occurredAt: new Date().toISOString(), expectedVersion: null, schemaVersion: 1, type: 'GrantCapacity', payload: { capacityGrantId: randomUUID(), targetUserId: randomUUID(), capacityType: 'field_agent', activeFrom: new Date(Date.now() - 60_000).toISOString(), activeTo: new Date(Date.now() + 3_600_000).toISOString(), sourceRef: 'wp16-cucumber' } };
}
async function post(state: LiveState, body: unknown, session: { cookie: string; csrf: string }, extra: Record<string, string> = {}) {
  const response: any = await state.app.inject({ method: 'POST', url: '/commands', headers: { cookie: session.cookie, origin: 'http://localhost:5174', 'x-csrf-token': session.csrf, ...extra }, payload: body as never });
  let json: Record<string, unknown>; try { json = response.json<Record<string, unknown>>(); } catch { json = {}; }
  return { statusCode: response.statusCode, body: json };
}
async function eventCount(state: LiveState, aggregateId: string): Promise<number> { const row = await state.admin.query<{ count: string }>('SELECT count(*)::text count FROM symphony.domain_events WHERE aggregate_id=$1', [aggregateId]); return Number(row.rows[0]!.count); }
function getCookie(header: string | string[] | undefined): string { const value = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined; assert.ok(value); return value.split(';', 1)[0]!; }
function makeActor(userId: string, tenantId: string, organizationId: string, role: string): Actor { return { userId, tenantId, organizationId, role, password: `wp16 ${role} ${randomUUID()} credential` }; }
function requireLive(world: SymphonyWorld): LiveState { const state = stateOf(world); assert.ok(state, 'Live PostgreSQL/API fixture was not initialized.'); return state; }
function runMigration(databaseUrl: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'packages/db/src/migrate.ts'], { cwd: resolve(process.cwd()), env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_SCHEMA: 'symphony' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; }); child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; }); child.once('error', reject); child.once('close', (status) => resolvePromise({ status, stdout, stderr }));
  });
}
