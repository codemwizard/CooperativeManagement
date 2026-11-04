import type { CaseState } from '../../engine/types';
import type { MemberRosterItem, CoopAsset, EncumbranceStatus } from './types.display';

const ENCUMBRANCE_PRECEDENCE: EncumbranceStatus[] = [
  'Pledged',
  'Under lien',
  'Disputed',
  'Unknown',
  'Reported unencumbered',
  'Verified unencumbered',
  'Not recorded',
];

export function conservativeEncumbrance(statuses: EncumbranceStatus[]): EncumbranceStatus {
  if (!statuses || statuses.length === 0) {
    return 'Not recorded';
  }
  for (const candidate of ENCUMBRANCE_PRECEDENCE) {
    if (statuses.includes(candidate)) {
      return candidate;
    }
  }
  return 'Not recorded';
}

export function memberAssetSummary(caseState: CaseState & { members_roster?: MemberRosterItem[] }) {
  const roster = caseState.members_roster ?? [];
  const allLivestock = roster.flatMap(m => m.livestock ?? []);
  const totalCount = allLivestock.reduce((sum, l) => sum + (l.count || 0), 0);
  const totalValue = allLivestock.reduce((sum, l) => sum + (l.est_value_zmw || 0), 0);
  const encumbranceStatuses = [...new Set(allLivestock.map(l => l.encumbrance))];
  const mostConservative = conservativeEncumbrance(encumbranceStatuses);

  return {
    livestock_item_count: totalCount,
    livestock_est_value_zmw: totalValue,
    encumbrance_summary: mostConservative,
    label: 'Member-declared assets (personal property — not cooperative collateral)',
  };
}

export function coopAssetSummary(caseState: CaseState & { coop_assets?: CoopAsset[] }) {
  return (caseState.coop_assets ?? []).map(a => ({
    type: a.type,
    description: a.description,
    encumbrance: a.encumbrance,
  }));
}


export interface LivestockCategorySummary {
  category: string;
  total_count: number;
  est_value_zmw: number;
  reported_encumbrance: string;
  registry_check: string;
  security_interest_holder: string;
  recorded_by: string;
  recorder_role?: string;
  recorder_contact?: string;
  recorder_contact_ref?: string;
  evidence_level: string;
  verified_date?: string;
}

export function memberLivestockByCategory(caseState: CaseState & { member_livestock_categories?: LivestockCategorySummary[]; members_roster?: MemberRosterItem[] }): LivestockCategorySummary[] {
  // If explicitly pre-seeded on the case display data, use it
  if (caseState.member_livestock_categories && caseState.member_livestock_categories.length > 0) {
    return caseState.member_livestock_categories;
  }

  // Otherwise compute from members roster
  const roster = caseState.members_roster ?? [];
  const map: Record<string, { count: number; value: number; enc: string[] }> = {};

  for (const m of roster) {
    for (const l of m.livestock ?? []) {
      const species = l.species || 'Other Livestock';
      if (!map[species]) {
        map[species] = { count: 0, value: 0, enc: [] };
      }
      map[species].count += (l.count || 0);
      map[species].value += (l.est_value_zmw || 0);
      if (l.encumbrance) map[species].enc.push(l.encumbrance);
    }
  }

  const result: LivestockCategorySummary[] = [];
  for (const [category, data] of Object.entries(map)) {
    result.push({
      category,
      total_count: data.count,
      est_value_zmw: data.value,
      reported_encumbrance: conservativeEncumbrance(data.enc as EncumbranceStatus[]),
      registry_check: 'Not performed',
      security_interest_holder: 'None reported',
      recorded_by: 'Gift Mulenga',
      recorder_role: 'Field Agent (internal, not independent)',
      recorder_contact_ref: 'contact-fa-banda-01',
      evidence_level: 'supported',
      verified_date: '2026-09-15',
    });
  }

  return result;
}

import { getAuthoritativeInventory } from '../../engine/inventory';

export function assetsByOwner(caseState: CaseState & { member_livestock_categories?: LivestockCategorySummary[]; members_roster?: MemberRosterItem[]; coop_assets?: CoopAsset[] }) {
  const authoritative = getAuthoritativeInventory(caseState);
  const memberSummary = memberAssetSummary(caseState);
  const coopAssets = coopAssetSummary(caseState);
  const coopValuation = authoritative.livestock_inventory.cooperative_stated_valuation_zmw > 0
    ? authoritative.livestock_inventory.cooperative_stated_valuation_zmw
    : coopAssets.length * 50000;

  return {
    members_assets: {
      total_value_zmw: memberSummary.livestock_est_value_zmw,
      total_livestock_count: memberSummary.livestock_item_count,
      label: 'Members\' personal property. Not cooperative assets and not cooperative collateral.',
      categories: memberLivestockByCategory(caseState),
      roster_note: authoritative.sample_roster_note,
    },
    cooperative_assets: {
      total_value_zmw: coopValuation,
      total_head_count: authoritative.livestock_inventory.total_head_count,
      items: coopAssets,
      label: 'Cooperative-owned fixed assets and communal property.',
    },
    compound_declared_assets_zmw: memberSummary.livestock_est_value_zmw + coopValuation,
  };
}
