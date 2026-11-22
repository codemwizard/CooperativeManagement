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

DO $repair$
DECLARE
  existing_index oid;
  index_matches boolean := false;
BEGIN
  SELECT index_class.oid,
         index_row.indisunique
           AND index_row.indisvalid
           AND index_row.indisready
           AND index_row.indnatts = 7
           AND index_row.indnkeyatts = 7
           AND access_method.amname = 'btree'
           AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'tenant_id'
           AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'union_organization_id'
           AND pg_get_indexdef(index_row.indexrelid, 3, true) = 'delegatee_user_id'
           AND pg_get_indexdef(index_row.indexrelid, 4, true) = 'target_organization_id'
           AND pg_get_indexdef(index_row.indexrelid, 5, true) = 'active_from'
           AND regexp_replace(
             lower(pg_get_indexdef(index_row.indexrelid, 6, true)),
             '[[:space:]]', '', 'g'
           ) IN (
             'coalesce(expires_at,''infinity''::timestampwithtimezone)',
             'coalesce(expires_at,''infinity''::timestamptz)'
           )
           AND pg_get_indexdef(index_row.indexrelid, 7, true) = 'agreement_ref'
           AND COALESCE(
             regexp_replace(
               lower(pg_get_expr(index_row.indpred, index_row.indrelid)),
               '[[:space:]()]', '', 'g'
             ), ''
           ) = 'revoked_atisnullandnotlegacy_record'
    INTO existing_index, index_matches
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index AS index_row
      ON index_row.indexrelid = index_class.oid
    JOIN pg_catalog.pg_am AS access_method
      ON access_method.oid = index_class.relam
   WHERE index_namespace.nspname = 'symphony'
     AND index_class.relname = 'ta_scope_active_semantic_key'
     AND index_row.indrelid = 'symphony.ta_scope_delegations'::regclass;

  IF existing_index IS NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX ta_scope_active_semantic_key
      ON symphony.ta_scope_delegations (
        tenant_id, union_organization_id, delegatee_user_id,
        target_organization_id, active_from,
        COALESCE(expires_at, ''infinity''::timestamptz), agreement_ref
      ) WHERE revoked_at IS NULL AND NOT legacy_record';
  ELSIF NOT index_matches THEN
    EXECUTE 'DROP INDEX symphony.ta_scope_active_semantic_key';
    EXECUTE 'CREATE UNIQUE INDEX ta_scope_active_semantic_key
      ON symphony.ta_scope_delegations (
        tenant_id, union_organization_id, delegatee_user_id,
        target_organization_id, active_from,
        COALESCE(expires_at, ''infinity''::timestamptz), agreement_ref
      ) WHERE revoked_at IS NULL AND NOT legacy_record';
  END IF;
END
$repair$;
