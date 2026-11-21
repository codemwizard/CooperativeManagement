-- Complete D-21 source-table alignment with the executable tenant policy
-- manifest: a permissive app/owner admission policy plus restrictive scope.
DROP POLICY IF EXISTS acting_officer_appointments_tenant_scope
  ON symphony.acting_officer_appointments;
DROP POLICY IF EXISTS acting_officer_appointments_tenant_admission
  ON symphony.acting_officer_appointments;

DO $acting_policy$
BEGIN
  EXECUTE format(
    'CREATE POLICY acting_officer_appointments_tenant_admission ON symphony.acting_officer_appointments FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)',
    current_user
  );
END
$acting_policy$;

CREATE POLICY acting_officer_appointments_tenant_scope
  ON symphony.acting_officer_appointments
  AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (
    acting_officer_appointments.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM symphony.organizations o
      WHERE o.id = acting_officer_appointments.organization_id
        AND o.tenant_id = acting_officer_appointments.tenant_id
    )
  )
  WITH CHECK (
    acting_officer_appointments.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM symphony.organizations o
      WHERE o.id = acting_officer_appointments.organization_id
        AND o.tenant_id = acting_officer_appointments.tenant_id
    )
  );

REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_source_owner() FROM PUBLIC, symphony_app;
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_immutability() FROM PUBLIC, symphony_app;
