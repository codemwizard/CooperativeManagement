-- Align the new attribution table with the Phase 1 two-policy RLS contract:
-- a permissive operation admission policy plus restrictive tenant scope.
DROP POLICY IF EXISTS verification_finding_attributions_tenant
  ON symphony.verification_finding_attributions;
DROP POLICY IF EXISTS verification_finding_attributions_tenant_select
  ON symphony.verification_finding_attributions;
DROP POLICY IF EXISTS verification_finding_attributions_tenant_insert
  ON symphony.verification_finding_attributions;

DO $attribution_policies$
BEGIN
  EXECUTE format(
    'CREATE POLICY verification_finding_attributions_tenant_admission
       ON symphony.verification_finding_attributions
       FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)',
    current_user
  );
  EXECUTE $policy$
    CREATE POLICY verification_finding_attributions_tenant_scope
      ON symphony.verification_finding_attributions
      AS RESTRICTIVE FOR ALL TO PUBLIC
      USING (
        EXISTS (
          SELECT 1
            FROM symphony.verification_findings f
            JOIN symphony.verification_assignments a
              ON a.id = f.assignment_id AND a.evidence_version_id = f.evidence_version_id
            JOIN symphony.evidence_items i ON i.id = a.evidence_item_id
            JOIN symphony.organizations o ON o.id = i.organization_id
           WHERE f.id = finding_id
             AND o.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
            FROM symphony.verification_findings f
            JOIN symphony.verification_assignments a
              ON a.id = f.assignment_id AND a.evidence_version_id = f.evidence_version_id
            JOIN symphony.evidence_items i ON i.id = a.evidence_item_id
            JOIN symphony.organizations o ON o.id = i.organization_id
           WHERE f.id = finding_id
             AND o.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
        )
      )
  $policy$;
END
$attribution_policies$;

REVOKE ALL ON FUNCTION symphony.require_typed_verification_outcome() FROM PUBLIC, symphony_app, symphony_outbox_writer;
REVOKE ALL ON FUNCTION symphony.validate_verification_finding_attribution() FROM PUBLIC, symphony_app, symphony_outbox_writer;
REVOKE ALL ON FUNCTION symphony.enforce_verification_finding_attribution_immutability() FROM PUBLIC, symphony_app, symphony_outbox_writer;
