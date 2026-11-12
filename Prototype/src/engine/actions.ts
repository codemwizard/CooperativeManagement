import rolesData from '../../data/roles.json';
import verificationSeed from '../../data/verification_seed.json';
import { claims, clone, constraintRule, meta, userFor } from './data';
import { assertCaseVisible } from './scope';
import { canonicalSha256 } from './crypto';
import { validateSupportingArtefact, resetArtefactRegistry, registerArtefact, getRegisteredArtefact } from './artefact_registry';
export { resetArtefactRegistry, registerArtefact, getRegisteredArtefact };
import type { ActionResult, Actor, Assignment, CaseState, EngineEvent, EvidenceItem, EvidenceLevel, Finding, FindingResult, Reliance, Role } from './types';

const readOnlyEvidenceRoles: Role[] = ['pfi_analyst', 'pfi_credit', 'ta', 'fund_manager', 'verifier'];
const evidenceMutatingActions = new Set([
  'add_evidence',
  'record_claim',
  'record_agent_observation',
  'attach_corroborating_evidence',
  'amend_claim',
  'upload_minutes',
  'signoff_minutes',
  'mark_verified',
  'record_payment',
  'confirm_payment',
]);
export const supportedActions = new Set([
  'upload_minutes',
  'signoff_minutes',
  'add_evidence',
  'record_claim',
  'record_agent_observation',
  'attach_corroborating_evidence',
  'record_finding_and_promote',
  'resolve_finding_conflict',
  'amend_claim',
  'cancel_assignment',
  'evaluate_admission_checklist',
  'mark_verified',
  'restructure_request',
  'raise_dispute',
  'resolve_dispute',
  'withdraw_dispute',
  'assign_verification',
  'record_verification_finding',
  'record_reliance',
  'raise_finding',
  'request_evidence',
  'record_outcome',
  'record_admission',
  'confirm_payment',
  'present_to_destination',
  'export_dossier',
  'institution_message',
  'request_ta_intervention',
  'record_ta_completion',
  'set_discoverable',
  'promote_evidence_level',
]);

interface ActionInput {
  type: string;
  [key: string]: unknown;
}

function fail(code: string, rule = constraintRule(code)): ActionResult {
  return { ok: false, code, rule };
}

function canRole(action: string, role: Role): boolean {
  return ((rolesData.actions as Record<string, Role[]>)[action] ?? []).includes(role);
}

function eventFor(caseState: CaseState, action: string, actor: Actor, target: unknown, before: unknown, after: unknown, at: string): EngineEvent {
  return {
    id: `evt-${caseState.events.length + 1}`,
    at,
    actor,
    action,
    target,
    before,
    after,
  };
}

function success(caseState: CaseState, action: string, actor: Actor, target: unknown, before: unknown, after: unknown, at: string): ActionResult {
  const event = eventFor(caseState, action, actor, target, before, after, at);
  if (!caseState.events) caseState.events = [];
  caseState.events.push(event);
  caseState.version = (typeof caseState.version === 'number' ? caseState.version : (caseState.events.length - 1)) + 1;
  return { ok: true, caseState, event };
}

function authorize(caseState: CaseState, action: string, actor: Actor): { ok: true } | { ok: false; result: ActionResult } {
  if (evidenceMutatingActions.has(action) && readOnlyEvidenceRoles.includes(actor.role)) return { ok: false, result: fail('READ_ONLY_ROLE') };
  if (!canRole(action, actor.role)) return { ok: false, result: fail('ROLE_NOT_PERMITTED') };
  const scope = assertCaseVisible(actor, caseState);
  if (!scope.ok) return { ok: false, result: scope };
  return { ok: true };
}

export function computeClaimVersionFingerprint(item: {
  claim_id?: string;
  version_id?: number;
  description?: unknown;
  quantity?: unknown;
  source?: unknown;
  supplied_by?: string;
  supplied_on?: string;
}): string {
  return canonicalSha256({
    claim_id: item.claim_id ?? '',
    version_id: item.version_id ?? 1,
    description: item.description ?? null,
    quantity: item.quantity ?? null,
    source: item.source ?? null,
    supplied_by: item.supplied_by ?? '',
    supplied_on: item.supplied_on ?? '',
  });
}

function historyEntry(item: EvidenceItem) {
  return {
    level: item.level,
    on: item.supplied_on,
    by: item.supplied_by,
    verified_by: item.verified_by,
    verified_on: item.verified_on,
    valid_until: item.valid_until,
    limitation: item.limitation,
    version_id: item.version_id,
    fingerprint: item.fingerprint,
    artefact_hash: item.artefact_hash,
    has_discrepancy: item.has_discrepancy,
    contact_ref_id: item.contact_ref_id,
  };
}

function verifiedLimitation(evidenceType: string, fallback?: string): string {
  if (fallback) return fallback;
  return evidenceType === 'registration' ? meta.mandatory_limitations.registration_verified : meta.mandatory_limitations.generic_verified;
}

function replaceEvidence(caseState: CaseState, evidenceType: string, next: EvidenceItem): void {
  const previous = caseState.evidence[evidenceType];
  caseState.evidence[evidenceType] = {
    ...next,
    history: previous ? [historyEntry(previous), ...(previous.history ?? [])] : next.history,
  };
}

