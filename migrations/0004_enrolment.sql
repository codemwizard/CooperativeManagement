-- Migration 0004: Enrolment tables
-- Creates organisation records, identifiers, enrolment metadata, and handovers.
-- O-20: cooperative registration number is 11 digits numerals only (pattern ^\d{11}$).
-- Apply fix #8 (all tables in schema 'symphony').

-- ─────────────────────────────────────────────────────────────────────────────
-- Organizations: cooperative society or other registerable entity
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES symphony.tenants(id),
  name        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'workspace_created'
              CHECK (status IN (
                'workspace_created',
                'identity_in_progress',
                'authority_pending',
                'handover_offered',
                'handover_accepted',
                'active',
                'cancelled'
              )),
  version     INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.organizations (tenant_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization identifiers: external reference numbers
-- O-20: cooperative registration number type 'registration_number' stores an
--       11-digit numerals-only value. Pattern enforced at application layer;
--       pattern_check column documents the constraint for verifiers.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.organization_identifiers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES symphony.organizations(id),
  identifier_type  TEXT        NOT NULL
                               CHECK (identifier_type IN (
                                 'registration_number', 'zra_tpin', 'other')),
  identifier_value TEXT        NOT NULL,
  pattern_check    TEXT
);

COMMENT ON COLUMN symphony.organization_identifiers.identifier_value IS
  'For identifier_type=''registration_number'': must match ^\d{11}$ (11 numerals, O-20)';
COMMENT ON COLUMN symphony.organization_identifiers.pattern_check IS
  'Regexp pattern for the identifier_value. E.g. ^\d{11}$ for coop registration numbers.';

CREATE INDEX ON symphony.organization_identifiers (organization_id, identifier_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization enrollment: enrolment metadata and policy flags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.organization_enrollment (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                   UUID        NOT NULL REFERENCES symphony.organizations(id),
  enrolment_mode                    TEXT        NOT NULL CHECK (enrolment_mode IN ('self','assisted')),
  initiator_user_id                 UUID        NOT NULL REFERENCES symphony.users(id),
  platform_check_policy_enabled     BOOL        NOT NULL DEFAULT TRUE,
  activation_requires_platform_check BOOL       NOT NULL DEFAULT TRUE,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON symphony.organization_enrollment (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Enrolment handovers: transfer of authority during enrolment
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.enrolment_handovers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES symphony.organizations(id),
  outgoing_user_id    UUID        NOT NULL REFERENCES symphony.users(id),
  incoming_user_id    UUID        NOT NULL REFERENCES symphony.users(id),
  scope               JSONB       NOT NULL DEFAULT '{}',
  unresolved_claims   JSONB       NOT NULL DEFAULT '[]',
  acknowledged_at     TIMESTAMPTZ,
  authority_ref       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.enrolment_handovers (organization_id);

