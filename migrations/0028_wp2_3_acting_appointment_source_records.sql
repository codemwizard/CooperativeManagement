-- D-21: source-backed acting appointments are separate from substantive
-- appointments. This migration adds the immutable authority source and read
-- path. Runtime mutation grants wait for the D-22 actor-policy ruling.
CREATE TABLE symphony.acting_officer_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  organization_id UUID NOT NULL,
  person_id UUID NOT NULL,
  appointment_kind TEXT NOT NULL DEFAULT 'acting' CHECK (appointment_kind = 'acting'),
  position_code TEXT NOT NULL CHECK (position_code IN ('chairperson','vice_chairperson')),
  appointed_by_user_id UUID NOT NULL REFERENCES symphony.users(id),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('external_resolution','external_delegation')),
  source_reference TEXT NOT NULL CHECK (length(btrim(source_reference)) > 0),
  source_issuing_body TEXT NOT NULL CHECK (length(btrim(source_issuing_body)) > 0),
  source_date DATE NOT NULL,
  supporting_evidence_version_id UUID NOT NULL REFERENCES symphony.evidence_versions(id),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ NOT NULL,
  supersedes_appointment_id UUID REFERENCES symphony.acting_officer_appointments(id),
  source_event_id UUID REFERENCES symphony.domain_events(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT acting_appointment_interval_ck CHECK (effective_to > effective_from),
  CONSTRAINT acting_appointment_org_tenant_fk FOREIGN KEY (organization_id, tenant_id)
    REFERENCES symphony.organizations(id, tenant_id),
  CONSTRAINT acting_appointment_person_tenant_fk FOREIGN KEY (person_id, tenant_id)
    REFERENCES symphony.persons(id, tenant_id)
);

CREATE INDEX acting_appointment_current_lookup
  ON symphony.acting_officer_appointments (tenant_id, organization_id, person_id, position_code, effective_from, effective_to);
CREATE INDEX acting_appointment_supersedes_lookup
  ON symphony.acting_officer_appointments (supersedes_appointment_id)
  WHERE supersedes_appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION symphony.enforce_acting_appointment_source_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence_organization uuid;
DECLARE previous_organization uuid;
DECLARE previous_position text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM symphony.organizations o
     WHERE o.id=NEW.organization_id AND o.tenant_id=NEW.tenant_id
       AND o.organization_kind='cooperative'
  ) THEN
    RAISE EXCEPTION 'acting appointment target is not a same-tenant cooperative';
  END IF;
  SELECT i.organization_id INTO evidence_organization
    FROM symphony.evidence_versions v
    JOIN symphony.evidence_items i ON i.id=v.evidence_item_id
   WHERE v.id=NEW.supporting_evidence_version_id;
  IF evidence_organization IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'acting appointment supporting evidence belongs to another cooperative';
  END IF;
  IF NEW.supersedes_appointment_id IS NOT NULL THEN
    SELECT organization_id, position_code INTO previous_organization, previous_position
      FROM symphony.acting_officer_appointments WHERE id=NEW.supersedes_appointment_id;
    IF previous_organization IS DISTINCT FROM NEW.organization_id
       OR previous_position IS DISTINCT FROM NEW.position_code THEN
      RAISE EXCEPTION 'acting appointment supersession must preserve cooperative and office';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER acting_appointment_source_owner_guard
  BEFORE INSERT ON symphony.acting_officer_appointments
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_acting_appointment_source_owner();

CREATE OR REPLACE FUNCTION symphony.enforce_acting_appointment_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'acting appointment source records are append-only';
  END IF;
  IF OLD.source_event_id IS NULL AND NEW.source_event_id IS NOT NULL
     AND (to_jsonb(NEW) - 'source_event_id') = (to_jsonb(OLD) - 'source_event_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'acting appointment source records are immutable';
END $$;

CREATE TRIGGER acting_appointment_immutability
  BEFORE UPDATE OR DELETE ON symphony.acting_officer_appointments
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_acting_appointment_immutability();

REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_source_owner() FROM PUBLIC, symphony_app;
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_immutability() FROM PUBLIC, symphony_app;

ALTER TABLE symphony.acting_officer_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.acting_officer_appointments FORCE ROW LEVEL SECURITY;
DO $acting_policy$
BEGIN
  EXECUTE format(
    'CREATE POLICY acting_officer_appointments_tenant_admission ON symphony.acting_officer_appointments FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)',
    current_user
  );
END
$acting_policy$;
CREATE POLICY acting_officer_appointments_tenant_scope ON symphony.acting_officer_appointments
  AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (
    tenant_id::text=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id=acting_officer_appointments.organization_id AND o.tenant_id=acting_officer_appointments.tenant_id)
  )
  WITH CHECK (
    tenant_id::text=NULLIF(current_setting('app.tenant_id',true),'')
    AND EXISTS (SELECT 1 FROM symphony.organizations o WHERE o.id=acting_officer_appointments.organization_id AND o.tenant_id=acting_officer_appointments.tenant_id)
  );

REVOKE ALL ON symphony.acting_officer_appointments FROM PUBLIC, symphony_app;
GRANT SELECT ON symphony.acting_officer_appointments TO symphony_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON symphony.acting_officer_appointments FROM symphony_app;

COMMENT ON TABLE symphony.acting_officer_appointments IS
  'D-21 separate acting-office source record. Read-only to serving role until D-22 authorizes a locked, audited appointment command.';
COMMENT ON COLUMN symphony.acting_officer_appointments.supporting_evidence_version_id IS
  'Exact immutable evidence version for the external resolution/delegation; a trigger binds it to the same cooperative.';
