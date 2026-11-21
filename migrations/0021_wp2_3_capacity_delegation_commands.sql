-- REM-WP2.3: activate the narrowly registered capacity and TA-delegation writers.
-- All existing rows are retained; effective starts are backfilled from their
-- historical granted_at values before the columns become mandatory.

ALTER TABLE symphony.capacity_grants
  ADD COLUMN active_from timestamptz,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN source_ref text,
  ADD COLUMN revoked_event_id uuid REFERENCES symphony.domain_events(id)
    DEFERRABLE INITIALLY DEFERRED;
UPDATE symphony.capacity_grants SET active_from = granted_at WHERE active_from IS NULL;
ALTER TABLE symphony.capacity_grants
  ALTER COLUMN granted_at SET DEFAULT transaction_timestamp(),
  ALTER COLUMN active_from SET NOT NULL,
  ADD CONSTRAINT capacity_grants_interval_ck CHECK (expires_at IS NULL OR expires_at > active_from),
  ADD CONSTRAINT capacity_grants_source_ref_ck CHECK (
    capacity_type <> 'delegate' OR (source_ref IS NOT NULL AND length(btrim(source_ref)) > 0)
  );
CREATE UNIQUE INDEX capacity_grants_active_semantic_key
  ON symphony.capacity_grants (
    organization_id, user_id, capacity_type, active_from,
    COALESCE(expires_at, 'infinity'::timestamptz), COALESCE(source_ref, '')
  ) WHERE revoked_at IS NULL;
CREATE INDEX capacity_grants_active_authority_lookup
  ON symphony.capacity_grants (organization_id, user_id, capacity_type, active_from, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE symphony.ta_scope_delegations
  ADD COLUMN active_from timestamptz,
  ADD COLUMN source_event_id uuid REFERENCES symphony.domain_events(id),
  ADD COLUMN revoked_event_id uuid REFERENCES symphony.domain_events(id);
UPDATE symphony.ta_scope_delegations SET active_from = granted_at WHERE active_from IS NULL;
ALTER TABLE symphony.ta_scope_delegations
  ALTER COLUMN granted_at SET DEFAULT transaction_timestamp(),
  ALTER COLUMN active_from SET NOT NULL,
  ADD CONSTRAINT ta_scope_active_interval_ck CHECK (expires_at IS NULL OR expires_at > active_from),
  ADD CONSTRAINT ta_scope_agreement_ref_ck CHECK (length(btrim(agreement_ref)) > 0);
CREATE UNIQUE INDEX ta_scope_active_semantic_key
  ON symphony.ta_scope_delegations (
    tenant_id, union_organization_id,
    delegatee_user_id, target_organization_id, active_from,
    COALESCE(expires_at, 'infinity'::timestamptz), agreement_ref
  ) WHERE revoked_at IS NULL;

-- Existing tenant RLS continues to bind all operations to app.tenant_id.
-- Revoke the old table-level blanket and grant only command-path columns.
REVOKE ALL ON symphony.capacity_grants FROM PUBLIC, symphony_app;
GRANT SELECT ON symphony.capacity_grants TO symphony_app;
GRANT INSERT (id, user_id, organization_id, capacity_type, granted_by_user_id,
              active_from, expires_at, source_ref, source_event_id)
  ON symphony.capacity_grants TO symphony_app;
GRANT UPDATE (revoked_at, revoked_event_id)
  ON symphony.capacity_grants TO symphony_app;
REVOKE DELETE, TRUNCATE ON symphony.capacity_grants FROM symphony_app;

REVOKE ALL ON symphony.ta_scope_delegations FROM PUBLIC, symphony_app;
GRANT SELECT ON symphony.ta_scope_delegations TO symphony_app;
GRANT INSERT (id, tenant_id, programme_manager_user_id, union_organization_id,
              delegatee_user_id, target_organization_id, active_from,
              expires_at, agreement_ref, source_event_id)
  ON symphony.ta_scope_delegations TO symphony_app;
GRANT UPDATE (revoked_at, revoked_event_id)
  ON symphony.ta_scope_delegations TO symphony_app;
REVOKE DELETE, TRUNCATE ON symphony.ta_scope_delegations FROM symphony_app;

COMMENT ON COLUMN symphony.capacity_grants.active_from IS
  'D-19 effective start of the half-open [active_from, expires_at) capacity interval.';
COMMENT ON COLUMN symphony.capacity_grants.source_ref IS
  'Documentary provenance reference; required for delegate capacity. It is not proof of an external record’s legal validity.';
COMMENT ON COLUMN symphony.ta_scope_delegations.active_from IS
  'D-19 effective start of the half-open [active_from, expires_at) TA interval.';
