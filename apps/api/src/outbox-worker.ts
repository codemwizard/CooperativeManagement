/**
 * @symphony/api — outbox-worker.ts
 *
 * Transactional outbox worker stub (INV-018, AUD-016).
 *
 * Polls `event_outbox` for undelivered (pending) records and atomically
 * marks them as delivered using an idempotent WHERE delivered_at IS NULL guard.
 *
 * In Phase 1 this worker is NOT started automatically — it has no consumers
 * and no scheduler. Only the polling query and the atomic mark are implemented
 * so they can be tested and wired into the Fastify lifecycle in a later phase.
 *
 * Usage (future):
 *   const worker = new OutboxWorker(db);
 *   const delivered = await worker.poll();
 */

import type { Kysely } from 'kysely';
import type { SymphonyDatabase } from '@symphony/db';

export interface OutboxRecord {
  readonly id: string;
  readonly eventId: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly deliveredAt: Date | null;
}

export class OutboxWorker {
  constructor(private readonly db: Kysely<SymphonyDatabase>) {}

  /**
   * Poll for all pending outbox records (delivered_at IS NULL).
   * For each record found, atomically mark it as delivered using
   * the WHERE delivered_at IS NULL idempotency guard.
   *
   * Returns the list of records that were successfully marked.
   */
  async poll(): Promise<OutboxRecord[]> {
    // Fetch all pending records
    const pending = await this.db
      .selectFrom('symphony.event_outbox')
      .selectAll()
      .where('status', '=', 'pending')
      .where('delivered_at', 'is', null)
      .execute();

    const delivered: OutboxRecord[] = [];

    for (const row of pending) {
      const now = new Date();

      // Atomic mark — WHERE delivered_at IS NULL prevents double-delivery
      const result = await this.db
        .updateTable('symphony.event_outbox')
        .set({ status: 'delivered', delivered_at: now })
        .where('id', '=', row.id)
        .where('delivered_at', 'is', null)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 1) {
        delivered.push({
          id: row.id,
          eventId: row.event_id,
          status: 'delivered',
          createdAt: row.created_at,
          deliveredAt: now,
        });
      }
    }

    return delivered;
  }
}

