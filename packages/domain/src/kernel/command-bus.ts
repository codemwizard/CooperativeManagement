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
import { createCommandReceiptSchema, type CommandResultDataSchemas } from '@symphony/contracts';
import {
  AggregateRoot,
  Clock,
  CommandReceipt,
  CommandReceiptStore,
  CommandTransactionContext,
  CommandTransactionRunner,
  DomainEvent,
  IdGen,
  OptimisticConcurrencyError,
  OutboxMessage,
  PolicyStore,
  Repository,
  SecurityAttemptDenialCode,
  SecurityAttemptWriter,
  CommandDigestKeyProvider,
} from './ports.js';

export interface CommandHandlerContext<TAggregate extends AggregateRoot> {
  readonly aggregate: TAggregate | null;
  readonly clock: Clock;
  readonly idGen: IdGen;
}

export interface DomainTransitionResult<TAggregate extends AggregateRoot, TData = unknown> {
  readonly newState: TAggregate;
  readonly events: readonly DomainEvent[];
  readonly outbox?: readonly OutboxMessage[];
  readonly data: TData;
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
      });
    } catch (error: unknown) {
      if (error instanceof OptimisticConcurrencyError) {
        return { ok: false, code: 'STALE_VERSION', detail: error.message };
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
    if (
      targetAggregateId === undefined &&
      typeof envelope.payload === 'object' &&
      envelope.payload !== null &&
      'aggregateId' in envelope.payload
    ) {
      const candidate = (envelope.payload as { readonly aggregateId: unknown }).aggregateId;
      if (typeof candidate === 'string') {
        targetAggregateId = candidate;
      }
    }

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

    // 5. Execute domain transition handler
    const context: CommandHandlerContext<TAggregate> = {
      aggregate: existingAggregate,
      clock: this.deps.clock,
      idGen: this.deps.idGen,
    };

    const transition = await handler(envelope, context);
    const result: CommandResult<TData> = {
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
      result_classification: 'committed_success',
      result_schema_version: 'command-result-v1',
      safe_result: {
        schema_version: 'command-result-v1',
        ok: true,
        aggregate_version: transition.newState.version,
        event_ids: transition.events.map((event) => event.id),
        data: transition.data,
      },
      recorded_at: this.deps.clock.now(),
    };
    createCommandReceiptSchema(this.deps.resultDataSchemas).parse(receipt);
    await this.deps.receiptStore.save(receipt, transaction);
    await this.deps.repository.save(
      transition.newState,
      envelope.expectedVersion,
      transition.events,
      transition.outbox ?? [],
      transaction
    );

    return result;
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
        expected_aggregate_version: envelope.expectedVersion,
        payload: envelope.payload as Readonly<Record<string, import('./command-digest.js').JsonValue>>,
      }, this.deps.digestKeyProvider, receipt.digest_key_version, receipt.semantic_digest);
    if (!digestMatches) {
      return { ok: false, code: 'IDEMPOTENCY_KEY_REUSED', detail: 'Idempotency key cannot be reused' };
    }
    const validated = createCommandReceiptSchema(this.deps.resultDataSchemas).parse(receipt);
    if (!validated.safe_result.ok) throw new Error('Terminal receipt replay is owned by WP1.4');
    return {
      ok: true,
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
