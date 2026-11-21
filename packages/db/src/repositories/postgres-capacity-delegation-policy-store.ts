import type { PolicyStore, CommandTransactionContext } from '@symphony/domain';
import type { DomainCommandHandler, AggregateRoot, DomainEvent, OutboxMessage } from '@symphony/domain';
import { decide, type ActorContext, type Appointment, type AssistedEnrollmentSession, type CapacityType, type PolicyAction, type PolicyTarget } from '@symphony/domain/authz/policy-engine';
import { capacityDelegationCommandPayloadSchemas } from '@symphony/contracts';
import { sql, type Transaction } from 'kysely';
import type { SymphonyDatabase } from '../types/database.js';
import type { PostgresCommandTransactionContext } from './postgres-repository.js';
import { acquireAuthorityScopeLocks, type AuthorityScopeLockSet, type Phase1AuthorityAction } from './postgres-authority-scope-locks.js';

export interface CapacityDelegationMutationContext {
  readonly actionId: Phase1AuthorityAction;
  readonly targetOrganizationId: string;
  readonly relatedOrganizationIds: readonly string[];
  /** Organizations whose effective authority fact changes (not every locked reference). */
  readonly changedOrganizationIds: readonly string[];
  /** Actors whose effective authority changes; excludes the command actor when acting only as grantor. */
  readonly changedActorUserIds: readonly string[];
  readonly affectedActorUserIds: readonly string[];
  readonly authorityLocks: AuthorityScopeLockSet;
  readonly transaction: Transaction<SymphonyDatabase>;
}

/** Resolves policy inputs from persisted authority rows after acquiring complete D-16 mutation locks. */
export class PostgresCapacityDelegationPolicyStore implements PolicyStore {
  private readonly mutations = new Map<symbol, CapacityDelegationMutationContext>();

  async decide(
    actionName: string,
    target: { readonly id: string; readonly type: string; readonly tenantId: string; readonly organizationId?: string },
    actor: { readonly userId: string; readonly tenantId: string },
    rawPayload: Readonly<Record<string, unknown>> | undefined,
    transaction?: CommandTransactionContext,
  ): Promise<{ readonly allow: true } | { readonly allow: false; readonly reason: string }> {
    if (!transaction || !rawPayload || target.tenantId !== actor.tenantId) return deny();
    const trx = transactionFor(transaction);
    const command = parseCommand(actionName, rawPayload);
    if (!command) return deny();

    const identity = await resolveMutationIdentity(trx, command, target, actor);
    if (!identity) return deny();

    let authorityLocks: AuthorityScopeLockSet;
    try {
      authorityLocks = await acquireAuthorityScopeLocks(trx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        organizationIds: identity.organizationIds,
        affectedActorUserIds: identity.affectedActorUserIds,
        actionId: command.actionId,
        mode: 'authority_mutation',
        commandTargetAggregateId: target.id,
      });
    } catch {
      return deny();
    }

    const organizationFacts = await trx
      .selectFrom('symphony.organizations')
      .select(['id', 'organization_kind', 'status'])
      .where('tenant_id', '=', actor.tenantId)
      .where('id', 'in', identity.organizationIds)
      .execute();
    if (organizationFacts.length !== identity.organizationIds.length) return deny();
    const uniqueAffectedActorIds = [...new Set(identity.affectedActorUserIds)];
    const activeAffectedActors = await trx.selectFrom('symphony.users').select('id')
      .where('tenant_id', '=', actor.tenantId).where('status', '=', 'active')
      .where('id', 'in', uniqueAffectedActorIds).execute();
    if (activeAffectedActors.length !== uniqueAffectedActorIds.length) return deny();
    const targetOrganization = organizationFacts.find((row) => row.id === identity.targetOrganizationId);
    if (targetOrganization?.organization_kind !== 'cooperative') return deny();
    if ((command.kind === 'capacity.grant' || command.kind === 'ta_scope.grant') && targetOrganization.status !== 'active') return deny();

    const actorContext = await loadActorContext(trx, actor.userId, actor.tenantId, identity.targetOrganizationId,
      command.kind === 'capacity.grant' ? command.payload.assistedEnrolment : undefined);
    if (!actorContext) return deny();
    let action: PolicyAction;
    let policyTarget: PolicyTarget;