function addEvidence(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type ?? action.claim_id ?? '');
  if (!evidenceType) return fail('NO_SUCH_EVIDENCE');
  const previous = clone(caseState.evidence[evidenceType] ?? null);
  const existing = caseState.evidence[evidenceType];

  const isObservation = action.type === 'record_agent_observation' || (action.level === 'supported' && (action.contact_ref_id !== undefined || action.has_discrepancy !== undefined));
  if (isObservation) {
    const contactRefId = action.contact_ref_id ? String(action.contact_ref_id) : (existing?.contact_ref_id ? String(existing.contact_ref_id) : '');
    if (!contactRefId) {
      return fail('CONTACT_REF_REQUIRED', 'Attributable observation requires a valid contact_ref_id.');
    }
  }

  const hasDiscrepancy = Boolean(action.has_discrepancy);
  let nextLevel: EvidenceLevel;

  if (action.type === 'record_claim') {
    nextLevel = 'asserted';
  } else if (action.type === 'record_agent_observation') {
    // S4 & P0-2: An observation alone does NOT promote to supported.
    // Attribution is recorded, but level remains at prior state.
    nextLevel = existing?.level ?? 'asserted';
  } else if (action.type === 'attach_corroborating_evidence' || Boolean(action.supporting_artefact_id)) {
    const artefactId = String(action.supporting_artefact_id ?? '');
    if (!artefactId) {
      return fail('ARTEFACT_NOT_FOUND', 'Corroboration requires a valid supporting_artefact_id.');
    }
    const check = validateSupportingArtefact(artefactId, evidenceType, action.artefact_hash as string | undefined);
    if (!check.ok) {
      return fail(check.code, check.message);
    }
    nextLevel = 'supported';
  } else {
    // Generic fallback: caller-supplied level string ignored; no promotion from asserted
    if (existing?.level === 'asserted') {
      nextLevel = 'asserted';
    } else if (existing?.level === 'verified') {
      nextLevel = 'supported';
    } else if (existing?.level === 'supported') {
      nextLevel = 'supported';
    } else {
      nextLevel = action.level === 'asserted' ? 'asserted' : 'supported';
    }
  }

  const nextVersion = existing ? (existing.version_id ?? 1) : 1;
  let limitation = (action.limitation as string | undefined) ?? existing?.limitation ?? meta.mandatory_limitations.generic_supported;
  if (hasDiscrepancy && !limitation.includes('[Discrepancy Reported]')) {
    limitation = `${limitation} [Discrepancy Reported]`;
  }

  const next: EvidenceItem = {
    ...(existing ?? {}),
    ...(action.item as Record<string, unknown> | undefined),
    level: nextLevel,
    version_id: nextVersion,
    claim_id: (action.claim_id as string | undefined) ?? existing?.claim_id ?? evidenceType,
    supplied_by: action.type === 'record_claim' ? actor.user_id : (existing?.supplied_by ?? actor.user_id),
    supplied_on: action.type === 'record_claim' ? at.slice(0, 10) : (existing?.supplied_on ?? at.slice(0, 10)),
    verified_by: nextLevel === 'verified' ? (existing?.verified_by ?? null) : null,
    verified_on: nextLevel === 'verified' ? (existing?.verified_on ?? null) : null,
    valid_until: (action.valid_until as string | undefined) ?? existing?.valid_until ?? null,
    limitation,
    has_discrepancy: hasDiscrepancy,
    contact_ref_id: (action.contact_ref_id as string | undefined) ?? existing?.contact_ref_id,
    observation_date: (action.observation_date as string | undefined) ?? at.slice(0, 10),
    supporting_artefact_id: (action.supporting_artefact_id as string | undefined) ?? existing?.supporting_artefact_id,
    artefact_hash: (action.artefact_hash as string | undefined) ?? existing?.artefact_hash,
    fingerprint: existing?.fingerprint ?? computeClaimVersionFingerprint({
      claim_id: (action.claim_id as string | undefined) ?? existing?.claim_id ?? evidenceType,
      version_id: nextVersion,
      description: action.item ? (action.item as any).description : undefined,
      quantity: action.item ? (action.item as any).quantity : undefined,
      supplied_by: actor.user_id,
      supplied_on: at.slice(0, 10),
    }),
    history: existing ? [historyEntry(existing), ...(existing.history ?? [])] : [],
  };
  replaceEvidence(caseState, evidenceType, next);
  const emittedAction = action.type === 'upload_minutes' ? 'add_evidence' : action.type;
  return success(caseState, emittedAction, actor, { evidence_type: evidenceType }, previous, caseState.evidence[evidenceType], at);
}

function markVerified(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type);
  const evidence = caseState.evidence[evidenceType];
  if (!evidence) return fail('NO_SUCH_EVIDENCE');
  if (evidence.supplied_by === actor.user_id) return fail('SELF_VERIFICATION');
  if (evidenceType === 'governance' && !caseState.events.some((event) => event.action === 'signoff_minutes')) {
    return fail('SIGNOFF_REQUIRED');
  }
  const previous = clone(evidence);
  replaceEvidence(caseState, evidenceType, {
    ...evidence,
    level: 'verified',
    verified_by: actor.user_id,
    verified_on: at.slice(0, 10),
    limitation: verifiedLimitation(evidenceType, action.limitation as string | undefined),
  });
  return success(caseState, 'mark_verified', actor, { evidence_type: evidenceType }, previous, caseState.evidence[evidenceType], at);
}

