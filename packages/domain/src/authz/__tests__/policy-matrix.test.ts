import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decide } from '../policy-engine.js';
import type { ActorContext, PolicyTarget } from '../policy-engine.js';

const NOW = '2026-11-17T12:00:00Z';
const BEFORE = '2026-11-17T00:00:00Z';
const AFTER = '2026-11-18T00:00:00Z';
const matrixPath = resolve(process.cwd(), '../../evidence/phase1/wp2.1/phase1-authorization-policy-matrix.json');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as {
  actor_classes: Array<{ id: string; kind: string }>;
  actions: Array<{
    id: string;
    resource: string;
    allowed_actor_classes: string[];
    conditional_actor_classes: Record<string, string>;
    denied_actor_classes: string[];
  }>;
};
const target: PolicyTarget = { id: 'org-a', type: 'organization_capacity', tenantId: 'org-a', organizationId: 'org-a' };

function actor(position?: string): ActorContext {
  return {
    userId: 'actor-1',
    tenantId: 'org-a',
    platformRoles: [],
    appointments: position ? [{ position, tenantId: 'org-a', organizationId: 'org-a', activeFrom: BEFORE, activeTo: AFTER }] : [],
    capacities: [],
    delegations: [],
  };
}

describe('WP2.1 policy default-deny red cases', () => {
  it('denies an unregistered action', () => {
    expect(decide('UnknownPolicyAction', target, actor('chairperson'), { now: NOW })).toBe('deny');
  });

  it('denies a grant request with an unregistered capacity type', () => {
    expect(decide('GrantCapacity:made_up_capacity', target, actor('chairperson'), { now: NOW })).toBe('deny');
  });

  it('denies a Secretary attempting a capacity revocation', () => {
    expect(decide('RevokeCapacity:internal_verifier', target, actor('secretary'), { now: NOW })).toBe('deny');
  });
});

describe('WP2.1 policy boundaries', () => {
  const chair = actor('chairperson');
  const grant = { type: 'capacity.grant', capacityType: 'field_agent', granteeUserId: 'field-1', activeFrom: NOW, activeTo: '2026-11-18T12:00:00Z' } as const;

  it('denies tenant and same-tenant organization mismatches', () => {
    expect(decide(grant, { ...target, tenantId: 'tenant-b' }, chair, { now: NOW })).toBe('deny');
    const wrongOrganization = { ...chair, appointments: [{ ...chair.appointments[0]!, organizationId: 'org-b' }] };
    expect(decide(grant, target, wrongOrganization, { now: NOW })).toBe('deny');
  });

  it('applies the half-open authority and grant intervals at equality boundaries', () => {
    const notYetActive = { ...chair, appointments: [{ ...chair.appointments[0]!, activeFrom: NOW }] };
    expect(decide(grant, target, notYetActive, { now: BEFORE })).toBe('deny');
    expect(decide(grant, target, chair, { now: NOW })).toBe('allow');
    expect(decide(grant, target, chair, { now: grant.activeTo })).toBe('deny');
    expect(decide({ ...grant, activeTo: NOW }, target, chair, { now: NOW })).toBe('deny');
    expect(decide({ ...grant, activeTo: grant.activeFrom }, target, chair, { now: BEFORE })).toBe('deny');
  });

  it('denies expired officer authority and malformed authority rows', () => {
    const expired = actor('chairperson');
    const expiredActor = { ...expired, appointments: [{ ...expired.appointments[0]!, activeTo: NOW }] };
    expect(decide(grant, target, expiredActor, { now: NOW })).toBe('deny');
    const malformed = { ...chair, appointments: [{ ...chair.appointments[0]!, activeTo: 'not-a-time' }] };
    expect(decide(grant, target, malformed, { now: NOW })).toBe('deny');
  });

  it('requires programme-manager persisted cohort scope for TA delegation', () => {
    const taTarget = { id: 'cohort-1', type: 'cohort_ta_delegation', tenantId: 'programme-tenant', cohortId: 'cohort-1' };
    const taAction = { type: 'ta_scope.grant', delegateeUserId: 'ta-1', cohortId: 'cohort-1', activeFrom: NOW, activeTo: '2026-11-18T12:00:00Z' } as const;
    const manager = { ...actor(), tenantId: 'programme-tenant', platformRoles: ['programme_manager'], managedCohortIds: ['cohort-1'] };
    expect(decide(taAction, taTarget, manager, { now: NOW })).toBe('allow');
    expect(decide(taAction, taTarget, { ...manager, managedCohortIds: [] }, { now: NOW })).toBe('deny');
    expect(decide(taAction, { ...taTarget, cohortId: 'cohort-2' }, manager, { now: NOW })).toBe('deny');
  });

  it('denies institutional roles before cooperative officer authority', () => {
    const institutionalChair = { ...chair, platformRoles: ['ta'] };
    expect(decide(grant, target, institutionalChair, { now: NOW })).toBe('deny');
  });
});

describe('WP2.1 canonical matrix decisions', () => {
  for (const actionRow of matrix.actions) {
    const action = actionRow.id === 'capacity.grant'
      ? { type: 'capacity.grant' as const, capacityType: 'internal_verifier' as const, granteeUserId: 'grantee', activeFrom: NOW, activeTo: AFTER }
      : actionRow.id === 'capacity.revoke'
        ? { type: 'capacity.revoke' as const, capacityType: 'internal_verifier' as const, granteeUserId: 'grantee' }
        : actionRow.id === 'ta_scope.grant'
          ? { type: 'ta_scope.grant' as const, delegateeUserId: 'delegatee', cohortId: 'cohort-a', activeFrom: NOW, activeTo: AFTER }
          : { type: 'ta_scope.revoke' as const, delegateeUserId: 'delegatee', cohortId: 'cohort-a' };
    const resourceTarget: PolicyTarget = actionRow.resource === 'organization_capacity'
      ? target
      : { id: 'cohort-a', type: 'cohort_ta_delegation', tenantId: 'org-a', cohortId: 'cohort-a' };

    for (const actorClass of matrix.actor_classes) {
      it(`${actionRow.id} decision row: ${actorClass.id}`, () => {
        const withDelegation = actionRow.conditional_actor_classes[actorClass.id] !== undefined;
        const actorContext = actor(actorClass.kind === 'position' ? actorClass.id : undefined);
        const contextualActor: ActorContext = {
          ...actorContext,
          platformRoles: actorClass.kind === 'platform_role' || actorClass.kind === 'institutional_role' ? [actorClass.id] : [],
          delegations: withDelegation
            ? [{ type: 'acting_officer', tenantId: 'org-a', organizationId: 'org-a', position: 'chairperson', activeFrom: BEFORE, activeTo: AFTER }]
            : [],
          managedCohortIds: actorClass.id === 'programme_manager' ? ['cohort-a'] : [],
          assistedEnrollmentSessions: actorClass.id === 'platform_enroller'
            ? [{ id: 'enrol-1', tenantId: 'org-a', organizationId: 'org-a', activeFrom: BEFORE, activeTo: AFTER, representativePresent: true, grantDecisionRecorded: true }]
            : [],
        };
        const expected = actionRow.allowed_actor_classes.includes(actorClass.id)
          || withDelegation
          || (actorClass.id === 'platform_enroller' && actionRow.id === 'capacity.grant')
          ? 'allow'
          : 'deny';
        expect(decide(action, resourceTarget, contextualActor, { now: NOW })).toBe(expected);
      });
    }
  }
});
