-- REM-WP2.6: versioned authority-scope serialization foundation.
-- Direct authority-source DML is closed here; supported writers are added
-- only with the approved WP2.3 command contract and registry.

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app') THEN
    RAISE EXCEPTION 'REM-WP2.6 requires the pre-provisioned symphony_app role';
  END IF;
END
$preflight$;

CREATE TABLE symphony.authority_scope_versions (
  scope_type TEXT NOT NULL,
  tenant_id UUID,
  scope_id UUID NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT authority_scope_versions_identity
    UNIQUE NULLS NOT DISTINCT (scope_type, tenant_id, scope_id),
  CONSTRAINT authority_scope_versions_version_nonnegative CHECK (version >= 0),
  CONSTRAINT authority_scope_versions_scope_shape CHECK (
    (scope_type = 'global_policy' AND tenant_id IS NULL AND scope_id = '00000000-0000-0000-0000-000000000001'::UUID)
    OR (scope_type = 'tenant' AND tenant_id IS NOT NULL AND scope_id = tenant_id)
    OR (scope_type = 'organization' AND tenant_id IS NOT NULL)
    OR (scope_type = 'actor_tenant' AND tenant_id IS NOT NULL)
    OR (scope_type = 'actor' AND tenant_id IS NULL)
  )
);

CREATE FUNCTION symphony.guard_authority_scope_version_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $function$
BEGIN
  IF NEW.scope_type IS DISTINCT FROM OLD.scope_type
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.scope_id IS DISTINCT FROM OLD.scope_id THEN
    RAISE EXCEPTION 'authority scope identity is immutable';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'authority scope version must advance by exactly one';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION symphony.guard_authority_scope_version_update() FROM PUBLIC;
CREATE TRIGGER authority_scope_versions_version_guard
  BEFORE UPDATE ON symphony.authority_scope_versions
  FOR EACH ROW EXECUTE FUNCTION symphony.guard_authority_scope_version_update();

-- Bootstrap runs under the ordered migration identity before FORCE RLS is
-- enabled. This avoids granting serving-role access to global actor rows.
INSERT INTO symphony.authority_scope_versions (scope_type, tenant_id, scope_id)
VALUES ('global_policy', NULL, '00000000-0000-0000-0000-000000000001'::UUID);

INSERT INTO symphony.authority_scope_versions (scope_type, tenant_id, scope_id)
SELECT DISTINCT 'actor', NULL::UUID, assignment.user_id
  FROM symphony.user_role_assignments AS assignment
ON CONFLICT (scope_type, tenant_id, scope_id) DO NOTHING;

DO $bootstrap_validation$
BEGIN
  IF (SELECT count(*) FROM symphony.authority_scope_versions
      WHERE scope_type = 'global_policy'
        AND tenant_id IS NULL
        AND scope_id = '00000000-0000-0000-0000-000000000001'::UUID) <> 1 THEN
    RAISE EXCEPTION 'REM-WP2.6 bootstrap requires exactly one global policy scope';
  END IF;
  IF EXISTS (
    SELECT 1 FROM symphony.user_role_assignments AS assignment
    WHERE NOT EXISTS (
      SELECT 1 FROM symphony.authority_scope_versions AS scope
      WHERE scope.scope_type = 'actor'
        AND scope.tenant_id IS NULL
        AND scope.scope_id = assignment.user_id
    )
  ) THEN
    RAISE EXCEPTION 'REM-WP2.6 bootstrap is missing a required global actor scope';
  END IF;
END
$bootstrap_validation$;

ALTER TABLE symphony.authority_scope_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.authority_scope_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY authority_scope_versions_select ON symphony.authority_scope_versions
  FOR SELECT TO symphony_app
  USING (
    scope_type = 'global_policy'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
    OR (scope_type = 'actor' AND scope_id = NULLIF(current_setting('app.actor_user_id', true), '')::UUID)
  );
CREATE POLICY authority_scope_versions_insert ON symphony.authority_scope_versions
  FOR INSERT TO symphony_app
  WITH CHECK (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
  );
CREATE POLICY authority_scope_versions_update ON symphony.authority_scope_versions
  FOR UPDATE TO symphony_app
  USING (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
  )
  WITH CHECK (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
  );
-- PostgreSQL applies UPDATE-policy visibility to SELECT ... FOR SHARE/UPDATE.
-- This policy makes the frozen global/actor rows lockable by authority
-- mutations while WITH CHECK(false) keeps them immutable to symphony_app.

REVOKE ALL ON symphony.authority_scope_versions FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT (scope_type, tenant_id, scope_id), UPDATE (version)
  ON symphony.authority_scope_versions TO symphony_app;
REVOKE DELETE, TRUNCATE ON symphony.authority_scope_versions FROM symphony_app;

COMMENT ON TABLE symphony.authority_scope_versions IS
  'REM-WP2.6 authority-scope serialization versions; D-16 canonical scope tuples.';

-- Phase 1 authority facts are read-only to serving traffic until the WP2.3
-- registered command path owns every supported capacity/delegation mutation.
-- Frozen facts have no runtime writer; supported-but-not-yet-registered facts
-- are also closed until WP2.3 adds narrowly scoped command-path DML.
DO $wp26_runtime_boundary$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenants', 'users', 'user_role_assignments', 'platform_roles',
    'organization_memberships', 'user_person_links', 'appointments',
    'organizations', 'enrolment_sessions', 'enroller_assignments',
    'institutional_role_assignments', 'ta_scope_delegations',
    'programme_manager_scopes', 'capacity_grants', 'delegations',
    'membership_rules', 'acceptance_policies', 'enforcement_policies',
    'approval_policies', 'retention_policies', 'precedence_policies',
    'duty_matrix_rows'
  ] LOOP
    IF to_regclass(format('symphony.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'REM-WP2.6 expected authority source table symphony.% to exist', table_name;
    END IF;
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE symphony.%I FROM symphony_app',
      table_name
    );
  END LOOP;
END
$wp26_runtime_boundary$;

DO $wp26_privilege_assertion$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tenants', 'users', 'user_role_assignments', 'platform_roles',
    'organization_memberships', 'user_person_links', 'appointments',
    'organizations', 'enrolment_sessions', 'enroller_assignments',
    'institutional_role_assignments', 'ta_scope_delegations',
    'programme_manager_scopes', 'capacity_grants', 'delegations',
    'membership_rules', 'acceptance_policies', 'enforcement_policies',
    'approval_policies', 'retention_policies', 'precedence_policies',
    'duty_matrix_rows'
  ] LOOP
    IF has_table_privilege('symphony_app', format('symphony.%I', table_name), 'INSERT')
       OR has_table_privilege('symphony_app', format('symphony.%I', table_name), 'UPDATE')
       OR has_table_privilege('symphony_app', format('symphony.%I', table_name), 'DELETE')
       OR has_table_privilege('symphony_app', format('symphony.%I', table_name), 'TRUNCATE') THEN
      RAISE EXCEPTION 'REM-WP2.6 runtime role retains DML on frozen authority source symphony.%', table_name;
    END IF;
  END LOOP;
END
$wp26_privilege_assertion$;
