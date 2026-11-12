-- Migration 0006b: Governance stub — appointments table
-- Creates the appointments table with a conditional unique index for
-- exclusive positions (fix #6: enforce_exclusive predicate on the unique index).
-- Apply fix #8 (all tables in schema 'symphony').

-- ─────────────────────────────────────────────────────────────────────────────
-- Appointments: officer position holders within an organisation
-- Fix #6: conditional unique index — only enforced when enforce_exclusive = TRUE,
--         allowing non-exclusive positions (committee members, etc.) to coexist.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES symphony.organizations(id),
  person_id        UUID        NOT NULL REFERENCES symphony.persons(id),
  position_id      UUID        NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  source_ref       TEXT,
  enforce_exclusive BOOL       NOT NULL DEFAULT FALSE
);

-- Fix #6: Only one active holder per exclusive position per organisation.
-- Non-exclusive positions (enforce_exclusive = FALSE) are unconstrained.
CREATE UNIQUE INDEX appointments_exclusive_position_uk
  ON symphony.appointments (organization_id, position_id)
  WHERE ended_at IS NULL AND enforce_exclusive = TRUE;

CREATE INDEX ON symphony.appointments (organization_id, position_id, ended_at);
CREATE INDEX ON symphony.appointments (person_id);

