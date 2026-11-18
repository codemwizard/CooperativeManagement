-- REM-WP5.2: separate, tenant-bound temporary and permanent credential records.
-- This is forward-only; migration 0013 and its verified RLS/grant matrix remain immutable.

CREATE UNIQUE INDEX users_id_tenant_id_uk ON symphony.users (id, tenant_id);

CREATE TABLE symphony.temporary_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  user_id UUID NOT NULL,
  secret_hash TEXT NOT NULL
    CHECK (secret_hash ~ '^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT temporary_credentials_fixed_lifetime_ck
    CHECK (expires_at = issued_at + INTERVAL '72 hours'),
  CONSTRAINT temporary_credentials_terminal_state_ck
    CHECK (consumed_at IS NULL OR revoked_at IS NULL),
  CONSTRAINT temporary_credentials_user_tenant_fk
    FOREIGN KEY (user_id, tenant_id) REFERENCES symphony.users (id, tenant_id)
);

CREATE UNIQUE INDEX temporary_credentials_one_unconsumed_per_user_uk
  ON symphony.temporary_credentials (tenant_id, user_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX temporary_credentials_user_lookup_idx
  ON symphony.temporary_credentials (tenant_id, user_id, issued_at DESC);

CREATE TABLE symphony.password_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  user_id UUID NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL
    CHECK (secret_hash ~ '^\$argon2id\$v=19\$m=[0-9]+,t=[0-9]+,p=[0-9]+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$'),
  hash_version TEXT NOT NULL DEFAULT 'argon2id-v1' CHECK (hash_version = 'argon2id-v1'),
  established_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT password_credentials_user_tenant_fk
    FOREIGN KEY (user_id, tenant_id) REFERENCES symphony.users (id, tenant_id)
);

ALTER TABLE symphony.temporary_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.temporary_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY temporary_credentials_tenant_admission
  ON symphony.temporary_credentials FOR ALL TO symphony_app, CURRENT_USER
  USING (true) WITH CHECK (true);
CREATE POLICY temporary_credentials_tenant_scope
  ON symphony.temporary_credentials AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

ALTER TABLE symphony.password_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.password_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY password_credentials_tenant_admission
  ON symphony.password_credentials FOR ALL TO symphony_app, CURRENT_USER
  USING (true) WITH CHECK (true);
CREATE POLICY password_credentials_tenant_scope
  ON symphony.password_credentials AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));

REVOKE ALL ON TABLE symphony.temporary_credentials, symphony.password_credentials FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT, UPDATE ON TABLE symphony.temporary_credentials, symphony.password_credentials TO symphony_app;

COMMENT ON TABLE symphony.temporary_credentials IS
  'REM-WP5.2 one-time Argon2id temporary credentials; expires exactly 72 hours after server/database issuance and is consumed with password establishment.';
COMMENT ON TABLE symphony.password_credentials IS
  'REM-WP5.2 permanent Argon2id password credentials; separate from temporary issuance and tenant-bound.';
