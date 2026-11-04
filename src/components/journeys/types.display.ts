import type { Role, CaseState } from '../../engine/types';

export type EncumbranceStatus =
  | 'Pledged'
  | 'Under lien'
  | 'Disputed'
  | 'Unknown'
  | 'Reported unencumbered'
  | 'Verified unencumbered'
  | 'Not recorded';

export interface LivestockItem {
  species: string;
  count: number;
  est_value_zmw: number;
  encumbrance: EncumbranceStatus;
  notes?: string;
}

export interface MemberRosterItem {
  member_id: string;
  name: string;
  cooperative_role: string;
  livestock: LivestockItem[];
}

export interface CoopAsset {
  type: string;
  description: string;
  encumbrance: EncumbranceStatus;
}

export interface OfficerEntry {
  member_id: string | null;
  office: string;
  name: string;
}

export type DiscrepancyType =
  | 'none'
  | 'name_discrepancy'
  | 'person_discrepancy'
  | 'not_on_certificate'
  | 'no_id_recorded';

export interface OfficerComparisonItem {
  office: string;
  certificate_member_id: string | null;
  current_member_id: string | null;
  id_match: boolean;
  name_match: boolean;
  discrepancy_type: DiscrepancyType;
  note: string;
}

export interface GovernanceOfficersEvidence {
  certificate_entries: OfficerEntry[];
  current_entries: OfficerEntry[];
  comparison_result: OfficerComparisonItem[];
  has_discrepancy: boolean;
}

export type DraftPhase = 'initial' | 'workshop_complete' | 'followup_complete';

export interface SymphonyDraft {
  cases: CaseState[];
  draftPhase: DraftPhase;
  draftCaseId: string;
  draftRole: Role;
  draftStep: number;
  savedAt: string;
}
