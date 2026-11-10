-- WP1.2: append-only pre-acceptance authorization observations.
-- Access grants and RLS are intentionally owned by WP1.5.
CREATE TABLE symphony.security_attempts (
  security_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  actor_user_id UUID NOT NULL,
  observed_command_id UUID,
  observed_command_type TEXT,
  denial_code TEXT NOT NULL CHECK (
    denial_code IN (
      'AUTHORIZATION_DENIED',
      'NOT_AUTHORISED_FOR_ORGANISATION',
      'TENANT_MISMATCH',
      'READ_ONLY_ROLE'
    )
  ),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE symphony.security_attempts IS
  'Synthetic test-mode authorization denial observations; actor_user_id is pseudonymous personal data. WP1.5 adds app-role grants and RLS.';
