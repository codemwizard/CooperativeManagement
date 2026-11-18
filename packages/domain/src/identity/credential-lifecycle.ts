import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import commonPasswordEntries from './password-blocklist-v1.json' with { type: 'json' };

export const TEMPORARY_CREDENTIAL_LIFETIME_MS = 72 * 60 * 60 * 1000;
export const ARGON2ID_PARAMETERS = Object.freeze({ memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 });
export const PASSWORD_BLOCKLIST_VERSION = 'phase1-ncsc-top100k-v1';

const COMMON_PASSWORDS: ReadonlySet<string> = new Set(commonPasswordEntries);

export interface CredentialClock {
  now(): string;
}

export interface TemporaryCredentialMaterial {
  readonly credentialId: string;
  readonly plaintext: string;
  readonly hash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface TemporaryCredentialRecord {
  readonly credentialId: string;
  readonly hash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export type TemporaryCredentialVerification = 'valid' | 'invalid' | 'expired';

export class CredentialLifecycleService {
  constructor(private readonly clock: CredentialClock) {}

  /** Issues an opaque 256-bit one-time secret with the fixed D-08 lifetime. */
  async issueTemporaryCredential(): Promise<TemporaryCredentialMaterial> {
    const plaintext = randomBytes(32).toString('base64url');
    const issuedAt = this.clock.now();
    const issuedTime = Date.parse(issuedAt);
    if (!Number.isFinite(issuedTime)) throw new Error('Credential clock returned an invalid instant');
    const hash = await this.hashSecret(plaintext);
    return {
      credentialId: randomUUID(),
      plaintext,
      hash,
      issuedAt: new Date(issuedTime).toISOString(),
      expiresAt: new Date(issuedTime + TEMPORARY_CREDENTIAL_LIFETIME_MS).toISOString(),
    };
  }

  /** Verification is deliberately non-consuming; the repository consumes it atomically with password establishment. */
  async verifyTemporaryCredential(plaintext: string, record: TemporaryCredentialRecord): Promise<TemporaryCredentialVerification> {
    const now = Date.parse(this.clock.now());
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(now) || !Number.isFinite(expiresAt)) return 'invalid';
    if (now >= expiresAt) return 'expired';
    return (await this.verifySecret(record.hash, plaintext)) ? 'valid' : 'invalid';
  }

  async hashPermanentPassword(password: string): Promise<string> {
    const codePointLength = Array.from(password).length;
    if (codePointLength < 12 || codePointLength > 1024) {
      throw new PasswordCredentialPolicyError('PASSWORD_LENGTH_INVALID');
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new PasswordCredentialPolicyError('PASSWORD_BLOCKLISTED');
    }
    return this.hashSecret(password);
  }

  async verifyPermanentPassword(password: string, encodedHash: string): Promise<boolean> {
    return this.verifySecret(encodedHash, password);
  }

  needsPermanentPasswordRehash(encodedHash: string): boolean {
    const parameters = parseArgon2idParameters(encodedHash);
    return parameters === undefined
      || parameters.memoryCost < ARGON2ID_PARAMETERS.memoryCost
      || parameters.timeCost < ARGON2ID_PARAMETERS.timeCost
      || parameters.parallelism < ARGON2ID_PARAMETERS.parallelism;
  }

  private hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret, {
      type: argon2.argon2id,
      ...ARGON2ID_PARAMETERS,
    });
  }

  private async verifySecret(encodedHash: string, secret: string): Promise<boolean> {
    if (typeof secret !== 'string' || !parseArgon2idParameters(encodedHash)) return false;
    try {
      return await argon2.verify(encodedHash, secret);
    } catch {
      return false;
    }
  }
}

function parseArgon2idParameters(encodedHash: string): { memoryCost: number; timeCost: number; parallelism: number } | undefined {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.exec(encodedHash);
  if (!match) return undefined;
  const memoryCost = Number(match[1]);
  const timeCost = Number(match[2]);
  const parallelism = Number(match[3]);
  if (!Number.isSafeInteger(memoryCost) || memoryCost < 8192 || memoryCost > 65536) return undefined;
  if (!Number.isSafeInteger(timeCost) || timeCost < 1 || timeCost > 4) return undefined;
  if (!Number.isSafeInteger(parallelism) || parallelism < 1 || parallelism > 4) return undefined;
  return { memoryCost, timeCost, parallelism };
}

export class PasswordCredentialPolicyError extends Error {
  constructor(readonly code: 'PASSWORD_LENGTH_INVALID' | 'PASSWORD_BLOCKLISTED') {
    super(code);
    this.name = 'PasswordCredentialPolicyError';
  }
}
