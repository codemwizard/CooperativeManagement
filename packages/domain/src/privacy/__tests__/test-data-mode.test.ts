/**
 * @symphony/domain — privacy/__tests__/test-data-mode.test.ts
 *
 * Failing tests (task 1.8.1) — written BEFORE implementation.
 *
 * Tests:
 *   testMode_rejectsRealNRC
 *   testMode_acceptsSyntheticNRC
 *   testMode_rejectsRealCoopRegNumber
 *   testMode_acceptsSyntheticCoopRegNumber
 *   realMode_outsideApprovedRegion_refusesToStart
 *   purgeToSeed_removesAllTenantData
 */

import { describe, it, expect } from 'vitest';
import { DataModeGuard, PurgeSeedService } from '../data-mode-guard.js';

describe('DataModeGuard', () => {
  it('testMode_rejectsRealNRC', () => {
    const guard = new DataModeGuard({ mode: 'test' });
    // Real NRC pattern: 6 digits / 2 digits / 1 digit — rejected in test mode
    const result = guard.validateIdentifier('123456/78/1', 'nrc');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NON_SYNTHETIC_IDENTIFIER_IN_TEST_MODE');
    }
  });

  it('testMode_acceptsSyntheticNRC', () => {
    const guard = new DataModeGuard({ mode: 'test' });
    // Synthetic NRC: TS prefix followed by alphanumerics / 2 digits / 1 digit
    const result1 = guard.validateIdentifier('TS0001/01/1', 'nrc');
    expect(result1.ok).toBe(true);

    const result2 = guard.validateIdentifier('TSAB12/05/2', 'nrc');
    expect(result2.ok).toBe(true);
  });

  it('testMode_rejectsRealCoopRegNumber', () => {
    const guard = new DataModeGuard({ mode: 'test' });
    // Real coop registration number: 11 digits (non-test corpus range)
    // Test corpus range: 00000000001 – 00000099999
    const result = guard.validateIdentifier('12345678901', 'coop_reg_number');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NON_SYNTHETIC_IDENTIFIER_IN_TEST_MODE');
    }
  });

  it('testMode_acceptsSyntheticCoopRegNumber', () => {
    const guard = new DataModeGuard({ mode: 'test' });
    // Synthetic coop reg number: 11-digit, 00000000001 – 00000099999 range
    const result = guard.validateIdentifier('00000000001', 'coop_reg_number');
    expect(result.ok).toBe(true);
  });

  it('realMode_outsideApprovedRegion_refusesToStart', () => {
    const guard = new DataModeGuard({ mode: 'real' });
    // Approved regions — ZM is Zambia (approved)
    expect(() => guard.enforceResidency('not-approved')).toThrow('RESIDENCY_REGION_NOT_APPROVED');
  });

  it('realMode_approvedRegion_starts', () => {
    const guard = new DataModeGuard({ mode: 'real' });
    // ZM is approved — should not throw
    expect(() => guard.enforceResidency('ZM')).not.toThrow();
  });
});

describe('PurgeSeedService', () => {
  it('purgeToSeed_removesAllTenantData', async () => {
    const service = new PurgeSeedService();

    // Seed some cooperative data
    service.seedTenantData({
      cooperatives: [{ id: 'coop-001', name: 'Test Coop' }],
      members: [{ id: 'member-001', coopId: 'coop-001', name: 'Test Member' }],
      events: [{ id: 'evt-001', tenantId: 'coop-001', type: 'MemberAdded' }],
    });

    // Verify data is present before purge
    expect(service.cooperativeCount()).toBe(1);
    expect(service.memberCount()).toBe(1);
    expect(service.eventCount()).toBe(1);

    // Run purge-to-seed
    const result = await service.purgeToSeed();

    // All tenant data removed
    expect(service.cooperativeCount()).toBe(0);
    expect(service.memberCount()).toBe(0);
    expect(service.eventCount()).toBe(0);

    // Seed catalogues, roles and demo tenant exist
    expect(result.seedCataloguesRestored).toBe(true);
    expect(result.rolesRestored).toBe(true);
    expect(result.demoTenantRestored).toBe(true);

    // Purge audit record written
    expect(result.auditRecord).toBeDefined();
    expect(result.auditRecord.purgedAt).toBeTruthy();
    expect(result.auditRecord.cooperativesPurged).toBe(1);
    expect(result.auditRecord.membersPurged).toBe(1);
    expect(result.auditRecord.eventsPurged).toBe(1);
  });
});