    if (command.kind === 'capacity.grant') {
      action = {
        type: 'capacity.grant', capacityType: command.payload.capacityType,
        granteeUserId: command.payload.targetUserId, activeFrom: command.payload.activeFrom,
        activeTo: command.payload.activeTo,
        ...(command.payload.sourceRef ? { sourceRef: command.payload.sourceRef } : {}),
        ...(command.payload.assistedEnrolment ? { assistedEnrolment: command.payload.assistedEnrolment } : {}),
      };
      policyTarget = { id: target.id, type: 'organization_capacity', tenantId: actor.tenantId, organizationId: identity.targetOrganizationId };
    } else if (command.kind === 'capacity.revoke') {
      const row = await trx.selectFrom('symphony.capacity_grants').select(['user_id', 'organization_id', 'capacity_type', 'revoked_at'])
        .where('id', '=', target.id).executeTakeFirst();
      if (!row || row.organization_id !== identity.targetOrganizationId) return deny();
      if (!isCapacityType(row.capacity_type)) return deny();
      action = { type: 'capacity.revoke', capacityType: row.capacity_type, granteeUserId: row.user_id };
      policyTarget = { id: target.id, type: 'organization_capacity', tenantId: actor.tenantId, organizationId: identity.targetOrganizationId };
    } else if (command.kind === 'ta_scope.grant') {
      action = {
        type: 'ta_scope.grant', delegateeUserId: command.payload.delegateeUserId,
        cooperativeOrganizationId: identity.targetOrganizationId,
        unionOrganizationId: command.payload.unionOrganizationId, agreementRef: command.payload.agreementRef,
        activeFrom: command.payload.activeFrom, activeTo: command.payload.activeTo,
      };
      policyTarget = { id: target.id, type: 'cooperative_ta_delegation', tenantId: actor.tenantId, organizationId: identity.targetOrganizationId };
      const union = organizationFacts.find((row) => row.id === command.payload.unionOrganizationId);
      if ((union?.organization_kind !== 'union' && union?.organization_kind !== 'federation') || union.status !== 'active') return deny();
      const taAssignment = await trx.selectFrom('symphony.institutional_role_assignments')
        .select('id').where('tenant_id', '=', actor.tenantId).where('user_id', '=', command.payload.delegateeUserId)
        .where('institution_organization_id', '=', command.payload.unionOrganizationId).where('role_code', '=', 'union_ta')
        .where('granted_at', '<=', sql<Date>`transaction_timestamp()`)
        .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', sql<Date>`transaction_timestamp()`)]))
        .where((eb) => eb.or([eb('revoked_at', 'is', null), eb('revoked_at', '>', sql<Date>`transaction_timestamp()`)]))
        .executeTakeFirst();
      if (!taAssignment) return deny();
    } else {
      const row = await trx.selectFrom('symphony.ta_scope_delegations')
        .select('target_organization_id').where('id', '=', target.id).executeTakeFirst();
      if (!row || row.target_organization_id !== identity.targetOrganizationId) return deny();
      action = { type: 'ta_scope.revoke', delegationId: target.id, cooperativeOrganizationId: identity.targetOrganizationId };
      policyTarget = { id: target.id, type: 'cooperative_ta_delegation', tenantId: actor.tenantId, organizationId: identity.targetOrganizationId };
    }

    const transactionTime = await sql<{ now: Date }>`SELECT transaction_timestamp() AS now`.execute(trx);
    const result = decide(action, policyTarget, actorContext, { now: transactionTime.rows[0]!.now.toISOString() });
    if (result !== 'allow' && result !== 'allow_with_label') return deny();

    this.mutations.set(transaction.transactionId, {
      actionId: command.actionId,
      targetOrganizationId: identity.targetOrganizationId,
      relatedOrganizationIds: identity.organizationIds,
      changedOrganizationIds: identity.changedOrganizationIds,
      changedActorUserIds: identity.changedActorUserIds,
      affectedActorUserIds: identity.affectedActorUserIds,
      authorityLocks,
      transaction: trx,
    });
    return { allow: true };
  }

  mutationFor(transaction: CommandTransactionContext): CapacityDelegationMutationContext | undefined {
    const value = this.mutations.get(transaction.transactionId);
    this.mutations.delete(transaction.transactionId);
    return value;
  }
}

export interface AuthorityMutationAggregate extends AggregateRoot {
  readonly status: 'active';
  readonly sourceId: string;
}