function raiseDispute(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type);
  const reasonCode = String(action.reason_code ?? '');
  const note = String(action.note ?? '');
  const evidence = caseState.evidence[evidenceType];
  if (!meta.dispute_reason_codes.includes(reasonCode) || note.length < 1 || note.length > 200) return fail('DISPUTE_REASON_REQUIRED');
  if (!evidence) return fail('NO_SUCH_EVIDENCE');
  if (caseState.disputes.some((dispute) => dispute.evidence_type === evidenceType && dispute.status === 'open')) return fail('DISPUTE_ALREADY_OPEN');
  if (evidence.supplied_by === actor.user_id) return fail('SELF_DISPUTE');
  const dispute = {
    id: `dsp-${caseState.disputes.length + 1}`,
    evidence_type: evidenceType,
    raised_by: actor.user_id,
    raised_role: actor.role,
    raised_on: at,
    reason_code: reasonCode,
    note,
    status: 'open' as const,
    resolution: null,
  };
  caseState.disputes.push(dispute);
  return success(caseState, 'raise_dispute', actor, { evidence_type: evidenceType }, null, dispute, at);
}

function resolveDispute(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type);
  const evidence = caseState.evidence[evidenceType];
  const dispute = caseState.disputes.find((candidate) => candidate.evidence_type === evidenceType && candidate.status === 'open');
  if (!evidence) return fail('NO_SUCH_EVIDENCE');
  if (!dispute) return fail('NO_OPEN_DISPUTE');
  if (evidence.supplied_by === actor.user_id) return fail('SELF_VERIFICATION');
  if (evidence.verified_by === actor.user_id) return fail('SAME_VERIFIER');
  const before = clone({ evidence, dispute });
  replaceEvidence(caseState, evidenceType, {
    ...evidence,
    level: 'verified',
    verified_by: actor.user_id,
    verified_on: at.slice(0, 10),
    limitation: verifiedLimitation(evidenceType, action.limitation as string | undefined),
  });
  dispute.status = 'resolved';
  dispute.resolution = { method: 'independent_reverification', by: actor.user_id, on: at, note: action.note as string | undefined };
  return success(caseState, 'resolve_dispute', actor, { evidence_type: evidenceType }, before, { evidence: caseState.evidence[evidenceType], dispute }, at);
}

function withdrawDispute(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type);
  const dispute = caseState.disputes.find((candidate) => candidate.evidence_type === evidenceType && candidate.status === 'open');
  if (!dispute) return fail('NO_OPEN_DISPUTE');
  if (dispute.raised_by !== actor.user_id) return fail('NOT_DISPUTE_RAISER');
  const before = clone(dispute);
  dispute.status = 'withdrawn';
  dispute.resolution = { method: 'withdrawn', by: actor.user_id, on: at, note: action.note as string | undefined };
  return success(caseState, 'withdraw_dispute', actor, { evidence_type: evidenceType }, before, dispute, at);
}

function targetExists(caseState: CaseState, target: Assignment['target']): boolean {
  if (target.kind === 'evidence') return Boolean(caseState.evidence[target.ref]);
  return claims.some((claim) => claim.id === target.ref && claim.case_id === caseState.id);
}

function amendClaim(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const claimId = String(action.claim_id ?? action.evidence_type ?? '');
  const existing = caseState.evidence[claimId];
  if (!existing) return fail('NO_SUCH_EVIDENCE');
  const currentVersion = existing.version_id ?? 1;
  const nextVersion = currentVersion + 1;
  const previous = clone(existing);

  // Mark open assignments on currentVersion as superseded_target
  caseState.verification.assignments.forEach((assignment) => {
    const asgRef = assignment.target.ref;
    const asgVer = assignment.target.version_id ?? assignment.version_id ?? currentVersion;
    if (asgRef === claimId && asgVer === currentVersion && assignment.status === 'assigned') {
      assignment.status = 'superseded_target';
    }
  });

  const next: EvidenceItem = {
    ...existing,
    ...(action.item as Record<string, unknown> | undefined),
    level: 'asserted',
    version_id: nextVersion,
    supplied_by: actor.user_id,
    supplied_on: at.slice(0, 10),
    verified_by: null,
    verified_on: null,
    has_discrepancy: false,
    conflict_state: undefined,
    fingerprint: computeClaimVersionFingerprint({
      claim_id: claimId,
      version_id: nextVersion,
      description: action.item ? (action.item as any).description : (existing as any).description,
      quantity: action.item ? (action.item as any).quantity : (existing as any).quantity,
      supplied_by: actor.user_id,
      supplied_on: at.slice(0, 10),
    }),
    history: existing ? [historyEntry(existing), ...(existing.history ?? [])] : [],
  };
  caseState.evidence[claimId] = next;
  return success(caseState, 'amend_claim', actor, { claim_id: claimId, version_id: nextVersion }, previous, next, at);
}

function cancelAssignment(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const assignmentId = String(action.assignment_id);
  const assignment = caseState.verification.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return fail('NO_SUCH_TARGET');
  if (assignment.status === 'completed' || assignment.status === 'completed_superseded' || assignment.status === 'cancelled') {
    return fail('ASSIGNMENT_ALREADY_CLOSED');
  }
  const before = clone(assignment);
  assignment.status = 'cancelled';
  return success(caseState, 'cancel_assignment', actor, { assignment_id: assignmentId }, before, assignment, at);
}

