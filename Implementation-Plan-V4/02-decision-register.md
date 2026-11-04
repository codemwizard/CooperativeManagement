# 02 — Decision Register

Sections: §1 ADRs · §2 how your answers were applied · §3 plain-language answers to the questions you asked me to explain · §4 conflicts needing your ruling · §5 open items.

Status key: **Accepted** = your decision, applied as stated · **Proposed** = my architectural decision, effective unless you veto · **Needs ruling** = see §4.

## 1. Architecture decision records

| ADR | Decision | Status |
|---|---|---|
| 001 | **Lift all freezes** (V3 freeze, R25/R33 engine freeze, Week-3 re-freeze). Still binding: no real lender names, honesty/anti-overclaim language, personal-data boundary R29, forbidden-term rules, and every invariant classed HARD in `03` §10. | Accepted |
| 002 | **Workspace shells first.** Guided journeys are built later, on top of a complete and stable workspace. Existing journeys stay as the legacy demo until the workspace reaches parity, then are retired and rebuilt as guided journeys on the stable workspace (round 2, O-7). | Accepted |
| 003 | **The prototype becomes database-driven.** It no longer stays static; it guides the new DB-backed build. Zero-network (X4) and no-backend rules apply to the legacy app only. | Accepted |
| 004 | **Keep the ESG Index and EQS as they are.** Both are evidence-quality measures, not commercial ESG scores. Preserve all documentation of how they work and where they are heading (`08`). | Accepted |
| 005 | **Stack:** TypeScript end to end; PostgreSQL 16 or later (plain, no vendor-specific features); Node API (Fastify) with Zod schemas; Kysely + SQL migrations; Cucumber.js for BDD; Testcontainers/Docker Postgres for integration; React Router in the new workspace app. Vendor-neutral so the database can be hosted in Zambia. | Accepted (round 2, O-8) |
| 006 | **Pure domain package** (`packages/domain`): no I/O, no React, no `pg`. Shared by API, workspace and tests. Enforced by dependency-cruiser. | Accepted (round 2; your note "ADR -060" read as ADR-006) |
| 007 | **Legacy quarantine:** the current app and engine stay at repo root, unmodified except to keep their tests green, until parity. New code lives in new workspaces. | Proposed |
| 008 | **Advisory by default, enforceable by configuration.** Every governance rule has an `enforcement_mode` of advisory, warning or blocking, per organisation and per rule. Default advisory. Integrity rules (HARD) are never configurable. Dual sign-off, quorum and eligibility are therefore configuration, not code. | Accepted (your decision 4) |
| 009 | **Duty Matrix** (replaces the round-1 record-class table; `03b` §4). For each record class: who prepares/submits (duty-holder), who approves, approval mode, approvers required. Chairman, Vice-Chairman, Secretary and Treasurer may admit all classes; duties decide draft versus official, and work done outside the duty process stays visible. | Accepted |
| 010 | **Internal Field Verifier** is a *capacity* (additive to any role, or a dedicated user), bound to one organisation, producing findings of assurance class `cooperative_internal`. Field Agent is a separate capacity that captures and attests observations. | Accepted (brief + decision 4) |
| 011 | **Assurance class** is a dimension on every finding: `cooperative_internal`, `platform`, `independent_external`, `institutional`. Evidence level (`asserted/supported/verified`) is retained as a derived projection so destinations keep working. Destinations gain optional `min_assurance`, default `any`, so the 30 expected results do not change. | Proposed |
| 012 | **Source precedence** is a versioned policy: **REVISED in round 2:** statute > by-law of record (the version submitted to the Registrar) > resolutions > default. A resolution that conflicts with the by-law of record is held as `draft` until the by-law is amended and re-submitted. Legal registration status is tracked separately (§6). | Accepted (round 2) |
| 013 | **Position combinability defaults:** any position may be combined except Chairperson with Vice-Chairperson; audit-committee members may not sit on the Board. Violations are findings in advisory mode. | Accepted; reading confirmed (round 2) |
| 014 | **PII engineering:** NRC and other identifiers encrypted at field level; HMAC blind index for de-duplication; role-based masking; events carry no PII. `KeyProvider` port: local implementation now, OpenBao later. | Accepted |
| 015 | **Consent and retention:** consent recorded per person per purpose before PII entry; withdrawal supported; one-year post-exit hold, then crypto-shred or anonymise. Parameters flagged `needs_legal_validation`. | Proposed (your notes; legal status unverified) |
| 016 | **Hosting and residency:** deployment target must be an approved location for personal data. **REVISED in round 2:** test data only, database purged periodically to seed data, but the architecture behaves as if the Data Protection Act and residency rules were enforced. | Accepted (round 2) |
| 017 | **Offline-tolerant commands:** every command carries a client-generated command id, `occurred_at`, `device_id` and expected version, so rural enrolment can be captured offline and replayed idempotently. Offline UI is a later phase; the contract exists from day one. | Proposed |
| 018 | **Identity-check method is configuration.** Methods: `otp`, `in_person_attested`, `document_sighted`, `password`. An authentication event never proves a cooperative fact. | Accepted (your answer 20.1) |
| 019 | **Platform enroller checks** are recorded as scoped `platform` checks on an exact evidence version, labelled with what was actually done. Third parties may record reliance but keep their own due diligence. A second-reviewer policy is available. **REVISED in round 2:** see §6 (enroller wears two hats; proxy entry is `supported`, the platform check is a separate act). | Accepted (round 2) |
| 020 | **Union/TA scope** is a delegation chain: NABII/programme manager delegates Technical Assistance scope to a union, which sees only assigned cohorts, full capability gaps, **no member PII or sensitive data**. | Accepted |
| 021 | **Dossier export payload unchanged** for now; extended only with provenance fields in Phase 8. | Accepted |

