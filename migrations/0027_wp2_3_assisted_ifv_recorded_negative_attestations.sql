-- Keep explicit failed assisted-enrolment attestations representable. A
-- session is authority only when all required facts are true, but recording
-- that one fact was absent must not make the source row itself unpersistable.
ALTER TABLE symphony.enrolment_sessions
  DROP CONSTRAINT enrolment_session_ifv_attestation_ck,
  ADD CONSTRAINT enrolment_session_ifv_attestation_ck CHECK (
    (NOT representative_present AND NOT representative_nrc_sighted
      AND NOT representative_consented_to_act
      AND attestation_recorded_by_user_id IS NULL AND attestation_recorded_at IS NULL)
    OR
    (representative_person_id IS NOT NULL
      AND attestation_recorded_by_user_id = enroller_user_id
      AND attestation_recorded_at IS NOT NULL)
  );

COMMENT ON CONSTRAINT enrolment_session_ifv_attestation_ck ON symphony.enrolment_sessions IS
  'D-20: legacy rows may remain all-false with no attester; any recorded attestation set requires a representative, the session enroller, and a timestamp. Only all-positive facts authorize the assisted IFV exception.';
