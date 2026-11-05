/**
 * @symphony/db — repositories/postgres-repository.ts
 *
 * PostgreSQL implementation of the domain Repository<T> port.
 *
 * Persistence contract (INV-019 / AUD-001):
 *   save() wraps the aggregate state upsert, domain event insert, and
 *   event_outbox insert in a single Kysely transaction. If any step fails,
 *   the whole transaction rolls back — no partial state can persist.
 *
 * Optimistic concurrency (INV-019):
 *   The state upsert uses a conditional WHERE version = expectedVersion clause.
 *   If no row is updated/inserted the repository throws OptimisticConcurrencyError.
 *
 * Tenant isolation (AUD-004 / AUD-005):
 *   Every load() includes WHERE tenant_id = tenantId.
 *   The save() inserts tenant_id on the state row, event rows, and outbox rows.
 *   Additionally, SET LOCAL app.current_tenant_id = $tenantId is issued at the
 *   start of every transaction to satisfy the defence-in-depth RLS policy on
 *   domain_events and command_receipts (migration 0008).
 */

import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import {
  AggregateRoot,
  DomainEvent,
  OptimisticConcurrencyError,
  OutboxMessage,
  Repository,
} from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';

export class PostgresRepository<TAggregate extends AggregateRoot>
  implements Repository<TAggregate>
{
  constructor(
    private readonly db: Kysely<SymphonyDatabase>,
    private readonly aggregateType: string,
  ) {}

  // ─── load ──────────────────────────────────────────────────────────────────

  async load(id: string, tenantId: string): Promise<TAggregate | null> {
    // Set RLS context — load may be called outside a transaction
    await sql`SELECT set_config('app.current_tenant_id', ${sql.lit(tenantId)}, false)`.execute(this.db);

    const row = await this.db
      .selectFrom('symphony.aggregate_states')
      .selectAll()
      .where('id', '=', id)
      .where('tenant_id', '=', tenantId)
      .executeTakeFirst();

    if (row === undefined) return null;
    return row.state as TAggregate;
  }

  // ─── save ──────────────────────────────────────────────────────────────────

  async save(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[],
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      // Set RLS tenant context for the duration of this transaction (LOCAL = tx-scoped)
      await sql`SET LOCAL app.current_tenant_id = ${sql.lit(aggregate.tenantId)}`.execute(trx);

      await this.upsertAggregateState(trx, aggregate, expectedVersion);

      if (events.length > 0) {
        await this.insertEvents(trx, events);
      }

      if (outboxMessages.length > 0) {
        await this.insertOutboxMessages(trx, outboxMessages, events);
      }
    });
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private async upsertAggregateState(
    trx: Transaction<SymphonyDatabase>,
    aggregate: TAggregate,
    expectedVersion: number,
  ): Promise<void> {
    // For a new aggregate (expectedVersion === 0) we INSERT.
    // For an existing aggregate we UPDATE only if version = expectedVersion.

    if (expectedVersion === 0) {
      // New aggregate — INSERT; fail if already exists (another writer beat us)
      const result = await trx
        .insertInto('symphony.aggregate_states')
        .values({
          id: aggregate.id,
          tenant_id: aggregate.tenantId,
          aggregate_type: this.aggregateType,
          version: aggregate.version,
          state: JSON.stringify(aggregate) as unknown,
          updated_at: sql<Date>`now()`,
        })
        .onConflict((oc) => oc.doNothing())
        .executeTakeFirst();

      if (result.numInsertedOrUpdatedRows === 0n) {
        // Conflict — read actual version for the error message
        const existing = await trx
          .selectFrom('symphony.aggregate_states')
          .select('version')
          .where('id', '=', aggregate.id)
          .executeTakeFirst();

        throw new OptimisticConcurrencyError(
          aggregate.id,
          expectedVersion,
          existing !== undefined ? Number(existing.version) : -1,
        );
      }
    } else {
      // Existing aggregate — UPDATE only if current version matches
      const result = await trx
        .updateTable('symphony.aggregate_states')
        .set({
          version: aggregate.version,
          state: JSON.stringify(aggregate) as unknown,
          aggregate_type: this.aggregateType,
          updated_at: sql<Date>`now()`,
        })
        .where('id', '=', aggregate.id)
        .where('tenant_id', '=', aggregate.tenantId)
        .where('version', '=', expectedVersion)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0n) {
        const existing = await trx
          .selectFrom('symphony.aggregate_states')
          .select('version')
          .where('id', '=', aggregate.id)
          .executeTakeFirst();

        throw new OptimisticConcurrencyError(
          aggregate.id,
          expectedVersion,
          existing !== undefined ? Number(existing.version) : -1,
        );
      }
    }
  }

  private async insertEvents(
    trx: Transaction<SymphonyDatabase>,
    events: readonly DomainEvent[],
  ): Promise<void> {
    await trx
      .insertInto('symphony.domain_events')
      .values(
        events.map((e) => ({
          id: e.id,
          tenant_id: e.tenantId,
          aggregate_id: e.aggregateId,
          aggregate_type: e.aggregateType,
          event_type: e.eventType,
          payload: JSON.stringify(e.payload) as unknown,
          occurred_at: new Date(e.occurredAt),
          sequence: e.sequence,
        })),
      )
      .execute();
  }

  private async insertOutboxMessages(
    trx: Transaction<SymphonyDatabase>,
    messages: readonly OutboxMessage[],
    events: readonly DomainEvent[],
  ): Promise<void> {
    // Build a lookup from event id to event
    const eventById = new Map(events.map((e) => [e.id, e]));

    await trx
      .insertInto('symphony.event_outbox')
      .values(
        messages.map((m) => {
          // Verify the referenced event exists in this batch
          if (!eventById.has(m.eventId)) {
            throw new Error(
              `OutboxMessage ${m.id} references unknown eventId ${m.eventId}`,
            );
          }
          return {
            id: m.id,
            event_id: m.eventId,
            status: m.status,
          };
        }),
      )
      .execute();
  }
}

