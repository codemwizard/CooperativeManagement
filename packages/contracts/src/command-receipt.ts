import { z } from 'zod';

export const COMMAND_RESULT_SCHEMA_VERSION = 'command-result-v1' as const;
export const COMMAND_CANONICALIZATION_VERSION = 'jcs-rfc8785-v1' as const;

const uuidSchema = z.string().uuid();
const nonNegativeSafeInteger = z.number().int().safe().nonnegative();
const safeDataObject = z.record(z.unknown());

export function createCommandResultSchema<TData extends z.ZodTypeAny>(dataSchema: TData) {
  const success = z.object({
    schema_version: z.literal(COMMAND_RESULT_SCHEMA_VERSION),
    ok: z.literal(true),
    aggregate_version: nonNegativeSafeInteger,
    event_ids: z.array(uuidSchema).readonly(),
    data: dataSchema,
  }).strict();
  return z.discriminatedUnion('ok', [success, terminalConflictResultSchema]);
}

export const terminalConflictResultSchema = z.object({
  schema_version: z.literal(COMMAND_RESULT_SCHEMA_VERSION),
  ok: z.literal(false),
  code: z.literal('VERSION_CONFLICT'),
  aggregate_id: uuidSchema,
  expected_version: nonNegativeSafeInteger,
  observed_version: nonNegativeSafeInteger,
  reconciliation_id: uuidSchema.optional(),
}).strict();

const commandResultBaseSchema = createCommandResultSchema(safeDataObject);
export type CommandResult = z.infer<typeof commandResultBaseSchema>;

const commandReceiptBaseSchema = z.object({
  tenant_id: uuidSchema,
  command_id: uuidSchema,
  actor_user_id: uuidSchema,
  command_type: z.string().min(1).max(200),
  command_schema_version: z.string().min(1).max(100),
  canonicalization_version: z.literal(COMMAND_CANONICALIZATION_VERSION),
  digest_key_version: z.string().min(1).max(100),
  semantic_digest: z.custom<Uint8Array>((value) => value instanceof Uint8Array)
    .refine((value) => value.byteLength === 32, 'semantic_digest must contain exactly 32 bytes'),
  result_classification: z.enum(['committed_success', 'terminal_rejection']),
  result_schema_version: z.literal(COMMAND_RESULT_SCHEMA_VERSION),
  safe_result: commandResultBaseSchema,
  recorded_at: z.string().datetime({ offset: true }),
}).strict();

export type CommandReceipt = z.infer<typeof commandReceiptBaseSchema>;
export type CommandResultDataSchemas = Readonly<Record<string, z.ZodTypeAny>>;

/** Builds a strict receipt validator that requires a result schema for every command type. */
export function createCommandReceiptSchema(dataSchemas: CommandResultDataSchemas) {
  return commandReceiptBaseSchema.superRefine((receipt, context) => {
    const dataSchema = dataSchemas[receipt.command_type];
    if (!dataSchema) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['command_type'], message: 'No result schema is registered for command_type' });
      return;
    }
    if (receipt.safe_result.ok) {
      const parsed = dataSchema.safeParse(receipt.safe_result.data);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          context.addIssue({ ...issue, path: ['safe_result', 'data', ...issue.path] });
        }
      }
      if (receipt.result_classification !== 'committed_success') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['result_classification'], message: 'Success result requires committed_success classification' });
      }
    } else if (receipt.result_classification !== 'terminal_rejection') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['result_classification'], message: 'VERSION_CONFLICT requires terminal_rejection classification' });
    }
  });
}
