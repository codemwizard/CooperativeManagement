# 03 — Specification Delta (SDD)

This amends and completes the Cooperative Onboarding, Governance and Compliance Requirements Specification and the Domain Transition Pack. Where this document is silent, those two documents govern. Where they conflict with a founder decision (`02`), the decision governs and the conflict is logged.

> **Round 2 (3 Nov 2026):** founder rulings in `02` §6 amend §1, §3, §4, §5, §8, §10–§12 below. Evidence states are now specified normatively in `03b-evidence-standing-model.md`; the §4.3 table is the round-1 seed, superseded by the Duty Matrix in 03b.

## 1. Glossary (additions and sharpenings)

| Term | Meaning |
|---|---|
| **Platform role** | What a login may do inside Symphony (admin, enroller, institutional roles). Not proof of office. |
| **Position** | A reusable definition in a cooperative's governance profile (Chairperson, Director…). |
| **Appointment** | A person holding a position for a period, with a source. |
| **Capacity** | An additive, scoped, time-bounded authority held by a user: `internal_verifier`, `field_agent`, `delegate`, `acting_officer`. A capacity is not an office and not a platform role. |
| **Internal Field Verifier (IFV)** | Capacity `internal_verifier`, bound to one organisation. Issues findings of assurance class `cooperative_internal`. |
| **Field Agent** | Capacity `field_agent`. Captures and attests observations. Authority limited to the organisation that employs the agent. |
| **Supplier / Collector / Admitter / Approver / Verifier** | Distinct actors on an evidence version. Supplier gave it; Collector captured it on the supplier's behalf; Admitter accepted it into the working register; Approver made it an official record; Verifier issued a finding. |
| **Assurance class** | `cooperative_internal` · `platform` · `independent_external` · `institutional`. Says *who stands behind a finding*, never "how true". |
| **By-law of record** | The registered by-law version (default release trigger `registered_current`, per Act s.20(2) and the definition of "by-laws" in s.2; configurable to `submitted_to_registrar`). It prevails over resolutions. Amendments not yet registered are not operative by default. |
| **Legal registration status** | `registered_effective` only when registration evidence exists. Independent of which version is the by-law of record. |
| **Enforcement mode** | `advisory` (record, flag, label) · `warning` (flag prominently, require acknowledgement) · `blocking` (reject the transition). |
| **HARD / POLICY** | HARD rules protect integrity, honesty and security and are never configurable. POLICY rules express governance compliance and follow enforcement mode. |

## 2. Roles, positions and capacities

### 2.1 Default catalogue (seeded, versioned, editable per organisation where marked)

| Kind | Code | Default behaviour |
|---|---|---|
| Platform role | `platform_admin` | Provision enrollers, roles, catalogues. Never an officer. |
| Platform role | `platform_enroller` | Assisted enrolment within assigned scope; proxy only with representative present. |
| Enrolment actor | `self_enroller` | Creates provisional workspace; no protected authority. |
| Position (template) | `chairperson`, `vice_chairperson`, `secretary`, `treasurer`, `director`, `committee_chair`, `committee_member` | Suggested only; the cooperative's by-laws define the real set. Mandatory *workflow* roles: Chairperson, Secretary, Treasurer. |
| Membership | `member` | Ordinary member. |
| Capacity | `internal_verifier` | See §2.2. |
| Capacity | `field_agent` | Capture and attest observations; employer-scoped. |
| Capacity | `delegate`, `acting_officer` | Time-bounded, sourced from a delegation or resolution. |
| Institutional (legacy-compatible) | `ta`, `pfi_analyst`, `pfi_credit`, `fund_manager`, `external_verifier`, `union_ta` | Read-only on cooperative source records; scoped by cohort/consent/delegation. |

Legacy mapping: `coop_field_agent` → capacity `field_agent`; legacy `field_agent` ("mark_verified") → capacity `internal_verifier` if employed by the cooperative, else `external_verifier`; `chairman/secretary/treasurer` personas → positions + appointments.

### 2.2 Internal Field Verifier (IFV)

