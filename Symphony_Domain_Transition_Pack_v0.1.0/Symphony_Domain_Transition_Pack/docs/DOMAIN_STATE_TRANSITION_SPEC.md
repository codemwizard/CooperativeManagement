# Symphony Cooperative Domain State-Transition Specification

**Version:** 0.1.0 | **Status:** design baseline for review | **Database:** PostgreSQL first, Supabase-compatible v0 later

## 1. Purpose and boundary

This is the domain contract between the current React/TypeScript prototype and its first relational implementation. It is a greenfield domain model, not a translation of UI state into tables. Preserve the prototype's evidence versioning, provenance, verification assignment/finding, disputes, validation outcomes, readiness projections and dossier limitations. Do not preserve its fixed governance assumptions, UI-only authorization or demo seed facts as domain truth.

Symphony governs readiness evidence. It does not certify legal truth, perform institutional due diligence, guarantee field counts or make a financing decision.

## 2. Domain rules

1. Platform access role, tenant membership, cooperative membership, governance appointment, delegated authority and evidence provenance are separate concepts.
2. A position is a rule-defined slot; an appointment is a person's time-bounded occupancy of that slot.
3. A registration certificate is evidence of cooperative identity and may show historical officers. It is not proof of the current Board.
4. By-laws are versioned source material. Provisions retain exact source references and separate transcription review from interpretation.
5. Minutes and resolutions, not editable roster fields, drive governance state changes.
6. Evidence admission, official cooperative approval, independent verification and institutional reliance are distinct.
7. Submitted evidence and minutes versions are immutable. Corrections create new versions.
8. Verification findings attach to exact evidence versions. New versions inherit no verification or approval.
9. Suppliers cannot verify their own evidence version.
10. Disputes are retained records, not deletion or silent override.
11. Unknown, vacant, incomplete, not-applicable and disputed are valid states. Capture can be permissive; conclusions must remain truthful.
12. Domain audit history is separate from UI telemetry.

## 3. Existing prototype alignment

Preserve:
- evidence item/version history and provenance;
- exact-version verification assignments and findings;
- supplier/verifier separation;
- dispute lifecycle;
- evaluation outcomes (`satisfied`, `unresolved`, `not_applicable`, `exception`, `assessment_time`);
- explainable readiness/pipeline projections;
- dossier visibility of evidence, findings, limitations and reliance;
- action-based role policy as a policy input.

Do not treat these as authoritative domain implementations:
- `RoleGate` is UI gating, not server authorization;
- fixed Chairman/Secretary/Treasurer comparisons are incomplete and must become by-law-driven;
- certificate officers are not current officeholders;
- hardcoded demo registration numbers and seed facts are not production facts;
- UI capture events are not the business audit log;
- placeholder callbacks are not domain commands;
- local/in-memory state is not the relational source of truth.

## 4. Aggregates

| Aggregate | Root | Owns |
|---|---|---|
| Cooperative | `cooperatives` | identity, lifecycle projection, aggregate version |
| Enrollment | `enrollments` | self/assisted enrollment and handover |
| Source | `source_documents` | original source metadata, hash and storage reference |
| By-law | `bylaw_versions` | immutable version, effectiveness, provision source |
| Governance | `governance_profiles` | configured bodies, positions and rules |
| Person | `people` | cooperative-domain identity |
| Membership | `memberships` | temporal membership relationship |
| Appointment | `appointments` | temporal, source-backed position occupancy |
| Meeting | `meetings` | convening, attendance and meeting lifecycle |
| Minutes | `minutes_versions` | immutable submitted/approved content versions |
| Resolution | `resolutions` | decision, source, adoption and effectiveness |
| Evidence item/version | `evidence_items`, `evidence_versions` | logical evidence identity and immutable submissions |
| Assurance | assignments, findings, admissions, disputes | scoped assurance lifecycle |
| Requirement/validation | requirements, validation runs/results | source-linked obligation and immutable evaluation |
| Business history | `domain_events` | append-only business events |

## 5. State machines

### 5.1 Enrollment
`draft -> submitted -> identity_review -> handover_pending -> active`; terminal alternatives `withdrawn`, `rejected`. Reopening requires privileged command, reason and event. Activation requires a cooperative workspace, minimum identity capture, a valid authority/handover basis and at least one authorized cooperative actor. Enroller access is not cooperative authority.

### 5.2 By-law version
`captured -> submitted_for_review -> reviewed -> registered_effective`; alternatives `withdrawn`, `disputed`, `superseded`. A new version never overwrites the previous version. Provision transcription and interpretation review are separate. An amendment resolution alone does not establish legal effectiveness where registration is required.

### 5.3 Governance profile
`draft -> configured -> superseded | disputed`. Configured requires a source basis, bodies, positions, required/optional/conditional/not-provided-for/unknown classification, and source-linked composition/term/authority rules. A configured profile may contain vacancies. Committee rules must be source-derived, not universal hardcoded assumptions.

