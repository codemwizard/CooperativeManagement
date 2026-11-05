/**
 * @symphony/domain — authz/policy-engine.ts
 *
 * Pure authorisation policy engine (VER-001, VER-007, UNI-001).
 *
 * Implements HARD rules from the specification:
 *   INV-011 / IFV-6: No self-verification (supplier/collector cannot be IFV on same version)
 *   INV-024: Institutional read-only roles cannot mutate cooperative source records
 *   IFV-3:  Capacity is scoped to one organisation
 *   IFV-7:  Revocation (activeTo in past) makes capacity ineffective
 *
 * Design:
 *   - Pure function — no side effects, no I/O
 *   - Input validated (no `any` types)
 *   - Returns typed `PolicyDecision` string union
 *   - Errors classified, not generic
 *
 * Usage:
 *   const decision = decide('RecordFinding', target, actor, context);
 *   if (decision === 'deny') { ... }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyDecision = 'allow' | 'allow_with_label' | 'advise' | 'deny';

export interface Appointment {
  readonly position: string;
  readonly tenantId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface Capacity {
  readonly type: string;
  readonly tenantId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface Delegation {
  readonly type: string;
  readonly tenantId: string;
  readonly position: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface ActorContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly platformRoles: readonly string[];
  readonly appointments: readonly Appointment[];
  readonly capacities: readonly Capacity[];
  readonly delegations: readonly Delegation[];
}

export interface PolicyTarget {
  readonly id: string;
  readonly type: string;
  readonly tenantId: string;
  /** User ID of the person who supplied this version (for IFV conflict check). */
  readonly suppliedBy?: string;
  /** User ID of the person who collected this version. */
  readonly collectedBy?: string;
}

export interface PolicyContext {
  readonly now: string; // ISO 8601
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Platform roles that are read-only on cooperative source records (INV-024). */
const READ_ONLY_INSTITUTIONAL_ROLES = new Set([
  'ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'external_verifier', 'union_ta',
]);

/**
 * Actions that mutate cooperative source records.
 * Institutional roles may NOT perform these.
 */
const MUTATING_ACTIONS = new Set([
  'AddEvidence', 'AmendClaim', 'AdmitEvidence', 'ApproveMinutes',
  'RecordAppointment', 'RecordTaCompletion', 'GrantCapacity', 'RevokeCapacity',
  'RecordFinding',
]);

/** Positions that may grant the internal_verifier capacity (IFV-2). */
const IFV_GRANT_POSITIONS = new Set(['chairperson', 'vice_chairperson']);

/** Actions requiring an active IFV capacity scoped to target tenant. */
const IFV_ACTIONS = new Set(['RecordFinding']);

/** Actions requiring an officer appointment or acting_officer delegation. */
const OFFICER_ACTIONS = new Set(['ApproveMinutes', 'AdmitEvidence', 'RecordAppointment']);

/** Positions counted as officers for OFFICER_ACTIONS. */
const OFFICER_POSITIONS = new Set([
  'chairperson', 'vice_chairperson', 'secretary', 'treasurer',
  'director', 'committee_chair',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(item: { activeFrom: string; activeTo: string }, now: string): boolean {
  return item.activeFrom <= now && now < item.activeTo;
}

function hasActiveAppointment(
  actor: ActorContext,
  positions: Set<string>,
  tenantId: string,
  now: string,
): boolean {
  return actor.appointments.some(
    (a) => positions.has(a.position) && a.tenantId === tenantId && isActive(a, now),
  );
}

function hasActiveCapacity(
  actor: ActorContext,
  type: string,
  tenantId: string,
  now: string,
): boolean {
  return actor.capacities.some(
    (c) => c.type === type && c.tenantId === tenantId && isActive(c, now),
  );
}

function hasActiveDelegation(
  actor: ActorContext,
  type: string,
  tenantId: string,
  now: string,
): boolean {
  return actor.delegations.some(
    (d) => d.type === type && d.tenantId === tenantId && isActive(d, now),
  );
}

function hasActingOfficerDelegation(
  actor: ActorContext,
  tenantId: string,
  now: string,
): boolean {
  return actor.delegations.some(
    (d) =>
      d.type === 'acting_officer' &&
      d.tenantId === tenantId &&
      OFFICER_POSITIONS.has(d.position) &&
      isActive(d, now),
  );
}

// ─── Main policy decision function ────────────────────────────────────────────

/**
 * Evaluate an authorisation policy decision.
 *
 * @param action  - The action being attempted (e.g. 'RecordFinding', 'GrantCapacity:internal_verifier')
 * @param target  - The resource being acted on
 * @param actor   - The actor attempting the action
 * @param context - Evaluation context (now timestamp)
 * @returns PolicyDecision — 'allow' | 'allow_with_label' | 'advise' | 'deny'
 */
export function decide(
  action: string,
  target: PolicyTarget,
  actor: ActorContext,
  context: PolicyContext,
): PolicyDecision {
  const { now } = context;
  const targetTenantId = target.tenantId;
  const actorTenantId = actor.tenantId;

  // ── HARD: Institutional read-only roles cannot mutate cooperative source records (INV-024) ──
  const hasInstitutionalRole = actor.platformRoles.some((r) =>
    READ_ONLY_INSTITUTIONAL_ROLES.has(r),
  );
  if (hasInstitutionalRole && MUTATING_ACTIONS.has(action)) {
    return 'deny';
  }

  // ── HARD: Cross-organisation boundary (AUD-004 / IFV-3) ──
  // Actions on a target in a different org than the actor are denied
  // unless the actor has explicit cross-org authority (not modelled in Phase 1)
  if (targetTenantId !== actorTenantId) {
    return 'deny';
  }

  // ── GrantCapacity:internal_verifier — only Chairperson or Vice-Chairperson ──
  if (action === 'GrantCapacity:internal_verifier') {
    const canGrant = hasActiveAppointment(actor, IFV_GRANT_POSITIONS, targetTenantId, now);
    // Also allow enroller during session (platform_enroller role)
    const isEnroller = actor.platformRoles.includes('platform_enroller');
    return canGrant || isEnroller ? 'allow' : 'deny';
  }

  // ── RecordFinding — IFV conflict and capacity checks ──
  if (IFV_ACTIONS.has(action)) {
    // HARD: IFV-6 — cannot verify own supplied version (by person_id)
    if (target.suppliedBy !== undefined && target.suppliedBy === actor.userId) {
      return 'deny';
    }
    if (target.collectedBy !== undefined && target.collectedBy === actor.userId) {
      return 'deny';
    }

    // Must have active IFV capacity for this organisation
    const hasIFV = hasActiveCapacity(actor, 'internal_verifier', targetTenantId, now);
    return hasIFV ? 'allow' : 'deny';
  }

  // ── Officer actions — appointment or acting_officer delegation ──
  if (OFFICER_ACTIONS.has(action)) {
    const isOfficer = hasActiveAppointment(actor, OFFICER_POSITIONS, targetTenantId, now);
    const isActingOfficer = hasActingOfficerDelegation(actor, targetTenantId, now);
    return isOfficer || isActingOfficer ? 'allow' : 'deny';
  }

  // ── ApproveMinutes — same as officer actions (also via delegation) ──
  if (action === 'ApproveMinutes') {
    const isOfficer = hasActiveAppointment(actor, OFFICER_POSITIONS, targetTenantId, now);
    const isActingOfficer = hasActingOfficerDelegation(actor, targetTenantId, now);
    return isOfficer || isActingOfficer ? 'allow' : 'deny';
  }

  // ── Default: allow if actor and target are in the same org ──
  // (More granular rules added per WP as domain grows)
  return 'allow';
}

