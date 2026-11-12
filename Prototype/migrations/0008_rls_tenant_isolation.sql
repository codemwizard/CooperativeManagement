-- Migration 0008: Row-Level Security for tenant isolation (defence-in-depth)
-- INV-001: tenant isolation is enforced primarily at the application layer
-- (WHERE tenant_id = $tenantId in all queries). RLS here is defence-in-depth only.
--
-- The application code must SET LOCAL app.current_tenant_id = '<uuid>' at the
-- start of every transaction. If not set, all rows are invisible (fail-safe).
--
-- FORCE ROW LEVEL SECURITY ensures the policy applies even to the table owner
-- (symphony role), which is not a superuser.

-- ─── domain_events ────────────────────────────────────────────────────────────
ALTER TABLE symphony.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.domain_events FORCE ROW LEVEL SECURITY;

-- Allow SELECT / UPDATE / DELETE only for rows matching the session tenant
CREATE POLICY domain_events_tenant_isolation
  ON symphony.domain_events
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ─── command_receipts ────────────────────────────────────────────────────────
ALTER TABLE symphony.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.command_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY command_receipts_tenant_isolation
  ON symphony.command_receipts
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- Note: The application queries always include explicit WHERE tenant_id = $1.
-- RLS is a belt-and-suspenders guard only. The symphony user is NOT a superuser.
-- Migrations run as the symphony user; migration transactions must set the tenant
-- context or use a superuser connection. The migrate.ts script is exempt from RLS
-- because it uses SET LOCAL outside of RLS-protected INSERT paths (seed data only).

