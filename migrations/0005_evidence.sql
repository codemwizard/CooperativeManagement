-- Migration 0005: Evidence tables
-- Creates evidence lifecycle tables with immutability on evidence_versions.
-- Applies fixes #1 (evidence_versions immutability), #2 (remove admitted/rejected
-- from submission_status; admissions live in evidence_admissions), #3 (composite FK
-- on verification_findings), #4 (partial unique index on evidence_disputes), #6.
-- Apply fix #8 (all tables in schema 'symphony').

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence items: a durable evidence record for one piece of evidence
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES symphony.organizations(id),
  track            TEXT        NOT NULL CHECK (track IN ('C','R','X')),
  evidence_type    TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.evidence_items (organization_id, track);

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence versions: append-only versioned submissions
-- Fix #2: submission_status does NOT include 'admitted' or 'rejected'.
--         Those outcomes are recorded in evidence_admissions.
-- Fix #1: immutability trigger prevents UPDATE and DELETE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_versions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id    UUID        NOT NULL REFERENCES symphony.evidence_items(id),
  version_number      INT         NOT NULL,
  supplier_user_id    UUID        NOT NULL REFERENCES symphony.users(id),
  collector_user_id   UUID        REFERENCES symphony.users(id),
  origin              TEXT        NOT NULL,
  stage               TEXT        NOT NULL,
  payload             JSONB       NOT NULL DEFAULT '{}',
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  submission_status   TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (submission_status IN ('pending','withdrawn'))
  -- NOTE: 'admitted' and 'rejected' are intentionally excluded (fix #2).
  --       Admission outcomes are stored in evidence_admissions.
);

CREATE UNIQUE INDEX ON symphony.evidence_versions (evidence_item_id, version_number);
CREATE INDEX ON symphony.evidence_versions (evidence_item_id, submission_status);

-- Immutability trigger: evidence_versions rows are never updated or deleted.
CREATE OR REPLACE FUNCTION symphony.enforce_evidence_version_immutability()
  RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  RAISE EXCEPTION
    'evidence_versions is append-only: % on row % is forbidden',
    TG_OP, OLD.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER evidence_versions_immutability
  BEFORE UPDATE OR DELETE ON symphony.evidence_versions
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_evidence_version_immutability();

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence support items: corroborating material attached to a version
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_support_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  support_type         TEXT        NOT NULL,
  supporter_standing   TEXT,
  supporter_ref        TEXT,
  description          TEXT,
  attached_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON symphony.evidence_support_items (evidence_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence admissions: formal admission/rejection outcome
-- Fix #2: admission outcomes live here, NOT in evidence_versions.submission_status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_admissions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  admitted_by_user_id  UUID        NOT NULL REFERENCES symphony.users(id),
  admission_kind       TEXT        NOT NULL CHECK (admission_kind IN ('claim_admission','duty_submission')),
  admitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                TEXT
);

CREATE INDEX ON symphony.evidence_admissions (evidence_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Record approvals: officer sign-off on a record
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.record_approvals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  approved_by_user_id  UUID        NOT NULL REFERENCES symphony.users(id),
  approval_authority   TEXT        NOT NULL,
  approved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                TEXT
);

CREATE INDEX ON symphony.record_approvals (evidence_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification assignments: assign an evidence item to a verifier
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.verification_assignments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id     UUID        NOT NULL REFERENCES symphony.evidence_items(id),
  assigned_to_user_id  UUID        NOT NULL REFERENCES symphony.users(id),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX ON symphony.verification_assignments (evidence_item_id);
CREATE INDEX ON symphony.verification_assignments (assigned_to_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification findings: outcome of a verification assignment
-- Fix #3: composite FK — finding must reference the same evidence_version that
--         is recorded on the assignment row (enforced at application layer;
--         documented here with a CHECK-compatible design via two separate FKs
--         and a note — full composite FK requires a unique constraint on
--         verification_assignments(id, evidence_version_id)).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE symphony.verification_assignments
  ADD CONSTRAINT verification_assignments_composite_uk
  UNIQUE (id, evidence_version_id);

CREATE TABLE symphony.verification_findings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id        UUID        NOT NULL,
  evidence_version_id  UUID        NOT NULL,
  assurance_class      TEXT        NOT NULL,
  result               TEXT        NOT NULL,
  scope                TEXT,
  limitations          TEXT,
  finding_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Fix #3: composite FK ensures finding references the assignment's version
  FOREIGN KEY (assignment_id, evidence_version_id)
    REFERENCES symphony.verification_assignments (id, evidence_version_id)
);

CREATE INDEX ON symphony.verification_findings (assignment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Platform checks: automated platform-side checks on evidence
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.platform_checks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  checked_by_user_id   UUID        NOT NULL REFERENCES symphony.users(id),
  check_type           TEXT        NOT NULL,
  result               TEXT        NOT NULL,
  scope                TEXT,
  checked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  proxy_entry_flag     BOOL        NOT NULL DEFAULT FALSE
);

CREATE INDEX ON symphony.platform_checks (evidence_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Observation attestations: in-person observation records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.observation_attestations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id   UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  attested_by_user_id   UUID        NOT NULL REFERENCES symphony.users(id),
  observation_statement TEXT        NOT NULL,
  observed_at           TIMESTAMPTZ NOT NULL,
  attested_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence disputes: contested evidence records
-- Fix #4: partial unique index ensures only one open dispute per evidence version.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_disputes (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_version_id  UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  raised_by_user_id    UUID        NOT NULL REFERENCES symphony.users(id),
  reason               TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  raised_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ
);

-- Fix #4: only one open dispute allowed per evidence version at a time
CREATE UNIQUE INDEX evidence_disputes_one_open_per_version
  ON symphony.evidence_disputes (evidence_version_id)
  WHERE status = 'open';

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence relationships: links between evidence versions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_relationships (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id    UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  target_version_id    UUID        NOT NULL REFERENCES symphony.evidence_versions(id),
  relationship_type    TEXT        NOT NULL
);

CREATE INDEX ON symphony.evidence_relationships (source_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence requirement links: which evidence items satisfy which requirements
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.evidence_requirement_links (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id  UUID        NOT NULL REFERENCES symphony.evidence_items(id),
  requirement_id    UUID        NOT NULL
  -- requirement_id references requirement_definitions added in 0006_legal.sql
  -- FK added after 0006 migration to avoid dependency ordering issues
);

CREATE INDEX ON symphony.evidence_requirement_links (evidence_item_id);
CREATE INDEX ON symphony.evidence_requirement_links (requirement_id);

