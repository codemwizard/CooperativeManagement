import type { CaseState, EvidenceItem } from './types';
import { meta } from './data';
import { canonicalSha256 } from './crypto';

export type ApplicabilityState = 'applicable' | 'not_applicable' | 'declared_absent' | 'absence_evidenced' | 'unresolved';

export interface IndicatorScore {
  code: string;
  name: string;
  dimension: 'Environmental' | 'Social' | 'Governance';
  criterion_nature: 'asset' | 'safeguard';
  weight: number;
  applicability_state: ApplicabilityState;
  evidence_type: string;
  evidence_level: string;
  has_discrepancy: boolean;
  conflict_state?: string;
  qualifications?: string[];
  raw_score: number; // 0.0 to 1.0
  weighted_score: number;
  limitation?: string;
  notes: string;
  anti_inference_guardrail: string;
}

export interface PillarScore {
  score: number; // 0 to 100 (0 when unevaluable)
  evaluable: boolean; // false when applicable_count === 0
  applicable_count: number;
  total_count: number;
  summary: string;
}

export interface EQSException {
  code: string;
  pillar: 'environmental' | 'social' | 'governance';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  actionable_remediation: string;
}

export interface EQSCalculationIdentity {
  calculation_id: string; // SHA-256(canonical(case_id + methodology_version + input_fingerprint))
  case_id: string;
  methodology_version: string;
  input_fingerprint: string; // SHA-256 of canonical JSON of score-relevant input fields
}

export interface EQSEvaluationEvent {
  evaluation_event_id: string;
  calculation_id: string;
  evaluated_at: string; // ISO 8601 UTC
  input_state_version: number;
}

export interface EvidenceQualityScoreResult {
  methodology_version: 'EQS-V1-PROVISIONAL';
  case_id: string;
  cooperative_name: string;
  evaluated_at: string;
  overall_score: number | null; // null when unevaluable_composite
  composite_score: number | null; // alias for overall_score
  unevaluable_composite?: boolean;
  pillar_coverage_ratio: string; // count of evaluable pillars / total pillars (e.g. "3/3", "2/3")
  calculation_identity: EQSCalculationIdentity;
  calculation_id: string;
  input_fingerprint: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'N/A';
  pillars: {
    environmental: PillarScore;
    social: PillarScore;
    governance: PillarScore;
  };
  confidence: {
    rating: 'High' | 'Medium' | 'Low';
    data_completeness_ratio: number;
    stale_indicator_ratio: number;
    explanation: string;
  };
  confidence_rating: 'High' | 'Medium' | 'Low'; // alias for confidence.rating
  exceptions: EQSException[];
  exception_alerts: string[]; // string list for UI cards
  metrics: IndicatorScore[];
  summary: {
    total_applicable_weight: number;
    verified_count: number;
    supported_count: number;
    asserted_count: number;
    missing_count: number;
    conflict_count: number;
    discrepancy_count: number;
  };
  anti_inference_guardrails: string[];
  methodology_disclaimer: string;
}

export interface IndicatorDefinition {
  code: string;
  name: string;
  dimension: 'Environmental' | 'Social' | 'Governance';
  criterion_nature: 'asset' | 'safeguard';
  absence_outcome: 'neutral_exclusion' | 'safeguard_positive' | 'safeguard_failure';
  weight: number;
  evidence_types: string[];
  anti_inference_guardrail: string;
  remediation: string;
  status?: 'active' | 'specification_only';
}

export const ACTIVE_INDICATOR_CODES: readonly string[] = Object.freeze(['E1', 'S1', 'G1', 'G3']);

export function getActiveIndicators(): string[] {
  return [...ACTIVE_INDICATOR_CODES];
}

