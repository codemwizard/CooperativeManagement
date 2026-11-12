export type EvidenceLevel = 'none' | 'asserted' | 'supported' | 'verified';
export type EffectiveLevel = EvidenceLevel | 'disputed' | 'stale';
export type RequirementState = 'not_applicable' | 'unresolved' | 'satisfied' | 'assessment_time' | 'exception';
export type Role =
  | 'secretary'
  | 'treasurer'
  | 'chairman'
  | 'member'
  | 'field_agent'
  | 'coop_field_agent'
  | 'pfi_analyst'
  | 'pfi_credit'
  | 'ta'
  | 'verifier'
  | 'fund_manager'
  | 'technician';

export type FindingResult =
  | 'verified_conformant'
  | 'verified_with_qualifications'
  | 'non_conformant'
  | 'inconclusive'
  | 'verified'
  | 'partially_verified'
  | 'not_verified'
  | 'unable_to_determine';

export type AssignmentStatus =
  | 'assigned'
  | 'completed'
  | 'superseded_target'
  | 'cancelled'
  | 'completed_superseded';

export interface Actor {
  user_id: string;
  role: Role;
  cohorts?: string[] | 'all';
}

export interface EvidenceItem {
  level: EvidenceLevel;
  supplied_by: string;
  supplied_on: string;
  verified_by: string | null;
  verified_on: string | null;
  valid_until: string | null;
  limitation: string;
  history: unknown[];
  version_id?: number;
  claim_id?: string;
  qualifications?: string[];
  has_discrepancy?: boolean;
  contact_ref_id?: string;
  observation_date?: string;
  supporting_artefact_id?: string;
  artefact_hash?: string;
  fingerprint?: string;
  conflict_state?: 'unresolved_conflict' | 'resolved';
  [key: string]: unknown;
}

export interface Dispute {
  id: string;
  evidence_type: string;
  raised_by: string;
  raised_role: Role;
  raised_on: string;
  reason_code: string;
  note: string;
  status: 'open' | 'resolved' | 'withdrawn';
  resolution: null | {
    method: 'independent_reverification' | 'withdrawn';
    by: string;
    on: string;
    note?: string;
  };
}

export interface Assignment {
  id: string;
  case_id: string;
  target: { kind: 'claim' | 'evidence'; ref: string; version_id?: number };
  scope: string;
  assigned_to: string;
  assigned_by: string;
  assigned_on?: string;
  scenario_date?: string;
  status: AssignmentStatus;
  scenario?: string;
  version_id?: number;
}

export interface Finding {
  id: string;
  assignment_id: string;
  result: FindingResult;
  scope: string;
  basis: string[];
  limitation: string;
  verifier: string;
  recorded_on: string;
  method_and_evidence_examined?: string;
  qualifications?: string[];
  historical?: boolean;
  version_id?: number;
}


export interface TaIntervention {
  id: string;
  case_id: string;
  requirement_id: string;
  scope: string;
  provider: string;
  status: 'requested' | 'assigned' | 'completed';
  requested_by: string;
  requested_on: string;
  completed_on?: string;
  evidence_submitted?: string;
  notes?: string;
}

export interface InstitutionMessage {
  id: string;
  case_id: string;
  sender_institution: string;
  sender_user: string;
  message_type: 'enquiry' | 'product_proposal' | 'clarification';
  subject: string;
  body: string;
  proposed_structure?: 'direct_to_member_group_facility' | string;
  status: 'sent' | 'read' | 'replied';
  sent_at: string;
}

export interface Reliance {
  id: string;
  finding_id: string;
  relying_role: Role;
  relying_user: string;
  reliance: 'relied' | 'not_relied';
  note?: string;
  recorded_on: string;
  method_and_evidence_examined?: string;
}

export interface VerificationState {
  assignments: Assignment[];
  findings: Finding[];
  reliance: Reliance[];
}

export interface LenderRecordState {
  admissions: Array<{
    id: string;
    evidence_type: string;
    status: 'accepted' | 'requires_independent_query' | 'rejected';
    recorded_by: string;
    recorded_on: string;
  }>;
  requests: Array<{
    id: string;
    requirement_id: string;
    evidence_type: string | null;
    note: string;
    requested_by: string;
    requested_on: string;
    status: 'open' | 'closed';
  }>;
  findings: Array<{
    id: string;
    requirement_id: string;
    finding: string;
    recorded_by: string;
    recorded_on: string;
  }>;
  outcomes: Array<{
    id: string;
    outcome: 'approved' | 'more_evidence_requested' | 'declined' | 'deferred';
    note?: string;
    recorded_by: string;
    recorded_on: string;
  }>;
}

