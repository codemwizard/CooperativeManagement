-- Migration 0006: Legal catalogue, by-laws, requirements
-- Creates by-law versioning, legal source catalogue, requirement definitions,
-- meeting rules, and resolution class rules.
-- Apply fix #5 (catalogue tier separate from cooperative scope).
-- Apply fix #8 (all tables in schema 'symphony').

-- ─────────────────────────────────────────────────────────────────────────────
-- Bylaw documents: container for all versions of an organisation's by-laws
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.bylaw_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES symphony.organizations(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON symphony.bylaw_documents (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Bylaw versions: a versioned snapshot of an organisation's by-laws
-- Status lifecycle aligns with O-18 (registered_current is the operative state)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.bylaw_versions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bylaw_document_id   UUID        NOT NULL REFERENCES symphony.bylaw_documents(id),
  version_number      INT         NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN (
                                    'draft',
                                    'proposed',
                                    'adopted_pending_submission',
                                    'submitted_to_registrar',
                                    'registered_current',
                                    'superseded',
                                    'rejected',
                                    'unknown'
                                  )),
  adopted_at         TIMESTAMPTZ,
  submitted_at       TIMESTAMPTZ,
  registered_at      TIMESTAMPTZ,
  superseded_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX ON symphony.bylaw_versions (bylaw_document_id, version_number);
CREATE INDEX ON symphony.bylaw_versions (bylaw_document_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Bylaw provisions: individual clauses within a bylaw version
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.bylaw_provisions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bylaw_version_id     UUID        NOT NULL REFERENCES symphony.bylaw_versions(id),
  section_ref          TEXT        NOT NULL,
  text                 TEXT        NOT NULL,
  confirmed_by_user_id UUID        REFERENCES symphony.users(id),
  confirmed_at         TIMESTAMPTZ
);

CREATE INDEX ON symphony.bylaw_provisions (bylaw_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Legal sources: authenticated legal instruments (statutes, regulations)
-- Seeded in WP-0.5 with ZMB-CSA-1998, ZMB-SI-26-1999, ZMB-CSA-1970.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.legal_sources (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_ref          TEXT        NOT NULL UNIQUE,
  title                   TEXT        NOT NULL,
  instrument_type         TEXT        NOT NULL CHECK (instrument_type IN ('statute','regulations','guidance')),
  legal_validation_status TEXT        NOT NULL DEFAULT 'needs_legal_validation'
                                      CHECK (legal_validation_status IN (
                                        'needs_legal_validation',
                                        'text_checked',
                                        'validated'
                                      )),
  notes                   TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Requirement definitions: legal requirements from catalogue or organisation scope
-- Fix #5: catalogue tier (source_tier='catalogue', cooperative_id IS NULL)
--         is separate from organisation-specific requirements.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.requirement_definitions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tier             TEXT        NOT NULL CHECK (source_tier IN ('catalogue','organization')),
  cooperative_id          UUID        REFERENCES symphony.organizations(id),
  description             TEXT        NOT NULL,
  source_ref              TEXT,
  legal_validation_status TEXT        NOT NULL DEFAULT 'needs_legal_validation'
                                      CHECK (legal_validation_status IN (
                                        'needs_legal_validation',
                                        'text_checked',
                                        'validated'
                                      ))
);

CREATE INDEX ON symphony.requirement_definitions (source_tier);
CREATE INDEX ON symphony.requirement_definitions (cooperative_id);

-- Add deferred FK from evidence_requirement_links now that requirement_definitions exists
ALTER TABLE symphony.evidence_requirement_links
  ADD CONSTRAINT evidence_req_links_requirement_fk
  FOREIGN KEY (requirement_id) REFERENCES symphony.requirement_definitions(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Organization requirements: requirements applied to a specific organisation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.organization_requirements (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID        NOT NULL REFERENCES symphony.organizations(id),
  requirement_definition_id UUID        NOT NULL REFERENCES symphony.requirement_definitions(id),
  source_ref                TEXT,
  dimensions                JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX ON symphony.organization_requirements (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Requirement sources: maps requirements to their legal authority
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.requirement_sources (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    UUID        NOT NULL REFERENCES symphony.requirement_definitions(id),
  legal_source_id   UUID        NOT NULL REFERENCES symphony.legal_sources(id),
  section_ref       TEXT,
  validation_status TEXT        NOT NULL DEFAULT 'needs_legal_validation'
);

CREATE INDEX ON symphony.requirement_sources (requirement_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Meeting rules: quorum, notice, and convening rules for meeting types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.meeting_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  meeting_type     TEXT        NOT NULL,
  rule_type        TEXT        NOT NULL,
  rule_value       JSONB       NOT NULL DEFAULT '{}',
  source_ref       TEXT,
  source_tier      TEXT        NOT NULL DEFAULT 'default'
                               CHECK (source_tier IN ('statute','bylaw','default'))
);

CREATE INDEX ON symphony.meeting_rules (organization_id, meeting_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Resolution class rules: majority and notice requirements per resolution class
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.resolution_class_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID,
  resolution_class TEXT        NOT NULL,
  majority_type    TEXT        NOT NULL,
  notice_days      INT         NOT NULL,
  source_ref       TEXT
);

CREATE INDEX ON symphony.resolution_class_rules (organization_id, resolution_class);

