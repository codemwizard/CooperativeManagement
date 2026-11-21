/**
 * @symphony/domain — kernel/__tests__/command-bus.test.ts
 *
 * TDD tests for CommandBus:
 * - repeatedCommandId_doesNotApplyTwice
 * - staleExpectedVersion_isRejected
 * - dbFailure_rollsBackAll
 * - concurrentCommands_onlyOneWins
 * - crossTenantCommand_isRejected
 * - unauthorisedCommand_mutatesNothing
 *
 * WP-1.1.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { terminalConflictResultSchema } from '@symphony/contracts';
import { FakeClock } from '@symphony/testkit';
import { SequentialIds } from '@symphony/testkit';
import { CommandEnvelope } from '../command-envelope.js';
import { CommandBus } from '../command-bus.js';
import { LocalDevKeyProvider } from '../../privacy/key-provider.js';
import type { CommandTransactionContext } from '../ports.js';
import {
  AggregateRoot,
  Clock,
  CommandReceipt,
  CommandReceiptStore,
  DomainEvent,
  IdGen,
  OptimisticConcurrencyError,
  OutboxMessage,
  PolicyDecision,
  PolicyStore,
  Repository,
  EncryptedReconciliationInboxItem,
  ReconciliationInboxStore,
} from '../ports.js';

interface TestAggregate extends AggregateRoot {
  readonly value: string;
}

class InMemoryReceiptStore implements CommandReceiptStore {
  readonly receipts = new Map<string, CommandReceipt>();

  async get(commandId: string, tenantId: string): Promise<CommandReceipt | null> {
    const key = `${tenantId}:${commandId}`;
    return this.receipts.get(key) ?? null;
  }

  async save(receipt: CommandReceipt): Promise<boolean> {
    const key = `${receipt.tenant_id}:${receipt.command_id}`;
    if (this.receipts.has(key)) return false;
    this.receipts.set(key, receipt);
    return true;
  }
}

class InMemoryReconciliationInboxStore implements ReconciliationInboxStore {
  readonly items = new Map<string, EncryptedReconciliationInboxItem>();
  async save(item: EncryptedReconciliationInboxItem): Promise<void> { this.items.set(item.reconciliation_id, item); }
  async get(id: string, tenantId: string): Promise<EncryptedReconciliationInboxItem | null> {
    const item = this.items.get(id);
    return item?.tenant_id === tenantId ? item : null;
  }
  async transition(id: string, tenantId: string, next: 'resolved' | 'superseded', updatedAt: string): Promise<boolean> {
    const item = await this.get(id, tenantId);
    if (!item || item.lifecycle !== 'open') return false;
    this.items.set(id, { ...item, lifecycle: next, updated_at: updatedAt });
    return true;
  }
  async expire(id: string, tenantId: string, now: string): Promise<boolean> {
    const item = await this.get(id, tenantId);
    if (!item || item.lifecycle === 'expired' || item.expires_at > now) return false;
    this.items.set(id, { ...item, payload_ciphertext: new Uint8Array(), encryption_key_ref: '', lifecycle: 'expired', updated_at: now, tombstoned_at: now });
    return true;
  }
}

class InMemoryPolicyStore implements PolicyStore {
  policy: PolicyDecision = { allow: true };

  async decide(
    _action: string,
    _target: { readonly id: string; readonly type: string; readonly tenantId: string },
    _actor: { readonly userId: string; readonly tenantId: string }
  ): Promise<PolicyDecision> {
    return this.policy;
  }
}

class InMemoryTestRepository implements Repository<TestAggregate> {
  readonly store = new Map<string, TestAggregate>();
  readonly events: DomainEvent[] = [];
  readonly outbox: OutboxMessage[] = [];
  simulateDbFailure = false;

  async load(id: string, tenantId: string): Promise<TestAggregate | null> {
    const item = this.store.get(id);
    if (!item || item.tenantId !== tenantId) return null;
    return item;
  }

  async save(
    aggregate: TestAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[]
  ): Promise<void> {
    if (this.simulateDbFailure) {
      throw new Error('Database connection failed');
    }
    const current = this.store.get(aggregate.id);
    const currentVersion = current ? current.version : 0;
    if (currentVersion !== expectedVersion) {
      throw new OptimisticConcurrencyError(aggregate.id, expectedVersion, currentVersion);
    }
    this.store.set(aggregate.id, aggregate);
    this.events.push(...events);
    this.outbox.push(...outboxMessages);
  }
}

describe('CommandBus', () => {
  let clock: FakeClock;
  let idGen: SequentialIds;
  let clockPort: Clock;
  let idGenPort: IdGen;
  let repository: InMemoryTestRepository;
  let receiptStore: InMemoryReceiptStore;
  let policyStore: InMemoryPolicyStore;
  let reconciliationInboxStore: InMemoryReconciliationInboxStore;
  let fieldEncryption: LocalDevKeyProvider;
  let bus: CommandBus<TestAggregate>;
  const transactionRunner = { run: async <T>(_tenant: string, work: (ctx: CommandTransactionContext) => Promise<T>) => work({ transactionId: Symbol() }) };
  const securityAttemptWriter = { record: async () => undefined };
  const digestKeyProvider = { activeVersion: () => 'test-v1', hmac: async (version: string, bytes: Uint8Array) => createHmac('sha256', version).update(bytes).digest() };

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  const actorUserId = '00000000-0000-0000-0000-000000000010';
  const aggregateId = '00000000-0000-0000-0000-000000000100';

  beforeEach(() => {
    clock = new FakeClock('2026-01-01T12:00:00.000Z');
    idGen = new SequentialIds();
    clockPort = { now: () => clock.nowIso() };
    idGenPort = { generate: () => idGen.next() };
    repository = new InMemoryTestRepository();
    receiptStore = new InMemoryReceiptStore();
    policyStore = new InMemoryPolicyStore();
    reconciliationInboxStore = new InMemoryReconciliationInboxStore();
    fieldEncryption = new LocalDevKeyProvider({ rootKeyHex: 'b'.repeat(64), pepper: Buffer.from('test-only') });

    bus = new CommandBus({
      repository,
      receiptStore,
      policyStore,
      clock: clockPort,
      idGen: idGenPort,
      transactionRunner,
      securityAttemptWriter,
      digestKeyProvider,
      resultDataSchemas: { SetValue: z.record(z.unknown()) },
      reconciliationInboxStore,
      reconciliationDataSchemas: { SetValue: z.object({ newValue: z.string() }).strict() },
      fieldEncryption,
      reconciliationRetentionPolicy: {
        expiryFor: async ({ recordedAt }) => new Date(Date.parse(recordedAt) + 86_400_000).toISOString(),
      },
    });
  });

  it('repeatedCommandId_doesNotApplyTwice', async () => {
    const envelope: CommandEnvelope<{ newValue: string }> = {
      commandId: '00000000-0000-0000-0000-000000000099',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 0,
      correlationId: 'corr-1',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'first' },
    };

    let applyCount = 0;
    const handler = async (env: typeof envelope) => {
      applyCount++;
      return {
        newState: { id: aggregateId, tenantId, version: 1, value: env.payload.newValue },
        events: [
          {
            id: idGen.next(),
            tenantId,
            aggregateId,
            aggregateType: 'TestAggregate',
            eventType: 'ValueChanged',
            payload: { value: env.payload.newValue },
            occurredAt: env.occurredAt,
            recordedAt: env.recordedAt,
            sequence: 1,
          },
        ],
        data: { applied: true },
      };
    };

    const trusted = { trustedPrincipal: { actorUserId, tenantId } };
    const res1 = await bus.dispatch(envelope, handler, trusted);
    expect(res1.ok).toBe(true);

    const res2 = await bus.dispatch(envelope, handler, trusted);
    expect(res2.ok).toBe(true);
    expect(applyCount).toBe(1); // handler must not be executed twice
  });

  it('staleExpectedVersion_isRejected', async () => {
    repository.store.set(aggregateId, {
      id: aggregateId,
      tenantId,
      version: 2,
      value: 'existing',
    });

    const envelope: CommandEnvelope<{ newValue: string }> = {
      commandId: '00000000-0000-0000-0000-000000000098',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 1, // Stale! Current version is 2
      correlationId: 'corr-2',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'stale-update' },
    };

    const result = await bus.dispatch(envelope, async (env, ctx) => ({
      newState: {
        id: aggregateId,
        tenantId,
        version: (ctx.aggregate?.version ?? 0) + 1,
        value: env.payload.newValue,
      },
      events: [],
      data: { updated: true },
    }), { trustedPrincipal: { actorUserId, tenantId }, aggregateId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STALE_VERSION');
    }
    const terminalReceipt = receiptStore.receipts.get(`${tenantId}:${envelope.commandId}`);
    expect(terminalReceipt?.result_classification).toBe('terminal_rejection');
    expect(terminalReceipt?.safe_result).toMatchObject({
      ok: false,
      code: 'VERSION_CONFLICT',
      aggregate_id: aggregateId,
      expected_version: 1,
      observed_version: 2,
    });
    const parsedTerminal = terminalConflictResultSchema.safeParse(terminalReceipt?.safe_result);
    expect(parsedTerminal.success).toBe(true);
    const reconciliationId = parsedTerminal.success && parsedTerminal.data.code === 'VERSION_CONFLICT'
      ? parsedTerminal.data.reconciliation_id
      : undefined;
    expect(reconciliationId).toBeDefined();
    const item = reconciliationInboxStore.items.get(reconciliationId ?? '');
    expect(item).toBeDefined();
    expect(Buffer.from(item?.payload_ciphertext ?? []).toString('utf8')).not.toContain('stale-update');
    const clear = await fieldEncryption.decrypt(Buffer.from(item?.payload_ciphertext ?? []), item?.encryption_key_ref ?? '');
    expect(JSON.parse(clear.toString('utf8'))).toMatchObject({
      command_id: envelope.commandId,
      original_actor_id: actorUserId,
      target_aggregate_id: aggregateId,
      expected_version: 1,
      observed_version: 2,
      changes: { newValue: 'stale-update' },
    });
    expect(repository.store.get(aggregateId)?.value).toBe('existing');
  });

  it('dbFailure_rollsBackAll', async () => {
    repository.simulateDbFailure = true;

    const envelope: CommandEnvelope<{ newValue: string }> = {
      commandId: '00000000-0000-0000-0000-000000000097',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 0,
      correlationId: 'corr-3',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'failure-attempt' },
    };

    await expect(
      bus.dispatch(envelope, async (env) => ({
        newState: { id: aggregateId, tenantId, version: 1, value: env.payload.newValue },
        events: [
          {
            id: '00000000-0000-0000-0000-000000000096',
            tenantId,
            aggregateId,
            aggregateType: 'TestAggregate',
            eventType: 'ValueChanged',
            payload: {},
            occurredAt: env.occurredAt,
            recordedAt: env.recordedAt,
            sequence: 1,
          },
        ],
        data: { success: true },
      }), { trustedPrincipal: { actorUserId, tenantId } })
    ).rejects.toThrow('Database connection failed');

    expect(repository.store.has(aggregateId)).toBe(false);
    expect(repository.events).toHaveLength(0);
    expect(repository.outbox).toHaveLength(0);
  });

  it('concurrentCommands_onlyOneWins', async () => {
    repository.store.set(aggregateId, {
      id: aggregateId,
      tenantId,
      version: 1,
      value: 'v1',
    });

    const envA: CommandEnvelope<{ newValue: string }> = {
      commandId: '00000000-0000-0000-0000-000000000095',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 1,
      correlationId: 'corr-a',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'from-a' },
    };

    const envB: CommandEnvelope<{ newValue: string }> = {
      commandId: '00000000-0000-0000-0000-000000000094',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-2',
      expectedVersion: 1,
      correlationId: 'corr-b',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'from-b' },
    };

    const handler = async (env: typeof envA) => ({
      newState: { id: aggregateId, tenantId, version: 2, value: env.payload.newValue },
      events: [],
      data: { winner: env.payload.newValue },
    });

    const [resA, resB] = await Promise.all([
      bus.dispatch(envA, handler, { trustedPrincipal: { actorUserId, tenantId }, aggregateId }),
      bus.dispatch(envB, handler, { trustedPrincipal: { actorUserId, tenantId }, aggregateId }),
    ]);

    const successes = [resA, resB].filter((r) => r.ok);
    const staleRejections = [resA, resB].filter((r) => !r.ok && r.code === 'STALE_VERSION');

    expect(successes).toHaveLength(1);
    expect(staleRejections).toHaveLength(1);
  });

  it('crossTenantCommand_isRejected', async () => {
    const envelope: CommandEnvelope<{ newValue: string }> = {
      commandId: 'cmd-cross-tenant',
      tenantId,
      actorUserId, // Actor belongs to otherTenantId
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 0,
      correlationId: 'corr-cross',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'cross' },
    };

    // Create bus where actor session is otherTenantId
    const result = await bus.dispatch(
      envelope,
      async () => ({
        newState: { id: aggregateId, tenantId, version: 1, value: 'cross' },
        events: [],
        data: {},
      }),
      { trustedPrincipal: { actorUserId, tenantId: otherTenantId } }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
  });

  it('unauthorisedCommand_mutatesNothing', async () => {
    policyStore.policy = { allow: false, reason: 'DENIED_BY_POLICY' };

    const envelope: CommandEnvelope<{ newValue: string }> = {
      commandId: 'cmd-unauth',
      tenantId,
      actorUserId,
      occurredAt: clock.nowIso(),
      recordedAt: clock.nowIso(),
      deviceId: 'dev-1',
      expectedVersion: 0,
      correlationId: 'corr-unauth',
      type: 'SetValue',
      schemaVersion: 1,
      payload: { newValue: 'forbidden' },
    };

    const result = await bus.dispatch(envelope, async (env) => ({
      newState: { id: aggregateId, tenantId, version: 1, value: env.payload.newValue },
      events: [],
      data: {},
    }), { trustedPrincipal: { actorUserId, tenantId } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED');
    }
    expect(repository.store.has(aggregateId)).toBe(false);
    expect(repository.events).toHaveLength(0);
    expect(receiptStore.receipts.size).toBe(0);
  });
});
