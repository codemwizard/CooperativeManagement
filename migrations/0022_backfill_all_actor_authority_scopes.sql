-- REM-WP2.6 follow-up: actor locks must exist for every persisted account.
-- Migration 0019 covered platform-role assignments only. Cooperative officials
-- can act through appointments without platform roles, so seed all users.

-- Owner visibility is needed for this global bootstrap while forced tenant RLS
-- is temporarily removed. This is transactional migration-only access; FORCE
-- is restored before commit and serving-role policies are unchanged.
ALTER TABLE symphony.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.authority_scope_versions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.capacity_grants NO FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.ta_scope_delegations NO FORCE ROW LEVEL SECURITY;

-- 0021 may already have been applied in an environment before this correction.
-- Make its provenance and duplicate-history treatment consistent without
-- deleting or rewriting historical grants. Rows present at this migration
-- boundary are legacy; subsequently inserted rows retain the false defaults.
ALTER TABLE symphony.capacity_grants
  ADD COLUMN IF NOT EXISTS legacy_record boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_provenance_missing boolean NOT NULL DEFAULT false;
ALTER TABLE symphony.ta_scope_delegations
  ADD COLUMN IF NOT EXISTS legacy_record boolean NOT NULL DEFAULT false;
UPDATE symphony.capacity_grants
   SET legacy_record = true,
       legacy_provenance_missing = capacity_type = 'delegate'
         AND NULLIF(btrim(source_ref), '') IS NULL;
UPDATE symphony.ta_scope_delegations SET legacy_record = true;

ALTER TABLE symphony.capacity_grants
  DROP CONSTRAINT IF EXISTS capacity_grants_source_ref_ck,
  DROP CONSTRAINT IF EXISTS capacity_grants_legacy_provenance_ck,
  ADD CONSTRAINT capacity_grants_source_ref_ck CHECK (
    capacity_type <> 'delegate' OR (source_ref IS NOT NULL AND length(btrim(source_ref)) > 0)
      OR legacy_provenance_missing
  ),
  ADD CONSTRAINT capacity_grants_legacy_provenance_ck CHECK (
    NOT legacy_provenance_missing OR
      (legacy_record AND capacity_type = 'delegate' AND NULLIF(btrim(source_ref), '') IS NULL)
  );
DROP INDEX IF EXISTS symphony.capacity_grants_active_semantic_key;
CREATE UNIQUE INDEX capacity_grants_active_semantic_key
  ON symphony.capacity_grants (
    organization_id, user_id, capacity_type, active_from,
    COALESCE(expires_at, 'infinity'::timestamptz), COALESCE(source_ref, '')
  ) WHERE revoked_at IS NULL AND NOT legacy_record;
DROP INDEX IF EXISTS symphony.ta_scope_active_semantic_key;
CREATE UNIQUE INDEX ta_scope_active_semantic_key
  ON symphony.ta_scope_delegations (
    tenant_id, union_organization_id, delegatee_user_id, target_organization_id,
    active_from, COALESCE(expires_at, 'infinity'::timestamptz), agreement_ref
  ) WHERE revoked_at IS NULL AND NOT legacy_record;

INSERT INTO symphony.authority_scope_versions (scope_type, tenant_id, scope_id)
SELECT 'actor', NULL::uuid, account.id
  FROM symphony.users AS account
ON CONFLICT (scope_type, tenant_id, scope_id) DO NOTHING;

DO $validate_actor_scope_backfill$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM symphony.users AS account
     WHERE NOT EXISTS (
       SELECT 1 FROM symphony.authority_scope_versions AS scope
        WHERE scope.scope_type = 'actor'
          AND scope.tenant_id IS NULL
          AND scope.scope_id = account.id
     )
  ) THEN
    RAISE EXCEPTION 'REM-WP2.6 actor-scope backfill is incomplete';
  END IF;
END
$validate_actor_scope_backfill$;

ALTER TABLE symphony.authority_scope_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.users FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.capacity_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.ta_scope_delegations FORCE ROW LEVEL SECURITY;
