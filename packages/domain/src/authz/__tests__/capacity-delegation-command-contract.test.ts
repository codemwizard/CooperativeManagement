import { describe, expect, it } from 'vitest';
import {
  capacityDelegationCommandRequestSchema,
  delegateTaScopePayloadSchema,
  grantCapacityPayloadSchema,
} from '@symphony/contracts';

const UUID = '6e5a15bb-e756-4fd5-b9a7-68ce0a222703';
const UUID2 = '3f606a96-3a54-436d-a45c-26b292dcb307';

describe('D-19 capacity and TA command schemas', () => {
  it('rejects generic acting_officer grants and requires delegate source provenance', () => {
    const base = { capacityGrantId: UUID, targetUserId: UUID2, activeFrom: '2026-11-21T00:00:00Z', activeTo: '2026-12-21T00:00:00Z' };
    expect(grantCapacityPayloadSchema.safeParse({ ...base, capacityType: 'acting_officer' }).success).toBe(false);
    expect(grantCapacityPayloadSchema.safeParse({ ...base, capacityType: 'delegate' }).success).toBe(false);
    expect(grantCapacityPayloadSchema.safeParse({ ...base, capacityType: 'delegate', sourceRef: 'resolution-17' }).success).toBe(true);
    expect(grantCapacityPayloadSchema.safeParse({ ...base, capacityType: 'internal_verifier', untrustedRole: 'chairperson' }).success).toBe(false);
  });

  it('strictly distinguishes TA grant and revoke payloads and rejects invalid intervals', () => {
    expect(delegateTaScopePayloadSchema.safeParse({
      delegationId: UUID, operation: 'grant', delegateeUserId: UUID2,
      unionOrganizationId: UUID2, agreementRef: 'agreement-1',
      activeFrom: '2026-11-21T00:00:00Z', activeTo: '2026-12-21T00:00:00Z',
    }).success).toBe(true);
    expect(delegateTaScopePayloadSchema.safeParse({ delegationId: UUID, operation: 'revoke' }).success).toBe(true);
    expect(delegateTaScopePayloadSchema.safeParse({
      delegationId: UUID, operation: 'revoke', activeTo: '2026-12-21T00:00:00Z',
    }).success).toBe(false);
  });

  it('binds a strict command request to one cooperative target and supports creation preconditions', () => {
    const result = capacityDelegationCommandRequestSchema.safeParse({
      commandId: UUID, organizationId: UUID2, occurredAt: '2026-11-21T00:00:00Z',
      expectedVersion: null, schemaVersion: 1, type: 'RevokeCapacity', payload: { capacityGrantId: UUID },
    });
    expect(result.success).toBe(true);
    expect(capacityDelegationCommandRequestSchema.safeParse({
      commandId: UUID, organizationId: UUID2, occurredAt: '2026-11-21T00:00:00Z',
      expectedVersion: null, schemaVersion: 1, type: 'RevokeCapacity', payload: { capacityGrantId: UUID },
      tenantId: UUID,
    }).success).toBe(false);
  });

  it('requires a typed assisted-session and representative decision for the IFV exception', () => {
    const assisted = { capacityGrantId: UUID, targetUserId: UUID2, capacityType: 'internal_verifier',
      activeFrom: '2026-11-21T00:00:00Z', activeTo: '2026-12-21T00:00:00Z', assistedEnrolment: {
      sessionId: '9a8c90a7-9a43-4d9d-bdaa-2c8b4263810a', representativeDecision: 'approve_internal_verifier',
    } };
    expect(grantCapacityPayloadSchema.safeParse(assisted).success).toBe(true);
    expect(grantCapacityPayloadSchema.safeParse({ ...assisted, capacityType: 'field_agent' }).success).toBe(false);
    expect(grantCapacityPayloadSchema.safeParse({ ...assisted, assistedEnrolment: { ...assisted.assistedEnrolment, representativeDecision: 'declined' } }).success).toBe(false);
    expect(grantCapacityPayloadSchema.safeParse({ ...assisted, assistedEnrolment: { ...assisted.assistedEnrolment, untrusted: true } }).success).toBe(false);
  });
});