function assignVerification(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const target = action.target as Assignment['target'];
  const assignedTo = String(action.assigned_to);
  if (!target || !targetExists(caseState, target)) return fail('NO_SUCH_TARGET');
  if (userFor(assignedTo)?.role !== 'verifier') return fail('NO_SUCH_VERIFIER');

  // Duplicate assignment guard (Gap G8):
  // Guard against duplicate active assignment on (claim_id, version_id):
  if (target.version_id !== undefined || action.guard_duplicate) {
    const targetVer = target.version_id ?? 1;
    const duplicate = caseState.verification.assignments.some(
      (a) => a.target.kind === target.kind &&
            a.target.ref === target.ref &&
            (a.target.version_id ?? a.version_id ?? 1) === targetVer &&
            a.status === 'assigned'
    );
    if (duplicate) return fail('DUPLICATE_ASSIGNMENT', 'Active assignment already exists for this claim version.');
  }

  const assignment: Assignment = {
    id: `asg-${caseState.id}-${caseState.verification.assignments.length + 1}`,
    case_id: caseState.id,
    target: { ...target },
    version_id: target.version_id,
    scope: String(action.scope ?? ''),
    assigned_to: assignedTo,
    assigned_by: actor.user_id,
    assigned_on: at.slice(0, 10),
    status: 'assigned',
  };
  caseState.verification.assignments.push(assignment);
  return success(caseState, 'assign_verification', actor, target, null, assignment, at);
}

function recordFinding(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const assignmentId = String(action.assignment_id);
  const assignment = caseState.verification.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment) return fail('NO_SUCH_TARGET');
  if (assignment.assigned_to !== actor.user_id) return fail('NOT_ASSIGNEE');
  if (assignment.status === 'completed' || assignment.status === 'completed_superseded' || assignment.status === 'cancelled') {
    return fail('ASSIGNMENT_COMPLETED');
  }

  const rawResult = String(action.result ?? '') as Finding['result'];
  const result = rawResult;

  const scope = String(action.scope ?? '');
  const limitation = String(action.limitation ?? '');
  if (!meta.finding_results.includes(result)) {
    return fail('FINDING_FIELDS_REQUIRED');
  }
  if (!scope || !limitation) return fail('FINDING_FIELDS_REQUIRED');
  if (assignment.target.kind === 'evidence' && caseState.evidence[assignment.target.ref]?.supplied_by === actor.user_id) {
    return fail('SELF_VERIFICATION');
  }

  const isLateFinding = assignment.status === 'superseded_target';
  const targetVersion = assignment.target.version_id ?? assignment.version_id ?? 1;
  const qualifications = Array.isArray(action.qualifications) ? (action.qualifications as string[]) : [];

  const finding: Finding = {
    id: `fnd-${caseState.verification.findings.length + 1}`,
    assignment_id: assignment.id,
    result,
    scope,
    basis: assignment.target.kind === 'evidence' ? [assignment.target.ref] : [],
    limitation,
    verifier: actor.user_id,
    recorded_on: at,
    qualifications: qualifications.length > 0 ? qualifications : undefined,
    historical: isLateFinding ? true : undefined,
    version_id: targetVersion,
  };

  if (action.method_and_evidence_examined) {
    finding.method_and_evidence_examined = String(action.method_and_evidence_examined);
  }

  if (isLateFinding) {
    assignment.status = 'completed_superseded';
  } else {
    assignment.status = 'completed';
  }

  caseState.verification.findings.push(finding);

  if (assignment.target.kind === 'evidence') {
    const evItem = caseState.evidence[assignment.target.ref];
    if (evItem) {
      const allFindings = caseState.verification.findings.filter(
        (f) => f.basis.includes(assignment.target.ref) || f.assignment_id === assignment.id
      );
      const hasConformant = allFindings.some((f) => f.result === 'verified_conformant' || f.result === 'verified_with_qualifications');
      const hasAdverse = allFindings.some((f) => f.result === 'non_conformant' || f.result === 'inconclusive');
      if (hasConformant && hasAdverse && evItem.conflict_state !== 'resolved') {
        evItem.conflict_state = 'unresolved_conflict';
      }
    }
  }

  return success(caseState, 'record_verification_finding', actor, { assignment_id: assignment.id }, null, finding, at);
}

// SECURITY: The only functions that may write level: 'verified' to evidence are:
//   - promoteEvidenceLevel()   (requires conformant finding, version match, no conflict)
//   - recordFindingAndPromote() (requires conformant finding from an open assignment)
// Adding a new path here requires sign-off on the invariant audit trail.
function promoteEvidenceLevel(
  caseState: CaseState,
  action: ActionInput,
  actor: Actor,
  at: string,
): ActionResult {
  const findingId = String(action.finding_id ?? '');
  const evidenceType = String(action.evidence_type ?? '');

  const evidence = caseState.evidence[evidenceType];
  if (!evidence) return fail('NO_SUCH_EVIDENCE');

  const finding = caseState.verification.findings.find((f) => f.id === findingId);
  if (!finding) {
    return fail('PROMOTE_NO_QUALIFYING_FINDING', 'No finding with that ID exists for this case.');
  }

  const currentVersion = evidence.version_id ?? 1;
  const findingVersion = finding.version_id ?? 1;
  if (findingVersion !== currentVersion) {
    return fail(
      'PROMOTE_VERSION_MISMATCH',
      'The cited finding references a different evidence version than the current one and cannot promote it.',
    );
  }

  const isConformant =
    finding.result === 'verified_conformant' ||
    finding.result === 'verified_with_qualifications';
  if (!isConformant) {
    return fail(
      'PROMOTE_NO_QUALIFYING_FINDING',
      'Only verified_conformant or verified_with_qualifications findings can promote evidence.',
    );
  }

  // Block if a conflicting non-conformant or inconclusive finding exists on the same version
  const hasConflict = caseState.verification.findings.some(
    (f) =>
      f.id !== findingId &&
      (f.version_id ?? 1) === currentVersion &&
      (f.result === 'non_conformant' || f.result === 'inconclusive'),
  );
  if (hasConflict) {
    return fail(
      'PROMOTE_CONFLICTING_FINDING',
      'A conflicting non-conformant or inconclusive finding exists on this version. Resolve the conflict before promoting.',
    );
  }

  const previous = clone(evidence);
  replaceEvidence(caseState, evidenceType, {
    ...evidence,
    level: 'verified',
    verified_by: actor.user_id,
    verified_on: at.slice(0, 10),
    limitation: verifiedLimitation(evidenceType, action.limitation as string | undefined),
    qualifications: finding.qualifications ?? evidence.qualifications,
  });

  return success(
    caseState,
    'promote_evidence_level',
    actor,
    { evidence_type: evidenceType, finding_id: findingId, version_id: currentVersion },
    previous,
    caseState.evidence[evidenceType],
    at,
  );
}

