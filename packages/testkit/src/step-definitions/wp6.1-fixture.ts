import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { CredentialLifecycleService } from '@symphony/domain/identity/credential-lifecycle';
const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
const appUrl = process.env.PHASE1_TEST_APP_DATABASE_URL;
if (!adminUrl || !appUrl) throw new Error('WP6.1 route tests require both test-admin and app-role PostgreSQL URLs.');

const admin = new pg.Pool({ connectionString: adminUrl, max: 2 });
const app = new pg.Pool({ connectionString: appUrl, max: 2 });
export const tenantId = randomUUID();
export const userId = randomUUID();
const personId = randomUUID();
export const organizationId = randomUUID();
const unionId = randomUUID();
const membershipId = randomUUID();
const evidenceItemId = randomUUID();
const evidenceVersionId = randomUUID();
const verificationAssignmentId = randomUUID();
const verificationFindingId = randomUUID();
const negativeFindings = [
  { kind: 'adverse', outcome: 'does_not_support_claim', scope: 'Adverse result scope', assurance: 'cooperative_internal', attribution: true },
  { kind: 'inconclusive', outcome: 'inconclusive', scope: 'Inconclusive result scope', assurance: 'cooperative_internal', attribution: true },
  { kind: 'missing-scope', outcome: 'supports_claim', scope: null, assurance: 'cooperative_internal', attribution: true },
  { kind: 'unknown-assurance', outcome: 'supports_claim', scope: 'Unknown assurance scope', assurance: 'future_unapproved_class', attribution: true },
  { kind: 'missing-attribution', outcome: 'supports_claim', scope: 'Missing attribution scope', assurance: 'cooperative_internal', attribution: false },
  { kind: 'legacy-outcome', outcome: null, scope: 'Legacy unqualified scope', assurance: 'cooperative_internal', attribution: true },
  { kind: 'missing-finding', outcome: null, scope: null, assurance: null, attribution: false },
].map((row) => ({ ...row, itemId: randomUUID(), versionId: randomUUID(), assignmentId: randomUUID(), findingId: randomUUID() }));
const programmeScopeId = randomUUID();
const taDelegationId = randomUUID();
export const password = `WP6.1 route password ${randomUUID()}`;
export const officeActors = [
  { persona: 'Chairperson', authority: 'chairperson', positionId: '00000000-0000-4000-8000-000000000001' },
  { persona: 'Vice-Chairperson', authority: 'vice_chairperson', positionId: '00000000-0000-4000-8000-000000000002' },
  { persona: 'Treasurer', authority: 'treasurer', positionId: '00000000-0000-4000-8000-000000000004' },
].map((actor) => ({ ...actor, userId: randomUUID(), personId: randomUUID(), password: `WP6.1 ${actor.authority} ${randomUUID()}` }));
const throttleKey = Buffer.from(process.env.AUTH_THROTTLE_HMAC_KEY!, 'base64');


