import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CommandBus } from '../command-bus.js';
import type { CommandEnvelope } from '../command-envelope.js';
import type {
  AggregateRoot, CommandReceipt, CommandReceiptStore, CommandTransactionContext,
  DomainEvent, PolicyStore, Repository,
} from '../ports.js';

interface Aggregate extends AggregateRoot { readonly value: string }

const envelope: CommandEnvelope<{ aggregateId: string; value: string }> = {
  commandId: 'f15af8f0-13cf-4a0d-8bf8-8d78f1f103f0',
  tenantId: '70ec2ccd-1c76-4cc9-8cc9-5b24d19e2e9d',
  actorUserId: '66cb10c4-2711-45f6-9142-55feb5440a74',
  occurredAt: '2026-11-10T08:00:00.000Z',
  recordedAt: '2026-11-10T08:00:00.000Z',
  deviceId: 'synthetic-device',
  expectedVersion: 0,
  correlationId: 'transport-only',
  type: 'aggregate.create',
  schemaVersion: 1,
  payload: { aggregateId: '4dde71b2-3c32-42a0-a712-64f6b0a35c1e', value: 'new' },
};

function setup(allow: boolean, auditFails = false) {
  const contexts: CommandTransactionContext[] = [];
  const handlerContexts: CommandTransactionContext[] = [];
  const savedReceipts: CommandReceipt[] = [];
  let repositorySaveCalls = 0;
  let rolledBack = false;
  let auditWasAfterRollback = false;
  const receiptStore: CommandReceiptStore = {
    get: async (_id, _tenant, context) => { if (context) contexts.push(context); return null; },
    save: async (receipt: CommandReceipt, context) => { savedReceipts.push(receipt); if (context) contexts.push(context); return true; },
  };
  const repository: Repository<Aggregate> = {
    load: async (_id, _tenant, context) => { if (context) contexts.push(context); return null; },
    save: async (_aggregate, _version, _events, _outbox, context) => { repositorySaveCalls += 1; if (context) contexts.push(context); },
  };
  const policyStore: PolicyStore = {
    decide: async (_action, _target, _actor, _policyContext, context) => {
      if (context) contexts.push(context);
      return allow ? { allow: true } : { allow: false, reason: 'POLICY_DETAIL_MUST_NOT_LEAK' };
    },
  };
  const auditCalls: string[] = [];
  const bus = new CommandBus<Aggregate>({
    repository,
    receiptStore,
    policyStore,
    clock: { now: () => '2026-11-10T08:00:01.000Z' },
    idGen: { generate: () => 'e176e3d8-e707-4b8f-a1d8-3ddad3b2304a' },
    transactionRunner: {
      run: async (_tenant, work) => {
        const context = { transactionId: Symbol('test-transaction') };
        try { return await work(context); } catch (error) { rolledBack = true; throw error; }
      },
    },
    securityAttemptWriter: {
      record: async (attempt) => {
        auditWasAfterRollback = rolledBack;
        auditCalls.push(attempt.denialCode);
        if (auditFails) throw new Error('storage detail must not escape');
      },
    },
    digestKeyProvider: {
      activeVersion: () => 'synthetic-test-v1',
      hmac: async (version, bytes) => createHmac('sha256', version).update(bytes).digest(),
    },
    resultDataSchemas: { 'aggregate.create': z.object({ value: z.string() }).strict() },
  });
  return { bus, contexts, handlerContexts, savedReceipts, get repositorySaveCalls() { return repositorySaveCalls; }, auditCalls, get auditWasAfterRollback() { return auditWasAfterRollback; } };
}

