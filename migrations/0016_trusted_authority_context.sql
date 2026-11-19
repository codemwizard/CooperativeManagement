-- REM-WP2.2: persisted person, membership and institutional authority facts.
-- The application role may resolve these facts but cannot mutate their sources.

ALTER TABLE symphony.persons
  ADD CONSTRAINT persons_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE symphony.organizations
  ADD COLUMN organization_kind TEXT NOT NULL DEFAULT 'cooperative'
    CHECK (organization_kind IN ('cooperative', 'union', 'federation')),
  ADD CONSTRAINT organizations_id_tenant_key UNIQUE (id, tenant_id);

CREATE TABLE symphony.user_person_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  user_id UUID NOT NULL,
  person_id UUID NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  unlinked_at TIMESTAMPTZ,
  source_ref TEXT NOT NULL,
  linked_by_user_id UUID NOT NULL,
  CONSTRAINT user_person_links_user_tenant_fk
    FOREIGN KEY (user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT user_person_links_person_tenant_fk
    FOREIGN KEY (person_id, tenant_id) REFERENCES symphony.persons(id, tenant_id),
  CONSTRAINT user_person_links_linked_by_tenant_fk
    FOREIGN KEY (linked_by_user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT user_person_links_time_ck CHECK (unlinked_at IS NULL OR unlinked_at > linked_at)
);
CREATE UNIQUE INDEX user_person_links_one_current_account
  ON symphony.user_person_links (tenant_id, user_id) WHERE unlinked_at IS NULL;
CREATE INDEX user_person_links_person_history ON symphony.user_person_links (tenant_id, person_id, linked_at DESC);

CREATE TABLE symphony.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  organization_id UUID NOT NULL,
  person_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'ended')),
  joined_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  source_ref TEXT NOT NULL,
  CONSTRAINT organization_memberships_org_tenant_fk
    FOREIGN KEY (organization_id, tenant_id) REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT organization_memberships_person_tenant_fk
    FOREIGN KEY (person_id, tenant_id) REFERENCES symphony.persons(id, tenant_id),
  CONSTRAINT organization_memberships_time_ck CHECK (ended_at IS NULL OR ended_at > joined_at)
);
CREATE UNIQUE INDEX organization_memberships_one_active_person_org
  ON symphony.organization_memberships (tenant_id, organization_id, person_id)
  WHERE status = 'active' AND ended_at IS NULL;
CREATE INDEX organization_memberships_person_lookup
  ON symphony.organization_memberships (tenant_id, person_id, status, joined_at);

