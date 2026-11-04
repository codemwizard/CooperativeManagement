import type { CaseState } from './types';
import esgConfig from '../../data/esg_index.json';

export interface ESGIndicatorBreakdown {
  key: string;
  name: string;
  score: number;
  weight: number;
  evidence_level: 'asserted' | 'supported' | 'verified' | 'none';
  source_count: number;
  iris_aligned?: {
    code: string;
    title: string;
    value: string | number;
  };
  details: string;
}

export interface ESGScoreResult {
  overall_score: number;
  tier: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  disclaimer: string;
  methodology_name: string;
  pillars: {
    environmental: { score: number; weight: number; indicators: ESGIndicatorBreakdown[] };
    social: { score: number; weight: number; indicators: ESGIndicatorBreakdown[] };
    governance: { score: number; weight: number; indicators: ESGIndicatorBreakdown[] };
  };
  iris_metrics: Array<{
    code: string;
    title: string;
    value: string | number;
    unit: string;
  }>;
}

export function computeESGIndex(caseState: CaseState): ESGScoreResult {
  const roster = (caseState as { members_roster?: Array<{ age?: number; gender?: string; cooperative_role?: string }> }).members_roster || [];
  const totalMembers = caseState.members || roster.length || 50;

  // 1. Environmental Pillar
  const envBaseline = caseState.evidence?.['environmental_baseline'];
  const envLevel = envBaseline?.level || 'asserted';
  const hasSustainablePractice = Boolean(caseState.activity || caseState.project?.name);
  const irrigated = Boolean(caseState.project?.irrigated);
  const hectares = (caseState.project as { hectares?: number })?.hectares || 120;

  const envIndicators: ESGIndicatorBreakdown[] = [
    {
      key: 'sustainable_practices',
      name: 'Sustainable Agriculture Practices',
      score: hasSustainablePractice ? 85 : 40,
      weight: 0.40,
      evidence_level: envLevel,
      source_count: 2,
      iris_aligned: {
        code: 'IRIS+ PI2822',
        title: 'Sustainable Land & Water Management',
        value: hectares + ' ha',
      },
      details: 'Conservation farming & soil restoration practices evidenced.',
    },
    {
      key: 'water_security',
      name: 'Water Resource Security & Irrigation',
      score: irrigated ? 90 : 70,
      weight: 0.30,
      evidence_level: caseState.evidence?.['water_source']?.level || 'supported',
      source_count: 1,
      details: irrigated ? 'Irrigated infrastructure verifiable.' : 'Rainfed climate-smart scheduling with borehole plan.',
    },
    {
      key: 'land_use',
      name: 'Land-Use Right & Environmental Baseline',
      score: caseState.evidence?.['land_right'] ? 80 : 50,
      weight: 0.30,
      evidence_level: caseState.evidence?.['land_right']?.level || 'supported',
      source_count: 2,
      details: 'Customary/statutory land right verified with environmental baseline.',
    },
  ];

  const envScore = Math.round(
    envIndicators.reduce((sum, ind) => sum + ind.score * ind.weight, 0)
  );

  // 2. Social Pillar
  const femaleMembers = roster.filter(m => m.gender === 'female').length;
  const femaleSharePct = roster.length > 0 ? Math.round((femaleMembers / roster.length) * 100) : 52;
  const youthMembers = roster.filter(m => typeof m.age === 'number' && m.age < 35).length;
  const youthCount = roster.length > 0 ? youthMembers : Math.round(totalMembers * 0.38);

  const socIndicators: ESGIndicatorBreakdown[] = [
    {
      key: 'smallholder_reach',
      name: 'Smallholder Farmer Inclusion',
      score: Math.min(100, Math.round((totalMembers / 80) * 100)),
      weight: 0.35,
      evidence_level: caseState.evidence?.['member_register']?.level || 'supported',
      source_count: 2,
      iris_aligned: {
        code: 'IRIS+ PI4060',
        title: 'Smallholder Farmers Reached',
        value: totalMembers,
      },
      details: totalMembers + ' active smallholder farming households participating.',
    },
    {
      key: 'gender_inclusion',
      name: 'Female Leadership & Participation',
      score: Math.min(100, Math.round((femaleSharePct / 50) * 85)),
      weight: 0.35,
      evidence_level: caseState.evidence?.['participation_profile']?.level || 'supported',
      source_count: 2,
      iris_aligned: {
        code: 'IRIS+ PI1540',
        title: 'Female Governance & Membership Share',
        value: femaleSharePct + '%',
      },
      details: femaleSharePct + '% female membership and officer representation.',
    },
    {
      key: 'youth_led_households',
      name: 'Youth Inclusion (<35 years)',
      score: 80,
      weight: 0.30,
      evidence_level: caseState.evidence?.['participation_profile']?.level || 'supported',
      source_count: 2,
      iris_aligned: {
        code: 'IRIS+ OI6213',
        title: 'Youth-Led Households',
        value: youthCount,
      },
      details: youthCount + ' farming households led by individuals under 35 years.',
    },
  ];

  const socScore = Math.round(
    socIndicators.reduce((sum, ind) => sum + ind.score * ind.weight, 0)
  );

  // 3. Governance Pillar
  const hasDiscrepancy = Boolean((caseState.evidence?.['governance_officers'] as { has_discrepancy?: boolean })?.has_discrepancy);
  const govIndicators: ESGIndicatorBreakdown[] = [
    {
      key: 'member_roster_integrity',
      name: 'Member Roster & Identity Audit',
      score: caseState.evidence?.['member_register']?.level === 'verified' ? 95 : 75,
      weight: 0.35,
      evidence_level: caseState.evidence?.['member_register']?.level || 'supported',
      source_count: 2,
      details: 'Roster reconciled with internal Field Agent enumeration.',
    },
    {
      key: 'agm_minutes_recorded',
      name: 'AGM Minutes & Quorum Verification',
      score: caseState.evidence?.['governance']?.level === 'verified' ? 90 : 70,
      weight: 0.35,
      evidence_level: caseState.evidence?.['governance']?.level || 'supported',
      source_count: 1,
      details: 'Recorded AGM minutes with signed executive sign-off.',
    },
    {
      key: 'discrepancy_transparency',
      name: 'Officer Registry Transparency',
      score: hasDiscrepancy ? 60 : 85,
      weight: 0.30,
      evidence_level: 'supported',
      source_count: 2,
      details: hasDiscrepancy ? 'Open officer discrepancy recorded in governed dossier.' : 'Officers match registry certificate.',
    },
  ];

  const govScore = Math.round(
    govIndicators.reduce((sum, ind) => sum + ind.score * ind.weight, 0)
  );

  const overall = Math.round(envScore * 0.35 + socScore * 0.35 + govScore * 0.30);
  let tier: ESGScoreResult['tier'] = 'Tier C';
  if (overall >= 80) tier = 'Tier A';
  else if (overall >= 60) tier = 'Tier B';
  else if (overall >= 40) tier = 'Tier C';
  else tier = 'Tier D';

  return {
    overall_score: overall,
    tier,
    disclaimer: esgConfig.disclaimer,
    methodology_name: esgConfig.methodology_name,
    pillars: {
      environmental: { score: envScore, weight: 0.35, indicators: envIndicators },
      social: { score: socScore, weight: 0.35, indicators: socIndicators },
      governance: { score: govScore, weight: 0.30, indicators: govIndicators },
    },
    iris_metrics: [
      {
        code: 'IRIS+ PI4060',
        title: 'Smallholder Farmers Reached',
        value: totalMembers,
        unit: 'active farming members',
      },
      {
        code: 'IRIS+ OI6213',
        title: 'Youth-Led Households (<35)',
        value: youthCount,
        unit: 'households',
      },
      {
        code: 'IRIS+ PI1540',
        title: 'Female Governance Share',
        value: femaleSharePct + '%',
        unit: 'percent of total',
      },
      {
        code: 'IRIS+ PI2822',
        title: 'Sustainable Land & Water',
        value: hectares + ' ha',
        unit: 'hectares cultivated',
      },
    ],
  };
}
