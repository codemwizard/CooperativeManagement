/**
 * @symphony/domain — privacy/__tests__/retention.test.ts
 *
 * Tests for retention policy (task 1.7.5).
 *
 * Tests:
 *   memberDataRetention_twoYearFloor
 *   cryptoShred_keepsTransactionFacts
 */

import { describe, it, expect } from 'vitest';
import { RetentionPolicy } from '../retention-policy.js';
import type { MemberRetentionRecord, TransactionFact } from '../retention-policy.js';
import { LocalDevKeyProvider } from '../key-provider.js';

describe('RetentionPolicy', () => {
  it('memberDataRetention_twoYearFloor', () => {
    const policy = new RetentionPolicy();

    // Member ceased 1 year ago — still within 2-year floor
    const cessation1YearAgo = new Date('2025-11-05T00:00:00.000Z').toISOString();
    const evaluatedAt = '2026-11-05T00:00:00.000Z';

    const result1 = policy.evaluate({
      personId: 'person-001',
      cessationDate: cessation1YearAgo,
      evaluatedAt,
    });

    expect(result1.canShred).toBe(false);
    expect(result1.reason).toBe('RETENTION_FLOOR_NOT_REACHED');

    // Member ceased 3 years ago — past 2-year floor
    const cessation3YearsAgo = new Date('2023-11-05T00:00:00.000Z').toISOString();

    const result2 = policy.evaluate({
      personId: 'person-002',
      cessationDate: cessation3YearsAgo,
      evaluatedAt,
    });

    expect(result2.canShred).toBe(true);
    expect(result2.reason).toBe('RETENTION_FLOOR_PASSED');
  });

  it('cryptoShred_keepsTransactionFacts', async () => {
    const keyProvider = new LocalDevKeyProvider({
      rootKeyHex: 'b'.repeat(64),
      pepper: Buffer.from('retention-test-pepper'),
    });

    const policy = new RetentionPolicy();

    // Encrypt a person's PII
    const personId = 'person-shred-001';
    const keyRef = `pii-${personId}`;
    const plaintext = Buffer.from('Jane Doe');
    const ciphertext = await keyProvider.encrypt(plaintext, keyRef);

    // Set up a transaction fact (pseudonymous — just the person_id reference)
    const transaction: TransactionFact = {
      transactionId: 'tx-001',
      personId,          // pseudonymous reference — not PII itself
      amount: 500,
      currency: 'ZMW',
      type: 'contribution',
      recordedAt: '2026-01-01T10:00:00.000Z',
    };

    // Perform crypto shred — delete the key
    keyProvider.deleteKey(keyRef);

    // The ciphertext is now unreadable
    await expect(keyProvider.decrypt(ciphertext, keyRef)).rejects.toMatchObject({
      code: 'KEY_DELETED',
    });

    // But the transaction fact (pseudonymous) is still accessible
    const shredResult = policy.shred({
      personId,
      keyRefs: [keyRef],
      transactions: [transaction],
    });

    expect(shredResult.transactionsRetained).toBe(1);
    expect(shredResult.transactionsRetained).toBeGreaterThan(0);
    expect(shredResult.piiKeysDeleted).toContain(keyRef);
    // The transaction still links via personId (pseudonymous)
    expect(shredResult.retainedTransactions[0]?.personId).toBe(personId);
  });
});

