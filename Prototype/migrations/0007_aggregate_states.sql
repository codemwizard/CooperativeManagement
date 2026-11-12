-- Migration 0007: Aggregate states table
-- Generic state snapshot store for all aggregate types.
-- The PostgresRepository writes state here atomically with domain_events and event_outbox.
-- Optimistic concurrency: version column enforced by conditional UPDATE / INSERT.

CREATE TABLE symphony.aggregate_states (
  id              UUID        NOT NULL,
  tenant_id       UUID        NOT NULL REFERENCES symphony.tenants(id),
  aggregate_type  TEXT        NOT NULL,
  version         BIGINT      NOT NULL DEFAULT 0,
  state           JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Tenant-scoped lookup (also supports cross-tenant isolation check)
CREATE INDEX ON symphony.aggregate_states (tenant_id, id);

