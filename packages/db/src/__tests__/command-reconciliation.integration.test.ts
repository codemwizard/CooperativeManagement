import { randomUUID, createHmac } from 'node:crypto';
import { connect, createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { z } from 'zod';
import {
  CommandBus,
  type AggregateRoot,
  type CommandEnvelope,
  type ReconciliationInboxStore,
} from '@symphony/domain';
import { LocalDevKeyProvider } from '../../../domain/src/privacy/key-provider.js';
import { PostgresCommandReceiptStore } from '../repositories/postgres-command-receipt-store.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresReconciliationInboxStore } from '../repositories/postgres-reconciliation-inbox-store.js';
import { PostgresRepository, type PostgresCommandTransactionContext } from '../repositories/postgres-repository.js';
import type { SymphonyDatabase } from '../types/database.js';

interface TestAggregate extends AggregateRoot { readonly value: string }
interface TestPayload { readonly aggregateId: string; readonly value: string }

const adminDatabaseUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const appDatabaseUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'];
const expectedAppDatabase = appDatabaseUrl
  ? decodeURIComponent(new URL(appDatabaseUrl).pathname.replace(/^\//, ''))
  : '';

class CommitAckDropProxy {
  private readonly server: Server;
  private dropped = false;

  constructor(private readonly target: URL, private readonly mode: 'before_commit' | 'after_commit') {
    this.server = createServer((client) => {
      const upstream = connect({ host: target.hostname, port: Number(target.port) });
      let clientTail = Buffer.alloc(0);
      let upstreamTail = Buffer.alloc(0);
      client.on('data', (chunk) => {
        const observed = Buffer.concat([clientTail, chunk]);
        clientTail = observed.subarray(Math.max(0, observed.length - 16));
        if (!this.dropped && this.mode === 'before_commit' && observed.toString('latin1').toUpperCase().includes('COMMIT\0')) {
          this.dropped = true;
          client.destroy();
          upstream.destroy();
          return;
        }
        upstream.write(chunk);
      });
      upstream.on('data', (chunk) => {
        const observed = Buffer.concat([upstreamTail, chunk]);
        upstreamTail = observed.subarray(Math.max(0, observed.length - 16));
        if (!this.dropped && this.mode === 'after_commit' && observed.includes(Buffer.from('COMMIT\0'))) {
          this.dropped = true;
          client.destroy();
          upstream.destroy();
          return;
        }
        client.write(chunk);
      });
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
    });
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('TCP fault proxy did not bind a port.');
    return `postgresql://${address.address}:${address.port}`;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }

  assertDropped(): void {
    if (!this.dropped) throw new Error(`TCP fault proxy never observed the ${this.mode} commit boundary.`);
  }
}

describe.skipIf(!adminDatabaseUrl || !appDatabaseUrl)('WP1.4 terminal conflict receipt and reconciliation persistence', () => {
  const tenantId = randomUUID();
  const aggregateId = randomUUID();
  const actorId = randomUUID();
  const commandPool = new pg.Pool({ connectionString: appDatabaseUrl, max: 8, onConnect: async (client) => {
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
  } });
  const recoveryPool = new pg.Pool({ connectionString: appDatabaseUrl, max: 3, onConnect: async (client) => {
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
  } });
  const fixturePool = new pg.Pool({ connectionString: adminDatabaseUrl, max: 4, onConnect: async (client) => {
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
  } });
  const db = new Kysely<SymphonyDatabase>({ dialect: new PostgresDialect({ pool: commandPool }) });
  const recoveryDb = new Kysely<SymphonyDatabase>({ dialect: new PostgresDialect({ pool: recoveryPool }) });
  const repository = new PostgresRepository<TestAggregate>(db, 'Wp14TestAggregate');
  const receiptStore = new PostgresCommandReceiptStore({ 'test.value.set': z.object({ value: z.string() }).strict() });
  const inboxStore = new PostgresReconciliationInboxStore();
  const fieldEncryption = new LocalDevKeyProvider({ rootKeyHex: 'c'.repeat(64), pepper: Buffer.from('test-only') });
  const expiry = '2030-01-02T00:00:00.000Z';
  let observedVersion = 2;

  beforeAll(async () => {
    const identity = await fixturePool.query<{ database_name: string; server_version_num: string; database_role: string }>(
      "SELECT current_database() AS database_name, current_setting('server_version_num') AS server_version_num, current_user AS database_role",
    );
    expect(identity.rows[0]?.database_name.endsWith('_test')).toBe(true);
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    expect(process.env['DATA_MODE']).toBe('test');
    const appIdentity = await commandPool.query<{ database_name: string; database_role: string }>(
      'SELECT current_database() AS database_name, current_user AS database_role',
    );
    expect(appIdentity.rows[0]).toEqual({ database_name: expectedAppDatabase, database_role: 'symphony_app' });
    expect(expectedAppDatabase.endsWith('_test')).toBe(true);
    console.info(`WP1.4 command target: ${appIdentity.rows[0]?.database_name}; database_role=${appIdentity.rows[0]?.database_role}; fixture_role=${identity.rows[0]?.database_role}; DATA_MODE=test`);
    await fixturePool.query('INSERT INTO symphony.tenants (id, name) VALUES ($1, $2)', [tenantId, 'wp1.4-synthetic-fixture']);
    await fixturePool.query(
      `INSERT INTO symphony.aggregate_states (id, tenant_id, aggregate_type, version, state)
       VALUES ($1, $2, 'Wp14TestAggregate', 2, $3)`,
      [aggregateId, tenantId, { id: aggregateId, tenantId, version: 2, value: 'current' }],
    );
  });

  afterAll(async () => {
    const client = await fixturePool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query('DELETE FROM symphony.reconciliation_inbox WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.command_receipts WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.aggregate_states WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.tenants WHERE id = $1', [tenantId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), fixturePool.end()]);
  });

  const makeEnvelope = (commandId = randomUUID(), actorUserId = actorId, value = 'attempted change'): CommandEnvelope<TestPayload> => ({
    commandId,
    tenantId,
    actorUserId,
    occurredAt: '2026-11-10T08:00:00.000Z',
    recordedAt: '2026-11-10T08:00:01.000Z',
    deviceId: 'synthetic-device',
    expectedVersion: 1,
    correlationId: randomUUID(),
    type: 'test.value.set',
    schemaVersion: 1,
    payload: { aggregateId, value },
  });

  const makeBus = (
    store: ReconciliationInboxStore = inboxStore,
    commandDb: Kysely<SymphonyDatabase> = db,
  ) => new CommandBus<TestAggregate>({
    repository: commandDb === db ? repository : new PostgresRepository<TestAggregate>(commandDb, 'Wp14TestAggregate'),
    receiptStore,
    policyStore: { decide: async () => ({ allow: true }) },
    clock: { now: () => '2026-11-10T08:00:02.000Z' },
    idGen: { generate: () => randomUUID() },
    transactionRunner: new PostgresCommandTransactionRunner(commandDb, { recoveryDb }),
    securityAttemptWriter: { record: async () => undefined },
    digestKeyProvider: {
      activeVersion: () => 'wp1.4-integration-v1',
      hmac: async (version, bytes) => createHmac('sha256', version).update(bytes).digest(),
    },
    resultDataSchemas: { 'test.value.set': z.object({ value: z.string() }).strict() },
    reconciliationInboxStore: store,
    reconciliationDataSchemas: { 'test.value.set': z.object({ aggregateId: z.string().uuid(), value: z.string() }).strict() },
    fieldEncryption,
    reconciliationRetentionPolicy: { expiryFor: async () => expiry },
  });

  const handler = async (envelope: CommandEnvelope<TestPayload>) => ({
    newState: { id: aggregateId, tenantId, version: observedVersion + 1, value: envelope.payload.value },
    events: [],
    data: { value: envelope.payload.value },
  });

  it('stores one terminal receipt and encrypted inbox item without success effects, and replays safely', async () => {
    const bus = makeBus();
    const envelope = makeEnvelope();
    let handlerCalls = 0;
    const countedHandler = async (command: CommandEnvelope<TestPayload>) => { handlerCalls += 1; return handler(command); };
    const trustedPrincipal = { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId };

    const first = await bus.dispatch(envelope, countedHandler, trustedPrincipal);
    expect(first).toMatchObject({ ok: false, code: 'STALE_VERSION', detail: 'Command version conflict' });
    const receipt = await fixturePool.query<{ result_classification: string; safe_result: { ok: boolean; code?: string; reconciliation_id?: string } }>(
      'SELECT result_classification, safe_result FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2',
      [tenantId, envelope.commandId],
    );
    expect(receipt.rows).toHaveLength(1);
    expect(receipt.rows[0]?.result_classification).toBe('terminal_rejection');
    expect(receipt.rows[0]?.safe_result).toMatchObject({ ok: false, code: 'VERSION_CONFLICT', expected_version: 1, observed_version: 2 });
    const reconciliationId = receipt.rows[0]?.safe_result.reconciliation_id;
    expect(reconciliationId).toBeDefined();
    expect(first).toMatchObject({ reconciliationId });

    const inbox = await fixturePool.query<{ payload_ciphertext: Buffer; encryption_key_ref: string; lifecycle: string }>(
      'SELECT payload_ciphertext, encryption_key_ref, lifecycle FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = $2',
      [tenantId, reconciliationId],
    );
    expect(inbox.rows).toHaveLength(1);
    expect(inbox.rows[0]?.lifecycle).toBe('open');
    expect(inbox.rows[0]?.payload_ciphertext.toString('utf8')).not.toContain(envelope.payload.value);
    const decoded = await fieldEncryption.decrypt(inbox.rows[0]!.payload_ciphertext, inbox.rows[0]!.encryption_key_ref);
    expect(JSON.parse(Buffer.from(decoded).toString('utf8'))).toMatchObject({
      command_id: envelope.commandId,
      original_actor_id: actorId,
      target_aggregate_id: aggregateId,
      expected_version: 1,
      observed_version: 2,
      changes: envelope.payload,
    });

    const replay = await bus.dispatch(envelope, countedHandler, trustedPrincipal);
    expect(first).not.toHaveProperty('replayed');
    expect(replay).toMatchObject({ ...first, replayed: true });
    expect(handlerCalls).toBe(0);
    expect((await fixturePool.query('SELECT 1 FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = $2', [tenantId, reconciliationId])).rowCount).toBe(1);
    expect((await fixturePool.query('SELECT version, state FROM symphony.aggregate_states WHERE tenant_id = $1 AND id = $2', [tenantId, aggregateId])).rows[0]).toMatchObject({ version: '2', state: { value: 'current' } });
    expect((await fixturePool.query('SELECT count(*)::int AS n FROM symphony.domain_events WHERE tenant_id = $1', [tenantId])).rows[0]?.n).toBe(0);
    expect((await fixturePool.query('SELECT count(*)::int AS n FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id = o.event_id WHERE e.tenant_id = $1', [tenantId])).rows[0]?.n).toBe(0);
  });

  it('rejects changed actor or semantic envelope without disclosing or duplicating the item', async () => {
    const bus = makeBus();
    const commandId = randomUUID();
    const firstEnvelope = makeEnvelope(commandId);
    await bus.dispatch(firstEnvelope, handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
    const changedActor = randomUUID();
    const actorResult = await bus.dispatch(makeEnvelope(commandId, changedActor), handler, { trustedPrincipal: { actorUserId: changedActor, tenantId }, aggregateId });
    const payloadResult = await bus.dispatch(makeEnvelope(commandId, actorId, 'different attempt'), handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
    expect(actorResult).toEqual({ ok: false, code: 'IDEMPOTENCY_KEY_REUSED', detail: 'Idempotency key cannot be reused' });
    expect(payloadResult).toEqual(actorResult);
    expect((await fixturePool.query('SELECT count(*)::int AS n FROM symphony.reconciliation_inbox WHERE tenant_id = $1', [tenantId])).rows[0]?.n).toBe(2);
  });

  it('rolls back the terminal receipt when inbox insertion fails after the insert', async () => {
    const failingStore: ReconciliationInboxStore = {
      save: async (item, context) => { await inboxStore.save(item, context); throw new Error('injected after inbox insert'); },
      get: (...args) => inboxStore.get(...args),
      transition: (...args) => inboxStore.transition(...args),
      expire: (...args) => inboxStore.expire(...args),
    };
    const bus = makeBus(failingStore);
    const envelope = makeEnvelope();
    await expect(bus.dispatch(envelope, handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId })).rejects.toThrow('injected after inbox insert');
    expect((await fixturePool.query('SELECT count(*)::int AS n FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2', [tenantId, envelope.commandId])).rows[0]?.n).toBe(0);
    expect((await fixturePool.query('SELECT count(*)::int AS n FROM symphony.reconciliation_inbox WHERE tenant_id = $1', [tenantId])).rows[0]?.n).toBe(2);
  });

  it('serializes lifecycle transitions and clears expired payload without overwriting a terminal outcome', async () => {
    const bus = makeBus();
    const envelope = makeEnvelope();
    const result = await bus.dispatch(envelope, handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
    if (result.ok || result.code !== 'STALE_VERSION') throw new Error('Expected a terminal conflict fixture.');
    const receipt = await fixturePool.query<{ safe_result: { reconciliation_id: string } }>(
      'SELECT safe_result FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2', [tenantId, envelope.commandId],
    );
    const reconciliationId = receipt.rows[0]!.safe_result.reconciliation_id;
    const transition = (next: 'resolved' | 'superseded') => db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      const context: PostgresCommandTransactionContext = { transactionId: Symbol('wp14-lifecycle'), kyselyTransaction: trx };
      return inboxStore.transition(reconciliationId, tenantId, next, '2026-11-10T08:01:00.000Z', context);
    });
    const lifecycleResults = await Promise.all([transition('resolved'), transition('superseded')]);
    expect(lifecycleResults.filter(Boolean)).toHaveLength(1);
    const winningLifecycle = lifecycleResults[0] ? 'resolved' : 'superseded';
    const expired = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      const context: PostgresCommandTransactionContext = { transactionId: Symbol('wp14-expiry'), kyselyTransaction: trx };
      return inboxStore.expire(reconciliationId, tenantId, '2031-01-01T00:00:00.000Z', context);
    });
    expect(expired).toBe(true);
    const tombstone = await fixturePool.query<{ payload_ciphertext: Buffer | null; encryption_key_ref: string | null; lifecycle: string; tombstoned_at: Date; tenant_id: string }>(
      'SELECT payload_ciphertext, encryption_key_ref, lifecycle, tombstoned_at, tenant_id FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = $2',
      [tenantId, reconciliationId],
    );
    expect(tombstone.rows[0]).toMatchObject({ payload_ciphertext: null, encryption_key_ref: null, lifecycle: winningLifecycle, tenant_id: tenantId });
    expect(tombstone.rows[0]?.tombstoned_at).toBeInstanceOf(Date);

    const openEnvelope = makeEnvelope();
    await bus.dispatch(openEnvelope, handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
    const openReceipt = await fixturePool.query<{ safe_result: { reconciliation_id: string } }>(
      'SELECT safe_result FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2', [tenantId, openEnvelope.commandId],
    );
    const openReconciliationId = openReceipt.rows[0]!.safe_result.reconciliation_id;
    const expiredOpen = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      const context: PostgresCommandTransactionContext = { transactionId: Symbol('wp14-open-expiry'), kyselyTransaction: trx };
      return inboxStore.expire(openReconciliationId, tenantId, '2031-01-01T00:00:00.000Z', context);
    });
    expect(expiredOpen).toBe(true);
    expect((await fixturePool.query<{ lifecycle: string; payload_ciphertext: Buffer | null; encryption_key_ref: string | null }>(
      'SELECT lifecycle, payload_ciphertext, encryption_key_ref FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = $2',
      [tenantId, openReconciliationId],
    )).rows[0]).toMatchObject({ lifecycle: 'expired', payload_ciphertext: null, encryption_key_ref: null });
  });

  it('does not expose the item without matching transaction tenant context and explicit tenant predicate', async () => {
    const bus = makeBus();
    const envelope = makeEnvelope();
    await bus.dispatch(envelope, handler, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
    const receipt = await fixturePool.query<{ safe_result: { reconciliation_id: string } }>(
      'SELECT safe_result FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2', [tenantId, envelope.commandId],
    );
    const reconciliationId = receipt.rows[0]!.safe_result.reconciliation_id;
    const wrongTenant = randomUUID();
    const result = await db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${wrongTenant}, true)`.execute(trx);
      const context: PostgresCommandTransactionContext = { transactionId: Symbol('wp14-wrong-tenant'), kyselyTransaction: trx };
      return inboxStore.get(reconciliationId, tenantId, context);
    });
    expect(result).toBeNull();
  });

  it('proves the restricted role attributes and reconciliation inbox privilege boundary', async () => {
    const result = await commandPool.query<{
      role_name: string;
      is_superuser: boolean;
      bypass_rls: boolean;
      inherits_roles: boolean;
      table_owner: string;
      rls_enabled: boolean;
      rls_forced: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT r.rolname AS role_name, r.rolsuper AS is_superuser,
             r.rolbypassrls AS bypass_rls, r.rolinherit AS inherits_roles,
             pg_get_userbyid(c.relowner) AS table_owner,
             c.relrowsecurity AS rls_enabled,
             c.relforcerowsecurity AS rls_forced,
             has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
             has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
             has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
             has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
      FROM pg_roles r
      CROSS JOIN pg_class c
      WHERE r.rolname = current_user
        AND c.oid = 'symphony.reconciliation_inbox'::regclass
    `);
    expect(result.rows[0]).toMatchObject({
      role_name: 'symphony_app',
      is_superuser: false,
      bypass_rls: false,
      inherits_roles: false,
      table_owner: expect.not.stringMatching(/^symphony_app$/),
      rls_enabled: true,
      rls_forced: true,
      can_select: true,
      can_insert: true,
      can_update: true,
      can_delete: false,
    });

    await expect(commandPool.query(
      'DELETE FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = $2',
      [tenantId, randomUUID()],
    )).rejects.toMatchObject({ code: '42501' });
  });

  it('does not leak transaction-local tenant context when an app connection is reused', async () => {
    const client = await commandPool.connect();
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      expect((await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id")).rows[0]?.tenant_id).toBe(tenantA);
      await client.query('COMMIT');

      await client.query('BEGIN');
      expect((await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id")).rows[0]?.tenant_id).not.toBe(tenantA);
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantB]);
      expect((await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id")).rows[0]?.tenant_id).toBe(tenantB);
      await client.query('COMMIT');
      expect((await client.query("SELECT current_setting('app.tenant_id', true) AS tenant_id")).rows[0]?.tenant_id).not.toBe(tenantB);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  it.each([
    ['after the database committed but before the client received COMMIT', 'after_commit', true],
    ['before PostgreSQL received COMMIT, so the transaction rolled back', 'before_commit', false],
  ] as const)('recovers a real TCP connection loss %s', async (_label, mode, committedOnFirstAttempt) => {
    if (!appDatabaseUrl) throw new Error('PHASE1_TEST_APP_DATABASE_URL is required.');
    const target = new URL(appDatabaseUrl);
    const proxy = new CommitAckDropProxy(target, mode);
    const proxyAddress = new URL(await proxy.start());
    const commandUrl = new URL(appDatabaseUrl);
    commandUrl.hostname = proxyAddress.hostname;
    commandUrl.port = proxyAddress.port;
    const lostConnectionPool = new pg.Pool({
      connectionString: commandUrl.toString(),
      max: 2,
      onConnect: (client) => { client.on('error', () => undefined); },
    });
    lostConnectionPool.on('error', () => undefined);
    const lostConnectionDb = new Kysely<SymphonyDatabase>({ dialect: new PostgresDialect({ pool: lostConnectionPool }) });
    try {
      const bus = makeBus(inboxStore, lostConnectionDb);
      const envelope = makeEnvelope();
      let handlerCalls = 0;
      const result = await bus.dispatch(envelope, async (command) => {
        handlerCalls += 1;
        return handler(command);
      }, { trustedPrincipal: { actorUserId: actorId, tenantId }, aggregateId });
      proxy.assertDropped();
      expect(result).toEqual({
        ok: false,
        code: 'STALE_VERSION',
        detail: 'Command version conflict',
        reconciliationId: expect.any(String),
        ...(committedOnFirstAttempt ? { replayed: true as const } : {}),
      });
      expect(handlerCalls).toBe(0);
      const recoveredReceipt = await recoveryPool.query<{ command_id: string }>(
        'SELECT command_id FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2',
        [tenantId, envelope.commandId],
      );
      const recoveredInbox = await recoveryPool.query<{ reconciliation_id: string }>(
        'SELECT reconciliation_id FROM symphony.reconciliation_inbox WHERE tenant_id = $1 AND reconciliation_id = (SELECT (safe_result->>\'reconciliation_id\')::uuid FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2)',
        [tenantId, envelope.commandId],
      );
      expect(recoveredReceipt.rows).toHaveLength(1);
      expect(recoveredInbox.rows).toHaveLength(1);
      expect((await recoveryPool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2',
        [tenantId, envelope.commandId],
      )).rows[0]?.n).toBe(1);
      if (committedOnFirstAttempt) {
        expect((await recoveryPool.query('SELECT 1 FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2', [tenantId, envelope.commandId])).rowCount).toBe(1);
      }
    } finally {
      await lostConnectionDb.destroy();
      await proxy.close();
    }
  });
});

