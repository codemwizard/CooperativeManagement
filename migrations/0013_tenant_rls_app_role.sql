-- WP1.5: complete tenant isolation and least-privilege runtime grants.
-- Cluster roles are provisioned by the environment/bootstrap, never here.

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app') THEN
    RAISE EXCEPTION 'WP1.5 requires the pre-provisioned symphony_app role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'symphony_outbox_writer') THEN
    RAISE EXCEPTION 'WP1.5 requires the pre-provisioned NOLOGIN symphony_outbox_writer role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname = 'symphony_app'
      AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolbypassrls OR r.rolinherit OR NOT r.rolcanlogin)
  ) THEN
    RAISE EXCEPTION 'symphony_app role attributes do not match the restricted runtime contract';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    WHERE m.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
  ) THEN
    RAISE EXCEPTION 'symphony_app has role memberships; remove them before migration 0013';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname = 'symphony_outbox_writer'
      AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolbypassrls OR r.rolinherit OR r.rolcanlogin)
  ) THEN
    RAISE EXCEPTION 'symphony_outbox_writer role attributes do not match the NOLOGIN capability contract';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    WHERE m.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_outbox_writer')
  ) THEN
    RAISE EXCEPTION 'symphony_outbox_writer must not inherit another role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    WHERE m.roleid = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_outbox_writer')
      AND m.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
  ) THEN
    RAISE EXCEPTION 'symphony_app must not be able to SET ROLE to symphony_outbox_writer';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.relnamespace = 'symphony'::regnamespace
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
      AND c.relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'symphony'::regnamespace
      AND p.proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace n
    WHERE n.nspname = 'symphony'
      AND n.nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'symphony_app')
  ) THEN
    RAISE EXCEPTION 'symphony_app must not own schema objects';
  END IF;
END
$preflight$;

-- Remove table, column, sequence, and PUBLIC access before applying explicit grants.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA symphony FROM symphony_app, PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA symphony FROM symphony_app, PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA symphony FROM symphony_app, PUBLIC;
REVOKE CREATE ON SCHEMA symphony FROM symphony_app, symphony_outbox_writer, PUBLIC;
GRANT USAGE ON SCHEMA symphony TO symphony_app, symphony_outbox_writer;

-- Close schema-level FK gaps used by inherited tenant policies. Validation is
-- inside this migration transaction, so orphaned legacy rows abort atomically.
ALTER TABLE symphony.capacity_grants
  ADD CONSTRAINT capacity_grants_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES symphony.organizations(id) NOT VALID;
ALTER TABLE symphony.capacity_grants VALIDATE CONSTRAINT capacity_grants_organization_id_fkey;
ALTER TABLE symphony.delegations
  ADD CONSTRAINT delegations_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES symphony.organizations(id) NOT VALID;
ALTER TABLE symphony.delegations VALIDATE CONSTRAINT delegations_organization_id_fkey;
ALTER TABLE symphony.evidence_versions
  ADD CONSTRAINT evidence_versions_id_evidence_item_key UNIQUE (id, evidence_item_id);
ALTER TABLE symphony.verification_assignments
  ADD CONSTRAINT verification_assignments_version_item_fkey
  FOREIGN KEY (evidence_version_id, evidence_item_id)
  REFERENCES symphony.evidence_versions (id, evidence_item_id) NOT VALID;
ALTER TABLE symphony.verification_assignments VALIDATE CONSTRAINT verification_assignments_version_item_fkey;
ALTER TABLE symphony.person_identifiers
  ADD CONSTRAINT person_identifiers_id_person_key UNIQUE (id, person_id);
ALTER TABLE symphony.person_identifiers
  DROP CONSTRAINT person_identifiers_previous_identifier_id_fkey;
ALTER TABLE symphony.person_identifiers
  ADD CONSTRAINT person_identifiers_previous_identifier_person_fkey
  FOREIGN KEY (previous_identifier_id, person_id)
  REFERENCES symphony.person_identifiers (id, person_id) NOT VALID;
ALTER TABLE symphony.person_identifiers VALIDATE CONSTRAINT person_identifiers_previous_identifier_person_fkey;

DO $revoke_columns$
DECLARE
  relation record;
  column_list text;
BEGIN
  FOR relation IN
    SELECT c.oid, format('%I.%I', n.nspname, c.relname) AS qualified_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'symphony' AND c.relkind IN ('r', 'p')
  LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
      INTO column_list
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = relation.oid AND a.attnum > 0 AND NOT a.attisdropped;
    IF column_list IS NOT NULL THEN
      EXECUTE format('REVOKE ALL (%s) ON TABLE %s FROM symphony_app, PUBLIC', column_list, relation.qualified_name);
    END IF;
  END LOOP;
