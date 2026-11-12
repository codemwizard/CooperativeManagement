-- Migration 0001: Kernel tables
-- Creates the foundational event-sourcing kernel tables.
-- Apply fixes #5 (immutability trigger on domain_events) and #8 (all tables in schema 'symphony').

CREATE SCHEMA IF NOT EXISTS symphony;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenants: top-level organisational boundary
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Command receipts: idempotency store for inbound commands
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.command_receipts (
  command_id        UUID        PRIMARY KEY,
  tenant_id         UUID        NOT NULL REFERENCES symphony.tenants(id),
  actor_user_id     UUID        NOT NULL,
  type              TEXT        NOT NULL,
  payload           JSONB       NOT NULL DEFAULT '{}',
  occurred_at       TIMESTAMPTZ NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id         TEXT,
  expected_version  INT,
  result            JSONB
);

CREATE INDEX ON symphony.command_receipts (tenant_id, occurred_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Domain events: append-only event log
-- Fix #5: immutability trigger prevents UPDATE and DELETE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.domain_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES symphony.tenants(id),
  aggregate_id    UUID        NOT NULL,
  aggregate_type  TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence        BIGINT      NOT NULL
);

CREATE INDEX ON symphony.domain_events (tenant_id, aggregate_id, sequence);
CREATE UNIQUE INDEX ON symphony.domain_events (tenant_id, aggregate_id, sequence);

-- Immutability trigger: domain_events rows are never updated or deleted.
CREATE OR REPLACE FUNCTION symphony.enforce_event_immutability()
  RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  RAISE EXCEPTION
    'domain_events is append-only: % on row % is forbidden',
    TG_OP, OLD.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER domain_events_immutability
  BEFORE UPDATE OR DELETE ON symphony.domain_events
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_event_immutability();

-- ─────────────────────────────────────────────────────────────────────────────
-- Event outbox: transactional outbox for event delivery
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.event_outbox (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES symphony.domain_events(id),
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ
);

CREATE INDEX ON symphony.event_outbox (status, created_at) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- Capability registry: module feature flags
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE symphony.capability_registry (
  module_code  TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'not_implemented'
                           CHECK (status IN ('not_implemented','in_progress','active','deprecated')),
  spec_ref     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

