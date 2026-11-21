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
import type { ActorContext, PolicyTarget } from '../policy-engine.js';

// ─── Helper factories ──────────────────────────────────────────────────────────

const ORG_A = 'org-a-uuid';
const NOW = '2026-11-17T12:00:00Z';
const FUTURE = '2027-01-01T00:00:00Z';
const PAST = '2026-01-01T00:00:00Z';

function makeTarget(organizationId = ORG_A): PolicyTarget {
  return { id: organizationId, type: 'organization_capacity', tenantId: ORG_A, organizationId };
}

function makeActor(overrides: Partial<ActorContext> = {}): ActorContext {
  return { userId: 'user-default', tenantId: ORG_A, platformRoles: [], appointments: [], capacities: [], delegations: [], ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEngine', () => {
  it('grantCapacity_IFV_allowedByChairperson', () => {
    /**
     * A user appointed as Chairperson may grant the internal_verifier capacity.
     * decide('GrantCapacity:internal_verifier', ..., actor) must return 'allow'.
     */
    const actor = makeActor({
      appointments: [{ position: 'chairperson', tenantId: ORG_A, organizationId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    const target = makeTarget();
    const result = decide({ type: 'capacity.grant', capacityType: 'internal_verifier', granteeUserId: 'ifv-1', activeFrom: NOW, activeTo: FUTURE }, target, actor, { now: NOW });
    expect(result).toBe('allow');
  });

  it('grantCapacity_IFV_deniedToSecretary', () => {
    /**
     * A Secretary (without Chairperson or Vice-Chairperson appointment) may NOT grant IFV.
     * decide('GrantCapacity:internal_verifier', ...) must return 'deny'.
     */
    const actor = makeActor({
      appointments: [{ position: 'secretary', tenantId: ORG_A, organizationId: ORG_A, activeFrom: PAST, activeTo: FUTURE }],
    });
    const target = makeTarget();
    const result = decide({ type: 'capacity.grant', capacityType: 'internal_verifier', granteeUserId: 'ifv-1', activeFrom: NOW, activeTo: FUTURE }, target, actor, { now: NOW });
    expect(result).toBe('deny');
  });

  it('requires the organization named by the active capacity', () => {
    const actor = makeActor({ capacities: [{ type: 'field_agent', tenantId: ORG_A, organizationId: 'org-other', activeFrom: PAST, activeTo: FUTURE }] });
    expect(decide({ type: 'capacity.revoke', capacityType: 'field_agent', granteeUserId: 'field-1' }, makeTarget(), actor, { now: NOW })).toBe('deny');
  });

  it('requires an active acting-officer delegation for the chair or vice-chair office', () => {
    const actor = makeActor({ delegations: [{ type: 'acting_officer', tenantId: ORG_A, organizationId: ORG_A, position: 'chairperson', activeFrom: PAST, activeTo: FUTURE }] });
    expect(decide({ type: 'capacity.revoke', capacityType: 'delegate', granteeUserId: 'delegate-1' }, makeTarget(), actor, { now: NOW })).toBe('allow');
  });

  it('denies a platform enroller whose assisted session lacks representative decision evidence', () => {
    const actor = makeActor({ platformRoles: ['platform_enroller'], assistedEnrollmentSessions: [{ id: 'session-1', tenantId: ORG_A, organizationId: ORG_A, activeFrom: PAST, activeTo: FUTURE, representativePresent: false, grantDecisionRecorded: true }] });
    expect(decide({ type: 'capacity.grant', capacityType: 'internal_verifier', granteeUserId: 'ifv-1', activeFrom: NOW, activeTo: FUTURE }, makeTarget(), actor, { now: NOW })).toBe('deny');
  });

  it('requires the command decision to identify the exact persisted assisted session', () => {
    const actor = makeActor({
      platformRoles: ['platform_enroller'],
      assistedEnrollmentSessions: [{ id: 'session-1', tenantId: ORG_A, organizationId: ORG_A, activeFrom: PAST, activeTo: FUTURE, representativePresent: true, grantDecisionRecorded: true }],
    });
    const command = { type: 'capacity.grant', capacityType: 'internal_verifier', granteeUserId: 'ifv-1', activeFrom: NOW, activeTo: FUTURE,
      assistedEnrolment: { sessionId: 'session-1', representativeDecision: 'approve_internal_verifier' } };
    expect(decide(command, makeTarget(), actor, { now: NOW })).toBe('allow');
    expect(decide({ ...command, assistedEnrolment: { ...command.assistedEnrolment, sessionId: 'other-session' } }, makeTarget(), actor, { now: NOW })).toBe('deny');
    expect(decide({ ...command, assistedEnrolment: { ...command.assistedEnrolment, representativeDecision: 'declined' } }, makeTarget(), actor, { now: NOW })).toBe('deny');
    expect(decide({ ...command, capacityType: 'field_agent' }, makeTarget(), actor, { now: NOW })).toBe('deny');
  });
});

