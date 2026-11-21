# REM-WP2.3 source-record contract

**Status:** D-20 resolves assisted-enrolment IFV provenance. D-21 and owner-approved D-22 resolve acting-office provenance, office-equivalent authority, and decision-maker versus data-entry attribution. The source resolver and immutable termination source are implemented; app-role appointment writes remain disabled until their D-16 command, audit, and scope-version path is registered and verified.

## Assisted-enrolment IFV grant

The Phase 1 rule comes from `Implementation-Plan-V4/03-specification-delta.md` §§2.2 and 3.1–3.2, requirements IFV-3 and ENR-003, and D-19's generic capacity command boundary.

An eligible persisted `enrolment_sessions` row is bound to its tenant, target cooperative, authenticated enroller, and `representative_person_id`. It records typed facts:

- `representative_present`;
- `representative_nrc_sighted`;
- `representative_consented_to_act`;
- `attestation_recorded_by_user_id` and `attestation_recorded_at`.

All three attestations must be true, the representative must be identified, and the attester must be the session's enroller. The row must be open at the PostgreSQL transaction timestamp and match the authenticated actor and command's cooperative. Legacy `presence_attestation` JSON alone is not authority. These source rows are read-only to `symphony_app`, consistent with D-16 frozen-source policy.

`GrantCapacity` can invoke this exception only for `internal_verifier`. Its strict payload includes `assistedEnrolment: { sessionId, representativeDecision: "approve_internal_verifier" }`. The command binds the decision to the session's persisted representative. The capacity grant source row and immutable `CapacityGranted` event record the session ID, representative ID, decision, enroller and grant timestamp atomically with receipt, outbox and D-16 updates. Identical-grant identity includes this basis. A different/missing basis does not qualify as an identical repeat and cannot authorize the exception.

The NRC value or image is not stored in this authority source. `representative_consented_to_act` is not `consent_records` data-processing consent. It records only the SDD-required authorization for the enroller to proceed with the assisted workflow.

## Acting-officer authority

D-19 prohibits generic `GrantCapacity` and `RevokeCapacity` from creating `acting_officer`. D-21 resolves the source model as a separate persisted acting appointment for an active cooperative office, backed by an external instrument reference and an exact immutable evidence-version ID. No in-app cooperative-resolution aggregate is introduced. D-22 says an acting officeholder has the same authority as the substantive holder of that office, within the same action-specific policy boundaries.

D-21 selects the existing immutable evidence subsystem as supporting provenance instead of adding a cooperative resolution aggregate. The source record contains:

| Field | Required meaning |
|---|---|
| `appointment_kind` | `acting`; it is distinct from a substantive office appointment. |
| `position` | An active cooperative office code from `position_catalog`. |
| `appointed_by_user_id` | Authorized appointment decision-maker: current Chairperson/Vice-chairperson, substantive or acting. |
| `recorded_by_user_id` | Cooperative official who entered the already-authorized decision; includes the Secretary and carries no decision authority by itself. |
| `source_kind` | `external_resolution` or `external_delegation`. |
| `source_reference` | External instrument identifier. |
| `source_issuing_body` | Issuer/authority as recorded by the cooperative. |
| `source_date` | Date shown on the instrument. |
| `supporting_evidence_version_id` | Exact immutable document version; its evidence item must belong to the same cooperative. |
| `effective_from`, `effective_to` | Required half-open interval `[from,to)`. |
| `supersedes_appointment_id` | Optional prior acting appointment replaced by this one. |

External source metadata, the supporting-version link and effective period are append-only. The record is bound by database enforcement to a same-tenant cooperative, active cooperative office code, and supporting evidence owned by that cooperative. The resolver recognizes the acting office for the linked authenticated person only with an active cooperative membership, an active half-open interval, exact evidence version, and no effective supersession or termination. An uploaded document proves preserved provenance only; it does not prove legal sufficiency, quorum, vote threshold, issuer authority, or by-law compliance. `appointed_by_user_id` is the person authorized to decide the appointment; `recorded_by_user_id` is the official who enters the decision. A Secretary may perform the latter role without receiving Chairperson/Vice-chairperson decision authority.

An early end is an immutable row in `acting_officer_appointment_endings`, not an update to the appointment. It names the appointment and cooperative, effective end time, authorized Chairperson/Vice-chairperson decision-maker, platform recorder, typed external source reference, issuer/date and exact same-cooperative evidence version, plus the event that records the decision. Its effective time must fall within the appointment's interval. The resolver excludes the acting authority once that time is reached. App role access is SELECT only for both source tables; decision-making and data-entry commands still require the D-16 lock, audit, event, receipt, and scope-version transaction path before write privileges can be enabled.

The source record and read-only resolver path are implemented and have focused PostgreSQL coverage. D-22 resolves the actor distinction, but the appointment/termination mutation command and its D-16 writer, audit, event, receipt, and versioning effects are not implemented. No appointment mutation command exists and the app-role write boundary remains closed.
