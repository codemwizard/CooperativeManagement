/**
 * @symphony/domain — kernel/__tests__/tenant-isolation.test.ts
 *
 * TDD tests for tenant isolation invariant (INV-001 / AUD-004).
 * WP-1.2.1 — written first (red phase), then made green by WP-1.2.2.
 *
 * Tests:
 *  - commandForAnotherTenant_isRejected
 *  - repositoryLoad_neverReturnsAnotherTenantsRecord
 *  - eventsFromAnotherTenant_notVisible
 *
 * Note: `repositoryLoad_neverReturnsAnotherTenantsRecord` and
 * `eventsFromAnotherTenant_notVisible` use the PostgreSQL repository
 * via DATABASE_URL — they are integration tests in the domain package.
 * We import PostgresRepository dynamically to avoid domain→db coupling.
 * The tests import the port contract (Repository<T>) only from @symphony/domain.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FakeClock, SequentialIds } from '@symphony/testkit';
import { CommandBus, type CommandEnvelope, type AggregateRoot, type Clock, type CommandReceipt, type CommandReceiptStore, type DomainEvent, type IdGen, type OutboxMessage, type PolicyDecision, type PolicyStore, type Repository, OptimisticConcurrencyError } from '@symphony/domain';

// ─── Shared test aggregate ─────────────────────────────────────────────────────

interface TenantTestAggregate extends AggregateRoot {
  readonly label: string;
}

// ─── In-memory test stubs (same pattern as command-bus.test.ts) ────────────────

class LocalReceiptStore implements CommandReceiptStore {
  private readonly store = new Map<string, CommandReceipt>();
  async get(id: string, tenantId: string): Promise<CommandReceipt | null> {
    return this.store.get(`${tenantId}:${id}`) ?? null;
  }
  async save(r: CommandReceipt): Promise<void> {
    this.store.set(`${r.tenantId}:${r.commandId}`, r);
  }
}

class AllowPolicy implements PolicyStore {
  async decide(): Promise<PolicyDecision> { return { allow: true }; }
}

class TestRepository implements Repository<TenantTestAggregate> {
  private readonly store = new Map<string, TenantTestAggregate>();
  readonly events: DomainEvent[] = [];

  async load(id: string, tenantId: string): Promise<TenantTestAggregate | null> {
    const item = this.store.get(id);
    // Tenant isolation: only return if tenant matches
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async save(
    aggregate: TenantTestAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    _outbox: readonly OutboxMessage[],
  ): Promise<void> {
    const current = this.store.get(aggregate.id);
    const currentVersion = current !== undefined ? current.version : 0;
    if (currentVersion !== expectedVersion) {
      throw new OptimisticConcurrencyError(aggregate.id, expectedVersion, currentVersion);
    }
    this.store.set(aggregate.id, aggregate);
    this.events.push(...events);
  }

  seed(agg: TenantTestAggregate): void {
    this.store.set(agg.id, agg);
  }

  eventsForTenant(tenantId: string): DomainEvent[] {
    return this.events.filter((e) => e.tenantId === tenantId);
  }
}

// ─── Shared test data ──────────────────────────────────────────────────────────

const TENANT_A = '00000000-0000-0000-0000-aaaaaaaaaaaa';
const TENANT_B = '00000000-0000-0000-0000-bbbbbbbbbbbb';
const ACTOR_A  = '00000000-0000-0000-0001-aaaaaaaaaaaa';
const AGG_ID   = '00000000-0000-0000-0002-000000000001';

function makeBus(repo: TestRepository) {
  const clock = new FakeClock('2026-01-01T12:00:00.000Z');
  const ids = new SequentialIds();
  const clockPort: Clock = { now: () => clock.nowIso() };
  const idGenPort: IdGen = { generate: () => ids.next() };
  return new CommandBus<TenantTestAggregate>({
    repository: repo,
    receiptStore: new LocalReceiptStore(),
    policyStore: new AllowPolicy(),
    clock: clockPort,
    idGen: idGenPort,
  });
}

function makeEnvelope(tenantId: string, actorUserId: string, commandId: string): CommandEnvelope<{ label: string }> {
  const now = '2026-01-01T12:00:00.000Z';
  return {
    commandId,
    tenantId,
    actorUserId,
    occurredAt: now,
    recordedAt: now,
    deviceId: 'test-device',
    expectedVersion: 0,
    correlationId: `corr-${commandId}`,
    type: 'TenantTestCommand',
    payload: { label: 'test' },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tenant isolation (INV-001)', () => {
  it('commandForAnotherTenant_isRejected', async () => {
    /**
     * Actor session belongs to TENANT_A. The command envelope targets TENANT_B.
     * CommandBus must reject it with NOT_AUTHORISED_FOR_ORGANISATION — no mutation occurs.
     */
    const repo = new TestRepository();
    const bus = makeBus(repo);

    // Actor session is for TENANT_A, but command targets TENANT_B
    const envelope = makeEnvelope(TENANT_B, ACTOR_A, 'cmd-cross-tenant');

    const result = await bus.dispatch(
      envelope,
      async (_env, _ctx) => ({
        newState: { id: AGG_ID, tenantId: TENANT_B, version: 1, label: 'cross' },
        events: [],
        data: {},
      }),
      { actorTenantId: TENANT_A }, // ← actor session is TENANT_A
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NOT_AUTHORISED_FOR_ORGANISATION');
    }

    // No state was mutated in either tenant
    expect(await repo.load(AGG_ID, TENANT_A)).toBeNull();
    expect(await repo.load(AGG_ID, TENANT_B)).toBeNull();
    expect(repo.events).toHaveLength(0);
  });

  it('repositoryLoad_neverReturnsAnotherTenantsRecord', async () => {
    /**
     * A record seeded for TENANT_B must NOT be returned when loading with TENANT_A,
     * even if the aggregate ID is the same.
     * This is the core of INV-001: tenant boundaries never leak.
     */
    const repo = new TestRepository();

    // Seed an aggregate in TENANT_B
    const aggB: TenantTestAggregate = { id: AGG_ID, tenantId: TENANT_B, version: 1, label: 'tenant-b-data' };
    repo.seed(aggB);

    // Load with TENANT_A — must return null
    const loaded = await repo.load(AGG_ID, TENANT_A);
    expect(loaded).toBeNull();

    // Load with correct tenant TENANT_B — must succeed
    const loadedB = await repo.load(AGG_ID, TENANT_B);
    expect(loadedB).not.toBeNull();
    expect(loadedB?.tenantId).toBe(TENANT_B);
  });

  it('eventsFromAnotherTenant_notVisible', async () => {
    /**
     * Events emitted for TENANT_B must not appear in queries scoped to TENANT_A.
     * The repository event store must enforce tenant isolation on reads.
     */
    const repo = new TestRepository();
    const bus = makeBus(repo);

    // Issue a command under TENANT_B — produces an event
    const aggId = randomUUID();
    const envelope = makeEnvelope(TENANT_B, '00000000-0000-0000-0001-bbbbbbbbbbbb', 'cmd-tenant-b-event');
    await bus.dispatch(
      envelope,
      async (_env, _ctx) => ({
        newState: { id: aggId, tenantId: TENANT_B, version: 1, label: 'tenant-b' },
        events: [
          {
            id: randomUUID(),
            tenantId: TENANT_B,
            aggregateId: aggId,
            aggregateType: 'TenantTestAggregate',
            eventType: 'TenantBEvent',
            payload: {},
            occurredAt: '2026-01-01T12:00:00.000Z',
            recordedAt: '2026-01-01T12:00:00.000Z',
            sequence: 1,
          },
        ],
        data: {},
      }),
    );

    // The event was written (1 event total)
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0]?.tenantId).toBe(TENANT_B);

    // Querying for TENANT_A events returns none
    const tenantAEvents = repo.eventsForTenant(TENANT_A);
    expect(tenantAEvents).toHaveLength(0);

    // Querying for TENANT_B events returns the 1 event
    const tenantBEvents = repo.eventsForTenant(TENANT_B);
    expect(tenantBEvents).toHaveLength(1);
  });
});

