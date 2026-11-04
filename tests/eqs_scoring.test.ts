import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import {
  computeEvidenceQualityScore,
  getActiveIndicators,
  type IndicatorDefinition,
  INDICATOR_DEFINITIONS,
  _computeEvidenceQualityScoreWithDefinitions,
} from '../src/engine/eqs';
import { baselineCases, clone } from '../src/engine/data';
import { EqsCard } from '../src/components/shell/EqsCard';
import type { CaseState } from '../src/engine/types';

describe('Phase R4: Proprietary Evidence Quality Score (EQS) Engine (Gate 4)', () => {
  const case1 = baselineCases.find((c) => c.id === 'case-1')!;

  it('T4.5 Computes baseline EQS composite score for Chisamba Farmers Cooperative', () => {
    const result = computeEvidenceQualityScore(case1);

    expect(result.case_id).toBe('case-1');
    expect(result.composite_score).toBe(74); // (1.00 + 0.65 + 0.65 + 0.65) / 4 * 100 = 73.75 -> 74
    expect(result.grade).toBe('B');
    expect(result.confidence_rating).toBe('Medium');
    expect(result.metrics.length).toBe(4);

    const g1 = result.metrics.find((m) => m.code === 'G1')!;
    expect(g1.evidence_level).toBe('verified');
    expect(g1.raw_score).toBe(1.0);

    const e1 = result.metrics.find((m) => m.code === 'E1')!;
    expect(e1.evidence_level).toBe('supported');
    expect(e1.raw_score).toBe(0.65);

    // Pillar breakdown assertions (Section 4.5)
    expect(result.pillars.governance.score).toBeGreaterThan(0);
    expect(result.pillars.environmental.score).toBeGreaterThan(0);
    expect(result.pillars.social.score).toBeGreaterThan(0);
    expect(result.methodology_version).toBe('EQS-V1-PROVISIONAL');
  });

  it('T4.6 High verification coverage yields Grade A and High confidence rating', () => {
    const verifiedCase: CaseState = clone(case1);
    for (const key of ['registration', 'land_right', 'member_register', 'governance']) {
      if (verifiedCase.evidence[key]) {
        verifiedCase.evidence[key].level = 'verified';
      }
    }

    const result = computeEvidenceQualityScore(verifiedCase);
    expect(result.composite_score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.confidence.rating).toBe('High');
    expect(result.confidence_rating).toBe('High');
    expect(result.summary.verified_count).toBe(4);
  });

  it('T4.7 Handles all 4 applicability states properly', () => {
    const testCase: CaseState = clone(case1);

    // E1 is declared not_applicable
    (testCase.evidence['land_right'] as any).not_applicable = true;

    // S1 is declared absent by cooperative
    (testCase.evidence['member_register'] as any).declared_absent = true;

    // G3 has absence_evidenced
    (testCase.evidence['governance'] as any).absence_evidenced = true;

    // Delete registration to test unresolved
    delete testCase.evidence['registration'];

    const result = computeEvidenceQualityScore(testCase);

    const e1 = result.metrics.find((m) => m.code === 'E1')!;
    expect(e1.applicability_state).toBe('not_applicable');
    expect(result.summary.total_applicable_weight).toBe(75); // E1's 25 weight excluded from denominator

    const s1 = result.metrics.find((m) => m.code === 'S1')!;
    expect(s1.applicability_state).toBe('declared_absent');
    expect(s1.raw_score).toBe(0.0);

    const g3 = result.metrics.find((m) => m.code === 'G3')!;
    expect(g3.applicability_state).toBe('absence_evidenced');
    expect(g3.raw_score).toBe(0.0);

    const g1 = result.metrics.find((m) => m.code === 'G1')!;
    expect(g1.applicability_state).toBe('unresolved');
    expect(g1.raw_score).toBe(0.0);
    expect(result.exceptions.some((e) => e.code.includes('G1'))).toBe(true);
    expect(result.exceptions.find((e) => e.code.includes('G1'))?.actionable_remediation).toBeDefined();
  });

  it('T4.8 Unresolved conflict caps indicator score at 0.30 and strictly downgrades confidence to Low', () => {
    const conflictedCase: CaseState = clone(case1);
    conflictedCase.evidence['registration'].conflict_state = 'unresolved_conflict';

    const result = computeEvidenceQualityScore(conflictedCase);
    const g1 = result.metrics.find((m) => m.code === 'G1')!;

    expect(g1.conflict_state).toBe('unresolved_conflict');
    expect(g1.raw_score).toBe(0.30);
    // Section 4.5 Invariant 1: Unresolved contradiction strictly downgrades confidence to Low
    expect(result.confidence.rating).toBe('Low');
    expect(result.confidence_rating).toBe('Low');
    expect(result.confidence.explanation).toContain('Confidence downgraded to Low');
    expect(result.exception_alerts.some((a) => a.includes('unresolved verification finding conflict'))).toBe(true);
  });

  it('T4.9 Emits mandatory anti-inference guardrails and methodology disclaimer', () => {
    const result = computeEvidenceQualityScore(case1);

    expect(result.anti_inference_guardrails.length).toBe(4);
    expect(result.anti_inference_guardrails.some((g) => g.includes('Customary land tenure confirmation'))).toBe(true);
    expect(result.anti_inference_guardrails.some((g) => g.includes('Member register currency'))).toBe(true);
    expect(result.anti_inference_guardrails.some((g) => g.includes('Statutory registration'))).toBe(true);
    expect(result.anti_inference_guardrails.some((g) => g.includes('Executive resolution backing'))).toBe(true);
    expect(result.methodology_disclaimer).toContain('Proprietary Evidence Quality Score');
    expect(result.methodology_disclaimer).toContain('measures evidence integrity and provenance depth');
  });

  describe('Gate G3: B8 Native Governed Workflow Mappings', () => {
    it('1. Clear members_roster on a case previously scoring S1 >= asserted -> S1 drops to 0 and MISSING_S1 exception appears', () => {
      const testCase = clone(case1);
      testCase.members_roster = [];
      delete testCase.evidence['member_register'];

      const result = computeEvidenceQualityScore(testCase);
      const s1 = result.metrics.find((m) => m.code === 'S1')!;
      expect(s1.raw_score).toBe(0.0);
      expect(result.exceptions.some((e) => e.code === 'MISSING_S1')).toBe(true);
    });

    it('2. Set members_roster on otherwise complete case, no field-agent verification event -> S1 capped at 0.25 [PROVISIONAL]', () => {
      const testCase = clone(case1);
      delete testCase.evidence['member_register'];
      testCase.members_roster = [{ member_id: 'mbr-099', name: 'Field Member', cooperative_role: 'Member' }];
      testCase.events = []; // no field-agent event

      const result = computeEvidenceQualityScore(testCase);
      const s1 = result.metrics.find((m) => m.code === 'S1')!;
      expect(s1.raw_score).toBe(0.25);
    });

    it('3. Remove all entries from governance.officers -> G3 drops to 0, MISSING_G3 exception appears', () => {
      const testCase = clone(case1);
      testCase.officers = {};
      delete testCase.evidence['governance'];

      const result = computeEvidenceQualityScore(testCase);
      const g3 = result.metrics.find((m) => m.code === 'G3')!;
      expect(g3.raw_score).toBe(0.0);
      expect(result.exceptions.some((e) => e.code === 'MISSING_G3')).toBe(true);
    });

    it('4. Set conflict_state: "unresolved_conflict" on evidence.land_right -> E1 capped at 0.30 and confidence strictly Low [PROVISIONAL]', () => {
      const testCase = clone(case1);
      testCase.evidence['land_right'].conflict_state = 'unresolved_conflict';

      const result = computeEvidenceQualityScore(testCase);
      const e1 = result.metrics.find((m) => m.code === 'E1')!;
      expect(e1.raw_score).toBe(0.30);
      expect(result.confidence.rating).toBe('Low');
      expect(result.confidence_rating).toBe('Low');
    });

    it('5. Change caseState.district only -> no indicator score changes and fingerprint remains identical', () => {
      const testCase = clone(case1);
      testCase.district = 'Ndola Central District (Non-Score Field)';

      const baseResult = computeEvidenceQualityScore(case1);
      const mutatedResult = computeEvidenceQualityScore(testCase);

      expect(mutatedResult.composite_score).toBe(baseResult.composite_score);
      expect(mutatedResult.calculation_id).toBe(baseResult.calculation_id);
      expect(mutatedResult.input_fingerprint).toBe(baseResult.input_fingerprint);
      expect(mutatedResult.metrics.map((m) => m.raw_score)).toEqual(baseResult.metrics.map((m) => m.raw_score));
    });
  });

  describe('Gate G4: B5 Denominator State Machine & Register Guard', () => {
    it('1. Nonzero-weight synthetic asset criterion in isolated indicator set: absence_evidenced excludes exact weight and predictably alters composite', () => {
      const syntheticIndicators: IndicatorDefinition[] = [
        {
          code: 'A1_SYNTH',
          name: 'Synthetic Agricultural Irrigation Asset',
          dimension: 'Environmental',
          criterion_nature: 'asset',
          absence_outcome: 'neutral_exclusion',
          weight: 25,
          evidence_types: ['irrigation_asset'],
          anti_inference_guardrail: 'Synthetic test guardrail',
          remediation: 'Attach irrigation certificate',
        },
        {
          code: 'E1',
          name: 'Customary Land Tenure',
          dimension: 'Environmental',
          criterion_nature: 'safeguard',
          absence_outcome: 'neutral_exclusion',
          weight: 25,
          evidence_types: ['land_right'],
          anti_inference_guardrail: 'Land right guardrail',
          remediation: 'Attach customary occupancy letter',
        },
      ];

      // A: When irrigation_asset is verified (applicable weight = 25 + 25 = 50)
      const caseEval = clone(case1);
      caseEval.evidence['irrigation_asset'] = {
        level: 'verified',
        supplied_by: 'coop',
        supplied_on: '2026-10-17',
        verified_by: 'vrf.mulenga',
        verified_on: '2026-10-17',
        valid_until: null,
        limitation: 'Verified',
        history: [],
      };
      const resEval = computeEvidenceQualityScore(caseEval, '2026-10-17', syntheticIndicators);
      expect(resEval.summary.total_applicable_weight).toBe(50);

      // B: When irrigation_asset is demonstrably absent and verified (absence_evidenced)
      const caseExcluded = clone(caseEval);
      (caseExcluded.evidence['irrigation_asset'] as any).absence_evidenced = true;
      const resExcluded = computeEvidenceQualityScore(caseExcluded, '2026-10-17', syntheticIndicators);

      // Applicable denominator weight decreases by exactly 25
      expect(resExcluded.summary.total_applicable_weight).toBe(25);
      // E1 is 0.65 -> (0.65 * 25) / 25 * 100 = 65
      expect(resExcluded.composite_score).toBe(65);
    });

    it('2. Same synthetic asset criterion, absence claimed but unverified (declared_absent) -> retained in denominator with 0 points and warning exception', () => {
      const syntheticIndicators: IndicatorDefinition[] = [
        {
          code: 'A1_SYNTH',
          name: 'Synthetic Agricultural Irrigation Asset',
          dimension: 'Environmental',
          criterion_nature: 'asset',
          absence_outcome: 'neutral_exclusion',
          weight: 25,
          evidence_types: ['irrigation_asset'],
          anti_inference_guardrail: 'Synthetic test guardrail',
          remediation: 'Attach irrigation certificate',
        },
        {
          code: 'E1',
          name: 'Customary Land Tenure',
          dimension: 'Environmental',
          criterion_nature: 'safeguard',
          absence_outcome: 'neutral_exclusion',
          weight: 25,
          evidence_types: ['land_right'],
          anti_inference_guardrail: 'Land right guardrail',
          remediation: 'Attach customary occupancy letter',
        },
      ];

      const caseUnverified = clone(case1);
      caseUnverified.evidence['irrigation_asset'] = {
        level: 'asserted',
        supplied_by: 'coop',
        supplied_on: '2026-10-17',
        verified_by: null,
        verified_on: null,
        valid_until: null,
        limitation: 'Coop claim',
        history: [],
        declared_absent: true,
      };

      const res = computeEvidenceQualityScore(caseUnverified, '2026-10-17', syntheticIndicators);
      // Weight is retained in denominator (50 total)
      expect(res.summary.total_applicable_weight).toBe(50);
      const a1 = res.metrics.find((m) => m.code === 'A1_SYNTH')!;
      expect(a1.raw_score).toBe(0.0);
      expect(res.exceptions.some((e) => e.code === 'UNVERIFIED_ABSENCE_A1_SYNTH')).toBe(true);
    });

    it('3. Safeguard indicator missing -> retained in denominator, 0 points, critical exception', () => {
      const caseMissingSafeguard = clone(case1);
      delete caseMissingSafeguard.evidence['land_right'];

      const res = computeEvidenceQualityScore(caseMissingSafeguard);
      const e1 = res.metrics.find((m) => m.code === 'E1')!;
      expect(e1.raw_score).toBe(0.0);
      expect(res.summary.total_applicable_weight).toBe(100);
      expect(res.exceptions.some((e) => e.code === 'MISSING_E1' && e.severity === 'critical')).toBe(true);
    });

    it('4. Active indicator register guard -> strictly asserts exactly ["E1", "S1", "G1", "G3"]', () => {
      expect(getActiveIndicators()).toEqual(['E1', 'S1', 'G1', 'G3']);
    });

    it('5. All criteria excluded -> unevaluable_composite: true, overall_score: null, no arithmetic error', () => {
      const caseAllExcluded = clone(case1);
      for (const key of Object.keys(caseAllExcluded.evidence)) {
        (caseAllExcluded.evidence[key] as any).not_applicable = true;
      }

      const res = computeEvidenceQualityScore(caseAllExcluded);
      expect(res.unevaluable_composite).toBe(true);
      expect(res.overall_score).toBeNull();
      expect(res.composite_score).toBeNull();
      expect(res.grade).toBe('N/A');
      expect(res.exceptions.some((e) => e.code === 'DATA_ABSENT_ALL_PILLARS')).toBe(true);
    });
  });

  describe('Gate G5: B9 Empty-Pillar Handling and Composite Mathematics', () => {
    it('1. Unevaluable E-pillar -> evaluable: false, applicable_count: 0, warning exception, pillar_coverage_ratio: "2/3"', () => {
      const caseUnevalE = clone(case1);
      (caseUnevalE.evidence['land_right'] as any).not_applicable = true;

      const res = computeEvidenceQualityScore(caseUnevalE);
      expect(res.pillars.environmental.evaluable).toBe(false);
      expect(res.pillars.environmental.applicable_count).toBe(0);
      expect(res.pillars.environmental.score).toBe(0);
      expect(res.pillar_coverage_ratio).toBe('2/3');
      expect(res.exceptions.some((e) => e.code === 'DATA_ABSENT_PILLAR_ENVIRONMENTAL' && e.severity === 'warning')).toBe(true);

      // Remaining 3 indicators (each weight 25 -> total 75)
      expect(res.summary.total_applicable_weight).toBe(75);
    });

    it('2. Evaluable zero -> applicable indicator exists, evidence missing -> evaluable: true, score: 0', () => {
      const caseEvalZero = clone(case1);
      delete caseEvalZero.evidence['land_right']; // missing safeguard

      const res = computeEvidenceQualityScore(caseEvalZero);
      expect(res.pillars.environmental.evaluable).toBe(true);
      expect(res.pillars.environmental.applicable_count).toBe(1);
      expect(res.pillars.environmental.score).toBe(0);
      expect(res.exceptions.some((e) => e.code === 'DATA_ABSENT_PILLAR_ENVIRONMENTAL')).toBe(false);
    });

    it('3. All pillars unevaluable -> overall_score: null, DATA_ABSENT_ALL_PILLARS emitted', () => {
      const caseAllUneval = clone(case1);
      (caseAllUneval.evidence['land_right'] as any).not_applicable = true;
      (caseAllUneval.evidence['member_register'] as any).not_applicable = true;
      (caseAllUneval.evidence['registration'] as any).not_applicable = true;
      (caseAllUneval.evidence['governance'] as any).not_applicable = true;

      const res = computeEvidenceQualityScore(caseAllUneval);
      expect(res.unevaluable_composite).toBe(true);
      expect(res.overall_score).toBeNull();
      expect(res.exceptions.some((e) => e.code === 'DATA_ABSENT_ALL_PILLARS')).toBe(true);
    });
  });

  describe('Gate G9: B6 Calculation Identity and Pure Function', () => {
    it('1. Calling computeEvidenceQualityScore twice produces identical calculation_id, fingerprint, and scores', () => {
      const res1 = computeEvidenceQualityScore(case1);
      const res2 = computeEvidenceQualityScore(case1);

      expect(res1.calculation_id).toBe(res2.calculation_id);
      expect(res1.input_fingerprint).toBe(res2.input_fingerprint);
      expect(res1.composite_score).toBe(res2.composite_score);
      expect(res1.pillars).toEqual(res2.pillars);
      expect(res1.calculation_identity.calculation_id).toHaveLength(64);
    });

    it('2. Mutating score-relevant field changes input_fingerprint, calculation_id, and scores', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      mutated.evidence['land_right'].level = 'asserted';

      const resMutated = computeEvidenceQualityScore(mutated);
      expect(resMutated.input_fingerprint).not.toBe(baseline.input_fingerprint);
      expect(resMutated.calculation_id).not.toBe(baseline.calculation_id);
      expect(resMutated.composite_score).not.toBe(baseline.composite_score);
    });

    it('3. Mutating non-score-relevant field (district) leaves input_fingerprint and calculation_id unchanged', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      mutated.district = 'Kabwe Urban Area';

      const resNonScore = computeEvidenceQualityScore(mutated);
      expect(resNonScore.input_fingerprint).toBe(baseline.input_fingerprint);
      expect(resNonScore.calculation_id).toBe(baseline.calculation_id);
      expect(resNonScore.composite_score).toBe(baseline.composite_score);
    });

    it('4. Pure function: input CaseState is not modified in any way', () => {
      const originalInput = clone(case1);
      const inputUnderTest = clone(case1);

      computeEvidenceQualityScore(inputUnderTest);
      expect(inputUnderTest).toEqual(originalInput);
    });
  });

  describe('Gate G6: B2 Proprietary Weights Concealed in UI', () => {
    it('Rendered EqsCard output does not contain "Weight: <digit>%" and contains mandatory methodology disclaimer', () => {
      const html = renderToString(React.createElement(EqsCard, { caseState: case1 }));

      // Strictly assert no weight percentages are rendered
      expect(html).not.toMatch(/Weight:\s*\d+%/);

      // Assert methodology disclaimer is present
      expect(html).toContain(
        'Proprietary illustrative methodology. Scoring weights and calibration parameters are governed internally and are not disclosed.'
      );
    });
  });

  describe('Gate G7: B3 Pillar Presentation with Evaluability', () => {
    it('All three eqs-pillar-* test IDs render fixture-expected values; unevaluable renders Unevaluable badge', () => {
      // 1. Render complete baseline case
      const html = renderToString(React.createElement(EqsCard, { caseState: case1 }));
      expect(html).toContain('data-testid="eqs-pillar-environmental"');
      expect(html).toContain('data-testid="eqs-pillar-social"');
      expect(html).toContain('data-testid="eqs-pillar-governance"');

      // 2. Render case with unevaluable E-pillar
      const unevalCase = clone(case1);
      (unevalCase.evidence['land_right'] as any).not_applicable = true;
      const unevalHtml = renderToString(React.createElement(EqsCard, { caseState: unevalCase }));

      expect(unevalHtml).toContain('Unevaluable — no applicable criteria for this case');
      // Must not render 0/100 for an unevaluable pillar
      expect(unevalHtml).not.toContain('0/100');
    });
  });

  describe('Gate G8: B4 Methodology Specification Published', () => {
    it('docs/EQS_METHODOLOGY_SPECIFICATION.md exists, registers all 10 indicators, locks version contract, and labels provisional constants', () => {
      const specPath = path.resolve(process.cwd(), 'docs/EQS_METHODOLOGY_SPECIFICATION.md');
      expect(fs.existsSync(specPath)).toBe(true);

      const content = fs.readFileSync(specPath, 'utf-8');
      expect(content).toContain('SYMPHONY-EQS-METHODOLOGY-SPEC-V1-PROVISIONAL');
      expect(content).toContain('EQS-V1-PROVISIONAL');

      // All 10 indicators registered
      const expectedCodes = ['E1', 'E2', 'E3', 'S1', 'S2', 'S3', 'S4', 'G1', 'G2', 'G3'];
      for (const code of expectedCodes) {
        expect(content).toContain(`**${code}**`);
      }

      // Provisional Constants section present
      expect(content).toContain('Provisional Constants');
      expect(content).toContain('[PROVISIONAL]');
    });
  });

  describe('Gate G9-EXT: B6 Extended Change-Sensitivity Tests', () => {
    it('5. Changing evalDate changes input_fingerprint and calculation_id', () => {
      const res1 = computeEvidenceQualityScore(case1, '2026-10-06');
      const res2 = computeEvidenceQualityScore(case1, '2027-10-06');
      expect(res1.input_fingerprint).not.toBe(res2.input_fingerprint);
      expect(res1.calculation_id).not.toBe(res2.calculation_id);
    });

    it('6. Changing members (score-relevant) changes input_fingerprint', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).members = 999;
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).not.toBe(baseline.input_fingerprint);
    });

    it('7. Changing members_roster_note (score-relevant) changes input_fingerprint', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).members_roster_note = 'CHANGED ROSTER NOTE — score must reflect';
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).not.toBe(baseline.input_fingerprint);
    });

    it('8. Adding unverified_roster flag (score-relevant) changes input_fingerprint', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).unverified_roster = true;
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).not.toBe(baseline.input_fingerprint);
    });

    it('9. Adding a score-relevant event changes input_fingerprint', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).events = [
        {
          id: 'evt-test-1',
          action: 'record_agent_observation',
          at: '2026-10-01T10:00:00Z',
          actor: { user_id: 'fa.banda', role: 'field_agent' },
          target: { claim_id: 'member_register' },
          before: null,
          after: {},
        },
      ];
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).not.toBe(baseline.input_fingerprint);
    });

    it('10. Adding a non-score event (cosmetic) does NOT change input_fingerprint', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).events = [
        {
          id: 'evt-cosm-1',
          action: 'view_case', // not in SCORE_RELEVANT_ACTIONS
          at: '2026-10-01T10:00:00Z',
          actor: { user_id: 'pfi.analyst1', role: 'pfi_analyst' },
          target: null,
          before: null,
          after: {},
        },
      ];
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).toBe(baseline.input_fingerprint);
    });

    it('11. Changing cosmetic title does NOT change input_fingerprint (title is not score-relevant)', () => {
      const baseline = computeEvidenceQualityScore(case1);
      const mutated = clone(case1);
      (mutated as any).title = 'CHANGED TITLE — not score relevant';
      const res = computeEvidenceQualityScore(mutated);
      expect(res.input_fingerprint).toBe(baseline.input_fingerprint);
    });
  });

  describe('Gate G10-EXT: B8 Native Workflow S1 and G3 Freshness Boundary Tests', () => {
    // S1 member_register.supplied_on boundary: 89/90/91 days before evalDate
    it('B8-S1-1. Roster age 89 days — below threshold — no STALE_S1 exception', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 89 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['member_register'] = {
        ...mutated.evidence['member_register'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'STALE_S1')).toBe(false);
    });

    it('B8-S1-2. Roster age exactly 90 days — at threshold — no STALE_S1 exception (boundary is >90, not >=90)', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 90 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['member_register'] = {
        ...mutated.evidence['member_register'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'STALE_S1')).toBe(false);
    });

    it('B8-S1-3. Roster age 91 days — above threshold — STALE_S1 exception emitted and score capped at 0.45', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 91 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['member_register'] = {
        ...mutated.evidence['member_register'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'STALE_S1')).toBe(true);
      const s1 = res.metrics.find((m) => m.code === 'S1')!;
      expect(s1.raw_score).toBeLessThanOrEqual(0.45);
    });

    // G3 AGM resolution supplied_on boundary: 729/730/731 days before evalDate
    it('B8-G3-1. AGM resolution age 729 days — below threshold — no EXPIRED_G3 exception', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 729 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['governance'] = {
        ...mutated.evidence['governance'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'EXPIRED_G3')).toBe(false);
    });

    it('B8-G3-2. AGM resolution age exactly 730 days — at threshold — no EXPIRED_G3 exception (boundary is >730)', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 730 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['governance'] = {
        ...mutated.evidence['governance'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'EXPIRED_G3')).toBe(false);
    });

    it('B8-G3-3. AGM resolution age 731 days — above threshold — EXPIRED_G3 exception emitted and score capped at 0.35', () => {
      const evalDate = '2026-10-06';
      const base = new Date(Date.parse(evalDate));
      const suppliedOn = new Date(base.getTime() - 731 * 24 * 60 * 60 * 1000);
      const mutated = clone(case1);
      mutated.evidence['governance'] = {
        ...mutated.evidence['governance'],
        supplied_on: suppliedOn.toISOString().slice(0, 10),
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(mutated, evalDate);
      expect(res.exceptions.some((e) => e.code === 'EXPIRED_G3')).toBe(true);
      const g3 = res.metrics.find((m) => m.code === 'G3')!;
      expect(g3.raw_score).toBeLessThanOrEqual(0.35);
    });
  });

  describe('Gate G-F: Per-Indicator Absence Semantics', () => {
    it('F1. safeguard_failure indicator: absence_evidenced yields rawScore 0.0 and ABSENT_REQUIRED exception', () => {
      // G1 absence_outcome = safeguard_failure
      const cs = clone(case1);
      (cs.evidence['registration'] as any).absence_evidenced = true;
      const res = computeEvidenceQualityScore(cs);
      const g1 = res.metrics.find((m) => m.code === 'G1')!;
      expect(g1.applicability_state).toBe('absence_evidenced');
      expect(g1.raw_score).toBe(0.0);
      expect(res.exceptions.some((e) => e.code === 'ABSENT_REQUIRED_G1' && e.severity === 'critical')).toBe(true);
    });

    it('F2. neutral_exclusion indicator: absence_evidenced excludes from denominator, no failure exception', () => {
      // E1 absence_outcome = neutral_exclusion
      const cs = clone(case1);
      (cs.evidence['land_right'] as any).absence_evidenced = true;
      const res = computeEvidenceQualityScore(cs);
      const e1 = res.metrics.find((m) => m.code === 'E1')!;
      expect(e1.applicability_state).toBe('absence_evidenced');
      expect(e1.raw_score).toBe(0.0);
      // Denominator excludes neutral_exclusion (3 of 4 indicators: 75 total weight)
      expect(res.summary.total_applicable_weight).toBe(75);
      expect(res.exceptions.some((e) => e.code === 'ABSENT_REQUIRED_E1')).toBe(false);
    });

    it('F3. Unsubstantiated declared_absent (without absence_evidenced) remains a warning, not a failure', () => {
      const cs = clone(case1);
      (cs.evidence['governance'] as any).declared_absent = true;
      delete (cs.evidence['governance'] as any).absence_evidenced;
      const res = computeEvidenceQualityScore(cs);
      const g3 = res.metrics.find((m) => m.code === 'G3')!;
      expect(g3.applicability_state).toBe('declared_absent');
      expect(res.exceptions.some((e) => e.code === 'UNVERIFIED_ABSENCE_G3' && e.severity === 'warning')).toBe(true);
      expect(res.exceptions.some((e) => e.code === 'ABSENT_REQUIRED_G3')).toBe(false);
    });
  });

  describe('Gate G-G: Staleness Ratio Integrity', () => {
    it('G1. stale_indicator_ratio is in [0.0, 1.0] when one indicator has both valid_until expired and supplied_on stale', () => {
      const evalDate = '2026-10-06';
      const cs = clone(case1);
      // Make member_register both expired (valid_until) and stale (supplied_on 120 days ago)
      const oldDate = new Date(Date.parse(evalDate) - 120 * 86400000);
      cs.evidence['member_register'] = {
        ...cs.evidence['member_register'],
        supplied_on: oldDate.toISOString().slice(0, 10),
        valid_until: '2025-01-01', // already expired
        level: 'supported',
      } as any;
      const res = computeEvidenceQualityScore(cs, evalDate);
      // stale_indicator_ratio must be bounded in [0, 1.0]
      expect(res.confidence.stale_indicator_ratio).toBeGreaterThanOrEqual(0);
      expect(res.confidence.stale_indicator_ratio).toBeLessThanOrEqual(1.0);
    });

    it('G2. No stale evidence: stale_indicator_ratio === 0.0', () => {
      // All evidence supplied within the last 30 days, no valid_until expired
      const evalDate = '2026-10-06';
      const cs = clone(case1);
      const recent = new Date(Date.parse(evalDate) - 30 * 86400000).toISOString().slice(0, 10);
      for (const key of Object.keys(cs.evidence)) {
        if (cs.evidence[key]) {
          cs.evidence[key] = { ...cs.evidence[key], supplied_on: recent, valid_until: '2027-12-31' } as any;
        }
      }
      const res = computeEvidenceQualityScore(cs, evalDate);
      expect(res.confidence.stale_indicator_ratio).toBe(0.0);
    });

    it('G3. All indicators stale: stale_indicator_ratio === 1.0 (does not exceed 1.0)', () => {
      const evalDate = '2026-10-06';
      const cs = clone(case1);
      const veryOld = '2020-01-01';
      for (const key of Object.keys(cs.evidence)) {
        if (cs.evidence[key]) {
          cs.evidence[key] = { ...cs.evidence[key], supplied_on: veryOld, valid_until: '2021-01-01' } as any;
        }
      }
      const res = computeEvidenceQualityScore(cs, evalDate);
      expect(res.confidence.stale_indicator_ratio).toBe(1.0);
    });
  });

  describe('Gate G-E: Calculation Identity Binds Indicator Definitions', () => {
    it('E1. Calculation identity changes when effective indicator definitions change', () => {
      const baseResult = computeEvidenceQualityScore(case1);
      // Construct a modified definitions set with a different weight
      const modifiedDefs = INDICATOR_DEFINITIONS.map((d) =>
        d.code === 'E1' ? { ...d, weight: 30 } : d
      );
      const modifiedResult = _computeEvidenceQualityScoreWithDefinitions(case1, undefined, modifiedDefs);
      expect(modifiedResult.calculation_id).not.toBe(baseResult.calculation_id);
      expect(modifiedResult.input_fingerprint).not.toBe(baseResult.input_fingerprint);
      expect(modifiedResult.composite_score).not.toBe(baseResult.composite_score);
    });
  });

  describe('Gate G-C: EQS Grade Provisional Status in UI', () => {
    it('EqsCard renders data-testid="eqs-provisional-label" containing "Provisional"', () => {
      const html = renderToString(React.createElement(EqsCard, { caseState: case1 }));
      expect(html).toContain('data-testid="eqs-provisional-label"');
      expect(html.toLowerCase()).toContain('provisional');
    });

    it('EqsCard methodology disclaimer contains non-reliance statement', () => {
      const html = renderToString(React.createElement(EqsCard, { caseState: case1 }));
      expect(html).toContain('data-testid="eqs-methodology-disclaimer"');
      expect(html).toContain('[PROVISIONAL]');
      expect(html.toLowerCase()).toContain('not for production');
    });
  });
});
