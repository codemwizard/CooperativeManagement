import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { COMMAND_CANONICALIZATION_VERSION } from '@symphony/contracts';
import {
  COMMAND_DIGEST_CANONICALIZATION_VERSION,
  computeCommandDigest,
  semanticCommandCanonicalJson,
  verifyCommandDigest,
  type CommandDigestInput,
} from '../command-digest.js';
import type { CommandDigestKeyProvider } from '../ports.js';

const command: CommandDigestInput = {
  tenant_id: 'tenant-01',
  actor_id: 'actor-01',
  command_id: 'command-01',
  command_type: 'membership.update',
  command_schema_version: 1,
  expected_aggregate_version: 7,
  payload: { name: 'A cooperative', active: true },
  occurred_at: '2030-01-01T00:00:00Z',
  device_id: 'device-01',
  request_id: 'request-01',
  trace_id: 'trace-01',
  correlation_id: 'correlation-01',
};

class TestDigestKeyProvider implements CommandDigestKeyProvider {
  readonly requestedVersions: string[] = [];
  constructor(private readonly active: string, private readonly keys: Readonly<Record<string, string>>) {}
  activeVersion(): string { return this.active; }
  async hmac(version: string, canonicalBytes: Uint8Array): Promise<Uint8Array> {
    this.requestedVersions.push(version);
    const key = this.keys[version];
    if (!key) throw new Error(`missing digest key version ${version}`);
    return createHmac('sha256', key).update(canonicalBytes).digest();
  }
}

describe('WP1.1 command semantic digest', () => {
  it('keeps the digest implementation and persisted receipt version labels aligned', () => {
    expect(COMMAND_DIGEST_CANONICALIZATION_VERSION).toBe(COMMAND_CANONICALIZATION_VERSION);
  });

  it('matches the approved RFC 8785 canonical semantic-envelope vector', () => {
    expect(semanticCommandCanonicalJson(command)).toBe(
      '{"actor_id":"actor-01","command_schema_version":1,"command_type":"membership.update","expected_aggregate_version":7,"payload":{"active":true,"name":"A cooperative"},"tenant_id":"tenant-01"}',
    );
  });

  it('excludes lookup and transport metadata while retaining semantic changes', () => {
    expect(semanticCommandCanonicalJson({ ...command, command_id: 'another-id', occurred_at: '2031-01-01T00:00:00Z' }))
      .toBe(semanticCommandCanonicalJson(command));
    expect(semanticCommandCanonicalJson({ ...command, payload: { name: 'Changed', active: true } }))
      .not.toBe(semanticCommandCanonicalJson(command));
  });

  it('uses the active key version and returns a 32-byte HMAC digest', async () => {
    const provider = new TestDigestKeyProvider('wp0-fixture-v1', { 'wp0-fixture-v1': 'wp0-contract-test-key-v1' });
    const result = await computeCommandDigest(command, provider);
    expect(result.key_version).toBe('wp0-fixture-v1');
    expect(Buffer.from(result.semantic_digest).toString('hex'))
      .toBe('e0c4a76ac4635a61968674d91793825452fa0efa1a163b72beaadd6ff0bb3f8e');
    expect(result.semantic_digest.byteLength).toBe(32);
  });

  it('replays with the stored historical key version and fails closed when it is unavailable', async () => {
    const provider = new TestDigestKeyProvider('wp0-fixture-v1', {
      'wp0-fixture-v1': 'wp0-contract-test-key-v1',
      'wp0-fixture-v0': 'old-fixture-key-v0',
    });
    const historical = await computeCommandDigest(command, provider, 'wp0-fixture-v0');
    expect(Buffer.from(historical.semantic_digest).toString('hex'))
      .toBe('11177c1577e76e051a9914100c88b166205a00bf86d54d956f613b3900a5bcbb');
    expect(await verifyCommandDigest(command, provider, 'wp0-fixture-v0', historical.semantic_digest)).toBe(true);
    expect(provider.requestedVersions.at(-1)).toBe('wp0-fixture-v0');
    expect(await verifyCommandDigest(command, provider, 'wp0-fixture-v0', new Uint8Array(32))).toBe(false);
    await expect(verifyCommandDigest(command, new TestDigestKeyProvider('active', {}), 'retired', historical.semantic_digest))
      .rejects.toThrow(/missing digest key version/);
  });

  it('rejects invalid JSON values and unavailable canonicalization versions', async () => {
    expect(() => semanticCommandCanonicalJson({ ...command, payload: { value: Number.POSITIVE_INFINITY } }))
      .toThrow();
    expect(() => semanticCommandCanonicalJson({ ...command, payload: { value: undefined } } as unknown as CommandDigestInput))
      .toThrow();
    expect(() => semanticCommandCanonicalJson({ ...command, expected_aggregate_version: undefined } as unknown as CommandDigestInput))
      .toThrow(/must be omitted/);
    expect(() => semanticCommandCanonicalJson({ ...command, unexpected: 'field' } as unknown as CommandDigestInput))
      .toThrow();
    expect(() => semanticCommandCanonicalJson({ ...command, canonicalization_version: 'retired' } as unknown as CommandDigestInput))
      .toThrow(/canonicalization version/);
  });
});