export const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  {
    code: 'E1',
    name: 'Customary Land Tenure & Communal Use Rights',
    dimension: 'Environmental',
    criterion_nature: 'safeguard',
    absence_outcome: 'neutral_exclusion',
    weight: 25,
    evidence_types: ['land_right', 'land_tenure', 'land'],
    anti_inference_guardrail: 'Customary land tenure confirmation verifies lawful occupancy rights, but does not infer agricultural productivity, soil suitability, or flood resistance.',
    remediation: 'Obtain formal Chief or Headman customary land occupancy letter confirming allocated boundary and communal tenure.',
    status: 'active',
  },
  {
    code: 'S1',
    name: 'Member Register Currency & Active Participation',
    dimension: 'Social',
    criterion_nature: 'safeguard',
    absence_outcome: 'safeguard_failure',
    weight: 25,
    evidence_types: ['member_register', 'members_register', 'members'],
    anti_inference_guardrail: 'Member register currency verifies nominal roster standing, but does not infer individual member solvency, attendance consistency, or repayment capacity.',
    remediation: 'Conduct cooperative membership register update and field agent roster enumeration with verified contact reference IDs.',
    status: 'active',
  },
  {
    code: 'G1',
    name: 'Legal Statutory Standing & Regulatory Compliance',
    dimension: 'Governance',
    criterion_nature: 'safeguard',
    absence_outcome: 'safeguard_failure',
    weight: 25,
    evidence_types: ['registration', 'regulatory_filing'],
    anti_inference_guardrail: 'Statutory registration establishes legal cooperative entity formation, but does not guarantee ongoing commercial solvency or absence of unrecorded liabilities.',
    remediation: 'Submit PACRA or Registrar of Cooperatives registration certificate and verified annual return filing.',
    status: 'active',
  },
  {
    code: 'G3',
    name: 'Executive Resolution Backing & Borrowing Mandate',
    dimension: 'Governance',
    criterion_nature: 'safeguard',
    absence_outcome: 'safeguard_failure',
    weight: 25,
    evidence_types: ['governance', 'resolution', 'minutes'],
    anti_inference_guardrail: 'Executive resolution backing confirms valid committee authorization, but does not infer management execution competence or operational success.',
    remediation: 'Upload stamped AGM resolution minutes signed by cooperative chairman and secretary authorizing project participation.',
    status: 'active',
  },
];

/**
 * Computes deterministic SHA-256 over canonical JSON of score-relevant input fields only.
 * Excludes cosmetic or non-score-relevant fields (e.g. district, created_at, title, UI metadata).
 * The evalDate is part of the fingerprint because freshness checks (S1, G3) depend on it.
 */
export function computeInputFingerprint(
  caseState: CaseState,
  methodologyVersion = 'EQS-V1-PROVISIONAL',
  evalDate = meta.demo_date,
  definitions: IndicatorDefinition[] = INDICATOR_DEFINITIONS
): string {
  // Score-relevant actions: these are the only events that affect scoring
  const SCORE_RELEVANT_ACTIONS = new Set([
    'record_agent_observation',
    'assign_verification',
    'record_verification_finding',
    'submit_evidence',
    'record_claim',
    'mark_verified',
    'flag_discrepancy',
    'resolve_dispute',
  ]);

  // Slice evidence to score-relevant fields only (exclude description, notes, source, UI metadata)
  const scoreRelevantEvidence: Record<string, object> = {};
  for (const [key, item] of Object.entries(caseState.evidence || {})) {
    if (item) {
      scoreRelevantEvidence[key] = {
        level: (item as any).level ?? null,
        version_id: (item as any).version_id ?? null,
        conflict_state: (item as any).conflict_state ?? null,
        valid_until: (item as any).valid_until ?? null,
        has_discrepancy: (item as any).has_discrepancy ?? null,
        absence_evidenced: (item as any).absence_evidenced ?? null,
        qualifications: (item as any).qualifications ?? null,
        limitation: (item as any).limitation ?? null,
        supplied_on: (item as any).supplied_on ?? null,
        verified_on: (item as any).verified_on ?? null,
      };
    }
  }

  const scoreRelevantPayload = {
    case_id: caseState.id,
    methodology_version: methodologyVersion,
    eval_date: evalDate,
    definitions_fingerprint: canonicalSha256(
      definitions.map((d) => ({
        code: d.code,
        weight: d.weight,
        criterion_nature: d.criterion_nature,
        status: d.status,
        absence_outcome: d.absence_outcome,
      }))
    ),
    members: caseState.members ?? null,
    members_roster: (caseState as any).members_roster ?? null,
    members_roster_note: (caseState as any).members_roster_note ?? null,
    unverified_roster: (caseState as any).unverified_roster ?? null,
    officers: (caseState as any).officers ?? (caseState as any).governance?.officers ?? null,
    evidence: scoreRelevantEvidence,
    events: ((caseState as any).events as any[] ?? []).filter(
      (e: any) => e && SCORE_RELEVANT_ACTIONS.has(e.action)
    ).map((e: any) => ({ id: e.id, action: e.action, at: e.at, target: e.target ?? null })),
    findings: (caseState.verification?.findings || []).map((f) => ({
      id: f.id,
      assignment_id: f.assignment_id,
      result: f.result,
      basis: f.basis,
      qualifications: f.qualifications,
    })),
    registration_identifier:
      (caseState as any).registration_number ??
      (caseState as any).pacra_number ??
      (caseState as any).registration_no ??
      null,
  };
  return canonicalSha256(scoreRelevantPayload);
}

