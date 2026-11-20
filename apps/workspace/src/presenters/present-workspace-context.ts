import type { WorkspaceAuthorityFactContract, WorkspaceContextFactsContract } from '@symphony/contracts';

export type WorkspacePersona = 'cooperative_member' | 'chairperson' | 'vice_chairperson' | 'secretary' | 'treasurer' | 'internal_verifier' | 'programme_manager' | 'union_ta' | 'self_enroller';

export interface WorkspaceNavigationItem {
  readonly label: string;
  readonly path: string;
}

export interface PresentedWorkspaceContext {
  readonly id: string;
  readonly persona: WorkspacePersona;
  readonly label: string;
  readonly organizationId: string | null;
  readonly organizationName: string | null;
  readonly scopeOrganizationIds: readonly string[];
  readonly scopeMode: WorkspaceAuthorityFactContract['scopeMode'];
  readonly navigation: readonly WorkspaceNavigationItem[];
}

const navigation: Record<WorkspacePersona, readonly WorkspaceNavigationItem[]> = {
  cooperative_member: [
    { label: 'Overview', path: 'overview' },
    { label: 'My activities', path: 'my-activities' },
    { label: 'My household', path: 'my-household' },
  ],
  chairperson: [
    { label: 'Overview', path: 'overview' },
    { label: 'Governance', path: 'governance' },
    { label: 'Meetings and resolutions', path: 'meetings' },
    { label: 'By-laws and requirements', path: 'bylaws' },
    { label: 'Evidence register', path: 'evidence' },
    { label: 'Findings and next actions', path: 'findings' },
  ],
  vice_chairperson: [
    { label: 'Overview', path: 'overview' },
    { label: 'Governance', path: 'governance' },
    { label: 'Meetings and resolutions', path: 'meetings' },
    { label: 'By-laws and requirements', path: 'bylaws' },
    { label: 'Evidence register', path: 'evidence' },
    { label: 'Findings and next actions', path: 'findings' },
  ],
  secretary: [
    { label: 'Overview', path: 'overview' },
    { label: 'Identity', path: 'identity' },
    { label: 'By-laws and requirements', path: 'bylaws' },
    { label: 'Governance', path: 'governance' },
    { label: 'Meetings and resolutions', path: 'meetings' },
    { label: 'Evidence register', path: 'evidence' },
    { label: 'Findings and next actions', path: 'findings' },
  ],
  treasurer: [
    { label: 'Overview', path: 'overview' },
    { label: 'Financial records', path: 'financial-records' },
    { label: 'Meetings and resolutions', path: 'meetings' },
    { label: 'Evidence register', path: 'evidence' },
    { label: 'Findings and next actions', path: 'findings' },
  ],
  internal_verifier: [
    { label: 'Overview', path: 'overview' },
    { label: 'Evidence register', path: 'evidence' },
    { label: 'Verification queue', path: 'verification-queue' },
    { label: 'Findings and next actions', path: 'findings' },
  ],
  programme_manager: [
    { label: 'Pipeline', path: 'pipeline' },
    { label: 'Cohort', path: 'cohort' },
    { label: 'Directory', path: 'directory' },
    { label: 'Legal catalogue review', path: 'legal-catalogue' },
    { label: 'Delegations', path: 'delegations' },
  ],
  union_ta: [
    { label: 'Cohort', path: 'cohort' },
    { label: 'Capability gaps', path: 'capability-gaps' },
  ],
  self_enroller: [
    { label: 'Certificate details', path: 'certificate-details' },
    { label: 'Create officer accounts', path: 'create-officer-accounts' },
    { label: 'Hand over', path: 'hand-over' },
  ],
};

function contextFromFact(fact: WorkspaceAuthorityFactContract, persona: WorkspacePersona): PresentedWorkspaceContext {
  const label = fact.organizationName ? `${personaLabel[persona]} — ${fact.organizationName}` : personaLabel[persona];
  return {
    id: `${persona}:${fact.sourceId}`,
    persona,
    label,
    organizationId: fact.organizationId,
    organizationName: fact.organizationName,
    scopeOrganizationIds: fact.scopeOrganizationIds,
    scopeMode: fact.scopeMode,
    navigation: navigation[persona],
  };
}