## 2. How your answers were applied

### 2.1 "Unresolved decisions answered" (spec-pack §10)

| Question | Your answer | Applied as |
|---|---|---|
| Dual sign-off | Organisations decide; make configurable | `approval_policy` rows per record class (required approvers, distinct actors); default one approver, advisory. ADR-008/009 |
| Who admits evidence | Everyone may, but lifecycle label depends on admitter's role; roles for official evidence per the requirements spec | Record-class policy; officers admit all classes; others supply and get a lower label. ADR-009 |
| Exclusive/combinable positions | All combinable except Chairman, Vice-Chairman; audit-committee members not on Board | `position_combination_rules` seeded; findings. ADR-013, C5 |
| Historical appointment evidence | Same append-only process | Past appointments are ordinary appointments with `recorded_late` provenance; no special table |
| Quorum/notice/voting/minutes rules | You asked me to explain | §3.1 |
| External registration of resolutions | You asked me to explain | §3.2 |
| By-law interpretation | Chairman or Vice-Chairman | `interpretation_approval` authority on provision confirmation |
| Membership classes, transfer, cessation | From by-laws | Extracted provisions → `membership_rules`; no platform defaults |
| Legal catalogue verified against law | You asked me to explain | §3.3 |
| Person de-duplication | By NRC | Blind-index match → duplicate *review*, never silent merge; plus fallback identifiers (O-9) |
| Privacy basis | You asked me to explain | §3.4 |
| PII, retention, deletion | DPA; initial encryption + masking; OpenBao later | ADR-014/015 |
| Enroller permissions before handover | You asked me to explain | §3.5 |
| Field agent: capture or attest | Both; authority limited to employing organisation | Field Agent capacity; findings scoped to `employer_org_id`; external parties do their own due diligence |

### 2.2 "Decisions before implementation contracts" (spec §20)

