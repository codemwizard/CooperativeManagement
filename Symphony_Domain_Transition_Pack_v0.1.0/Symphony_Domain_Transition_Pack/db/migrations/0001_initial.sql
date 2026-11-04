BEGIN;
CREATE SCHEMA IF NOT EXISTS symphony;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE symphony.tenants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE symphony.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, email_normalized text UNIQUE, status text NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended','closed')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE symphony.external_identities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES symphony.users(id), provider text NOT NULL, provider_subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_subject));
CREATE TABLE symphony.tenant_memberships(tenant_id uuid NOT NULL REFERENCES symphony.tenants(id), user_id uuid NOT NULL REFERENCES symphony.users(id), platform_role text NOT NULL, scope jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended','revoked')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,user_id));
CREATE TABLE symphony.cooperatives(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES symphony.tenants(id), name text NOT NULL, registration_number text, district text, province text,
 lifecycle_projection text NOT NULL DEFAULT 'provisional' CHECK(lifecycle_projection IN ('provisional','identified','governance_configured','operationally_activated')),
 aggregate_version bigint NOT NULL DEFAULT 0 CHECK(aggregate_version>=0), created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,registration_number));
CREATE TABLE symphony.enrollments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL,
 enrollment_mode text NOT NULL CHECK(enrollment_mode IN ('self_enrollment','platform_assisted')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','identity_review','handover_pending','active','withdrawn','rejected')),
 initiated_by uuid NOT NULL REFERENCES symphony.users(id), submitted_at timestamptz, activated_at timestamptz, version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.source_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('legislation','regulation','registered_bylaw','resolution','policy','procedure','platform_policy','other')),
 title text NOT NULL, issuer text, issued_on date, effective_from date, effective_to date, storage_key text, content_sha256 text, source_status text NOT NULL DEFAULT 'captured',
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.bylaw_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, source_document_id uuid NOT NULL,
 version_label text, status text NOT NULL DEFAULT 'captured', adopted_on date, registered_on date, effective_from date, effective_to date,
 supersedes_id uuid REFERENCES symphony.bylaw_versions(id), interpretation_status text NOT NULL DEFAULT 'unreviewed' CHECK(interpretation_status IN ('unreviewed','in_review','reviewed','disputed')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,source_document_id) REFERENCES symphony.source_documents(tenant_id,id));
CREATE TABLE symphony.bylaw_provisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, bylaw_version_id uuid NOT NULL,
 clause_ref text NOT NULL, heading text, extracted_text text NOT NULL, interpretation text, extraction_method text NOT NULL DEFAULT 'manual',
 confidence numeric(5,4) CHECK(confidence BETWEEN 0 AND 1), review_status text NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN ('unreviewed','confirmed_transcription','confirmed_interpretation','disputed')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,bylaw_version_id) REFERENCES symphony.bylaw_versions(tenant_id,id));
CREATE TABLE symphony.requirements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, code text NOT NULL, title text NOT NULL, description text,
 source_kind text NOT NULL, source_document_id uuid, bylaw_provision_id uuid, source_reference text, rule_version integer NOT NULL DEFAULT 1,
 applicability_rule jsonb NOT NULL DEFAULT '{}'::jsonb, evaluation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
 enforcement_mode text NOT NULL DEFAULT 'advisory' CHECK(enforcement_mode IN ('advisory','warning','blocking')), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,cooperative_id,code,rule_version),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,source_document_id) REFERENCES symphony.source_documents(tenant_id,id),
 FOREIGN KEY(tenant_id,bylaw_provision_id) REFERENCES symphony.bylaw_provisions(tenant_id,id));
CREATE TABLE symphony.governance_profiles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, bylaw_version_id uuid,
 source_basis text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','configured','superseded','disputed')),
 effective_from date, effective_to date, interpretation_notes text, created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,bylaw_version_id) REFERENCES symphony.bylaw_versions(tenant_id,id));
CREATE TABLE symphony.governance_bodies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, profile_id uuid NOT NULL, code text NOT NULL, name text NOT NULL,
 body_kind text NOT NULL CHECK(body_kind IN ('board','committee','general_meeting','other')), composition_rule jsonb NOT NULL DEFAULT '{}'::jsonb, source_reference text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(profile_id,code),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES symphony.governance_profiles(tenant_id,id));
CREATE TABLE symphony.governance_positions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, body_id uuid NOT NULL, code text NOT NULL, title text NOT NULL,
 requirement_mode text NOT NULL CHECK(requirement_mode IN ('required','optional','conditional','not_provided_for','unknown')),
 is_exclusive boolean NOT NULL DEFAULT true, may_be_combined boolean NOT NULL DEFAULT false, term_rule jsonb NOT NULL DEFAULT '{}'::jsonb, authority_rule jsonb NOT NULL DEFAULT '{}'::jsonb, source_reference text, active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id), UNIQUE(body_id,code),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,body_id) REFERENCES symphony.governance_bodies(tenant_id,id));
