/**
 * @symphony/domain — authz/__tests__/capacity-service.test.ts
 *
 * Unit tests for the capacity service (Task 1.6.4 — written BEFORE implementation).
 *
 * Tests:
 *   - grantCapacity_allowed_byChairperson   — Chairperson can grant IFV; CapacityGranted event emitted
 *   - grantCapacity_denied_toSecretary      — Secretary cannot grant IFV; policy returns deny
 *   - revokeCapacity_allowed_byChairperson  — Chairperson can revoke; CapacityRevoked event emitted
 *   - revokeCapacity_annotatesExistingFindings — Findings from revoked IFV are annotated
 */

import { describe, it, expect } from 'vitest';
import { CapacityService, type CapacityCommand } from '../capacity-service.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ORG_A = 'org-a-uuid';
const CHAIR_ID = 'chair-001';
const SECRETARY_ID = 'sec-001';
const IFV_USER_ID = 'ifv-001';
const PAST = '2023-01-01T00:00:00Z';
const FUTURE = '2025-01-01T00:00:00Z';
const NOW = '2024-06-01T12:00:00Z';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CapacityService', () => {
  it('grantCapacity_allowed_byChairperson', async () => {
    /**
     * When a Chairperson issues a GrantCapacity command for internal_verifier,
     * the service must succeed and emit a CapacityGranted domain event.
     * The event must include grantor, grantee, capacity type, org and timestamp.
     */
    const svc = new CapacityService();

    const cmd: CapacityCommand = {
      type: 'GrantCapacity',
      actorUserId: CHAIR_ID,
      actorAppointments: [{ position: 'chairperson', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
      actorCapacities: [],
      actorPlatformRoles: [],
      actorDelegations: [],
      tenantId: ORG_A,
      targetUserId: IFV_USER_ID,
      capacityType: 'internal_verifier',
      activeFrom: NOW,
      activeTo: FUTURE,
      now: NOW,
    };

    const result = await svc.execute(cmd);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.eventType).toBe('CapacityGranted');
    expect(result.events[0]?.payload).toMatchObject({
      grantorUserId: CHAIR_ID,
      granteeUserId: IFV_USER_ID,
      capacityType: 'internal_verifier',
      tenantId: ORG_A,
    });
  });

  it('grantCapacity_denied_toSecretary', async () => {
    /**
     * When a Secretary issues a GrantCapacity command for internal_verifier,
     * the service must reject with code 'NOT_PERMITTED' (policy deny).
     */
    const svc = new CapacityService();

    const cmd: CapacityCommand = {
      type: 'GrantCapacity',
      actorUserId: SECRETARY_ID,
      actorAppointments: [{ position: 'secretary', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
      actorCapacities: [],
      actorPlatformRoles: [],
      actorDelegations: [],
      tenantId: ORG_A,
      targetUserId: IFV_USER_ID,
      capacityType: 'internal_verifier',
      activeFrom: NOW,
      activeTo: FUTURE,
      now: NOW,
    };

    const result = await svc.execute(cmd);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_PERMITTED');
  });

  it('revokeCapacity_allowed_byChairperson', async () => {
    /**
     * When a Chairperson issues a RevokeCapacity command, the service must
     * succeed and emit a CapacityRevoked event.
     */
    const svc = new CapacityService();

    const cmd: CapacityCommand = {
      type: 'RevokeCapacity',
      actorUserId: CHAIR_ID,
      actorAppointments: [{ position: 'chairperson', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
      actorCapacities: [],
      actorPlatformRoles: [],
      actorDelegations: [],
      tenantId: ORG_A,
      targetUserId: IFV_USER_ID,
      capacityType: 'internal_verifier',
      activeFrom: NOW,
      activeTo: FUTURE,
      now: NOW,
    };

    const result = await svc.execute(cmd);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.eventType).toBe('CapacityRevoked');
  });

  it('revokeCapacity_annotatesExistingFindings', async () => {
    /**
     * IFV-7: When an IFV's capacity is revoked, existing findings are NOT altered
     * but are annotated "verifier no longer active". The service must include
     * annotation instructions in the result.
     */
    const svc = new CapacityService();

    const cmd: CapacityCommand = {
      type: 'RevokeCapacity',
      actorUserId: CHAIR_ID,
      actorAppointments: [{ position: 'chairperson', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
      actorCapacities: [],
      actorPlatformRoles: [],
      actorDelegations: [],
      tenantId: ORG_A,
      targetUserId: IFV_USER_ID,
      capacityType: 'internal_verifier',
      activeFrom: NOW,
      activeTo: FUTURE,
      now: NOW,
    };

    const result = await svc.execute(cmd);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Result must indicate that existing findings need annotation
    expect(result.annotateFindings).toBe(true);
    expect(result.annotationText).toBe('verifier no longer active');
  });
});