export function createCapacityDelegationHandlers(policyStore: PostgresCapacityDelegationPolicyStore): {
  readonly GrantCapacity: DomainCommandHandler<AuthorityMutationAggregate, import('@symphony/contracts').GrantCapacityPayload, import('@symphony/contracts').CapacityDelegationCommandResult>;
  readonly RevokeCapacity: DomainCommandHandler<AuthorityMutationAggregate, import('@symphony/contracts').RevokeCapacityPayload, import('@symphony/contracts').CapacityDelegationCommandResult>;
  readonly DelegateTaScope: DomainCommandHandler<AuthorityMutationAggregate, import('@symphony/contracts').DelegateTaScopePayload, import('@symphony/contracts').CapacityDelegationCommandResult>;
} {
  return {
    GrantCapacity: async (envelope, context) => {
      const mutation = requiredMutation(policyStore, context.transaction, 'capacity.grant');
      const trx = transactionFor(context.transaction);
      const now = await transactionNow(trx);
      const existing = await trx.selectFrom('symphony.capacity_grants')
        .select(['id', 'active_from', 'expires_at', 'source_ref', 'assisted_session_id', 'representative_person_id', 'representative_decision'])
        .where('organization_id', '=', mutation.targetOrganizationId).where('user_id', '=', envelope.payload.targetUserId)
        .where('capacity_type', '=', envelope.payload.capacityType).where('revoked_at', 'is', null).execute();
      const exact = existing.find((row) => sameInstant(row.active_from, envelope.payload.activeFrom)
        && row.expires_at !== null && sameInstant(row.expires_at, envelope.payload.activeTo)
        && (row.source_ref ?? undefined) === envelope.payload.sourceRef
        && row.assisted_session_id === (envelope.payload.assistedEnrolment?.sessionId ?? null)
        && row.representative_decision === (envelope.payload.assistedEnrolment?.representativeDecision ?? null));
      if (exact) return noopTransition(envelope.tenantId, envelope.payload.capacityGrantId, exact.id, context.aggregate?.version ?? 0);
      const active = existing.filter((row) => isActiveAt(row.active_from, row.expires_at, now));
      if (active.length > 0) return conflictTransition(envelope.tenantId, envelope.payload.capacityGrantId, context.aggregate?.version ?? 0);

      const representativePersonId = envelope.payload.assistedEnrolment
        ? await representativeForAssistedSession(trx, envelope.payload.assistedEnrolment.sessionId,
          envelope.tenantId, mutation.targetOrganizationId, envelope.actorUserId)
        : null;
      if (envelope.payload.assistedEnrolment && !representativePersonId) {
        throw new Error('Authorized assisted-enrolment source disappeared inside locked transaction');
      }

      const event = makeEvent(context.idGen.generate(), envelope, envelope.payload.capacityGrantId, 'capacity_grant', 'CapacityGranted', {
        sourceId: envelope.payload.capacityGrantId, grantorUserId: envelope.actorUserId,
        granteeUserId: envelope.payload.targetUserId, organizationId: mutation.targetOrganizationId,
        capacityType: envelope.payload.capacityType, activeFrom: envelope.payload.activeFrom,
        activeTo: envelope.payload.activeTo, sourceRef: envelope.payload.sourceRef ?? null,
        assistedSessionId: envelope.payload.assistedEnrolment?.sessionId ?? null,
        representativePersonId,
        representativeDecision: envelope.payload.assistedEnrolment?.representativeDecision ?? null,
      }, 1, now);
      const transition = committedTransition(envelope.tenantId, envelope.payload.capacityGrantId, 1, event, {
        operation: 'granted', sourceId: envelope.payload.capacityGrantId,
      }, context.idGen.generate());
      return {
        ...transition,
        beforePersistence: async () => {
          await trx.insertInto('symphony.capacity_grants').values({
            id: envelope.payload.capacityGrantId, user_id: envelope.payload.targetUserId,
            organization_id: mutation.targetOrganizationId, capacity_type: envelope.payload.capacityType,
            granted_by_user_id: envelope.actorUserId, active_from: new Date(envelope.payload.activeFrom),
            expires_at: new Date(envelope.payload.activeTo), source_ref: envelope.payload.sourceRef ?? null,
            assisted_session_id: envelope.payload.assistedEnrolment?.sessionId ?? null,
            representative_person_id: representativePersonId,
            representative_decision: envelope.payload.assistedEnrolment?.representativeDecision ?? null,
            source_event_id: null,
          }).execute();
          await mutation.authorityLocks.incrementChangedScopes(mutableChangedScopes(mutation));
        },
        afterPersistence: async () => { await trx.updateTable('symphony.capacity_grants')
        .set({ source_event_id: event.id }).where('id', '=', envelope.payload.capacityGrantId).executeTakeFirstOrThrow(); } };
    },
    RevokeCapacity: async (envelope, context) => {
      const mutation = requiredMutation(policyStore, context.transaction, 'capacity.revoke');
      const trx = transactionFor(context.transaction);
      const row = await trx.selectFrom('symphony.capacity_grants').select(['id', 'revoked_at'])
        .where('id', '=', envelope.payload.capacityGrantId).executeTakeFirst();
      if (!row) throw new Error('Authorized capacity source disappeared inside locked transaction');
      if (row.revoked_at !== null) return noopTransition(envelope.tenantId, row.id, row.id, context.aggregate?.version ?? 0);
      const revokedAt = await transactionNow(trx);
      const event = makeEvent(context.idGen.generate(), envelope, row.id, 'capacity_grant', 'CapacityRevoked', {
        sourceId: row.id, revokerUserId: envelope.actorUserId, organizationId: mutation.targetOrganizationId,
        effectiveAt: revokedAt.toISOString(),
      }, (context.aggregate?.version ?? 0) + 1, revokedAt);
      const transition = committedTransition(envelope.tenantId, row.id, (context.aggregate?.version ?? 0) + 1, event, {
        operation: 'revoked', sourceId: row.id,
      }, context.idGen.generate());
      return {
        ...transition,
        beforePersistence: async () => {
          await trx.updateTable('symphony.capacity_grants').set({ revoked_at: revokedAt, revoked_event_id: null })
            .where('id', '=', row.id).where('revoked_at', 'is', null).executeTakeFirstOrThrow();
          await mutation.authorityLocks.incrementChangedScopes(mutableChangedScopes(mutation));
        },
        afterPersistence: async () => { await trx.updateTable('symphony.capacity_grants')
        .set({ revoked_event_id: event.id }).where('id', '=', row.id).executeTakeFirstOrThrow(); } };
    },
    DelegateTaScope: async (envelope, context) => {
      const payload = envelope.payload;
      const actionId = payload.operation === 'grant' ? 'ta_scope.grant' : 'ta_scope.revoke';
      const mutation = requiredMutation(policyStore, context.transaction, actionId);
      const trx = transactionFor(context.transaction);
      if (payload.operation === 'revoke') {
        const row = await trx.selectFrom('symphony.ta_scope_delegations').select(['id', 'revoked_at'])
          .where('id', '=', payload.delegationId).executeTakeFirst();
        if (!row) throw new Error('Authorized TA source disappeared inside locked transaction');
        if (row.revoked_at !== null) return noopTransition(envelope.tenantId, row.id, row.id, context.aggregate?.version ?? 0);
        const revokedAt = await transactionNow(trx);
        const event = makeEvent(context.idGen.generate(), envelope, row.id, 'ta_scope_delegation', 'TaScopeRevoked', {
          sourceId: row.id, revokerUserId: envelope.actorUserId, organizationId: mutation.targetOrganizationId,
          effectiveAt: revokedAt.toISOString(),
        }, (context.aggregate?.version ?? 0) + 1, revokedAt);
        const transition = committedTransition(envelope.tenantId, row.id, (context.aggregate?.version ?? 0) + 1, event, {
          operation: 'revoked', sourceId: row.id,
        }, context.idGen.generate());
        return {
          ...transition,
          beforePersistence: async () => {
            await trx.updateTable('symphony.ta_scope_delegations').set({ revoked_at: revokedAt, revoked_event_id: null })
              .where('id', '=', row.id).where('revoked_at', 'is', null).executeTakeFirstOrThrow();
            await mutation.authorityLocks.incrementChangedScopes(mutableChangedScopes(mutation));
          },
          afterPersistence: async () => { await trx.updateTable('symphony.ta_scope_delegations')
          .set({ revoked_event_id: event.id }).where('id', '=', row.id).executeTakeFirstOrThrow(); } };
      }

      const now = await transactionNow(trx);
      const existing = await trx.selectFrom('symphony.ta_scope_delegations')
        .select(['id', 'active_from', 'expires_at', 'agreement_ref'])
        .where('tenant_id', '=', envelope.tenantId)
        .where('union_organization_id', '=', payload.unionOrganizationId)
        .where('delegatee_user_id', '=', payload.delegateeUserId)
        .where('target_organization_id', '=', mutation.targetOrganizationId).where('revoked_at', 'is', null).execute();
      const exact = existing.find((row) => sameInstant(row.active_from, payload.activeFrom)
        && row.expires_at !== null && sameInstant(row.expires_at, payload.activeTo)
        && row.agreement_ref === payload.agreementRef);
      if (exact) return noopTransition(envelope.tenantId, payload.delegationId, exact.id, context.aggregate?.version ?? 0);
      const active = existing.filter((row) => isActiveAt(row.active_from, row.expires_at, now));
      if (active.length > 0) return conflictTransition(envelope.tenantId, payload.delegationId, context.aggregate?.version ?? 0);
      const event = makeEvent(context.idGen.generate(), envelope, payload.delegationId, 'ta_scope_delegation', 'TaScopeDelegated', {
        sourceId: payload.delegationId, programmeManagerUserId: envelope.actorUserId,
        unionOrganizationId: payload.unionOrganizationId, delegateeUserId: payload.delegateeUserId,
        cooperativeOrganizationId: mutation.targetOrganizationId, agreementRef: payload.agreementRef,
        activeFrom: payload.activeFrom, activeTo: payload.activeTo,
      }, 1, now);
      const transition = committedTransition(envelope.tenantId, payload.delegationId, 1, event, {
        operation: 'granted', sourceId: payload.delegationId,
      }, context.idGen.generate());
      return {
        ...transition,
        beforePersistence: async () => {
          await trx.insertInto('symphony.ta_scope_delegations').values({
            id: payload.delegationId, tenant_id: envelope.tenantId,
            programme_manager_user_id: envelope.actorUserId,
            union_organization_id: payload.unionOrganizationId,
            delegatee_user_id: payload.delegateeUserId,
            target_organization_id: mutation.targetOrganizationId,
            active_from: new Date(payload.activeFrom), expires_at: new Date(payload.activeTo),
            agreement_ref: payload.agreementRef, source_event_id: null,
          }).execute();
          await mutation.authorityLocks.incrementChangedScopes(mutableChangedScopes(mutation));
        },
        afterPersistence: async () => { await trx.updateTable('symphony.ta_scope_delegations')
        .set({ source_event_id: event.id }).where('id', '=', payload.delegationId).executeTakeFirstOrThrow(); } };
    },
  };
}

