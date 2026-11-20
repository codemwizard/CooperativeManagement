import { z } from 'zod';

const uuid = z.string().uuid();
const authorityCode = z.enum([
  'member', 'chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'director',
  'committee_chair', 'committee_member', 'internal_verifier', 'field_agent', 'delegate',
  'acting_officer', 'programme_manager', 'programme_manager_ta_delegation_scope',
  'union_ta', 'self_enroller',
]);

export const workspaceAuthorityFactSchema = z.object({
  sourceId: uuid,
  kind: z.enum(['membership', 'appointment', 'capacity', 'platform_role', 'institutional_role', 'enrolment']),
  authority: authorityCode,
  organizationId: uuid.nullable(),
  organizationName: z.string().min(1).max(240).nullable(),
  organizationKind: z.enum(['cooperative', 'union', 'federation']).nullable(),
  personId: uuid.nullable(),
  membershipId: uuid.nullable(),
  scopeOrganizationIds: z.array(uuid),
  scopeMode: z.enum(['organization', 'tenant_organization_projections', 'delegated_organizations', 'enrolment']),
  sourceRef: z.string().max(500).nullable(),
  effectiveAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const workspaceContextFactsSchema = z.object({
  tenantId: uuid,
  userId: uuid,
  resolvedAt: z.string().datetime({ offset: true }),
  personId: uuid.nullable(),
  facts: z.array(workspaceAuthorityFactSchema),
}).strict();

export type WorkspaceAuthorityFactContract = z.infer<typeof workspaceAuthorityFactSchema>;
export type WorkspaceContextFactsContract = z.infer<typeof workspaceContextFactsSchema>;
