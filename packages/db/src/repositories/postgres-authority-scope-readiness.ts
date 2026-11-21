import type { Pool } from 'pg';

const FROZEN_AUTHORITY_TABLES = [
  'tenants', 'users', 'user_role_assignments', 'platform_roles',
  'organization_memberships', 'user_person_links', 'appointments', 'acting_officer_appointments', 'acting_officer_appointment_endings', 'organizations',
  'enrolment_sessions', 'enroller_assignments', 'institutional_role_assignments',
  'programme_manager_scopes', 'delegations',
  'membership_rules', 'acceptance_policies', 'enforcement_policies', 'approval_policies',
  'retention_policies', 'precedence_policies', 'duty_matrix_rows',
] as const;

/** Fail readiness closed unless the process has the D-16 app-role boundary. */
export async function checkAuthorityScopeReadiness(pool: Pool): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query<{ ready: boolean }>(
      `WITH frozen_tables(table_name) AS (
         SELECT unnest($1::text[])
       ), scope AS (
         SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='symphony' AND c.relname='authority_scope_versions'
       ), frozen_dml AS (
         SELECT bool_or(has_table_privilege(current_user, format('symphony.%I', f.table_name), p.privilege)) AS has_dml
           FROM frozen_tables f
           CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE']) p(privilege)
      ), supported_writer AS (
        SELECT
          has_column_privilege(current_user,'symphony.capacity_grants','id','INSERT')
          AND has_column_privilege(current_user,'symphony.capacity_grants','assisted_session_id','INSERT')
          AND has_column_privilege(current_user,'symphony.capacity_grants','representative_person_id','INSERT')
          AND has_column_privilege(current_user,'symphony.capacity_grants','representative_decision','INSERT')
          AND has_column_privilege(current_user,'symphony.capacity_grants','source_event_id','INSERT')
          AND has_column_privilege(current_user,'symphony.capacity_grants','source_event_id','UPDATE')
          AND has_column_privilege(current_user,'symphony.capacity_grants','revoked_at','UPDATE')
          AND has_column_privilege(current_user,'symphony.capacity_grants','revoked_event_id','UPDATE')
          AND has_column_privilege(current_user,'symphony.ta_scope_delegations','id','INSERT')
          AND has_column_privilege(current_user,'symphony.ta_scope_delegations','source_event_id','INSERT')
          AND has_column_privilege(current_user,'symphony.ta_scope_delegations','source_event_id','UPDATE')
          AND has_column_privilege(current_user,'symphony.ta_scope_delegations','revoked_at','UPDATE')
          AND has_column_privilege(current_user,'symphony.ta_scope_delegations','revoked_event_id','UPDATE')
          AND NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            JOIN pg_class c ON c.oid=a.attrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            CROSS JOIN unnest(ARRAY['INSERT','UPDATE']) p(privilege)
            WHERE n.nspname='symphony' AND c.relname IN ('capacity_grants','ta_scope_delegations')
              AND a.attnum>0 AND NOT a.attisdropped
              AND has_column_privilege(current_user,c.oid,a.attname,p.privilege)
              AND NOT (
                (c.relname='capacity_grants' AND p.privilege='INSERT'
                  AND a.attname=ANY(ARRAY['id','user_id','organization_id','capacity_type','granted_by_user_id','active_from','expires_at','source_ref','source_event_id','assisted_session_id','representative_person_id','representative_decision']))
                OR (c.relname='capacity_grants' AND p.privilege='UPDATE' AND a.attname=ANY(ARRAY['revoked_at','revoked_event_id','source_event_id']))
                OR (c.relname='ta_scope_delegations' AND p.privilege='INSERT'
                  AND a.attname=ANY(ARRAY['id','tenant_id','programme_manager_user_id','union_organization_id','delegatee_user_id','target_organization_id','active_from','expires_at','agreement_ref','source_event_id']))
                OR (c.relname='ta_scope_delegations' AND p.privilege='UPDATE' AND a.attname=ANY(ARRAY['revoked_at','revoked_event_id','source_event_id']))
              )
          )
          AND NOT has_table_privilege(current_user,'symphony.capacity_grants','DELETE')
          AND NOT has_table_privilege(current_user,'symphony.capacity_grants','TRUNCATE')
          AND NOT has_table_privilege(current_user,'symphony.ta_scope_delegations','DELETE')
          AND NOT has_table_privilege(current_user,'symphony.ta_scope_delegations','TRUNCATE') AS ready
       ), global_policy AS (
         SELECT count(*) AS visible_count
           FROM symphony.authority_scope_versions
          WHERE scope_type='global_policy'
            AND tenant_id IS NULL
            AND scope_id='00000000-0000-0000-0000-000000000001'::uuid
       )
       SELECT current_user='symphony_app'
          AND EXISTS (SELECT 1 FROM scope WHERE relrowsecurity AND relforcerowsecurity)
          AND has_table_privilege(current_user,'symphony.authority_scope_versions','SELECT')
          AND NOT has_table_privilege(current_user,'symphony.authority_scope_versions','INSERT')
          AND NOT has_table_privilege(current_user,'symphony.authority_scope_versions','UPDATE')
          AND NOT has_table_privilege(current_user,'symphony.authority_scope_versions','DELETE')
          AND NOT has_table_privilege(current_user,'symphony.authority_scope_versions','TRUNCATE')
          AND has_column_privilege(current_user,'symphony.authority_scope_versions','scope_type','INSERT')
          AND has_column_privilege(current_user,'symphony.authority_scope_versions','tenant_id','INSERT')
          AND has_column_privilege(current_user,'symphony.authority_scope_versions','scope_id','INSERT')
          AND has_column_privilege(current_user,'symphony.authority_scope_versions','version','UPDATE')
          AND NOT EXISTS (
            SELECT 1
              FROM pg_attribute a
              JOIN pg_class c ON c.oid=a.attrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
              CROSS JOIN unnest(ARRAY['INSERT','UPDATE']) p(privilege)
             WHERE n.nspname='symphony' AND c.relname='authority_scope_versions'
               AND a.attnum>0 AND NOT a.attisdropped
               AND has_column_privilege(current_user,c.oid,a.attname,p.privilege)
               AND NOT (
                 (p.privilege='INSERT' AND a.attname=ANY(ARRAY['scope_type','tenant_id','scope_id']))
                 OR (p.privilege='UPDATE' AND a.attname='version')
               )
          )
          AND NOT COALESCE((SELECT has_dml FROM frozen_dml), false)
          AND (SELECT ready FROM supported_writer)
          AND (SELECT visible_count FROM global_policy)=1
          AND EXISTS (
            SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='symphony' AND c.relname='authority_scope_versions'
              AND t.tgname='authority_scope_versions_version_guard' AND NOT t.tgisinternal
          )
          AND EXISTS (
            SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='symphony' AND c.relname='authority_scope_versions'
              AND p.polname='authority_scope_versions_frozen_lock'
              AND pg_get_expr(p.polwithcheck,p.polrelid)='false'
          ) AS ready`,
      [FROZEN_AUTHORITY_TABLES],
    );
    return result.rows[0]?.ready === true;
  } catch {
    return false;
  } finally {
    client.release();
  }
}
