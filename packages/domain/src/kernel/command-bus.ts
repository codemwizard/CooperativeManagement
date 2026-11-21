/**
 * @symphony/domain — kernel/command-bus.ts
 *
 * Command bus coordinating idempotency, optimistic concurrency, policy,
 * domain state transitions, and atomic persistence.
 *
 * Rules:
 * - AUD-001 / INV-020: Idempotent replay of previously committed commands
 * - AUD-002: Optimistic concurrency check via expectedVersion
 * - AUD-004 / INV-001: Strict tenant isolation (reject cross-tenant actions)
 * - INV-019: Atomic commit of state, events, and outbox messages
 * - No `any` types permitted anywhere.
 */

import { CommandEnvelope } from './command-envelope.js';
import { CommandResult } from './command-result.js';
import { computeCommandDigest, verifyCommandDigest } from './command-digest.js';
import {
  createCommandReceiptSchema,
  type CommandReconciliationDataSchemas,
  type CommandResultDataSchemas,
} from '@symphony/contracts';
import {
  AggregateRoot,
  Clock,
  CommandReceipt,
  CommandReceiptStore,
  EncryptedReconciliationInboxItem,
  CommandTransactionContext,
  CommandTransactionRunner,
  DomainEvent,
  IdGen,
  OptimisticConcurrencyError,
  OutboxMessage,
  PolicyStore,
  Repository,
  RetryableCommandTransactionError,
  ReconciliationInboxStore,
  ReconciliationRetentionPolicy,
  KeyProvider,
  SecurityAttemptDenialCode,
  SecurityAttemptWriter,
  CommandDigestKeyProvider,
} from './ports.js';

export interface CommandHandlerContext<TAggregate extends AggregateRoot> {
  readonly aggregate: TAggregate | null;
  /** The same transaction used for receipt, policy, aggregate, event and outbox operations. */
  readonly transaction: CommandTransactionContext;
  readonly clock: Clock;
  readonly idGen: IdGen;
}

export interface DomainTransitionResult<TAggregate extends AggregateRoot, TData = unknown> {
  readonly newState: TAggregate;
  readonly events: readonly DomainEvent[];
  readonly outbox?: readonly OutboxMessage[];
  readonly data: TData;
  /** Accepted semantic no-op: receipt persists, but no aggregate/event/outbox write occurs. */
  readonly persistAggregate?: boolean;
  /** Same-transaction writes that must follow persisted events, such as binding a source row to its event. */
  readonly afterPersistence?: () => Promise<void> | void;
  /** Accepted deterministic business conflict; it commits a terminal safe receipt without business writes. */
  readonly terminalRejection?: { readonly code: 'AUTHORITY_GRANT_CONFLICT' };
}

export type DomainCommandHandler<
  TAggregate extends AggregateRoot,
  TPayload = unknown,
  TData = unknown,
> = (
  envelope: CommandEnvelope<TPayload>,
  context: CommandHandlerContext<TAggregate>
) => Promise<DomainTransitionResult<TAggregate, TData>> | DomainTransitionResult<TAggregate, TData>;

export interface CommandDispatchOptions {
  /** Supplied by authenticated server composition, never copied from request input. */
  readonly trustedPrincipal: { readonly actorUserId: string; readonly tenantId: string };
  readonly aggregateId?: string;
}

export interface CommandBusDependencies<TAggregate extends AggregateRoot> {
  readonly repository: Repository<TAggregate>;
  readonly receiptStore: CommandReceiptStore;
  readonly policyStore: PolicyStore;
  readonly clock: Clock;
  readonly idGen: IdGen;
  readonly transactionRunner: CommandTransactionRunner;
  readonly securityAttemptWriter: SecurityAttemptWriter;
  readonly digestKeyProvider: CommandDigestKeyProvider;
  readonly resultDataSchemas: CommandResultDataSchemas;
  readonly reconciliationInboxStore?: ReconciliationInboxStore;
  readonly reconciliationDataSchemas?: CommandReconciliationDataSchemas;
  readonly fieldEncryption?: Pick<KeyProvider, 'encrypt'>;
  readonly reconciliationRetentionPolicy?: ReconciliationRetentionPolicy;
}

export class CommandBus<TAggregate extends AggregateRoot> {
  constructor(private readonly deps: CommandBusDependencies<TAggregate>) {}