describe('WP1.2-A transaction context and WP1.2-B denial audit boundary', () => {
  it('passes one context identity through receipt, aggregate, policy, and writes', async () => {
    const state = setup(true);
    await state.bus.dispatch(envelope, (command, context) => {
      state.handlerContexts.push(context.transaction);
      return {
        newState: { id: command.payload.aggregateId, tenantId: command.tenantId, version: 1, value: command.payload.value },
        events: [],
        data: { value: command.payload.value },
      };
    }, { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(state.contexts.length).toBeGreaterThanOrEqual(5);
    expect(new Set(state.contexts.map((context) => context.transactionId)).size).toBe(1);
    expect(state.handlerContexts).toHaveLength(1);
    expect(state.handlerContexts[0]?.transactionId).toBe(state.contexts[0]?.transactionId);
    expect(state.auditCalls).toEqual([]);
  });

  it('runs same-transaction event binding only after the event-bearing repository save', async () => {
    const state = setup(true);
    let ranAfterSave = false;
    const result = await state.bus.dispatch(envelope, (command) => ({
      newState: { id: command.payload.aggregateId, tenantId: command.tenantId, version: 1, value: command.payload.value },
      events: [], data: { value: command.payload.value },
      afterPersistence: () => { ranAfterSave = state.repositorySaveCalls === 1; },
    }), { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(result.ok).toBe(true);
    expect(ranAfterSave).toBe(true);
  });

  it('rolls back the command transaction before recording a denial without policy detail', async () => {
    const state = setup(false);
    const result = await state.bus.dispatch(envelope, () => {
      throw new Error('a denied command must not invoke its handler');
    }, { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(state.auditWasAfterRollback).toBe(true);
    expect(state.auditCalls).toEqual(['AUTHORIZATION_DENIED']);
    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' });
  });

  it('commits a semantic no-op receipt without aggregate, event, or outbox writes', async () => {
    const state = setup(true);
    const result = await state.bus.dispatch(envelope, (command) => ({
      newState: { id: command.payload.aggregateId, tenantId: command.tenantId, version: 0, value: command.payload.value },
      events: [], data: { value: command.payload.value }, persistAggregate: false,
    }), { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(result.ok).toBe(true);
    expect(state.savedReceipts).toHaveLength(1);
    expect(state.repositorySaveCalls).toBe(0);
    expect(state.savedReceipts[0]?.safe_result).toMatchObject({ ok: true, event_ids: [] });
  });

  it('stores an accepted authority conflict as a terminal domain receipt without business writes', async () => {
    const state = setup(true);
    const result = await state.bus.dispatch(envelope, (command) => ({
      newState: { id: command.payload.aggregateId, tenantId: command.tenantId, version: 0, value: command.payload.value },
      events: [], data: { value: command.payload.value }, persistAggregate: false,
      terminalRejection: { code: 'AUTHORITY_GRANT_CONFLICT' },
    }), { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(result).toMatchObject({ ok: false, code: 'DOMAIN_VIOLATION' });
    expect(state.savedReceipts[0]?.safe_result).toMatchObject({ ok: false, code: 'DOMAIN_CONFLICT', domain_code: 'AUTHORITY_GRANT_CONFLICT' });
    expect(state.repositorySaveCalls).toBe(0);
  });

  it('returns a retryable classification when the required audit write fails', async () => {
    const state = setup(false, true);
    const result = await state.bus.dispatch(envelope, () => {
      throw new Error('a denied command must not invoke its handler');
    }, { trustedPrincipal: { actorUserId: envelope.actorUserId, tenantId: envelope.tenantId } });
    expect(result).toEqual({ ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' });
  });

  it('fails closed without trusted actor and tenant context and audits mismatched context as the trusted actor', async () => {
    const missing = setup(true);
    const noContext = await missing.bus.dispatch(envelope, () => { throw new Error('must not run'); });
    expect(noContext).toEqual({ ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' });
    expect(missing.contexts).toHaveLength(0);

    const mismatched = setup(true);
    const mismatchResult = await mismatched.bus.dispatch(envelope, () => { throw new Error('must not run'); }, {
      trustedPrincipal: { actorUserId: 'trusted-actor', tenantId: 'trusted-tenant' },
    });
    expect(mismatchResult).toEqual({ ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' });
    expect(mismatched.auditCalls).toEqual(['TENANT_MISMATCH']);
  });
});
