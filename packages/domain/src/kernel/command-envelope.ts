/**
 * @symphony/domain — kernel/command-envelope.ts
 *
 * Immutable envelope for all domain commands entering the system.
 * ADR-001 / ADR-006 / INV-019 / INV-020
 */

export interface CommandEnvelope<TPayload> {
  readonly commandId: string;       // idempotency key (client-generated UUID)
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly occurredAt: string;      // ISO 8601, when the action happened
  readonly recordedAt: string;      // ISO 8601, when the server saw it
  readonly deviceId: string;
  readonly expectedVersion: number;
  readonly correlationId: string;
  readonly type: string;
  readonly payload: TPayload;
}
