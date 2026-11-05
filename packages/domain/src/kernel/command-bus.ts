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
import {
  AggregateRoot,
  Clock,
  CommandReceipt,
  CommandReceiptStore,
  DomainEvent,
  IdGen,
  OptimisticConcurrencyError,
  OutboxMessage,
  PolicyStore,
  Repository,
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
  readonly actorTenantId?: string;
  readonly aggregateId?: string;
}

export interface CommandBusDependencies<TAggregate extends AggregateRoot> {
  readonly repository: Repository<TAggregate>;
  readonly receiptStore: CommandReceiptStore;
  readonly policyStore: PolicyStore;
  readonly clock: Clock;
  readonly idGen: IdGen;
}

export class CommandBus<TAggregate extends AggregateRoot> {
  constructor(private readonly deps: CommandBusDependencies<TAggregate>) {}

  async dispatch<TPayload, TData>(
    envelope: CommandEnvelope<TPayload>,
    handler: DomainCommandHandler<TAggregate, TPayload, TData>,
    options?: CommandDispatchOptions
  ): Promise<CommandResult<TData>> {
    // 1. Cross-tenant check (INV-001)
    if (options?.actorTenantId !== undefined && options.actorTenantId !== envelope.tenantId) {
      return {
        ok: false,
        code: 'TENANT_MISMATCH',
        detail: `Actor tenant ${options.actorTenantId} does not match command tenant ${envelope.tenantId}`,
      };
    }

    // 2. Idempotency check (INV-020)
    const existingReceipt = await this.deps.receiptStore.get(
      envelope.commandId,
      envelope.tenantId
    );
    if (existingReceipt !== null) {
      // AUD-003: Same command id but different payload is a client error
      const storedPayload = JSON.stringify(existingReceipt.payload);
      const incomingPayload = JSON.stringify(envelope.payload);
      if (storedPayload !== incomingPayload) {
        return {
          ok: false,
          code: 'IDEMPOTENCY_KEY_REUSED',
          detail: `Command ${envelope.commandId} was previously submitted with a different payload`,
        };
      }
      // Same payload — return original result (idempotent replay)
      const stored = existingReceipt.result as CommandResult<TData>;
      return stored;
    }

    // 3. Resolve aggregateId and load existing aggregate
    let targetAggregateId = options?.aggregateId;
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
      existingAggregate = await this.deps.repository.load(targetAggregateId, envelope.tenantId);
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
        : undefined
    );

    if (!policyDecision.allow) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        detail: policyDecision.reason,
      };
    }

    // 5. Execute domain transition handler
    const context: CommandHandlerContext<TAggregate> = {
      aggregate: existingAggregate,
      clock: this.deps.clock,
      idGen: this.deps.idGen,
    };

    const transition = await handler(envelope, context);

    // 6. Atomic save with optimistic concurrency check (INV-019)
    try {
      await this.deps.repository.save(
        transition.newState,
        envelope.expectedVersion,
        transition.events,
        transition.outbox ?? []
      );
    } catch (err: unknown) {
      if (err instanceof OptimisticConcurrencyError) {
        return {
          ok: false,
          code: 'STALE_VERSION',
          detail: err.message,
        };
      }
      // Re-throw systemic / database errors so transactions roll back completely
      throw err;
    }

    // 7. Assemble successful command result
    const result: CommandResult<TData> = {
      ok: true,
      aggregateVersion: transition.newState.version,
      eventIds: transition.events.map((e) => e.id),
      data: transition.data,
    };

    // 8. Store command receipt for idempotency (INV-020)
    const receipt: CommandReceipt<CommandResult<TData>> = {
      commandId: envelope.commandId,
      tenantId: envelope.tenantId,
      actorUserId: envelope.actorUserId,
      type: envelope.type,
      payload: envelope.payload,
      occurredAt: envelope.occurredAt,
      recordedAt: this.deps.clock.now(),
      deviceId: envelope.deviceId,
      expectedVersion: envelope.expectedVersion,
      result,
    };

    await this.deps.receiptStore.save(receipt);

    return result;
  }
}
