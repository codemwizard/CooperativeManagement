-- Keep policy names aligned with the WP1.5 table-derived policy manifest.
DROP POLICY IF EXISTS acting_appointment_endings_tenant_admission
  ON symphony.acting_officer_appointment_endings;
DROP POLICY IF EXISTS acting_appointment_endings_tenant_scope
  ON symphony.acting_officer_appointment_endings;
DROP POLICY IF EXISTS acting_officer_appointment_endings_tenant_admission
  ON symphony.acting_officer_appointment_endings;
DROP POLICY IF EXISTS acting_officer_appointment_endings_tenant_scope
  ON symphony.acting_officer_appointment_endings;

DO $acting_ending_policy$
BEGIN
  EXECUTE format(
    'CREATE POLICY acting_officer_appointment_endings_tenant_admission ON symphony.acting_officer_appointment_endings FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)',
    current_user
  );
END
$acting_ending_policy$;

CREATE POLICY acting_officer_appointment_endings_tenant_scope
  ON symphony.acting_officer_appointment_endings
  AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (
    tenant_id::text=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS (SELECT 1 FROM symphony.organizations o
      JOIN symphony.acting_officer_appointments a
        ON a.id=acting_officer_appointment_endings.appointment_id
       AND a.organization_id=acting_officer_appointment_endings.organization_id
       AND a.tenant_id=acting_officer_appointment_endings.tenant_id
      WHERE o.id=acting_officer_appointment_endings.organization_id
        AND o.tenant_id=acting_officer_appointment_endings.tenant_id)
  )
  WITH CHECK (
    tenant_id::text=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS (SELECT 1 FROM symphony.organizations o
      JOIN symphony.acting_officer_appointments a
        ON a.id=acting_officer_appointment_endings.appointment_id
       AND a.organization_id=acting_officer_appointment_endings.organization_id
       AND a.tenant_id=acting_officer_appointment_endings.tenant_id
      WHERE o.id=acting_officer_appointment_endings.organization_id
        AND o.tenant_id=acting_officer_appointment_endings.tenant_id)
  );