function recordFindingAndPromote(
  caseState: CaseState,
  action: ActionInput,
  actor: Actor,
  at: string,
): ActionResult {
  const assignmentId = String(action.assignment_id);
  const assignment = caseState.verification.assignments.find((candidate) => candidate.id === assignmentId);
  if (!assignment) return fail('NO_SUCH_TARGET');
  if (assignment.assigned_to !== actor.user_id && actor.role !== 'verifier' && actor.role !== 'pfi_credit') {
    return fail('NOT_ASSIGNEE');
  }
  if (assignment.status === 'completed' || assignment.status === 'completed_superseded' || assignment.status === 'cancelled') {
    return fail('ASSIGNMENT_COMPLETED');
  }

  const rawResult = String(action.result ?? '') as Finding['result'];
  const result = rawResult;
  const scope = String(action.scope ?? '');
  const limitation = String(action.limitation ?? '');
  if (!meta.finding_results.includes(result)) {
    return fail('FINDING_FIELDS_REQUIRED');
  }
  if (!scope || !limitation) return fail('FINDING_FIELDS_REQUIRED');

  const evidenceType = assignment.target.ref;
  const evidence = caseState.evidence[evidenceType];
  if (!evidence) return fail('NO_SUCH_EVIDENCE');
  if (evidence.supplied_by === actor.user_id) return fail('SELF_VERIFICATION');

  const isLateFinding = assignment.status === 'superseded_target';
  const targetVersion = assignment.target.version_id ?? assignment.version_id ?? (evidence.version_id ?? 1);
  const currentVersion = evidence.version_id ?? 1;
  const qualifications = Array.isArray(action.qualifications) ? (action.qualifications as string[]) : [];

  const finding: Finding = {
    id: `fnd-${caseState.verification.findings.length + 1}`,
    assignment_id: assignment.id,
    result,
    scope,
    basis: [evidenceType],
    limitation,
    verifier: actor.user_id,
    recorded_on: at,
    qualifications: qualifications.length > 0 ? qualifications : undefined,
    historical: isLateFinding ? true : undefined,
    version_id: targetVersion,
  };

  if (action.method_and_evidence_examined) {
    finding.method_and_evidence_examined = String(action.method_and_evidence_examined);
  }

  if (isLateFinding) {
    assignment.status = 'completed_superseded';
    caseState.verification.findings.push(finding);
    return success(
      caseState,
      'record_finding_and_promote',
      actor,
      { assignment_id: assignment.id, evidence_type: evidenceType, finding_id: finding.id },
      null,
      { finding, evidence },
      at
    );
  }

  assignment.status = 'completed';
  caseState.verification.findings.push(finding);

  if (targetVersion !== currentVersion) {
    return success(
      caseState,
      'record_finding_and_promote',
      actor,
      { assignment_id: assignment.id, evidence_type: evidenceType, finding_id: finding.id },
      null,
      { finding, evidence },
      at
    );
  }

  const hasOpposingFinding = caseState.verification.findings.some(
    (f) =>
      f.id !== finding.id &&
      (f.version_id ?? 1) === currentVersion &&
      (f.result === 'non_conformant' || f.result === 'inconclusive')
  );

  const prevEvidence = clone(evidence);

  if (result === 'verified_conformant' || result === 'verified_with_qualifications') {
    if (hasOpposingFinding) {
      evidence.conflict_state = 'unresolved_conflict';
      return fail('UNRESOLVED_FINDING_CONFLICT', 'Conflicting adverse findings exist on this version. Resolve before promoting.');
    }

    // Single atomic promotion commit
    evidence.level = 'verified';
    evidence.verified_by = actor.user_id;
    evidence.verified_on = at.slice(0, 10);
    evidence.limitation = verifiedLimitation(evidenceType, limitation);
    if (qualifications.length > 0) {
      evidence.qualifications = qualifications;
    }

    return success(
      caseState,
      'record_finding_and_promote',
      actor,
      { assignment_id: assignment.id, evidence_type: evidenceType, finding_id: finding.id },
      { evidence: prevEvidence },
      { evidence, finding },
      at
    );
  }

  // Non-conformant or inconclusive finding: strictly prohibits promotion
  if (!evidence.limitation.includes(`[${result === 'non_conformant' ? 'Non-Conformant' : 'Inconclusive'} Finding]`)) {
    evidence.limitation = `${evidence.limitation} [${result === 'non_conformant' ? 'Non-Conformant' : 'Inconclusive'} Finding]`;
  }
  if (hasOpposingFinding) {
    evidence.conflict_state = 'unresolved_conflict';
  }

  return success(
    caseState,
    'record_finding_and_promote',
    actor,
    { assignment_id: assignment.id, evidence_type: evidenceType, finding_id: finding.id },
    { evidence: prevEvidence },
    { evidence, finding },
    at
  );
}

