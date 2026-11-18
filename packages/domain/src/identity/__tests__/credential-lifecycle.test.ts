import { beforeEach, describe, expect, it } from 'vitest';
import * as argon2 from 'argon2';
import {
  ARGON2ID_PARAMETERS,
  CredentialLifecycleService,
  PASSWORD_BLOCKLIST_VERSION,
  TEMPORARY_CREDENTIAL_LIFETIME_MS,
} from '../credential-lifecycle.js';

class MutableClock {
  constructor(private value = '2026-01-01T00:00:00.000Z') {}
  now(): string { return this.value; }
  set(value: string): void { this.value = value; }
}

describe('CredentialLifecycleService', () => {
  let clock: MutableClock;
  let service: CredentialLifecycleService;

  beforeEach(() => {
    clock = new MutableClock();
    service = new CredentialLifecycleService(clock);
  });

  it('issues a separately identified Argon2id credential with exactly 72 hours and no TTL override', async () => {
    const issued = await service.issueTemporaryCredential();
    expect(issued.credentialId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(issued.plaintext).toHaveLength(43);
    expect(issued.hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(Date.parse(issued.expiresAt) - Date.parse(issued.issuedAt)).toBe(TEMPORARY_CREDENTIAL_LIFETIME_MS);
    expect(ARGON2ID_PARAMETERS).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
  });

  it('verifies the whole temporary secret without consuming it and expires at equality', async () => {
    const issued = await service.issueTemporaryCredential();
    const record = {
      credentialId: issued.credentialId,
      hash: issued.hash,
      issuedAt: issued.issuedAt,
      expiresAt: issued.expiresAt,
    };
    expect(await service.verifyTemporaryCredential(issued.plaintext, record)).toBe('valid');
    expect(await service.verifyTemporaryCredential(`${issued.plaintext}x`, record)).toBe('invalid');
    clock.set(issued.expiresAt);
    expect(await service.verifyTemporaryCredential(issued.plaintext, record)).toBe('expired');
  });

  it('hashes accepted passphrases with unique salts and verifies the full input', async () => {
    const password = '  🐝 correct horse  ';
    const [first, second] = await Promise.all([
      service.hashPermanentPassword(password),
      service.hashPermanentPassword(password),
    ]);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await service.verifyPermanentPassword(password, first)).toBe(true);
    expect(await service.verifyPermanentPassword(password.trim(), first)).toBe(false);
    expect(service.needsPermanentPasswordRehash(first)).toBe(false);

    const legacyHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 1,
      parallelism: 1,
    });
    expect(await service.verifyPermanentPassword(password, legacyHash)).toBe(true);
    expect(service.needsPermanentPasswordRehash(legacyHash)).toBe(true);
  });

  it('enforces Unicode code-point limits and the local versioned blocklist', async () => {
    expect(PASSWORD_BLOCKLIST_VERSION).toBe('phase1-ncsc-top100k-v1');
    await expect(service.hashPermanentPassword('😀'.repeat(11)))
      .rejects.toMatchObject({ code: 'PASSWORD_LENGTH_INVALID' });
    await expect(service.hashPermanentPassword('😀'.repeat(1025)))
      .rejects.toMatchObject({ code: 'PASSWORD_LENGTH_INVALID' });
    const maximumLengthHash = await service.hashPermanentPassword('😀'.repeat(1024));
    expect(await service.verifyPermanentPassword('😀'.repeat(1024), maximumLengthHash)).toBe(true);
    expect(await service.verifyPermanentPassword('😀'.repeat(1023), maximumLengthHash)).toBe(false);
    await expect(service.hashPermanentPassword('Password12345'))
      .rejects.toMatchObject({ code: 'PASSWORD_BLOCKLISTED' });
    await expect(service.hashPermanentPassword('PASSWORD12345'))
      .rejects.toMatchObject({ code: 'PASSWORD_BLOCKLISTED' });
    await expect(service.hashPermanentPassword(' '.repeat(12)))
      .resolves.toMatch(/^\$argon2id\$/);
  });

  it('preserves spaces, Unicode and case exactly for permanent-password hashing', async () => {
    const password = '  Tèst passphrase 🫠  ';
    const hash = await service.hashPermanentPassword(password);

    expect(await service.verifyPermanentPassword(password, hash)).toBe(true);
    expect(await service.verifyPermanentPassword(password.trim(), hash)).toBe(false);
    expect(await service.verifyPermanentPassword(password.toLowerCase(), hash)).toBe(false);
  });
});
