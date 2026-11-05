/**
 * @symphony/domain — kernel/ports.ts
 *
 * Inbound and outbound ports for the kernel domain boundary.
 * Pure TypeScript interfaces — no DB, no framework, no I/O implementations.
 */

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly payload: TPayload;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly sequence: number;
}

export interface OutboxMessage<TPayload = unknown> {
  readonly id: string;
  readonly eventId: string;
  readonly status: 'pending' | 'delivered' | 'failed';
  readonly createdAt: string;
  readonly deliveredAt?: string | null;
  readonly payload?: TPayload;
}

export interface CommandReceipt<TResult = unknown> {
  readonly commandId: string;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly deviceId?: string | null;
  readonly expectedVersion?: number | null;
  readonly result: TResult;
}

export class OptimisticConcurrencyError extends Error {
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(aggregateId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Optimistic concurrency conflict on aggregate ${aggregateId}: expected version ${expectedVersion}, but found ${actualVersion}`
    );
    this.name = 'OptimisticConcurrencyError';
    this.aggregateId = aggregateId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export interface AggregateRoot {
  readonly id: string;
  readonly tenantId: string;
  readonly version: number;
}

export interface Repository<TAggregate extends AggregateRoot> {
  load(id: string, tenantId: string): Promise<TAggregate | null>;
  save(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[]
  ): Promise<void>;
}

export interface Clock {
  now(): string;
}

export interface IdGen {
  generate(): string;
}

export type PolicyDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };

export interface PolicyStore {
  decide(
    action: string,
    target: { readonly id: string; readonly type: string; readonly tenantId: string },
    actor: { readonly userId: string; readonly tenantId: string },
    context?: Readonly<Record<string, unknown>>
  ): Promise<PolicyDecision>;
}

export interface CommandReceiptStore {
  get(commandId: string, tenantId: string): Promise<CommandReceipt | null>;
  save(receipt: CommandReceipt): Promise<void>;
}

export interface KeyProvider {
  encrypt(plaintext: Uint8Array, keyRef: string): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, keyRef: string): Promise<Uint8Array>;
  hmac(value: Uint8Array, pepper: Uint8Array): Promise<Uint8Array>;
}
