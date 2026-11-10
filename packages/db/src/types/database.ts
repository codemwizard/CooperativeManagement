/**
 * @symphony/db — types/database.ts
 *
 * Kysely database type definitions for the symphony schema.
 * Only the tables used by the kernel Repository implementation are typed here.
 * Additional table types are added as each work package requires them.
 */

import type { Generated, Insertable, Selectable } from 'kysely';

// ─── aggregate_states ────────────────────────────────────────────────────────

export interface AggregateStateTable {
  id: string;
  tenant_id: string;
  aggregate_type: string;
  version: Generated<number>;
  state: unknown; // JSONB — narrowed at the call site
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type AggregateStateRow = Selectable<AggregateStateTable>;
export type InsertAggregateState = Insertable<AggregateStateTable>;

// ─── domain_events ───────────────────────────────────────────────────────────

export interface DomainEventTable {
  id: string;
  tenant_id: string;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  payload: unknown; // JSONB
  occurred_at: Date;
  recorded_at: Generated<Date>;
  sequence: number;
}

export type DomainEventRow = Selectable<DomainEventTable>;
export type InsertDomainEvent = Insertable<DomainEventTable>;

// ─── event_outbox ─────────────────────────────────────────────────────────────

export interface EventOutboxTable {
  id: string;
  event_id: string;
  status: Generated<string>;
  created_at: Generated<Date>;
  delivered_at: Date | null;
}

export type EventOutboxRow = Selectable<EventOutboxTable>;
export type InsertEventOutbox = Insertable<EventOutboxTable>;

// ─── command_receipts ─────────────────────────────────────────────────────────

export interface CommandReceiptTable {
  command_id: string;
  tenant_id: string;
  actor_user_id: string;
  command_type: string;
  command_schema_version: string;
  canonicalization_version: string;
  digest_key_version: string;
  semantic_digest: Uint8Array;
  result_classification: 'committed_success' | 'terminal_rejection';
  result_schema_version: string;
  safe_result: unknown; // JSONB; validated against the registered result schema on read
  recorded_at: Generated<Date>;
}

export type CommandReceiptRow = Selectable<CommandReceiptTable>;
export type InsertCommandReceipt = Insertable<CommandReceiptTable>;

export interface SecurityAttemptTable {
  security_attempt_id: Generated<string>;
  tenant_id: string;
  actor_user_id: string;
  observed_command_id: string | null;
  observed_command_type: string | null;
  denial_code: 'AUTHORIZATION_DENIED' | 'NOT_AUTHORISED_FOR_ORGANISATION' | 'TENANT_MISMATCH' | 'READ_ONLY_ROLE';
  recorded_at: Generated<Date>;
}

export type SecurityAttemptRow = Selectable<SecurityAttemptTable>;

// ─── tenants ──────────────────────────────────────────────────────────────────

export interface TenantTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
}

// ─── Composite DB type ────────────────────────────────────────────────────────

export interface SymphonyDatabase {
  'symphony.aggregate_states': AggregateStateTable;
  'symphony.domain_events': DomainEventTable;
  'symphony.event_outbox': EventOutboxTable;
  'symphony.command_receipts': CommandReceiptTable;
  'symphony.security_attempts': SecurityAttemptTable;
  'symphony.tenants': TenantTable;
}

