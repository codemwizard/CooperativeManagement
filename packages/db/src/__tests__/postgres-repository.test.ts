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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { createDb } from '../db/client.js';
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

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony';

let db: Kysely<SymphonyDatabase>;
let tenantId: string;

beforeEach(async () => {
  db = createDb(DATABASE_URL);
  tenantId = randomUUID();

  // Insert a fresh tenant for this test
  await db
    .insertInto('symphony.tenants')
    .values({ id: tenantId, name: `test-tenant-${tenantId}` })
    .execute();
});

afterEach(async () => {
  // Clean up test data using raw pg to disable the immutability trigger.
  // The trigger exists to prevent production mutations; test teardown bypasses it.
  await sql`
    ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability
  `.execute(db);

  await db.deleteFrom('symphony.event_outbox')
    .where('event_id', 'in',
      db.selectFrom('symphony.domain_events')
        .select('id')
        .where('tenant_id', '=', tenantId)
    )
    .execute();

  await db.deleteFrom('symphony.domain_events')
    .where('tenant_id', '=', tenantId)
    .execute();

  await sql`
    ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability
  `.execute(db);

  await db.deleteFrom('symphony.aggregate_states')
    .where('tenant_id', '=', tenantId)
    .execute();

  await db.deleteFrom('symphony.tenants')
    .where('id', '=', tenantId)
    .execute();

  await db.destroy();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PostgresRepository', () => {
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
      repo.save(agg1, 0, [ev1], []),
      repo.save(agg2, 0, [ev2], []),
    ]);

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const err = (failures[0] as PromiseRejectedResult).reason as unknown;
    expect(err).toBeInstanceOf(OptimisticConcurrencyError);

    // Verify only one state row exists
    const rows = await db
      .selectFrom('symphony.aggregate_states')
      .selectAll()
      .where('id', '=', aggId)
      .where('tenant_id', '=', tenantId)
      .execute();
    expect(rows).toHaveLength(1);

    // Verify only one event was written
    const events = await db
      .selectFrom('symphony.domain_events')
      .selectAll()
      .where('aggregate_id', '=', aggId)
      .where('tenant_id', '=', tenantId)
      .execute();
    expect(events).toHaveLength(1);
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
    await db
      .insertInto('symphony.domain_events')
      .values({
        id: conflictingEventId,
        tenant_id: tenantId,
        aggregate_id: aggId,
        aggregate_type: 'TestAggregate',
        event_type: 'PreExisting',
        payload: JSON.stringify({}) as unknown,
        occurred_at: new Date(),
        sequence: 0,
      })
      .execute();

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
      repo.save(agg, 0, [duplicateEvent], [outbox]),
    ).rejects.toThrow();

    // State row must NOT exist — the transaction rolled back
    const stateRows = await db
      .selectFrom('symphony.aggregate_states')
      .selectAll()
      .where('id', '=', freshAggId)
      .where('tenant_id', '=', tenantId)
      .execute();
    expect(stateRows).toHaveLength(0);

    // No outbox row for the conflicting event either
    const outboxRows = await db
      .selectFrom('symphony.event_outbox')
      .selectAll()
      .where('event_id', '=', conflictingEventId)
      .execute();
    // Only the pre-existing event is there if any outbox was for it — but we
    // did not insert any outbox for the pre-existing event, so 0 rows
    expect(outboxRows).toHaveLength(0);
  });
});
