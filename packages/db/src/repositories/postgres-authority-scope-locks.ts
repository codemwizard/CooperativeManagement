import type { Transaction } from 'kysely';
import { sql } from 'kysely';
import type { SymphonyDatabase } from '../types/database.js';

export type AuthorityScopeType = 'global_policy' | 'organization' | 'tenant' | 'actor_tenant' | 'actor';
export type AuthorityLockMode = 'protected_read' | 'authority_mutation';
export type Phase1AuthorityAction = 'capacity.grant' | 'capacity.revoke' | 'ta_scope.grant' | 'ta_scope.revoke';

export interface AuthorityScopeKey {
  readonly scopeType: AuthorityScopeType;
  readonly tenantId: string | null;
  readonly scopeId: string;
}

export interface AuthorityScopeLockRequest {
  /** Values must come from the authenticated session and transaction tenant context. */
  readonly tenantId: string;
  readonly actorUserId: string;
  /** Organization IDs are references resolved by trusted command logic, never copied from lock keys. */
  readonly organizationIds: readonly string[];
  /** Affected actors are resolved from persisted grant/delegation source rows. */
  readonly affectedActorUserIds: readonly string[];
  /** Frozen WP2.1 action identity; all four actions consume global policy and actor role facts. */
  readonly actionId: Phase1AuthorityAction;
  readonly mode: AuthorityLockMode;
  /** The command target lock is always acquired before authority-scope rows. */
  readonly commandTargetAggregateId?: string;
}

export interface AuthorityScopeLockSet {
  readonly scopes: readonly AuthorityScopeKey[];
  readonly versions: ReadonlyMap<string, number>;
  /** Call after supported source DML; updates every changed locked scope once in this transaction. */
  incrementChangedScopes(changedScopes: readonly AuthorityScopeKey[]): Promise<void>;
}

const GLOBAL_POLICY_SENTINEL = '00000000-0000-0000-0000-000000000001';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHASE1_AUTHORITY_ACTIONS = new Set<Phase1AuthorityAction>([
  'capacity.grant', 'capacity.revoke', 'ta_scope.grant', 'ta_scope.revoke',
]);
const SCOPE_RANK: Readonly<Record<AuthorityScopeType, number>> = {
  global_policy: 0,
  organization: 1,
  tenant: 2,
  actor_tenant: 3,
  actor: 4,
};

/**
 * Resolve trusted scope references, provision permitted tenant rows, and acquire
 * all authority locks in the single D-16 canonical order. Call inside the
 * authenticated command transaction, after its command-target aggregate lock.
 */
