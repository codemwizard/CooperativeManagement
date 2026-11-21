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
  readonly tenant_id: string;
  readonly command_id: string;
  readonly actor_user_id: string;
  readonly command_type: string;
  readonly command_schema_version: string;
  readonly canonicalization_version: 'jcs-rfc8785-v1';
  readonly digest_key_version: string;
  readonly semantic_digest: Uint8Array;
  readonly result_classification: 'committed_success' | 'terminal_rejection';
  readonly result_schema_version: 'command-result-v1';
  readonly safe_result: TResult;
  readonly recorded_at: string;
}

/** Opaque handle shared by every command-path read and write in one transaction. */
export interface CommandTransactionContext {
  readonly transactionId: symbol;
}

export interface CommandTransactionRecovery<T> {
  /** Runs in a new transaction/connection after an uncertain commit. Null means no committed receipt exists. */
  readonly resolveUncertainCommit: (context: CommandTransactionContext) => Promise<T | null>;
}

export interface CommandTransactionRunner {
  run<T>(
    tenantId: string,
    work: (context: CommandTransactionContext) => Promise<T>,
    recovery?: CommandTransactionRecovery<T>,
    /** Trusted principal identity; supplied by CommandBus after principal/envelope equality is checked. */
    actorUserId?: string,
  ): Promise<T>;
}

/** Safe domain-level result for transient database failures or unresolved commits. */
export class RetryableCommandTransactionError extends Error {
  constructor() {
    super('Command transaction outcome is temporarily unavailable');
    this.name = 'RetryableCommandTransactionError';
  }
}

export type SecurityAttemptDenialCode =
  | 'AUTHORIZATION_DENIED'
  | 'NOT_AUTHORISED_FOR_ORGANISATION'
  | 'TENANT_MISMATCH'
  | 'READ_ONLY_ROLE';

export interface SecurityAttempt {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly observedCommandId?: string;
  readonly observedCommandType?: string;
  readonly denialCode: SecurityAttemptDenialCode;
}

export interface SecurityAttemptWriter {
  record(attempt: SecurityAttempt): Promise<void>;
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
  load(id: string, tenantId: string, context?: CommandTransactionContext): Promise<TAggregate | null>;
  save(
    aggregate: TAggregate,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[],
    context?: CommandTransactionContext
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
    target: { readonly id: string; readonly type: string; readonly tenantId: string; readonly organizationId?: string },
    actor: { readonly userId: string; readonly tenantId: string },
    policyContext: Readonly<Record<string, unknown>> | undefined,
    transaction?: CommandTransactionContext
  ): Promise<PolicyDecision>;
}

export interface CommandReceiptStore {
  get(commandId: string, tenantId: string, context?: CommandTransactionContext): Promise<CommandReceipt | null>;
  /** Returns false only when the tenant/command key already exists. */
  save(receipt: CommandReceipt, context?: CommandTransactionContext): Promise<boolean>;
}

export type ReconciliationLifecycle = 'open' | 'resolved' | 'superseded' | 'expired';

/** The inbox stores only encrypted command-specific reconciliation data plus non-identifying lifecycle metadata. */
export interface EncryptedReconciliationInboxItem {
  readonly reconciliation_id: string;
  readonly tenant_id: string;
  readonly payload_ciphertext: Uint8Array;
  readonly encryption_key_ref: string;
  readonly reason_code: 'VERSION_CONFLICT';
  readonly lifecycle: ReconciliationLifecycle;
  readonly created_at: string;
  readonly updated_at: string;
  readonly expires_at: string;
  readonly tombstoned_at: string | null;
}

export interface ReconciliationInboxStore {
  save(item: EncryptedReconciliationInboxItem, context?: CommandTransactionContext): Promise<void>;
  get(reconciliationId: string, tenantId: string, context?: CommandTransactionContext): Promise<EncryptedReconciliationInboxItem | null>;
  transition(
    reconciliationId: string,
    tenantId: string,
    next: 'resolved' | 'superseded',
    updatedAt: string,
    context?: CommandTransactionContext,
  ): Promise<boolean>;
  expire(reconciliationId: string, tenantId: string, now: string, context?: CommandTransactionContext): Promise<boolean>;
}

/** Supplies the approved per-category retention expiry; no duration is hardcoded by the command bus. */
export interface ReconciliationRetentionPolicy {
  expiryFor(input: { readonly tenantId: string; readonly commandType: string; readonly recordedAt: string }): Promise<string>;
}

export interface KeyProvider {
  encrypt(plaintext: Uint8Array, keyRef: string): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, keyRef: string): Promise<Uint8Array>;
  hmac(value: Uint8Array, pepper: Uint8Array): Promise<Uint8Array>;
}

/** Digest keys are versioned independently from field-encryption keys. */
export interface CommandDigestKeyProvider {
  activeVersion(): string;
  hmac(version: string, canonicalBytes: Uint8Array): Promise<Uint8Array>;
}