CREATE TABLE symphony.people(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, display_name text NOT NULL,
 identity_status text NOT NULL DEFAULT 'unverified' CHECK(identity_status IN ('unverified','asserted','verified','disputed','merged')),
 contact_details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, person_id uuid NOT NULL, membership_number text, membership_class text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended','ceased','disputed')), valid_from date, valid_to date, source_reference text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES symphony.people(tenant_id,id));
CREATE TABLE symphony.meetings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, body_id uuid NOT NULL, meeting_type text NOT NULL,
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','convened','held','minutes_draft','minutes_submitted','minutes_reviewed','minutes_approved','cancelled','disputed')),
 scheduled_at timestamptz, held_at timestamptz, quorum_rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, quorum_result jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,body_id) REFERENCES symphony.governance_bodies(tenant_id,id));
CREATE TABLE symphony.meeting_attendance(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, meeting_id uuid NOT NULL, person_id uuid NOT NULL,
 attendance_status text NOT NULL CHECK(attendance_status IN ('present','absent','apology','proxy','remote')), source_reference text, recorded_by uuid NOT NULL REFERENCES symphony.users(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(meeting_id,person_id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,meeting_id) REFERENCES symphony.meetings(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES symphony.people(tenant_id,id));
CREATE TABLE symphony.minutes_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, meeting_id uuid NOT NULL, version_no integer NOT NULL CHECK(version_no>0),
 content text NOT NULL, content_sha256 text, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','reviewed','approved','rejected','superseded')),
 submitted_by uuid NOT NULL REFERENCES symphony.users(id), submitted_at timestamptz NOT NULL DEFAULT now(), approved_by uuid REFERENCES symphony.users(id), approved_at timestamptz, approval_authority_ref text, supersedes_id uuid REFERENCES symphony.minutes_versions(id),
 UNIQUE(meeting_id,version_no), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,meeting_id) REFERENCES symphony.meetings(tenant_id,id));
CREATE TABLE symphony.resolutions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, meeting_id uuid, minutes_version_id uuid, resolution_ref text,
 title text NOT NULL, decision_text text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','proposed','adopted','effective','rejected','rescinded','superseded','disputed')),
 adopted_on date, effective_on date, external_condition jsonb NOT NULL DEFAULT '{}'::jsonb, source_reference text, created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,meeting_id) REFERENCES symphony.meetings(tenant_id,id),
 FOREIGN KEY(tenant_id,minutes_version_id) REFERENCES symphony.minutes_versions(tenant_id,id));
CREATE TABLE symphony.appointments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, position_id uuid NOT NULL, person_id uuid NOT NULL, resolution_id uuid,
 authority_source_kind text NOT NULL, authority_source_ref text NOT NULL, position_exclusive boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','pending_confirmation','active','suspended','expired','terminated','disputed','superseded')),
 valid_from date NOT NULL, valid_to date, accepted_at timestamptz, created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 CHECK(valid_to IS NULL OR valid_to>=valid_from),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,position_id) REFERENCES symphony.governance_positions(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES symphony.people(tenant_id,id),
 FOREIGN KEY(tenant_id,resolution_id) REFERENCES symphony.resolutions(tenant_id,id));
ALTER TABLE symphony.appointments ADD CONSTRAINT appointments_no_overlap EXCLUDE USING gist
 (position_id WITH =, daterange(valid_from, COALESCE(valid_to+1,'infinity'::date),'[)') WITH &&)
 WHERE(status='active' AND position_exclusive) DEFERRABLE INITIALLY IMMEDIATE;
CREATE TABLE symphony.authority_grants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES symphony.users(id), appointment_id uuid,
 authority_code text NOT NULL, source_kind text NOT NULL, source_ref text NOT NULL, valid_from timestamptz NOT NULL, valid_to timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 CHECK(valid_to IS NULL OR valid_to>valid_from),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,appointment_id) REFERENCES symphony.appointments(tenant_id,id));
CREATE TABLE symphony.evidence_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, evidence_type text NOT NULL, subject_type text NOT NULL, subject_id uuid, description text,
 current_version_id uuid, created_by uuid NOT NULL REFERENCES symphony.users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(cooperative_id,evidence_type,subject_type,subject_id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.evidence_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, evidence_item_id uuid NOT NULL, version_no integer NOT NULL CHECK(version_no>0),
 submission_status text NOT NULL DEFAULT 'submitted' CHECK(submission_status IN ('draft','submitted','admitted','rejected')),
 provenance_kind text NOT NULL CHECK(provenance_kind IN ('self_declared','field_agent_assisted','cooperative_supplied','external_source','platform_checked','independent_verifier')),
 supplied_by uuid NOT NULL REFERENCES symphony.users(id), supplied_at timestamptz NOT NULL DEFAULT now(), observation_date date, valid_until date, limitation text, content jsonb NOT NULL DEFAULT '{}'::jsonb, storage_key text, content_sha256 text, fingerprint_sha256 text, supersedes_id uuid REFERENCES symphony.evidence_versions(id),
 UNIQUE(evidence_item_id,version_no), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_item_id) REFERENCES symphony.evidence_items(tenant_id,id));
