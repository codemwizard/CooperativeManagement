-- Migration 0003: Policy tables
-- Creates policy configuration tables for enforcement, approval, precedence, etc.
-- O-18: default_release_trigger defaults to 'registered_current'.
-- Apply fix #8 (all tables in schema 'symphony').

-- ─────────────────────────────────────────────────────────────────────────────
-- Enforcement policies: advisory/warning/blocking rule modes per organisation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.enforcement_policies (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  rule_code        TEXT        NOT NULL,
  mode             TEXT        NOT NULL CHECK (mode IN ('advisory','warning','blocking')),
  set_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.enforcement_policies (organization_id, rule_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- Duty matrix rows: who must approve what for each record class
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.duty_matrix_rows (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID,
  record_class          TEXT        NOT NULL,
  duty_holder_position  TEXT        NOT NULL,
  approver_type         TEXT        NOT NULL,
  approval_mode         TEXT        NOT NULL,
  approvers_required    INT         NOT NULL DEFAULT 1,
  distinct_actors       BOOL        NOT NULL DEFAULT FALSE,
  official_label        TEXT
);

CREATE INDEX ON symphony.duty_matrix_rows (organization_id, record_class);

-- ─────────────────────────────────────────────────────────────────────────────
-- Approval policies: quorum requirements per record class
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.approval_policies (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL,
  record_class         TEXT        NOT NULL,
  required_approvers   INT         NOT NULL DEFAULT 1,
  distinct_actors      BOOL        NOT NULL DEFAULT FALSE
);

CREATE INDEX ON symphony.approval_policies (organization_id, record_class);

-- ─────────────────────────────────────────────────────────────────────────────
-- Precedence policies: by-law release trigger
-- O-18: DEFAULT is 'registered_current' (Act s.20(2): amendment takes effect
--       only after registration with the Registrar). Configurable to
--       'submitted_to_registrar' per organisation.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.precedence_policies (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID,
  default_release_trigger  TEXT        NOT NULL
                                       DEFAULT 'registered_current'
                                       CHECK (default_release_trigger IN (
                                         'submitted_to_registrar',
                                         'registered_current'
                                       ))
);

CREATE INDEX ON symphony.precedence_policies (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Position combination rules: which officer positions may be combined
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.position_combination_rules (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  position_a_code   TEXT        NOT NULL,
  position_b_code   TEXT        NOT NULL,
  allowed           BOOL        NOT NULL DEFAULT TRUE,
  enforcement_mode  TEXT        NOT NULL DEFAULT 'blocking',
  notes             TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Retention policies: data-category retention periods
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.retention_policies (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category                     TEXT        NOT NULL UNIQUE,
  hold_duration_months              INT         NOT NULL,
  retention_conflict_review_required BOOL       NOT NULL DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity check methods: available methods for identity verification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.identity_check_methods (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  requires_session BOOL        NOT NULL DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Membership rules: organisation-level membership configuration
-- O-21: 'allow_minor_members' defaults to false (seeded in WP-0.5)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.membership_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  rule_type        TEXT        NOT NULL,
  rule_value       JSONB       NOT NULL DEFAULT '{}',
  source_ref       TEXT
);

CREATE INDEX ON symphony.membership_rules (organization_id, rule_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Acceptance policies: minimum assurance class for a destination/audience
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.acceptance_policies (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID,
  audience             TEXT        NOT NULL,
  destination_id       UUID,
  min_assurance_class  TEXT        NOT NULL
);

CREATE INDEX ON symphony.acceptance_policies (organization_id, audience);