CREATE TABLE symphony.position_catalog (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  organization_kind TEXT NOT NULL DEFAULT 'cooperative'
    CHECK (organization_kind IN ('cooperative', 'union', 'federation')),
  enforce_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO symphony.position_catalog (id, code, display_name, enforce_exclusive) VALUES
 ('00000000-0000-4000-8000-000000000001', 'chairperson', 'Chairperson', TRUE),
 ('00000000-0000-4000-8000-000000000002', 'vice_chairperson', 'Vice-Chairperson', TRUE),
 ('00000000-0000-4000-8000-000000000003', 'secretary', 'Secretary', TRUE),
 ('00000000-0000-4000-8000-000000000004', 'treasurer', 'Treasurer', TRUE),
 ('00000000-0000-4000-8000-000000000005', 'director', 'Director', FALSE),
 ('00000000-0000-4000-8000-000000000006', 'committee_chair', 'Committee Chair', FALSE),
 ('00000000-0000-4000-8000-000000000007', 'committee_member', 'Committee Member', FALSE)
ON CONFLICT (id) DO NOTHING;
-- Preserve any historic appointment IDs that have not yet been mapped. Such
-- records remain non-authorizing until an approved catalogue code is assigned.
INSERT INTO symphony.position_catalog (id, code, display_name, active)
SELECT DISTINCT a.position_id, 'legacy-unmapped-' || a.position_id::text,
       'Unmapped legacy position', FALSE
  FROM symphony.appointments a
 WHERE NOT EXISTS (SELECT 1 FROM symphony.position_catalog p WHERE p.id = a.position_id)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE symphony.appointments
  ADD CONSTRAINT appointments_position_catalog_fk
  FOREIGN KEY (position_id) REFERENCES symphony.position_catalog(id) NOT VALID;
ALTER TABLE symphony.appointments VALIDATE CONSTRAINT appointments_position_catalog_fk;

CREATE TABLE symphony.institutional_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  user_id UUID NOT NULL,
  institution_organization_id UUID NOT NULL,
  role_code TEXT NOT NULL CHECK (role_code IN ('union_ta')),
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  source_ref TEXT NOT NULL,
  CONSTRAINT institutional_role_user_tenant_fk
    FOREIGN KEY (user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT institutional_role_org_tenant_fk
    FOREIGN KEY (institution_organization_id, tenant_id) REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT institutional_role_interval_ck CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT institutional_role_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX institutional_role_current_lookup
  ON symphony.institutional_role_assignments (tenant_id, user_id, role_code, institution_organization_id);

CREATE TABLE symphony.ta_scope_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  programme_manager_user_id UUID NOT NULL,
  union_organization_id UUID NOT NULL,
  delegatee_user_id UUID NOT NULL,
  target_organization_id UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  agreement_ref TEXT NOT NULL,
  CONSTRAINT ta_scope_manager_tenant_fk
    FOREIGN KEY (programme_manager_user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT ta_scope_delegatee_tenant_fk
    FOREIGN KEY (delegatee_user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT ta_scope_union_tenant_fk
    FOREIGN KEY (union_organization_id, tenant_id) REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT ta_scope_target_tenant_fk
    FOREIGN KEY (target_organization_id, tenant_id) REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT ta_scope_interval_ck CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT ta_scope_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX ta_scope_current_user_lookup
  ON symphony.ta_scope_delegations (tenant_id, delegatee_user_id, target_organization_id);

CREATE TABLE symphony.programme_manager_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  programme_manager_user_id UUID NOT NULL,
  target_organization_id UUID NOT NULL,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('projection', 'ta_delegation')),
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  source_ref TEXT NOT NULL,
  CONSTRAINT programme_scope_user_tenant_fk
    FOREIGN KEY (programme_manager_user_id, tenant_id) REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT programme_scope_org_tenant_fk
    FOREIGN KEY (target_organization_id, tenant_id) REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT programme_scope_interval_ck CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT programme_scope_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX programme_manager_scope_current_lookup
  ON symphony.programme_manager_scopes (tenant_id, programme_manager_user_id, scope_kind, target_organization_id);

-- The resolver runs under symphony_app and is read-only. Every tenant table is
-- forced through the same transaction-local tenant context as other adapters.
DO $wp22_rls$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_person_links', 'organization_memberships',
    'institutional_role_assignments', 'ta_scope_delegations', 'programme_manager_scopes'
  ] LOOP
    EXECUTE format('ALTER TABLE symphony.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE symphony.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I_tenant_admission ON symphony.%I FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)', table_name, table_name, current_user);
    EXECUTE format('CREATE POLICY %I_tenant_scope ON symphony.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), '''')) WITH CHECK (tenant_id::text = NULLIF(current_setting(''app.tenant_id'', true), ''''))', table_name, table_name);
    EXECUTE format('GRANT SELECT ON symphony.%I TO symphony_app', table_name);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON symphony.%I FROM symphony_app, PUBLIC', table_name, table_name);
  END LOOP;
END
$wp22_rls$;
GRANT SELECT ON symphony.position_catalog TO symphony_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON symphony.position_catalog FROM symphony_app, PUBLIC;
COMMENT ON TABLE symphony.user_person_links IS
  'WP2.2 auditable authentication-account to human-person link; current links are unique per account and tenant.';
COMMENT ON TABLE symphony.organization_memberships IS
  'WP2.2 person-to-organization membership relationship; not an authentication account or position appointment.';
COMMENT ON TABLE symphony.ta_scope_delegations IS
  'WP2.2 read-side institutional TA delegation facts; writes are deferred to the authorized scope-grant command.';
COMMENT ON TABLE symphony.programme_manager_scopes IS
  'WP2.2 persisted scoped programme-manager authority; universal read projection remains an owner-approved bounded policy.';
