import { describe, it, expect } from 'vitest';
import { conservativeEncumbrance, memberAssetSummary, coopAssetSummary } from '../src/components/journeys/assetSummary';
import { baselineCases } from '../src/engine/data';

describe('assetSummary helpers and personal data boundary', () => {
  it('correctly ranks encumbrance status by precedence', () => {
    expect(conservativeEncumbrance([])).toBe('Not recorded');
    expect(conservativeEncumbrance(['Not recorded', 'Verified unencumbered'])).toBe('Verified unencumbered');
    expect(conservativeEncumbrance(['Reported unencumbered', 'Disputed', 'Not recorded'])).toBe('Disputed');
    expect(conservativeEncumbrance(['Unknown', 'Under lien'])).toBe('Under lien');
    expect(conservativeEncumbrance(['Under lien', 'Pledged'])).toBe('Pledged');
  });

  it('aggregates member livestock counts and values without exposing personal names', () => {
    const case1 = baselineCases[0];
    const summary = memberAssetSummary(case1 as any);

    expect(summary.livestock_item_count).toBeGreaterThan(0);
    expect(summary.livestock_est_value_zmw).toBeGreaterThan(0);
    expect(summary.encumbrance_summary).toBe('Not recorded');
    expect(summary.label).toBe('Member-declared assets (personal property — not cooperative collateral)');

    // Ensure summary does not leak raw member objects
    expect((summary as any).members_roster).toBeUndefined();
    expect((summary as any).names).toBeUndefined();
  });

  it('formats cooperative assets correctly', () => {
    const case1 = baselineCases[0];
    const coopAssets = coopAssetSummary(case1 as any);

    expect(Array.isArray(coopAssets)).toBe(true);
    expect(coopAssets.length).toBe(2);
    expect(coopAssets[0].type).toBe('Land (communal)');
  });
});