const personaLabel: Record<WorkspacePersona, string> = {
  cooperative_member: 'Cooperative member',
  chairperson: 'Chairperson',
  vice_chairperson: 'Vice-Chairperson',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  internal_verifier: 'Internal verifier',
  programme_manager: 'Programme manager',
  union_ta: 'Union TA',
  self_enroller: 'Self-enroller',
};

export function presentWorkspaceContexts(data: WorkspaceContextFactsContract): PresentedWorkspaceContext[] {
  const contexts: PresentedWorkspaceContext[] = [];
  const facts = data.facts;
  for (const fact of facts) {
    if (fact.kind === 'membership' && fact.organizationKind === 'cooperative') {
      contexts.push(contextFromFact(fact, 'cooperative_member'));
    } else if (fact.kind === 'appointment' && ['chairperson', 'vice_chairperson', 'secretary', 'treasurer'].includes(fact.authority)) {
      contexts.push(contextFromFact(fact, fact.authority as Extract<WorkspacePersona, 'chairperson' | 'vice_chairperson' | 'secretary' | 'treasurer'>));
    } else if (fact.kind === 'capacity' && fact.authority === 'internal_verifier') {
      contexts.push(contextFromFact(fact, 'internal_verifier'));
    } else if (fact.kind === 'institutional_role' && fact.authority === 'union_ta') {
      contexts.push(contextFromFact(fact, 'union_ta'));
    } else if (fact.kind === 'enrolment' && fact.authority === 'self_enroller') {
      contexts.push(contextFromFact(fact, 'self_enroller'));
    } else if (fact.kind === 'platform_role' && fact.authority === 'programme_manager') {
      // The owner-approved projection scope is read-only, same-tenant, and
      // independent from the narrower D-17 TA delegation grant scope.
      contexts.push(contextFromFact(fact, 'programme_manager'));
    }
  }
  const personaOrder: WorkspacePersona[] = ['cooperative_member', 'chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'internal_verifier', 'programme_manager', 'union_ta', 'self_enroller'];
  return contexts.sort((a, b) => personaOrder.indexOf(a.persona) - personaOrder.indexOf(b.persona)
    || (a.organizationName ?? '').localeCompare(b.organizationName ?? '', 'en') || a.id.localeCompare(b.id, 'en'));
}

export function isOrganizationInContext(context: PresentedWorkspaceContext, organizationId: string): boolean {
  if (context.organizationId === organizationId || context.scopeOrganizationIds.includes(organizationId)) return true;
  return false;
}

export function selectWorkspaceContext(
  contexts: readonly PresentedWorkspaceContext[],
  input: {
    readonly requestedContextId?: string | null;
    readonly selectedContextId?: string | null;
    readonly cooperativeId?: string | null | undefined;
    readonly pathname: string;
  },
): PresentedWorkspaceContext | undefined {
  const authorized = input.cooperativeId
    ? contexts.filter((context) => isOrganizationInContext(context, input.cooperativeId!))
    : [...contexts];
  const selectedByUrl = contexts.find((context) => context.id === input.requestedContextId);
  if (selectedByUrl && (!input.cooperativeId || isOrganizationInContext(selectedByUrl, input.cooperativeId))) return selectedByUrl;

  const selectedInSession = contexts.find((context) => context.id === input.selectedContextId);
  if (selectedInSession && (!input.cooperativeId || isOrganizationInContext(selectedInSession, input.cooperativeId))) return selectedInSession;

  const routeContext = authorized.find((context) =>
    context.navigation.some((area) => input.pathname.endsWith(`/${area.path}`)));
  if (routeContext) return routeContext;

  if (input.cooperativeId && /^\/coop\/[^/]+\/?$/.test(input.pathname)) {
    return authorized.find((context) => context.organizationId === input.cooperativeId) ?? authorized[0];
  }

  return contexts[0];
}
