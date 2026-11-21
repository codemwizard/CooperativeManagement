-- D-22 separates appointment authority from platform data entry and makes
-- early termination an append-only source record. Acting appointments apply
-- to any active cooperative position in position_catalog.

ALTER TABLE symphony.acting_officer_appointments
  ADD COLUMN recorded_by_user_id UUID;

-- Backfill legacy rows with their original appointment decision-maker as the
-- historical recorder. This narrowly scoped migration-only update is the sole
-- exception to source-row immutability; restore the guard in this transaction.
ALTER TABLE symphony.acting_officer_appointments
  DISABLE TRIGGER acting_appointment_immutability;

UPDATE symphony.acting_officer_appointments
   SET recorded_by_user_id=appointed_by_user_id
 WHERE recorded_by_user_id IS NULL;

ALTER TABLE symphony.acting_officer_appointments
  ENABLE TRIGGER acting_appointment_immutability;

ALTER TABLE symphony.acting_officer_appointments
  ALTER COLUMN recorded_by_user_id SET NOT NULL,
  ADD CONSTRAINT acting_appointment_position_fk
    FOREIGN KEY (position_code) REFERENCES symphony.position_catalog(code),
  ADD CONSTRAINT acting_appointment_recorder_tenant_fk
    FOREIGN KEY (recorded_by_user_id,tenant_id) REFERENCES symphony.users(id,tenant_id),
  ADD CONSTRAINT acting_appointment_decider_tenant_fk
    FOREIGN KEY (appointed_by_user_id,tenant_id) REFERENCES symphony.users(id,tenant_id),
  ADD CONSTRAINT acting_appointment_id_org_tenant_key
    UNIQUE (id,organization_id,tenant_id);

ALTER TABLE symphony.acting_officer_appointments
  DROP CONSTRAINT acting_officer_appointments_position_code_check;

CREATE OR REPLACE FUNCTION symphony.enforce_acting_appointment_source_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence_organization uuid;
DECLARE previous_organization uuid;
DECLARE previous_position text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM symphony.organizations o
     JOIN symphony.position_catalog p ON p.code=NEW.position_code
     WHERE o.id=NEW.organization_id AND o.tenant_id=NEW.tenant_id
       AND o.organization_kind='cooperative' AND p.active
       AND p.organization_kind='cooperative'
  ) THEN
    RAISE EXCEPTION 'acting appointment must use an active cooperative office in the same tenant';
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

COMMENT ON COLUMN symphony.acting_officer_appointments.appointed_by_user_id IS
  'Authenticated Chairperson/Vice-chairperson (substantive or valid acting) who made the appointment decision; not the data-entry recorder.';
COMMENT ON COLUMN symphony.acting_officer_appointments.recorded_by_user_id IS
  'Cooperative official who entered the already-authorized decision; this attribution alone grants no appointment authority.';

CREATE TABLE symphony.acting_officer_appointment_endings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES symphony.tenants(id),
  organization_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  ended_by_user_id UUID NOT NULL,
  recorded_by_user_id UUID NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('external_resolution','external_delegation')),
  source_reference TEXT NOT NULL CHECK (length(btrim(source_reference)) > 0),
  source_issuing_body TEXT NOT NULL CHECK (length(btrim(source_issuing_body)) > 0),
  source_date DATE NOT NULL,
  supporting_evidence_version_id UUID NOT NULL REFERENCES symphony.evidence_versions(id),
  source_event_id UUID NOT NULL REFERENCES symphony.domain_events(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT acting_appointment_ending_org_tenant_fk
    FOREIGN KEY (organization_id,tenant_id) REFERENCES symphony.organizations(id,tenant_id),
  CONSTRAINT acting_appointment_ending_appointment_fk
    FOREIGN KEY (appointment_id,organization_id,tenant_id)
    REFERENCES symphony.acting_officer_appointments(id,organization_id,tenant_id),
  CONSTRAINT acting_appointment_ending_decider_tenant_fk
    FOREIGN KEY (ended_by_user_id,tenant_id) REFERENCES symphony.users(id,tenant_id),
  CONSTRAINT acting_appointment_ending_recorder_tenant_fk
    FOREIGN KEY (recorded_by_user_id,tenant_id) REFERENCES symphony.users(id,tenant_id),
  CONSTRAINT acting_appointment_one_ending UNIQUE (appointment_id),
  CONSTRAINT acting_appointment_ending_source_event_unique UNIQUE (source_event_id)
);

