/**
 * @symphony/db — __tests__/event-store.test.ts
 *
 * Integration tests for event-store immutability invariants (INV-018).
 *
 * Tests verify:
 *   - appendedEvent_cannotBeUpdated  — UPDATE on a domain_events row is blocked by trigger
 *   - appendedEvent_cannotBeDeleted  — DELETE on a domain_events row is blocked by trigger
 *   - outboxRecord_deliveredAtSetOnce — delivered_at may be set once; a second SET is a no-op
 *                                       (enforced by application convention + DB NULL guard)
 *
 * The immutability trigger `domain_events_immutability` was created in migration 0001_kernel.sql.
 *
 * Environment:
 *   DATABASE_URL   postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony
 *   DATABASE_SCHEMA symphony
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { createDb } from '../db/client.js';
import type { SymphonyDatabase } from '../types/database.js';

// ─── Shared setup ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony';

let db: Kysely<SymphonyDatabase>;
let tenantId: string;

/** Insert a tenant row and seed an RLS context for the connection. */
async function insertTenant(id: string): Promise<void> {
  await sql`SELECT set_config('app.current_tenant_id', ${sql.lit(id)}, false)`.execute(db);
  await db.insertInto('symphony.tenants').values({ id, name: `test-tenant-${id}` }).execute();
}

/** Insert a single domain_events row and return its id. */
async function insertEvent(eventId: string, aggId: string, tid: string): Promise<string> {
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

beforeEach(async () => {
  db = createDb(DATABASE_URL, { max: 1 });
  tenantId = randomUUID();
  await insertTenant(tenantId);
});

afterEach(async () => {
  // Disable immutability trigger so cleanup can DELETE domain_events
  await sql`ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability`.execute(db);

  await db
    .deleteFrom('symphony.event_outbox')
    .where(
      'event_id',
      'in',
      db
        .selectFrom('symphony.domain_events')
        .select('id')
        .where('tenant_id', '=', tenantId),
    )
    .execute();

  await db.deleteFrom('symphony.domain_events').where('tenant_id', '=', tenantId).execute();

  await sql`ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability`.execute(db);

  await db.deleteFrom('symphony.aggregate_states').where('tenant_id', '=', tenantId).execute();
  await db.deleteFrom('symphony.tenants').where('id', '=', tenantId).execute();

  await db.destroy();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Event store immutability (INV-018)', () => {
  it('appendedEvent_cannotBeUpdated', async () => {
    /**
     * AUD-010: domain_events rows are append-only.
     * Any attempt to UPDATE an existing row must be rejected by the
     * `domain_events_immutability` trigger with an exception.
     */
    const aggId = randomUUID();
    const eventId = randomUUID();
    await insertEvent(eventId, aggId, tenantId);

    // Attempt to UPDATE — must throw
    await expect(
      sql`UPDATE symphony.domain_events SET event_type = 'Tampered' WHERE id = ${sql.lit(eventId)}`.execute(db),
    ).rejects.toThrow(/append-only/);
  });

  it('appendedEvent_cannotBeDeleted', async () => {
    /**
     * AUD-010: domain_events rows are append-only.
     * Any attempt to DELETE an existing row must be rejected by the
     * `domain_events_immutability` trigger with an exception.
     */
    const aggId = randomUUID();
    const eventId = randomUUID();
    await insertEvent(eventId, aggId, tenantId);

    // Attempt to DELETE — must throw
    await expect(
      sql`DELETE FROM symphony.domain_events WHERE id = ${sql.lit(eventId)}`.execute(db),
    ).rejects.toThrow(/append-only/);
  });

  it('outboxRecord_deliveredAtSetOnce', async () => {
    /**
     * AUD-016: Validation runs (and outbox records) are immutable once
     * delivered. Setting delivered_at a second time must leave the original
     * value unchanged (the outbox worker uses WHERE delivered_at IS NULL).
     */
    const aggId = randomUUID();
    const eventId = randomUUID();
    const outboxId = randomUUID();
    await insertEvent(eventId, aggId, tenantId);

    // Insert outbox record
    await db
      .insertInto('symphony.event_outbox')
      .values({ id: outboxId, event_id: eventId })
      .execute();

    const firstDelivery = new Date('2024-01-01T10:00:00Z');

    // First delivery mark — must succeed
    const updateCount1 = await db
      .updateTable('symphony.event_outbox')
      .set({ status: 'delivered', delivered_at: firstDelivery })
      .where('id', '=', outboxId)
      .where('delivered_at', 'is', null) // idempotency guard
      .executeTakeFirst();

    expect(Number(updateCount1.numUpdatedRows)).toBe(1);

    // Read back
    const row = await db
      .selectFrom('symphony.event_outbox')
      .selectAll()
      .where('id', '=', outboxId)
      .executeTakeFirstOrThrow();

    expect(row.status).toBe('delivered');
    expect(row.delivered_at).toEqual(firstDelivery);

    // Second delivery attempt — WHERE delivered_at IS NULL excludes the row → 0 rows updated
    const updateCount2 = await db
      .updateTable('symphony.event_outbox')
      .set({ status: 'delivered', delivered_at: new Date('2024-06-15T12:00:00Z') })
      .where('id', '=', outboxId)
      .where('delivered_at', 'is', null) // idempotency guard: row already delivered
      .executeTakeFirst();

    expect(Number(updateCount2.numUpdatedRows)).toBe(0);

    // Original delivered_at is unchanged
    const row2 = await db
      .selectFrom('symphony.event_outbox')
      .selectAll()
      .where('id', '=', outboxId)
      .executeTakeFirstOrThrow();

    expect(row2.delivered_at).toEqual(firstDelivery);
  });
});

