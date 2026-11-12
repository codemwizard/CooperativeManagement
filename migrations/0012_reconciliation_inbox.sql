-- WP1.4: tenant-scoped encrypted inbox for accepted terminal VERSION_CONFLICTs.
-- WP1.5 remains responsible for least-privilege application-role grants.
CREATE TABLE symphony.reconciliation_inbox (
  reconciliation_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  payload_ciphertext BYTEA,
  encryption_key_ref TEXT,
  reason_code TEXT NOT NULL CHECK (reason_code = 'VERSION_CONFLICT'),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('open', 'resolved', 'superseded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  tombstoned_at TIMESTAMPTZ,
  CONSTRAINT reconciliation_inbox_payload_lifecycle_check CHECK (
    (lifecycle = 'open' AND payload_ciphertext IS NOT NULL AND encryption_key_ref IS NOT NULL AND tombstoned_at IS NULL)
    OR
    (lifecycle IN ('resolved', 'superseded') AND (
      (payload_ciphertext IS NOT NULL AND encryption_key_ref IS NOT NULL AND tombstoned_at IS NULL)
      OR (payload_ciphertext IS NULL AND encryption_key_ref IS NULL AND tombstoned_at IS NOT NULL)
    ))
    OR
    (lifecycle = 'expired' AND payload_ciphertext IS NULL AND encryption_key_ref IS NULL AND tombstoned_at IS NOT NULL)
  )
);

CREATE INDEX reconciliation_inbox_tenant_expiry_idx
  ON symphony.reconciliation_inbox (tenant_id, expires_at)
  WHERE lifecycle <> 'expired';

ALTER TABLE symphony.reconciliation_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.reconciliation_inbox FORCE ROW LEVEL SECURITY;

CREATE POLICY reconciliation_inbox_tenant_isolation
  ON symphony.reconciliation_inbox
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

COMMENT ON TABLE symphony.reconciliation_inbox IS
  'WP1.4 encrypted stale-command reconciliation payload and non-identifying lifecycle metadata; WP1.5 grants least-privilege application access.';
