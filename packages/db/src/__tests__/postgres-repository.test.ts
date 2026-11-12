/**
 * @symphony/db — __tests__/postgres-repository.test.ts
 *
 * Integration tests for PostgresRepository using local PostgreSQL 18.
 *
 * Tests verify:
 *   - concurrentVersions_onlyOneCommits: two transactions with the same
 *     expectedVersion — only one succeeds, the other throws OptimisticConcurrencyError.
 *   - rollbackOnEventInsertFailure: if the event insert fails (we force a
 *     duplicate id), neither the state row nor the outbox row persist.
 *
 * Environment:
 *   DATABASE_URL   postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony
 *   DATABASE_SCHEMA symphony
 *
 * Setup: each test uses a unique tenantId (UUID) inserted into symphony.tenants
 * and cleaned up in afterEach via CASCADE-safe deletes.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Kysely } from 'kysely';
import { createDb } from '../db/client.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import {
  AggregateRoot,
  DomainEvent,
  OptimisticConcurrencyError,
  OutboxMessage,
} from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';

// ─── Test aggregate type ───────────────────────────────────────────────────────

interface TestAggregate extends AggregateRoot {
  readonly label: string;
}

function makeAggregate(id: string, tenantId: string, version: number, label = 'test'): TestAggregate {
  return { id, tenantId, version, label };
}

function makeEvent(aggregateId: string, tenantId: string, seq: number): DomainEvent {
  return {
    id: randomUUID(),
    tenantId,
    aggregateId,
    aggregateType: 'TestAggregate',
    eventType: 'TestEvent',
    payload: { seq },
    occurredAt: new Date().toISOString(),
    recordedAt: new Date().toISOString(),
    sequence: seq,
  };
}

function makeOutbox(eventId: string): OutboxMessage {
  return {
    id: randomUUID(),
    eventId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

// ─── Shared setup ─────────────────────────────────────────────────────────────

const APP_DATABASE_URL = process.env['PHASE1_TEST_APP_DATABASE_URL'];
const ADMIN_DATABASE_URL = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];
const admin = new pg.Pool({ connectionString: ADMIN_DATABASE_URL });

let db: Kysely<SymphonyDatabase>;
let recoveryDb: Kysely<SymphonyDatabase>;
let runner: PostgresCommandTransactionRunner;
let tenantId: string;

describe.skipIf(!APP_DATABASE_URL || !ADMIN_DATABASE_URL)('PostgresRepository', () => {
beforeEach(async () => {
  // Application statements run with transaction-local tenant context.
  db = createDb(APP_DATABASE_URL ?? '', { max: 1 });
  recoveryDb = createDb(APP_DATABASE_URL ?? '', { max: 1 });
  runner = new PostgresCommandTransactionRunner(db, { recoveryDb });
  tenantId = randomUUID();

  // Tenant fixtures are provisioned by the test administrator.
  await admin.query('INSERT INTO symphony.tenants (id, name) VALUES ($1,$2)', [tenantId, `test-tenant-${tenantId}`]);
});

afterAll(async () => {
  await admin.end();
});

afterEach(async () => {
  await admin.query('BEGIN');
  try {
    await admin.query('DELETE FROM symphony.event_outbox WHERE event_id IN (SELECT id FROM symphony.domain_events WHERE tenant_id=$1)', [tenantId]);
    await admin.query('DELETE FROM symphony.aggregate_states WHERE tenant_id=$1', [tenantId]);
    await admin.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability');
    await admin.query('DELETE FROM symphony.domain_events WHERE tenant_id=$1', [tenantId]);
    await admin.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability');
    await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]);
    await admin.query('COMMIT');
  } catch (error) {
    await admin.query('ROLLBACK');
    throw error;
  }

  await Promise.all([db.destroy(), recoveryDb.destroy()]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

  it('concurrentVersions_onlyOneCommits', async () => {
    /**
     * Two savers both believe the aggregate is new (expectedVersion = 0).
     * The first INSERT succeeds; the second hits the conflict guard and throws
     * OptimisticConcurrencyError.
     */
    const aggId = randomUUID();
    const repo = new PostgresRepository<TestAggregate>(db, 'TestAggregate');

    const agg1 = makeAggregate(aggId, tenantId, 1, 'writer-1');
    const agg2 = makeAggregate(aggId, tenantId, 1, 'writer-2');

    const ev1 = makeEvent(aggId, tenantId, 1);
    const ev2 = makeEvent(aggId, tenantId, 1);

    // Fire both saves concurrently
    const [result1, result2] = await Promise.allSettled([
      runner.run(tenantId, (context) => repo.save(agg1, 0, [ev1], [], context)),
      runner.run(tenantId, (context) => repo.save(agg2, 0, [ev2], [], context)),
    ]);

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const err = (failures[0] as PromiseRejectedResult).reason as unknown;
    expect(err).toBeInstanceOf(OptimisticConcurrencyError);

    // Verify only one state row exists
    const rows = await admin.query('SELECT id FROM symphony.aggregate_states WHERE id=$1 AND tenant_id=$2', [aggId, tenantId]);
    expect(rows.rowCount).toBe(1);

    // Verify only one event was written
    const events = await admin.query('SELECT id FROM symphony.domain_events WHERE aggregate_id=$1 AND tenant_id=$2', [aggId, tenantId]);
    expect(events.rowCount).toBe(1);
  });

  it('rollbackOnEventInsertFailure', async () => {
    /**
     * We pre-insert an event with a known UUID, then try to save an aggregate
     * that includes an event with the same UUID. The duplicate key violation
     * should roll back the entire transaction — no state row, no outbox row.
     */
    const aggId = randomUUID();
    const repo = new PostgresRepository<TestAggregate>(db, 'TestAggregate');

    const conflictingEventId = randomUUID();

    // Pre-insert the event directly so the duplicate will fail
    await admin.query(
      `INSERT INTO symphony.domain_events (id,tenant_id,aggregate_id,aggregate_type,event_type,payload,occurred_at,sequence)
       VALUES ($1,$2,$3,'TestAggregate','PreExisting','{}',now(),0)`,
      [conflictingEventId, tenantId, aggId],
    );

    // Now also need an aggregate_states row so we don't collide on that
    // (we're testing event failure, not state failure)
    // We'll use a different aggregate id for the state so the state insert can proceed,
    // then the event insert with the duplicate id will fail.
    // Actually, let's use the same aggregate but expectedVersion=0 on a fresh one,
    // and pass a duplicate event id.

    const freshAggId = randomUUID();
    const agg = makeAggregate(freshAggId, tenantId, 1, 'rollback-test');

    // Event with the already-used ID — will cause duplicate key error
    const duplicateEvent: DomainEvent = {
      id: conflictingEventId, // ← DUPLICATE — will trigger rollback
      tenantId,
      aggregateId: freshAggId,
      aggregateType: 'TestAggregate',
      eventType: 'ShouldFail',
      payload: {},
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      sequence: 1,
    };
    const outbox = makeOutbox(conflictingEventId);

    await expect(
      runner.run(tenantId, (context) => repo.save(agg, 0, [duplicateEvent], [outbox], context)),
    ).rejects.toThrow();

    // State row must NOT exist — the transaction rolled back
    const stateRows = await admin.query('SELECT id FROM symphony.aggregate_states WHERE id=$1 AND tenant_id=$2', [freshAggId, tenantId]);
    expect(stateRows.rowCount).toBe(0);

    // No outbox row for the conflicting event either
    const outboxRows = await admin.query('SELECT id FROM symphony.event_outbox WHERE event_id=$1', [conflictingEventId]);
    // Only the pre-existing event is there if any outbox was for it — but we
    // did not insert any outbox for the pre-existing event, so 0 rows
    expect(outboxRows.rowCount).toBe(0);
  });
});
