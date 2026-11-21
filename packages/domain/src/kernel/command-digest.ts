import { timingSafeEqual } from 'node:crypto';
import { canonicalizeEx } from 'json-canonicalize';
import { z } from 'zod';
import type { CommandDigestKeyProvider } from './ports.js';

export const COMMAND_DIGEST_CANONICALIZATION_VERSION = 'jcs-rfc8785-v1' as const;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface CommandDigestInput {
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly command_id: string;
  readonly command_type: string;
  readonly command_schema_version: number;
  readonly organization_id?: string;
  readonly expected_aggregate_version?: number | null;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly canonicalization_version?: typeof COMMAND_DIGEST_CANONICALIZATION_VERSION;
  readonly occurred_at?: string;
  readonly device_id?: string;
  readonly request_id?: string;
  readonly trace_id?: string;
  readonly correlation_id?: string;
}

export interface CommandDigest {
  readonly key_version: string;
  readonly canonicalization_version: typeof COMMAND_DIGEST_CANONICALIZATION_VERSION;
  readonly semantic_digest: Uint8Array;
}

const inputSchema = z.object({
  tenant_id: z.string().min(1),
  actor_id: z.string().min(1),
  command_id: z.string().min(1),
  command_type: z.string().min(1),
  command_schema_version: z.number().int().safe().positive(),
  organization_id: z.string().uuid().optional(),
  expected_aggregate_version: z.number().int().safe().nonnegative().nullable().optional(),
  payload: z.record(z.unknown()),
  canonicalization_version: z.literal(COMMAND_DIGEST_CANONICALIZATION_VERSION).optional(),
  occurred_at: z.string().optional(),
  device_id: z.string().optional(),
  request_id: z.string().optional(),
  trace_id: z.string().optional(),
  correlation_id: z.string().optional(),
}).strict();

function assertWellFormedUnicode(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError(`${path} contains a lone high surrogate`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(`${path} contains a lone low surrogate`);
    }
  }
}

function assertJsonValue(value: unknown, path: string): asserts value is JsonValue {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    assertWellFormedUnicode(value, path);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new TypeError(`${path}[${index}] is an array hole`);
      assertJsonValue(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} is not a JSON value`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must be a plain JSON object`);
  if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError(`${path} contains symbol keys`);
  for (const key of Object.keys(value)) {
    assertWellFormedUnicode(key, `${path} key`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new TypeError(`${path}.${key} must be a data property`);
    assertJsonValue(descriptor.value, `${path}.${key}`);
  }
}

/** Validates the complete accepted envelope, then selects only WP0.1 semantic fields. */
export function semanticCommandEnvelope(input: CommandDigestInput): Readonly<Record<string, JsonValue>> {
  if (input.canonicalization_version !== undefined
    && input.canonicalization_version !== COMMAND_DIGEST_CANONICALIZATION_VERSION) {
    throw new Error(`unsupported canonicalization version ${String(input.canonicalization_version)}`);
  }
  if (Object.hasOwn(input, 'expected_aggregate_version') && input.expected_aggregate_version === undefined) {
    throw new TypeError('expected_aggregate_version must be omitted or a JSON number/null');
  }
  const parsed = inputSchema.parse(input);
  assertJsonValue(parsed.payload, 'payload');
  const semantic: Record<string, JsonValue> = {
    tenant_id: parsed.tenant_id,
    actor_id: parsed.actor_id,
    command_type: parsed.command_type,
    command_schema_version: parsed.command_schema_version,
  };
  if (parsed.organization_id !== undefined) semantic.organization_id = parsed.organization_id;
  if (Object.hasOwn(parsed, 'expected_aggregate_version')) {
    const version = parsed.expected_aggregate_version;
    if (version === undefined) throw new TypeError('expected_aggregate_version must be omitted or a JSON number/null');
    semantic.expected_aggregate_version = version;
  }
  semantic.payload = parsed.payload as Readonly<Record<string, JsonValue>>;
  return semantic;
}

/** RFC 8785 canonical JSON for the exact semantic projection; transport metadata is excluded. */
export function semanticCommandCanonicalJson(input: CommandDigestInput): string {
  return canonicalizeEx(semanticCommandEnvelope(input), { strictUndefined: true });
}

export async function computeCommandDigest(
  input: CommandDigestInput,
  keyProvider: CommandDigestKeyProvider,
  keyVersion = keyProvider.activeVersion(),
): Promise<CommandDigest> {
  if (keyVersion.length === 0) throw new TypeError('digest key version must not be empty');
  const canonicalBytes = new TextEncoder().encode(semanticCommandCanonicalJson(input));
  const digest = await keyProvider.hmac(keyVersion, canonicalBytes);
  if (!(digest instanceof Uint8Array) || digest.byteLength !== 32) {
    throw new TypeError('CommandDigestKeyProvider must return a 32-byte HMAC-SHA-256 digest');
  }
  return {
    key_version: keyVersion,
    canonicalization_version: COMMAND_DIGEST_CANONICALIZATION_VERSION,
    semantic_digest: digest,
  };
}

export async function verifyCommandDigest(
  input: CommandDigestInput,
  keyProvider: CommandDigestKeyProvider,
  storedKeyVersion: string,
  storedDigest: Uint8Array,
): Promise<boolean> {
  if (storedDigest.byteLength !== 32) return false;
  const recalculated = await computeCommandDigest(input, keyProvider, storedKeyVersion);
  return timingSafeEqual(recalculated.semantic_digest, storedDigest);
}
