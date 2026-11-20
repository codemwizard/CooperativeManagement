-- WP6.1 / D-18: typed verification outcome and immutable official attribution.
-- Historical free-text findings are intentionally left unclassified (NULL).
-- They must not be promoted to a positive result by inference.

ALTER TABLE symphony.verification_findings
  ADD COLUMN outcome TEXT
    CHECK (outcome IN ('supports_claim', 'does_not_support_claim', 'inconclusive'));

CREATE OR REPLACE FUNCTION symphony.require_typed_verification_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $$
BEGIN
  IF NEW.outcome IS NULL THEN
    RAISE EXCEPTION 'new verification findings require an explicit D-18 outcome';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER verification_findings_require_typed_outcome
  BEFORE INSERT ON symphony.verification_findings
  FOR EACH ROW EXECUTE FUNCTION symphony.require_typed_verification_outcome();

COMMENT ON COLUMN symphony.verification_findings.outcome IS
  'D-18 closed result vocabulary. NULL denotes a legacy/unqualified result and must fail closed.';

-- Public-facing name is recorded in the official appointment source, not copied
-- from login credentials, pseudonym IDs, or the encrypted PII vault.
ALTER TABLE symphony.appointments
  ADD COLUMN public_display_name TEXT
    CHECK (public_display_name IS NULL OR length(btrim(public_display_name)) > 0);

COMMENT ON COLUMN symphony.appointments.public_display_name IS
  'Official public-facing appointment name used for finding-time attribution; legacy appointments may remain NULL.';

CREATE TABLE symphony.verification_finding_attributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id          UUID NOT NULL UNIQUE REFERENCES symphony.verification_findings(id),
  verifier_user_id    UUID NOT NULL REFERENCES symphony.users(id),
  verifier_person_id  UUID NOT NULL REFERENCES symphony.persons(id),
  appointment_id      UUID NOT NULL REFERENCES symphony.appointments(id),
  public_name         TEXT NOT NULL CHECK (length(btrim(public_name)) > 0),
  office_title        TEXT NOT NULL CHECK (length(btrim(office_title)) > 0),
  source_kind         TEXT NOT NULL CHECK (source_kind = 'official_appointment_record'),
  source_ref          TEXT NOT NULL CHECK (length(btrim(source_ref)) > 0),
  captured_at         TIMESTAMPTZ NOT NULL,
  effective_at        TIMESTAMPTZ NOT NULL,
  disclosure_basis    TEXT NOT NULL CHECK (
    disclosure_basis = 'D-18 authorized cooperative-record viewers; public only where the record is classified public and applicable access/fee policy permits'
  ),
  CHECK (effective_at <= captured_at)
);

COMMENT ON TABLE symphony.verification_finding_attributions IS
  'Append-only finding-time verifier attribution snapshot. Public access remains subject to record classification and applicable fee policy.';

CREATE OR REPLACE FUNCTION symphony.validate_verification_finding_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $$
DECLARE
  expected_finding_at TIMESTAMPTZ;
  expected_user_id UUID;
  expected_person_id UUID;
  expected_appointment_id UUID;
  expected_effective_at TIMESTAMPTZ;
  expected_public_name TEXT;
  expected_office_title TEXT;
  expected_source_ref TEXT;
BEGIN
  SELECT f.finding_at, a.assigned_to_user_id, ap.id, ap.person_id, ap.started_at,
         ap.public_display_name, pc.display_name, ap.source_ref
    INTO STRICT expected_finding_at, expected_user_id, expected_appointment_id,
         expected_person_id, expected_effective_at, expected_public_name, expected_office_title,
         expected_source_ref
    FROM symphony.verification_findings f
    JOIN symphony.verification_assignments a
      ON a.id = f.assignment_id AND a.evidence_version_id = f.evidence_version_id
    JOIN symphony.evidence_items i ON i.id = a.evidence_item_id
    JOIN symphony.appointments ap ON ap.id = NEW.appointment_id
      AND ap.organization_id = i.organization_id
    JOIN symphony.position_catalog pc ON pc.id = ap.position_id AND pc.active
    JOIN symphony.user_person_links upl ON upl.user_id = a.assigned_to_user_id
      AND upl.tenant_id = (SELECT o.tenant_id FROM symphony.organizations o WHERE o.id = i.organization_id)
      AND upl.person_id = ap.person_id
      AND upl.linked_at <= f.finding_at
      AND (upl.unlinked_at IS NULL OR upl.unlinked_at > f.finding_at)
   WHERE f.id = NEW.finding_id
     AND a.completed_at IS NOT NULL
     AND a.completed_at <= f.finding_at
     AND ap.started_at <= f.finding_at
     AND (ap.ended_at IS NULL OR ap.ended_at > f.finding_at);

  IF expected_public_name IS NULL OR btrim(expected_public_name) = ''
     OR expected_source_ref IS NULL OR btrim(expected_source_ref) = '' THEN
    RAISE EXCEPTION 'finding attribution requires a named official appointment with a source reference';
  END IF;
  IF NEW.verifier_user_id <> expected_user_id
     OR NEW.appointment_id <> expected_appointment_id
     OR NEW.verifier_person_id <> expected_person_id
     OR NEW.public_name <> expected_public_name
     OR NEW.office_title <> expected_office_title
     OR NEW.source_ref <> expected_source_ref
     OR NEW.captured_at <> expected_finding_at
     OR NEW.effective_at <> expected_effective_at THEN
    RAISE EXCEPTION 'finding attribution snapshot does not match its authoritative appointment record';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION symphony.validate_verification_finding_attribution() IS
  'Validates a one-time finding attribution against the assigned account, linked person, same-organization appointment, public appointment name, and office effective at finding time.';

CREATE TRIGGER verification_finding_attribution_validate
  BEFORE INSERT ON symphony.verification_finding_attributions
  FOR EACH ROW EXECUTE FUNCTION symphony.validate_verification_finding_attribution();

CREATE OR REPLACE FUNCTION symphony.enforce_verification_finding_attribution_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $$
BEGIN
  RAISE EXCEPTION 'verification_finding_attributions is append-only: % is forbidden', TG_OP;
END;
$$;

CREATE TRIGGER verification_finding_attributions_immutability
  BEFORE UPDATE OR DELETE ON symphony.verification_finding_attributions
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_verification_finding_attribution_immutability();

ALTER TABLE symphony.verification_finding_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.verification_finding_attributions FORCE ROW LEVEL SECURITY;

CREATE POLICY verification_finding_attributions_tenant_select
  ON symphony.verification_finding_attributions
  FOR SELECT TO symphony_app
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
  );

CREATE POLICY verification_finding_attributions_tenant_insert
  ON symphony.verification_finding_attributions
  FOR INSERT TO symphony_app
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
  );

GRANT SELECT, INSERT ON TABLE symphony.verification_finding_attributions TO symphony_app;
