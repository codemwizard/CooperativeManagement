import { z } from 'zod';
import { capacityDelegationCommandRequestSchema, capacityDelegationCommandResultSchema } from './capacity-delegation-command.js';

export const commandHttpRequestSchema = capacityDelegationCommandRequestSchema;

const commandHttpSuccessSchema = z.object({
  ok: z.literal(true),
  aggregateVersion: z.number().int().nonnegative(),
  eventIds: z.array(z.string().uuid()),
  data: capacityDelegationCommandResultSchema,
  replayed: z.boolean(),
}).strict();

const commandHttpFailureSchema = z.discriminatedUnion('code', [
  z.object({ ok: z.literal(false), code: z.literal('NOT_AUTHORIZED'), replayed: z.literal(false) }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('IDEMPOTENCY_KEY_REUSED'), replayed: z.literal(false) }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('VERSION_CONFLICT'), replayed: z.boolean(), reconciliationId: z.string().uuid().optional() }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('DOMAIN_CONFLICT'), replayed: z.boolean() }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('COMMAND_TEMPORARILY_UNAVAILABLE'), retryable: z.literal(true) }).strict(),
  z.object({ ok: z.literal(false), code: z.literal('INTERNAL_ERROR') }).strict(),
]);

export const commandHttpResponseSchema = z.union([commandHttpSuccessSchema, commandHttpFailureSchema]);
export type CommandHttpRequest = z.infer<typeof commandHttpRequestSchema>;
export type CommandHttpResponse = z.infer<typeof commandHttpResponseSchema>;
