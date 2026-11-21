import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { sql, type Transaction } from 'kysely';
import { CommandBus } from '@symphony/domain';
import type { CommandEnvelope } from '@symphony/domain';
import { capacityDelegationCommandResultDataSchemas } from '@symphony/contracts';
import { createDb } from '../db/client.js';
import { PostgresCommandReceiptStore } from '../repositories/postgres-command-receipt-store.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import { PostgresCapacityDelegationPolicyStore, createCapacityDelegationHandlers } from '../repositories/postgres-capacity-delegation-policy-store.js';
import type { AuthorityMutationAggregate } from '../repositories/postgres-capacity-delegation-policy-store.js';
import { acquireAuthorityScopeLocks, authorityScopeKey } from '../repositories/postgres-authority-scope-locks.js';
import type { AuthorityScopeKey, AuthorityScopeLockRequest } from '../repositories/postgres-authority-scope-locks.js';
import type { SymphonyDatabase } from '../types/database.js';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;

describe.skipIf(!adminUrl || !appUrl)('REM-WP2.3 PostgreSQL capacity and TA command persistence', () => {
  const admin = new pg.Pool({ connectionString: adminUrl, max: 3 });
  const db = createDb(appUrl ?? '', { max: 6 });
  const recoveryDb = createDb(appUrl ?? '', { max: 1 });
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const delegateeId = randomUUID();
  const actingOfficerUserId = randomUUID();
  const targetOrganizationId = randomUUID();
  const unionOrganizationId = randomUUID();
  const personId = randomUUID();
  const actingPersonId = randomUUID();
  const supportingEvidenceItemId = randomUUID();
  const supportingEvidenceVersionId = randomUUID();
  const actingAppointmentId = randomUUID();
  const actingAppointmentEventId = randomUUID();
  const actingEndingId = randomUUID();
  const actingEndingEventId = randomUUID();
  const endingEvidenceItemId = randomUUID();
  const endingEvidenceVersionId = randomUUID();
  const endingGrantId = randomUUID();
  const commandIds: string[] = [];
  const capacityGrantIds: string[] = [];
  const enrolmentSessionIds: string[] = [];
  let programmeManagerRoleSeeded = false;
  let enrollerRoleSeeded = false;
  const delegationIds: string[] = [];
  const policyStore = new PostgresCapacityDelegationPolicyStore();
  const handlers = createCapacityDelegationHandlers(policyStore);
  const bus = new CommandBus<AuthorityMutationAggregate>({
    repository: new PostgresRepository<AuthorityMutationAggregate>(db, 'AuthorityMutation'),
    receiptStore: new PostgresCommandReceiptStore(capacityDelegationCommandResultDataSchemas),
    policyStore,
    clock: { now: () => new Date().toISOString() },
    idGen: { generate: () => randomUUID() },
    transactionRunner: new PostgresCommandTransactionRunner(db, { recoveryDb }),
    securityAttemptWriter: { record: async () => undefined },
    digestKeyProvider: {
      activeVersion: () => 'wp2.3-test-v1',
      hmac: async (version, bytes) => createHmac('sha256', version).update(bytes).digest(),
    },
    resultDataSchemas: capacityDelegationCommandResultDataSchemas,
  });

  beforeAll(async () => {
    if (process.env.DATA_MODE !== 'test') throw new Error('WP2.3 integration tests require DATA_MODE=test.');
    const identity = await admin.query<{ database_name: string; server_version_num: string }>(
      "SELECT current_database() AS database_name,current_setting('server_version_num') AS server_version_num",
    );
    expect(identity.rows[0]?.database_name.endsWith('_test')).toBe(true);
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    const runtimeIdentity = await sql<{ current_user: string; current_database: string }>`
      SELECT current_user, current_database()
    `.execute(db);
    expect(runtimeIdentity.rows[0]).toEqual({ current_user: 'symphony_app', current_database: identity.rows[0]?.database_name });
    const migration = await admin.query<{ applied: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM symphony.schema_migrations WHERE name='0032_wp2_3_acting_appointment_decision_and_termination_records.sql') AS applied",
    );
    expect(migration.rows[0]?.applied).toBe(true);
    await admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, 'wp2.3-command-fixture']);
    await admin.query(
      `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
       VALUES($1,$4,$5,$5,'active'),($2,$4,$6,$6,'active'),($3,$4,$7,$7,'active')`,
      [actorId, delegateeId, actingOfficerUserId, tenantId, `wp2.3-${actorId}@example.invalid`, `wp2.3-${delegateeId}@example.invalid`, `wp2.3-${actingOfficerUserId}@example.invalid`],
    );
    await admin.query(`INSERT INTO symphony.organizations(id,tenant_id,name,status,organization_kind)
      VALUES($1,$2,$3,'active','cooperative'),($4,$2,$5,'active','union')`,
      [targetOrganizationId, tenantId, 'wp2.3 cooperative', unionOrganizationId, 'wp2.3 union']);
    await admin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)', [personId, tenantId, `wp2.3-${personId}`]);
    await admin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)', [actingPersonId, tenantId, `wp2.3-${actingPersonId}`]);
    await admin.query(
      `INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id)
       VALUES($1,$2,$3,'wp2.3-test-fixture',$2)`, [tenantId, actorId, personId],
    );
    await admin.query(
      `INSERT INTO symphony.organization_memberships(tenant_id,organization_id,person_id,status,joined_at,source_ref)
       VALUES($1,$2,$3,'active',transaction_timestamp(),'wp2.3-test-fixture')`, [tenantId, targetOrganizationId, personId],
    );
    await admin.query(
      `INSERT INTO symphony.organization_memberships(tenant_id,organization_id,person_id,status,joined_at,source_ref)
       VALUES($1,$2,$3,'active',transaction_timestamp(),'wp2.3-acting-fixture')`, [tenantId, targetOrganizationId, actingPersonId],
    );
    await admin.query(
      `INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref,enforce_exclusive)
       VALUES($1,$2,'00000000-0000-4000-8000-000000000001',transaction_timestamp(),'wp2.3-test-fixture',true)`,
      [targetOrganizationId, personId],
    );
    await admin.query(
      "INSERT INTO symphony.platform_roles(id,code,name) VALUES($1,'programme_manager','Programme Manager') ON CONFLICT (code) DO NOTHING",
      [randomUUID()],
    ).then((result) => { programmeManagerRoleSeeded = result.rowCount === 1; });
    const role = await admin.query<{ id: string }>("SELECT id FROM symphony.platform_roles WHERE code='programme_manager'");
    if (!role.rows[0]) throw new Error('Required seeded programme_manager platform role is missing.');
    await admin.query(
      'INSERT INTO symphony.user_role_assignments(user_id,platform_role_id,tenant_id) VALUES($1,$2,$3)',
      [actorId, role.rows[0].id, tenantId],
    );
    await admin.query(
      "INSERT INTO symphony.platform_roles(id,code,name) VALUES($1,'platform_enroller','Platform Enroller') ON CONFLICT (code) DO NOTHING",
      [randomUUID()],
    ).then((result) => { enrollerRoleSeeded = result.rowCount === 1; });
    const enrollerRole = await admin.query<{ id: string }>("SELECT id FROM symphony.platform_roles WHERE code='platform_enroller'");
    if (!enrollerRole.rows[0]) throw new Error('Could not provision the isolated platform_enroller fixture role.');
    await admin.query(
      'INSERT INTO symphony.user_role_assignments(user_id,platform_role_id,tenant_id) VALUES($1,$2,$3)',
      [delegateeId, enrollerRole.rows[0].id, tenantId],
    );
    const assistedSessionId = randomUUID();
    enrolmentSessionIds.push(assistedSessionId);
    await admin.query(
      `INSERT INTO symphony.enrolment_sessions(id,tenant_id,enroller_user_id,organization_id,representative_person_id,
         representative_present,representative_nrc_sighted,representative_consented_to_act,
         attestation_recorded_by_user_id,attestation_recorded_at)
       VALUES($1,$2,$3,$4,$5,true,true,true,$3,transaction_timestamp())`,
      [assistedSessionId, tenantId, delegateeId, targetOrganizationId, personId],
    );
    const incompleteSessionId = randomUUID();
    enrolmentSessionIds.push(incompleteSessionId);
    await admin.query(
      `INSERT INTO symphony.enrolment_sessions(id,tenant_id,enroller_user_id,organization_id,representative_person_id,
         representative_present,representative_nrc_sighted,representative_consented_to_act,
         attestation_recorded_by_user_id,attestation_recorded_at)
       VALUES($1,$2,$3,$4,$5,true,false,true,$3,transaction_timestamp())`,
      [incompleteSessionId, tenantId, delegateeId, targetOrganizationId, personId],
    );
    await admin.query(
      `INSERT INTO symphony.programme_manager_scopes(tenant_id,programme_manager_user_id,target_organization_id,scope_kind,granted_at,source_ref)
       VALUES($1,$2,$3,'ta_delegation',transaction_timestamp(),'wp2.3-test-fixture')`,
      [tenantId, actorId, targetOrganizationId],
    );
    await admin.query(
      `INSERT INTO symphony.institutional_role_assignments(tenant_id,user_id,institution_organization_id,role_code,granted_at,source_ref)
       VALUES($1,$2,$3,'union_ta',transaction_timestamp(),'wp2.3-test-fixture')`,
      [tenantId, delegateeId, unionOrganizationId],
    );
    await admin.query(
      `INSERT INTO symphony.authority_scope_versions(scope_type,tenant_id,scope_id)
       VALUES('actor',NULL,$1),('actor',NULL,$2),('actor',NULL,$3)
       ON CONFLICT (scope_type,tenant_id,scope_id) DO NOTHING`, [actorId, delegateeId, actingOfficerUserId],
    );
    await admin.query(
      `INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id)
       VALUES($1,$2,$3,'wp2.3-acting-fixture',$2)`, [tenantId, actingOfficerUserId, actingPersonId],
    );
    await admin.query(
      `INSERT INTO symphony.evidence_items(id,organization_id,track,evidence_type) VALUES($1,$2,'R','acting_appointment_source')`,
      [supportingEvidenceItemId, targetOrganizationId],
    );
    await admin.query(
      `INSERT INTO symphony.evidence_versions(id,evidence_item_id,version_number,supplier_user_id,origin,stage,payload)
       VALUES($1,$2,1,$3,'cooperative_supplied','supplied','{}'::jsonb)`,
      [supportingEvidenceVersionId, supportingEvidenceItemId, actorId],
    );
    await admin.query(
      `INSERT INTO symphony.domain_events(id,tenant_id,aggregate_id,aggregate_type,event_type,occurred_at,sequence,payload)
       VALUES($1,$2,$3::uuid,'ActingOfficerAppointment','ActingOfficerAppointed',transaction_timestamp(),1,
         jsonb_build_object('sourceId',$3::uuid::text,'sourceReference','TEST-RESOLUTION-42'))`,
      [actingAppointmentEventId, tenantId, actingAppointmentId],
    );
    await admin.query(
      `INSERT INTO symphony.acting_officer_appointments(id,tenant_id,organization_id,person_id,position_code,appointed_by_user_id,recorded_by_user_id,
         source_kind,source_reference,source_issuing_body,source_date,supporting_evidence_version_id,effective_from,effective_to,source_event_id)
       VALUES($1,$2,$3,$4,'chairperson',$5,$5,'external_resolution','TEST-RESOLUTION-42','Cooperative General Meeting',CURRENT_DATE,
         $6,transaction_timestamp()-interval '1 minute',transaction_timestamp()+interval '1 day',$7)`,
      [actingAppointmentId, tenantId, targetOrganizationId, actingPersonId, actorId, supportingEvidenceVersionId, actingAppointmentEventId],
    );
  }, 30_000);

  afterAll(async () => {
    if (adminUrl) {
      await admin.query('DELETE FROM symphony.event_outbox WHERE event_id IN (SELECT id FROM symphony.domain_events WHERE aggregate_id=ANY($1::uuid[]))', [[...capacityGrantIds, ...delegationIds, actingAppointmentId, actingEndingId]]).catch(() => undefined);
      await admin.query('ALTER TABLE symphony.acting_officer_appointment_endings DISABLE TRIGGER acting_appointment_ending_immutability').catch(() => undefined);
      await admin.query('DELETE FROM symphony.acting_officer_appointment_endings WHERE id=$1', [actingEndingId]).catch(() => undefined);
      await admin.query('ALTER TABLE symphony.acting_officer_appointment_endings ENABLE TRIGGER acting_appointment_ending_immutability').catch(() => undefined);
      await admin.query('ALTER TABLE symphony.acting_officer_appointments DISABLE TRIGGER acting_appointment_immutability').catch(() => undefined);
      await admin.query('DELETE FROM symphony.acting_officer_appointments WHERE id=$1', [actingAppointmentId]).catch(() => undefined);
      await admin.query('ALTER TABLE symphony.acting_officer_appointments ENABLE TRIGGER acting_appointment_immutability').catch(() => undefined);
      await admin.query('DELETE FROM symphony.capacity_grants WHERE id=ANY($1::uuid[])', [capacityGrantIds]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.ta_scope_delegations WHERE id=ANY($1::uuid[])', [delegationIds]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.command_receipts WHERE tenant_id=$1 AND command_id=ANY($2::uuid[])', [tenantId, commandIds]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.aggregate_states WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [tenantId, [...capacityGrantIds, ...delegationIds]]).catch(() => undefined);
      await admin.query('ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability');
      await admin.query('DELETE FROM symphony.domain_events WHERE tenant_id=$1 AND aggregate_id=ANY($2::uuid[])', [tenantId, [...capacityGrantIds, ...delegationIds, actingAppointmentId, actingEndingId]]);
      await admin.query('ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability');
      await admin.query('ALTER TABLE symphony.evidence_versions DISABLE TRIGGER evidence_versions_immutability');
      await admin.query('DELETE FROM symphony.evidence_versions WHERE id=ANY($1::uuid[])', [[supportingEvidenceVersionId, endingEvidenceVersionId]]).catch(() => undefined);
      await admin.query('ALTER TABLE symphony.evidence_versions ENABLE TRIGGER evidence_versions_immutability');
      await admin.query('DELETE FROM symphony.evidence_items WHERE id=ANY($1::uuid[])', [[supportingEvidenceItemId, endingEvidenceItemId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.programme_manager_scopes WHERE tenant_id=$1 AND programme_manager_user_id=$2', [tenantId, actorId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.institutional_role_assignments WHERE tenant_id=$1 AND user_id=$2', [tenantId, delegateeId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.user_role_assignments WHERE tenant_id=$1 AND user_id=ANY($2::uuid[])', [tenantId, [actorId, delegateeId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.enrolment_sessions WHERE tenant_id=$1 AND id=ANY($2::uuid[])', [tenantId, enrolmentSessionIds]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.appointments WHERE organization_id=$1 AND person_id=$2', [targetOrganizationId, personId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organization_memberships WHERE tenant_id=$1 AND person_id=$2', [tenantId, personId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organization_memberships WHERE tenant_id=$1 AND person_id=$2', [tenantId, actingPersonId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.user_person_links WHERE tenant_id=$1 AND person_id=$2', [tenantId, personId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.user_person_links WHERE tenant_id=$1 AND person_id=$2', [tenantId, actingPersonId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.persons WHERE id=$1', [personId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.persons WHERE id=$1', [actingPersonId]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.organizations WHERE id=ANY($1::uuid[])', [[targetOrganizationId, unionOrganizationId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.users WHERE id=ANY($1::uuid[])', [[actorId, delegateeId, actingOfficerUserId]]).catch(() => undefined);
      if (programmeManagerRoleSeeded) await admin.query("DELETE FROM symphony.platform_roles WHERE code='programme_manager'").catch(() => undefined);
      if (enrollerRoleSeeded) await admin.query("DELETE FROM symphony.platform_roles WHERE code='platform_enroller'").catch(() => undefined);
      await admin.query('DELETE FROM symphony.authority_scope_versions WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
      await admin.query("DELETE FROM symphony.authority_scope_versions WHERE scope_type='actor' AND scope_id=$1", [actorId]).catch(() => undefined);
      await admin.query("DELETE FROM symphony.authority_scope_versions WHERE scope_type='actor' AND scope_id=ANY($1::uuid[])", [[delegateeId, actingOfficerUserId]]).catch(() => undefined);
      await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]).catch(() => undefined);
    }
    await Promise.all([db.destroy(), recoveryDb.destroy(), admin.end()]);
  });

  it('recognizes acting authority only from a current same-cooperative appointment with exact immutable evidence provenance', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    await admin.query(
      `INSERT INTO symphony.capacity_grants(id,user_id,organization_id,capacity_type,granted_by_user_id,active_from,expires_at)
       VALUES($1,$2,$3,'field_agent',$4,transaction_timestamp()-interval '1 minute',transaction_timestamp()+interval '1 day')`,
      [grantId, delegateeId, targetOrganizationId, actorId],
    );
    const result = await dispatch('RevokeCapacity', { capacityGrantId: grantId }, targetOrganizationId, actingOfficerUserId);
    expect(result).toMatchObject({ ok: true, data: { operation: 'revoked', sourceId: grantId } });
    const source = await admin.query<{ revoked: boolean; event_type: string; source_event_id: string }>(
      `SELECT c.revoked_at IS NOT NULL AS revoked,e.event_type,acting.source_event_id
         FROM symphony.capacity_grants c
         JOIN symphony.domain_events e ON e.id=c.revoked_event_id
         JOIN symphony.acting_officer_appointments acting ON acting.id=$2
        WHERE c.id=$1`, [grantId, actingAppointmentId],
    );
    expect(source.rows[0]).toMatchObject({ revoked: true, event_type: 'CapacityRevoked', source_event_id: actingAppointmentEventId });
  });

  it('stops resolving an acting office at its immutable, source-backed termination time', async () => {
    await admin.query(
      `INSERT INTO symphony.evidence_items(id,organization_id,track,evidence_type)
       VALUES($1,$2,'R','acting_appointment_termination_source')`,
      [endingEvidenceItemId, targetOrganizationId],
    );
    await admin.query(
      `INSERT INTO symphony.evidence_versions(id,evidence_item_id,version_number,supplier_user_id,origin,stage,payload)
       VALUES($1,$2,1,$3,'cooperative_supplied','supplied','{}'::jsonb)`,
      [endingEvidenceVersionId, endingEvidenceItemId, actorId],
    );
    await admin.query(
      `INSERT INTO symphony.domain_events(id,tenant_id,aggregate_id,aggregate_type,event_type,occurred_at,sequence,payload)
       VALUES($1,$2,$3,'ActingOfficerAppointmentEnding','ActingOfficerAppointmentEnded',transaction_timestamp(),1,
         jsonb_build_object('appointmentId',$4::text,'sourceReference','TEST-END-42'))`,
      [actingEndingEventId, tenantId, actingEndingId, actingAppointmentId],
    );
    await admin.query(
      `INSERT INTO symphony.acting_officer_appointment_endings(id,tenant_id,organization_id,appointment_id,ended_at,
         ended_by_user_id,recorded_by_user_id,source_kind,source_reference,source_issuing_body,source_date,
         supporting_evidence_version_id,source_event_id)
       VALUES($1,$2,$3,$4,transaction_timestamp(),$5,$6,'external_resolution','TEST-END-42',
         'Cooperative General Meeting',CURRENT_DATE,$7,$8)`,
      [actingEndingId, tenantId, targetOrganizationId, actingAppointmentId, actorId, actingOfficerUserId,
        endingEvidenceVersionId, actingEndingEventId],
    );
    const denied = await dispatch('GrantCapacity', {
      capacityGrantId: endingGrantId, targetUserId: delegateeId, capacityType: 'field_agent',
      activeFrom: new Date(Date.now() - 1_000).toISOString(),
      activeTo: new Date(Date.now() + 60_000).toISOString(),
    }, targetOrganizationId, actingOfficerUserId);
    expect(denied).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect((await admin.query('SELECT 1 FROM symphony.capacity_grants WHERE id=$1', [endingGrantId])).rowCount).toBe(0);
    const unchangedAppointment = await admin.query<{ recorded_by_user_id: string; source_reference: string }>(
      'SELECT recorded_by_user_id,source_reference FROM symphony.acting_officer_appointments WHERE id=$1',
      [actingAppointmentId],
    );
    expect(unchangedAppointment.rows[0]).toEqual({ recorded_by_user_id: actorId, source_reference: 'TEST-RESOLUTION-42' });
  });

  it('persists capacity grant, semantic no-op, and exact revoke atomically with events, receipts, outbox, and D-16 versions', async () => {
    const grantId = randomUUID();
    const repeatedGrantId = randomUUID();
    capacityGrantIds.push(grantId, repeatedGrantId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const before = await organizationVersion();
    const grantorActorVersion = await authorityVersion('actor_tenant', actorId, tenantId);
    const granteeActorVersion = await authorityVersion('actor_tenant', delegateeId, tenantId);
    const tenantVersion = await authorityVersion('tenant', tenantId, tenantId);
    const granted = await dispatch('GrantCapacity', {
      capacityGrantId: grantId, targetUserId: delegateeId, capacityType: 'field_agent', activeFrom, activeTo,
    }, targetOrganizationId, actorId);
    expect(granted).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: grantId } });
    const afterGrant = await organizationVersion();
    expect(afterGrant).toBe(before + 1);
    expect(await authorityVersion('actor_tenant', actorId, tenantId)).toBe(grantorActorVersion);
    expect(await authorityVersion('actor_tenant', delegateeId, tenantId)).toBe(granteeActorVersion + 1);
    expect(await authorityVersion('tenant', tenantId, tenantId)).toBe(tenantVersion + 1);

    const repeated = await dispatch('GrantCapacity', {
      capacityGrantId: repeatedGrantId, targetUserId: delegateeId, capacityType: 'field_agent', activeFrom, activeTo,
    }, targetOrganizationId, actorId);
    expect(repeated).toMatchObject({ ok: true, eventIds: [], data: { operation: 'unchanged', sourceId: grantId } });
    expect(await organizationVersion()).toBe(afterGrant);

    const conflicting = await dispatch('GrantCapacity', {
      capacityGrantId: randomUUID(), targetUserId: delegateeId, capacityType: 'field_agent', activeFrom,
      activeTo: new Date(Date.parse(activeTo) + 30_000).toISOString(),
    }, targetOrganizationId, actorId);
    expect(conflicting).toMatchObject({ ok: false, code: 'DOMAIN_VIOLATION' });
    expect(await organizationVersion()).toBe(afterGrant);

    const revoked = await dispatch('RevokeCapacity', { capacityGrantId: grantId }, targetOrganizationId, actorId, 1);
    expect(revoked).toMatchObject({ ok: true, data: { operation: 'revoked', sourceId: grantId } });
    const afterRevoke = await organizationVersion();
    expect(afterRevoke).toBe(afterGrant + 1);
    expect(await authorityVersion('actor_tenant', actorId, tenantId)).toBe(grantorActorVersion);
    expect(await authorityVersion('actor_tenant', delegateeId, tenantId)).toBe(granteeActorVersion + 2);
    const repeatedRevoke = await dispatch('RevokeCapacity', { capacityGrantId: grantId }, targetOrganizationId, actorId, 2);
    expect(repeatedRevoke).toMatchObject({ ok: true, eventIds: [], data: { operation: 'unchanged', sourceId: grantId } });
    expect(await organizationVersion()).toBe(afterRevoke);
    const source = await admin.query<{ revoked: boolean; source_event_id: string; revoked_event_id: string; source_event_count: string; revoke_event_count: string; receipt_count: string; outbox_count: string }>(
      `SELECT revoked_at IS NOT NULL AS revoked,source_event_id,revoked_event_id,
         (SELECT count(*)::text FROM symphony.domain_events WHERE aggregate_id=$1 AND event_type='CapacityGranted') AS source_event_count,
         (SELECT count(*)::text FROM symphony.domain_events WHERE aggregate_id=$1 AND event_type='CapacityRevoked') AS revoke_event_count,
         (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id=$2 AND command_id=ANY($3::uuid[])) AS receipt_count,
         (SELECT count(*)::text FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id=o.event_id WHERE e.aggregate_id=$1) AS outbox_count
       FROM symphony.capacity_grants WHERE id=$1`, [grantId, tenantId, commandIds],
    );
    expect(source.rows[0]).toMatchObject({ revoked: true, source_event_count: '1', revoke_event_count: '1', receipt_count: '6', outbox_count: '2' });
    expect(source.rows[0]?.source_event_id).toBeTruthy();
    expect(source.rows[0]?.revoked_event_id).toBeTruthy();
  });

  it('authorizes assisted IFV grants from the exact persisted session and records the representative decision atomically', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    const sessionId = enrolmentSessionIds[0]!;
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const before = await organizationVersion();
    const granted = await dispatch('GrantCapacity', {
      capacityGrantId: grantId, targetUserId: actorId, capacityType: 'internal_verifier', activeFrom, activeTo,
      assistedEnrolment: { sessionId, representativeDecision: 'approve_internal_verifier' },
    }, targetOrganizationId, delegateeId);
    expect(granted).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: grantId } });
    expect(await organizationVersion()).toBe(before + 1);
    const source = await admin.query<{
      assisted_session_id: string; representative_person_id: string; representative_decision: string;
      grantor: string; event_payload: { assistedSessionId: string; representativePersonId: string; representativeDecision: string };
    }>(
      `SELECT c.assisted_session_id,c.representative_person_id,c.representative_decision,c.granted_by_user_id AS grantor,e.payload AS event_payload
         FROM symphony.capacity_grants c JOIN symphony.domain_events e ON e.id=c.source_event_id WHERE c.id=$1`, [grantId],
    );
    expect(source.rows[0]).toMatchObject({
      assisted_session_id: sessionId, representative_person_id: personId,
      representative_decision: 'approve_internal_verifier', grantor: delegateeId,
      event_payload: { assistedSessionId: sessionId, representativePersonId: personId, representativeDecision: 'approve_internal_verifier' },
    });

    const denied = await dispatch('GrantCapacity', {
      capacityGrantId: randomUUID(), targetUserId: actorId, capacityType: 'internal_verifier', activeFrom, activeTo,
      assistedEnrolment: { sessionId: randomUUID(), representativeDecision: 'approve_internal_verifier' },
    }, targetOrganizationId, delegateeId);
    expect(denied).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    const incomplete = await dispatch('GrantCapacity', {
      capacityGrantId: randomUUID(), targetUserId: actorId, capacityType: 'internal_verifier', activeFrom, activeTo,
      assistedEnrolment: { sessionId: enrolmentSessionIds[1]!, representativeDecision: 'approve_internal_verifier' },
    }, targetOrganizationId, delegateeId);
    expect(incomplete).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    const wrongEnroller = await dispatch('GrantCapacity', {
      capacityGrantId: randomUUID(), targetUserId: delegateeId, capacityType: 'internal_verifier', activeFrom, activeTo,
      assistedEnrolment: { sessionId, representativeDecision: 'approve_internal_verifier' },
    }, targetOrganizationId, actorId);
    expect(wrongEnroller).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(await organizationVersion()).toBe(before + 1);
  });

  it('persists one cooperative TA delegation and treats a semantic repeat as a no-op', async () => {
    const delegationId = randomUUID();
    const repeatedId = randomUUID();
    delegationIds.push(delegationId, repeatedId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const unionVersion = await authorityVersion('organization', unionOrganizationId, tenantId);
    const managerActorVersion = await authorityVersion('actor_tenant', actorId, tenantId);
    const delegateeActorVersion = await authorityVersion('actor_tenant', delegateeId, tenantId);
    const tenantScopeVersion = await authorityVersion('tenant', tenantId, tenantId);
    const first = await dispatch('DelegateTaScope', {
      delegationId, operation: 'grant', delegateeUserId: delegateeId, unionOrganizationId,
      agreementRef: 'TEST-AGREEMENT-1', activeFrom, activeTo,
    }, targetOrganizationId, actorId);
    expect(first).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: delegationId } });
    const versionAfterGrant = await organizationVersion();
    expect(await authorityVersion('organization', unionOrganizationId, tenantId)).toBe(unionVersion);
    expect(await authorityVersion('actor_tenant', actorId, tenantId)).toBe(managerActorVersion);
    expect(await authorityVersion('actor_tenant', delegateeId, tenantId)).toBe(delegateeActorVersion + 1);
    expect(await authorityVersion('tenant', tenantId, tenantId)).toBe(tenantScopeVersion + 1);
    const repeat = await dispatch('DelegateTaScope', {
      delegationId: repeatedId, operation: 'grant', delegateeUserId: delegateeId, unionOrganizationId,
      agreementRef: 'TEST-AGREEMENT-1', activeFrom, activeTo,
    }, targetOrganizationId, actorId);
    expect(repeat).toMatchObject({ ok: true, eventIds: [], data: { operation: 'unchanged', sourceId: delegationId } });
    expect(await organizationVersion()).toBe(versionAfterGrant);
    const revoke = await dispatch('DelegateTaScope', { delegationId, operation: 'revoke' }, targetOrganizationId, actorId, 1);
    expect(revoke).toMatchObject({ ok: true, data: { operation: 'revoked', sourceId: delegationId } });
    const versionAfterRevoke = await organizationVersion();
    expect(versionAfterRevoke).toBe(versionAfterGrant + 1);
    expect(await authorityVersion('organization', unionOrganizationId, tenantId)).toBe(unionVersion);
    expect(await authorityVersion('actor_tenant', actorId, tenantId)).toBe(managerActorVersion);
    expect(await authorityVersion('actor_tenant', delegateeId, tenantId)).toBe(delegateeActorVersion + 2);
    const repeatedRevoke = await dispatch('DelegateTaScope', { delegationId, operation: 'revoke' }, targetOrganizationId, actorId, 2);
    expect(repeatedRevoke).toMatchObject({ ok: true, eventIds: [], data: { operation: 'unchanged', sourceId: delegationId } });
    expect(await organizationVersion()).toBe(versionAfterRevoke);
    const rows = await admin.query<{ revoked: boolean; source_event_id: string; revoked_event_id: string; events: string; outbox: string }>(
      `SELECT revoked_at IS NOT NULL AS revoked,source_event_id,revoked_event_id,
        (SELECT count(*)::text FROM symphony.domain_events WHERE aggregate_id=$1) AS events,
        (SELECT count(*)::text FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id=o.event_id WHERE e.aggregate_id=$1) AS outbox
       FROM symphony.ta_scope_delegations WHERE id=$1`, [delegationId],
    );
    expect(rows.rows[0]).toMatchObject({ revoked: true, events: '2', outbox: '2' });
    expect(rows.rows[0]?.source_event_id).toBeTruthy();
    expect(rows.rows[0]?.revoked_event_id).toBeTruthy();
  });

  it('rolls back source, receipt, event, outbox and D-16 versions when event binding fails', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    const before = await organizationVersion();
    await admin.query(`CREATE FUNCTION symphony.wp2_3_test_reject_event_binding() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic source-event binding rejection'; END $$`);
    await admin.query(`CREATE TRIGGER wp2_3_test_reject_event_binding
      BEFORE UPDATE OF source_event_id ON symphony.capacity_grants
      FOR EACH ROW WHEN (NEW.source_event_id IS DISTINCT FROM OLD.source_event_id)
      EXECUTE FUNCTION symphony.wp2_3_test_reject_event_binding()`);
    let rejection: unknown;
    try {
      rejection = await dispatch('GrantCapacity', {
        capacityGrantId: grantId, targetUserId: delegateeId, capacityType: 'field_agent',
        activeFrom: new Date(Date.now() - 1_000).toISOString(), activeTo: new Date(Date.now() + 60_000).toISOString(),
      }, targetOrganizationId, actorId);
    } catch (error) { rejection = error; }
    finally {
      await admin.query('DROP TRIGGER IF EXISTS wp2_3_test_reject_event_binding ON symphony.capacity_grants');
      await admin.query('DROP FUNCTION IF EXISTS symphony.wp2_3_test_reject_event_binding()');
    }
    expect(rejection).toBeInstanceOf(Error);
    const failedCommandId = commandIds.at(-1)!;
    const persisted = await admin.query<{ grants: string; receipts: string; events: string; outbox: string }>(
      `SELECT
        (SELECT count(*)::text FROM symphony.capacity_grants WHERE id=$1) AS grants,
        (SELECT count(*)::text FROM symphony.command_receipts WHERE tenant_id=$2 AND command_id=$3) AS receipts,
        (SELECT count(*)::text FROM symphony.domain_events WHERE aggregate_id=$1) AS events,
        (SELECT count(*)::text FROM symphony.event_outbox o JOIN symphony.domain_events e ON e.id=o.event_id WHERE e.aggregate_id=$1) AS outbox`,
      [grantId, tenantId, failedCommandId],
    );
    expect(persisted.rows[0]).toEqual({ grants: '0', receipts: '0', events: '0', outbox: '0' });
    expect(await organizationVersion()).toBe(before);
  });

  it('linearizes a capacity grant after a protected read and increments only changed scopes', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const reader = holdProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('id').where('id', '=', grantId).executeTakeFirst()) !== undefined);
    const before = await reader.acquired;
    expect(before.active).toBe(false);
    const blocked = dispatchWhileProtectedSnapshotBlocked(before.pid, () => dispatch('GrantCapacity', {
      capacityGrantId: grantId, targetUserId: delegateeId, capacityType: 'field_agent', activeFrom, activeTo,
    }, targetOrganizationId, actorId));
    await blocked.observed;
    reader.release();
    await reader.completed;
    expect(await blocked.result).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: grantId } });
    const after = await openProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('id').where('id', '=', grantId).executeTakeFirst()) !== undefined);
    expect(after.active).toBe(true);
    expect(after.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId })))
      .toBe((before.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId })) ?? 0) + 1);
    expect(after.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId })))
      .toBe((before.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId })) ?? 0) + 1);
    expect(after.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: actorId })))
      .toBe(before.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: actorId })));
  });

  it('linearizes capacity revocation after a protected read without rewriting its grant event', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 120_000).toISOString();
    await dispatch('GrantCapacity', { capacityGrantId: grantId, targetUserId: delegateeId, capacityType: 'delegate', sourceRef: 'WP2.4-CAPACITY-REVOKE', activeFrom, activeTo }, targetOrganizationId, actorId);
    const eventBefore = await readEventHistory(grantId);
    const reader = holdProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('revoked_at').where('id', '=', grantId).executeTakeFirst())?.revoked_at === null);
    const before = await reader.acquired;
    expect(before.active).toBe(true);
    const blocked = dispatchWhileProtectedSnapshotBlocked(before.pid,
      () => dispatch('RevokeCapacity', { capacityGrantId: grantId }, targetOrganizationId, actorId, 1));
    await blocked.observed;
    reader.release();
    await reader.completed;
    expect(await blocked.result).toMatchObject({ ok: true, data: { operation: 'revoked', sourceId: grantId } });
    const after = await openProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('revoked_at').where('id', '=', grantId).executeTakeFirst())?.revoked_at === null);
    expect(after.active).toBe(false);
    const history = await readEventHistory(grantId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(eventBefore[0]);
    expect(history.map((event) => event.event_type)).toEqual(['CapacityGranted', 'CapacityRevoked']);
  });

  it('linearizes a TA-scope grant after a protected read and changes the cooperative, not union or grantor, scope versions', async () => {
    const delegationId = randomUUID();
    delegationIds.push(delegationId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const reader = holdProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('id').where('id', '=', delegationId).executeTakeFirst()) !== undefined);
    const before = await reader.acquired;
    expect(before.active).toBe(false);
    const blocked = dispatchWhileProtectedSnapshotBlocked(before.pid, () => dispatch('DelegateTaScope', {
      delegationId, operation: 'grant', delegateeUserId: delegateeId, unionOrganizationId,
      agreementRef: 'WP2.4-GRANT-RACE', activeFrom, activeTo,
    }, targetOrganizationId, actorId));
    await blocked.observed;
    reader.release();
    await reader.completed;
    expect(await blocked.result).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: delegationId } });
    const after = await openProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('id').where('id', '=', delegationId).executeTakeFirst()) !== undefined);
    expect(after.active).toBe(true);
    for (const [scopeType, scopeId, increment] of [
      ['organization', targetOrganizationId, 1], ['tenant', tenantId, 1], ['actor_tenant', delegateeId, 1],
      ['organization', unionOrganizationId, 0], ['actor_tenant', actorId, 0],
    ] as const) {
      const key = authorityScopeKey({ scopeType, tenantId: scopeType === 'actor_tenant' || scopeType === 'tenant' || scopeType === 'organization' ? tenantId : null, scopeId });
      expect(after.versions.get(key)).toBe((before.versions.get(key) ?? 0) + increment);
    }
    await dispatch('DelegateTaScope', { delegationId, operation: 'revoke' }, targetOrganizationId, actorId, 1);
  });

  it('linearizes TA-scope revocation after a protected read without rewriting its grant event', async () => {
    const delegationId = randomUUID();
    delegationIds.push(delegationId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const grant = await dispatch('DelegateTaScope', { delegationId, operation: 'grant', delegateeUserId: delegateeId,
      unionOrganizationId, agreementRef: 'WP2.4-REVOKE-RACE', activeFrom, activeTo }, targetOrganizationId, actorId);
    expect(grant).toMatchObject({ ok: true, data: { operation: 'granted', sourceId: delegationId } });
    const eventBefore = await readEventHistory(delegationId);
    const reader = holdProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('revoked_at').where('id', '=', delegationId).executeTakeFirst())?.revoked_at === null);
    const before = await reader.acquired;
    expect(before.active).toBe(true);
    const blocked = dispatchWhileProtectedSnapshotBlocked(before.pid,
      () => dispatch('DelegateTaScope', { delegationId, operation: 'revoke' }, targetOrganizationId, actorId, 1));
    await blocked.observed;
    reader.release();
    await reader.completed;
    expect(await blocked.result).toMatchObject({ ok: true, data: { operation: 'revoked', sourceId: delegationId } });
    const after = await openProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('revoked_at').where('id', '=', delegationId).executeTakeFirst())?.revoked_at === null);
    expect(after.active).toBe(false);
    const history = await readEventHistory(delegationId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(eventBefore[0]);
    expect(history.map((event) => event.event_type)).toEqual(['TaScopeDelegated', 'TaScopeRevoked']);
  });

  it('commits capacity grant and revoke before later protected reads, which observe the new source state', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 180_000).toISOString();
    const targetVersionBeforeGrant = await authorityVersion('organization', targetOrganizationId, tenantId);
    const tenantVersionBeforeGrant = await authorityVersion('tenant', tenantId, tenantId);
    const delegateeVersionBeforeGrant = await authorityVersion('actor_tenant', delegateeId, tenantId);
    await dispatch('GrantCapacity', { capacityGrantId: grantId, targetUserId: delegateeId, capacityType: 'delegate', sourceRef: 'WP2.4-MUTATION-FIRST', activeFrom, activeTo }, targetOrganizationId, actorId);
    const afterGrant = await openProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('revoked_at').where('id', '=', grantId).executeTakeFirst())?.revoked_at === null);
    expect(afterGrant.active).toBe(true);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId }))).toBe(targetVersionBeforeGrant + 1);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'tenant', tenantId, scopeId: tenantId }))).toBe(tenantVersionBeforeGrant + 1);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId }))).toBe(delegateeVersionBeforeGrant + 1);
    await dispatch('RevokeCapacity', { capacityGrantId: grantId }, targetOrganizationId, actorId, 1);
    const afterRevoke = await openProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.capacity_grants').select('revoked_at').where('id', '=', grantId).executeTakeFirst())?.revoked_at === null);
    expect(afterRevoke.active).toBe(false);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId }))).toBe(targetVersionBeforeGrant + 2);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'tenant', tenantId, scopeId: tenantId }))).toBe(tenantVersionBeforeGrant + 2);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId }))).toBe(delegateeVersionBeforeGrant + 2);
  });

  it('commits TA-scope grant and revoke before later protected reads, which observe the new source state', async () => {
    const delegationId = randomUUID();
    delegationIds.push(delegationId);
    const activeFrom = new Date(Date.now() - 1_000).toISOString();
    const activeTo = new Date(Date.now() + 60_000).toISOString();
    const targetVersionBeforeGrant = await authorityVersion('organization', targetOrganizationId, tenantId);
    const tenantVersionBeforeGrant = await authorityVersion('tenant', tenantId, tenantId);
    const delegateeVersionBeforeGrant = await authorityVersion('actor_tenant', delegateeId, tenantId);
    await dispatch('DelegateTaScope', { delegationId, operation: 'grant', delegateeUserId: delegateeId,
      unionOrganizationId, agreementRef: 'WP2.4-MUTATION-FIRST', activeFrom, activeTo }, targetOrganizationId, actorId);
    const afterGrant = await openProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.grant' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('revoked_at').where('id', '=', delegationId).executeTakeFirst())?.revoked_at === null);
    expect(afterGrant.active).toBe(true);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId }))).toBe(targetVersionBeforeGrant + 1);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'tenant', tenantId, scopeId: tenantId }))).toBe(tenantVersionBeforeGrant + 1);
    expect(afterGrant.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId }))).toBe(delegateeVersionBeforeGrant + 1);
    await dispatch('DelegateTaScope', { delegationId, operation: 'revoke' }, targetOrganizationId, actorId, 1);
    const afterRevoke = await openProtectedSnapshot({ tenantId, actorUserId: actorId,
      organizationIds: [targetOrganizationId, unionOrganizationId], affectedActorUserIds: [delegateeId], actionId: 'ta_scope.revoke' }, async (trx) =>
      (await trx.selectFrom('symphony.ta_scope_delegations').select('revoked_at').where('id', '=', delegationId).executeTakeFirst())?.revoked_at === null);
    expect(afterRevoke.active).toBe(false);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'organization', tenantId, scopeId: targetOrganizationId }))).toBe(targetVersionBeforeGrant + 2);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'tenant', tenantId, scopeId: tenantId }))).toBe(tenantVersionBeforeGrant + 2);
    expect(afterRevoke.versions.get(authorityScopeKey({ scopeType: 'actor_tenant', tenantId, scopeId: delegateeId }))).toBe(delegateeVersionBeforeGrant + 2);
  });

  it('treats elapsed expiry as inactive without mutating source or advancing D-16 versions', async () => {
    const grantId = randomUUID();
    capacityGrantIds.push(grantId);
    await admin.query(
      `INSERT INTO symphony.capacity_grants(id,user_id,organization_id,capacity_type,granted_by_user_id,active_from,expires_at)
       VALUES($1,$2,$3,'field_agent',$4,transaction_timestamp()-interval '1 minute',transaction_timestamp())`,
      [grantId, delegateeId, targetOrganizationId, actorId],
    );
    const organizationVersionBeforeRead = await authorityVersion('organization', targetOrganizationId, tenantId);
    const tenantVersionBeforeRead = await authorityVersion('tenant', tenantId, tenantId);
    const actorVersionBeforeRead = await authorityVersion('actor_tenant', delegateeId, tenantId);
    const expired = await openProtectedSnapshot({ tenantId, actorUserId: actorId, organizationIds: [targetOrganizationId],
      affectedActorUserIds: [delegateeId], actionId: 'capacity.revoke' }, async (trx) => {
      const row = await sql<{ expired: boolean }>`
        SELECT active_from <= transaction_timestamp() AND expires_at <= transaction_timestamp() AS expired
          FROM symphony.capacity_grants WHERE id = ${grantId}::uuid AND revoked_at IS NULL
      `.execute(trx);
      return row.rows[0]?.expired === true;
    });
    expect(expired.active).toBe(true);
    expect(await authorityVersion('organization', targetOrganizationId, tenantId)).toBe(organizationVersionBeforeRead);
    expect(await authorityVersion('tenant', tenantId, tenantId)).toBe(tenantVersionBeforeRead);
    expect(await authorityVersion('actor_tenant', delegateeId, tenantId)).toBe(actorVersionBeforeRead);
    const row = await admin.query<{ revoked_at: string | null }>('SELECT revoked_at FROM symphony.capacity_grants WHERE id=$1', [grantId]);
    expect(row.rows[0]?.revoked_at).toBeNull();
  });

  async function organizationVersion(): Promise<number> {
    const result = await admin.query<{ version: string }>(
      `SELECT version::text FROM symphony.authority_scope_versions
       WHERE scope_type='organization' AND tenant_id=$1 AND scope_id=$2`, [tenantId, targetOrganizationId],
    );
    return Number(result.rows[0]?.version ?? 0);
  }

  async function readEventHistory(aggregateId: string) {
    const result = await admin.query<{ id: string; event_type: string; payload: unknown; sequence: number }>(
      `SELECT id,event_type,payload,sequence FROM symphony.domain_events WHERE aggregate_id=$1 ORDER BY sequence`, [aggregateId],
    );
    return result.rows;
  }

  function holdProtectedSnapshot(
    request: Omit<AuthorityScopeLockRequest, 'mode'>,
    readSource: (trx: Transaction<SymphonyDatabase>) => Promise<boolean>,
  ) {
    let release!: () => void;
    let signal!: (value: { pid: number; active: boolean; scopes: readonly AuthorityScopeKey[]; versions: ReadonlyMap<string, number> }) => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const acquired = new Promise<{ pid: number; active: boolean; scopes: readonly AuthorityScopeKey[]; versions: ReadonlyMap<string, number> }>((resolve) => { signal = resolve; });
    const completed = db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${request.tenantId}, true)`.execute(trx);
      await sql`SELECT set_config('app.actor_user_id', ${request.actorUserId}, true)`.execute(trx);
      const backend = await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx);
      const locks = await acquireAuthorityScopeLocks(trx, { ...request, mode: 'protected_read' });
      const active = await readSource(trx);
      signal({ pid: backend.rows[0]!.pid, active, scopes: locks.scopes, versions: locks.versions });
      await gate;
      return active;
    });
    return { acquired, completed, release: () => release() };
  }

  async function openProtectedSnapshot(
    request: Omit<AuthorityScopeLockRequest, 'mode'>,
    readSource: (trx: Transaction<SymphonyDatabase>) => Promise<boolean>,
  ) {
    const snapshot = holdProtectedSnapshot(request, readSource);
    const value = await snapshot.acquired;
    snapshot.release();
    await snapshot.completed;
    return value;
  }

  function dispatchWhileProtectedSnapshotBlocked<T>(readerPid: number, mutation: () => Promise<T>) {
    let settled = false;
    const pending = mutation().finally(() => { settled = true; });
    const observed = waitForScopeMutationBlockedBy(readerPid).then((blocked) => {
      if (!blocked) {
        throw new Error(`Mutation was not observed blocked by reader PID ${readerPid}; settled=${settled}`);
      }
      expect(settled).toBe(false);
    });
    return { observed, result: pending };
  }

  async function waitForScopeMutationBlockedBy(readerPid: number): Promise<boolean> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const blocked = await admin.query<{ blockers: number[] }>(
        `SELECT pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
          WHERE datname=current_database() AND pid <> pg_backend_pid()`,
      );
      if (blocked.rows.some((row) => row.blockers.includes(readerPid))) return true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return false;
  }

  async function authorityVersion(scopeType: string, scopeId: string, scopeTenantId: string | null): Promise<number> {
    const result = await admin.query<{ version: string }>(
      `SELECT version::text FROM symphony.authority_scope_versions
        WHERE scope_type=$1 AND scope_id=$2::uuid AND tenant_id IS NOT DISTINCT FROM $3::uuid`,
      [scopeType, scopeId, scopeTenantId],
    );
    return Number(result.rows[0]?.version ?? 0);
  }

  async function dispatch(type: string, payload: Record<string, unknown>, organizationId: string, actorUserId: string, expectedVersion = 0) {
    const commandId = randomUUID();
    commandIds.push(commandId);
    const now = new Date().toISOString();
    const envelope: CommandEnvelope<Record<string, unknown>> = {
      commandId, tenantId, actorUserId, organizationId, occurredAt: now, recordedAt: now,
      deviceId: 'wp2.3-synthetic-test', expectedVersion, correlationId: commandId,
      type, schemaVersion: 1, payload,
    };
    const handler = handlers[type as keyof typeof handlers] as (typeof handlers)[keyof typeof handlers];
    return bus.dispatch(envelope as never, handler as never, { trustedPrincipal: { actorUserId, tenantId } });
  }
});
