import { z } from 'zod';

const instantSchema = z.string().datetime({ offset: true });
const capacityTypeSchema = z.enum(['internal_verifier', 'field_agent', 'delegate']);

export const grantCapacityPayloadSchema = z.object({
  capacityGrantId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  capacityType: capacityTypeSchema,
  activeFrom: instantSchema,
  activeTo: instantSchema,
  sourceRef: z.string().trim().min(1).max(256).optional(),
  assistedEnrolment: z.object({
    sessionId: z.string().uuid(),
    representativeDecision: z.literal('approve_internal_verifier'),
  }).strict().optional(),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.activeFrom) >= Date.parse(value.activeTo)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['activeTo'], message: 'activeTo must be later than activeFrom' });
  }
  if (value.capacityType === 'delegate' && !value.sourceRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceRef'], message: 'delegate capacity requires a source reference' });
  }
  if (value.assistedEnrolment && value.capacityType !== 'internal_verifier') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['assistedEnrolment'], message: 'assisted-enrolment authority is only valid for internal_verifier' });
  }
});

export const revokeCapacityPayloadSchema = z.object({
  capacityGrantId: z.string().uuid(),
}).strict();

const delegateTaScopeGrantPayloadBaseSchema = z.object({
  delegationId: z.string().uuid(),
  operation: z.literal('grant'),
  delegateeUserId: z.string().uuid(),
  unionOrganizationId: z.string().uuid(),
  agreementRef: z.string().trim().min(1).max(256),
  activeFrom: instantSchema,
  activeTo: instantSchema,
}).strict();

export const delegateTaScopeGrantPayloadSchema = delegateTaScopeGrantPayloadBaseSchema.refine(
  (value) => Date.parse(value.activeFrom) < Date.parse(value.activeTo),
  { path: ['activeTo'], message: 'activeTo must be later than activeFrom' },
);

export const delegateTaScopeRevokePayloadSchema = z.object({
  delegationId: z.string().uuid(),
  operation: z.literal('revoke'),
}).strict();

export const delegateTaScopePayloadSchema = z.discriminatedUnion('operation', [
  delegateTaScopeGrantPayloadBaseSchema,
  delegateTaScopeRevokePayloadSchema,
]);

export const capacityDelegationCommandPayloadSchemas = {
  GrantCapacity: grantCapacityPayloadSchema,
  RevokeCapacity: revokeCapacityPayloadSchema,
  DelegateTaScope: delegateTaScopePayloadSchema,
} as const;

/** Exact registered command payload allowlists retained for stale-command reconciliation. */
export const capacityDelegationCommandReconciliationDataSchemas = capacityDelegationCommandPayloadSchemas;

export type GrantCapacityPayload = z.infer<typeof grantCapacityPayloadSchema>;
export type RevokeCapacityPayload = z.infer<typeof revokeCapacityPayloadSchema>;
export type DelegateTaScopePayload = z.infer<typeof delegateTaScopePayloadSchema>;

export const capacityDelegationCommandResultSchema = z.object({
  operation: z.enum(['granted', 'revoked', 'unchanged']),
  sourceId: z.string().uuid(),
}).strict();

export type CapacityDelegationCommandResult = z.infer<typeof capacityDelegationCommandResultSchema>;

export const capacityDelegationCommandResultDataSchemas = {
  GrantCapacity: capacityDelegationCommandResultSchema,
  RevokeCapacity: capacityDelegationCommandResultSchema,
  DelegateTaScope: capacityDelegationCommandResultSchema,
} as const;

const commandEnvelopeFields = {
  commandId: z.string().uuid(),
  organizationId: z.string().uuid(),
  occurredAt: instantSchema,
  deviceId: z.string().min(1).max(128).optional(),
  expectedVersion: z.number().int().safe().nonnegative().nullable(),
  schemaVersion: z.literal(1),
};

export const capacityDelegationCommandRequestSchema = z.union([
  z.object({ ...commandEnvelopeFields, type: z.literal('GrantCapacity'), payload: grantCapacityPayloadSchema }).strict(),
  z.object({ ...commandEnvelopeFields, type: z.literal('RevokeCapacity'), payload: revokeCapacityPayloadSchema }).strict(),
  z.object({ ...commandEnvelopeFields, type: z.literal('DelegateTaScope'), payload: delegateTaScopePayloadSchema }).strict(),
]);

export type CapacityDelegationCommandRequest = z.infer<typeof capacityDelegationCommandRequestSchema>;

export const capacityDelegationCommandRegistry = {
  GrantCapacity: {
    schemaVersion: 1,
    action: 'capacity.grant',
    aggregateId: (payload: GrantCapacityPayload) => payload.capacityGrantId,
    organizationId: (targetOrganizationId: string) => targetOrganizationId,
  },
  RevokeCapacity: {
    schemaVersion: 1,
    action: 'capacity.revoke',
    aggregateId: (payload: RevokeCapacityPayload) => payload.capacityGrantId,
    organizationId: (targetOrganizationId: string) => targetOrganizationId,
  },
  DelegateTaScope: {
    schemaVersion: 1,
    action: (payload: DelegateTaScopePayload) => payload.operation === 'grant' ? 'ta_scope.grant' : 'ta_scope.revoke',
    aggregateId: (payload: DelegateTaScopePayload) => payload.delegationId,
    organizationId: (targetOrganizationId: string) => targetOrganizationId,
  },
} as const;