function resolveFindingConflict(
  caseState: CaseState,
  action: ActionInput,
  actor: Actor,
  at: string,
): ActionResult {
  const evidenceType = String(action.evidence_type ?? '');
  const evidence = caseState.evidence[evidenceType];
  if (!evidence) return fail('NO_SUCH_EVIDENCE');

  const resolvedFindings = Array.isArray(action.resolved_findings) ? (action.resolved_findings as string[]) : [];
  const disposition = String(action.disposition ?? 'upheld') as 'upheld' | 'overruled';
  const rationale = String(action.rationale ?? '');
  if (!rationale) return fail('RESOLUTION_RATIONALE_REQUIRED', 'Attributable conflict resolution requires a rationale.');

  const before = clone(evidence);
  evidence.conflict_state = 'resolved';

  // If a conformant finding is upheld, promote evidence level
  if (disposition === 'upheld') {
    const upheldFinding = caseState.verification.findings.find(
      (f) =>
        resolvedFindings.includes(f.id) &&
        (f.result === 'verified_conformant' || f.result === 'verified_with_qualifications')
    );
    if (upheldFinding) {
      evidence.level = 'verified';
      evidence.verified_by = actor.user_id;
      evidence.verified_on = at.slice(0, 10);
      if (upheldFinding.qualifications) {
        evidence.qualifications = upheldFinding.qualifications;
      }
    }
  }

  return success(
    caseState,
    'resolve_finding_conflict',
    actor,
    { evidence_type: evidenceType, resolved_findings: resolvedFindings, disposition, rationale },
    before,
    evidence,
    at
  );
}

function recordReliance(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const findingId = String(action.finding_id);
  const relianceValue = action.reliance as Reliance['reliance'];
  if (relianceValue !== 'relied' && relianceValue !== 'not_relied') return fail('INVALID_RELIANCE', 'Reliance must be either relied or not_relied.');
  if (!caseState.verification.findings.some((finding) => finding.id === findingId)) return fail('NO_FINDING');
  if (caseState.verification.reliance.some((reliance) => reliance.finding_id === findingId && reliance.relying_user === actor.user_id)) {
    return fail('RELIANCE_ALREADY_RECORDED');
  }
  const reliance: Reliance = {
    id: `rel-${caseState.verification.reliance.length + 1}`,
    finding_id: findingId,
    relying_role: actor.role,
    relying_user: actor.user_id,
    reliance: relianceValue,
    note: action.note as string | undefined,
    recorded_on: at,
  };
  caseState.verification.reliance.push(reliance);
  return success(caseState, 'record_reliance', actor, { finding_id: findingId }, null, reliance, at);
}

function recordAdmission(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const evidenceType = String(action.evidence_type ?? '');
  const status = String(action.status ?? '');
  if (!caseState.evidence[evidenceType]) return fail('NO_SUCH_EVIDENCE');
  if (!['accepted', 'requires_independent_query', 'rejected'].includes(status)) return fail('INVALID_ADMISSION', 'Admission must be accepted, requires_independent_query, or rejected.');
  const admission = {
    id: `adm-${caseState.lender.admissions.length + 1}`,
    evidence_type: evidenceType,
    status: status as 'accepted' | 'requires_independent_query' | 'rejected',
    recorded_by: actor.user_id,
    recorded_on: at,
  };
  caseState.lender.admissions.push(admission);
  return success(caseState, 'record_admission', actor, { evidence_type: evidenceType }, null, admission, at);
}

function requestEvidence(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const requirementId = String(action.requirement_id ?? '');
  const note = String(action.note ?? '');
  if (!caseState.presentation && !caseState.financing) return fail('PRESENTATION_REQUIRED', 'Lender records require a presented or financed case.');
  if (!requirementId || !note) return fail('REQUEST_FIELDS_REQUIRED', 'Evidence request needs a requirement and note.');
  const request = {
    id: `req-${caseState.lender.requests.length + 1}`,
    requirement_id: requirementId,
    evidence_type: (action.evidence_type as string | null | undefined) ?? null,
    note,
    requested_by: actor.user_id,
    requested_on: at,
    status: 'open' as const,
  };
  caseState.lender.requests.push(request);
  return success(caseState, 'request_evidence', actor, { requirement_id: requirementId }, null, request, at);
}

function raiseFinding(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const requirementId = String(action.requirement_id ?? '');
  const findingText = String(action.finding ?? '');
  if (!requirementId || !findingText) return fail('FINDING_FIELDS_REQUIRED');
  const finding = {
    id: `lfn-${caseState.lender.findings.length + 1}`,
    requirement_id: requirementId,
    finding: findingText,
    recorded_by: actor.user_id,
    recorded_on: at,
  };
  caseState.lender.findings.push(finding);
  return success(caseState, 'raise_finding', actor, { requirement_id: requirementId }, null, finding, at);
}

