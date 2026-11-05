/**
 * @symphony/domain — authz/__tests__/policy.test.ts
 *
 * Unit tests for the policy engine (Task 1.6.1 — written BEFORE implementation).
 *
 * Tests:
 *   - grantCapacity_IFV_allowedByChairperson
 *   - grantCapacity_IFV_deniedToSecretary
 *   - IFV_cannotVerifyOwnSuppliedVersion
 *   - IFV_boundToOrganisation_cannotActOnAnother
 *   - institutionalRole_cannotWriteEvidence
 *   - revokedCapacity_isNoLongerEffective
 *   - delegation_extendsCapacity
 *
 * All tests are expected to FAIL until policy-engine.ts is implemented.
 */

import { describe, it, expect } from 'vitest';
import { decide } from '../policy-engine.js';
import type { ActorContext, PolicyTarget, PolicyContext } from '../policy-engine.js';

// ─── Helper factories ──────────────────────────────────────────────────────────

const ORG_A = 'org-a-uuid';
const ORG_B = 'org-b-uuid';
const NOW = '2024-06-01T12:00:00Z';
const FUTURE = '2025-01-01T00:00:00Z';
const PAST = '2023-01-01T00:00:00Z';

function makeTarget(
  id: string,
  type: string,
  tenantId: string,
  suppliedBy?: string,
): PolicyTarget {
  return { id, type, tenantId, suppliedBy };
}

function makeActor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    userId: 'user-default',
    tenantId: ORG_A,
    platformRoles: [],
    appointments: [],
    capacities: [],
    delegations: [],
    ...overrides,
  };
}

function makeContext(now = NOW): PolicyContext {
  return { now };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEngine', () => {
  it('grantCapacity_IFV_allowedByChairperson', () => {
    /**
     * A user appointed as Chairperson may grant the internal_verifier capacity.
     * decide('GrantCapacity:internal_verifier', ..., actor) must return 'allow'.
     */
    const actor = makeActor({
      appointments: [{ position: 'chairperson', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    const target = makeTarget('capacity-grant-001', 'CapacityGrant', ORG_A);
    const result = decide('GrantCapacity:internal_verifier', target, actor, makeContext());
    expect(result).toBe('allow');
  });

  it('grantCapacity_IFV_deniedToSecretary', () => {
    /**
     * A Secretary (without Chairperson or Vice-Chairperson appointment) may NOT grant IFV.
     * decide('GrantCapacity:internal_verifier', ...) must return 'deny'.
     */
    const actor = makeActor({
      appointments: [{ position: 'secretary', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    const target = makeTarget('capacity-grant-002', 'CapacityGrant', ORG_A);
    const result = decide('GrantCapacity:internal_verifier', target, actor, makeContext());
    expect(result).toBe('deny');
  });

  it('IFV_cannotVerifyOwnSuppliedVersion', () => {
    /**
     * INV-011 / IFV-6 (HARD): An IFV cannot issue a finding on a version they supplied.
     * decide('RecordFinding', target{suppliedBy: ifvUserId}, ifvActor) must return 'deny'.
     */
    const IFV_USER = 'ifv-user-001';
    const actor = makeActor({
      userId: IFV_USER,
      capacities: [{ type: 'internal_verifier', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    // The evidence version was supplied by the same user
    const target = makeTarget('ev-001', 'EvidenceVersion', ORG_A, IFV_USER);
    const result = decide('RecordFinding', target, actor, makeContext());
    expect(result).toBe('deny');
  });

  it('IFV_boundToOrganisation_cannotActOnAnother', () => {
    /**
     * IFV-3 / AUD-004: A capacity is scoped to one organisation.
     * An IFV for ORG_A trying to record a finding in ORG_B must be denied.
     */
    const actor = makeActor({
      tenantId: ORG_A,
      capacities: [{ type: 'internal_verifier', tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    const target = makeTarget('ev-002', 'EvidenceVersion', ORG_B);
    const result = decide('RecordFinding', target, actor, makeContext());
    expect(result).toBe('deny');
  });

  it('institutionalRole_cannotWriteEvidence', () => {
    /**
     * INV-024: Institutional roles (pfi_analyst, union_ta, etc.) are read-only
     * on cooperative source records. Attempting AddEvidence must return 'deny'.
     */
    const actor = makeActor({
      platformRoles: ['pfi_analyst'],
      appointments: [],
      capacities: [],
    });
    const target = makeTarget('ev-003', 'EvidenceVersion', ORG_A);
    const result = decide('AddEvidence', target, actor, makeContext());
    expect(result).toBe('deny');
  });

  it('revokedCapacity_isNoLongerEffective', () => {
    /**
     * A capacity with activeTo in the past (before context.now) is expired/revoked.
     * decide('RecordFinding', ...) with an expired capacity must return 'deny'.
     */
    const actor = makeActor({
      capacities: [
        { type: 'internal_verifier', tenantId: ORG_A, activeFrom: PAST, activeTo: '2024-01-01T00:00:00Z' }, // expired before NOW
      ],
    });
    const target = makeTarget('ev-004', 'EvidenceVersion', ORG_A);
    const result = decide('RecordFinding', target, actor, makeContext(NOW)); // NOW is 2024-06-01
    expect(result).toBe('deny');
  });

  it('delegation_extendsCapacity', () => {
    /**
     * A delegation granting acting_officer within scope and before expiry
     * allows an action that would otherwise be denied.
     * The delegatee can approve minutes (normally only Chair/Vice/Sec/Treas).
     */
    const actor = makeActor({
      appointments: [], // no officer appointment
      capacities: [],
      delegations: [
        {
          type: 'acting_officer',
          tenantId: ORG_A,
          position: 'chairperson',
          activeFrom: PAST,
          activeTo: FUTURE,
        },
      ],
    });
    const target = makeTarget('meeting-001', 'Minutes', ORG_A);
    const result = decide('ApproveMinutes', target, actor, makeContext());
    expect(result).toBe('allow');
  });
});

