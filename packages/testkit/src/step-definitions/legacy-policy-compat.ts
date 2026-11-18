/** Test-only adapter for quarantined Phase 2 authorization BDD. */
export interface LegacyPolicyActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly platformRoles: readonly string[];
  readonly appointments: readonly { readonly position: string; readonly tenantId: string; readonly activeFrom: string; readonly activeTo: string }[];
  readonly capacities: readonly { readonly type: string; readonly tenantId: string; readonly activeFrom: string; readonly activeTo: string }[];
  readonly delegations: readonly { readonly type: string; readonly tenantId: string; readonly position: string; readonly activeFrom: string; readonly activeTo: string }[];
}

export interface LegacyPolicyTarget {
  readonly id: string;
  readonly type: string;
  readonly tenantId: string;
  readonly suppliedBy?: string;
  readonly collectedBy?: string;
}

const readOnly = new Set(['ta', 'pfi_analyst', 'pfi_credit', 'fund_manager', 'external_verifier', 'union_ta']);
const officers = new Set(['chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'director', 'committee_chair']);
const active = (from: string, to: string, now: string) => from <= now && now < to;

export function decideLegacyPolicy(action: string, target: LegacyPolicyTarget, actor: LegacyPolicyActor, now: string): 'allow' | 'deny' {
  const mutating = new Set(['AddEvidence', 'AmendClaim', 'AdmitEvidence', 'ApproveMinutes', 'RecordAppointment', 'RecordTaCompletion', 'GrantCapacity', 'RevokeCapacity', 'RecordFinding']);
  if (!mutating.has(action) && !action.startsWith('GrantCapacity:') && !action.startsWith('RevokeCapacity:')) return 'deny';
  if (actor.platformRoles.some((role) => readOnly.has(role)) || target.tenantId !== actor.tenantId) return 'deny';
  const appointments = actor.appointments.filter((item) => item.tenantId === target.tenantId && active(item.activeFrom, item.activeTo, now));
  if (action === 'GrantCapacity:internal_verifier') {
    return actor.platformRoles.includes('platform_enroller') || appointments.some((item) => ['chairperson', 'vice_chairperson'].includes(item.position)) ? 'allow' : 'deny';
  }
  if (action.startsWith('GrantCapacity:') || action.startsWith('RevokeCapacity:')) return 'deny';
  if (action === 'RecordFinding') {
    if (target.suppliedBy === actor.userId || target.collectedBy === actor.userId) return 'deny';
    return actor.capacities.some((item) => item.type === 'internal_verifier' && item.tenantId === target.tenantId && active(item.activeFrom, item.activeTo, now)) ? 'allow' : 'deny';
  }
  if (['ApproveMinutes', 'AdmitEvidence', 'RecordAppointment'].includes(action)) {
    const appointed = appointments.some((item) => officers.has(item.position));
    const delegated = actor.delegations.some((item) => item.type === 'acting_officer' && item.tenantId === target.tenantId
      && officers.has(item.position) && active(item.activeFrom, item.activeTo, now));
    return appointed || delegated ? 'allow' : 'deny';
  }
  return 'allow';
}