function recordOutcome(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const outcomeValue = String(action.outcome ?? '');
  if (!caseState.presentation && !caseState.financing) return fail('PRESENTATION_REQUIRED', 'Lender records require a presented or financed case.');
  if (!['approved', 'more_evidence_requested', 'declined', 'deferred'].includes(outcomeValue)) {
    return fail('OUTCOME_REQUIRED', 'Outcome must be explicitly selected before it is recorded.');
  }
  const outcome = {
    id: `out-${caseState.lender.outcomes.length + 1}`,
    outcome: outcomeValue as 'approved' | 'more_evidence_requested' | 'declined' | 'deferred',
    note: action.note as string | undefined,
    recorded_by: actor.user_id,
    recorded_on: at,
  };
  caseState.lender.outcomes.push(outcome);
  return success(caseState, 'record_outcome', actor, { outcome: outcome.outcome }, null, outcome, at);
}


function institutionMessage(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const msgList = (caseState.institution_messages = caseState.institution_messages || []);
  const msg: any = {
    id: `msg-${msgList.length + 1}`,
    case_id: caseState.id,
    sender_institution: 'PFI',
    sender_user: actor.user_id,
    message_type: (action.message_type as any) || 'product_proposal',
    subject: String(action.subject || 'Direct-to-Member Financing Inquiry'),
    body: String(action.body || ''),
    proposed_structure: action.proposed_structure ? String(action.proposed_structure) : undefined,
    status: 'sent',
    sent_at: at,
  };
  msgList.push(msg);
  return success(caseState, 'institution_message', actor, { case_id: caseState.id }, null, msg, at);
}

function requestTaIntervention(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const interventionList = (caseState.ta_interventions = caseState.ta_interventions || []);
  const intervention: any = {
    id: `tai-${interventionList.length + 1}`,
    case_id: caseState.id,
    requirement_id: String(action.requirement_id || ''),
    scope: String(action.scope || 'Remediation assistance'),
    provider: String(action.provider || 'ta.officer1'),
    status: 'requested',
    requested_by: actor.user_id,
    requested_on: at,
    notes: action.notes ? String(action.notes) : undefined,
  };
  interventionList.push(intervention);
  return success(caseState, 'request_ta_intervention', actor, { requirement_id: intervention.requirement_id }, null, intervention, at);
}

function recordTaCompletion(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const interventionId = String(action.intervention_id || '');
  const intervention = (caseState.ta_interventions || []).find(i => i.id === interventionId);
  if (intervention) {
    intervention.status = 'completed';
    intervention.completed_on = at;
    if (action.evidence_submitted) {
      intervention.evidence_submitted = String(action.evidence_submitted);
    }
  }

  if (action.evidence_type && action.evidence_payload) {
    const evType = String(action.evidence_type);
    const payload = action.evidence_payload as Record<string, unknown>;
    const prev = caseState.evidence[evType];
    caseState.evidence[evType] = {
      ...(prev || {}),
      ...payload,
      level: 'supported',
      supplied_by: actor.user_id,
      supplied_on: at.slice(0, 10),
      limitation: String(payload.limitation || 'Technical assistance remediation completed. Independent verification pending.'),
      history: [...((prev && prev.history) || []), { level: 'supported', on: at, by: actor.user_id, note: 'TA completion recorded' }]
    } as any;
  }

  return success(caseState, 'record_ta_completion', actor, { intervention_id: interventionId }, null, { completed: true, at }, at);
}

function setDiscoverable(caseState: CaseState, action: ActionInput, actor: Actor, at: string): ActionResult {
  const before = Boolean(caseState.discoverable);
  caseState.discoverable = Boolean(action.discoverable);
  return success(caseState, 'set_discoverable', actor, { case_id: caseState.id }, { discoverable: before }, { discoverable: caseState.discoverable }, at);
}

