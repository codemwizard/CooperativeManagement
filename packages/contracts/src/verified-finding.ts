import { z } from 'zod';

export const verificationOutcomeSchema = z.enum([
  'supports_claim',
  'does_not_support_claim',
  'inconclusive',
]);

export const verifiedFindingProjectionSchema = z.object({
  findingId: z.string().uuid(),
  evidenceItemId: z.string().uuid(),
  evidenceVersionId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  outcome: verificationOutcomeSchema.nullable(),
  verified: z.boolean(),
  verifierName: z.string().nullable(),
  verifierOffice: z.string().nullable(),
  scope: z.string().nullable(),
  assuranceLabel: z.literal('cooperative-internal').nullable(),
  findingAt: z.string().datetime(),
  officeEffectiveAt: z.string().datetime().nullable(),
});

export const verifiedFindingListSchema = z.array(verifiedFindingProjectionSchema);
export type VerifiedFindingProjection = z.infer<typeof verifiedFindingProjectionSchema>;
