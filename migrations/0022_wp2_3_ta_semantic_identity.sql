-- A semantically identical TA grant is one cooperative authority, regardless
-- of which currently authorized Programme Manager submitted the repeat.
DROP INDEX symphony.ta_scope_active_semantic_key;
CREATE UNIQUE INDEX ta_scope_active_semantic_key
  ON symphony.ta_scope_delegations (
    tenant_id, union_organization_id, delegatee_user_id,
    target_organization_id, active_from,
    COALESCE(expires_at, 'infinity'::timestamptz), agreement_ref
  ) WHERE revoked_at IS NULL AND NOT legacy_record;