export function computeCalculationIdentity(
  caseId: string,
  methodologyVersion = 'EQS-V1-PROVISIONAL',
  inputFingerprint: string,
  definitionsFingerprint?: string
): EQSCalculationIdentity {
  const calculationId = canonicalSha256({
    case_id: caseId,
    methodology_version: methodologyVersion,
    input_fingerprint: inputFingerprint,
    ...(definitionsFingerprint ? { definitions_fingerprint: definitionsFingerprint } : {}),
  });
  return {
    calculation_id: calculationId,
    case_id: caseId,
    methodology_version: methodologyVersion,
    input_fingerprint: inputFingerprint,
  };
}

function findEvidence(caseState: CaseState, candidateTypes: string[]): { item: EvidenceItem | null; key: string } {
  for (const t of candidateTypes) {
    if (caseState.evidence && caseState.evidence[t]) {
      return { item: caseState.evidence[t], key: t };
    }
  }
  return { item: null, key: candidateTypes[0] };
}

export function computeEvidenceQualityScore(
  caseState: CaseState,
  evalDate = meta.demo_date,
  definitions = INDICATOR_DEFINITIONS
): EvidenceQualityScoreResult {
  const exceptions: EQSException[] = [];
  const exceptionAlerts: string[] = [];
  const metrics: IndicatorScore[] = [];

  let totalApplicableWeight = 0;
  let totalWeightedScore = 0;
  let verifiedWeight = 0;
  let supportedWeight = 0;

  let verifiedCount = 0;
  let supportedCount = 0;
  let assertedCount = 0;
  let missingCount = 0;
  let conflictCount = 0;
  let discrepancyCount = 0;
  const staleIndicatorSet = new Set<string>();

  for (const def of definitions) {
    let { item, key } = findEvidence(caseState, def.evidence_types);

    // Native Grounding: S1 checks members_roster and member_register
    if (def.code === 'S1') {
      const roster = (caseState as any).members_roster;
      if (Array.isArray(roster)) {
        if (roster.length === 0) {
          item = null;
        } else if (!item) {
          // Roster present without existing member_register evidence: treated as unverified asserted roster
          item = {
            level: 'asserted',
            supplied_by: 'coop',
            supplied_on: evalDate,
            verified_by: null,
            verified_on: null,
            valid_until: null,
            limitation: 'Member roster self-declared without field agent corroboration.',
            history: [],
          };
        }
      }
    }

    // Native Grounding: G3 checks officers array or object
    if (def.code === 'G3') {
      const officers = (caseState as any).officers ?? (caseState as any).governance?.officers;
      if (officers !== undefined) {
        const count = Array.isArray(officers) ? officers.length : Object.keys(officers).length;
        if (count === 0) {
          item = null;
        }
      }
    }

    // Native Grounding: G1 fallback to pacra_number / registration_no
    if (def.code === 'G1' && !item) {
      const regId = (caseState as any).pacra_number ?? (caseState as any).registration_no ?? (caseState as any).registration_number;
      if (regId && typeof regId === 'string') {
        item = {
          level: 'asserted',
          supplied_by: 'coop',
          supplied_on: evalDate,
          verified_by: null,
          verified_on: null,
          valid_until: null,
          limitation: 'Cooperative statutory registration self-declared number.',
          history: [],
        };
      }
    }

    let appState: ApplicabilityState = 'applicable';
    let rawScore = 0;
    let notes = '';
    const pillarName = def.dimension.toLowerCase() as 'environmental' | 'social' | 'governance';

    if (!item) {
      appState = 'unresolved';
      rawScore = 0.0;
      missingCount++;
      notes = 'Required governance record missing without declared rationale.';
      exceptions.push({
        code: `MISSING_${def.code}`,
        pillar: pillarName,
        severity: 'critical',
        message: `Indicator [${def.code}] ${def.name}: required evidence is missing.`,
        actionable_remediation: def.remediation,
      });
      exceptionAlerts.push(`Indicator [${def.code}] ${def.name}: evidence missing.`);
    } else {
      // Check applicability declarations on evidence item
      if ((item as any).not_applicable === true) {
        appState = 'not_applicable';
        rawScore = 0.0;
        notes = 'Declared not applicable to this cooperative structure.';
      } else if ((item as any).declared_absent === true) {
        appState = 'declared_absent';
        if (def.criterion_nature === 'asset') {
          // Unverified absence declaration on asset criterion: retained with 0 pts, warning exception
          rawScore = 0.0;
          notes = 'Asset declared absent by cooperative management without independent verification (retained with 0 points).';
          exceptions.push({
            code: `UNVERIFIED_ABSENCE_${def.code}`,
            pillar: pillarName,
            severity: 'warning',
            message: `Indicator [${def.code}]: asset declared absent without independent verification.`,
            actionable_remediation: def.remediation,
          });
          exceptionAlerts.push(`Indicator [${def.code}]: asset declared absent without independent verification.`);
        } else {
          // Safeguard criteria: declared absent without evidence -> retain with 0 pts (penalizes)
          rawScore = 0.0;
          notes = 'Safeguard declared absent without corroborating proof (retained with 0 points).';
          exceptions.push({
            code: `UNVERIFIED_ABSENCE_${def.code}`,
            pillar: pillarName,
            severity: 'warning',
            message: `Indicator [${def.code}]: declared absent without independent corroboration.`,
            actionable_remediation: def.remediation,
          });
          exceptionAlerts.push(`Indicator [${def.code}]: declared absent by cooperative management.`);
        }
      } else if ((item as any).absence_evidenced === true) {
        appState = 'absence_evidenced';
        switch (def.absence_outcome) {
          case 'neutral_exclusion':
            rawScore = 0.0;
            notes = 'Absence verifiably corroborated — criterion excluded from denominator (neutral).';
            break;
          case 'safeguard_positive':
            rawScore = 1.0;
            notes = 'Absence of harmful condition verifiably corroborated (safeguard-positive compliance).';
            break;
          case 'safeguard_failure':
            rawScore = 0.0;
            notes = 'Required control verifiably absent — this is a safeguard failure, not a positive outcome.';
            exceptions.push({
              code: `ABSENT_REQUIRED_${def.code}`,
              pillar: pillarName,
              severity: 'critical',
              message: `Indicator [${def.code}]: required ${def.name} is verifiably absent. This is a compliance failure.`,
              actionable_remediation: def.remediation,
            });
            exceptionAlerts.push(`Indicator [${def.code}]: required control confirmed absent — compliance failure.`);
            break;
        }
      } else {
        appState = 'applicable';

        const level = item.level ?? 'none';
        let hasDiscrepancy = Boolean(item.has_discrepancy);
        const isConflicted = item.conflict_state === 'unresolved_conflict';

        // S1 Native workflow checks: roster count discrepancy & field agent event check
        if (def.code === 'S1') {
          const roster = (caseState as any).members_roster;
          const isSampleRoster = Boolean((caseState as any).members_roster_note);
          if (!isSampleRoster && Array.isArray(roster) && typeof caseState.members === 'number' && caseState.members > 0) {
            const diff = Math.abs(roster.length - caseState.members);
            // [PROVISIONAL] >10% variance triggers discrepancy
            if (diff / caseState.members > 0.10) {
              hasDiscrepancy = true;
            }
          }
        }

        if (hasDiscrepancy) {
          discrepancyCount++;
          exceptions.push({
            code: `DISCREPANCY_${def.code}`,
            pillar: pillarName,
            severity: 'warning',
            message: `Indicator [${def.code}]: active discrepancy flag reported by observation.`,
            actionable_remediation: 'Re-conduct field visit or perform reconciliation of reported discrepancies.',
          });
          exceptionAlerts.push(`Indicator [${def.code}]: active discrepancy flag reported.`);
        }

        if (isConflicted) {
          conflictCount++;
          exceptions.push({
            code: `CONFLICT_${def.code}`,
            pillar: pillarName,
            severity: 'critical',
            message: `Indicator [${def.code}]: unresolved verification finding conflict blocks promotion.`,
            actionable_remediation: 'Record attributable conflict resolution with disposition and rationale.',
          });
          exceptionAlerts.push(`Indicator [${def.code}]: unresolved verification finding conflict.`);
        }

        // Validity check [PROVISIONAL]
        if (item.valid_until && item.valid_until < evalDate) {
          staleIndicatorSet.add(def.code);
          exceptions.push({
            code: `EXPIRED_${def.code}`,
            pillar: pillarName,
            severity: 'warning',
            message: `Indicator [${def.code}]: evidence expired on ${item.valid_until}.`,
            actionable_remediation: 'Request updated renewal documentation from cooperative officers.',
          });
          exceptionAlerts.push(`Indicator [${def.code}]: evidence expired on ${item.valid_until}.`);
        }

        // Level-based scoring tier [PROVISIONAL calibration constants]
        if (level === 'verified') {
          verifiedCount++;
          if (item.qualifications && item.qualifications.length > 0) {
            rawScore = 0.85; // [PROVISIONAL]
            notes = `Verified with qualifications: ${item.qualifications.join('; ')}`;
          } else {
            rawScore = 1.0;
            notes = 'Independently verified without qualification.';
          }
        } else if (level === 'supported') {
          supportedCount++;
          rawScore = hasDiscrepancy ? 0.45 : 0.65; // [PROVISIONAL]
          notes = hasDiscrepancy
            ? 'Supported by documentation, but unverified discrepancy flagged.'
            : 'Supported by documentation; independent verification pending.';
        } else if (level === 'asserted') {
          assertedCount++;
          rawScore = hasDiscrepancy ? 0.10 : 0.25; // [PROVISIONAL]
          notes = hasDiscrepancy
            ? 'Cooperative asserted claim with conflicting observation reported.'
            : 'Cooperative asserted claim without corroborating documentation.';
        } else {
          missingCount++;
          rawScore = 0.0;
          notes = 'No admissible evidence attached.';
        }

        // S1 field-agent verification check [PROVISIONAL]
        if (def.code === 'S1') {
          const events = caseState.events || [];
          const hasFieldAgentEvent = events.some(
            (e) =>
              e.action === 'record_agent_observation' ||
              e.actor?.role === 'field_agent' ||
              e.actor?.role === 'coop_field_agent' ||
              e.actor?.role === 'verifier'
          );
          // If roster is unverified (asserted level or explicit unverified roster flag) without field agent event, cap at 0.25
          if ((level === 'asserted' || (caseState as any).unverified_roster) && !hasFieldAgentEvent) {
            rawScore = Math.min(rawScore, 0.25); // [PROVISIONAL]
            notes = 'Member roster present but unverified by field agent event [PROVISIONAL: 0.25 pts].';
          }
        }

        // S1 Native Workflow: Roster timestamp currency check [PROVISIONAL: >90 days triggers STALE_S1]
        if (def.code === 'S1' && item.supplied_on) {
          const rosterDate = Date.parse(item.supplied_on);
          const evalDateMs = Date.parse(evalDate);
          if (!isNaN(rosterDate) && !isNaN(evalDateMs)) {
            const diffDays = Math.floor((evalDateMs - rosterDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 90) {
              staleIndicatorSet.add(def.code);
              rawScore = Math.min(rawScore, 0.45); // [PROVISIONAL]
              notes = `Member roster is ${diffDays} days old (threshold: 90 days) — currency unconfirmed [PROVISIONAL: capped at 0.45 pts].`;
              exceptions.push({
                code: 'STALE_S1',
                pillar: pillarName,
                severity: 'warning',
                message: `Indicator [S1]: member register is ${diffDays} days old (>${90} days). Roster currency unconfirmed.`,
                actionable_remediation: 'Conduct a fresh member register review with field agent corroboration.',
              });
              exceptionAlerts.push(`Indicator [S1]: member register is stale (${diffDays} days old).`);
            }
          }
        }

        // G3 AGM Resolution age check [PROVISIONAL: >730 days / 24 months triggers EXPIRED_G3]
        if (def.code === 'G3' && item.supplied_on) {
          const resolutionDate = Date.parse(item.supplied_on);
          const evalDateMs = Date.parse(evalDate);
          if (!isNaN(resolutionDate) && !isNaN(evalDateMs)) {
            const diffDays = Math.floor((evalDateMs - resolutionDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 730) {
              staleIndicatorSet.add(def.code);
              rawScore = Math.min(rawScore, 0.35); // [PROVISIONAL]
              notes = `AGM resolution is ${diffDays} days old (threshold: 730 days / 24 months) — borrowing mandate may have lapsed [PROVISIONAL: capped at 0.35 pts].`;
              exceptions.push({
                code: 'EXPIRED_G3',
                pillar: pillarName,
                severity: 'warning',
                message: `Indicator [G3]: AGM resolution is ${diffDays} days old (>730 days / 24 months). Borrowing mandate currency unconfirmed.`,
                actionable_remediation: 'Obtain a refreshed AGM resolution minutes signed by cooperative chairman and secretary.',
              });
              exceptionAlerts.push(`Indicator [G3]: AGM resolution is expired (${diffDays} days old).`);
            }
          }
        }

        // G3 AGM resolution upload check [PROVISIONAL]
        if (def.code === 'G3' && (caseState as any).officers !== undefined) {
          const agmEv = findEvidence(caseState, ['governance', 'resolution', 'minutes']);
          if (!agmEv.item) {
            rawScore = Math.min(rawScore, 0.50); // [PROVISIONAL] officers present, no AGM resolution uploaded
            notes = 'Officers present, no AGM resolution uploaded [PROVISIONAL: 0.50 pts].';
          }
        }

        // Cap score if unresolved conflict exists [PROVISIONAL: 0.30]
        if (isConflicted) {
          rawScore = Math.min(rawScore, 0.30);
          notes += ' (Score capped at 0.30 due to active finding conflict)';
        }
      }
    }

    // Denominator semantics:
    // - genuinely not_applicable -> excluded from denominator
    // - asset demonstrably absent (absence_evidenced) -> excluded from denominator
    // - asset declared_absent without evidence -> RETAINED in denominator with 0 points
    // - safeguard declared_absent or missing -> RETAINED in denominator with 0 points
    const isExcludedFromDenominator =
      appState === 'not_applicable' ||
      (appState === 'absence_evidenced' && def.absence_outcome === 'neutral_exclusion');

    const effectiveWeight = isExcludedFromDenominator ? 0 : def.weight;
    const weighted = rawScore * effectiveWeight;

    if (effectiveWeight > 0) {
      totalApplicableWeight += effectiveWeight;
      totalWeightedScore += weighted;

      if (item?.level === 'verified') {
        verifiedWeight += effectiveWeight;
      } else if (item?.level === 'supported') {
        supportedWeight += effectiveWeight;
      }
    }

    metrics.push({
      code: def.code,
      name: def.name,
      dimension: def.dimension,
      criterion_nature: def.criterion_nature,
      weight: def.weight,
      applicability_state: appState,
      evidence_type: key,
      evidence_level: item?.level ?? 'none',
      has_discrepancy: Boolean(item?.has_discrepancy),
      conflict_state: item?.conflict_state,
      qualifications: item?.qualifications,
      raw_score: rawScore,
      weighted_score: weighted,
      limitation: item?.limitation,
      notes,
      anti_inference_guardrail: def.anti_inference_guardrail,
    });
  }

  // Composite / Overall score calculation (0 - 100)
  // Let A = the set of active indicators with applicability = 'evaluable' (effectiveWeight > 0)
  const isAllUnevaluable = totalApplicableWeight === 0;
  const overallScore: number | null = isAllUnevaluable
    ? null
    : Math.round((totalWeightedScore / totalApplicableWeight) * 100);

  if (isAllUnevaluable) {
    exceptions.push({
      code: 'DATA_ABSENT_ALL_PILLARS',
      pillar: 'environmental',
      severity: 'warning',
      message: 'All scoring criteria are excluded or inapplicable. Composite score is unevaluable.',
      actionable_remediation: 'Provide applicable operational evidence for at least one evaluation pillar.',
    });
  }

  // Grade assignment
  let grade: 'A' | 'B' | 'C' | 'D' | 'N/A';
  if (overallScore === null) {
    grade = 'N/A';
  } else if (overallScore >= 85) {
    grade = 'A';
  } else if (overallScore >= 70) {
    grade = 'B';
  } else if (overallScore >= 50) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  // Pillar breakdowns (B9 & B3)
  const computePillar = (dim: 'Environmental' | 'Social' | 'Governance'): PillarScore => {
    const pMetrics = metrics.filter((m) => m.dimension === dim);
    const pWeight = pMetrics.reduce((sum, m) => {
      const isExcluded =
        m.applicability_state === 'not_applicable' ||
        (m.applicability_state === 'absence_evidenced' && m.criterion_nature === 'asset');
      return sum + (isExcluded ? 0 : m.weight);
    }, 0);
    const pWeightedScore = pMetrics.reduce((sum, m) => sum + m.weighted_score, 0);
    const appCount = pMetrics.filter((m) => {
      const isExcluded =
        m.applicability_state === 'not_applicable' ||
        (m.applicability_state === 'absence_evidenced' && m.criterion_nature === 'asset');
      return !isExcluded;
    }).length;

    const evaluable = appCount > 0 && pWeight > 0;
    const pScore = evaluable ? Math.round((pWeightedScore / pWeight) * 100) : 0;

    if (!evaluable) {
      const pKey = dim.toLowerCase() as 'environmental' | 'social' | 'governance';
      exceptions.push({
        code: `DATA_ABSENT_PILLAR_${dim.toUpperCase()}`,
        pillar: pKey,
        severity: 'warning',
        message: `${dim} pillar has no applicable criteria for this case.`,
        actionable_remediation: `Attach governed records relevant to the ${dim} dimension.`,
      });
    }

    return {
      score: pScore,
      evaluable,
      applicable_count: appCount,
      total_count: pMetrics.length,
      summary: evaluable
        ? `${dim} pillar: ${pScore}% evidence quality (${appCount} of ${pMetrics.length} applicable indicators).`
        : `${dim} pillar: Unevaluable — no applicable criteria for this case.`,
    };
  };

  const pillars = {
    environmental: computePillar('Environmental'),
    social: computePillar('Social'),
    governance: computePillar('Governance'),
  };

  const evaluablePillarsCount = [pillars.environmental, pillars.social, pillars.governance].filter(
    (p) => p.evaluable
  ).length;
  const pillarCoverageRatio = `${evaluablePillarsCount}/3`;

  // Confidence Rating (Invariant 1: Unresolved Contradictions strictly cap confidence to Low)
  const hasActiveDisputes = (caseState.disputes || []).some((d) => d.status === 'open');
  const hasConflict = conflictCount > 0 || hasActiveDisputes;

  let confidenceRating: 'High' | 'Medium' | 'Low';
  let confidenceExplanation = '';

  if (hasConflict) {
    confidenceRating = 'Low';
    confidenceExplanation = 'Confidence downgraded to Low due to active conflicting findings or open disputes on governed records.';
  } else if (totalApplicableWeight > 0 && (verifiedWeight / totalApplicableWeight) >= 0.70) {
    confidenceRating = 'High';
    confidenceExplanation = 'High confidence: >=70% of applicable weight backed by independently verified records.';
  } else if (totalApplicableWeight > 0 && ((verifiedWeight + supportedWeight) / totalApplicableWeight) >= 0.50) {
    confidenceRating = 'Medium';
    confidenceExplanation = 'Medium confidence: >=50% of applicable weight backed by supported or verified records.';
  } else {
    confidenceRating = 'Low';
    confidenceExplanation = 'Low confidence: majority of evidence is asserted self-declarations or missing.';
  }

  const dataCompletenessRatio = definitions.length > 0
    ? (definitions.length - missingCount) / definitions.length
    : 1;
  const staleEvidenceCount = staleIndicatorSet.size;
  const staleIndicatorRatio = definitions.length > 0
    ? staleEvidenceCount / definitions.length
    : 0;

  const defFingerprint = canonicalSha256(
    definitions.map((d) => ({
      code: d.code,
      weight: d.weight,
      criterion_nature: d.criterion_nature,
      status: d.status,
      absence_outcome: d.absence_outcome,
    }))
  );

  // Calculation Identity (Phase R4 / B6)
  const inputFingerprint = computeInputFingerprint(caseState, 'EQS-V1-PROVISIONAL', evalDate, definitions);
  const calculationIdentity = computeCalculationIdentity(caseState.id, 'EQS-V1-PROVISIONAL', inputFingerprint, defFingerprint);

  return {
    methodology_version: 'EQS-V1-PROVISIONAL',
    case_id: caseState.id,
    cooperative_name: caseState.name,
    evaluated_at: evalDate,
    overall_score: overallScore,
    composite_score: overallScore,
    unevaluable_composite: isAllUnevaluable ? true : undefined,
    pillar_coverage_ratio: pillarCoverageRatio,
    calculation_identity: calculationIdentity,
    calculation_id: calculationIdentity.calculation_id,
    input_fingerprint: inputFingerprint,
    grade,
    pillars,
    confidence: {
      rating: confidenceRating,
      data_completeness_ratio: Math.round(dataCompletenessRatio * 100) / 100,
      stale_indicator_ratio: Math.round(staleIndicatorRatio * 100) / 100,
      explanation: confidenceExplanation,
    },
    confidence_rating: confidenceRating,
    exceptions,
    exception_alerts: exceptionAlerts,
    metrics,
    summary: {
      total_applicable_weight: totalApplicableWeight,
      verified_count: verifiedCount,
      supported_count: supportedCount,
      asserted_count: assertedCount,
      missing_count: missingCount,
      conflict_count: conflictCount,
      discrepancy_count: discrepancyCount,
    },
    anti_inference_guardrails: definitions.map((d) => d.anti_inference_guardrail),
    methodology_disclaimer:
      'Proprietary Evidence Quality Score (EQS) is a derived evaluation of governed records generated by Symphony workflows. It measures evidence integrity and provenance depth, not credit risk, enterprise profitability, or yield performance.',
  };
}

export const _computeEvidenceQualityScoreWithDefinitions = computeEvidenceQualityScore;
