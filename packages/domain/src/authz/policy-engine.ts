/** Pure Phase 1 authorization policy (REM-WP2.1). */

export type PolicyDecision = 'allow' | 'allow_with_label' | 'advise' | 'deny';

export const CAPACITY_TYPES = ['internal_verifier', 'field_agent', 'delegate', 'acting_officer'] as const;
export type CapacityType = typeof CAPACITY_TYPES[number];

export type PolicyAction =
  | {
      readonly type: 'capacity.grant';
      readonly capacityType: CapacityType;
      readonly granteeUserId: string;
      readonly activeFrom: string;
      readonly activeTo: string;
    }
  | {
      readonly type: 'capacity.revoke';
      readonly capacityType: CapacityType;
      readonly granteeUserId: string;
    }
  | {
      readonly type: 'ta_scope.grant';
      readonly delegateeUserId: string;
      readonly cohortId: string;
      readonly activeFrom: string;
      readonly activeTo: string;
    }
  | {
      readonly type: 'ta_scope.revoke';
      readonly delegateeUserId: string;
      readonly cohortId: string;
    };

export interface Appointment {
  readonly position: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface Capacity {
  readonly type: CapacityType;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface Delegation {
  readonly type: 'acting_officer';
  readonly tenantId: string;
  readonly organizationId: string;
  readonly position: string;
  readonly activeFrom: string;
  readonly activeTo: string;
}

export interface AssistedEnrollmentSession {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly activeFrom: string;
  readonly activeTo: string;
  readonly representativePresent: boolean;
  readonly grantDecisionRecorded: boolean;
}

export interface ActorContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly platformRoles: readonly string[];
  readonly appointments: readonly Appointment[];
  readonly capacities: readonly Capacity[];
  readonly delegations: readonly Delegation[];
  /** Cohort IDs are resolved from current persisted programme-manager authority. */
  readonly managedCohortIds?: readonly string[];
  /** Active assisted-enrolment sessions resolved by the trusted server context. */
  readonly assistedEnrollmentSessions?: readonly AssistedEnrollmentSession[];
}

export interface PolicyTarget {
  readonly id: string;
  readonly type: string;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly cohortId?: string;
}

export interface PolicyContext {
  readonly now: string;
}

const POSITION_CODES = new Set([
  'chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'director', 'committee_chair', 'committee_member',
]);
const PLATFORM_ROLE_CODES = new Set([
  'platform_admin', 'platform_enroller', 'self_enroller', 'programme_manager',
  'ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'external_verifier', 'union_ta',
]);
const READ_ONLY_INSTITUTIONAL_ROLES = new Set([
  'ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'external_verifier', 'union_ta',
]);
const COOPERATIVE_AUTHORITY_POSITIONS = new Set(['chairperson', 'vice_chairperson']);
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

function hasValidInterval(activeFrom: string, activeTo: string): boolean {
  return Date.parse(activeFrom) < Date.parse(activeTo);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isCapacityType(value: unknown): value is CapacityType {
  return typeof value === 'string' && (CAPACITY_TYPES as readonly string[]).includes(value);
}

function isAction(value: unknown): value is PolicyAction {
  if (!isRecord(value) || typeof value['type'] !== 'string') return false;
  switch (value['type']) {
    case 'capacity.grant':
      return hasOnlyKeys(value, ['type', 'capacityType', 'granteeUserId', 'activeFrom', 'activeTo'])
        && isCapacityType(value['capacityType'])
        && isNonEmptyString(value['granteeUserId'])
        && isInstant(value['activeFrom'])
        && isInstant(value['activeTo']);
    case 'capacity.revoke':
      return hasOnlyKeys(value, ['type', 'capacityType', 'granteeUserId'])
        && isCapacityType(value['capacityType'])
        && isNonEmptyString(value['granteeUserId']);
    case 'ta_scope.grant':
      return hasOnlyKeys(value, ['type', 'delegateeUserId', 'cohortId', 'activeFrom', 'activeTo'])
        && isNonEmptyString(value['delegateeUserId'])
        && isNonEmptyString(value['cohortId'])
        && isInstant(value['activeFrom'])
        && isInstant(value['activeTo']);
    case 'ta_scope.revoke':
      return hasOnlyKeys(value, ['type', 'delegateeUserId', 'cohortId'])
        && isNonEmptyString(value['delegateeUserId'])
        && isNonEmptyString(value['cohortId']);
    default:
      return false;
  }
}

function isTarget(value: unknown): value is PolicyTarget {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'type', 'tenantId', 'organizationId', 'cohortId'])) return false;
  return isNonEmptyString(value['id'])
    && isNonEmptyString(value['type'])
    && isNonEmptyString(value['tenantId'])
    && (value['organizationId'] === undefined || isNonEmptyString(value['organizationId']))
    && (value['cohortId'] === undefined || isNonEmptyString(value['cohortId']));
}