function requiredMutation(
  store: PostgresCapacityDelegationPolicyStore, transaction: CommandTransactionContext, action: Phase1AuthorityAction,
): CapacityDelegationMutationContext {
  const mutation = store.mutationFor(transaction);
  if (!mutation || mutation.actionId !== action) throw new Error('Authority mutation was not preauthorized under D-16 locks');
  return mutation;
}

function mutableChangedScopes(mutation: CapacityDelegationMutationContext) {
  const changedActors = new Set(mutation.changedActorUserIds);
  const changedOrganizations = new Set(mutation.changedOrganizationIds);
  return mutation.authorityLocks.scopes.filter((scope) =>
    (scope.scopeType === 'organization' && changedOrganizations.has(scope.scopeId))
    || scope.scopeType === 'tenant'
    || (scope.scopeType === 'actor_tenant' && changedActors.has(scope.scopeId)));
}

function transactionNow(trx: Transaction<SymphonyDatabase>): Promise<Date> {
  return sql<{ now: Date }>`SELECT transaction_timestamp() AS now`.execute(trx).then((result) => result.rows[0]!.now);
}

function makeEvent<TPayload>(id: string, envelope: { tenantId: string; actorUserId: string; occurredAt: string }, aggregateId: string,
  aggregateType: string, eventType: string, payload: TPayload, sequence: number, recordedAt: Date): DomainEvent<TPayload> {
  return { id, tenantId: envelope.tenantId, aggregateId, aggregateType, eventType, payload,
    occurredAt: envelope.occurredAt, recordedAt: recordedAt.toISOString(), sequence };
}

