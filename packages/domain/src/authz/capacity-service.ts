/**
 * @symphony/domain — authz/capacity-service.ts
 *
 * Capacity command handlers (VER-001, IFV-7).
 *
 * Implements:
 *   GrantCapacity  — validates granter authority via policy engine, records CapacityGranted event
 *   RevokeCapacity — records CapacityRevoked event; signals that existing findings need annotation
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   - Input validated (no `any` types)
 *   - Errors classified (NOT_PERMITTED)
 *   - Pure domain logic — no I/O
 */

import { decide } from './policy-engine.js';
import type { ActorContext, CapacityType, PolicyTarget } from './policy-engine.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapacityEvent {
  readonly eventType: 'CapacityGranted' | 'CapacityRevoked';
  readonly payload: CapacityGrantedPayload | CapacityRevokedPayload;
}

export interface CapacityGrantedPayload {
  readonly grantorUserId: string;
  readonly granteeUserId: string;
  readonly capacityType: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
  readonly occurredAt: string;
}

export interface CapacityRevokedPayload {
  readonly revokerUserId: string;
  readonly revokedUserId: string;
  readonly capacityType: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly occurredAt: string;
}

export interface CapacityCommand {
  readonly type: 'GrantCapacity' | 'RevokeCapacity';
  readonly actorUserId: string;
  readonly actorAppointments: ReadonlyArray<{ position: string; tenantId: string; organizationId: string; activeFrom: string; activeTo: string }>;
  readonly actorCapacities: ReadonlyArray<{ type: CapacityType; tenantId: string; organizationId: string; activeFrom: string; activeTo: string }>;
  readonly actorPlatformRoles: readonly string[];
  readonly actorDelegations: ReadonlyArray<{ type: 'acting_officer'; tenantId: string; organizationId: string; position: string; activeFrom: string; activeTo: string }>;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly targetUserId: string;
  readonly capacityType: CapacityType;
  readonly activeFrom: string;
  readonly activeTo: string;
  /** Required for delegate; identifies its recorded delegation or resolution source. */
  readonly sourceRef?: string;
  readonly now: string;
}

export interface CapacitySuccess {
  readonly ok: true;
  readonly events: readonly CapacityEvent[];
}

export interface CapacityFailure {
  readonly ok: false;
  readonly code: 'NOT_PERMITTED' | 'INVALID_INPUT';
  readonly detail: string;
}

export type CapacityResult = CapacitySuccess | CapacityFailure;

// ─── CapacityService ──────────────────────────────────────────────────────────

export class CapacityService {
  /**
   * Execute a GrantCapacity or RevokeCapacity command.
   * Validates via the policy engine before recording events.
   */
  async execute(cmd: CapacityCommand): Promise<CapacityResult> {
    // Input validation
    if (!cmd.actorUserId || cmd.actorUserId.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'actorUserId must not be empty' };
    }
    if (!cmd.targetUserId || cmd.targetUserId.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'targetUserId must not be empty' };
    }
    if (!cmd.capacityType || cmd.capacityType.trim().length === 0) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'capacityType must not be empty' };
    }
    if (cmd.capacityType === 'delegate' && !cmd.sourceRef?.trim()) {
      return { ok: false, code: 'INVALID_INPUT', detail: 'delegate capacity requires source provenance' };
    }

    const actor: ActorContext = {
      userId: cmd.actorUserId,
      tenantId: cmd.tenantId,
      platformRoles: cmd.actorPlatformRoles,
      appointments: cmd.actorAppointments,
      capacities: cmd.actorCapacities,
      delegations: cmd.actorDelegations,
    };

    const target: PolicyTarget = {
      id: `capacity-${cmd.targetUserId}`,
      type: 'organization_capacity',
      tenantId: cmd.tenantId,
      organizationId: cmd.organizationId,
    };

    const policyAction = cmd.type === 'GrantCapacity'
      ? { type: 'capacity.grant' as const, capacityType: cmd.capacityType, granteeUserId: cmd.targetUserId, activeFrom: cmd.activeFrom, activeTo: cmd.activeTo, ...(cmd.sourceRef ? { sourceRef: cmd.sourceRef } : {}) }
      : { type: 'capacity.revoke' as const, capacityType: cmd.capacityType, granteeUserId: cmd.targetUserId };

    const decision = decide(policyAction, target, actor, { now: cmd.now });

    if (decision === 'deny') {
      return { ok: false, code: 'NOT_PERMITTED', detail: `Policy denied ${policyAction.type}` };
    }

    if (cmd.type === 'GrantCapacity') {
      const event: CapacityEvent = {
        eventType: 'CapacityGranted',
        payload: {
          grantorUserId: cmd.actorUserId,
          granteeUserId: cmd.targetUserId,
          capacityType: cmd.capacityType,
          tenantId: cmd.tenantId,
          organizationId: cmd.organizationId,
          activeFrom: cmd.activeFrom,
          activeTo: cmd.activeTo,
          occurredAt: cmd.now,
        } satisfies CapacityGrantedPayload,
      };
      return { ok: true, events: [event] };
    }

    // RevokeCapacity
    const event: CapacityEvent = {
      eventType: 'CapacityRevoked',
      payload: {
        revokerUserId: cmd.actorUserId,
        revokedUserId: cmd.targetUserId,
        capacityType: cmd.capacityType,
        tenantId: cmd.tenantId,
        organizationId: cmd.organizationId,
        occurredAt: cmd.now,
      } satisfies CapacityRevokedPayload,
    };

    return { ok: true, events: [event] };
  }
}