function isAppointment(value: unknown): value is Appointment {
  if (!isRecord(value) || !hasOnlyKeys(value, ['position', 'tenantId', 'organizationId', 'activeFrom', 'activeTo'])) return false;
  return typeof value['position'] === 'string' && POSITION_CODES.has(value['position'])
    && isNonEmptyString(value['tenantId']) && isNonEmptyString(value['organizationId'])
    && isInstant(value['activeFrom']) && isInstant(value['activeTo']) && hasValidInterval(value['activeFrom'], value['activeTo']);
}

function isCapacity(value: unknown): value is Capacity {
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'tenantId', 'organizationId', 'activeFrom', 'activeTo'])) return false;
  return isCapacityType(value['type']) && isNonEmptyString(value['tenantId'])
    && isNonEmptyString(value['organizationId']) && isInstant(value['activeFrom']) && isInstant(value['activeTo'])
    && hasValidInterval(value['activeFrom'], value['activeTo']);
}

function isDelegation(value: unknown): value is Delegation {
  if (!isRecord(value) || !hasOnlyKeys(value, ['type', 'tenantId', 'organizationId', 'position', 'activeFrom', 'activeTo'])) return false;
  return value['type'] === 'acting_officer' && isNonEmptyString(value['tenantId'])
    && isNonEmptyString(value['organizationId'])
    && typeof value['position'] === 'string' && POSITION_CODES.has(value['position'])
    && isInstant(value['activeFrom']) && isInstant(value['activeTo']) && hasValidInterval(value['activeFrom'], value['activeTo']);
}

function isAssistedEnrollmentSession(value: unknown): value is AssistedEnrollmentSession {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'tenantId', 'organizationId', 'activeFrom', 'activeTo', 'representativePresent', 'grantDecisionRecorded'])) return false;
  return isNonEmptyString(value['id']) && isNonEmptyString(value['tenantId'])
    && isNonEmptyString(value['organizationId']) && isInstant(value['activeFrom']) && isInstant(value['activeTo'])
    && hasValidInterval(value['activeFrom'], value['activeTo'])
    && typeof value['representativePresent'] === 'boolean' && typeof value['grantDecisionRecorded'] === 'boolean';
}

function isActorContext(value: unknown): value is ActorContext {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'userId', 'tenantId', 'platformRoles', 'appointments', 'capacities', 'delegations', 'managedCohortIds', 'assistedEnrollmentSessions',
  ])) return false;
  if (!isNonEmptyString(value['userId']) || !isNonEmptyString(value['tenantId']) || !isStringArray(value['platformRoles'])) return false;
  if (value['platformRoles'].some((role) => !PLATFORM_ROLE_CODES.has(role))) return false;
  if (!Array.isArray(value['appointments']) || !value['appointments'].every(isAppointment)) return false;
  if (!Array.isArray(value['capacities']) || !value['capacities'].every(isCapacity)) return false;
  if (!Array.isArray(value['delegations']) || !value['delegations'].every(isDelegation)) return false;
  if (value['managedCohortIds'] !== undefined && !isStringArray(value['managedCohortIds'])) return false;
  if (value['assistedEnrollmentSessions'] !== undefined
    && (!Array.isArray(value['assistedEnrollmentSessions']) || !value['assistedEnrollmentSessions'].every(isAssistedEnrollmentSession))) return false;
  return true;
}

