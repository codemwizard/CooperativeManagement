-- REM-WP5.3: persisted opaque sessions and cross-instance login throttling.

CREATE TABLE symphony.auth_sessions (
  token_hash BYTEA PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  csrf_hash BYTEA NOT NULL CHECK (octet_length(csrf_hash) = 32),
  tenant_id UUID,
  user_id UUID,
  device_id TEXT,
  temporary_credential_id UUID,
  forced_change_required BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT auth_sessions_user_tenant_fk FOREIGN KEY(user_id, tenant_id)
    REFERENCES symphony.users(id, tenant_id),
  CONSTRAINT auth_sessions_temporary_credential_fk FOREIGN KEY(temporary_credential_id)
    REFERENCES symphony.temporary_credentials(id),
  CONSTRAINT auth_sessions_identity_shape_ck CHECK (
    (user_id IS NULL AND tenant_id IS NULL AND device_id IS NULL AND temporary_credential_id IS NULL AND NOT forced_change_required)
    OR (user_id IS NOT NULL AND tenant_id IS NOT NULL AND device_id IS NOT NULL)
  ),
  CONSTRAINT auth_sessions_lifetime_ck CHECK (absolute_expires_at = issued_at + INTERVAL '12 hours')
);
CREATE INDEX auth_sessions_user_active_idx ON symphony.auth_sessions(tenant_id, user_id)
  WHERE revoked_at IS NULL AND user_id IS NOT NULL;
ALTER TABLE symphony.auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_sessions_app_access ON symphony.auth_sessions FOR ALL TO symphony_app, CURRENT_USER
  USING (user_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (user_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
CREATE POLICY auth_sessions_tenant_scope ON symphony.auth_sessions AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (user_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (user_id IS NULL OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
REVOKE ALL ON TABLE symphony.auth_sessions FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE symphony.auth_sessions TO symphony_app;

-- RLS-scoped credential tables cannot be searched until a tenant is known. Keep
-- a private UUID-to-tenant index for the SECURITY DEFINER login lookup, rather
-- than granting the API role cross-tenant access to users or credential hashes.
CREATE TABLE symphony.auth_user_tenant_index (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL
);
REVOKE ALL ON TABLE symphony.auth_user_tenant_index FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE symphony.auth_user_tenant_index TO symphony_migrator;

CREATE OR REPLACE FUNCTION symphony.sync_auth_user_tenant_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, symphony
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM symphony.auth_user_tenant_index WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO symphony.auth_user_tenant_index(user_id,tenant_id) VALUES(NEW.id,NEW.tenant_id)
    ON CONFLICT(user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION symphony.sync_auth_user_tenant_index() FROM PUBLIC, symphony_app;
CREATE TRIGGER users_auth_tenant_index_sync
  AFTER INSERT OR UPDATE OF tenant_id OR DELETE ON symphony.users
  FOR EACH ROW EXECUTE FUNCTION symphony.sync_auth_user_tenant_index();

-- The migration role owns users; temporarily remove row filtering only inside
-- this transaction to backfill the private index, then restore forced RLS.
ALTER TABLE symphony.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE symphony.users DISABLE ROW LEVEL SECURITY;
INSERT INTO symphony.auth_user_tenant_index(user_id,tenant_id)
  SELECT id,tenant_id FROM symphony.users ON CONFLICT(user_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id;
ALTER TABLE symphony.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.users FORCE ROW LEVEL SECURITY;

-- Login accepts the shared userId UUID. This narrowly-scoped function resolves
-- its tenant and credential hashes without granting cross-tenant table reads.
CREATE OR REPLACE FUNCTION symphony.lookup_auth_subject(p_user_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  user_status TEXT,
  temporary_credential_id UUID,
  temporary_secret_hash TEXT,
  temporary_expires_at TIMESTAMPTZ,
  password_secret_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, symphony
AS $function$
DECLARE subject_tenant UUID;
BEGIN
  SELECT index_row.tenant_id INTO subject_tenant
    FROM symphony.auth_user_tenant_index index_row WHERE index_row.user_id=p_user_id;
  IF subject_tenant IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.tenant_id',subject_tenant::text,true);
  RETURN QUERY
    SELECT u.tenant_id, u.status, t.id, t.secret_hash, t.expires_at, p.secret_hash
      FROM symphony.users u
      LEFT JOIN LATERAL (
        SELECT tc.id, tc.secret_hash, tc.expires_at
          FROM symphony.temporary_credentials tc
         WHERE tc.tenant_id = u.tenant_id AND tc.user_id = u.id
           AND tc.consumed_at IS NULL AND tc.revoked_at IS NULL
         ORDER BY tc.issued_at DESC LIMIT 1
      ) t ON true
      LEFT JOIN symphony.password_credentials p
        ON p.tenant_id = u.tenant_id AND p.user_id = u.id
     WHERE u.id = p_user_id AND u.status = 'active';
END
$function$;
REVOKE ALL ON FUNCTION symphony.lookup_auth_subject(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION symphony.lookup_auth_subject(UUID) TO symphony_app;
COMMENT ON FUNCTION symphony.lookup_auth_subject(UUID) IS
  'WP5.3 login lookup: returns one active UUID subject credential tuple; does not expose a general cross-tenant users query.';

CREATE OR REPLACE FUNCTION symphony.lookup_auth_session(p_token_hash BYTEA)
RETURNS TABLE (
  token_hash BYTEA, csrf_hash BYTEA, tenant_id UUID, user_id UUID, device_id TEXT,
  temporary_credential_id UUID, forced_change_required BOOLEAN, issued_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ, absolute_expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, symphony
AS $function$
  SELECT s.token_hash,s.csrf_hash,s.tenant_id,s.user_id,s.device_id,s.temporary_credential_id,
         s.forced_change_required,s.issued_at,s.last_activity_at,s.absolute_expires_at,s.revoked_at
    FROM symphony.auth_sessions s WHERE s.token_hash=p_token_hash
$function$;
REVOKE ALL ON FUNCTION symphony.lookup_auth_session(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION symphony.lookup_auth_session(BYTEA) TO symphony_app;

-- Shared global failure/reservation rows contain only keyed HMAC identifiers.
CREATE TABLE symphony.auth_attempt_events (
  attempt_id UUID NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('account', 'trusted_source')),
  identity_hmac BYTEA NOT NULL CHECK (octet_length(identity_hmac) = 32),
  state TEXT NOT NULL CHECK (state IN ('reserved', 'failed')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(attempt_id, dimension),
  UNIQUE(dimension, identity_hmac, attempt_id)
);
CREATE INDEX auth_attempt_events_window_idx
  ON symphony.auth_attempt_events(dimension, identity_hmac, occurred_at DESC);
REVOKE ALL ON TABLE symphony.auth_attempt_events FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE symphony.auth_attempt_events TO symphony_app;
COMMENT ON TABLE symphony.auth_attempt_events IS
  'WP5.3 shared 15-minute account/source failure history and provisional reservations; identities are HMACs, never raw login identifiers or IPs.';
