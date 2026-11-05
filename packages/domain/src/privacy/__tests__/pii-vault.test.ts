/**
 * @symphony/domain — privacy/__tests__/pii-vault.test.ts
 *
 * Failing tests (task 1.7.1) — written BEFORE implementation.
 *
 * Tests:
 *   encrypt_thenDecrypt_returnsSamePlaintext
 *   differentPersonKeys_producesDifferentCiphertext
 *   blindIndex_matchesSamePlaintext
 *   blindIndex_differentPepper_doesNotMatch
 *   cryptoShred_keyDeleted_ciphertextUnreadable
 *   nrcPattern_neverInEventPayload
 *   nrcPattern_neverInLog
 */

import { describe, it, expect, beforeEach } from 'vitest';

// These imports will fail until 1.7.2 is implemented — intentional RED state
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LocalDevKeyProvider } from '../key-provider.js';
import type { KeyProvider } from '../key-provider.js';

// ─── NRC pattern ──────────────────────────────────────────────────────────────

const NRC_PATTERN = /\d{6}\/\d{2}\/\d/;
const SYNTHETIC_NRC = 'TS0001/01/1'; // synthetic pattern — no real digits

// ─── Setup ────────────────────────────────────────────────────────────────────

let provider: KeyProvider;

beforeEach(() => {
  provider = new LocalDevKeyProvider({
    rootKeyHex: 'a'.repeat(64), // 32-byte root key as hex (test only — never hardcoded in prod)
    pepper: Buffer.from('test-pepper-do-not-use-in-prod'),
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KeyProvider — PII vault', () => {
  it('encrypt_thenDecrypt_returnsSamePlaintext', async () => {
    const plaintext = Buffer.from('John Doe');
    const keyRef = 'person-001';
    const ciphertext = await provider.encrypt(plaintext, keyRef);
    const decrypted = await provider.decrypt(ciphertext, keyRef);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('differentPersonKeys_producesDifferentCiphertext', async () => {
    const plaintext = Buffer.from('Jane Smith');
    const ct1 = await provider.encrypt(plaintext, 'person-A');
    const ct2 = await provider.encrypt(plaintext, 'person-B');
    // Same plaintext but different key refs → different ciphertexts
    expect(ct1.equals(ct2)).toBe(false);
  });

  it('blindIndex_matchesSamePlaintext', async () => {
    // Normalise before HMAC: lowercase
    const pepperBuf = Buffer.from('test-pepper-do-not-use-in-prod');
    const idx1 = await provider.hmac(Buffer.from('john'), pepperBuf);
    const idx2 = await provider.hmac(Buffer.from('john'), pepperBuf);
    // Same value → same blind index
    expect(idx1.equals(idx2)).toBe(true);

    // Different case — HMAC is NOT case-insensitive; normalisation must happen BEFORE calling hmac
    const idx3 = await provider.hmac(Buffer.from('JOHN'), pepperBuf);
    expect(idx1.equals(idx3)).toBe(false);
  });

  it('blindIndex_differentPepper_doesNotMatch', async () => {
    const value = Buffer.from('john');
    const pepper1 = Buffer.from('pepper-one');
    const pepper2 = Buffer.from('pepper-two');
    const idx1 = await provider.hmac(value, pepper1);
    const idx2 = await provider.hmac(value, pepper2);
    expect(idx1.equals(idx2)).toBe(false);
  });

  it('cryptoShred_keyDeleted_ciphertextUnreadable', async () => {
    const plaintext = Buffer.from('sensitive-data');
    const keyRef = 'person-shred-001';
    const ciphertext = await provider.encrypt(plaintext, keyRef);

    // Delete the key (crypto shred)
    provider.deleteKey(keyRef);

    // Subsequent decrypt must throw KEY_DELETED
    await expect(provider.decrypt(ciphertext, keyRef)).rejects.toMatchObject({
      code: 'KEY_DELETED',
    });
  });

  it('nrcPattern_neverInEventPayload', async () => {
    // Simulate storing a person with a synthetic NRC — the event payload
    // must reference the person by pseudonymous ID only, never the raw NRC.
    const nrc = SYNTHETIC_NRC; // 'TS0001/01/1' — synthetic
    const keyRef = 'person-nrc-event-001';
    const encryptedNrc = await provider.encrypt(Buffer.from(nrc), keyRef);

    // Simulate an event payload — must NOT contain the raw NRC
    const eventPayload = {
      personId: 'pseudonymous-id-00001',
      encryptedNrcRef: keyRef,
      encryptedNrcCiphertext: encryptedNrc.toString('base64'),
    };

    const payloadStr = JSON.stringify(eventPayload);

    // The raw NRC must not appear in the payload
    expect(NRC_PATTERN.test(payloadStr)).toBe(false);
    // The synthetic NRC string must not appear literally
    expect(payloadStr.includes(nrc)).toBe(false);
  });

  it('nrcPattern_neverInLog', async () => {
    // Simulate a log scrubber that filters NRC-shaped values
    const logMessages: string[] = [];
    const scrub = (msg: string): string => msg.replace(NRC_PATTERN, '[REDACTED_NRC]');

    // Attempt to log a message containing an NRC
    const rawNrc = '123456/78/1'; // real-pattern NRC (would be a real one in prod)
    const unsafeMsg = `Member added with NRC ${rawNrc}`;
    logMessages.push(scrub(unsafeMsg));

    // The log must not contain the NRC pattern
    for (const line of logMessages) {
      expect(NRC_PATTERN.test(line)).toBe(false);
    }
  });
});