export async function seedWp6_1Fixture() {
  await admin.query('INSERT INTO symphony.tenants(id,name) VALUES($1,$2)', [tenantId, `wp6.1-routes-${tenantId}`]);
  await admin.query(
    `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
     VALUES($1,$2,$3,$3,'active')`, [userId, tenantId, `wp61-${userId}@example.invalid`],
  );
  await admin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)', [personId, tenantId, `wp61-${personId}`]);
  await admin.query(
    `INSERT INTO symphony.organizations(id,tenant_id,name,organization_kind)
     VALUES($1,$2,'WP6.1 Member Cooperative','cooperative'),($3,$2,'WP6.1 Union','union')`, [organizationId, tenantId, unionId],
  );
  await admin.query(
    `INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id)
     VALUES($1,$2,$3,'wp6.1-test-fixture',$2)`, [tenantId, userId, personId],
  );
  await admin.query(
    `INSERT INTO symphony.organization_memberships(id,tenant_id,organization_id,person_id,status,joined_at,source_ref)
     VALUES($1,$2,$3,$4,'active',clock_timestamp()-interval '1 day','wp6.1-test-fixture')`, [membershipId, tenantId, organizationId, personId],
  );
  const verifierAppointment = await admin.query<{ id: string }>(
    `INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref,public_display_name)
     VALUES($1,$2,'00000000-0000-4000-8000-000000000003',clock_timestamp()-interval '1 hour','wp6.1-test-officer-appointment','Example Cooperative Secretary') RETURNING id`,
    [organizationId, personId],
  );
  const verifierAppointmentId = verifierAppointment.rows[0]!.id;
  await admin.query(
    `INSERT INTO symphony.evidence_items(id,organization_id,track,evidence_type)
     VALUES($1,$2,'C','financial_statement')`, [evidenceItemId, organizationId],
  );
  await admin.query(
    `INSERT INTO symphony.evidence_versions(id,evidence_item_id,version_number,supplier_user_id,origin,stage,payload)
     VALUES($1,$2,1,$3,'wp6.1-synthetic-fixture','submitted','{}'::jsonb)`, [evidenceVersionId, evidenceItemId, userId],
  );
  await admin.query(
    `INSERT INTO symphony.verification_assignments(id,evidence_item_id,assigned_to_user_id,evidence_version_id,completed_at)
     VALUES($1,$2,$3,$4,clock_timestamp()-interval '1 minute')`,
    [verificationAssignmentId, evidenceItemId, userId, evidenceVersionId],
  );
  await admin.query(
    `INSERT INTO symphony.verification_findings(id,assignment_id,evidence_version_id,assurance_class,result,scope,outcome)
     VALUES($1,$2,$3,'cooperative_internal','pass','Financial statement completeness', 'supports_claim')`,
    [verificationFindingId, verificationAssignmentId, evidenceVersionId],
  );
  await admin.query(
    `INSERT INTO symphony.verification_finding_attributions
       (finding_id,verifier_user_id,verifier_person_id,appointment_id,public_name,office_title,source_kind,source_ref,captured_at,effective_at,disclosure_basis)
     SELECT f.id,$2,$3,ap.id,ap.public_display_name,pc.display_name,'official_appointment_record',ap.source_ref,f.finding_at,ap.started_at,
       'D-18 authorized cooperative-record viewers; public only where the record is classified public and applicable access/fee policy permits'
       FROM symphony.verification_findings f
       JOIN symphony.appointments ap ON ap.id=$4
       JOIN symphony.position_catalog pc ON pc.id=ap.position_id
      WHERE f.id=$1`,
    [verificationFindingId, userId, personId, verifierAppointmentId],
  );
  for (const fixture of negativeFindings) {
    await admin.query(
      `INSERT INTO symphony.evidence_items(id,organization_id,track,evidence_type)
       VALUES($1,$2,'C','financial_statement')`, [fixture.itemId, organizationId],
    );
    await admin.query(
      `INSERT INTO symphony.evidence_versions(id,evidence_item_id,version_number,supplier_user_id,origin,stage,payload)
       VALUES($1,$2,1,$3,'wp6.1-negative-fixture','submitted','{}'::jsonb)`, [fixture.versionId, fixture.itemId, userId],
    );
    await admin.query(
      `INSERT INTO symphony.verification_assignments(id,evidence_item_id,assigned_to_user_id,evidence_version_id,completed_at)
       VALUES($1,$2,$3,$4,clock_timestamp()-interval '1 minute')`, [fixture.assignmentId, fixture.itemId, userId, fixture.versionId],
    );
    if (fixture.kind === 'missing-finding') continue;
    await admin.query('ALTER TABLE symphony.verification_findings DISABLE TRIGGER verification_findings_require_typed_outcome').catch(() => undefined);
    try {
      await admin.query(
        `INSERT INTO symphony.verification_findings(id,assignment_id,evidence_version_id,assurance_class,result,scope,outcome)
         VALUES($1,$2,$3,$4,'pass',$5,$6)`,
        [fixture.findingId, fixture.assignmentId, fixture.versionId, fixture.assurance, fixture.scope, fixture.outcome],
      );
    } finally {
      await admin.query('ALTER TABLE symphony.verification_findings ENABLE TRIGGER verification_findings_require_typed_outcome');
    }
    if (fixture.attribution) {
      await admin.query(
        `INSERT INTO symphony.verification_finding_attributions
           (finding_id,verifier_user_id,verifier_person_id,appointment_id,public_name,office_title,source_kind,source_ref,captured_at,effective_at,disclosure_basis)
         SELECT f.id,$2,$3,ap.id,ap.public_display_name,pc.display_name,'official_appointment_record',ap.source_ref,f.finding_at,ap.started_at,
           'D-18 authorized cooperative-record viewers; public only where the record is classified public and applicable access/fee policy permits'
           FROM symphony.verification_findings f
           JOIN symphony.appointments ap ON ap.id=$4
           JOIN symphony.position_catalog pc ON pc.id=ap.position_id
          WHERE f.id=$1`,
        [fixture.findingId, userId, personId, verifierAppointmentId],
      );
    }
  }
  await assert.rejects(
    admin.query(
      `INSERT INTO symphony.verification_findings(assignment_id,evidence_version_id,assurance_class,result,scope,outcome)
       VALUES($1,$2,'cooperative_internal','pass','Mismatched version fixture','supports_claim')`,
      [negativeFindings[0]!.assignmentId, evidenceVersionId],
    ),
  );
  for (const actor of officeActors) {
    await admin.query(
      `INSERT INTO symphony.users(id,tenant_id,email,email_normalized,status)
       VALUES($1,$2,$3,$3,'active')`, [actor.userId, tenantId, `wp61-${actor.authority}-${actor.userId}@example.invalid`],
    );
    await admin.query('INSERT INTO symphony.persons(id,tenant_id,pseudonym_id) VALUES($1,$2,$3)', [actor.personId, tenantId, `wp61-${actor.authority}-${actor.personId}`]);
    await admin.query(
      `INSERT INTO symphony.user_person_links(tenant_id,user_id,person_id,source_ref,linked_by_user_id)
       VALUES($1,$2,$3,'wp6.1-office-fixture',$2)`, [tenantId, actor.userId, actor.personId],
    );
    await admin.query(
      `INSERT INTO symphony.organization_memberships(tenant_id,organization_id,person_id,status,joined_at,source_ref)
       VALUES($1,$2,$3,'active',clock_timestamp()-interval '1 day','wp6.1-office-fixture')`, [tenantId, organizationId, actor.personId],
    );
    await admin.query(
      `INSERT INTO symphony.appointments(organization_id,person_id,position_id,started_at,source_ref)
       VALUES($1,$2,$3,clock_timestamp()-interval '1 hour','wp6.1-office-fixture')`, [organizationId, actor.personId, actor.positionId],
    );
  }
  await admin.query(
    `INSERT INTO symphony.capacity_grants(user_id,organization_id,capacity_type,granted_by_user_id,granted_at)
     VALUES($1,$2,'internal_verifier',$1,clock_timestamp()-interval '1 hour')`, [userId, organizationId],
  );
  const programmeRole = await admin.query<{ id: string }>(
    `INSERT INTO symphony.platform_roles(code,name) VALUES('programme_manager','Programme manager')
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
  );
  await admin.query(
    `INSERT INTO symphony.user_role_assignments(user_id,platform_role_id,tenant_id,granted_at)
     VALUES($1,$2,$3,clock_timestamp()-interval '1 day')`, [userId, programmeRole.rows[0]!.id, tenantId],
  );
  await admin.query(
    `INSERT INTO symphony.programme_manager_scopes(id,tenant_id,programme_manager_user_id,target_organization_id,scope_kind,granted_at,source_ref)
     VALUES($1,$2,$3,$4,'ta_delegation',clock_timestamp()-interval '1 day','wp6.1-test-fixture')`,
    [programmeScopeId, tenantId, userId, organizationId],
  );
  await admin.query(
    `INSERT INTO symphony.institutional_role_assignments(tenant_id,user_id,institution_organization_id,role_code,granted_at,source_ref)
     VALUES($1,$2,$3,'union_ta',clock_timestamp()-interval '1 day','wp6.1-test-fixture')`, [tenantId, userId, unionId],
  );
  await admin.query(
    `INSERT INTO symphony.ta_scope_delegations(id,tenant_id,programme_manager_user_id,union_organization_id,delegatee_user_id,target_organization_id,granted_at,agreement_ref)
     VALUES($1,$2,$3,$4,$3,$5,clock_timestamp()-interval '1 day','wp6.1-test-agreement')`,
    [taDelegationId, tenantId, userId, unionId, organizationId],
  );
  await admin.query(
    `INSERT INTO symphony.enrolment_sessions(tenant_id,enroller_user_id,organization_id,started_at)
     VALUES($1,$2,$3,clock_timestamp()-interval '1 hour')`, [tenantId, userId, organizationId],
  );
  const lifecycle = new CredentialLifecycleService({ now: () => new Date().toISOString() });
  const passwordHash = await lifecycle.hashPermanentPassword(password);
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    for (const actor of [{ userId, password }, ...officeActors]) {
      const actorHash = actor.userId === userId ? passwordHash : await lifecycle.hashPermanentPassword(actor.password);
      await client.query('INSERT INTO symphony.password_credentials(tenant_id,user_id,secret_hash) VALUES($1,$2,$3)', [tenantId, actor.userId, actorHash]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupWp6_1Fixture() {
  const accountKeys = [userId, ...officeActors.map((actor) => actor.userId)]
    .map((id) => createHmac('sha256', throttleKey).update(`account:${id.toLowerCase()}`).digest());
  const sourceKey = createHmac('sha256', throttleKey).update('trusted_source:127.0.0.1').digest();
  await admin.query('DELETE FROM symphony.auth_sessions WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.authentication_events WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.password_credentials WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.auth_attempt_events WHERE identity_hmac=ANY($1::bytea[])', [[...accountKeys, sourceKey]]).catch(() => undefined);
  await admin.query('ALTER TABLE symphony.verification_finding_attributions DISABLE TRIGGER verification_finding_attributions_immutability').catch(() => undefined);
  await admin.query('DELETE FROM symphony.verification_finding_attributions WHERE finding_id=$1', [verificationFindingId]).catch(() => undefined);
  await admin.query('ALTER TABLE symphony.verification_finding_attributions ENABLE TRIGGER verification_finding_attributions_immutability').catch(() => undefined);
  for (const fixture of negativeFindings) {
    await admin.query('ALTER TABLE symphony.verification_finding_attributions DISABLE TRIGGER verification_finding_attributions_immutability').catch(() => undefined);
    await admin.query('DELETE FROM symphony.verification_finding_attributions WHERE finding_id=$1', [fixture.findingId]).catch(() => undefined);
    await admin.query('ALTER TABLE symphony.verification_finding_attributions ENABLE TRIGGER verification_finding_attributions_immutability').catch(() => undefined);
    await admin.query('DELETE FROM symphony.verification_findings WHERE id=$1', [fixture.findingId]).catch(() => undefined);
    await admin.query('DELETE FROM symphony.verification_assignments WHERE id=$1', [fixture.assignmentId]).catch(() => undefined);
    await admin.query('ALTER TABLE symphony.evidence_versions DISABLE TRIGGER evidence_versions_immutability').catch(() => undefined);
    await admin.query('DELETE FROM symphony.evidence_versions WHERE id=$1', [fixture.versionId]).catch(() => undefined);
    await admin.query('ALTER TABLE symphony.evidence_versions ENABLE TRIGGER evidence_versions_immutability').catch(() => undefined);
    await admin.query('DELETE FROM symphony.evidence_items WHERE id=$1', [fixture.itemId]).catch(() => undefined);
  }
  await admin.query('DELETE FROM symphony.verification_findings WHERE id=$1', [verificationFindingId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.verification_assignments WHERE id=$1', [verificationAssignmentId]).catch(() => undefined);
  await admin.query('ALTER TABLE symphony.evidence_versions DISABLE TRIGGER evidence_versions_immutability').catch(() => undefined);
  await admin.query('DELETE FROM symphony.evidence_versions WHERE id=$1', [evidenceVersionId]).catch(() => undefined);
  await admin.query('ALTER TABLE symphony.evidence_versions ENABLE TRIGGER evidence_versions_immutability').catch(() => undefined);
  await admin.query('DELETE FROM symphony.evidence_items WHERE id=$1', [evidenceItemId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.enrolment_sessions WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.ta_scope_delegations WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.institutional_role_assignments WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.programme_manager_scopes WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.user_role_assignments WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.capacity_grants WHERE user_id=$1', [userId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.appointments WHERE organization_id=$1', [organizationId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.organization_memberships WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.user_person_links WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.persons WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.organizations WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.users WHERE tenant_id=$1', [tenantId]).catch(() => undefined);
  await admin.query('DELETE FROM symphony.tenants WHERE id=$1', [tenantId]).catch(() => undefined);
  await app.end();
  await admin.end();
}