function committedTransition(
  tenantId: string, id: string, version: number, event: DomainEvent, data: import('@symphony/contracts').CapacityDelegationCommandResult, outboxId: string,
) {
  const outbox: OutboxMessage = { id: outboxId, eventId: event.id, status: 'pending', createdAt: event.recordedAt };
  return { newState: { id, tenantId, version, status: 'active' as const, sourceId: id }, events: [event], outbox: [outbox], data };
}

function noopTransition(tenantId: string, aggregateId: string, sourceId: string, version: number) {
  return { newState: { id: aggregateId, tenantId, version, status: 'active' as const, sourceId }, events: [], data: {
    operation: 'unchanged' as const, sourceId,
  }, persistAggregate: false };
}

function conflictTransition(tenantId: string, aggregateId: string, version: number) {
  return { newState: { id: aggregateId, tenantId, version, status: 'active' as const, sourceId: aggregateId }, events: [], data: {
    operation: 'unchanged' as const, sourceId: aggregateId,
  }, persistAggregate: false, terminalRejection: { code: 'AUTHORITY_GRANT_CONFLICT' as const } };
}

type ParsedCommand =
  | { readonly kind: 'capacity.grant'; readonly actionId: 'capacity.grant'; readonly payload: import('@symphony/contracts').GrantCapacityPayload }
  | { readonly kind: 'capacity.revoke'; readonly actionId: 'capacity.revoke'; readonly payload: import('@symphony/contracts').RevokeCapacityPayload }
  | { readonly kind: 'ta_scope.grant'; readonly actionId: 'ta_scope.grant'; readonly payload: Extract<import('@symphony/contracts').DelegateTaScopePayload, { operation: 'grant' }> }
  | { readonly kind: 'ta_scope.revoke'; readonly actionId: 'ta_scope.revoke'; readonly payload: Extract<import('@symphony/contracts').DelegateTaScopePayload, { operation: 'revoke' }> };