export interface CaseState {
  id: string;
  version?: number;
  name: string;
  district: string;
  province: string;
  programme: string;
  activity: string;
  members: number;
  project: {
    request: Record<string, unknown>;
    [key: string]: unknown;
  };
  evidence: Record<string, EvidenceItem>;
  events: EngineEvent[];
  financing: null | {
    destination: string;
    status: string;
    facility: {
      amount: number;
      term_months: number;
      disbursed_on: string;
      use_of_proceeds: Array<{ item: string; planned: number; evidenced: number }>;
    };
    covenants: Array<{ id: string; due_date: string; received: boolean; last_received: string | null }>;
  };
  presentation: null | Record<string, unknown>;
  discoverable?: boolean;
  ta_interventions?: TaIntervention[];
  institution_messages?: InstitutionMessage[];
  disputes: Dispute[];
  verification: VerificationState;
  lender: LenderRecordState;
  [key: string]: unknown;
}

export interface Destination {
  id: 'A' | 'B' | 'N';
  display_name: string;
  kind: string;
  product: string;
  requirements: Requirement[];
  covenants: Array<{ id: string; title: string }>;
}

export interface Requirement {
  id: string;
  title: string;
  group: string;
  rule:
    | { kind: 'evidence'; evidence_type: string; min_level: EvidenceLevel }
    | { kind: 'evidence_count'; evidence_type: string; count_field: string; min_count: number; min_level: EvidenceLevel }
    | { kind: 'assessment_time'; evidence_type: string }
    | {
        kind: 'fit';
        check: 'single_request' | 'per_group_request';
        min_amount: number;
        max_amount: number;
        max_term_months?: number;
        min_term_months?: number;
      };
  applies_when: null | { field: string; equals: unknown };
  why: string;
}

export interface RequirementResult {
  id: string;
  title: string;
  state: RequirementState;
  evidence_ref: string | null;
  effective_level: EffectiveLevel | null;
  min_level: EvidenceLevel | null;
  provided_early: boolean;
  reason: string | null;
  group: string;
}

export interface Evaluation {
  destination_id: 'A' | 'B' | 'N';
  requirements: RequirementResult[];
  summary: {
    ready: boolean;
    unresolved: string[];
    exceptions: string[];
    not_applicable: string[];
    assessment_time: string[];
    satisfied: number;
    total: number;
  };
}

export interface EngineEvent {
  id: string;
  at: string;
  actor: Actor;
  action: string;
  target: unknown;
  before: unknown;
  after: unknown;
}

export type ActionResult = { ok: true; caseState: CaseState; event: EngineEvent } | { ok: false; code: string; rule: string };

export interface DurableCommitEnvelope {
  schema_version: '1.0' | '2.0';
  timestamp?: string;
  saved_at: string;
  case_id: string;
  baseline_version: number;
  state_version: number;
  state_snapshot: CaseState;
  event_log: EngineEvent[];
  checksum: string;
}

export interface DecisionEvaluationSnapshot {
  snapshot_id: string;
  case_id: string;
  destination_id: string;
  decided_at: string;
  decided_by: string;
  evaluation_ruleset_version: string;
  checklist_version: string;
  lender_policy_version: string;
  admission_evaluation: {
    evaluation_id: string;
    outcome: 'accepted' | 'requires_independent_query' | 'rejected';
    evaluated_at: string;
    checklist_responses: Record<string, string>;
  };
  claims_evaluated: Array<{
    claim_id: string;
    version_id: number;
    evidence_level: EvidenceLevel;
    verification_outcome: FindingResult | null;
    qualifications: string[];
    validity_state: 'current' | 'stale';
    dispute_state: 'undisputed' | 'disputed';
  }>;
  relied_findings: Array<{
    finding_id: string;
    claim_id: string;
    version_id: number;
    verifier: string;
    result: FindingResult;
    qualifications: string[];
    recorded_on: string;
  }>;
  governance_state: {
    has_discrepancy: boolean;
    officer_transition_status: 'clean' | 'resolution_supplied' | 'discrepancy_review_required' | 'incomplete';
    resolution_supplied: boolean;
  };
  outcome: 'approved' | 'more_evidence_requested' | 'declined' | 'deferred';
  rationale: string;
}