### 5.4 Person and membership
Person identity: `unverified`, `asserted`, `verified`, `disputed`, `merged`. Membership: `pending`, `active`, `suspended`, `ceased`, `disputed`. Membership is temporal (`valid_from`, `valid_to`) and retained historically. A member need not have a platform login.

### 5.5 Appointment
`proposed -> pending_confirmation -> active -> suspended | expired | terminated | disputed | superseded`. Active appointment requires person, position, effective interval and authority source. Exclusive positions cannot have overlapping active intervals. Replacement closes the former interval and opens the new interval atomically. Combined offices require explicit permission in position rules.

### 5.6 Meeting and minutes
Meeting: `planned`, `convened`, `held`, `minutes_draft`, `minutes_submitted`, `minutes_reviewed`, `minutes_approved`, `cancelled`, `disputed`. Attendance is separately recorded. Every minutes submission creates a new immutable version; corrections do not overwrite. Approval references exact version, approver, capacity, timestamp and authority. Quorum is a rule evaluation against a versioned rule and attendance snapshot, not a manually asserted boolean.

### 5.7 Resolution
`draft -> proposed -> adopted -> effective`; alternatives `rejected`, `rescinded`, `superseded`, `disputed`. Adoption requires approved minutes or configured alternative authority. Effectiveness may require future date or external condition. Governance-changing resolutions identify affected subject and source rule. Rescission is a new event.

### 5.8 Evidence and assurance
Evidence item is stable logical identity; evidence version is immutable. Submission: `draft -> submitted -> admitted | rejected`. Assurance: `unassigned -> assigned -> finding_recorded`. Finding outcomes: `verified_conformant`, `verified_with_qualifications`, `non_conformant`, `inconclusive`, `not_verified`, `unable_to_determine`. New version inherits no admission, approval or finding. Admission is not official approval or verification. A finding is version-specific. An open dispute blocks unqualified reliance. Fingerprints establish content consistency, not truth.

### 5.9 Validation
A validation run snapshots subject, evaluation time, rule-set version, source versions, evidence version IDs, per-requirement outcome and explanation. Outcomes preserve prototype vocabulary: `satisfied`, `unresolved`, `not_applicable`, `exception`, `assessment_time`. New facts or rules require a new run; historical runs are immutable.

## 6. Domain commands

Every mutation is a server-side command containing command ID, tenant, aggregate ID, expected aggregate version, idempotency key, payload and correlation metadata. Actor identity is derived from authenticated session, never trusted from the client.

| Command | Preconditions | Event/result |
|---|---|---|
| `CreateCooperative` | authenticated actor, tenant scope | provisional cooperative, draft enrollment; `cooperative.created` |
| `SubmitEnrollment` | draft, minimum fields | submitted; `enrollment.submitted` |
| `RecordIdentityEvidence` | cooperative scope, provenance | new evidence version |
| `AdmitEvidenceVersion` | submitted version, admission authority | admission record |
| `CreateBylawVersion` | source document captured | immutable by-law version |
| `RecordBylawProvision` | exact version and clause reference | source-linked provision |
| `ReviewBylawProvision` | reviewer permission | transcription/interpretation review |
| `ConfirmBylawEffectiveness` | registration/effectiveness proof | effective by-law version |
| `ConfigureGovernanceProfile` | source basis | configured profile |
| `DefineGovernancePosition` | editable profile, source reference | position definition |
| `RecordPerson` / `RecordMembership` | cooperative scope and source | person/membership record |
| `ProposeAppointment` | person, position, authority source | proposed appointment |
| `ConfirmAppointment` | valid authority, non-overlap | active appointment, close replaced interval |
| `TerminateAppointment` | active appointment, valid authority | closed interval |
| `CreateMeeting` / `RecordAttendance` | body/meeting exists | meeting and attendance |
| `SubmitMinutesVersion` | held or retrospective meeting | immutable minutes version |
| `ApproveMinutes` | exact submitted version, approver authority, rules satisfied | approved version |
| `RecordResolution` | approved minutes or configured alternative | proposed/adopted resolution |
| `MakeResolutionEffective` | date and external conditions satisfied | effective resolution and state effects |
| `AssignVerification` | submitted version, eligible verifier | assignment |
| `RecordVerificationFinding` | assignment, exact version, verifier not supplier | finding |
| `RaiseEvidenceDispute` / `ResolveEvidenceDispute` | target version and authority | dispute lifecycle |
| `RunValidation` | subject and rule-set | immutable run/results |
| `AcceptAuthorityHandover` | valid appointment/decision evidence | enrollment active and access grant |

### 6.1 Atomic command algorithm

Within one transaction: resolve actor and tenant; load aggregate; compare expected version; authorize role/scope/appointment/authority; validate invariants; write normalized state; append domain event(s); append outbox message(s); write command receipt; increment aggregate version; commit. Any failure rolls back all writes. Same idempotency key + same payload returns original result; same key + different payload is rejected.

