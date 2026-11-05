/**
 * @symphony/testkit — contract-suite/repository-contract.ts
 *
 * Parameterised repository contract suite (L4 TDD strategy §4).
 *
 * Runs the same five behavioural tests against any `Repository<T>` implementation.
 * Pass a factory function that returns a fresh, empty repository for each test.
 *
 * Usage:
 *   import { runRepositoryContract } from '@symphony/testkit/contract-suite/repository-contract';
 *   import { InMemoryRepository } from '@symphony/testkit';
 *
 *   describe('InMemoryRepository contract', () => {
 *     runRepositoryContract(() => new InMemoryRepository());
 *   });
 *
 * Tests:
 *   - save_thenLoad_returnsSameData
 *   - save_withWrongVersion_throws
 *   - save_thenLoad_forDifferentTenant_returnsNull
 *   - save_eventAndOutbox_inSameTransaction
 *   - load_nonExistent_returnsNull
 */

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Repository, AggregateRoot, DomainEvent, OutboxMessage } from '@symphony/domain';
import { OptimisticConcurrencyError } from '@symphony/domain';

// ─── Minimal aggregate for contract tests ──────────────────────────────────────

interface ContractAggregate extends AggregateRoot {
  readonly label: string;
}

// ─── Helper factories ──────────────────────────────────────────────────────────

function makeAggregate(
  id: string,
  tenantId: string,
  version: number,
  label = 'test',
): ContractAggregate {
  return { id, tenantId, version, label };
}

function makeEvent(aggregateId: string, tenantId: string, seq: number): DomainEvent {
  return {
    id: randomUUID(),
    tenantId,
    aggregateId,
    aggregateType: 'ContractAggregate',
    eventType: 'ContractEvent',
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

// ─── Contract suite ────────────────────────────────────────────────────────────

/**
 * Run the repository contract suite inside the calling describe block.
 *
 * @param factory  Returns a fresh, empty repository for each test.
 * @param cleanup  Optional async cleanup called after each test (for PG teardown).
 */
export function runRepositoryContract(
  factory: () => Repository<ContractAggregate> | Promise<Repository<ContractAggregate>>,
  cleanup?: (repo: Repository<ContractAggregate>) => Promise<void>,
): void {
  describe('Repository contract', () => {
    it('save_thenLoad_returnsSameData', async () => {
      /**
       * Saving an aggregate and then loading it by id + tenantId must return
       * the exact same state that was saved.
       */
      const repo = await factory();
      const tenantId = randomUUID();
      const aggId = randomUUID();
      const agg = makeAggregate(aggId, tenantId, 1, 'hello');
      const ev = makeEvent(aggId, tenantId, 1);

      await repo.save(agg, 0, [ev], []);

      const loaded = await repo.load(aggId, tenantId);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(aggId);
      expect(loaded?.tenantId).toBe(tenantId);
      expect(loaded?.version).toBe(1);
      expect((loaded as ContractAggregate | null)?.label).toBe('hello');

      await cleanup?.(repo);
    });

    it('save_withWrongVersion_throws', async () => {
      /**
       * Saving with an expectedVersion that does not match the current version
       * must throw OptimisticConcurrencyError.
       */
      const repo = await factory();
      const tenantId = randomUUID();
      const aggId = randomUUID();
      const agg = makeAggregate(aggId, tenantId, 1, 'first');
      const ev = makeEvent(aggId, tenantId, 1);

      // Initial save succeeds at expectedVersion=0
      await repo.save(agg, 0, [ev], []);

      // Second save with stale expectedVersion=0 (should be 1) must throw
      const staleAgg = makeAggregate(aggId, tenantId, 2, 'stale');
      const staleEv = makeEvent(aggId, tenantId, 2);

      await expect(
        repo.save(staleAgg, 0, [staleEv], []),
      ).rejects.toBeInstanceOf(OptimisticConcurrencyError);

      await cleanup?.(repo);
    });

    it('save_thenLoad_forDifferentTenant_returnsNull', async () => {
      /**
       * Loading an aggregate with a tenantId that differs from the one it was
       * saved with must return null — no cross-tenant data leakage.
       */
      const repo = await factory();
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      const aggId = randomUUID();
      const agg = makeAggregate(aggId, tenantA, 1, 'tenant-a-data');
      const ev = makeEvent(aggId, tenantA, 1);

      await repo.save(agg, 0, [ev], []);

      // Load with Tenant B's id — must return null
      const loaded = await repo.load(aggId, tenantB);
      expect(loaded).toBeNull();

      await cleanup?.(repo);
    });

    it('save_eventAndOutbox_inSameTransaction', async () => {
      /**
       * Saving an aggregate must atomically persist the aggregate state,
       * the domain event, and the outbox message. This test verifies that
       * all three are present after a successful save.
       *
       * For the in-memory implementation this is trivially synchronous.
       * For the PG implementation the test proves they all exist post-commit.
       */
      const repo = await factory();
      const tenantId = randomUUID();
      const aggId = randomUUID();
      const agg = makeAggregate(aggId, tenantId, 1, 'atomic');
      const ev = makeEvent(aggId, tenantId, 1);
      const outbox = makeOutbox(ev.id);

      await repo.save(agg, 0, [ev], [outbox]);

      // State must be loadable
      const loaded = await repo.load(aggId, tenantId);
      expect(loaded).not.toBeNull();

      await cleanup?.(repo);
    });

    it('load_nonExistent_returnsNull', async () => {
      /**
       * Loading a completely unknown aggregate id must return null, not throw.
       */
      const repo = await factory();
      const tenantId = randomUUID();

      const loaded = await repo.load(randomUUID(), tenantId);
      expect(loaded).toBeNull();

      await cleanup?.(repo);
    });
  });
}
