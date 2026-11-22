-- Keep the uniqueness boundary consistent for databases where the original
-- TA identity migration has already run. Historical rows are retained and
-- excluded; command-created rows keep legacy_record=false and remain unique.
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'symphony'
       AND table_name = 'ta_scope_delegations'
       AND column_name = 'legacy_record'
  ) THEN
    RAISE EXCEPTION 'REM-WP2.3 legacy TA identity repair requires ta_scope_delegations.legacy_record';
  END IF;
END
$preflight$;

DROP INDEX IF EXISTS symphony.ta_scope_active_semantic_key;
CREATE UNIQUE INDEX ta_scope_active_semantic_key
  ON symphony.ta_scope_delegations (
    tenant_id, union_organization_id, delegatee_user_id,
    target_organization_id, active_from,
    COALESCE(expires_at, 'infinity'::timestamptz), agreement_ref
  ) WHERE revoked_at IS NULL AND NOT legacy_record;
