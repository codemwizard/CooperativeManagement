/**
 * @symphony/testkit — repositories/in-memory-repository.ts
 *
 * Generic in-memory repository implementing domain Repository<T>.
 * Tracks state, domain events, and outbox messages.
 * Enforces optimistic concurrency (INV-019).
 */

import {
  AggregateRoot,
  DomainEvent,
  OptimisticConcurrencyError,
  OutboxMessage,
  Repository,
} from '@symphony/domain';

export class InMemoryRepository<TAggregate extends AggregateRoot>
  implements Repository<TAggregate>
{
  private readonly store = new Map<string, TAggregate>();
  private readonly domainEvents: DomainEvent[] = [];
  private readonly outboxMessages: OutboxMessage[] = [];

  async load(id: string, tenantId: string): Promise<TAggregate | null> {
    const item = this.store.get(id);
    if (!item) return null;
    if (item.tenantId !== tenantId) return null;
    return item;
  }

  async save(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[]
  ): Promise<void> {
    const current = this.store.get(aggregate.id);
    const currentVersion = current !== undefined ? current.version : 0;

    if (currentVersion !== expectedVersion) {
      throw new OptimisticConcurrencyError(
        aggregate.id,
        expectedVersion,
        currentVersion
      );
    }

    this.store.set(aggregate.id, aggregate);
    this.domainEvents.push(...events);
    this.outboxMessages.push(...outboxMessages);
  }

  /** Inspection helper for test assertions */
  getEvents(aggregateId?: string): readonly DomainEvent[] {
    if (aggregateId !== undefined) {
      return this.domainEvents.filter((e) => e.aggregateId === aggregateId);
    }
    return this.domainEvents;
  }

  /** Inspection helper for test assertions */
  getOutbox(): readonly OutboxMessage[] {
    return this.outboxMessages;
  }

  /** Direct store manipulation for test fixtures */
  seed(aggregate: TAggregate): void {
    this.store.set(aggregate.id, aggregate);
  }

  /** Clear all state for test isolation */
  clear(): void {
    this.store.clear();
    this.domainEvents.length = 0;
    this.outboxMessages.length = 0;
  }
}
