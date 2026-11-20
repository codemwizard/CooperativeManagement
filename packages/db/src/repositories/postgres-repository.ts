/**
 * @symphony/db — repositories/postgres-repository.ts
 *
 * PostgreSQL implementation of the domain Repository<T> port.
 *
 * Persistence contract (INV-019 / AUD-001):
 *   Command-path reads/writes require the transaction context created by
 *   PostgresCommandTransactionRunner. save() uses that same Kysely transaction
 *   for state, domain events, and outbox rows; it never opens a nested tx.
 *
 * Optimistic concurrency (INV-019):
 *   The state upsert uses a conditional WHERE version = expectedVersion clause.
 *   If no row is updated/inserted the repository throws OptimisticConcurrencyError.
 *
 * Tenant isolation (AUD-004 / AUD-005):
 *   Every load() includes WHERE tenant_id = tenantId. The transaction runner
 *   sets transaction-local app.tenant_id from authenticated server context.
 */

import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import {
  AggregateRoot,
  DomainEvent,
  OptimisticConcurrencyError,
  OutboxMessage,
  Repository,
  CommandTransactionContext,
} from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';

export class PostgresRepository<TAggregate extends AggregateRoot>
  implements Repository<TAggregate>
{
  constructor(
    _db: Kysely<SymphonyDatabase>,
    private readonly aggregateType: string,
  ) {}

  // ─── load ──────────────────────────────────────────────────────────────────

  async load(id: string, tenantId: string, context?: CommandTransactionContext): Promise<TAggregate | null> {
    if (context === undefined) throw new Error('PostgresRepository command reads require a transaction context');
    const trx = transactionFor(context);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('symphony.aggregate:' || ${tenantId} || ':' || ${id}, 0))`.execute(trx);
    const builder = trx
      .selectFrom('symphony.aggregate_states')
      .selectAll()
      .where('id', '=', id)
      .where('tenant_id', '=', tenantId);
    const row = await builder.forUpdate().executeTakeFirst();

    if (row === undefined) return null;
    return row.state as TAggregate;
  }

  // ─── save ──────────────────────────────────────────────────────────────────

  async save(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[],
    context?: CommandTransactionContext,
  ): Promise<void> {
    if (context === undefined) throw new Error('PostgresRepository command writes require a transaction context');
    await this.saveInTransaction(aggregate, expectedVersion, events, outboxMessages, context);
  }

  private async saveInTransaction(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[],
    context: CommandTransactionContext,
  ): Promise<void> {
    const trx = transactionFor(context);
    await this.upsertAggregateState(trx, aggregate, expectedVersion);
    if (events.length > 0) await this.insertEvents(trx, events);
    if (outboxMessages.length > 0) await this.insertOutboxMessages(trx, outboxMessages, events);
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

    for (const message of messages) {
      if (!eventById.has(message.eventId)) {
        throw new Error(
          `OutboxMessage ${message.id} references unknown eventId ${message.eventId}`,
        );
      }
      if (message.status !== 'pending') {
        throw new Error(`OutboxMessage ${message.id} must be pending when enqueued`);
      }
      await sql`SELECT symphony.enqueue_command_outbox_message(${message.id}::uuid, ${message.eventId}::uuid)`
        .execute(trx);
    }
  }
}

export interface PostgresCommandTransactionContext extends CommandTransactionContext {
  readonly kyselyTransaction: Transaction<SymphonyDatabase>;
}

function transactionFor(context: CommandTransactionContext): Transaction<SymphonyDatabase> {
  if (!('kyselyTransaction' in context)) {
    throw new TypeError('PostgresRepository requires a PostgreSQL command transaction context');
  }
  return (context as PostgresCommandTransactionContext).kyselyTransaction;
}