END
$revoke_columns$;

-- The accepted runtime setting is app.tenant_id. Missing and empty values match no rows.
-- Restrictive policies ensure later permissive additions cannot widen tenant scope.
DO $tenant_policies$
DECLARE
  table_name text;
  tenant_expression text;
  existing_policy record;
BEGIN
  FOR table_name, tenant_expression IN
    SELECT * FROM (VALUES
      ('command_receipts', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('reconciliation_inbox', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('domain_events', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('users', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('persons', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('person_identifiers', 'EXISTS (SELECT 1 FROM symphony.persons p WHERE p.id = person_id AND p.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('person_pii_vault', 'EXISTS (SELECT 1 FROM symphony.persons p WHERE p.id = person_id AND p.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('consent_records', 'EXISTS (SELECT 1 FROM symphony.persons p WHERE p.id = person_id AND p.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('user_role_assignments', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''') AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('capacity_grants', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users g WHERE g.id = granted_by_user_id AND g.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND (source_event_id IS NULL OR EXISTS (SELECT 1 FROM symphony.domain_events e WHERE e.id = source_event_id AND e.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')))'),
      ('delegations', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = delegator_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = delegatee_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('authentication_events', 'EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('enrolment_sessions', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''') AND EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = enroller_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND (representative_person_id IS NULL OR EXISTS (SELECT 1 FROM symphony.persons p WHERE p.id = representative_person_id AND p.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')))'),
      ('approval_policies', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('organizations', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('organization_identifiers', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('organization_enrollment', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = initiator_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('enrolment_handovers', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = outgoing_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = incoming_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_items', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_versions', 'EXISTS (SELECT 1 FROM symphony.evidence_items i JOIN symphony.organizations o ON o.id = i.organization_id WHERE i.id = evidence_item_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = supplier_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND (collector_user_id IS NULL OR EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = collector_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')))'),
      ('evidence_support_items', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_admissions', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = admitted_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('record_approvals', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = approved_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('verification_assignments', 'EXISTS (SELECT 1 FROM symphony.evidence_items i JOIN symphony.organizations o ON o.id = i.organization_id WHERE i.id = evidence_item_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items vi ON vi.id = v.evidence_item_id JOIN symphony.organizations vo ON vo.id = vi.organization_id WHERE v.id = evidence_version_id AND vo.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = assigned_to_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('verification_findings', 'EXISTS (SELECT 1 FROM symphony.verification_assignments a JOIN symphony.evidence_items i ON i.id = a.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE a.id = assignment_id AND a.evidence_version_id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('platform_checks', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = checked_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('observation_attestations', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = attested_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_disputes', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = evidence_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = raised_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_relationships', 'EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = source_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.evidence_versions v JOIN symphony.evidence_items i ON i.id = v.evidence_item_id JOIN symphony.organizations o ON o.id = i.organization_id WHERE v.id = target_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('evidence_requirement_links', 'EXISTS (SELECT 1 FROM symphony.evidence_items i JOIN symphony.organizations o ON o.id = i.organization_id WHERE i.id = evidence_item_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('appointments', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND EXISTS (SELECT 1 FROM symphony.persons p WHERE p.id = person_id AND p.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('bylaw_documents', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('bylaw_versions', 'EXISTS (SELECT 1 FROM symphony.bylaw_documents d JOIN symphony.organizations o ON o.id = d.organization_id WHERE d.id = bylaw_document_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('bylaw_provisions', 'EXISTS (SELECT 1 FROM symphony.bylaw_versions v JOIN symphony.bylaw_documents d ON d.id = v.bylaw_document_id JOIN symphony.organizations o ON o.id = d.organization_id WHERE v.id = bylaw_version_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) AND (confirmed_by_user_id IS NULL OR EXISTS (SELECT 1 FROM symphony.users u WHERE u.id = confirmed_by_user_id AND u.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')))'),
      ('organization_requirements', 'EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id = organization_id AND o.tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))'),
      ('aggregate_states', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')'),
      ('security_attempts', 'tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')')
    ) AS policies(name, expression)
  LOOP
    EXECUTE format('ALTER TABLE symphony.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE symphony.%I FORCE ROW LEVEL SECURITY', table_name);
    FOR existing_policy IN
      SELECT polname FROM pg_catalog.pg_policy
      WHERE polrelid = format('symphony.%I', table_name)::regclass
    LOOP
      EXECUTE format('DROP POLICY %I ON symphony.%I', existing_policy.polname, table_name);
    END LOOP;
    IF table_name = 'security_attempts' THEN
      EXECUTE format('CREATE POLICY %I_tenant_admission ON symphony.%I FOR INSERT TO symphony_app, %I WITH CHECK (true)', table_name, table_name, current_user);
    ELSIF table_name = 'domain_events' THEN
      EXECUTE format('CREATE POLICY %I_tenant_admission ON symphony.%I FOR ALL TO symphony_app, symphony_outbox_writer, %I USING (true) WITH CHECK (true)', table_name, table_name, current_user);
    ELSE
      EXECUTE format('CREATE POLICY %I_tenant_admission ON symphony.%I FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)', table_name, table_name, current_user);
    END IF;
    EXECUTE format('CREATE POLICY %I_tenant_scope ON symphony.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (%s) WITH CHECK (%s)', table_name, table_name, tenant_expression, tenant_expression);
  END LOOP;
END
$tenant_policies$;

-- The only non-table application operation on event_outbox is this constrained insert.
ALTER TABLE symphony.event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.event_outbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_outbox_pending_writer_insert ON symphony.event_outbox;
CREATE POLICY event_outbox_pending_writer_insert
  ON symphony.event_outbox FOR INSERT TO symphony_outbox_writer
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM symphony.domain_events e
      WHERE e.id = event_id
        AND e.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
    )
  );

-- Create and grant the SECURITY DEFINER function while acting as its final
-- owner. This avoids a post-creation ALTER OWNER that depends on migration
-- session ownership state and guarantees the definer is the restricted writer.
GRANT CREATE ON SCHEMA symphony TO symphony_outbox_writer;

CREATE OR REPLACE FUNCTION symphony.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only; % is forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END
$function$;

SET LOCAL ROLE symphony_outbox_writer;
CREATE OR REPLACE FUNCTION symphony.enqueue_command_outbox_message(
  p_outbox_id uuid,
  p_event_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, symphony
AS $function$
DECLARE
  tenant_context text;
BEGIN
  tenant_context := NULLIF(current_setting('app.tenant_id', true), '');
  IF tenant_context IS NULL THEN
    RAISE EXCEPTION 'tenant context is required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM symphony.domain_events e
    WHERE e.id = p_event_id AND e.tenant_id::text = tenant_context
  ) THEN
    RAISE EXCEPTION 'event is not available in the active tenant' USING ERRCODE = '42501';
  END IF;
  INSERT INTO symphony.event_outbox (id, event_id, status)
  VALUES (p_outbox_id, p_event_id, 'pending');
END
$function$;

REVOKE ALL ON FUNCTION symphony.enqueue_command_outbox_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION symphony.enqueue_command_outbox_message(uuid, uuid) TO symphony_app;
COMMENT ON FUNCTION symphony.enqueue_command_outbox_message(uuid, uuid) IS
  'WP1.5 restricted same-transaction command outbox insertion; tenant checked and pending-only.';
RESET ROLE;

DROP TRIGGER IF EXISTS security_attempts_append_only ON symphony.security_attempts;
CREATE TRIGGER security_attempts_append_only
  BEFORE UPDATE OR DELETE ON symphony.security_attempts
  FOR EACH ROW EXECUTE FUNCTION symphony.reject_append_only_mutation();

REVOKE CREATE ON SCHEMA symphony FROM symphony_outbox_writer;
REVOKE ALL ON FUNCTION symphony.reject_append_only_mutation() FROM PUBLIC, symphony_app, symphony_outbox_writer;
GRANT SELECT ON TABLE symphony.domain_events TO symphony_outbox_writer;
GRANT INSERT ON TABLE symphony.event_outbox TO symphony_outbox_writer;

-- Exact runtime-role matrix: no blanket grants and no default privileges.
GRANT SELECT, INSERT ON TABLE symphony.command_receipts TO symphony_app;
GRANT SELECT, INSERT ON TABLE symphony.domain_events TO symphony_app;
GRANT INSERT ON TABLE symphony.security_attempts TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.reconciliation_inbox TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.aggregate_states TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.users TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.persons TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.person_identifiers TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.person_pii_vault TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.consent_records TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.user_role_assignments TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.capacity_grants TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.delegations TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.authentication_events TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.enrolment_sessions TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.approval_policies TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.organizations TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.organization_identifiers TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.organization_enrollment TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.enrolment_handovers TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_items TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_versions TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_support_items TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_admissions TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.record_approvals TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.verification_assignments TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.verification_findings TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.platform_checks TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.observation_attestations TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_disputes TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_relationships TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.evidence_requirement_links TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.appointments TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.bylaw_documents TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.bylaw_versions TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.bylaw_provisions TO symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.organization_requirements TO symphony_app;

GRANT SELECT ON TABLE symphony.capability_registry TO symphony_app;
GRANT SELECT ON TABLE symphony.platform_roles TO symphony_app;
GRANT SELECT ON TABLE symphony.identity_check_methods TO symphony_app;