export function applyAction(inputCaseState: CaseState, action: ActionInput, actor: Actor, at = '2026-10-06T00:00:00Z'): ActionResult {
  const caseState = clone(inputCaseState);
  if (!supportedActions.has(action.type)) return fail('UNSUPPORTED_ACTION', `Unsupported engine action: ${action.type}`);
  const auth = authorize(caseState, action.type, actor);
  if (!auth.ok) return auth.result;

  switch (action.type) {
    case 'upload_minutes':
      return addEvidence(
        caseState,
        {
          ...action,
          evidence_type: 'governance',
          supporting_artefact_id: (action.supporting_artefact_id as string) || 'doc-agm-minutes-2026',
        },
        actor,
        at
      );
    case 'signoff_minutes':
      return success(caseState, 'signoff_minutes', actor, { evidence_type: 'governance' }, null, { signed_by: actor.user_id }, at);
    case 'add_evidence':
      return addEvidence(caseState, action, actor, at);
    case 'mark_verified':
      return markVerified(caseState, action, actor, at);
    case 'restructure_request': {
      const before = clone(caseState.project.request);
      caseState.project.request = clone(action.request as Record<string, unknown>);
      return success(caseState, 'restructure_request', actor, { project: caseState.project.name }, before, caseState.project.request, at);
    }
    case 'raise_dispute':
      return raiseDispute(caseState, action, actor, at);
    case 'resolve_dispute':
      return resolveDispute(caseState, action, actor, at);
    case 'withdraw_dispute':
      return withdrawDispute(caseState, action, actor, at);
    case 'assign_verification':
      return assignVerification(caseState, action, actor, at);
    case 'record_verification_finding':
      return recordFinding(caseState, action, actor, at);
    case 'record_reliance':
      return recordReliance(caseState, action, actor, at);
    case 'record_admission':
      return recordAdmission(caseState, action, actor, at);
    case 'request_evidence':
      return requestEvidence(caseState, action, actor, at);
    case 'raise_finding':
      return raiseFinding(caseState, action, actor, at);
    case 'record_outcome':
      return recordOutcome(caseState, action, actor, at);
    case 'confirm_payment':
      if (action.recorded_by === actor.user_id) return fail('SELF_CONFIRMATION');
      return success(caseState, 'confirm_payment', actor, action.target ?? null, null, { confirmed_by: actor.user_id }, at);
    case 'present_to_destination': {
      const destination = String(action.destination);
      const before = clone(caseState.presentation);
      caseState.presentation = {
        destination,
        presented_on: at.slice(0, 10),
        snapshot: clone(action.snapshot ?? null),
      };
      return success(caseState, 'present_to_destination', actor, { destination }, before, caseState.presentation, at);
    }
        case 'institution_message':
      return institutionMessage(caseState, action, actor, at);
    case 'request_ta_intervention':
      return requestTaIntervention(caseState, action, actor, at);
    case 'record_ta_completion':
      return recordTaCompletion(caseState, action, actor, at);
    case 'set_discoverable':
      return setDiscoverable(caseState, action, actor, at);
    case 'record_claim':
      return addEvidence(caseState, { ...action, level: 'asserted' }, actor, at);
    case 'record_agent_observation':
      return addEvidence(caseState, action, actor, at);
    case 'amend_claim':
      return amendClaim(caseState, action, actor, at);
    case 'cancel_assignment':
      return cancelAssignment(caseState, action, actor, at);
    case 'evaluate_admission_checklist':
      return recordAdmission(caseState, action, actor, at);
    case 'export_dossier':
      return success(
        caseState,
        'export_dossier',
        actor,
        action.target ?? null,
        null,
        {
          exported: true,
          methodology_version: 'EQS-V1-PROVISIONAL',
          provisional_disclaimer: '[PROVISIONAL] Prototype scoring and evaluation — not for production decisions.',
        },
        at
      );
    case 'promote_evidence_level':
      return promoteEvidenceLevel(caseState, action, actor, at);
    case 'attach_corroborating_evidence':
      return addEvidence(caseState, action, actor, at);
    case 'record_finding_and_promote':
      return recordFindingAndPromote(caseState, action, actor, at);
    case 'resolve_finding_conflict':
      return resolveFindingConflict(caseState, action, actor, at);
    default:
      return fail('UNSUPPORTED_ACTION', `Unsupported engine action: ${action.type}`);
  }
}

export const suggestedDemoFinding = verificationSeed.suggested_demo_finding;

export function recordClaim(
  caseState: CaseState,
  payload: { claim_id?: string; evidence_type?: string; item?: Record<string, unknown> },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'record_claim', ...payload }, actor, at);
}

export function recordAgentObservation(
  caseState: CaseState,
  payload: {
    claim_id?: string;
    evidence_type?: string;
    contact_ref_id: string;
    observation_date?: string;
    has_discrepancy?: boolean;
    notes?: string;
    item?: Record<string, unknown>;
  },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'record_agent_observation', ...payload }, actor, at);
}

export function amendClaimAction(
  caseState: CaseState,
  payload: { claim_id?: string; evidence_type?: string; item?: Record<string, unknown> },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'amend_claim', ...payload }, actor, at);
}

export function assignVerificationAction(
  caseState: CaseState,
  payload: { target: Assignment['target']; assigned_to: string; scope?: string },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'assign_verification', ...payload }, actor, at);
}

export function recordVerificationFindingAction(
  caseState: CaseState,
  payload: {
    assignment_id: string;
    result: FindingResult;
    scope: string;
    limitation: string;
    method_and_evidence_examined?: string;
    qualifications?: string[];
  },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'record_verification_finding', ...payload }, actor, at);
}

export function cancelAssignmentAction(
  caseState: CaseState,
  payload: { assignment_id: string },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'cancel_assignment', ...payload }, actor, at);
}

export function evaluateAdmissionChecklist(
  caseState: CaseState,
  payload: { evidence_type: string; status: 'accepted' | 'requires_independent_query' | 'rejected' },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'evaluate_admission_checklist', ...payload }, actor, at);
}

export function promoteEvidenceLevelAction(
  caseState: CaseState,
  payload: { evidence_type: string; finding_id: string; limitation?: string },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'promote_evidence_level', ...payload }, actor, at);
}

export function attachCorroboratingEvidenceAction(
  caseState: CaseState,
  payload: {
    evidence_type: string;
    supporting_artefact_id: string;
    artefact_hash?: string;
    method?: string;
    limitation?: string;
    item?: Record<string, unknown>;
  },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'attach_corroborating_evidence', ...payload }, actor, at);
}

export function recordFindingAndPromoteAction(
  caseState: CaseState,
  payload: {
    assignment_id: string;
    result: FindingResult;
    scope: string;
    limitation: string;
    method_and_evidence_examined?: string;
    qualifications?: string[];
  },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'record_finding_and_promote', ...payload }, actor, at);
}

export function resolveFindingConflictAction(
  caseState: CaseState,
  payload: {
    evidence_type: string;
    resolved_findings: string[];
    disposition: 'upheld' | 'overruled';
    rationale: string;
  },
  actor: Actor,
  at?: string,
): ActionResult {
  return applyAction(caseState, { type: 'resolve_finding_conflict', ...payload }, actor, at);
}