CREATE OR REPLACE FUNCTION symphony.enforce_acting_appointment_ending_source_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE appointment_row record;
DECLARE evidence_organization uuid;
BEGIN
  SELECT organization_id, tenant_id, effective_from, effective_to
    INTO appointment_row FROM symphony.acting_officer_appointments WHERE id=NEW.appointment_id;
  IF appointment_row.organization_id IS DISTINCT FROM NEW.organization_id
     OR appointment_row.tenant_id IS DISTINCT FROM NEW.tenant_id
     OR NEW.ended_at < appointment_row.effective_from
     OR NEW.ended_at >= appointment_row.effective_to THEN
    RAISE EXCEPTION 'appointment ending must match its cooperative and effective interval';
  END IF;
  SELECT i.organization_id INTO evidence_organization
    FROM symphony.evidence_versions v
    JOIN symphony.evidence_items i ON i.id=v.evidence_item_id
   WHERE v.id=NEW.supporting_evidence_version_id;
  IF evidence_organization IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'appointment ending supporting evidence belongs to another cooperative';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM symphony.domain_events e
    WHERE e.id=NEW.source_event_id AND e.tenant_id=NEW.tenant_id
      AND e.aggregate_id=NEW.id AND e.aggregate_type='ActingOfficerAppointmentEnding'
      AND e.event_type='ActingOfficerAppointmentEnded') THEN
    RAISE EXCEPTION 'appointment ending event does not bind to its source record';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER acting_appointment_ending_source_owner_guard
  BEFORE INSERT ON symphony.acting_officer_appointment_endings
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_acting_appointment_ending_source_owner();

CREATE OR REPLACE FUNCTION symphony.enforce_acting_appointment_ending_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'acting appointment ending records are append-only';
END $$;

CREATE TRIGGER acting_appointment_ending_immutability
  BEFORE UPDATE OR DELETE ON symphony.acting_officer_appointment_endings
  FOR EACH ROW EXECUTE FUNCTION symphony.enforce_acting_appointment_ending_immutability();

REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_source_owner() FROM PUBLIC,symphony_app;
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_ending_source_owner() FROM PUBLIC,symphony_app;
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_ending_immutability() FROM PUBLIC,symphony_app;

ALTER TABLE symphony.acting_officer_appointment_endings ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.acting_officer_appointment_endings FORCE ROW LEVEL SECURITY;
DO $acting_ending_policy$
BEGIN
  EXECUTE format(
    'CREATE POLICY acting_officer_appointment_endings_tenant_admission ON symphony.acting_officer_appointment_endings FOR ALL TO symphony_app, %I USING (true) WITH CHECK (true)',
    current_user
  );
END
$acting_ending_policy$;
CREATE POLICY acting_officer_appointment_endings_tenant_scope ON symphony.acting_officer_appointment_endings
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

REVOKE ALL ON symphony.acting_officer_appointment_endings FROM PUBLIC,symphony_app;
GRANT SELECT ON symphony.acting_officer_appointment_endings TO symphony_app;
COMMENT ON TABLE symphony.acting_officer_appointment_endings IS
  'Immutable, same-cooperative source record for ending an acting appointment. ended_by_user_id records the authorized decision-maker; recorded_by_user_id records data entry. Serving role is read-only until a D-16 command writer is registered.';
