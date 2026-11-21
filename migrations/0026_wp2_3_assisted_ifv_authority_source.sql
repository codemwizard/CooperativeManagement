-- REM-WP2.3 / D-20: typed, fail-closed source facts for the assisted-enrolment
-- Internal Field Verifier grant exception. Existing untyped JSON attestations
-- remain readable but do not authorize grants; only newly populated typed facts
-- satisfy the resolver.

ALTER TABLE symphony.enrolment_sessions
  ADD COLUMN representative_present boolean NOT NULL DEFAULT false,
  ADD COLUMN representative_nrc_sighted boolean NOT NULL DEFAULT false,
  ADD COLUMN representative_consented_to_act boolean NOT NULL DEFAULT false,
  ADD COLUMN attestation_recorded_by_user_id uuid REFERENCES symphony.users(id),
  ADD COLUMN attestation_recorded_at timestamptz,
  ADD CONSTRAINT enrolment_session_ifv_attestation_ck CHECK (
    (NOT representative_present AND NOT representative_nrc_sighted
      AND NOT representative_consented_to_act
      AND attestation_recorded_by_user_id IS NULL AND attestation_recorded_at IS NULL)
    OR
    (representative_present AND representative_nrc_sighted
      AND representative_consented_to_act
      AND representative_person_id IS NOT NULL
      AND attestation_recorded_by_user_id = enroller_user_id
      AND attestation_recorded_at IS NOT NULL)
  );

ALTER TABLE symphony.capacity_grants
  ADD COLUMN assisted_session_id uuid REFERENCES symphony.enrolment_sessions(id),
  ADD COLUMN representative_person_id uuid REFERENCES symphony.persons(id),
  ADD COLUMN representative_decision text,
  ADD CONSTRAINT capacity_grants_assisted_authority_ck CHECK (
    (assisted_session_id IS NULL AND representative_person_id IS NULL AND representative_decision IS NULL)
    OR
    (capacity_type = 'internal_verifier'
      AND assisted_session_id IS NOT NULL
      AND representative_person_id IS NOT NULL
      AND representative_decision = 'approve_internal_verifier')
  );

COMMENT ON COLUMN symphony.enrolment_sessions.representative_present IS
  'D-20 factual presence attestation for assisted enrolment; false legacy/default values do not authorize writes.';
COMMENT ON COLUMN symphony.enrolment_sessions.representative_nrc_sighted IS
  'D-20 enroller attestation that the representative NRC was sighted; the NRC itself is never stored here.';
COMMENT ON COLUMN symphony.enrolment_sessions.representative_consented_to_act IS
  'D-20 attestation that the representative consented to act; distinct from personal-data processing consent.';
COMMENT ON COLUMN symphony.enrolment_sessions.attestation_recorded_at IS
  'D-20 time the enroller recorded presence, NRC sighting and consent-to-act facts.';
COMMENT ON COLUMN symphony.capacity_grants.assisted_session_id IS
  'D-20 source session for a platform-enroller internal_verifier grant.';
COMMENT ON COLUMN symphony.capacity_grants.representative_decision IS
  'D-20 representative decision recorded by the enroller in the same atomic grant command.';

-- Phase 1 freezes enrolment-session source writes. The policy resolver only
-- needs read access; the command can write the assisted decision on the
-- registered capacity-grant row through its existing narrow INSERT privilege.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON symphony.enrolment_sessions FROM symphony_app;
GRANT SELECT ON symphony.enrolment_sessions TO symphony_app;

REVOKE ALL ON symphony.capacity_grants FROM PUBLIC, symphony_app;
GRANT SELECT ON symphony.capacity_grants TO symphony_app;
GRANT INSERT (id, user_id, organization_id, capacity_type, granted_by_user_id,
              active_from, expires_at, source_ref, source_event_id,
              assisted_session_id, representative_person_id, representative_decision)
  ON symphony.capacity_grants TO symphony_app;
GRANT UPDATE (revoked_at, revoked_event_id, source_event_id)
  ON symphony.capacity_grants TO symphony_app;
REVOKE DELETE, TRUNCATE ON symphony.capacity_grants FROM symphony_app;