## 7. Invariants

| ID | Invariant |
|---|---|
| INV-001 | Tenant/cooperative references cannot cross scope. |
| INV-002 | Platform role does not imply appointment or cooperative authority. |
| INV-003 | Active appointment has person, position, interval and authority source. |
| INV-004 | Exclusive active appointment intervals cannot overlap. |
| INV-005 | Certificate officers are not automatically current appointments. |
| INV-006 | Governance changes cite effective decision or configured alternative authority. |
| INV-007 | By-law effectiveness requires applicable registration/effectiveness evidence. |
| INV-008 | Submitted evidence versions are immutable. |
| INV-009 | New evidence version inherits no verification, admission or approval. |
| INV-010 | Finding references exact evidence version. |
| INV-011 | Supplier cannot verify own evidence version. |
| INV-012 | Admission is distinct from approval and verification. |
| INV-013 | Qualified, non-conformant, inconclusive or conflicting finding cannot be silently promoted. |
| INV-014 | Disputes are retained separate lifecycle records. |
| INV-015 | Minutes approval references exact version and authorized approver. |
| INV-016 | Resolution effects require approved minutes/alternative authority and effective conditions. |
| INV-017 | Validation runs/results are immutable snapshots. |
| INV-018 | Business events are append-only and distinct from UI telemetry. |
| INV-019 | State, event, outbox and receipt commit atomically. |
| INV-020 | Commands support idempotency and optimistic concurrency. |
| INV-021 | Client cannot set verified state or grant authority. |
| INV-022 | Historical membership, appointment, source and evidence are retained. |
| INV-023 | Vacancy/unknown/not-applicable can be recorded without false compliance. |
| INV-024 | Institutional read-only roles cannot mutate cooperative source records. |
| INV-025 | Validation/readiness is not a financing decision. |

## 8. PostgreSQL first, Supabase v0 later

### PostgreSQL
Use UUID, `timestamptz`, `date`, normalized relational entities and JSONB only for bounded metadata/rule snapshots. Use composite tenant foreign keys, immutable evidence/minutes/event/validation records, aggregate versioning, command receipts and transactional outbox. Cross-row transitions belong in trusted transaction-scoped commands. No runtime DDL. Separate migration owner, application, reporting and worker roles.

### Supabase compatibility
Keep core tables in `symphony`; do not FK core user records to `auth.users`. Map Supabase identity through `external_identities(provider, provider_subject)`. Carry tenant scope on all tenant-owned rows. Add RLS during the Supabase port using trusted tenant membership rows, not client-editable metadata. RLS is row isolation, not action authorization. Use trusted server/API or carefully controlled server-side functions for multi-row transitions. Never expose service-role credentials. Keep storage/auth/realtime/email as adapters. Test RLS independently.

## 9. Implementation phases and stop gates

0. **Domain freeze:** approve states, authority semantics, commands, ERD and scenario oracle. Stop if appointment, minutes or resolution authority is ambiguous.
1. **PostgreSQL foundation:** tenant identity, migrations, command receipts, aggregate versioning, event log and outbox. Stop if isolation/idempotency/atomicity fails.
2. **Evidence core:** versioning, provenance, admission, verification, findings, disputes. Stop if self-verification or verification inheritance is possible.
3. **By-law/governance configuration:** source documents, provisions, requirements, profiles, bodies, positions. Stop if certificate officers are treated as current.
4. **Membership/appointments/meetings:** temporal membership, appointment, minutes and resolutions. Stop if roster can change without source-backed command.
5. **Validation/workflows:** deterministic snapshots, explainable findings and projections. Stop if a single compliance flag hides dimensions.
6. **Supabase v0:** auth mapping, RLS, storage adapter, trusted commands and tenant/RLS tests. Stop if browser writes bypass domain authorization.

## 10. Unresolved decisions — do not invent in code

- Which actions require dual sign-off?
- Who may admit evidence under cooperative-specific policy?
- Which positions are exclusive or combinable?
- How is historical appointment evidence handled?
- Quorum, notice, voting and minutes approval rules by meeting type?
- Which resolution classes require external registration?
- Who approves by-law interpretation?
- Membership classes and transfer/cessation rules?
- Which legal catalogue entries are verified against current law?
- Person deduplication and privacy basis?
- Personal-data/file retention and deletion rules?
- Enroller permissions before handover?
- May a field agent only capture a declaration, or attest to observations?

## 11. Definition of done

All commands enforce server-side authority, idempotency and concurrency. State/event/outbox/receipt are atomic. Rejected commands leave no partial writes. Evidence and minutes versions are immutable. Findings are exact-version. Appointments are temporal/source-backed. Resolutions apply only when effective. Validation is immutable. Tenant isolation is tested in application and database. All 20 scenarios pass against oracle, service and PostgreSQL integration layers. Supabase RLS has separate tests.
