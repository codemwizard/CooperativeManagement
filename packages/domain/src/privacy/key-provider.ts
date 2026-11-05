/**
 * @symphony/domain — privacy/key-provider.ts
 *
 * PII vault — per-person envelope encryption with AES-256-GCM,
 * HMAC-SHA-256 blind indexing, and crypto shredding.
 *
 * Security requirements (AI-Secure-Coding-Policy.md):
 *   ✅ Root key comes from environment variable only — NEVER hardcoded in production
 *   ✅ No `any` types
 *   ✅ Errors classified: KEY_DELETED | DECRYPT_FAILED | KEY_NOT_FOUND
 *   ✅ Per-person data key (DEK) wrapped by root KEK — key hierarchy
 *   ✅ AES-256-GCM: authenticated encryption (IND-CPA + INT-CTXT)
 *   ✅ Random 12-byte IV per encrypt call
 *
 * Design:
 *   KeyProvider  — interface (pure domain port — no I/O beyond node:crypto)
 *   LocalDevKeyProvider — in-process implementation suitable for dev/test
 *
 * Production note:
 *   Replace LocalDevKeyProvider with a KMS-backed implementation.
 *   The root key MUST be loaded from process.env.SYMPHONY_ROOT_KEY_HEX
 *   (a 64-char hex string representing 32 bytes).
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// ─── Classified error ─────────────────────────────────────────────────────────

export type PiiVaultErrorCode = 'KEY_DELETED' | 'DECRYPT_FAILED' | 'KEY_NOT_FOUND';

export class PiiVaultError extends Error {
  readonly code: PiiVaultErrorCode;

  constructor(code: PiiVaultErrorCode, detail: string) {
    super(`[${code}] ${detail}`);
    this.name = 'PiiVaultError';
    this.code = code;
  }
}

// ─── Port interface ───────────────────────────────────────────────────────────

export interface KeyProvider {
  /**
   * Encrypt plaintext using a per-person data key identified by keyRef.
   * Returns a Buffer containing: [IV (12 bytes)] [ciphertext] [auth tag (16 bytes)]
   */
  encrypt(plaintext: Buffer, keyRef: string): Promise<Buffer>;

  /**
   * Decrypt ciphertext produced by encrypt().
   * Throws PiiVaultError(KEY_DELETED) if the key was deleted.
   * Throws PiiVaultError(DECRYPT_FAILED) on authentication failure.
   */
  decrypt(ciphertext: Buffer, keyRef: string): Promise<Buffer>;

  /**
   * Compute HMAC-SHA-256 of value using pepper.
   * Used for blind indexing — normalise inputs before calling.
   */
  hmac(value: Buffer, pepper: Buffer): Promise<Buffer>;

  /**
   * Mark a key as deleted (crypto shred).
   * Subsequent decrypt() calls for this keyRef throw KEY_DELETED.
   */
  deleteKey(keyRef: string): void;
}

// ─── LocalDevKeyProvider ──────────────────────────────────────────────────────

export interface LocalDevKeyProviderOptions {
  /**
   * Root key as 64-character hex string (32 bytes).
   * In production: load from process.env.SYMPHONY_ROOT_KEY_HEX
   * In tests: pass as option — NEVER hardcode a real root key.
   */
  readonly rootKeyHex: string;
  /** Pepper for HMAC blind indexing. */
  readonly pepper: Buffer;
}

/**
 * LocalDevKeyProvider — in-process key provider for development and testing.
 *
 * Key hierarchy:
 *   Root KEK (from options.rootKeyHex)
 *   └── Per-person DEK (derived via HMAC-SHA-256(keyRef, rootKek))
 *       └── AES-256-GCM envelope encryption of plaintext
 *
 * This avoids storing any key material in the data store — shredding is
 * implemented by marking a keyRef as deleted (simulating KMS key destruction).
 */
export class LocalDevKeyProvider implements KeyProvider {
  private readonly rootKek: Buffer;
  private readonly defaultPepper: Buffer;
  private readonly deletedKeys = new Set<string>();

  constructor(options: LocalDevKeyProviderOptions) {
    if (options.rootKeyHex.length !== 64) {
      throw new PiiVaultError(
        'KEY_NOT_FOUND',
        'rootKeyHex must be 64 hex characters (32 bytes)',
      );
    }
    this.rootKek = Buffer.from(options.rootKeyHex, 'hex');
    this.defaultPepper = options.pepper;
  }

  /** Derive a per-person DEK from the root KEK using the keyRef. */
  private deriveDek(keyRef: string): Buffer {
    const hmacResult = createHmac('sha256', this.rootKek)
      .update(Buffer.from(keyRef, 'utf8'))
      .digest();
    return hmacResult; // 32 bytes → AES-256
  }

  async encrypt(plaintext: Buffer, keyRef: string): Promise<Buffer> {
    if (this.deletedKeys.has(keyRef)) {
      throw new PiiVaultError('KEY_DELETED', `Key "${keyRef}" has been deleted`);
    }

    const dek = this.deriveDek(keyRef);
    const iv = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', dek, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // Layout: [IV (12)] [ciphertext] [authTag (16)]
    return Buffer.concat([iv, encrypted, authTag]);
  }

  async decrypt(ciphertext: Buffer, keyRef: string): Promise<Buffer> {
    if (this.deletedKeys.has(keyRef)) {
      throw new PiiVaultError('KEY_DELETED', `Key "${keyRef}" has been deleted`);
    }

    if (ciphertext.length < 28) {
      // 12 (IV) + 0 (empty plaintext) + 16 (tag) = 28 minimum
      throw new PiiVaultError('DECRYPT_FAILED', 'Ciphertext too short');
    }

    const iv = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const encrypted = ciphertext.subarray(12, ciphertext.length - 16);

    const dek = this.deriveDek(keyRef);

    try {
      const decipher = createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted;
    } catch {
      throw new PiiVaultError('DECRYPT_FAILED', `Decryption failed for key "${keyRef}"`);
    }
  }

  async hmac(value: Buffer, pepper: Buffer): Promise<Buffer> {
    // Use the provided pepper; fall back to the instance pepper
    const activePepper = pepper.length > 0 ? pepper : this.defaultPepper;
    return createHmac('sha256', activePepper).update(value).digest();
  }

  deleteKey(keyRef: string): void {
    this.deletedKeys.add(keyRef);
  }
}

// ─── Production factory ───────────────────────────────────────────────────────

/**
 * Create a LocalDevKeyProvider from environment variables.
 * MUST be used in development/CI only.
 * Production should use a KMS-backed implementation.
 *
 * Required env vars:
 *   SYMPHONY_ROOT_KEY_HEX   — 64-char hex string (32 bytes)
 *   SYMPHONY_BLIND_PEPPER   — arbitrary-length secret (UTF-8)
 */
export function createLocalDevKeyProviderFromEnv(): LocalDevKeyProvider {
  const rootKeyHex = process.env['SYMPHONY_ROOT_KEY_HEX'];
  const pepper = process.env['SYMPHONY_BLIND_PEPPER'];

  if (!rootKeyHex || rootKeyHex.length !== 64) {
    throw new PiiVaultError(
      'KEY_NOT_FOUND',
      'SYMPHONY_ROOT_KEY_HEX must be set to a 64-character hex string',
    );
  }
  if (!pepper) {
    throw new PiiVaultError(
      'KEY_NOT_FOUND',
      'SYMPHONY_BLIND_PEPPER must be set',
    );
  }

  return new LocalDevKeyProvider({
    rootKeyHex,
    pepper: Buffer.from(pepper, 'utf8'),
  });
}