export async function acquireAuthorityScopeLocks(
  trx: Transaction<SymphonyDatabase>,
  request: AuthorityScopeLockRequest,
): Promise<AuthorityScopeLockSet> {
  if (!PHASE1_AUTHORITY_ACTIONS.has(request.actionId)) throw new TypeError('Unsupported Phase 1 authority action');
  const tenantId = canonicalUuid(request.tenantId, 'tenant');
  const actorUserId = canonicalUuid(request.actorUserId, 'actor');
  if (request.organizationIds.length === 0 || request.affectedActorUserIds.length === 0) {
    throw new TypeError('Phase 1 authority actions require persisted organization and affected-actor scope references');
  }
  const organizationIds = uniqueCanonicalUuids(request.organizationIds, 'organization');
  const affectedActorUserIds = uniqueCanonicalUuids(
    [...request.affectedActorUserIds, actorUserId],
    'affected actor',
  );
  const commandTargetAggregateId = request.commandTargetAggregateId === undefined
    ? undefined
    : canonicalUuid(request.commandTargetAggregateId, 'command target');

  await assertTransactionTenant(trx, tenantId);
  await assertTransactionActor(trx, actorUserId);
  if (commandTargetAggregateId !== undefined) {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('symphony.aggregate:' || ${tenantId} || ':' || ${commandTargetAggregateId}, 0))`.execute(trx);
  }

  const principal = await sql<{ id: string }>`
    SELECT id FROM symphony.users
     WHERE id = ${actorUserId}::uuid AND tenant_id = ${tenantId}::uuid AND status = 'active'
  `.execute(trx);
  if (principal.rows.length !== 1) throw new Error('Authority context is unavailable');

  if (organizationIds.length > 0) {
    const organizations = await sql<{ id: string }>`
      SELECT id FROM symphony.organizations
       WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${organizationIds}::uuid[])
    `.execute(trx);
    if (organizations.rows.length !== organizationIds.length) throw new Error('Authority context is unavailable');
  }

  if (affectedActorUserIds.length > 0) {
    const actors = await sql<{ id: string }>`
      SELECT id FROM symphony.users
       WHERE tenant_id = ${tenantId}::uuid AND id = ANY(${affectedActorUserIds}::uuid[])
    `.execute(trx);
    if (actors.rows.length !== affectedActorUserIds.length) throw new Error('Authority context is unavailable');
  }

  const scopes: AuthorityScopeKey[] = [
    { scopeType: 'global_policy', tenantId: null, scopeId: GLOBAL_POLICY_SENTINEL },
    ...organizationIds.map((scopeId): AuthorityScopeKey => ({ scopeType: 'organization', tenantId, scopeId })),
    { scopeType: 'tenant', tenantId, scopeId: tenantId },
    ...affectedActorUserIds.map((scopeId): AuthorityScopeKey => ({ scopeType: 'actor_tenant', tenantId, scopeId })),
    { scopeType: 'actor', tenantId: null, scopeId: actorUserId },
  ];
  scopes.sort(compareScopeKeys);

  await assertBootstrapScopes(trx, scopes);
  for (const scope of scopes) {
    if (scope.scopeType === 'global_policy' || scope.scopeType === 'actor') continue;
    await sql`
      INSERT INTO symphony.authority_scope_versions (scope_type, tenant_id, scope_id)
      VALUES (${scope.scopeType}, ${scope.tenantId}::uuid, ${scope.scopeId}::uuid)
      ON CONFLICT (scope_type, tenant_id, scope_id) DO NOTHING
    `.execute(trx);
  }

  const versions = new Map<string, number>();
  const lockClause = request.mode === 'protected_read' ? 'FOR SHARE' : 'FOR UPDATE';
  for (const scope of scopes) {
    const result = await sql<{ version: string | number }>`
      SELECT version FROM symphony.authority_scope_versions
       WHERE scope_type = ${scope.scopeType}
         AND tenant_id IS NOT DISTINCT FROM ${scope.tenantId}::uuid
         AND scope_id = ${scope.scopeId}::uuid
      ${sql.raw(lockClause)}
    `.execute(trx);
    if (result.rows.length !== 1) throw new Error(`Authority scope is unavailable: ${scope.scopeType}`);
    versions.set(authorityScopeKey(scope), Number(result.rows[0]!.version));
  }

  return {
    scopes,
    versions,
    incrementChangedScopes: async (changedScopes) => {
      if (request.mode !== 'authority_mutation') throw new Error('Protected reads cannot increment authority scope versions');
      const unique = new Map<string, AuthorityScopeKey>();
      for (const changed of changedScopes) {
        const key = authorityScopeKey(changed);
        if (unique.has(key)) throw new Error('Authority scope version may be incremented only once per mutation');
        if (!versions.has(key)) throw new Error('Cannot increment an authority scope that was not locked');
        if (changed.scopeType === 'global_policy' || changed.scopeType === 'actor') {
          throw new Error('Frozen global authority scopes cannot be changed by Phase 1 mutations');
        }
        unique.set(key, changed);
      }
      for (const changed of [...unique.values()].sort(compareScopeKeys)) {
        const update = await sql`
          UPDATE symphony.authority_scope_versions
             SET version = version + 1
           WHERE scope_type = ${changed.scopeType}
             AND tenant_id IS NOT DISTINCT FROM ${changed.tenantId}::uuid
             AND scope_id = ${changed.scopeId}::uuid
          RETURNING version
        `.execute(trx);
        if (update.rows.length !== 1) throw new Error('Authority context is unavailable');
      }
    },
  };
}

export function authorityScopeKey(scope: AuthorityScopeKey): string {
  return `${scope.scopeType}|${scope.tenantId ?? '~'}|${scope.scopeId}`;
}

function compareScopeKeys(left: AuthorityScopeKey, right: AuthorityScopeKey): number {
  return SCOPE_RANK[left.scopeType] - SCOPE_RANK[right.scopeType]
    || compareBytes(left.tenantId ?? '', right.tenantId ?? '')
    || compareBytes(left.scopeId, right.scopeId);
}

function canonicalUuid(value: string, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new TypeError(`Invalid ${label} identifier`);
  return value.toLowerCase();
}

function uniqueCanonicalUuids(values: readonly string[], label: string): string[] {
  return [...new Set(values.map((value) => canonicalUuid(value, label)))].sort(compareBytes);
}

function compareBytes(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function assertTransactionTenant(trx: Transaction<SymphonyDatabase>, tenantId: string): Promise<void> {
  const result = await sql<{ tenant_id: string | null }>`
    SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id
  `.execute(trx);
  if (result.rows[0]?.tenant_id?.toLowerCase() !== tenantId) throw new Error('Authority context is unavailable');
}

async function assertTransactionActor(trx: Transaction<SymphonyDatabase>, actorUserId: string): Promise<void> {
  const result = await sql<{ actor_user_id: string | null }>`
    SELECT NULLIF(current_setting('app.actor_user_id', true), '') AS actor_user_id
  `.execute(trx);
  if (result.rows[0]?.actor_user_id?.toLowerCase() !== actorUserId) throw new Error('Authority context is unavailable');
}

async function assertBootstrapScopes(
  trx: Transaction<SymphonyDatabase>,
  scopes: readonly AuthorityScopeKey[],
): Promise<void> {
  const globalScopes = scopes.filter((scope) => scope.scopeType === 'global_policy' || scope.scopeType === 'actor');
  for (const scope of globalScopes) {
    const result = await sql<{ scope_id: string }>`
      SELECT scope_id FROM symphony.authority_scope_versions
       WHERE scope_type = ${scope.scopeType}
         AND tenant_id IS NOT DISTINCT FROM ${scope.tenantId}::uuid
         AND scope_id = ${scope.scopeId}::uuid
    `.execute(trx);
    if (result.rows.length !== 1) throw new Error('Authority context is unavailable');
  }
}
