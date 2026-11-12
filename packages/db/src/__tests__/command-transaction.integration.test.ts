import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { sql } from 'kysely';
import { z } from 'zod';
import { createDb } from '../db/client.js';
import { PostgresCommandReceiptStore } from '../repositories/postgres-command-receipt-store.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import { PostgresSecurityAttemptWriter, validateSecurityAttemptRuntimeProfile } from '../repositories/postgres-security-attempt-writer.js';
import { CommandBus } from '@symphony/domain';
import type { AggregateRoot, CommandEnvelope, CommandReceipt } from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';

interface TestAggregate extends AggregateRoot { readonly label: string }
const databaseUrl = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const appDatabaseUrl = process.env['PHASE1_TEST_APP_DATABASE_URL'];

describe.skipIf(!databaseUrl || !appDatabaseUrl)('WP1.2-A PostgreSQL transaction boundary', () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = createDb(appDatabaseUrl ?? '', { max: 1 });
  const recoveryDb = createDb(appDatabaseUrl ?? '', { max: 1 });
  const tenantId = randomUUID();
  const receiptStore = new PostgresCommandReceiptStore({ 'test.command': z.object({ value: z.string() }).strict() });
  const runner = new PostgresCommandTransactionRunner(db, { recoveryDb });
  const repository = new PostgresRepository<TestAggregate>(db, 'Wp12TestAggregate');
  const fixtureEventIds: string[] = [];
  const commandEventIds: string[] = [];
  const commandOutboxIds: string[] = [];
  let fixtureOutboxId: string | undefined;
  let fixtureAggregateId: string | undefined;
  let fixtureReceiptId: string | undefined;

  beforeAll(async () => {
    const identity = await pool.query<{ database_name: string; server_version_num: string }>(
      "SELECT current_database() AS database_name, current_setting('server_version_num') AS server_version_num",
    );
    expect(identity.rows[0]?.database_name.endsWith('_test')).toBe(true);
    expect(process.env['DATA_MODE']).toBe('test');
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    await pool.query('INSERT INTO symphony.tenants (id, name) VALUES ($1, $2)', [tenantId, 'wp1.2-synthetic-fixture']);
    const eventIds = [randomUUID(), randomUUID()];
    fixtureEventIds.push(...eventIds);
    const client = await pool.connect();
    try {
      await client.query('SELECT set_config(\'app.tenant_id\', $1, false)', [tenantId]);
      for (const id of eventIds) {
        await client.query(
          `INSERT INTO symphony.domain_events (id, tenant_id, aggregate_id, aggregate_type, event_type, payload, occurred_at, sequence)
           VALUES ($1, $2, $3, 'Wp12TestAggregate', 'Fixture', '{}', now(), $4)`,
          [id, tenantId, randomUUID(), eventIds.indexOf(id) + 1],
        );
      }
      fixtureOutboxId = randomUUID();
      await client.query('INSERT INTO symphony.event_outbox (id, event_id, status) VALUES ($1, $2, \'pending\')', [fixtureOutboxId, eventIds[1]]);
      fixtureReceiptId = randomUUID();
      await client.query(
        `INSERT INTO symphony.command_receipts
          (tenant_id, command_id, actor_user_id, command_type, command_schema_version, canonicalization_version,
           digest_key_version, semantic_digest, result_classification, result_schema_version, safe_result)
         VALUES ($1, $2, $3, 'test.command', '1', 'jcs-rfc8785-v1', 'test-v1', $4, 'committed_success', 'command-result-v1', $5)`,
        [tenantId, fixtureReceiptId, randomUUID(), Buffer.alloc(32), {
          schema_version: 'command-result-v1', ok: true, aggregate_version: 1, event_ids: [], data: {},
        }],
      );
      fixtureAggregateId = randomUUID();
      await client.query(
        `INSERT INTO symphony.aggregate_states (id, tenant_id, aggregate_type, version, state)
         VALUES ($1, $2, 'Wp12TestAggregate', 1, $3)`,
        [fixtureAggregateId, tenantId, { id: fixtureAggregateId, tenantId, version: 1, label: 'existing' }],
      );
    } finally { client.release(); }
  });

  afterAll(async () => {
    if (commandOutboxIds.length > 0) await pool.query('DELETE FROM symphony.event_outbox WHERE id = ANY($1::uuid[])', [commandOutboxIds]);
    if (fixtureOutboxId) await pool.query('DELETE FROM symphony.event_outbox WHERE id = $1', [fixtureOutboxId]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config(\'app.tenant_id\', $1, true)', [tenantId]);
      await client.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability');
      const allEventIds = [...fixtureEventIds, ...commandEventIds];
      if (allEventIds.length > 0) await client.query('DELETE FROM symphony.domain_events WHERE id = ANY($1::uuid[])', [allEventIds]);
      await client.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability');
      await client.query('DELETE FROM symphony.command_receipts WHERE tenant_id = $1', [tenantId]);
      await client.query('ALTER TABLE symphony.security_attempts DISABLE TRIGGER security_attempts_append_only');
      await client.query('DELETE FROM symphony.security_attempts WHERE tenant_id = $1', [tenantId]);
      await client.query('ALTER TABLE symphony.security_attempts ENABLE TRIGGER security_attempts_append_only');
      await client.query('DELETE FROM symphony.aggregate_states WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.tenants WHERE id = $1', [tenantId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    await Promise.all([db.destroy(), recoveryDb.destroy(), pool.end()]);
  });

  it('runs the actual CommandBus persistence ports on one PostgreSQL transaction', async () => {
    const aggregateId = randomUUID();
    const commandId = randomUUID();
    const actorId = randomUUID();
    const eventId = randomUUID();
    const outboxId = randomUUID();
    commandEventIds.push(eventId);
    commandOutboxIds.push(outboxId);
    const bus = new CommandBus<TestAggregate>({
      repository,
      receiptStore,
      policyStore: { decide: async () => ({ allow: true }) },
      clock: { now: () => new Date().toISOString() },
      idGen: { generate: () => randomUUID() },
      transactionRunner: runner,
      securityAttemptWriter: { record: async () => undefined },
      digestKeyProvider: {
        activeVersion: () => 'integration-test-v1',
        hmac: async (version, bytes) => createHmac('sha256', version).update(bytes).digest(),
      },
      resultDataSchemas: { 'test.command': z.object({ value: z.string() }).strict() },
    });
    const envelope: CommandEnvelope<{ aggregateId: string; value: string }> = {
      commandId,
      tenantId,
      actorUserId: actorId,
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      deviceId: 'synthetic-test-device',
      expectedVersion: 0,
      correlationId: 'transport-only',
      type: 'test.command',
      schemaVersion: 1,
      payload: { aggregateId, value: 'persisted' },
    };
    const result = await bus.dispatch(envelope, (command) => ({
      newState: { id: aggregateId, tenantId, version: 1, label: command.payload.value },
      events: [{
        id: eventId, tenantId, aggregateId, aggregateType: 'Wp12TestAggregate',
        eventType: 'Created', payload: { label: command.payload.value },
        occurredAt: command.occurredAt, recordedAt: command.recordedAt, sequence: 1,
      }],
      outbox: [{ id: outboxId, eventId, status: 'pending', createdAt: new Date().toISOString() }],
      data: { value: command.payload.value },
    }), { trustedPrincipal: { actorUserId: actorId, tenantId } });
    expect(result.ok).toBe(true);
    const observer = await pool.connect();
    try {
      await observer.query('BEGIN');
      await observer.query('SELECT set_config(\'app.tenant_id\', $1, true)', [tenantId]);
      const persisted = await observer.query<{ receipts: string; states: string; events: string; outbox: string }>(
        `SELECT
          (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2) AS receipts,
          (SELECT count(*)::text FROM symphony.aggregate_states WHERE tenant_id = $1 AND id = $3) AS states,
          (SELECT count(*)::text FROM symphony.domain_events WHERE tenant_id = $1 AND id = $4) AS events,
          (SELECT count(*)::text FROM symphony.event_outbox WHERE id = $5 AND event_id = $4) AS outbox`,
        [tenantId, commandId, aggregateId, eventId, outboxId],
      );
      expect(persisted.rows[0]).toEqual({ receipts: '1', states: '1', events: '1', outbox: '1' });
      await observer.query('COMMIT');
    } finally { observer.release(); }
  });

  it('rolls receipt, state, event, and outbox writes back at each failing write boundary', async () => {
    const conflictEventId = fixtureEventIds[0] ?? randomUUID();
    const successfulEventId = randomUUID();
    const cases = [
      { name: 'receipt insert', commandId: fixtureReceiptId as string, aggregateId: randomUUID(), eventId: randomUUID(), outboxId: randomUUID() },
      { name: 'state write', commandId: randomUUID(), aggregateId: fixtureAggregateId as string, eventId: randomUUID(), outboxId: randomUUID() },
      { name: 'event insert', commandId: randomUUID(), aggregateId: randomUUID(), eventId: conflictEventId, outboxId: randomUUID() },
      { name: 'outbox insert', commandId: randomUUID(), aggregateId: randomUUID(), eventId: successfulEventId, outboxId: fixtureOutboxId as string },
      { name: 'commit boundary', commandId: randomUUID(), aggregateId: randomUUID(), eventId: randomUUID(), outboxId: randomUUID() },
    ];
    for (const scenario of cases) {
      const receipt: CommandReceipt = {
        tenant_id: tenantId,
        command_id: scenario.commandId,
        actor_user_id: randomUUID(),
        command_type: 'test.command',
        command_schema_version: '1',
        canonicalization_version: 'jcs-rfc8785-v1',
        digest_key_version: 'test-v1',
        semantic_digest: new Uint8Array(32),
        result_classification: 'committed_success',
        result_schema_version: 'command-result-v1',
        safe_result: { schema_version: 'command-result-v1', ok: true, aggregate_version: 1, event_ids: [], data: {} },
        recorded_at: new Date().toISOString(),
      };
      await expect(runner.run(tenantId, async (context) => {
        await receiptStore.save(receipt, context);
        await repository.save(
          { id: scenario.aggregateId, tenantId, version: 1, label: scenario.name },
          0,
          [{
            id: scenario.eventId, tenantId, aggregateId: scenario.aggregateId,
            aggregateType: 'Wp12TestAggregate', eventType: 'AtomicWrite', payload: {},
            occurredAt: new Date().toISOString(), recordedAt: new Date().toISOString(), sequence: 1,
          }],
          [{ id: scenario.outboxId, eventId: scenario.eventId, status: 'pending', createdAt: new Date().toISOString() }],
          context,
        );
        if (scenario.name === 'commit boundary') throw new Error('injected failure before commit');
      })).rejects.toThrow();

      const observer = await pool.connect();
      try {
        await observer.query('BEGIN');
        await observer.query('SELECT set_config(\'app.tenant_id\', $1, true)', [tenantId]);
        const [receiptRows, stateRows, eventRows, outboxRows] = await Promise.all([
          observer.query('SELECT 1 FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2 AND command_id <> $3', [tenantId, scenario.commandId, fixtureReceiptId]),
          observer.query('SELECT 1 FROM symphony.aggregate_states WHERE tenant_id = $1 AND id = $2 AND id <> $3', [tenantId, scenario.aggregateId, fixtureAggregateId]),
          observer.query('SELECT 1 FROM symphony.domain_events WHERE tenant_id = $1 AND id = $2 AND id <> $3', [tenantId, scenario.eventId, conflictEventId]),
          observer.query('SELECT 1 FROM symphony.event_outbox WHERE id = $1 AND id <> $2', [scenario.outboxId, fixtureOutboxId]),
        ]);
        expect([receiptRows.rowCount, stateRows.rowCount, eventRows.rowCount, outboxRows.rowCount], scenario.name).toEqual([0, 0, 0, 0]);
        await observer.query('COMMIT');
      } finally { observer.release(); }
    }
  });

  it('clears transaction-local tenant context after both commit and rollback', async () => {
    await runner.run(tenantId, async () => undefined);
    const afterCommit = await sql<{ tenant_id: string | null }>`SELECT current_setting('app.tenant_id', true) AS tenant_id`.execute(db);
    expect(['', null]).toContain(afterCommit.rows[0]?.['tenant_id'] ?? null);
    await expect(runner.run(tenantId, async () => { throw new Error('rollback probe'); })).rejects.toThrow('rollback probe');
    const afterRollback = await sql<{ tenant_id: string | null }>`SELECT current_setting('app.tenant_id', true) AS tenant_id`.execute(db);
    expect(['', null]).toContain(afterRollback.rows[0]?.['tenant_id'] ?? null);
  });

  it('commits a PostgreSQL denial audit only after rollback, and fails closed when audit insert fails', async () => {
    const profile = validateSecurityAttemptRuntimeProfile({ NODE_ENV: 'test', DATA_MODE: 'test', SYNTHETIC_ONLY: 'true' });
    const auditWriter = new PostgresSecurityAttemptWriter(db, profile);
    const makeBus = () => new CommandBus<TestAggregate>({
      repository, receiptStore,
      policyStore: { decide: async () => ({ allow: false, reason: 'NOT_AUTHORISED_FOR_ORGANISATION' }) },
      clock: { now: () => new Date().toISOString() }, idGen: { generate: () => randomUUID() },
      transactionRunner: runner, securityAttemptWriter: auditWriter,
      digestKeyProvider: { activeVersion: () => 'integration-test-v1', hmac: async (version, bytes) => createHmac('sha256', version).update(bytes).digest() },
      resultDataSchemas: { 'test.command': z.object({ value: z.string() }).strict() },
    });
    const runDenied = async (actorId: string) => {
      const commandId = randomUUID();
      const aggregateId = randomUUID();
      const envelope: CommandEnvelope<{ aggregateId: string; value: string }> = {
        commandId, tenantId, actorUserId: actorId,
        occurredAt: new Date().toISOString(), recordedAt: new Date().toISOString(),
        deviceId: 'synthetic-test-device', expectedVersion: 0, correlationId: 'test',
        type: 'test.command', schemaVersion: 1, payload: { aggregateId, value: 'denied' },
      };
      const result = await makeBus().dispatch(envelope, () => { throw new Error('denied handler must not run'); },
        { trustedPrincipal: { actorUserId: actorId, tenantId } });
      return { result, commandId, aggregateId, actorId };
    };
    const committed = await runDenied(randomUUID());
    expect(committed.result).toEqual({ ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' });

    const failingActorId = randomUUID();
    const triggerName = `wp12_audit_fail_${randomUUID().replaceAll('-', '')}`;
    const functionName = `${triggerName}_fn`;
    await pool.query(`CREATE FUNCTION symphony.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_user_id = '${failingActorId}'::uuid THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON symphony.security_attempts FOR EACH ROW EXECUTE FUNCTION symphony.${functionName}()`);
    let failed: Awaited<ReturnType<typeof runDenied>>;
    try { failed = await runDenied(failingActorId); }
    finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON symphony.security_attempts`);
      await pool.query(`DROP FUNCTION IF EXISTS symphony.${functionName}()`);
    }

    const observer = await pool.connect();
    try {
      await observer.query('BEGIN');
      await observer.query('SELECT set_config(\'app.tenant_id\', $1, true)', [tenantId]);
      const rows = await observer.query<{ command_id: string; actor_user_id: string; audit: string; receipt: string; state: string; event: string; outbox: string }>(
        `SELECT $1::uuid AS command_id, $2::uuid AS actor_user_id,
          (SELECT count(*)::text FROM symphony.security_attempts WHERE tenant_id=$3 AND actor_user_id=$2 AND observed_command_id=$1) AS audit,
          (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id=$3 AND command_id=$1) AS receipt,
          (SELECT count(*)::text FROM symphony.aggregate_states WHERE tenant_id=$3 AND id=$4) AS state,
          (SELECT count(*)::text FROM symphony.domain_events WHERE tenant_id=$3 AND aggregate_id=$4) AS event,
          (SELECT count(*)::text FROM symphony.event_outbox WHERE event_id IN (SELECT id FROM symphony.domain_events WHERE aggregate_id=$4)) AS outbox`,
        [committed.commandId, committed.actorId, tenantId, committed.aggregateId],
      );
      expect(rows.rows[0]).toMatchObject({ audit: '1', receipt: '0', state: '0', event: '0', outbox: '0' });
      const failedRows = await observer.query<{ audit: string; receipt: string; state: string; event: string; outbox: string }>(
        `SELECT (SELECT count(*)::text FROM symphony.security_attempts WHERE tenant_id=$1 AND actor_user_id=$2 AND observed_command_id=$3) AS audit,
          (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id=$1 AND command_id=$3) AS receipt,
          (SELECT count(*)::text FROM symphony.aggregate_states WHERE tenant_id=$1 AND id=$4) AS state,
          (SELECT count(*)::text FROM symphony.domain_events WHERE tenant_id=$1 AND aggregate_id=$4) AS event,
          (SELECT count(*)::text FROM symphony.event_outbox WHERE event_id IN (SELECT id FROM symphony.domain_events WHERE aggregate_id=$4)) AS outbox`,
        [tenantId, failingActorId, failed.commandId, failed.aggregateId],
      );
      expect(failed.result).toEqual({ ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' });
      expect(failedRows.rows[0]).toEqual({ audit: '0', receipt: '0', state: '0', event: '0', outbox: '0' });
      await observer.query('COMMIT');
    } finally { observer.release(); }
  });
});