function parseCommand(actionName: string, payload: Readonly<Record<string, unknown>>): ParsedCommand | undefined {
  if (actionName === 'GrantCapacity') {
    const result = capacityDelegationCommandPayloadSchemas.GrantCapacity.safeParse(payload);
    return result.success ? { kind: 'capacity.grant', actionId: 'capacity.grant', payload: result.data } : undefined;
  }
  if (actionName === 'RevokeCapacity') {
    const result = capacityDelegationCommandPayloadSchemas.RevokeCapacity.safeParse(payload);
    return result.success ? { kind: 'capacity.revoke', actionId: 'capacity.revoke', payload: result.data } : undefined;
  }
  if (actionName === 'DelegateTaScope') {
    const result = capacityDelegationCommandPayloadSchemas.DelegateTaScope.safeParse(payload);
    if (!result.success) return undefined;
    return result.data.operation === 'grant'
      ? { kind: 'ta_scope.grant', actionId: 'ta_scope.grant', payload: result.data }
      : { kind: 'ta_scope.revoke', actionId: 'ta_scope.revoke', payload: result.data };
  }
  return undefined;
}

async function resolveMutationIdentity(
  trx: Transaction<SymphonyDatabase>, command: ParsedCommand,
  target: { readonly id: string; readonly organizationId?: string }, actor: { readonly userId: string; readonly tenantId: string },
): Promise<{ targetOrganizationId: string; organizationIds: string[]; changedOrganizationIds: string[]; affectedActorUserIds: string[]; changedActorUserIds: string[] } | undefined> {
  if (command.kind === 'capacity.grant') {
    if (!target.organizationId) return undefined;
    return { targetOrganizationId: target.organizationId, organizationIds: [target.organizationId],
      changedOrganizationIds: [target.organizationId], affectedActorUserIds: [command.payload.targetUserId],
      changedActorUserIds: [command.payload.targetUserId] };
  }
  if (command.kind === 'ta_scope.grant') {
    if (!target.organizationId) return undefined;
    return { targetOrganizationId: target.organizationId, organizationIds: [target.organizationId, command.payload.unionOrganizationId],
      changedOrganizationIds: [target.organizationId], affectedActorUserIds: [command.payload.delegateeUserId],
      changedActorUserIds: [command.payload.delegateeUserId] };
  }
  if (command.kind === 'capacity.revoke') {
    const row = await trx.selectFrom('symphony.capacity_grants').select(['user_id', 'organization_id'])
      .where('id', '=', command.payload.capacityGrantId).executeTakeFirst();
    if (!row || !target.organizationId || target.organizationId !== row.organization_id) return undefined;
    const owner = await trx.selectFrom('symphony.organizations').select('tenant_id').where('id', '=', row.organization_id).executeTakeFirst();
    if (owner?.tenant_id !== actor.tenantId) return undefined;
    return { targetOrganizationId: row.organization_id, organizationIds: [row.organization_id],
      changedOrganizationIds: [row.organization_id], affectedActorUserIds: [row.user_id], changedActorUserIds: [row.user_id] };
  }
  const row = await trx.selectFrom('symphony.ta_scope_delegations')
    .select(['programme_manager_user_id', 'union_organization_id', 'delegatee_user_id', 'target_organization_id', 'tenant_id'])
    .where('id', '=', command.payload.delegationId).executeTakeFirst();
  if (!row || row.tenant_id !== actor.tenantId
    || !target.organizationId || target.organizationId !== row.target_organization_id) return undefined;
  return {
    targetOrganizationId: row.target_organization_id,
    organizationIds: [row.target_organization_id, row.union_organization_id],
    changedOrganizationIds: [row.target_organization_id],
    affectedActorUserIds: [row.programme_manager_user_id, row.delegatee_user_id],
    changedActorUserIds: [row.delegatee_user_id],
  };
}

