/**
 * @symphony/testkit — step-definitions/data-mode-steps.ts
 *
 * Step definitions for test-data-mode BDD scenarios (WP-1.8):
 *   BDD-PRV-009 — Test mode accepts only synthetic identifier pattern (outline, 4 examples)
 *   BDD-PRV-010 — Real mode refuses to start outside approved residency region
 *   BDD-PRV-011 — Purge-to-seed removes tenant data and restores seed set
 *
 * Uses in-memory DataModeGuard and PurgeSeedService — no DB needed.
 */

import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import type { SymphonyWorld } from './world.js';
import { DataModeGuard, PurgeSeedService } from '@symphony/domain/privacy/data-mode-guard';
import type { DataMode } from '@symphony/domain/privacy/data-mode-guard';

// ─── World cast helper ────────────────────────────────────────────────────────

function w(world: SymphonyWorld): Record<string, unknown> {
  return world as unknown as Record<string, unknown>;
}

// ─── BDD-PRV-009: Test mode accepts only synthetic identifier pattern ─────────

Given('data mode {string}', function (this: SymphonyWorld, mode: string) {
  if (mode !== 'test' && mode !== 'real') {
    throw new Error(`Unknown data mode "${mode}" — expected "test" or "real"`);
  }
  const guard = new DataModeGuard({ mode: mode as DataMode });
  w(this)['_dataModeGuard'] = guard;
  w(this)['_dataMode'] = mode;
});

When(
  'a Secretary adds a member with NRC {string}',
  function (this: SymphonyWorld, nrc: string) {
    const guard = w(this)['_dataModeGuard'] as DataModeGuard | undefined;
    if (!guard) throw new Error('No DataModeGuard set up — "Given data mode" step must run first');

    const result = guard.validateIdentifier(nrc, 'nrc');
    // Store as _outlineResult so the shared `Then the result is {string}` step in authz-steps can read it
    w(this)['_outlineResult'] = result;

    if (!result.ok) {
      w(this)['_lastRejectionCode'] = result.code;
    }
  },
);

// Note: `Then the result is {string}` is defined in authz-steps.ts and handles all result
// vocabularies: "allowed", "recorded", "rejected", and "rejected <CODE>".
// PRV-009 stores its ValidationResult into _outlineResult — the shared step handles it.

// ─── BDD-PRV-010: Real mode refuses to start outside approved residency ────────

Given(
  'data mode {string} and residency region {string}',
  function (this: SymphonyWorld, mode: string, region: string) {
    if (mode !== 'test' && mode !== 'real') {
      throw new Error(`Unknown data mode "${mode}"`);
    }
    const guard = new DataModeGuard({ mode: mode as DataMode });
    w(this)['_dataModeGuard'] = guard;
    w(this)['_dataMode'] = mode;
    w(this)['_residencyRegion'] = region;
  },
);

When('the application starts', function (this: SymphonyWorld) {
  const guard = w(this)['_dataModeGuard'] as DataModeGuard | undefined;
  if (!guard) throw new Error('No DataModeGuard — "Given data mode" step must run first');
  const region = w(this)['_residencyRegion'] as string | undefined;
  if (!region) throw new Error('No residency region — "Given data mode ... and residency region" step must run first');

  let startupError: string | null = null;
  try {
    guard.enforceResidency(region);
  } catch (err: unknown) {
    // Extract the error code from the message
    const msg = err instanceof Error ? err.message : String(err);
    // Message format: "RESIDENCY_REGION_NOT_APPROVED: region ..."
    const code = msg.split(':')[0]?.trim() ?? msg;
    startupError = code;
  }

  w(this)['_startupError'] = startupError;
  if (startupError) {
    w(this)['_lastRejectionCode'] = startupError;
  }
});

Then(
  'startup fails with reason {string}',
  function (this: SymphonyWorld, expectedReason: string) {
    const startupError = w(this)['_startupError'] as string | null | undefined;
    assert.ok(startupError, `Expected startup to fail with "${expectedReason}" but it succeeded`);
    assert.strictEqual(
      startupError,
      expectedReason,
      `Expected startup failure reason "${expectedReason}", got "${startupError}"`,
    );
  },
);

// ─── BDD-PRV-011: Purge-to-seed ────────────────────────────────────────────────

Given(
  'a test database with enrolled cooperatives, evidence and events',
  function (this: SymphonyWorld) {
    const service = new PurgeSeedService();
    service.seedTenantData({
      cooperatives: [
        { id: 'coop-001', name: 'Nsenga Honey Growers' },
        { id: 'coop-002', name: 'Chipata Fish Farmers' },
      ],
      members: [
        { id: 'member-001', coopId: 'coop-001', name: 'Mary Phiri' },
        { id: 'member-002', coopId: 'coop-002', name: 'John Banda' },
      ],
      events: [
        { id: 'evt-001', tenantId: 'coop-001', type: 'MemberAdded' },
        { id: 'evt-002', tenantId: 'coop-002', type: 'MemberAdded' },
      ],
    });
    w(this)['_purgeSeedService'] = service;
  },
);

When('the purge-to-seed job runs', async function (this: SymphonyWorld) {
  const service = w(this)['_purgeSeedService'] as PurgeSeedService | undefined;
  if (!service) throw new Error('No PurgeSeedService — "Given a test database" step must run first');

  const result = await service.purgeToSeed();
  w(this)['_purgeResult'] = result;
});

Then('no tenant data remains', function (this: SymphonyWorld) {
  const service = w(this)['_purgeSeedService'] as PurgeSeedService;
  assert.strictEqual(service.cooperativeCount(), 0, 'Expected no cooperatives after purge');
  assert.strictEqual(service.memberCount(), 0, 'Expected no members after purge');
  assert.strictEqual(service.eventCount(), 0, 'Expected no events after purge');
});

Then(
  'the seed catalogues, roles and demo tenant exist',
  function (this: SymphonyWorld) {
    const result = w(this)['_purgeResult'] as { seedCataloguesRestored: boolean; rolesRestored: boolean; demoTenantRestored: boolean } | undefined;
    assert.ok(result, 'Expected purge result to be recorded');
    assert.ok(result.seedCataloguesRestored, 'Expected seed catalogues to be restored');
    assert.ok(result.rolesRestored, 'Expected roles to be restored');
    assert.ok(result.demoTenantRestored, 'Expected demo tenant to be restored');
  },
);

Then('a purge audit record is written', function (this: SymphonyWorld) {
  const result = w(this)['_purgeResult'] as { auditRecord: { purgedAt: string; cooperativesPurged: number } } | undefined;
  assert.ok(result, 'Expected purge result to be recorded');
  assert.ok(result.auditRecord, 'Expected purge audit record to be written');
  assert.ok(result.auditRecord.purgedAt, 'Expected purge audit record to include purgedAt timestamp');
  assert.ok(result.auditRecord.cooperativesPurged > 0, 'Expected purge audit record to count purged cooperatives');
});
