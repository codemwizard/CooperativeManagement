import { describe, expect, it } from 'vitest';
import { getAuthoritativeInventory } from '../src/engine/inventory';
import { assetsByOwner } from '../src/components/journeys/assetSummary';
import { baselineCases } from '../src/engine/data';

describe('Phase R4: Chisamba Inventory Consistency & Asset Separation (Gate 4)', () => {
  const case1 = baselineCases.find((c) => c.id === 'case-1')!;

  it('T4.1 Reconciles Chisamba 500-head baseline across all three livestock categories', () => {
    const inv = getAuthoritativeInventory(case1);

    expect(inv.case_id).toBe('case-1');
    expect(inv.livestock_inventory.total_head_count).toBe(500);
    expect(inv.livestock_inventory.breakdown.beef_cattle).toBe(150);
    expect(inv.livestock_inventory.breakdown.dairy_cows).toBe(50);
    expect(inv.livestock_inventory.breakdown.goats).toBe(300);
    expect(inv.livestock_inventory.cooperative_stated_valuation_zmw).toBe(420000);
    expect(inv.livestock_inventory.count_evidence_level).toBe('supported');
    expect(inv.livestock_inventory.valuation_evidence_level).toBe('asserted');
  });

  it('T4.2 Reconciles 74 registered members with 4-member sample roster without inferring total from sample', () => {
    const inv = getAuthoritativeInventory(case1);

    expect(inv.total_members_registered).toBe(74);
    expect(inv.sample_roster_count).toBe(4);
    expect(inv.sample_roster_note).toContain('74 members total');
    expect(inv.sample_roster_note).toContain('must not be used to infer');
  });

  it('T4.3 Segregates member personal property from cooperative communal assets', () => {
    const inv = getAuthoritativeInventory(case1);

    expect(inv.communal_assets.length).toBeGreaterThan(0);
    expect(inv.communal_assets[0].type).toBe('Land (communal)');

    // Personal livestock sample
    expect(inv.member_personal_assets_summary.sample_livestock_count).toBe(22);
    expect(inv.member_personal_assets_summary.sample_stated_value_zmw).toBe(89600);
    expect(inv.member_personal_assets_summary.separation_rule).toContain('legally distinct');
  });

  it('T4.4 assetsByOwner uses authoritative inventory valuation rather than arbitrary 50k multiplier', () => {
    const assetBreakdown = assetsByOwner(case1 as any);

    expect(assetBreakdown.cooperative_assets.total_value_zmw).toBe(420000);
    expect(assetBreakdown.cooperative_assets.total_head_count).toBe(500);
    expect(assetBreakdown.members_assets.roster_note).toBeDefined();
    expect(assetBreakdown.members_assets.label).toContain('personal property');
  });

  it('T4.5 Member livestock is classified as member_personal ownership, not cooperative_communal', () => {
    const inv = getAuthoritativeInventory(case1);
    // The 500-head livestock inventory is member-owned personal property
    expect(inv.livestock_inventory.ownership).toBe('member_personal');
    // The field must not say cooperative_communal when data is member-origin
    expect(inv.livestock_inventory.ownership).not.toBe('cooperative_communal');
  });

  it('T4.6 Member-owned livestock must not appear as cooperative communal collateral', () => {
    const inv = getAuthoritativeInventory(case1);
    // cooperative_communal items come from coop_assets, not member livestock categories
    expect(inv.communal_assets.every((a) => a.type !== 'Member Livestock')).toBe(true);
  });
});