async function loadActorContext(
  trx: Transaction<SymphonyDatabase>, userId: string, tenantId: string, targetOrganizationId: string,
  assistedEnrolment?: import('@symphony/contracts').GrantCapacityPayload['assistedEnrolment'],
): Promise<ActorContext | undefined> {
  const user = await trx.selectFrom('symphony.users').select('status').where('id', '=', userId).where('tenant_id', '=', tenantId).executeTakeFirst();
  if (!user || user.status !== 'active') return undefined;
  const now = sql<Date>`transaction_timestamp()`;
  const roles = await trx.selectFrom('symphony.user_role_assignments as a').innerJoin('symphony.platform_roles as r', 'r.id', 'a.platform_role_id')
    .select('r.code').where('a.tenant_id', '=', tenantId).where('a.user_id', '=', userId).where('a.granted_at', '<=', now)
    .where((eb) => eb.or([eb('a.revoked_at', 'is', null), eb('a.revoked_at', '>', now)])).execute();
  const linked = await trx.selectFrom('symphony.user_person_links').select('person_id').where('tenant_id', '=', tenantId).where('user_id', '=', userId)
    .where('linked_at', '<=', now).where((eb) => eb.or([eb('unlinked_at', 'is', null), eb('unlinked_at', '>', now)])).execute();
  if (linked.length > 1) return undefined;
  const appointments: Appointment[] = [];
  const capacities: ActorContext['capacities'][number][] = [];
  const actingDelegations: NonNullable<ActorContext['delegations']>[number][] = [];
  if (linked[0]) {
    const rows = await trx.selectFrom('symphony.appointments as a').innerJoin('symphony.position_catalog as p', 'p.id', 'a.position_id')
      .innerJoin('symphony.organization_memberships as m', (join) => join.onRef('m.person_id', '=', 'a.person_id').onRef('m.organization_id', '=', 'a.organization_id'))
      .select(['p.code as position', 'a.organization_id', 'a.started_at', 'a.ended_at'])
      .where('a.person_id', '=', linked[0].person_id).where('a.organization_id', '=', targetOrganizationId)
      .where('m.tenant_id', '=', tenantId).where('m.status', '=', 'active').where('m.joined_at', '<=', now)
      .where((eb) => eb.or([eb('m.ended_at', 'is', null), eb('m.ended_at', '>', now)]))
      .where('a.started_at', '<=', now).where((eb) => eb.or([eb('a.ended_at', 'is', null), eb('a.ended_at', '>', now)])).execute();
    for (const row of rows) appointments.push({ position: row.position, tenantId, organizationId: row.organization_id,
      activeFrom: row.started_at.toISOString(), activeTo: row.ended_at?.toISOString() ?? '9999-12-31T23:59:59.999Z' });
    const actingRows = await sql<{ position_code: string; effective_from: Date; effective_to: Date }>`
      SELECT acting.position_code, acting.effective_from, acting.effective_to
        FROM symphony.acting_officer_appointments acting
        JOIN symphony.evidence_versions version ON version.id=acting.supporting_evidence_version_id
        JOIN symphony.evidence_items item ON item.id=version.evidence_item_id
        JOIN symphony.organization_memberships member ON member.person_id=acting.person_id
          AND member.organization_id=acting.organization_id AND member.tenant_id=acting.tenant_id
       WHERE acting.tenant_id=${tenantId}::uuid AND acting.organization_id=${targetOrganizationId}::uuid
         AND acting.person_id=${linked[0].person_id}::uuid AND item.organization_id=${targetOrganizationId}::uuid
         AND acting.effective_from <= transaction_timestamp() AND acting.effective_to > transaction_timestamp()
         AND member.status='active' AND member.joined_at <= transaction_timestamp()
         AND (member.ended_at IS NULL OR member.ended_at > transaction_timestamp())
         AND NOT EXISTS (SELECT 1 FROM symphony.acting_officer_appointments successor
           WHERE successor.supersedes_appointment_id=acting.id AND successor.tenant_id=acting.tenant_id
             AND successor.effective_from <= transaction_timestamp())
         AND NOT EXISTS (SELECT 1 FROM symphony.acting_officer_appointment_endings ending
           WHERE ending.appointment_id=acting.id AND ending.tenant_id=acting.tenant_id
             AND ending.ended_at <= transaction_timestamp())
    `.execute(trx).then((result) => result.rows);
    for (const row of actingRows) actingDelegations.push({ type: 'acting_officer', tenantId,
      organizationId: targetOrganizationId, position: row.position_code,
      activeFrom: row.effective_from.toISOString(), activeTo: row.effective_to.toISOString() });
    const grants = await trx.selectFrom('symphony.capacity_grants').select(['capacity_type', 'organization_id', 'active_from', 'expires_at', 'revoked_at'])
      .where('user_id', '=', userId).where('organization_id', '=', targetOrganizationId).where('active_from', '<=', now)
      .where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
      .where((eb) => eb.or([eb('revoked_at', 'is', null), eb('revoked_at', '>', now)])).execute();
    for (const grant of grants) if (isCapacityType(grant.capacity_type)) capacities.push({ type: grant.capacity_type, tenantId, organizationId: grant.organization_id,
      activeFrom: grant.active_from.toISOString(), activeTo: grant.expires_at?.toISOString() ?? grant.revoked_at?.toISOString() ?? '9999-12-31T23:59:59.999Z' });
  }
  const managed = await trx.selectFrom('symphony.programme_manager_scopes').select('target_organization_id')
    .where('tenant_id', '=', tenantId).where('programme_manager_user_id', '=', userId).where('scope_kind', '=', 'ta_delegation')
    .where('granted_at', '<=', now).where((eb) => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', now)]))
    .where((eb) => eb.or([eb('revoked_at', 'is', null), eb('revoked_at', '>', now)])).execute();
  const assistedEnrollmentSessions: AssistedEnrollmentSession[] = [];
  if (assistedEnrolment && roles.some((row) => row.code === 'platform_enroller')) {
    const session = await trx.selectFrom('symphony.enrolment_sessions as s')
      .innerJoin('symphony.persons as p', (join) => join.onRef('p.id', '=', 's.representative_person_id').onRef('p.tenant_id', '=', 's.tenant_id'))
      .select(['s.id', 's.organization_id', 's.started_at'])
      .where('s.id', '=', assistedEnrolment.sessionId)
      .where('s.tenant_id', '=', tenantId).where('s.organization_id', '=', targetOrganizationId)
      .where('s.enroller_user_id', '=', userId).where('s.representative_person_id', 'is not', null)
      .where('s.representative_present', '=', true).where('s.representative_nrc_sighted', '=', true)
      .where('s.representative_consented_to_act', '=', true)
      .where('s.attestation_recorded_by_user_id', '=', userId).where('s.attestation_recorded_at', 'is not', null)
      .where('s.started_at', '<=', now).where('s.closed_at', 'is', null).executeTakeFirst();
    if (session) assistedEnrollmentSessions.push({
      id: session.id, tenantId, organizationId: session.organization_id,
      activeFrom: session.started_at.toISOString(), activeTo: '9999-12-31T23:59:59.999Z',
      representativePresent: true,
      grantDecisionRecorded: assistedEnrolment.representativeDecision === 'approve_internal_verifier',
    });
  }
  return {
    userId, tenantId, platformRoles: roles.map((row) => row.code), appointments, capacities,
    delegations: actingDelegations, managedTaOrganizationIds: managed.map((row) => row.target_organization_id),
    assistedEnrollmentSessions,
  };
}

async function representativeForAssistedSession(
  trx: Transaction<SymphonyDatabase>, sessionId: string, tenantId: string, organizationId: string, enrollerUserId: string,
): Promise<string | undefined> {
  const row = await trx.selectFrom('symphony.enrolment_sessions as s')
    .innerJoin('symphony.persons as p', (join) => join.onRef('p.id', '=', 's.representative_person_id').onRef('p.tenant_id', '=', 's.tenant_id'))
    .select('s.representative_person_id')
    .where('s.id', '=', sessionId).where('s.tenant_id', '=', tenantId)
    .where('s.organization_id', '=', organizationId).where('s.enroller_user_id', '=', enrollerUserId)
    .where('s.representative_present', '=', true).where('s.representative_nrc_sighted', '=', true)
    .where('s.representative_consented_to_act', '=', true)
    .where('s.attestation_recorded_by_user_id', '=', enrollerUserId)
    .where('s.started_at', '<=', sql<Date>`transaction_timestamp()`).where('s.closed_at', 'is', null)
    .executeTakeFirst();
  return row?.representative_person_id ?? undefined;
}

function transactionFor(context: CommandTransactionContext): Transaction<SymphonyDatabase> {
  if (!('kyselyTransaction' in context)) throw new TypeError('Expected PostgreSQL command transaction context');
  return (context as PostgresCommandTransactionContext).kyselyTransaction;
}

function isCapacityType(value: string): value is CapacityType {
  return value === 'internal_verifier' || value === 'field_agent' || value === 'delegate';
}

function sameInstant(databaseValue: Date, requestedValue: string): boolean {
  return databaseValue.getTime() === Date.parse(requestedValue);
}

function isActiveAt(activeFrom: Date, activeTo: Date | null, now: Date): boolean {
  return activeFrom.getTime() <= now.getTime() && (activeTo === null || now.getTime() < activeTo.getTime());
}

function deny(): { readonly allow: false; readonly reason: 'NOT_AUTHORISED_FOR_ORGANISATION' } {
  return { allow: false, reason: 'NOT_AUTHORISED_FOR_ORGANISATION' };
}
