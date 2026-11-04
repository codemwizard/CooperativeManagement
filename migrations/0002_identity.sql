-- Migration 0002: Identity and access tables
-- Creates users, persons, PII vault, roles, capacity grants, delegations,
-- authentication events, enrolment sessions.
-- Applies fixes #7 (email_normalized unique within tenant only; typed identifiers) and #8 (schema).

-- ─────────────────────────────────────────────────────────────────────────────
-- Users: platform authentication identity
-- Fix #7: email_normalized is unique within tenant, NOT globally unique
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES symphony.tenants(id),
  email             TEXT        NOT NULL,
  email_normalized  TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','active','suspended','deleted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique within tenant only (fix #7: not globally unique)
CREATE UNIQUE INDEX ON symphony.users (tenant_id, email_normalized);
CREATE INDEX ON symphony.users (tenant_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Persons: domain identity shell (no PII columns here)
-- PII lives exclusively in person_pii_vault
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.persons (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES symphony.tenants(id),
  pseudonym_id TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON symphony.persons (tenant_id, pseudonym_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Person identifiers: typed, encrypted government IDs
-- Fix #7: identifier_type is an explicit enum, not a free-text field.
-- NRC for Zambia; 11-digit cooperative registration number stored separately
-- in organization_identifiers.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.person_identifiers (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id               UUID        NOT NULL REFERENCES symphony.persons(id),
  identifier_type         TEXT        NOT NULL
                                      CHECK (identifier_type IN (
                                        'nrc','passport','birth_cert',
                                        'community_attested','none')),
  identifier_encrypted    BYTEA       NOT NULL,
  blind_index             BYTEA       NOT NULL,
  is_primary              BOOL        NOT NULL DEFAULT FALSE,
  previous_identifier_id  UUID        REFERENCES symphony.person_identifiers(id)
);

CREATE INDEX ON symphony.person_identifiers (person_id);
CREATE INDEX ON symphony.person_identifiers (blind_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- Person PII vault: AES-256-GCM encrypted PII fields
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.person_pii_vault (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        UUID        NOT NULL REFERENCES symphony.persons(id),
  field_name       TEXT        NOT NULL,
  encrypted_value  BYTEA       NOT NULL,
  key_ref          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.person_pii_vault (person_id, field_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- Consent records: data processing consent
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.consent_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID        NOT NULL REFERENCES symphony.persons(id),
  purpose       TEXT        NOT NULL,
  lawful_basis  TEXT        NOT NULL
                            CHECK (lawful_basis IN ('consent','legal_obligation','contract')),
  granted_at    TIMESTAMPTZ NOT NULL,
  withdrawn_at  TIMESTAMPTZ,
  evidence_ref  TEXT
);

CREATE INDEX ON symphony.consent_records (person_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Platform roles and assignments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.platform_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE symphony.user_role_assignments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES symphony.users(id),
  platform_role_id  UUID        NOT NULL REFERENCES symphony.platform_roles(id),
  tenant_id         UUID        NOT NULL REFERENCES symphony.tenants(id),
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX ON symphony.user_role_assignments (user_id, tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Capacity grants: operational capacity within an organisation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.capacity_grants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES symphony.users(id),
  organization_id   UUID        NOT NULL,
  capacity_type     TEXT        NOT NULL,
  granted_by_user_id UUID       NOT NULL REFERENCES symphony.users(id),
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  source_event_id   UUID        REFERENCES symphony.domain_events(id)
);

CREATE INDEX ON symphony.capacity_grants (user_id, organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Delegations: temporary scope transfer between users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.delegations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_user_id   UUID        NOT NULL REFERENCES symphony.users(id),
  delegatee_user_id   UUID        NOT NULL REFERENCES symphony.users(id),
  scope               JSONB       NOT NULL DEFAULT '{}',
  organization_id     UUID        NOT NULL,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ
);

CREATE INDEX ON symphony.delegations (delegatee_user_id, organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Authentication events: immutable log of auth attempts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.authentication_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES symphony.users(id),
  method      TEXT        NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result      TEXT        NOT NULL CHECK (result IN ('success','failure','locked')),
  device_id   TEXT
);

CREATE INDEX ON symphony.authentication_events (user_id, occurred_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Enrolment sessions: assisted or self-enrolment journeys
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.enrolment_sessions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID        NOT NULL REFERENCES symphony.tenants(id),
  enroller_user_id         UUID        NOT NULL REFERENCES symphony.users(id),
  organization_id          UUID        NOT NULL,
  representative_person_id UUID        REFERENCES symphony.persons(id),
  presence_attestation     JSONB       NOT NULL DEFAULT '{}',
  started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at                TIMESTAMPTZ
);

CREATE INDEX ON symphony.enrolment_sessions (tenant_id, organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Enroller assignments: scope of an enroller's authority
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.enroller_assignments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enroller_user_id UUID        NOT NULL REFERENCES symphony.users(id),
  scope            JSONB       NOT NULL DEFAULT '{}',
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

