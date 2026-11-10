import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { z } from 'zod';
import { CommandBus } from '@symphony/domain';
import type { AggregateRoot, CommandEnvelope, CommandTransactionContext, CommandTransactionRunner } from '@symphony/domain';
import { PostgresCommandReceiptStore } from '../repositories/postgres-command-receipt-store.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import type { SymphonyDatabase } from '../types/database.js';

interface TestAggregate extends AggregateRoot { readonly value: string }
interface Payload { readonly aggregateId: string; readonly value: string }
const databaseUrl = process.env['MIGRATION_TEST_DATABASE_URL'];
const schemas = {
  'test.command': z.object({ value: z.string() }).strict(),
  'test.command.other': z.object({ value: z.string() }).strict(),
};

describe.skipIf(!databaseUrl)('WP1.3 PostgreSQL command concurrency and recovery', () => {
  const tenantId = randomUUID();
  // The current local migration policy still reads this legacy setting. Set it
  // only on isolated *_test connections; the command runner sets app.tenant_id
  // transaction-locally, as required by the active contract.
  const commandPool = new pg.Pool({
    connectionString: databaseUrl,
    max: 12,
    onConnect: async (client) => { await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenantId]); },
  });
  const recoveryPool = new pg.Pool({
    connectionString: databaseUrl,
    max: 4,
    onConnect: async (client) => { await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenantId]); },
  });
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 12 });
  const db = new Kysely<SymphonyDatabase>({ dialect: new PostgresDialect({ pool: commandPool }) });
  const recoveryDb = new Kysely<SymphonyDatabase>({ dialect: new PostgresDialect({ pool: recoveryPool }) });
  const repository = new PostgresRepository<TestAggregate>(db, 'Wp13TestAggregate');
  const receiptStore = new PostgresCommandReceiptStore(schemas);
  const actorId = randomUUID();

  beforeAll(async () => {
    const identity = await pool.query<{ database_name: string; server_version_num: string; database_role: string }>(
      "SELECT current_database() AS database_name, current_setting('server_version_num') AS server_version_num, current_user AS database_role",
    );
    expect(identity.rows[0]?.database_name.endsWith('_test')).toBe(true);
    expect(process.env['DATA_MODE']).toBe('test');
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    console.info(`WP1.3 test target: ${identity.rows[0]?.database_name}; PostgreSQL server_version_num=${identity.rows[0]?.server_version_num}; database_role=${identity.rows[0]?.database_role}; DATA_MODE=test`);
    await pool.query('INSERT INTO symphony.tenants (id, name) VALUES ($1, $2)', [tenantId, 'wp1.3-synthetic-fixture']);
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      await client.query('DELETE FROM symphony.event_outbox WHERE event_id IN (SELECT id FROM symphony.domain_events WHERE tenant_id = $1)', [tenantId]);
      await client.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability');
      await client.query('DELETE FROM symphony.domain_events WHERE tenant_id = $1', [tenantId]);
      await client.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability');
      await client.query('DELETE FROM symphony.command_receipts WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.aggregate_states WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.security_attempts WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM symphony.tenants WHERE id = $1', [tenantId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), pool.end()]);
  });

  const makeRunner = (options: Omit<ConstructorParameters<typeof PostgresCommandTransactionRunner>[1], 'recoveryDb'> = {}) =>
    new PostgresCommandTransactionRunner(db, { ...options, recoveryDb });

  const makeBus = (transactionRunner: CommandTransactionRunner = makeRunner()) => new CommandBus<TestAggregate>({
    repository,
    receiptStore,
    policyStore: { decide: async () => ({ allow: true }) },
    clock: { now: () => new Date().toISOString() },
    idGen: { generate: () => randomUUID() },
    transactionRunner,
    securityAttemptWriter: { record: async () => undefined },
    digestKeyProvider: {
      activeVersion: () => 'integration-test-v1',
      hmac: async (keyVersion, bytes) => createHmac('sha256', keyVersion).update(bytes).digest(),
    },
    resultDataSchemas: schemas,
  });

  const envelope = (aggregateId: string, commandId = randomUUID(), value = 'one', actor = actorId, type = 'test.command', expectedVersion = 0): CommandEnvelope<Payload> => ({
    commandId,
    tenantId,
    actorUserId: actor,
    occurredAt: new Date().toISOString(),
    recordedAt: new Date().toISOString(),
    deviceId: 'synthetic-test-device',
    expectedVersion,
    correlationId: randomUUID(),
    type,
    schemaVersion: 1,
    payload: { aggregateId, value },
  });

  const dispatch = (bus: CommandBus<TestAggregate>, command: CommandEnvelope<Payload>, handler?: (count: number, context: { aggregate: TestAggregate | null }) => Promise<void>) =>
    bus.dispatch(command, async (input, context) => {
      const invocation = 0;
      await handler?.(invocation, context);
      const aggregateId = command.payload.aggregateId;
      const nextVersion = (context.aggregate?.version ?? 0) + 1;
      const eventId = randomUUID();
      return {
        newState: { id: aggregateId, tenantId, version: nextVersion, value: input.payload.value },
        events: [{
          id: eventId, tenantId, aggregateId, aggregateType: 'Wp13TestAggregate', eventType: 'Changed',
          payload: { value: input.payload.value }, occurredAt: input.occurredAt,
          recordedAt: input.recordedAt, sequence: nextVersion,
        }],
        outbox: [{ id: randomUUID(), eventId, status: 'pending' as const, createdAt: new Date().toISOString() }],
        data: { value: input.payload.value },
      };
    }, { trustedPrincipal: { actorUserId: command.actorUserId, tenantId: command.tenantId } });

  const counts = async (commandId: string, aggregateId: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      const result = await client.query<{ receipts: string; states: string; events: string; outbox: string; version: number | null }>(
        `SELECT
          (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id = $1 AND command_id = $2) AS receipts,
          (SELECT count(*)::text FROM symphony.aggregate_states WHERE tenant_id = $1 AND id = $3) AS states,
          (SELECT count(*)::text FROM symphony.domain_events WHERE tenant_id = $1 AND aggregate_id = $3) AS events,
          (SELECT count(*)::text FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id = o.event_id WHERE e.tenant_id = $1 AND e.aggregate_id = $3) AS outbox,
          (SELECT version FROM symphony.aggregate_states WHERE tenant_id = $1 AND id = $3) AS version`,
        [tenantId, commandId, aggregateId],
      );
      await client.query('COMMIT');
      const row = result.rows[0];
      return row ? { ...row, version: row.version === null ? null : Number(row.version) } : undefined;
    } finally {
      client.release();
    }
  };

  it('serializes identical concurrent submissions and returns the one committed result', async () => {
    let handlerEntered!: () => void;
    const firstHandlerEntered = new Promise<void>((resolve) => { handlerEntered = resolve; });
    let releaseOwner!: () => void;
    const ownerRelease = new Promise<void>((resolve) => { releaseOwner = resolve; });
    let secondRunnerEntered!: () => void;
    const secondRun = new Promise<void>((resolve) => { secondRunnerEntered = resolve; });
    let starts = 0;
    let invocations = 0;
    const baseRunner = makeRunner();
    const concurrentRunner: CommandTransactionRunner = {
      run: async (tenant, work, recovery) => {
        starts += 1;
        if (starts === 2) secondRunnerEntered();
        return baseRunner.run(tenant, work, recovery);
      },
    };
    const bus = makeBus(concurrentRunner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId, randomUUID(), 'same');
    const first = dispatch(bus, command, async () => {
      if (++invocations === 1) { handlerEntered(); await ownerRelease; }
    });
    await firstHandlerEntered;
    const second = dispatch(bus, command);
    await secondRun;
    releaseOwner();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).toEqual(firstResult);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('allows the waiting identical command to execute once when the original owner rolls back', async () => {
    let entered!: () => void;
    const firstEntered = new Promise<void>((resolve) => { entered = resolve; });
    let secondStarted!: () => void;
    const secondRunnerStarted = new Promise<void>((resolve) => { secondStarted = resolve; });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let starts = 0;
    let invocations = 0;
    const runner = makeRunner();
    const notifiedRunner: CommandTransactionRunner = { run: async (tenant, work, recovery) => {
      if (++starts === 2) secondStarted();
      return runner.run(tenant, work, recovery);
    } };
    const bus = makeBus(notifiedRunner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId, randomUUID(), 'rollback-owner');
    const owner = dispatch(bus, command, async () => {
      if (++invocations === 1) { entered(); await gate; throw new Error('injected owner rollback'); }
    });
    await firstEntered;
    const contender = dispatch(bus, command);
    await secondRunnerStarted;
    release();
    await expect(owner).rejects.toThrow('injected owner rollback');
    expect((await contender).ok).toBe(true);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('rejects actor, type, and semantic-envelope reuse without adding side effects', async () => {
    const bus = makeBus();
    const aggregateId = randomUUID();
    const commandId = randomUUID();
    const original = envelope(aggregateId, commandId, 'original');
    expect((await dispatch(bus, original)).ok).toBe(true);
    for (const reused of [
      envelope(aggregateId, commandId, 'original', randomUUID()),
      envelope(aggregateId, commandId, 'original', actorId, 'test.command.other'),
      envelope(aggregateId, commandId, 'changed'),
    ]) {
      const result = await dispatch(bus, reused);
      expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_KEY_REUSED' });
      expect(JSON.stringify(result)).not.toContain('original');
    }
    expect(await counts(commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('resolves unique receipt-key contention without committing the losing aggregate effects', async () => {
    let ready!: () => void;
    const bothHandlersReady = new Promise<void>((resolve) => { ready = resolve; });
    let release!: () => void;
    const releaseHandlers = new Promise<void>((resolve) => { release = resolve; });
    let handlerCount = 0;
    const bus = makeBus();
    const commandId = randomUUID();
    const left = envelope(randomUUID(), commandId, 'left');
    const right = envelope(randomUUID(), commandId, 'right');
    const handlerBarrier = async () => {
      handlerCount += 1;
      if (handlerCount === 2) ready();
      await releaseHandlers;
    };
    const leftRequest = dispatch(bus, left, handlerBarrier);
    const rightRequest = dispatch(bus, right, handlerBarrier);
    await bothHandlersReady;
    release();
    const [leftResult, rightResult] = await Promise.all([leftRequest, rightRequest]);
    expect([leftResult, rightResult].filter((result) => result.ok)).toHaveLength(1);
    expect([leftResult, rightResult].filter((result) => !result.ok)).toMatchObject([{ ok: false, code: 'IDEMPOTENCY_KEY_REUSED' }]);
    const leftCounts = await counts(commandId, left.payload.aggregateId);
    const rightCounts = await counts(commandId, right.payload.aggregateId);
    expect(Number(leftCounts?.states) + Number(rightCounts?.states)).toBe(1);
    expect(Number(leftCounts?.events) + Number(rightCounts?.events)).toBe(1);
    expect(Number(leftCounts?.outbox) + Number(rightCounts?.outbox)).toBe(1);
  });

  it('prevents two different commands with the same expected version from overwriting one another', async () => {
    const bus = makeBus();
    const aggregateId = randomUUID();
    const create = envelope(aggregateId, randomUUID(), 'v1');
    expect((await dispatch(bus, create)).ok).toBe(true);
    const [left, right] = await Promise.all([
      dispatch(bus, envelope(aggregateId, randomUUID(), 'left', actorId, 'test.command', 1)),
      dispatch(bus, envelope(aggregateId, randomUUID(), 'right', actorId, 'test.command', 1)),
    ]);
    expect([left.ok, right.ok].filter(Boolean)).toHaveLength(1);
    expect([left, right].filter((result) => !result.ok)).toMatchObject([{ ok: false, code: 'STALE_VERSION' }]);
    const persisted = await counts(create.commandId, aggregateId);
    expect(persisted).toMatchObject({ states: '1', events: '2', outbox: '2', version: 2 });
    expect(Number(persisted?.receipts)).toBeGreaterThanOrEqual(1);
  });

  it('retries only serialization and deadlock failures within three total attempts', async () => {
    const delays: number[] = [];
    let faults = 0;
    const runner = makeRunner({
      wait: async (milliseconds) => { delays.push(milliseconds); },
      faults: { beforeCommit: async () => {
        if (faults++ < 2) throw Object.assign(new Error('injected serialization failure'), { code: faults === 1 ? '40001' : '40P01' });
      } },
    });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    const result = await dispatch(bus, command);
    expect(result.ok).toBe(true);
    expect(faults).toBe(3);
    expect(delays).toEqual([25, 50]);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('stops after three retryable transaction failures and returns a generic retryable result', async () => {
    let failures = 0;
    const delays: number[] = [];
    const runner = makeRunner({
      wait: async (milliseconds) => { delays.push(milliseconds); },
      faults: { beforeCommit: async () => {
        failures += 1;
        throw Object.assign(new Error('serialization failure'), { code: '40001' });
      } },
    });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    let invocations = 0;
    const result = await dispatch(bus, command, async () => { invocations += 1; });
    expect(result).toEqual({ ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' });
    expect(failures).toBe(3);
    expect(invocations).toBe(3);
    expect(delays).toEqual([25, 50]);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '0', states: '0', events: '0', outbox: '0', version: null });
  });

  it('does not retry non-serialization integrity failures', async () => {
    let failures = 0;
    const runner = makeRunner({ faults: { beforeCommit: async () => {
      failures += 1;
      throw Object.assign(new Error('check violation'), { code: '23514' });
    } } });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    let invocations = 0;
    await expect(dispatch(bus, command, async () => { invocations += 1; })).rejects.toMatchObject({ code: '23514' });
    expect(failures).toBe(1);
    expect(invocations).toBe(1);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '0', states: '0', events: '0', outbox: '0', version: null });
  });

  it('resolves a committed response loss on a fresh connection without rerunning the handler', async () => {
    let injected = false;
    const runner = makeRunner({ faults: { afterCommit: async () => {
      if (!injected) { injected = true; throw Object.assign(new Error('lost commit response'), { code: 'ECONNRESET' }); }
    } } });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    let invocations = 0;
    const result = await dispatch(bus, command, async () => { invocations += 1; });
    expect(result.ok).toBe(true);
    expect(invocations).toBe(1);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('re-enters once after a healthy fresh lookup proves an uncertain commit did not persist', async () => {
    let injected = false;
    const runner = makeRunner({ faults: { beforeCommit: async () => {
      if (!injected) { injected = true; throw Object.assign(new Error('connection lost before commit'), { code: 'ECONNRESET' }); }
    } } });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    let invocations = 0;
    const result = await dispatch(bus, command, async () => { invocations += 1; });
    expect(result.ok).toBe(true);
    expect(invocations).toBe(2);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('counts uncertain-commit re-entry within the three-attempt transaction limit', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const runner = makeRunner({
      wait: async (milliseconds) => { delays.push(milliseconds); },
      faults: { beforeCommit: async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('connection lost at commit boundary'), { code: 'ECONNRESET' });
        if (attempts === 2) throw Object.assign(new Error('serialization failure'), { code: '40001' });
      } },
    });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    let invocations = 0;
    const result = await dispatch(bus, command, async () => { invocations += 1; });
    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
    expect(invocations).toBe(3);
    expect(delays).toEqual([50]);
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });

  it('returns outcome-neutral retryable unavailable when the fresh receipt lookup fails', async () => {
    const runner = makeRunner({ faults: {
      afterCommit: async () => { throw Object.assign(new Error('lost commit response'), { code: 'ECONNRESET' }); },
      beforeUncertainLookup: async () => { throw Object.assign(new Error('lookup connection unavailable'), { code: 'ECONNREFUSED' }); },
    } });
    const bus = makeBus(runner);
    const aggregateId = randomUUID();
    const command = envelope(aggregateId);
    const result = await dispatch(bus, command);
    expect(result).toEqual({ ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' });
    expect(await counts(command.commandId, aggregateId)).toMatchObject({ receipts: '1', states: '1', events: '1', outbox: '1', version: 1 });
  });
});