  async dispatch<TPayload, TData>(
    envelope: CommandEnvelope<TPayload>,
    handler: DomainCommandHandler<TAggregate, TPayload, TData>,
    options?: CommandDispatchOptions
  ): Promise<CommandResult<TData>> {
    if (!options?.trustedPrincipal?.actorUserId || !options.trustedPrincipal.tenantId) {
      return { ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' };
    }
    if (options.trustedPrincipal.actorUserId !== envelope.actorUserId || options.trustedPrincipal.tenantId !== envelope.tenantId) {
      try {
        await this.deps.securityAttemptWriter.record({
          tenantId: options.trustedPrincipal.tenantId,
          actorUserId: options.trustedPrincipal.actorUserId,
          observedCommandId: envelope.commandId,
          observedCommandType: envelope.type,
          denialCode: 'TENANT_MISMATCH',
        });
      } catch {
        return { ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' };
      }
      return { ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' };
    }
    // 1. Cross-tenant check (INV-001)
    try {
      return await this.deps.transactionRunner.run(envelope.tenantId, async (transaction) => {
        return this.dispatchInTransaction(envelope, handler, options, transaction);
      }, {
        resolveUncertainCommit: async (transaction) => {
          const receipt = await this.deps.receiptStore.get(envelope.commandId, envelope.tenantId, transaction);
          return receipt === null ? null : this.replayReceipt<TData, TPayload>(receipt, envelope);
        },
      }, envelope.actorUserId);
    } catch (error: unknown) {
      if (error instanceof OptimisticConcurrencyError) {
        return { ok: false, code: 'STALE_VERSION', detail: error.message };
      }
      if (error instanceof RetryableCommandTransactionError) {
        return { ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' };
      }
      if (!(error instanceof AuthorizationDenied)) throw error;
      try {
        await this.deps.securityAttemptWriter.record({
          tenantId: envelope.tenantId,
          actorUserId: envelope.actorUserId,
          observedCommandId: envelope.commandId,
          observedCommandType: envelope.type,
          denialCode: error.denialCode,
        });
      } catch {
        return { ok: false, code: 'COMMAND_TEMPORARILY_UNAVAILABLE', detail: 'Command temporarily unavailable' };
      }
      return { ok: false, code: 'UNAUTHORIZED', detail: 'Not authorized' };
    }
  }

  private async dispatchInTransaction<TPayload, TData>(
    envelope: CommandEnvelope<TPayload>,
    handler: DomainCommandHandler<TAggregate, TPayload, TData>,
    options: CommandDispatchOptions,
    transaction: CommandTransactionContext,
  ): Promise<CommandResult<TData>> {
    // Receipt, policy, aggregate, and writes all use the same transaction handle.
    const existingReceipt = await this.deps.receiptStore.get(envelope.commandId, envelope.tenantId, transaction);
    if (existingReceipt !== null) {
      return this.replayReceipt<TData, TPayload>(existingReceipt, envelope);
    }

    // 3. Resolve aggregateId and load existing aggregate
    let targetAggregateId = options.aggregateId;
    if (targetAggregateId === undefined) targetAggregateId = aggregateTargetFrom(envelope.payload);

    let existingAggregate: TAggregate | null = null;
    if (targetAggregateId !== undefined) {
      existingAggregate = await this.deps.repository.load(targetAggregateId, envelope.tenantId, transaction);
      const receiptAfterLock = await this.deps.receiptStore.get(envelope.commandId, envelope.tenantId, transaction);
      if (receiptAfterLock !== null) return this.replayReceipt<TData, TPayload>(receiptAfterLock, envelope);
    }

    // 4. Policy decision (authorisation check)
    const policyDecision = await this.deps.policyStore.decide(
      envelope.type,
      {
        id: targetAggregateId ?? envelope.commandId,
        type: envelope.type,
        tenantId: envelope.tenantId,
        ...(envelope.organizationId ? { organizationId: envelope.organizationId } : {}),
      },
      {
        userId: envelope.actorUserId,
        tenantId: envelope.tenantId,
      },
      typeof envelope.payload === 'object' && envelope.payload !== null
        ? (envelope.payload as Readonly<Record<string, unknown>>)
      : undefined,
      transaction
    );

    if (!policyDecision.allow) {
      throw new AuthorizationDenied(asDenialCode(policyDecision.reason));
    }

    if (existingAggregate !== null && existingAggregate.version !== envelope.expectedVersion) {
      return this.persistTerminalConflict<TData, TPayload>(envelope, targetAggregateId ?? existingAggregate.id, existingAggregate.version, transaction);
    }
    if (existingAggregate === null && envelope.expectedVersion > 0) {
      return { ok: false, code: 'NOT_FOUND', detail: 'Command target is unavailable' };
    }

    // 5. Execute domain transition handler
    const context: CommandHandlerContext<TAggregate> = {
      aggregate: existingAggregate,
      transaction,
      clock: this.deps.clock,
      idGen: this.deps.idGen,
    };

    const transition = await handler(envelope, context);
    const result: CommandResult<TData> = transition.terminalRejection
      ? { ok: false, code: 'DOMAIN_VIOLATION', detail: 'The requested authority conflicts with an active grant' }
      : {
          ok: true,
          aggregateVersion: transition.newState.version,
          eventIds: transition.events.map((e) => e.id),
          data: transition.data,
        };

    // 6. Atomic save with optimistic concurrency check (INV-019)
    const digest = await computeCommandDigest({
      tenant_id: envelope.tenantId,
      actor_id: envelope.actorUserId,
      command_id: envelope.commandId,
      command_type: envelope.type,
      command_schema_version: envelope.schemaVersion,
      ...(envelope.organizationId ? { organization_id: envelope.organizationId } : {}),
      expected_aggregate_version: envelope.expectedVersion,
      payload: envelope.payload as Readonly<Record<string, import('./command-digest.js').JsonValue>>,
    }, this.deps.digestKeyProvider);
    const receipt: CommandReceipt = {
      tenant_id: envelope.tenantId,
      command_id: envelope.commandId,
      actor_user_id: envelope.actorUserId,
      command_type: envelope.type,
      command_schema_version: String(envelope.schemaVersion),
      canonicalization_version: digest.canonicalization_version,
      digest_key_version: digest.key_version,
      semantic_digest: digest.semantic_digest,
      result_classification: transition.terminalRejection ? 'terminal_rejection' : 'committed_success',
      result_schema_version: 'command-result-v1',
      safe_result: transition.terminalRejection ? {
        schema_version: 'command-result-v1',
        ok: false,
        code: 'DOMAIN_CONFLICT',
        domain_code: transition.terminalRejection.code,
        aggregate_id: targetAggregateId ?? envelope.commandId,
      } : {
        schema_version: 'command-result-v1',
        ok: true,
        aggregate_version: transition.newState.version,
        event_ids: transition.events.map((event) => event.id),
        data: transition.data,
      },
      recorded_at: this.deps.clock.now(),
    };
    createCommandReceiptSchema(this.deps.resultDataSchemas).parse(receipt);
    const saved = await this.deps.receiptStore.save(receipt, transaction);
    if (!saved) {
      const winner = await this.deps.receiptStore.get(envelope.commandId, envelope.tenantId, transaction);
      if (winner === null) throw new RetryableCommandTransactionError();
      return this.replayReceipt<TData, TPayload>(winner, envelope);
    }
    if (transition.persistAggregate === false || transition.terminalRejection !== undefined) {
      if (transition.events.length > 0 || (transition.outbox?.length ?? 0) > 0) {
        throw new TypeError('A non-mutating command cannot emit events or outbox messages');
      }
      if (transition.terminalRejection && transition.persistAggregate !== false) {
        throw new TypeError('A terminal business conflict cannot persist aggregate state');
      }
      if (transition.afterPersistence !== undefined) {
        throw new TypeError('A non-mutating command cannot run after-persistence writes');
      }
    } else {
      await this.deps.repository.save(
        transition.newState,
        envelope.expectedVersion,
        transition.events,
        transition.outbox ?? [],
        transaction
      );
      await transition.afterPersistence?.();
    }

    return result;
  }

  private async persistTerminalConflict<TData, TPayload>(
    envelope: CommandEnvelope<TPayload>,
    aggregateId: string,
    observedVersion: number,
    transaction: CommandTransactionContext,
  ): Promise<CommandResult<TData>> {
    const inboxStore = this.deps.reconciliationInboxStore;
    const reconciliationSchema = this.deps.reconciliationDataSchemas?.[envelope.type];
    const fieldEncryption = this.deps.fieldEncryption;
    const retentionPolicy = this.deps.reconciliationRetentionPolicy;
    if (!inboxStore || !reconciliationSchema || !fieldEncryption || !retentionPolicy) {
      throw new RetryableCommandTransactionError();
    }

    const validatedChanges = reconciliationSchema.safeParse(envelope.payload);
    if (!validatedChanges.success) throw new RetryableCommandTransactionError();

    const recordedAt = this.deps.clock.now();
    const expiresAt = await retentionPolicy.expiryFor({
      tenantId: envelope.tenantId,
      commandType: envelope.type,
      recordedAt,
    });
    if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(recordedAt)) {
      throw new RetryableCommandTransactionError();
    }

    const reconciliationId = this.deps.idGen.generate();
    const encryptedPayload = {
      command_id: envelope.commandId,
      original_actor_id: envelope.actorUserId,
      target_aggregate_id: aggregateId,
      expected_version: envelope.expectedVersion,
      observed_version: observedVersion,
      changes: validatedChanges.data,
    };
    let ciphertext: Uint8Array;
    try {
      ciphertext = await fieldEncryption.encrypt(
        new TextEncoder().encode(JSON.stringify(encryptedPayload)),
        reconciliationId,
      );
    } catch {
      throw new RetryableCommandTransactionError();
    }

    const digest = await computeCommandDigest({
      tenant_id: envelope.tenantId,
      actor_id: envelope.actorUserId,
      command_id: envelope.commandId,
      command_type: envelope.type,
      command_schema_version: envelope.schemaVersion,
      ...(envelope.organizationId ? { organization_id: envelope.organizationId } : {}),
      expected_aggregate_version: envelope.expectedVersion,
      payload: envelope.payload as Readonly<Record<string, import('./command-digest.js').JsonValue>>,
    }, this.deps.digestKeyProvider);
    const receipt: CommandReceipt = {
      tenant_id: envelope.tenantId,
      command_id: envelope.commandId,
      actor_user_id: envelope.actorUserId,
      command_type: envelope.type,
      command_schema_version: String(envelope.schemaVersion),
      canonicalization_version: digest.canonicalization_version,
      digest_key_version: digest.key_version,
      semantic_digest: digest.semantic_digest,
      result_classification: 'terminal_rejection',
      result_schema_version: 'command-result-v1',
      safe_result: {
        schema_version: 'command-result-v1',
        ok: false,
        code: 'VERSION_CONFLICT',
        aggregate_id: aggregateId,
        expected_version: envelope.expectedVersion,
        observed_version: observedVersion,
        reconciliation_id: reconciliationId,
      },
      recorded_at: recordedAt,
    };
    createCommandReceiptSchema(this.deps.resultDataSchemas).parse(receipt);
    const saved = await this.deps.receiptStore.save(receipt, transaction);
    if (!saved) {
      const winner = await this.deps.receiptStore.get(envelope.commandId, envelope.tenantId, transaction);
      if (winner === null) throw new RetryableCommandTransactionError();
      return this.replayReceipt<TData, TPayload>(winner, envelope);
    }

    const inboxItem: EncryptedReconciliationInboxItem = {
      reconciliation_id: reconciliationId,
      tenant_id: envelope.tenantId,
      payload_ciphertext: ciphertext,
      encryption_key_ref: reconciliationId,
      reason_code: 'VERSION_CONFLICT',
      lifecycle: 'open',
      created_at: recordedAt,
      updated_at: recordedAt,
      expires_at: expiresAt,
      tombstoned_at: null,
    };
    await inboxStore.save(inboxItem, transaction);
    return { ok: false, code: 'STALE_VERSION', detail: 'Command version conflict' };
  }

  private async replayReceipt<TData, TPayload>(
    receipt: CommandReceipt,
    envelope: CommandEnvelope<TPayload>,
  ): Promise<CommandResult<TData>> {
    const schemaVersion = envelope.schemaVersion;
    const digestMatches = receipt.tenant_id === envelope.tenantId
      && receipt.command_id === envelope.commandId
      && receipt.actor_user_id === envelope.actorUserId
      && receipt.command_type === envelope.type
      && receipt.command_schema_version === String(schemaVersion)
      && await verifyCommandDigest({
        tenant_id: envelope.tenantId,
        actor_id: envelope.actorUserId,
        command_id: envelope.commandId,
        command_type: envelope.type,
        command_schema_version: schemaVersion,
        ...(envelope.organizationId ? { organization_id: envelope.organizationId } : {}),
        expected_aggregate_version: envelope.expectedVersion,
        payload: envelope.payload as Readonly<Record<string, import('./command-digest.js').JsonValue>>,
      }, this.deps.digestKeyProvider, receipt.digest_key_version, receipt.semantic_digest);
    if (!digestMatches) {
      return { ok: false, code: 'IDEMPOTENCY_KEY_REUSED', detail: 'Idempotency key cannot be reused' };
    }
    const validated = createCommandReceiptSchema(this.deps.resultDataSchemas).parse(receipt);
    if (!validated.safe_result.ok) {
      if (validated.safe_result.code === 'DOMAIN_CONFLICT') {
        return { ok: false, replayed: true, code: 'DOMAIN_VIOLATION', detail: 'The requested authority conflicts with an active grant' };
      }
      return { ok: false, replayed: true, code: 'STALE_VERSION', detail: 'Command version conflict' };
    }
    return {
      ok: true,
      replayed: true,
      aggregateVersion: validated.safe_result.aggregate_version,
      eventIds: validated.safe_result.event_ids,
      data: validated.safe_result.data as TData,
    };
  }
}

class AuthorizationDenied extends Error {
  constructor(readonly denialCode: SecurityAttemptDenialCode) {
    super('Authorization denied');
  }
}

function asDenialCode(reason: string): SecurityAttemptDenialCode {
  switch (reason) {
    case 'NOT_AUTHORISED_FOR_ORGANISATION':
    case 'TENANT_MISMATCH':
    case 'READ_ONLY_ROLE':
      return reason;
    default:
      return 'AUTHORIZATION_DENIED';
  }
}

function aggregateTargetFrom(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const record = payload as Readonly<Record<string, unknown>>;
  for (const key of ['aggregateId', 'capacityGrantId', 'delegationId']) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}