| # | Your answer | Applied as |
|---|---|---|
| 1 Enroller identity checks | Enroller checks board identities, registration, ZRA, chief/headman letters, in person; acts as an independent verifier third parties can rely upon; rural, so OTP may be impossible | ADR-018, ADR-019, ADR-017. Rely/due-diligence tension: C1 |
| 2 Self-enroller to authorised user | Yes; certificate required; must log out and log in as the created role | Handover plus acceptance record; same-person link and finding (C4); certificate gate (C8) |
| 3 Enroller actions without confirmation | Enroller is a proxy acting with the representative present | `enrolment_session` with presence attestation; §3.5 |
| 4 Admit by class | Chairman, Vice, Secretary, Treasurer admit all; duties decide draft versus official | ADR-009 |
| 5 What is official | Illustrative by-laws are guidance only | Per-class table seeded from the requirements spec, editable per organisation |
| 6 Minutes approval | Secretary takes; Chairman/Vice approve; Symphony marks, does not stop submission | Advisory labels (SC-008 advisory variant) |
| 7 Joint/combined/vacant/overlap | Symphony only records, highlights non-compliance | Findings; no blocking |
| 8 Legal requirements | Notes supplied | Seeded as `proposed_legal_interpretation`; C7 |
| 9 Statutory vs by-law vs practice | Known only once by-law is known; default to §8 notes | Requirement `source_type` set after provision confirmation; default catalogue until then |
| 10 Conflicting sources | Later resolution supersedes by-law | ADR-012 (C3) |
| 11 Pending registration | Pending by-law is the superior by-law; flag registrar update | ADR-012 two-projection design (C2) |
| 12 Retention/privacy/consent | Your research notes | ADR-014/015; C6, C7 |
| 13 Union role | Technical Assistance scope delegated from NABII/programme manager | ADR-020 |
| 14 Capability gaps visibility | Full gaps for cooperative users; no other members' PII | ADR-020; field-level masking |
| 15 Dossier payloads | Leave as is | ADR-021 |

## 3. Plain-language answers to what you asked me to explain

### 3.1 "Quorum, notice, voting and minutes approval rules by meeting type"

Every meeting has rules about how it must be held, and they differ by meeting type and by cooperative. The illustrative by-laws show the pattern:

- **Quorum** (how many must be present): general meetings need two-thirds of members on the register (by-law 8.02); Board meetings need at least six directors including the Chairperson or Vice-Chairperson (by-law 18).
- **Notice** (how early and how): members wanting an item on the AGM agenda give written notice seven days ahead (by-law 33.02).
- **Voting**: elections by ballot, other matters by open vote unless a ballot is demanded (33.03–33.04); the chair has a casting vote (21); expelling a member needs two-thirds of those voting (3.11).
- **Minutes approval**: the AGM order of business includes approving the previous AGM's minutes (8.03b).

The question was: where does Symphony get these numbers? **Answer applied:** from the cooperative's own confirmed by-law provisions, stored as structured `meeting_rules` per meeting type. If a rule is not in the by-laws, Symphony records "rule unknown" and raises a finding; it does not invent a default. A meeting is always recordable. Quorum is calculated and shown, never enforced.

### 3.2 "Which resolution classes require external registration"

