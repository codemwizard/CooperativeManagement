import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createCommandReceiptSchema,
  createCommandResultSchema,
  terminalConflictResultSchema,
  type CommandReceipt,
  type CommandResult,
} from '@symphony/contracts';

const validResult = {
  schema_version: 'command-result-v1',
  ok: true,
  aggregate_version: 2,
  event_ids: ['61ec46f1-4e54-4eb2-a8e2-9b44750c9178'],
  data: { accepted: true },
} as const;
const testDataSchema = z.object({ accepted: z.boolean() }).strict();
const strictCommandResultSchema = createCommandResultSchema(testDataSchema);
const strictCommandReceiptSchema = createCommandReceiptSchema({ 'membership.update': testDataSchema });

const validReceipt: CommandReceipt = {
  tenant_id: 'dd06a91e-1531-4ea4-ab19-8c30f84f0ca9',
  command_id: 'e59b8caf-0c9c-4d17-a155-627f0e3db961',
  actor_user_id: '9bfa4aa7-e70f-4e60-ab51-0adce2c74d44',
  command_type: 'membership.update',
  command_schema_version: 'membership.update-v1',
  canonicalization_version: 'jcs-rfc8785-v1',
  digest_key_version: 'test-key-v1',
  semantic_digest: new Uint8Array(32),
  result_classification: 'committed_success',
  result_schema_version: 'command-result-v1',
  safe_result: validResult,
  recorded_at: '2026-11-08T10:00:00.000Z',
};

describe('WP1.1 durable command receipt contract', () => {
  it('accepts a tenant-scoped receipt with a versioned safe result', () => {
    expect(strictCommandReceiptSchema.safeParse(validReceipt).success).toBe(true);
  });

  it('uses a strict success variant with non-negative version and UUID event ids', () => {
    expect(strictCommandResultSchema.safeParse(validResult).success).toBe(true);
    expect(strictCommandResultSchema.safeParse({ ...validResult, aggregate_version: -1 }).success).toBe(false);
    expect(strictCommandResultSchema.safeParse({ ...validResult, event_ids: ['not-a-uuid'] }).success).toBe(false);
    expect(strictCommandResultSchema.safeParse({ ...validResult, detail: 'internal policy reason' }).success).toBe(false);
    expect(strictCommandResultSchema.safeParse({ ...validResult, data: { accepted: true, nrc: 'private' } }).success).toBe(false);
  });

  it('accepts only the terminal VERSION_CONFLICT result shape', () => {
    const stale = {
      schema_version: 'command-result-v1',
      ok: false,
      code: 'VERSION_CONFLICT',
      aggregate_id: 'afa9d68b-9758-4263-a6cf-b2774f030f88',
      expected_version: 3,
      observed_version: 4,
      reconciliation_id: '784ec8a1-0b1b-4176-93a6-7d8c239c2f92',
    };
    expect(terminalConflictResultSchema.safeParse(stale).success).toBe(true);
    expect(terminalConflictResultSchema.safeParse({ ...stale, detail: 'stale internal state' }).success).toBe(false);
    expect(terminalConflictResultSchema.safeParse({ ...stale, code: 'UNAUTHORIZED' }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({
      ...validReceipt,
      result_classification: 'terminal_rejection',
      safe_result: stale,
    }).success).toBe(true);
    expect(strictCommandReceiptSchema.safeParse({
      ...validReceipt,
      result_classification: 'committed_success',
      safe_result: stale,
    }).success).toBe(false);
  });

  it('rejects unkeyed or wrong-length digests and unsupported contract versions', () => {
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, semantic_digest: new Uint8Array(31) }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, canonicalization_version: 'unknown' }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, result_schema_version: 'unknown' }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, result_classification: 'terminal_rejection' }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, command_type: 'unregistered.command' }).success).toBe(false);
  });

  it('rejects payload and unapproved receipt fields rather than persisting request material', () => {
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, payload: { nrc: 'private' } }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, device_id: 'device' }).success).toBe(false);
    expect(strictCommandReceiptSchema.safeParse({ ...validReceipt, expected_version: 1 }).success).toBe(false);
  });

  it('exposes stable snake-case types without widening the result union', () => {
    const result: CommandResult = validResult;
    const receipt: CommandReceipt = { ...validReceipt, safe_result: result };
    expect(receipt.tenant_id).toBe(validReceipt.tenant_id);
  });
});
