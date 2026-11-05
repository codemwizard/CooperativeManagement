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
  type: string;
  payload: unknown; // JSONB
  occurred_at: Date;
  recorded_at: Generated<Date>;
  device_id: string | null;
  expected_version: number | null;
  result: unknown | null; // JSONB
}

export type CommandReceiptRow = Selectable<CommandReceiptTable>;
export type InsertCommandReceipt = Insertable<CommandReceiptTable>;

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
  'symphony.tenants': TenantTable;
}