Some decisions are not final until someone outside the cooperative acts. By-law amendments are the clear case: no alteration is valid until the Registrar approves it (by-law 33.09; the Act's by-law-amendment section, whose number must be confirmed against the 1998 Act, see §6 C7). Others may exist, for example disposal of real estate, change of area of operation, or dissolution. Symphony needs a flag per resolution class: "after this passes, an external step is required, and who does it". **Answer applied:** by-law amendment is seeded as requiring Registrar action; every other class defaults to "not flagged", editable from the confirmed by-laws and legal review. When flagged, the resolution's status is `pending_external_action` and a finding names the missing step.

### 3.3 "Which legal catalogue entries are verified against current law"

The platform stores a catalogue of legal references (for example "by-laws must provide for regular audits", with its Act section and source). Someone must check that each entry matches the law now in force, including amendments, and record that check. **Answer applied:** every entry carries `legal_validation_status` (`needs_legal_validation` → `validated` by a named reviewer on a date, with the source). Unvalidated entries are shown as guidance and never block. **Your decision needed:** who is the named legal reviewer (O-6).

### 3.4 "Privacy basis"

Under data-protection law you need a lawful ground for each purpose for which you hold personal data, such as consent, contract, or legal obligation. De-duplicating by NRC means processing NRC numbers, so the ground must be recorded. **Answer applied:** a `consent_records` table: person, purpose (cooperative record-keeping; sharing identifiable data with an institution; sensitive data), evidence of consent (written, digital, or enroller-witnessed), date, and withdrawal. Consent is captured before PII entry; withdrawal is supported. **Your decision needed:** confirm the purpose list (O-4).

### 3.5 "Enroller permissions before handover"

At first enrolment nobody from the cooperative has an account, so who may do what? You answered that the enroller is a proxy working with a representative beside them. **Applied:** each assisted session records the present representative, the NRC sighted, and their consent for the enroller to act. Proposed limits:

| Enroller may (representative present) | Enroller may not |
|---|---|
| Create the workspace; record identity facts | Approve minutes or any official record |
| Collect and upload documents; sight originals | Activate an appointment as authoritative on their own say-so |
| Record a platform check with its exact scope | Admit evidence as the cooperative's official record |
| Record election results as *collected evidence* | Verify evidence they themselves collected (second reviewer instead) |
| Hand over to officers | Act when no representative is present (session cannot start) |

## 4. Conflicts that need your ruling

Each conflict has my default; if you say nothing, the default applies and is marked Proposed.

| ID | Conflict | Default I applied |
|---|---|---|
| **C1** | You want the enroller to act as an **independent verifier third parties can rely upon**. The spec forbids supplier self-verification and says platform involvement must not relieve others of due diligence. The enroller both collects and checks. | Enroller records a `platform` check (scope and limits shown), not an independent verification. Institutions may record reliance but keep their own diligence. Optional second-reviewer policy upgrades the standing. |
| **C2** | Your rule: a by-law pending registration is the superior by-law. The spec (§6.1) and the by-laws themselves (33.09) say an amendment is not valid until registered. | Two projections. *Operative in practice* follows your rule. *Legal registration status* stays `pending`. A standing finding says "operating under an unregistered amendment; Registrar registration required". No claim of legal effect. |
| **C3** | Your rule: a later resolution that contradicts a by-law supersedes it. The Act and by-laws may say otherwise; the spec says conflicts are findings. | Implemented as a configurable precedence policy, default as you stated, with a finding on every override. Legal review can change the policy with no redesign. Statute is never overridden. |
| **C4** | The self-enroller creates role accounts, then logs in as one. The same human then holds the authority they created, which is the "undue power" the platform wants to prevent. | Allowed. Authority origin is labelled `self_asserted_by_enroller`; a finding stays open until an independent acceptance is recorded. No blocking. |
| **C5** | "Combinable except Chairman, Vice-Chairman and audit committee members should not be on board" is ambiguous. | Read as: (a) Chairperson and Vice-Chairperson may not be the same person; (b) audit-committee members may not be Board directors. Everything else combinable. Please confirm. |
| **C6** | Your notes say personal data must be stored in Zambia (DPA s.50) unless waived; the current host is a global static platform. | No data leaves the design's PostgreSQL. Hosting choice needed before any real personal data is loaded. Until then only synthetic data is used. |
| **C7** | The supplied legal notes are unverified and internally inconsistent: board term limit cited to section 38 while the spec lists director terms at section 43; one cited source URL appears to be a 1970 Act, not the 1998 Act; several DPA section numbers are unconfirmed; sources include social-media and document-sharing pages. | All seeded as `proposed_legal_interpretation`, none blocking, none shown as settled law. |
| **C8** | You say a self-enroller must hold a registration certificate; the spec says identity can be recorded without one. | Workspace creation needs no certificate. *Submitting a self-enrolment for activation* requires certificate evidence (configurable policy). Platform-assisted enrolment may proceed without. |
| **C9** | You say evidence admission is allowed to all with differing labels; the spec matrix says self-enrollers cannot admit by default. | Officers and verifiers admit; everyone else supplies. Resulting label comes from the record-class policy. |
| **C10** | The ESG Index uses tier letters A–D, which resemble commercial ratings. | Kept as is. I recommend a one-line caption "Evidence-quality measure, not an ESG performance rating" wherever it appears; your call. |

## 5. Open items

| ID | Item |
|---|---|
| O-1 | Who assigns the Internal Field Verifier capacity? Proposed: Chairman or Vice-Chairman, or the enroller on the cooperative's behalf during assisted enrolment |
| O-2 | "Ultimate cooperative verifier": proposed meaning is the highest *cooperative-internal* assurance; officers can dispute but not edit a finding. Confirm |
| O-3 | Default record-class table (`03` §6): please review the seed values |
| O-4 | Consent purpose list (§3.4) |
| O-5 | Approved hosting location (C6) |
| O-6 | Named legal reviewer for the statutory catalogue |
| O-7 | Fate of legacy journeys after parity (retire, keep as demo, or rebuild as guided journeys) |
| O-8 | Stack ratification (ADR-005) |
| O-9 | Members without NRCs (under-16s, some rural members): fallback identifiers and de-duplication rules |
| O-10 | Retention exceptions: debt liens, litigation holds |
| O-11 | Whether the enroller's in-person check should count toward destination `min_assurance` |

> **Round 2 (3 November 2026):** §4 and §5 above are the round-1 record. §6 below records your rulings and supersedes them where they differ. Statuses in §1 were updated in place.

## 6. Round 2 rulings (your reply of 3 November 2026)

### 6.1 Conflicts C1–C10

| ID | Your ruling | What changes in the pack |
|---|---|---|
| C1 | The enroller is **not** both collecting and checking. As proxy for the cooperative, the enroller's entries are in an attestation/`supported` state. Separately, as an independent party doing Symphony's due diligence on source/provenance records, the enroller is also a second reviewer. | Two hats, two acts. Proxy entry: origin `platform_enroller_proxy`, level `supported`, requires an enrolment session. Platform check: separate act, assurance class `platform`, scoped to source/provenance review. The person-level conflict rule (IFV-6) keeps applying to the cooperative's *supplier and collector*; the proxy operator is a third category (`proxy_operator`) whose same-person check is allowed **with a visible disclosure flag** and an optional `require_distinct_reviewer` policy (default off). Details: `03b` §5 |
| C2 + C3 | **Reversed.** By-laws submitted to the Registrar take precedence over resolutions. Conflicting resolutions are held as `draft` until the by-law is adjusted and re-submitted to the Registrar. | `03` §5 and ADR-012 rewritten. No more "operative in practice includes pending amendments". Resolution state `held_draft` with finding FND-GOV-020. Release trigger is configurable: `submitted_to_registrar` (default, matching your words) or `registered_current`. Legal status label `registered_effective` still needs registration evidence (HARD) |
| C4 | Not a contradiction. The self-enroller is a **placeholder initiator** who registers the cooperative on the platform and hands over to an institutionally recognised role. They may be the Chairman or Secretary, or a delegate with no attachment. Scope is limited to: submit the registration certificate details, then create only Chairperson, Vice-Chairperson or Secretary accounts. They log out; the right person logs in with a temporary password and starts onboarding in that capacity. | `03` §3 rewritten. Self-enroller is a distinct actor type with a three-action scope; no appointment, no admission, no evidence write beyond the certificate details. Temporary credentials: forced change at first login, expiry, single use, audit event. The initiator account is closed at handover. The same-person finding is removed |
| C5 | Confirmed as written | ADR-013 final |
| C6 | Test data only; database purged periodically leaving seed data. Architecture still behaves as if the Data Protection Act and sovereign residency were enforced. | ADR-016 revised. New requirement PRV-007 (test-data mode, scheduled purge-to-seed, residency switch, synthetic-identifier guard) and BDD scenarios |
| C7 | You supplied the parliament.gov.zm Act PDF. | **Finding:** that file is the *Co-operative Societies Act, Chapter 397* (Act No. 63 of 1970, as amended by No. 13 of 1994). The *Co-operative Societies Act, 1998 (No. 20 of 1998)* repealed the 1970 Act and commenced under SI 24 of 1999; the 1999 instrument is **Regulations** (SI 26 of 1999), not Rules. The section numbers in that PDF (for example s.21 amendments, s.22 inspection, s.126 quorum) do not carry over to the 1998 Act, and the notes you supplied mix both. The 1998 text is published separately (for example the FAOLEX and ICNL copies). Everything in the catalogue stays `needs_legal_validation`, section numbers are stored only after the reviewer confirms them, and the `legal_sources` entry records which instrument and version each citation points to. I did not read the 1998 text end to end |
| C8 | **Certificate is mandatory** for all onboarding (self and assisted). It is the foundation that keeps junk accounts out. | `03` ID-001/ENR-009 rewritten. Workspace creation requires the registered name, registered and postal address, date of registration and the certificate document, plus the registration number where printed (the prescribed certificate, Form 2, does not itself list a number). It stays `asserted` until checked (platform check or IFV). Proposed: activation also requires a platform check of the certificate (policy `activation_requires_platform_check`, default **on**; see O-12) |
| C9 | Resolved by C4: self-enrollers only submit the certificate details and create user accounts; the created user admits it. | Certificate evidence admitted by the first officer account after login |
| C10 | Approved | Caption "Evidence-quality measure, not an ESG performance rating" added wherever the ESG Index or EQS appears (`09`, `08`) |

### 6.2 Open items O-1…O-11

| ID | Ruling | Applied |
|---|---|---|
| O-1 | Approved | IFV capacity assigned by Chairperson/Vice-Chairperson, or by the enroller on the cooperative's behalf |
| O-2 | Approved | IFV-5 final |
| O-3 | Left open, but you replaced it with the evidence-state guidance | Round-1 table superseded by the **Duty Matrix** in `03b` §4; seeds still need your review (O-13) |
| O-4 | Approved, using the consent table | `consent_records` as designed |
| O-5 | Resolved by C6 | |
| O-6 | Named legal reviewer: the **Programme Manager / NABII equivalent**, who passes items to the right TA/Union to advise cooperatives. **Symphony does not provide legal advice.** | Role `programme_manager` holds `legal_catalogue.validate`. Findings with legal content route to an advisory queue for TA/Union. A fixed disclaimer shows wherever legal content appears: "Symphony does not provide legal advice." |
| O-7 | Rebuild as guided journeys | Legacy journeys are retired after parity and rebuilt as guided journeys over the stable workspace (Phase 10) |
| O-8 | Approved stack | ADR-005 Accepted |
| O-9 | Use fallback identifiers | `person_identifiers` typed (NRC, passport, birth certificate, community-attested ID, none) with a precedence list; duplicate review uses whichever blind indexes exist |
| O-10 | Retention needs lawyer advice. Default one year after end of use. There is tension between the right to erasure and a 10-year Bank of Zambia transaction-record retention. | Retention is a per-category policy (`retention_policies`): personal membership data defaults to one year after end of use; transaction/financial records carry `retention_conflict_review_required`. Where both apply, the design pseudonymises the person (crypto-shred PII) and keeps the transaction facts under the pseudonymous id. Both parameters are `needs_legal_validation` |
| O-11 | Yes for the Symphony platform; third parties may decline | Acceptance is per audience: `platform` class counts toward Symphony programme/readiness views; each institution sets its own accepted classes. `03b` §6 |

### 6.3 New open items from this round

| ID | Item |
|---|---|
| O-12 | Confirm default **on** for `activation_requires_platform_check` (certificate checked by an enroller or staff before activation) |
| O-13 | Review the seeded Duty Matrix (`03b` §4), especially treasurer, committee and audit rows |
| O-14 | Confirm the claim-entry table (`03b` §3): officer entry = `supported`; field-agent *observation* = `verified[cooperative_internal]` |
| O-15 | Release trigger for held resolutions: `submitted_to_registrar` (your wording, default) or `registered_current` |
| O-16 | Confirm which instrument is the in-force source for the catalogue: Act No. 20 of 1998 and the 1999 Regulations (my finding in C7) |
| O-17 | Test-mode identifier guard: which reserved synthetic NRC range should the system accept in test mode? |

## 6.4 Round 3 rulings (your reply on O-12 to O-17)

| ID | Ruling | Applied |
|---|---|---|
| O-12 | Confirmed | `activation_requires_platform_check` default **on** (ENR-007 scenario) |
| O-13 | Approved | Duty Matrix v1 in `03b` §4 is the seed |
| O-14 | Confirmed | Claim-entry table in `03b` §3.2 is final: officer entry `supported`; field-agent or officer **observation** `verified[cooperative_internal]` |
| O-15 | Confirmed | Default release trigger `submitted_to_registrar`, configurable |
| O-16 | Confirmed: the Co-operative Societies Act No. 20 of 1998 and Statutory Instrument No. 26 of 1999 govern | Seeded as the two in-force instruments in `legal_sources`. Cap. 397 (1970 Act) is flagged `repealed instrument`. See §6.5 for what I could and could not verify |
| O-17 | Use an alphanumeric version so numbers are plainly fake | Test-mode pattern `^TS[A-Z0-9]{4}/\d{2}/[123]$` (for example `TS0001/01/1`). It cannot be a real NRC because real numbers are digits only. See §6.6 |

### 6.5 Legal sources: what I verified

- **Verified (SI 26 of 1999, read from the Zambialii copy):** it is the *Co-operative Societies Regulations, 1999*, made under section 83 of the Co-operative Societies Act (Act No. 20 of 1998). It repeals the 1972 Rules. It prescribes six forms: Form 1 application for registration, **Form 2 certificate of registration**, **Form 3 notice of refusal** (of registration, or of by-law amendments), **Form 4 certificate of amendment of by-laws** (issued when the Registrar is satisfied the amendments conform to the Act), **Form 5 notice of cancellation** (14 days; appeal to the Minister within 30 days) and Form 6 application for membership.
- **Consequences for the design:** the evidence that an amendment is registered is the Form 4 certificate; a refusal is Form 3; a cancellation notice is Form 5. These are now typed issued documents (BYL-010) with findings (ID-003, BYL-005). The Act section for by-law amendments appears to be section 20 (Forms 3 and 4 cite section 20(2)–(4)); registration refusal cites section 15(1) and cancellation section 81(1). I have not confirmed these against the Act text.
- **Doubt on the earlier notes:** Form 1 item 8 cites **section 38(2)** for the first directors who direct affairs until the first annual general meeting. That suggests section 38 is about initial directors, not a six-year term limit as the supplied notes say. Treated as unverified.
- **Not verified:** the parliament.gov.zm Act PDF you linked this time could not be fetched (the site blocks automated access), so I did not read the 1998 Act text. All section references stay `needs_legal_validation` until the programme manager validates them.

### 6.6 NRC format (your note)

Your description (`XXXXXX/XX/X`: sequence, issuing district, citizenship category 1/2/3; new chip cards carry a previous number) is adopted with these consequences:

1. **Test mode:** only synthetic identifiers matching `^TS[A-Z0-9]{4}/\d{2}/[123]$`. Anything else is rejected.
2. **Real mode:** the numeric pattern is **advisory only**. A mismatch raises a warning and never rejects, because, as your source says, validation must not reject variations. (PRV-g)
3. **Re-issued cards:** `previous_nrc` is stored as a linked identifier, so de-duplication matches either number through blind indexes.
4. **Citizenship digit:** it reveals citizenship category, so it is masked in display and never used in a decision. This is my judgement; the legal reviewer should confirm whether it is sensitive data.
5. The source you pasted is a Stack Overflow answer and other web pages, not an official specification. It is used for test-data design only.

## 6.7 Round 4: the 1998 Act (uploaded) checked against the pack

**Coverage.** The upload contains the arrangement of sections and sections 1 to 41 (through "Functions of board"). Sections 42 to 85 and the Schedule are **not in the file**, so director terms, vacancies, removal (ss.43–47), audit (s.60), yearly returns (s.62), cancellation (s.81) and the by-law Schedule are still unchecked. Please upload the rest (O-20). I compared text only; this is not legal validation.

New validation status scale for every legal seed: `needs_legal_validation` → **`text_checked`** (the architect compared it with the Act text) → `validated` (programme manager).

### 6.7.1 Claims in your notes against the Act text

| Claim in your notes | Result |
|---|---|
| Board members must be members; elected at the AGM | **Confirmed**, s.38(1) |
| One vote per member/delegate; no proxy voting | **Confirmed**, s.29(2) |
| Registrar will not register unless by-laws provide for regular audits | **Confirmed**, s.10(b)(i); s.10(b)(ii) also requires education, training and advisory services for members |
| Open-book rule (notes say s.21) | **Confirmed**, s.21, and wider than the notes say: any member free of charge, **and any member of the public on payment of a prescribed fee**, at the registered office |
| Member register (s.28) | **Confirmed**; it is prima facie evidence of names, addresses, occupations, shares/fees, date registered and date ceased; the society must also give the Registrar a list, open to anyone at the Registrar's office on a fee (s.28(2)) |
| Lien on shares (s.27) | **Confirmed** |
| Six-consecutive-year director limit "under s.38" | **Not supported.** s.38 covers board composition and first directors. Term of office is s.43, not in the upload |
| Supervisory committee members cannot sit on the Board | **Not found** in s.39 (committees: at least three persons, not employees). Treat as the founder's default rule, not statute |
| Annual returns within three months through ZamPortal (s.62) | **Unverified**, s.62 is not in the upload. What the upload does show: the board must send the Minister an annual report within **six months** after each financial year (s.5) |
| Large unions need an external auditor approved by the Registrar | **Unverified**, s.60 not in the upload |

### 6.7.2 Pack items this changes

| # | Finding | Effect |
|---|---|---|
| 1 | **s.20(2): an amendment to by-laws "shall take effect after the amendment has been registered"**, and s.2 defines "by-laws" as the **registered** by-laws. Your ruling (O-15) set the release trigger to *submitted to the Registrar*. | Conflict between the default trigger and the Act. I kept your setting configurable but recommend the default be **`registered_current`**, because submitted-but-unregistered text is not yet the by-law in law. A middle path is available: keep release of held resolutions on submission, but evaluate requirements against the registered version and show "amendment not yet effective (s.20(2))". **Needs your decision (O-18)** |
| 2 | The member register is a **statutory, partly public record** (ss.21, 28). | Data-protection basis for those fields is *legal obligation*, not consent. `consent_records` gains `lawful_basis` (consent, legal_obligation, contract, ...). Register inspection by the public on payment of a fee is lawful; the register inspection feature must limit what it shows to the statutory fields. **Needs your decision (O-19)** |
| 3 | s.12(2): a society's name must end with "Limited" and include "co-operative" unless otherwise provided. | Advisory finding on the registered name (ID-006) |
| 4 | s.24: **minors may be members** and under-18s may execute instruments. | Fallback identifiers (O-9) are essential; consent handling for minors goes to the legal reviewer (O-21) |
| 5 | Statutory voting and meeting rules exist: special resolution = three-quarters of members/delegates present, meeting called for the purpose, 21 clear days' written notice (s.2); by-law amendment = two-thirds of members present (s.20(1)); expulsion = two-thirds (s.37); one vote, no proxy, casting vote for the chairperson (s.29). | Seeded as `statute`-sourced rules (`03` §13). The "no proxy" and "casting vote" scenarios now cite statute, not just by-laws |
| 6 | s.39: each committee has at least three persons who are not employees, elected from members. | Committee composition findings (GOV-009) |
| 7 | s.5: annual report to the Minister within six months of year end. | Compliance obligation seed |
| 8 | s.15 and s.20(4): refusal needs reasons within 30 days; appeal to the Minister within 30 days, then the High Court. | Form 3 handling shows the appeal window |
| 9 | Sections 10(b)(i) and (ii) match the specification's §6.5 statutory entries. | Those two entries move to `text_checked` |
| 10 | The by-law and Regulations seeds from §6.5 are consistent with the Act: s.20(2)–(4) amendments registered by the Registrar; s.15 refusal. | Upgraded from "appears" to `text_checked` |

### 6.7.3 New open items

| ID | Item |
|---|---|
| O-18 | **CLOSED (4 Nov 2026):** Default release trigger: **`registered_current`** per s.20(2). Configurable to `submitted_to_registrar`. | ADR-012 updated; `precedence_policies` seed updated |
| O-19 | **CLOSED (4 Nov 2026):** Register inspection supports **public** inspection on payment of a prescribed fee (Act ss.21, 28). Fee recorded by receipt reference; statutory fields only for public view. | PRV-006 / PRV-d / PRV-010 finalised |
| O-20 | **CLOSED (4 Nov 2026):** Full Act read (ss.1–60(3)(a), 74–85, Schedules I–II); all 35 seeds are `text_checked`. Cooperative registration number: **11 digits, numerals only** (Form 2, SI 26/1999). | Seeds updated; `organisation_identifiers` pattern `^\d{11}$` |
| O-21 | **CLOSED (4 Nov 2026):** Minor members: default **off** (`allow_minor_members = false`). Legal reviewer to advise on guardian consent and applicable lawful basis. | `ID-008` finalised; `membership_rules` seed set |
| O-22 | **OPEN:** Missing Act pages 244–247 (ss.60(3)(b)–73): s.61 auditor liability, s.62 yearly returns, ss.63–67 amalgamation/transfer/division, ss.68–73 credit unions. Upload when available. | Tracked |