| Rule | Statement |
|---|---|
| IFV-1 | May be granted to any user, in addition to existing roles/positions, or to a dedicated user with no other role. |
| IFV-2 | Bound to exactly one organisation. A grant for organisation A confers nothing on organisation B. |
| IFV-3 | Granted by a recorded act of cooperative authority (default: Chairperson or Vice-Chairperson; during assisted enrolment, by the enroller recording the representative's decision). Grant, suspension and revocation are events. |
| IFV-4 | Findings carry `assurance_class = cooperative_internal`, scope, method, limitations and the exact version examined. |
| IFV-5 | "Ultimate cooperative verifier": inside the cooperative, an IFV finding is the highest cooperative-internal assurance. Officers may dispute it; they cannot edit or delete it. (Confirm O-2.) |
| IFV-6 | **Conflict rule (HARD for supplier and collector, configurable for admitter and approver):** the IFV may not issue a finding on a version they supplied or collected. Conflicts are evaluated on `person_id`, not on role, so holding two capacities does not bypass the rule. The enroller acting as `proxy_operator` is the single disclosed exception (`03b` §5). |
| IFV-7 | Revocation does not alter past findings; they remain with their original class and are annotated "verifier no longer active". |
| IFV-8 | Every external view shows: "Cooperative internal verification — not independent. Relying parties perform their own due diligence." |
| IFV-9 | Destinations may require `min_assurance`. An IFV finding satisfies `any` and `cooperative_internal` only. |
| IFV-10 | Two IFVs may disagree; unresolved conflict blocks promotion exactly as in the legacy conflict-resolution semantics, resolved by a third IFV or an external verifier, never by an officer. |

## 3. Enrolment

### 3.1 State machine

`workspace_created → identity_in_progress → authority_pending → handover_offered → handover_accepted → active`. Any stage is saveable and resumable; later-stage facts may be recorded early (dependencies show as findings).

- `active` is a **defined blocking transition** (spec §11.1): it requires an accepted authority record for at least one cooperative-side actor. Everything before it is advisory.
- Self-enrolment (round 2): `self_enroller` is a **placeholder initiator** with exactly three permitted acts: (1) record the registration certificate details (registered name, registered and postal address, date of registration, the certificate document, and the registration number where it is printed; **mandatory for every workspace**); (2) create accounts limited to the roles Chairperson, Vice-Chairperson or Secretary, each with a temporary credential; (3) hand over and log out. The initiator may be an officer or an unaffiliated delegate; they are recorded as `initiator` with a stated relationship, never as an officeholder. They cannot admit, appoint, approve, verify or write any other evidence. The initiator account closes at handover.
- Temporary credentials: single use, forced change at first login, expiry (default 72 h), delivered out of band, with `password_set_by_initiator` and first-login events audited. FND-ENR-001 stays open while a temporary credential is unchanged.
- The created official logs in, **admits the certificate details**, accepts the handover and starts onboarding in that capacity.
- Assisted enrolment: an `enrolment_session` must exist (representative present, NRC sighted, consent to act). No session, no assisted write.
- Handover records: outgoing and incoming actors, scope, unresolved claims, acknowledgements, authority reference, time. It never rewrites provenance.
- Certificate gate: the registration certificate is mandatory in every mode. Its details stay `asserted` until a platform check or IFV finding; policy `activation_requires_platform_check` (default on, O-12) requires a platform check before `active`.

### 3.2 Identity checks

`identity_check_methods` is configuration (OTP, in-person attestation, document sighting, password). Each authentication or check event records method, actor, time, and result. It proves only that the check happened. Rural enrolment without phones uses `in_person_attested`: the enroller attests sighting of the representative's NRC and the representative's presence.

## 4. Evidence lifecycle and assurance

Stages are independent dimensions, never one status: **supplied → admitted → officially approved → verified (with assurance class) → relied upon**, plus dispute and currency. **Normative detail for tracks, origins, duty matrix, audience standing and pipeline stages is in `03b-evidence-standing-model.md`; where §4.3 differs, 03b governs.**

### 4.1 Provenance labels (extends spec §10.4)

`self_declared`, `cooperative_supplied`, `cooperative_admitted`, `platform_enroller_collected`, `platform_checked`, `field_agent_assisted`, `cooperative_internally_verified`, `ta_programme`, `external_source`, `independently_verified`. `certified_app` is retired.

### 4.2 Legacy level projection (keeps destinations working)

| Legacy level | Derived when |
|---|---|
| `asserted` | A current version exists, supplied, nothing further |
| `supported` | Current version admitted by an authorised admitter, or corroborated by a document link |
| `verified` | A conformant or qualified finding exists **on the current version**, any assurance class; the class is displayed beside the level |

The projection is computed, never stored as the source of truth. `min_assurance` (default `any`) on a destination requirement can demand more.

### 4.3 Round-1 record-class seed (SUPERSEDED by the Duty Matrix in `03b` §4; kept for audit)

| Record class | May prepare | May admit | Official when | Result label if admitted but not approved |
|---|---|---|---|---|
| Registration certificate, ZRA, chief/headman letter | Any officer, enroller | Chair, Vice, Sec, Treas, IFV | External issuer's document + admission | "Admitted as supporting evidence" |
| By-laws (version) | Secretary | Chair, Vice, Sec, Treas | Registrar registration evidence | "Adopted — pending registration" |
| Minutes | Secretary | Chair, Vice, Sec, Treas | Approved by Chair/Vice (or per by-law) | "Draft / awaiting official approval" |
| Resolution | Secretary | Chair, Vice, Sec, Treas | Recorded outcome + approved minutes | "Recorded — minutes not approved" |
| Financial statements | Treasurer | Chair, Vice, Sec, Treas | Adopted at general meeting | "Admitted — awaiting adoption" |
| Audit report | Auditor (external) | Chair, Vice, Sec, Treas | Presented/adopted at general meeting | "Admitted — awaiting adoption" |
| Member register | Secretary | Chair, Vice, Sec, Treas | Approved per by-law | "Admitted — awaiting approval" |
| Training attendance, programme records | Secretary, committee | Chair, Vice, Sec, Treas | Approved by committee/Board | "Admitted as supporting evidence" |
| Field observation | Field Agent | Chair, Vice, Sec, Treas, IFV | n/a | "Field-agent observation (employer-scoped)" |

Each row also holds `approvers_required` (default 1) and `distinct_actors` (default false). Dual sign-off is raising these values; no code change.

## 5. By-laws, requirements and precedence

- **By-law version statuses:** draft, proposed, adopted_pending_submission, submitted_to_registrar, registered_current, superseded, rejected, unknown. `registered_effective` requires registration evidence (HARD). An amendment adopted at a meeting is not the by-law of record until it reaches the release trigger. Registration evidence for an amendment is the Registrar's **Certificate of Amendment of By-laws (Form 4)**; a refusal is **Form 3**; a notice of cancellation of registration is **Form 5**; the certificate of registration is **Form 2** (Co-operative Societies Regulations, SI 26 of 1999, regulations 4–8; section references to be confirmed by the legal reviewer).
- **Precedence policy (versioned, round 2):** `statute` > `by-law of record` > `resolution` > `catalogue default`. A resolution that conflicts with the by-law of record is **held as `held_draft`** with FND-GOV-020 naming both sources, until the by-law is amended and re-submitted to the Registrar (release trigger default `registered_current` per Act s.20(2), configurable to `submitted_to_registrar`; round 5, O-18). Statute is never overridden; a conflict with statute is a finding only.
- **Provision extraction:** manual, imported or AI-assisted. Nothing becomes operative until a reviewer confirms it. Interpretation of a provision is approved by Chairperson or Vice-Chairperson.
- **Requirement dimensions (separate columns):** configuration status, implementation status, evidence status, platform-capability status. UI may summarise; storage never merges them.
- **Statutory catalogue entries** (Act sections in spec §6.5) carry `legal_validation_status`. `needs_legal_validation` entries never block and are never shown as settled law.
- **Meeting, membership and resolution rules** are structured records extracted from confirmed provisions (`meeting_rules`, `membership_rules`, `resolution_class_rules`). Missing rule → `rule_unknown` finding, no default.

## 6. Governance rules

- Positions, bodies and committees are configuration of a governance profile version. Absent, combined, vacant and unknown positions are recordable states with source and note.
- Appointments are temporal with lifecycle events; current officeholders are derived. Acting appointments are separate records and never overwrite the substantive appointment.
- Registration-certificate officers are historical evidence, never the current Board.
- Combination rules (seed): Chairperson ≠ Vice-Chairperson (same person); audit-committee member ≠ Board director; all other combinations allowed. Each is a `position_combination_rule` with enforcement mode (default advisory).
- Historical appointment evidence uses the same append-only process; late recording is marked `recorded_late`.

## 7. Meetings and resolutions

Eligible-population snapshot and the rule snapshot used are stored at meeting time. Quorum is computed from those, shown, and never blocks recording. Minutes versions are immutable; approval is a separate event naming approver, authority and exact version. A resolution may be recorded without approved minutes: it is labelled "recorded — minutes not approved" with a finding in advisory mode, and blocked from effects only in blocking mode. Resolution effects are atomic and idempotent. A by-law amendment resolution creates an `adopted_pending_submission` by-law version and a `pending_external_action` state; resolutions that depend on the amendment stay `held_draft` until release.

## 8. Privacy and access

| Rule | Statement |
|---|---|
| PRV-a | Consent per person per purpose before PII entry; withdrawable; evidence of consent recorded (written, digital, enroller-witnessed). **Statutory register fields (s.28) use lawful basis `legal_obligation`, not consent;** each purpose records its lawful basis. |
| PRV-b | Identifiers (NRC and alternatives) stored encrypted; HMAC blind index for matches; never in logs or events. |
| PRV-c | Masking by role and purpose: officers see what their duties need; union/TA and institutions see aggregates and capability gaps, never member PII or sensitive data. |
| PRV-d | Member register inspection: read-only and logged. Members inspect free; **any member of the public may inspect on payment of the prescribed fee (O-19, Act ss.21, 28)**. The fee is recorded by receipt reference, not processed by Symphony. Public inspection shows only name, address, occupation and date registered; shareholding amounts, identifiers, contact details and sensitive data are never shown. |
| PRV-e | Retention is a per-category policy (`retention_policies`). Personal membership data: default one year after end of use, then crypto-shred or anonymise. Transaction/financial records carry `retention_conflict_review_required` (erasure right vs a longer statutory retention claim): PII is crypto-shredded and the transaction facts are kept under the pseudonymous id. Events keep pseudonymous ids only. All parameters `needs_legal_validation` (O-10). The Act implies longer floors than the one-year default: former-member liability runs two years from cessation (s.34) and an expelled member may not be re-admitted for two years (s.37(6)); recommended floor for membership records is therefore **two years** pending the legal reviewer (O-23). |
| PRV-f | Residency and test mode: the system runs in `DATA_MODE=test` (synthetic data only, identifier guard accepts only identifiers matching the synthetic pattern `^TS[A-Z0-9]{4}/\d{2}/[123]$`, which can never be a real NRC because real numbers are digits only, plus scheduled **purge-to-seed**) but is built as if residency and the Data Protection Act were enforced: a `DATA_RESIDENCY_REGION` setting, a startup refusal to enable `DATA_MODE=real` outside an approved region, and no third-party processor receiving personal data. |
| PRV-g | Identifier format policy: in real mode the NRC pattern `^\d{6}/\d{2}/\d$` is **advisory only** (a mismatch raises a warning, never a rejection) because re-issued chip cards carry a previous number and layouts vary. A `previous_nrc` link is kept for re-issued cards. The last digit encodes citizenship category (1 Zambian, 2 Commonwealth, 3 non-Commonwealth) and is treated as sensitive: masked in display and never used in decisions. |

## 9. Commands, events and offline tolerance

Every command carries: `command_id` (idempotency key), `organization_id`, `actor_user_id`, `occurred_at`, `device_id`, `expected_version`, `correlation_id`, payload. Same id + same payload returns the stored result; same id + different payload is rejected. A stale `expected_version` is rejected and **both inputs are preserved** for reconciliation. State, event and outbox rows commit in one transaction. Command families are those in spec §13 plus: `GrantCapacity`, `RevokeCapacity`, `StartEnrolmentSession`, `RecordPlatformCheck`, `RecordConsent`, `WithdrawConsent`, `SetEnforcementMode`, `ConfigureRecordClassPolicy`, `ConfigurePrecedencePolicy`, `ConfirmMeetingRule`, `DelegateTaScope`.

## 10. Invariant classification

HARD never varies. POLICY follows enforcement mode (default advisory). "Gate" = blocking by design (a defined transition).

| INV | Class | | INV | Class |
|---|---|---|---|---|
| 001 tenant isolation | HARD | | 014 disputes retained | HARD |
| 002 platform role ≠ appointment | HARD | | 015 minutes approval names exact version | HARD (authority adequacy POLICY) |
| 003 appointment has source | POLICY | | 016 resolution effects need approved minutes | POLICY |
| 004 exclusive-position overlap | POLICY | | 017 validation runs immutable | HARD |
| 005 certificate officers ≠ current | HARD | | 018 events append-only | HARD |
| 006 governance change cites decision | POLICY | | 019 command atomicity | HARD |
| 007 `registered_effective` needs proof | HARD | | 020 idempotency and concurrency | HARD |
| 008 versions immutable | HARD | | 021 client cannot assert verified/authority | HARD |
| 009 no inherited verification | HARD | | 022 history retained (PII erasure carve-out) | HARD |
| 010 finding names exact version | HARD | | 023 vacant/unknown representable | HARD |
| 011 no self-verification (supplier/collector) | HARD | | 024 read-only institutions cannot mutate | HARD |
| 012 admission ≠ approval | HARD | | 025 readiness is not a financing decision | HARD |
| 013 no silent promotion | HARD | | | |

Scenario classes: **HARD** SC-003, 004, 006, 007, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020 · **POLICY (advisory default, blocking variant tested)** SC-002, 005, 008 · **Gate** SC-001.

## 11. Validation findings catalogue additions (IDs for rules)

FND-ENR-001 temporary credential unchanged · ID-003 Registrar cancellation notice on file (Form 5; notice period and appeal window shown) · BYL-005 Registrar refused amendment (Form 3) · ENR-002 no representative session · ID-001 registration number missing · ID-002 duplicate person candidate · BYL-001 provisions awaiting confirmation · BYL-002 amendment pending registration (standing) · BYL-003 rule unknown (meeting/membership/resolution) · BYL-004 legal entry unvalidated · GOV-010 position vacant/unknown · GOV-011 combination rule violated · GOV-012 appointment lacks source · GOV-013 appointment term expired · GOV-020 resolution conflicts with by-law of record (held as draft) · MTG-001 quorum not demonstrated · MTG-002 minutes not approved · MTG-003 resolution unbacked · EVD-001 admitted not approved · EVD-002 only self-declared · EVD-003 disputed · EVD-004 stale · VER-001 IFV conflict declined · VER-002 verifier revoked after finding · PRV-001 no consent on file · UNI-001 PII requested outside scope. Round-5 additions: GOV-014 director beyond six consecutive years (s.43(2)) · GOV-015 chairperson/vice-chairperson ineligible (s.42(1)) · GOV-016 director holds remunerative office (s.44(3)(c)) · GOV-017 vacancy needs special meeting (s.44(2)) · MTG-004 board quorum below one half of directors (s.46(3)) · MTG-005 board meeting notice under seven days (s.46(2)) · MTG-006 board minutes not recorded (s.46(4)) · MTG-007 disclosed interest not recorded or vote counted (s.46(5)) · BYL-006 required by-law provision missing (Schedule I) · BYL-007 amendment copies not signed by chair of meeting and secretary (s.20(2)) · ID-004 society registered under the repealed 1970 Act (s.85) · PRV-002 request for another member's accounts without consent (s.59(2)). Each finding records rule id and version, target, severity, observed vs expected, source, next action, responsible role.

## 12. Requirement catalogue

IDs are used in features and the traceability matrix. Statement is shorthand; the sections above are normative.

| REQ | Statement |
|---|---|
| ENR-001 | Self-enroller creates a provisional workspace without protected authority |
| ENR-002 | Platform enrollers are provisioned and scope-assigned by an admin |
| ENR-003 | Assisted writes require an enrolment session with representative presence |
| ENR-004 | Identity-check method is configurable; checks prove only that they occurred |
| ENR-005 | Handover preserves provenance |
| ENR-006 | Self-enroller is a placeholder initiator limited to certificate details and creating chair/vice/secretary accounts; account closes at handover |
| ENR-007 | Stages are resumable and order-independent |
| ENR-008 | Commands are replay-safe offline (idempotent, occurred_at kept) |
| ENR-009 | Activation gated on accepted authority; certificate mandatory at workspace creation in every mode; platform check before activation (policy) |
| ID-001 | Certificate details mandatory at workspace creation; they stay asserted until checked |
| ID-002 | Registration certificate is never the current Board |
| ID-003 | No seeded fallback values in real records |
| ID-004 | Annual return tracked separately from certificate |
| ID-005 | NRC matches create duplicate review, never silent merge |
| PRV-001 | Consent before PII; withdrawable |
| PRV-002 | Identifiers encrypted; blind-index matching |
| PRV-003 | Role-based masking; no PII for union/TA/institutions |
| PRV-004 | Events and logs carry no PII |
| PRV-005 | Retention hold then shred/anonymise |
| PRV-006 | Register inspection: free for members, on payment of the prescribed fee for any member of the public, statutory fields only, logged |
| BYL-001 | By-law versions with status lifecycle |
| BYL-002 | Provisions extracted, confirmed before operative |
| BYL-003 | By-law of record prevails; a conflicting resolution is held as draft until the by-law is amended and re-submitted |
| BYL-004 | Amendment adopted but not submitted/registered is not operative; dependent resolutions held; standing finding |
| BYL-005 | Requirements link to sources; dimensions kept separate |
| BYL-006 | Legal entries carry validation status; never blocking until validated |
| BYL-007 | Meeting/membership/resolution rules extracted; unknown rule is a finding |
| BYL-008 | `registered_effective` needs registration evidence |
| GOV-001 | Positions are not persons |
| GOV-002 | Bodies and positions configurable; vacant/combined/absent representable |
| GOV-003 | Appointments temporal, sourced, append-only history |
| GOV-004 | Combination rules with default seeds and enforcement mode |
| GOV-005 | Acting appointments separate |
| GOV-006 | Committees and memberships temporal |
| GOV-007 | Certificate officers are historical only |
| MTG-001 | Eligible-population and rule snapshots at meeting time |
| MTG-002 | Quorum computed, shown, never blocks recording |
| MTG-003 | Minutes versions immutable; approval separate and exact |
| MTG-004 | Resolutions recordable without approved minutes, labelled and flagged |
| MTG-005 | Resolution effects atomic and idempotent |
| MTG-006 | By-law amendment resolution creates pending-registration version |
| EVD-001 | Evidence versions immutable; re-supply creates a version |
| EVD-002 | Record-class policy decides admission label |
| EVD-003 | Admission ≠ official approval ≠ verification |
| EVD-004 | Disputes separate, history retained |
| EVD-005 | Provenance, limitation and status visible wherever relied upon |
| EVD-006 | Legacy level projection derived, not stored |
| VER-001 | IFV capacity: additive or dedicated, org-bound |
| VER-002 | IFV findings are `cooperative_internal`, exact version, scoped |
| VER-003 | Supplier/collector cannot verify; evaluated on person |
| VER-004 | No inherited verification across versions |
| VER-005 | External views state internal verification is not independent |
| VER-006 | Revocation preserves past findings |
| VER-007 | Field agent authority limited to employer |
| VER-008 | Destinations may require `min_assurance` |
| AUD-001 | State, event, outbox commit atomically |
| AUD-002 | Idempotent commands |
| AUD-003 | Optimistic concurrency; both inputs preserved |
| AUD-004 | Tenant isolation |
| AUD-005 | Telemetry is not the business audit log |
| AUD-006 | Read-only institutions cannot mutate; client cannot assert verified |
| UXW-001 | Workspace shell with persona navigation and URLs |
| UXW-002 | Exact status vocabulary; no overclaim words |
| UXW-003 | Capability gaps visible |
| UXW-004 | Demo tooling separated from product screens; no demo value shown as real |
| UXW-005 | Evidence status strip on every relied-upon record |
| UNI-001 | TA scope delegated through a chain |
| UNI-002 | Union sees capability gaps, not member PII |
| EXT-001 | Capability registry for every spec'd module |
| EXT-002 | Module contract: spec, catalogue, rules, projections, UI panel, features |
| EXT-003 | Indicator framework needs no schema change to add a metric |
| EXT-004 | EQS and ESG Index read through input adapters |
| EXT-005 | Operational and ESG modules declared and visible as not implemented |
| ENR-010 | Temporary credentials: single use, forced change, expiry, audited |
| ENR-011 | Enroller wears two hats: proxy entry is `supported`; the platform check is a separate act; same-person disclosure flag; optional distinct-reviewer policy |
| EVD-007 | Evidence standing is computed from track, origin, duty and events; never stored or client-asserted |
| EVD-008 | Record versions authored outside the duty process are visible as such and can be adopted by the duty-holder |
| EVD-009 | Standing is audience-relative (member, official, platform, institution, independent verifier) |
| EVD-010 | Pipeline stage determines which acts and labels apply |
| EVD-011 | Claim evidence rises only through support, observation attestation or a finding, never by admission alone |
| BYL-009 | Legal content routes to the programme manager for validation and to TA/Union for advice; fixed "no legal advice" disclaimer |
| PRV-007 | Test-data mode, scheduled purge-to-seed, residency switch, synthetic-identifier guard |
| PRV-008 | Retention is a per-category policy with a conflict flag |
| PRV-009 | Identifier format policy: synthetic-only pattern in test mode; advisory (non-rejecting) NRC validation in real mode; previous-number links; masked citizenship digit |
| BYL-010 | Registrar-issued forms (Forms 2, 3, 4, 5) are typed issued documents that drive registration, amendment, refusal and cancellation findings |
| GOV-008 | Resolutions conflicting with the by-law of record are held as draft and released when the by-law amendment reaches the release trigger (default: registered) |
| BYL-011 | Statutory seeds carry section, source instrument and a validation status on the scale `needs_legal_validation` → `text_checked` → `validated` |
| PRV-010 | Every processing purpose has a lawful basis (consent, legal obligation, contract...). Statutory register fields use legal obligation; public inspection shows only statutory fields |
| GOV-009 | Committee composition findings: at least three members, not employees, elected from members |
| ID-006 | Registered name checks: ends with "Limited" and includes "co-operative" (s.12(2)), with the Registrar's exemption for unions and federations (s.78); advisory findings |
| MTG-007 | Statutory voting and meeting rules seeded as `statute`-sourced: one vote, no proxy, casting vote, special resolution, by-law amendment majority |
| MTG-008 | Statutory board-meeting rules: seven days' notice, one-third requisition, quorum of at least one half of directors, minutes of every meeting, interest disclosure and exclusion |
| MTG-009 | Director removal by two-thirds of those present; Registrar-appointed management for up to one year when all directors are removed |
| GOV-010 | Director term limit (six consecutive years, one-year lapse) and the statutory grounds on which a director's office becomes vacant |
| GOV-011 | Chairperson and vice-chairperson eligibility: members, not chair/vice of another society, not direct employees |
| GOV-012 | Appointment sources differ by office: directors, chair, vice and committees are elected; other officers may be appointed by the board |
| BYL-012 | Schedule I required-provisions checklist applied to every by-law version; Schedule II optional matters catalogued |
| ID-007 | Societies registered under the repealed 1970 Act are deemed registered (s.85); old certificate forms accepted |
| ID-008 | Minor members are not accepted by default (`allow_minor_members` off) pending the legal reviewer, although s.24 permits them |
| PRV-011 | A non-officer may not inspect another member's accounts without that member's written consent or a general-meeting resolution (s.59(2)) |

## 13. Statutory rule seeds from the Co-operative Societies Act, 1998 (text-checked: ss.1–60(3)(a), 74–85 and the Schedule)

Source: Act No. 20 of 1998 as uploaded on 3 November 2026 (first upload: arrangement of sections and ss.1–41; second upload: the scanned Act with ss.10–60(3)(a), 74–85 and the Schedules, pages 244–247 missing). Status of every row: `text_checked`, not `validated`. Rows are data in `legal_sources` and `requirement_definitions`, never code. The legal reviewer may amend them; Symphony does not provide legal advice.

| Seed | Section | Rule | Used by |
|---|---|---|---|
| S-001 | 8 | A co-operative with ten or more members registers within twelve months of adopting its by-laws | Setup findings |
| S-002 | 10(b) | Registration requires by-laws that provide for regular audits and for education, training and advisory services to members, and are not ultra vires | Requirements: audit, education |
| S-003 | 12 | Certificate of registration issued by the Registrar; name ends with "Limited" and includes "co-operative" unless otherwise provided | ID-006 |
| S-004 | 15 | Refusal gives reasons within 30 days; appeal to the Minister within 30 days, then the High Court | Form 3 handling |
| S-005 | 20 | By-laws amended by resolution of two-thirds of members present at a general meeting; an amendment takes effect only after registration; four copies signed by the chair of the meeting and the secretary go to the Registrar | By-law versions; BYL-004; MTG-013 |
| S-006 | 21 | By-laws, regulations and list of members kept open to inspection at the registered office: members free of charge, the public on a prescribed fee | PRV-006, O-19 |
| S-007 | 24 | Minors may be members; under-18s may execute instruments | ID fallback identifiers; O-21 |
| S-008 | 28 | Register of members and shares/fees: names, addresses, occupations, shares or fees, date registered, date ceased; prima facie evidence; list furnished to the Registrar and open to inspection there on a fee | Member register class; retention start |
| S-009 | 29 | One vote per member or delegate; no proxy voting; limits on plural voting; chairperson has a casting vote on equality | MTG-007; MTG-015 |
| S-010 | 2 | "Special resolution": three-quarters of members or delegates present at a meeting called for the purpose, with at least 21 clear days' written notice | Resolution classes; notice finding |
| S-011 | 37 | Expulsion: written notice of complaint, board hearing, report to general meeting, two-thirds resolution, member informed within two weeks, no re-admission for two years | Membership rules |
| S-012 | 38 | Board number per by-laws; elected by members at an annual general meeting from among members; first directors are those named in the registration application | GOV rules |
| S-013 | 39 | Committees established at the annual general meeting; at least three persons each, not employees, elected from among members; board may delegate functions | GOV-009 |
| S-014 | 5 | Board sends the Minister an annual report within six months after each financial year | Compliance obligation |
| S-015 | 34, 36 | Former and deceased members' liability continues for two years; withdrawal rules | Membership rules |

### 13.1 Additional seeds from the full Act upload (ss.42–85 and the Schedule)

Same status rule: `text_checked`. The upload is a scan with OCR errors, so Schedule I wording and letter labels carry low confidence and must be confirmed by the reviewer.

| Seed | Section | Rule | Used by |
|---|---|---|---|
| S-016 | 42(1) | The society elects from its members a chairperson and vice-chairperson who may not be chairperson or vice-chairperson of any other co-operative society nor a direct employee of the society | GOV-011 |
| S-017 | 42(2) | The board may appoint such officers as it considers necessary to assist it, on terms it determines | GOV-012 |
| S-018 | 43 | Director's term is prescribed by the by-laws; no director holds office more than six consecutive years from first election; eligible again after a lapse of one year after the end of the initial period | GOV-010 |
| S-019 | 44 | Casual vacancy: remaining directors may fill it until the next general meeting unless the by-laws provide otherwise; if directors fall below the by-law quorum they must forthwith call a special meeting. The office becomes vacant on: removal (s.47); resignation on at least one month's written notice; holding any remunerative office in the society; bankruptcy; unsound mind; knowing failure to disclose an interest in a contract with the society; imprisonment over six months; lawful detention over three months; gross misconduct under the by-laws; death or ceasing to be a member | GOV-010, GOV-014..017 |
| S-020 | 46 | Board sets its own procedure; meeting called by the chairperson on at least seven days' notice (shorter if urgent) and must be called on written request of one third of directors; quorum never less than one half of the directors; minutes of every meeting; a director (or whose spouse) privately interested must disclose, not take part or vote unless the board directs, and the disclosure is minuted. Same rules apply to committees (s.39(6)) | MTG-008 |
| S-021 | 47 | A general meeting may, absent by-law provision, remove a director by resolution of at least two thirds of members or delegates present; if all are removed it may by two thirds authorise the Registrar to appoint officers to provide management and administrative support for a term not over one year | MTG-009 |
| S-022 | 41(3) | The board examines officers' reports, informs members, presents to the annual general meeting an income and expenditure report and budget, a report on the board's work, and **the audited accounts** | Duty Matrix: board reports |
| S-023 | 58 | Seal: device set by the board, engraved with the registered name, **kept by the secretary**; affixing authenticated by the chairperson or vice-chairperson and the secretary or one other person authorised by board resolution | Duty Matrix: seal custody |
| S-024 | 59 | The board keeps proper books of account; records open to any member or delegate at the registered office during office hours; a person who is not an officer, or authorised by a general-meeting resolution, may not inspect another member's accounts without that member's written consent | PRV-011 |
| S-025 | 60(1)–(3)(a) | Annual audit by an auditor or a person publicly carrying out the profession of an accountant in Zambia, **engaged by the board with the approval of the general meeting** (the text gives no Registrar approval); the auditor reports to the members and the Registrar. The rest of s.60(3) is on pages missing from the upload | Audit requirement |
| S-026 | 77–79 | Unions and federations register like societies; the Registrar may exempt them from using the word "co-operative"; a union or federation **shall not interfere in the general operations** of a member society | ID-006; union TA scope |
| S-027 | 81 | Registrar cancels registration for fraud or mistake, illegal purpose, wilful contravention after notice, membership below the minimum, a special resolution to wind up, or no longer in business; at least 14 days' written notice plus publication in the Gazette and a local newspaper (not for a society that resolved to wind up); any member may appeal to the Minister within 30 days; the society then ceases to carry on business | ID-003 (Form 5) |
| S-028 | 82 | On cancellation the Registrar appoints a liquidator; assets and liabilities vest in the liquidator; the Companies Act applies with modifications | Organisation states |
| S-029 | 83(2) | Regulations prescribe forms, fees and **the form of yearly or other financial returns and reports to be filed with the Registrar** | Annual return (source of the form still to find) |
| S-030 | 85 | The 1970 Act is repealed; societies and by-laws registered under it are deemed registered under the 1998 Act; a non-complying society is cancelled unless members by special resolution re-constitute it within one year | ID-007 |
| S-031 | Schedule I (s.19(1)) | By-laws must deal with: name; registered office and postal address; objects; share value and payment terms; qualifications for membership; minimum shares, instalments and allotment; terms for interest of members where no share capital; entrance fee; annual membership fee; purposes for which funds may be applied; composition of the board; distribution of net surplus or covering of a loss; conditions for withdrawal; geographical area; term of office of the board; annual general meetings, notices, agenda and voting; remuneration of officers; reserve fund; dates of the financial year; extent of non-member business; other matters the Registrar requires | BYL-012 |
| S-032 | Schedule II | By-laws may deal with: liability of members (shares, guarantee or unlimited); plural voting rights; additional funds, in particular for education and training; investment shares; committees; honoraria for officers | BYL-012 |
| S-033 | 35, 48–56 | Debts owed by a member are a first charge on that member's assets (subject to prior claims); specified charges are void against the liquidator and creditors unless particulars are registered with the Registrar of Agricultural Charges within 30 days; the society keeps a register of charges; creditors and members inspect free, others on a fee | Financing/operational module (X-10) |
| S-034 | 34, 37(6) | A former or deceased member's liability for society debts continues two years; an expelled member cannot be re-admitted for two years | Retention floor (O-23) |
| S-035 | 74–76 | Credit unions: board sets interest rates; cash reserve of at least ten per cent of liabilities; the Banking and Financial Services Act does not apply | Credit-union module (not in scope) |

**Still not checked (`needs_legal_validation`):** pages 244–247 are missing from the upload. They contain the rest of s.60(3) onward: s.61 liability of auditor, **s.62 yearly and other returns**, s.63 investigation by the Registrar, ss.64–67 amalgamation, transfer of engagements, registration with other authority and division, and ss.68–73 credit unions (registration, name, membership, loans) (O-22). Pages 223–226 (ss.1–9) are also absent from this second upload but were read from the first. The founder's default rules (chairperson and vice-chairperson distinct persons; audit-committee members not on the Board) remain `founder_default`; s.42(1) supports the first only by implication.