ALTER TABLE symphony.evidence_items ADD CONSTRAINT evidence_current_version_fk FOREIGN KEY(tenant_id,current_version_id) REFERENCES symphony.evidence_versions(tenant_id,id);
CREATE TABLE symphony.evidence_admissions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, evidence_version_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('accepted','requires_independent_query','rejected')), admitted_by uuid NOT NULL REFERENCES symphony.users(id), admitted_at timestamptz NOT NULL DEFAULT now(), rationale text, UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_version_id) REFERENCES symphony.evidence_versions(tenant_id,id));
CREATE TABLE symphony.verification_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, evidence_version_id uuid NOT NULL, assigned_to uuid NOT NULL REFERENCES symphony.users(id), assigned_by uuid NOT NULL REFERENCES symphony.users(id), scope text NOT NULL, method jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','completed','cancelled','superseded_target')), assigned_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_version_id) REFERENCES symphony.evidence_versions(tenant_id,id));
CREATE TABLE symphony.verification_findings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, assignment_id uuid NOT NULL, evidence_version_id uuid NOT NULL, result text NOT NULL CHECK(result IN ('verified_conformant','verified_with_qualifications','non_conformant','inconclusive','not_verified','unable_to_determine')),
 scope text NOT NULL, basis jsonb NOT NULL DEFAULT '[]'::jsonb, limitation text, qualifications jsonb NOT NULL DEFAULT '[]'::jsonb, verifier_id uuid NOT NULL REFERENCES symphony.users(id), recorded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES symphony.verification_assignments(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_version_id) REFERENCES symphony.evidence_versions(tenant_id,id));
CREATE TABLE symphony.evidence_disputes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, evidence_version_id uuid NOT NULL, raised_by uuid NOT NULL REFERENCES symphony.users(id), reason_code text NOT NULL, note text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','resolved','withdrawn')), resolution_method text, resolved_by uuid REFERENCES symphony.users(id), resolved_at timestamptz, resolution_note text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,evidence_version_id) REFERENCES symphony.evidence_versions(tenant_id,id));
CREATE TABLE symphony.validation_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, rule_set_version text NOT NULL, evaluated_at timestamptz NOT NULL DEFAULT now(), evaluated_by uuid REFERENCES symphony.users(id), subject_snapshot jsonb NOT NULL, source_snapshot jsonb NOT NULL, summary jsonb NOT NULL DEFAULT '{}'::jsonb, UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.validation_results(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, validation_run_id uuid NOT NULL, requirement_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('not_applicable','unresolved','satisfied','assessment_time','exception')), explanation text NOT NULL, evidence_version_ids uuid[] NOT NULL DEFAULT '{}', result_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,validation_run_id) REFERENCES symphony.validation_runs(tenant_id,id),
 FOREIGN KEY(tenant_id,requirement_id) REFERENCES symphony.requirements(tenant_id,id));
CREATE TABLE symphony.domain_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL, aggregate_version bigint NOT NULL, event_type text NOT NULL, actor_user_id uuid REFERENCES symphony.users(id),
 actor_context jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(), command_id uuid, correlation_id uuid, payload jsonb NOT NULL, UNIQUE(aggregate_id,aggregate_version), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id));
CREATE TABLE symphony.command_receipts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, command_id uuid NOT NULL, idempotency_key text NOT NULL, payload_sha256 text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,idempotency_key), UNIQUE(tenant_id,command_id));
CREATE TABLE symphony.outbox_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, cooperative_id uuid NOT NULL, domain_event_id uuid NOT NULL, topic text NOT NULL, payload jsonb NOT NULL, available_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(domain_event_id,topic),
 FOREIGN KEY(tenant_id,cooperative_id) REFERENCES symphony.cooperatives(tenant_id,id),
 FOREIGN KEY(tenant_id,domain_event_id) REFERENCES symphony.domain_events(tenant_id,id));
CREATE OR REPLACE FUNCTION symphony.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable_record: % cannot be updated or deleted',TG_TABLE_NAME; END $$;
CREATE TRIGGER evidence_versions_immutable BEFORE UPDATE OR DELETE ON symphony.evidence_versions FOR EACH ROW EXECUTE FUNCTION symphony.reject_mutation();
CREATE TRIGGER minutes_versions_immutable BEFORE UPDATE OR DELETE ON symphony.minutes_versions FOR EACH ROW EXECUTE FUNCTION symphony.reject_mutation();
CREATE TRIGGER domain_events_immutable BEFORE UPDATE OR DELETE ON symphony.domain_events FOR EACH ROW EXECUTE FUNCTION symphony.reject_mutation();
CREATE TRIGGER validation_runs_immutable BEFORE UPDATE OR DELETE ON symphony.validation_runs FOR EACH ROW EXECUTE FUNCTION symphony.reject_mutation();
CREATE TRIGGER validation_results_immutable BEFORE UPDATE OR DELETE ON symphony.validation_results FOR EACH ROW EXECUTE FUNCTION symphony.reject_mutation();
COMMIT;
