/**
 * @symphony/api — __tests__/outbox-worker.test.ts
 *
 * Integration tests for OutboxWorker (INV-018, AUD-016).
 *
 * Tests verify:
 *   - undeliveredRecord_isPolled   — a pending outbox record is returned by poll()
 *                                    and marked as delivered
 *   - deliveredRecord_isNotReturned — a record already marked delivered is excluded
 *                                     from subsequent poll() calls
 *
 * Environment:
 *   DATABASE_URL   postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony
 *   DATABASE_SCHEMA symphony
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { createDb, type SymphonyDatabase } from '@symphony/db';
import { OutboxWorker } from '../outbox-worker.js';

// ─── Shared setup ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony';

let db: Kysely<SymphonyDatabase>;
let tenantId: string;

/** Insert a tenant and seed the RLS context. */
async function seedTenant(id: string): Promise<void> {
  await sql`SELECT set_config('app.current_tenant_id', ${sql.lit(id)}, false)`.execute(db);
  await db.insertInto('symphony.tenants').values({ id, name: `test-tenant-${id}` }).execute();
}

/** Insert a domain_events row and return its id. */
async function seedEvent(tid: string): Promise<string> {
  const eventId = randomUUID();
  const aggId = randomUUID();
  await db
    .insertInto('symphony.domain_events')
    .values({
      id: eventId,
      tenant_id: tid,
      aggregate_id: aggId,
      aggregate_type: 'TestAggregate',
      event_type: 'TestCreated',
      payload: JSON.stringify({}) as unknown,
      occurred_at: new Date(),
      sequence: 1,
    })
    .execute();
  return eventId;
}

/** Insert an event_outbox row linked to eventId. */
async function seedOutbox(eventId: string): Promise<string> {
  const outboxId = randomUUID();
  await db.insertInto('symphony.event_outbox').values({ id: outboxId, event_id: eventId }).execute();
  return outboxId;
}

beforeEach(async () => {
  db = createDb(DATABASE_URL, { max: 1 });
  tenantId = randomUUID();
  await seedTenant(tenantId);
});

afterEach(async () => {
  // Disable immutability trigger to allow DELETE during cleanup
  await sql`ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability`.execute(db);

  await db
    .deleteFrom('symphony.event_outbox')
    .where(
      'event_id',
      'in',
      db.selectFrom('symphony.domain_events').select('id').where('tenant_id', '=', tenantId),
    )
    .execute();

  await db.deleteFrom('symphony.domain_events').where('tenant_id', '=', tenantId).execute();

  await sql`ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability`.execute(db);

  await db.deleteFrom('symphony.aggregate_states').where('tenant_id', '=', tenantId).execute();
  await db.deleteFrom('symphony.tenants').where('id', '=', tenantId).execute();

  await db.destroy();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OutboxWorker', () => {
  it('undeliveredRecord_isPolled', async () => {
    /**
     * A pending outbox record (status='pending', delivered_at IS NULL) must
     * appear in the result of poll() and be atomically marked as delivered.
     */
    const eventId = await seedEvent(tenantId);
    const outboxId = await seedOutbox(eventId);

    const worker = new OutboxWorker(db);
    const result = await worker.poll();

    // The record was returned
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(outboxId);
    expect(result[0]?.eventId).toBe(eventId);
    expect(result[0]?.status).toBe('delivered');
    expect(result[0]?.deliveredAt).toBeInstanceOf(Date);

    // The DB row is now marked delivered
    const row = await db
      .selectFrom('symphony.event_outbox')
      .selectAll()
      .where('id', '=', outboxId)
      .executeTakeFirstOrThrow();

    expect(row.status).toBe('delivered');
    expect(row.delivered_at).not.toBeNull();
  });

  it('deliveredRecord_isNotReturned', async () => {
    /**
     * A record already marked delivered must NOT be returned by a subsequent
     * poll() call — the idempotency guard (WHERE delivered_at IS NULL) excludes it.
     */
    const eventId = await seedEvent(tenantId);
    const outboxId = await seedOutbox(eventId);

    // Mark as delivered manually (simulates a prior poll cycle)
    await db
      .updateTable('symphony.event_outbox')
      .set({ status: 'delivered', delivered_at: new Date() })
      .where('id', '=', outboxId)
      .where('delivered_at', 'is', null)
      .execute();

    const worker = new OutboxWorker(db);
    const result = await worker.poll();

    // No pending records remain — result is empty
    expect(result).toHaveLength(0);
  });
});
