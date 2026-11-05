/**
 * @symphony/domain — privacy/__tests__/consent.test.ts
 *
 * Tests for ConsentService (task 1.7.3).
 *
 * Tests:
 *   recordConsent_before_PII_entry
 *   withdrawConsent_triggersRetentionEvaluation
 *   publicRegisterFields_useLegalObligation_notConsent
 */

import { describe, it, expect } from 'vitest';
import { ConsentService } from '../consent-service.js';
import type { RecordConsentCommand, WithdrawConsentCommand } from '../consent-service.js';

describe('ConsentService', () => {
  it('recordConsent_before_PII_entry', async () => {
    const service = new ConsentService();

    // Attempt to store PII without consent — must return PRECONDITION_FAILED
    const withoutConsent = await service.checkConsentBeforePii({
      personId: 'person-001',
      purpose: 'cooperative_record_keeping',
    });
    expect(withoutConsent.ok).toBe(false);
    if (!withoutConsent.ok) {
      expect(withoutConsent.code).toBe('PRECONDITION_FAILED');
    }

    // Record consent first
    const cmd: RecordConsentCommand = {
      personId: 'person-001',
      purpose: 'cooperative_record_keeping',
      lawfulBasis: 'consent',
      method: 'enroller_witnessed',
      recordedAt: '2026-11-05T10:00:00.000Z',
    };
    const consentResult = await service.recordConsent(cmd);
    expect(consentResult.ok).toBe(true);

    // Now PII can be stored
    const withConsent = await service.checkConsentBeforePii({
      personId: 'person-001',
      purpose: 'cooperative_record_keeping',
    });
    expect(withConsent.ok).toBe(true);
  });

  it('withdrawConsent_triggersRetentionEvaluation', async () => {
    const service = new ConsentService();

    // Set up consent first
    await service.recordConsent({
      personId: 'person-002',
      purpose: 'cooperative_record_keeping',
      lawfulBasis: 'consent',
      method: 'enroller_witnessed',
      recordedAt: '2026-11-05T10:00:00.000Z',
    });

    // Withdraw consent
    const withdraw: WithdrawConsentCommand = {
      personId: 'person-002',
      purpose: 'cooperative_record_keeping',
      withdrawnAt: '2026-11-05T11:00:00.000Z',
    };
    const result = await service.withdrawConsent(withdraw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Withdrawal must emit ConsentWithdrawn event
      expect(result.events.some((e) => e.eventType === 'ConsentWithdrawn')).toBe(true);
      // Retention evaluation must be triggered
      expect(result.retentionEvaluationRequired).toBe(true);
    }
  });

  it('publicRegisterFields_useLegalObligation_notConsent', async () => {
    const service = new ConsentService();

    // Statutory register fields (Act s.28) use legal_obligation basis
    const cmd: RecordConsentCommand = {
      personId: 'person-003',
      purpose: 'statutory_register',
      lawfulBasis: 'legal_obligation',
      method: 'statutory',
      recordedAt: '2026-11-05T10:00:00.000Z',
    };
    const result = await service.recordConsent(cmd);
    expect(result.ok).toBe(true);

    // Legal obligation fields are not covered by WithdrawConsent
    const withdraw: WithdrawConsentCommand = {
      personId: 'person-003',
      purpose: 'statutory_register',
      withdrawnAt: '2026-11-05T11:00:00.000Z',
    };
    const withdrawResult = await service.withdrawConsent(withdraw);
    expect(withdrawResult.ok).toBe(false);
    if (!withdrawResult.ok) {
      expect(withdrawResult.code).toBe('CANNOT_WITHDRAW_LEGAL_OBLIGATION');
    }
  });
});