function isPolicyContext(value: unknown): value is PolicyContext {
  return isRecord(value) && hasOnlyKeys(value, ['now']) && isInstant(value['now']);
}

function isActive(interval: { readonly activeFrom: string; readonly activeTo: string }, now: string): boolean {
  return Date.parse(interval.activeFrom) <= Date.parse(now) && Date.parse(now) < Date.parse(interval.activeTo);
}

function hasCooperativeAuthority(actor: ActorContext, target: PolicyTarget, now: string): boolean {
  if (!target.organizationId) return false;
  const officer = actor.appointments.some((appointment) =>
    COOPERATIVE_AUTHORITY_POSITIONS.has(appointment.position)
      && appointment.tenantId === target.tenantId
      && appointment.organizationId === target.organizationId
      && isActive(appointment, now));
  const acting = actor.delegations.some((delegation) =>
    COOPERATIVE_AUTHORITY_POSITIONS.has(delegation.position)
      && delegation.tenantId === target.tenantId
      && delegation.organizationId === target.organizationId
      && isActive(delegation, now));
  return officer || acting;
}

function hasAssistedIfvAuthority(actor: ActorContext, target: PolicyTarget, now: string): boolean {
  if (!target.organizationId || !actor.platformRoles.includes('platform_enroller')) return false;
  return (actor.assistedEnrollmentSessions ?? []).some((session) =>
    session.tenantId === target.tenantId
      && session.organizationId === target.organizationId
      && session.representativePresent
      && session.grantDecisionRecorded
      && isActive(session, now));
}

/**
 * Evaluate a closed Phase 1 action using trusted, validated actor authority.
 * Unknown/malformed input always denies. This is a pure function with no I/O.
 */
export function decide(action: unknown, target: unknown, actor: unknown, context: unknown): PolicyDecision {
  if (!isAction(action) || !isTarget(target) || !isActorContext(actor) || !isPolicyContext(context)) return 'deny';
  const now = context.now;

  if (actor.platformRoles.some((role) => READ_ONLY_INSTITUTIONAL_ROLES.has(role))) return 'deny';
  if (target.tenantId !== actor.tenantId) return 'deny';

  switch (action.type) {
    case 'capacity.grant': {
      if (target.type !== 'organization_capacity' || !target.organizationId) return 'deny';
      if (!hasValidInterval(action.activeFrom, action.activeTo) || Date.parse(action.activeTo) <= Date.parse(now)) return 'deny';
      if (hasCooperativeAuthority(actor, target, now)) return 'allow';
      if (action.capacityType === 'internal_verifier' && hasAssistedIfvAuthority(actor, target, now)) return 'allow';
      return 'deny';
    }
    case 'capacity.revoke':
      if (target.type !== 'organization_capacity' || !target.organizationId) return 'deny';
      return hasCooperativeAuthority(actor, target, now) ? 'allow' : 'deny';
    case 'ta_scope.grant':
      if (target.type !== 'cohort_ta_delegation' || target.cohortId !== action.cohortId) return 'deny';
      if (!hasValidInterval(action.activeFrom, action.activeTo) || Date.parse(action.activeTo) <= Date.parse(now)) return 'deny';
      return actor.platformRoles.includes('programme_manager')
        && (actor.managedCohortIds ?? []).includes(action.cohortId) ? 'allow' : 'deny';
    case 'ta_scope.revoke':
      if (target.type !== 'cohort_ta_delegation' || target.cohortId !== action.cohortId) return 'deny';
      return actor.platformRoles.includes('programme_manager')
        && (actor.managedCohortIds ?? []).includes(action.cohortId) ? 'allow' : 'deny';
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

