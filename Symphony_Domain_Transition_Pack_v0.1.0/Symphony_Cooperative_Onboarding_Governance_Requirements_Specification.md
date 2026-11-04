# Symphony Cooperative Onboarding, Governance and Compliance
## Functional Requirements and Domain/Data Model Specification

**Document status:** Development baseline — requirements and domain design  
**Product:** Symphony  
**Jurisdictional context:** Zambia  
**Primary scope:** Cooperative identity, initial enrollment, governance constitution, by-law configuration, evidence admission, official record approval, compliance-path tracking and auditability  
**Architecture target:** Relational persistence, domain-driven state transitions, evidence-led validation  
**Source basis:** `Pasted text.txt` supplied requirements and scratch notes; `prototype.zip` current prototype repository  
**Important:** This specification describes product behaviour and a proposed system model. It is not a legal opinion or a substitute for confirmation of current statutory requirements with the Registrar or qualified Zambian counsel.

---

# 1. Executive summary

Symphony must onboard cooperatives on the assumption that they may have zero or negligible formal governance capacity, fragmented records, uncertain officeholder history and limited ability to prepare institutional evidence.

The product must not assume that a cooperative arrives with a complete compliance structure. It must help the cooperative establish a transparent path from its actual starting position toward a defined governance and compliance state.

The product promise is therefore:

> Symphony makes visible what a cooperative is required to establish, what it has actually established, who has authority to act, what evidence supports each record, what remains unresolved, and what the next action should be.

The system must not manufacture compliance by completing forms. It must distinguish at least these states:

1. **Required:** a legal, registered by-law, resolution or policy source creates an obligation.
2. **Configured:** the obligation has been translated into a structured requirement and assigned to a responsible body or role.
3. **Recorded:** a person has supplied a claim, document or event record.
4. **Admitted:** an authorised actor has accepted an item into the cooperative's working evidence register, without necessarily making it an official cooperative record.
5. **Officially adopted/approved:** the authority required by the cooperative's governing rules has approved or adopted the record.
6. **Verified:** an appropriately independent verifier has made a scoped finding on a specific evidence version.
7. **Implemented:** the underlying activity or governance practice has actually occurred.
8. **Current/overdue/superseded:** temporal status is evaluated without erasing history.

These are not one linear status field. They are separate dimensions and must remain separate in the data model.

The initial release is **permissive in creation and strict in truthfulness**. Users may create incomplete governance structures and record gaps. The system must expose validation findings but must not silently block the cooperative from documenting its actual state. Enforcement rules can be introduced later without redesigning the core model.

# 2. Product outcomes and design principles

## 2.1 Outcomes

The system must provide:

- A guided enrollment path for a cooperative starting from little or no structured information.
- A trustworthy identity record that does not confuse registration evidence with current governance evidence.
- A way to define the cooperative's own governance model from its registered by-laws and valid decisions.
- A transparent register of legal, by-law and internally adopted requirements.
- A way to record governance positions separately from the people occupying them.
- A meeting, minutes and resolution workflow that changes governance state through traceable events.
- A way to distinguish supporting evidence admitted to the working record from records formally approved by the appropriate authority.
- A clear separation between platform verification, cooperative confirmation, independent verification and institutional assessment.
- A persistent history of who did what, under which authority, to which version, and with what evidence.
- A dashboard that shows the path forward rather than presenting an unsupported compliance badge.

## 2.2 Non-negotiable principles

1. **Sources are distinct.** Legislation, registered by-laws, resolutions, policies and operational practices must not be conflated.
2. **By-laws configure cooperative-specific governance.** Symphony must not impose one universal organisation chart.
3. **Positions are not people.** A position is a reusable governance definition; an appointment connects a person to it for a period.
4. **Authority is explicit.** A user's login role does not, by itself, prove that the user holds a cooperative office or has authority for a particular decision.
5. **Evidence admission is not official approval.** Admission into an evidence register does not turn a draft or third-party record into an official cooperative record.
6. **A document is not performance.** An uploaded by-law does not prove implementation; an attendance sheet does not by itself prove effective training; an audit requirement does not prove an audit occurred.
7. **Evidence levels are not interchangeable.** Self-declared, cooperative-admitted, platform-verified and independently verified records must be visibly distinguished.
8. **No self-verification.** The supplier of evidence cannot verify that same evidence.
9. **Version-specific findings.** A verification finding applies to the exact evidence version and scope examined.
10. **No destructive history.** Corrections, replacements, terminations and amendments create new events and versions; they do not erase the previous state.
11. **Permissive creation, visible findings.** Incomplete or inconsistent records can be captured during onboarding. Validation findings explain the gaps.
12. **No false legal conclusions.** The product may show a requirement as configured, evidenced or unresolved. It must not claim legal compliance or certification unless a properly defined authority and process support that claim.

# 3. Repository baseline and reuse requirements

The current prototype is a static React/TypeScript application with JSON configuration and in-memory/local browser state. It is not yet a relational application. The new implementation must preserve the following domain behaviours while replacing prototype persistence.

## 3.1 Existing components to preserve conceptually

| Existing repository element | Existing responsibility | Required treatment in relational implementation |
|---|---|---|
| `data/roles.json` | Action-to-role authorization and constraints | Preserve as an explicit permission policy model; do not rely on hidden UI controls |
| `engine/actions.ts` | Domain actions and guarded state changes | Convert to application commands/domain services with transactional persistence |
| `engine/types.ts` | Evidence, case, actor, event and verification types | Use as migration input, not as a final relational schema |
| `engine/evaluate.ts` | Destination requirement evaluation | Preserve separation between evidence state and requirement evaluation |
| `engine/pipeline.ts` | Workflow states, exceptions and intervention queues | Extend with governance/onboarding findings; do not collapse them into a single score |
| `engine/dossier.ts` | Traceable institutional export | Extend with governance source, authority, admission, approval and evidence provenance |
| `engine/crypto.ts` | Canonical record fingerprinting | Preserve honest fingerprint semantics; fingerprints are not proof of truth or identity |
| `data/capture_event_schema.json` | Interaction telemetry contract | Keep separate from the authoritative business audit log |
| `ProvenanceDrawer`, `EqsCard`, evidence chips | Visible provenance and limitations | Reuse the user-facing principle and labels, but bind to persisted domain records |

## 3.2 Current implementation gaps that must not become design constraints

- `CreateAccountJourney.tsx` hardcodes a field-agent identity and a specific user. The production flow must resolve authenticated actor identity and current authorization from persisted records.
- The current onboarding sequence is a fixed wizard. The new workflow may guide users through recommended stages, but stages must be independently saveable and resumable.
- `CoopGovernance.tsx` compares a fixed list of Chairman, Secretary and Treasurer and seeds historical certificate officers. This must be replaced. The registration certificate is not the source of current Board membership.
- The current registration UI uses fallback registration data. Production records must never silently substitute seed values for missing evidence.
- The current governance action callback in account creation is a no-op placeholder. All material commands must persist atomically and emit audit events.
- The current `Role` type and `roles.json` are not fully aligned (for example, `coop_field_agent` is used in code/configuration but is not consistently included in the declared role list). The new model must validate role definitions and permission references at build/deployment time.
- Existing demo case structures combine domain data for a prototype. The relational model must separate cooperative identity, people, governance, requirements, evidence, verification and institutional destination requirements.

## 3.3 Existing evidence semantics to preserve

The current engine distinguishes evidence levels and records supplier, timestamps, verification information, limitations, disputes and findings. The relational implementation must preserve these as first-class fields/relations.

The following conceptual rules remain mandatory:

- Re-supplying evidence creates a new version and resets any prior verification status for the new version.
- A verification finding must reference the exact evidence version it examined.
- A later evidence version cannot inherit an earlier version's verified status.
- Promotion to a higher evidence level requires a qualifying finding on that version.
- A non-conformant, inconclusive or conflicting finding cannot be silently overridden.
- Evidence disputes are separate records and have their own lifecycle.
- A record's provenance, limitation and current status must be visible wherever the record is relied upon.
- Read-only institutional roles may request evidence, raise findings or record reliance according to permissions, but must not directly edit cooperative source records.

# 4. Actors, identities, roles and authority

## 4.1 Distinguish four concepts

The system must not use a single `role` field to represent all of the following:

1. **Platform access role:** what functions a user may access in Symphony.
2. **Organizational appointment:** whether a person is currently appointed/elected to a cooperative position.
3. **Action authority:** whether that person is authorized to perform a particular action under a by-law, resolution, delegation or platform policy.
4. **Evidence provenance:** how a record was obtained and who supplied, admitted, approved or verified it.

One person may hold multiple platform roles or appointments where permitted. One platform role may be held by many users. A cooperative appointment may expire while the user's platform account remains active.

## 4.2 Required actor categories

### A. Platform administrator

- Creates and manages platform-level configuration.
- Creates, invites or activates platform enrollers.
- Assigns platform roles and operational scope.
- Manages platform-wide requirement catalogues and supported capability catalogues.
- Does not become a cooperative officer merely by administering the platform.
- Must not silently approve cooperative decisions.

### B. Platform enroller

- A platform-controlled operational identity created or authorized by a platform administrator.
- May initiate and conduct assisted enrollment within assigned scope.
- Must complete the platform's required identity/authentication checks, such as OTP or another configured method.
- May collect documents, record observations, assist with data entry and submit enrollment evidence.
- Must be clearly identified as the actor responsible for assisted collection.
- May receive a platform-verification provenance label only for the specific checks actually performed under an approved procedure.
- Must not be represented as independently verifying every claim or as approving cooperative decisions.

A platform employee's involvement raises confidence in collection provenance only within the platform; it does not automatically establish the truth of the cooperative's claims nor grant any external body with implicit or explicit rights to foregore their own due diligence.

### C. Self-enroller

- Creates the initial cooperative workspace/account when no platform enroller is involved.
- May record only the initial cooperative identity, compliance and governance setup workflow.
- Must not gain general cooperative operating permissions merely by creating the workspace.
- Must transition to an authorized cooperative role or an authorized assisted-enrollment process to continue protected actions.
- Must be identified as self-declared/self-enrolled.
- Must not approve their own authority or verify their own submissions.

The account/workspace must remain recoverable if the self-enroller leaves before the cooperative appoints an authorized officer.

### D. Cooperative users

Initial mandatory organizational roles for the workflow are:

- Chairman
- Secretary
- Treasurer

These are mandatory **workflow roles for the intended onboarding process**, not a declaration that every cooperative's by-laws necessarily establish all three positions. The system must allow the cooperative to record that a position is absent, combined with another position, not provided for, vacant or not yet established, with source and explanation. Product policy must not silently override the cooperative's registered by-laws.

Additional configurable organizational roles include:

- Vice-Chairperson
- Other directors
- Committee chairpersons and members
- Other officers
- Ordinary members
- Authorized delegates

### E. Independent verifier

- Performs assigned verification work.
- Must be distinct from the evidence supplier and, where applicable, other conflicted actors.
- Records scope, method, result, limitations and evidence version examined.
- Does not edit the cooperative's source evidence.
- A verification finding is not the same as official cooperative approval.

### F. Institutional / technical assistance users

Examples include TA, PFI analyst/credit, fund manager and verifier roles already present in the prototype. Their access must be scoped to assigned cases/cohorts and governed by separate permissions. They may request information, assess evidence or record findings without acquiring cooperative editing authority.

## 4.3 Authentication and enrollment identity

- Every authenticated user must have a stable `user_id`.
- OTP or equivalent authentication events must be recorded as authentication evidence, not as evidence that a cooperative fact is true.
- The system must distinguish account creation time, identity verification time and organizational appointment effective time.
- A user may not claim a cooperative position solely by selecting it in a registration form.
- Access to cooperative-authoritative actions must be checked against active appointment and authority records, not merely a client-supplied role string.
- All server-side commands must re-check authorization at execution time.

# 5. Enrollment workflow

## 5.1 Workflow overview

Enrollment begins with the legal and operational facts available, then establishes the cooperative's governance model and authorized actors. It is progressive and resumable.

Recommended sequence:

1. Create cooperative workspace and identify enrollment mode.
2. Record cooperative identity and registration evidence.
3. Record tax and local-standing evidence where applicable to the selected requirement set.
4. Acquire the registered by-laws and record their version/status.
5. Extract and confirm by-law provisions and requirements.
6. Establish the initial governance profile from sources available.
7. Record member/person identities and membership claims.
8. Record meeting history and source resolutions.
9. Establish current appointments and officeholder authority.
10. Configure committees and responsibilities where required or chosen.
11. Configure compliance activities, including audit and member education requirements.
12. Admit, approve and verify evidence as applicable.
13. Generate validation findings and the next-action plan.
14. Activate ordinary cooperative workflow access when the required authorization conditions are met.

The sequence is a guided path, not a rigid wizard. A cooperative may record a later-stage fact before an earlier stage is complete, but dependencies and findings must remain visible.

## 5.2 Enrollment modes

### Self-enrollment

1. User creates an account and authenticates.
2. User creates a provisional cooperative workspace.
3. System records the actor as `self_enroller`.
4. User records identity, documents and initial governance/compliance information.
5. All such information is labelled self-declared or self-supplied.
6. The system displays unresolved identity and authority requirements.
7. The user may save and resume.
8. Protected cooperative actions remain unavailable until the required officeholder/authority setup is completed.
9. A later authorized Chairman, Secretary or other permitted role claims/accepts the relevant authority through a recorded process. The self-enroller is not silently converted into an officer.

### Platform-assisted enrollment

1. Platform administrator provisions or authorizes an enroller.
2. Enroller authenticates and completes configured identity checks.
3. Enroller selects or creates a cooperative workspace within assigned scope.
4. Enroller records the cooperative identity and collects supporting evidence.
5. System records each action under the enroller's own identity.
6. Cooperative representatives review, correct and confirm information where required.
7. Platform checks are recorded with precise scope and limitations.
8. Cooperative authority is established separately through appropriate cooperative records.

### Enrollment handover

The system must support handover from self-enroller or platform enroller to the cooperative's authorized officers. Handover must record:

- outgoing actor and actor type;
- incoming actor/user;
- cooperative reference;
- scope of information handed over;
- unresolved claims and evidence;
- acknowledgements by the receiving actor;
- date/time;
- any authority documents or resolution references.

Handover does not rewrite provenance on previously captured records.

## 5.3 Cooperative identity and legal registration

Capture, where available:

- registered legal name;
- registration number;
- registration date;
- registered office/address;
- postal address;
- district/province;
- cooperative type/classification;
- registration certificate document;
- current operating status as reported or confirmed;
- tax registration identifier and evidence, where applicable;
- local traditional/civic authority letter or other locally relevant evidence, where applicable;
- source, supplier and limitations for each claim.

The registration certificate must not be treated as a current Board register. Current officeholders must be supported by governance events and records such as AGM minutes, election results, resolutions and applicable statutory filings.

A registration certificate must not be modelled as expiring or requiring renewal unless authoritative evidence establishes that a particular document or status does so. Annual returns and other recurring obligations are separate compliance activities, not certificate renewal.

The scratch notes state that Annual Returns are filed through ZamPortal and include current financial and membership/Board information. This is a product requirement candidate, not a verified integration specification. Symphony must initially record the obligation, due date, evidence and filing reference; it must not claim to submit to or receive authoritative status from ZamPortal unless an integration is implemented and validated.

# 6. By-law acquisition, interpretation and configuration

## 6.1 By-law version register

Each by-law version must record:

- cooperative;
- version label or identifier;
- document;
- document fingerprint;
- date adopted by general meeting;
- resolution reference;
- date submitted to Registrar, if known;
- registration/approval reference and date, if known;
- effective date;
- status: draft, proposed, adopted_pending_registration, registered_current, superseded, rejected, unknown;
- source and provenance;
- captured by;
- review/confirmation actors;
- limitations and disputes.

A proposed amendment must not replace the operative registered version merely because a meeting approved it. The system must preserve the adopted-pending-registration state until registration evidence is recorded. Exact legal effect and any exceptions must be validated against current law and legal advice.

## 6.2 Provision extraction

A by-law document is not itself a structured governance model. It must be decomposed into provision records.

Each provision contains:

- reference/number;
- heading;
- verbatim or faithful extracted text;
- page/paragraph location;
- category;
- interpretation note;
- extraction method: manual, AI-assisted, imported;
- extraction confidence where applicable;
- reviewer;
- confirmation status;
- linked legal source, if any;
- linked requirement records.

AI may assist extraction but may not silently publish operative requirements. An authorized cooperative representative or designated reviewer must confirm extracted provisions. The original document and extracted text must remain linked.

## 6.3 Requirement source hierarchy

Requirements may originate from:

- statute/regulation;
- registered by-law provision;
- registered amendment;
- valid general-meeting resolution;
- valid Board resolution;
- committee terms of reference;
- cooperative policy;
- contractual/programme/institutional destination.

Each requirement must record its source type and source reference. Conflicts must be recorded as findings for review, not resolved by an undocumented system preference.

## 6.4 Structured requirement model

Each requirement must contain:

- stable requirement identifier;
- cooperative and scope;
- title and description;
- source type and source reference;
- category;
- applicability rule and rationale;
- responsible body/position;
- required action or activity;
- evidence expected;
- frequency, deadline or trigger;
- system capability mapping;
- implementation state;
- evidence state;
- validation findings;
- effective period;
- supersession relationship.

### Requirement status dimensions

Do not store one overloaded status. Use separate fields:

**Configuration status**
- identified
- interpretation_pending
- confirmed
- configured
- not_applicable (justification required)
- superseded

**Cooperative implementation status**
- not_started
- planned
- in_progress
- performed
- overdue
- not_evidenced
- not_applicable (justification required)

**Evidence status**
- absent
- supplied
- admitted
- officially_approved
- verified
- disputed
- stale
- superseded

**Platform capability status**
- supported
- partially_supported
- not_implemented
- planned
- retired

The UI may derive a readable summary, but must preserve these underlying dimensions.

## 6.5 Initial statutory catalogue

The supplied requirements identify the following Act provisions as design inputs:

- Section 10(b)(i): by-laws must adequately provide for regular audits.
- Section 10(b)(ii): by-laws must adequately provide for member education, training and advisory services.
- Section 19 and the Schedule: by-law provisions concerning prescribed matters.
- Section 20: amendment process and registration.
- Section 29: general/special meetings, procedures and minutes.
- Section 38: Board composition determined by by-laws and directors elected at AGM.
- Section 39: committee formation and composition.
- Section 41: Board functions.
- Section 42: election of Chairperson/Vice-Chairperson and appointment of other officers.
- Section 43: director terms.
- Section 44: vacancies.
- Section 46: Board meeting procedures.
- Section 58: custody/authentication of cooperative seal.
- Section 59: books of account and accounting records.
- Section 60: annual audit.

These references must be stored as configurable source catalogue entries with citations and version metadata. The exact statutory text, current amendments, regulations and Registrar guidance must be legally checked before a catalogue entry is treated as an enforceable rule. The scratch notes' more detailed claims about audit committee independence, audit timing, auditor approval and ZamPortal submission blockers are not to be hard-coded as law without authoritative verification.

## 6.6 Mandatory explicit requirements from the supplied design

### REQ-AUDIT-001 — Regular audits

- Source: Act section 10(b)(i), subject to legal validation.
- By-law question: what provision adequately establishes regular audits?
- Configuration: frequency, responsible body, auditor appointment process, reporting path and meeting presentation requirements as stated by the operative by-laws and verified law.
- Activities: plan audit, appoint/engage auditor, provide records, receive report, record findings, present report to the appropriate body, record follow-up.
- Evidence: by-law provision, appointment/engagement evidence, audit report, financial statements, meeting agenda/minutes, follow-up actions.
- Do not infer audit completion from a scheduled date or uploaded unsigned draft.
- Distinguish internal supervisory review from external audit where the applicable source requires both.

### REQ-EDU-001 — Member education, training and advisory services

- Source: Act section 10(b)(ii), subject to legal validation.
- By-law question: what provision provides for member education, training and advisory services?
- Configuration: responsible body/committee/officer, programme approval, target participants, cadence and reporting.
- Activities: needs identification, programme approval, delivery, attendance capture, materials, feedback and follow-up.
- Evidence: approved programme, event record, attendance, materials, facilitator, report and participant feedback where collected.
- Do not treat a by-law clause or planned programme as proof that education was delivered.

### REQ-ANNUAL-RETURN — Annual return tracking

- Source: applicable legislation/Registrar requirements to be confirmed.
- Configuration: due-date rule, filing channel, required information and supporting documents.
- Activity: prepare, review, submit, record acknowledgement and resolve queries.
- Evidence: filed return, submission receipt/reference, payment receipt if applicable, updated financial/membership/Board information.
- Initial implementation is a tracking and evidence workflow. Do not claim direct ZamPortal integration or submission without a verified integration.

# 7. Governance domain model

## 7.1 Governance profile

A cooperative may have multiple governance profile versions over time. Each profile records the configured structure applicable for a period and the sources from which it was derived.

It contains governance bodies, position definitions, appointment rules, meeting rules, committee definitions and responsibility mappings.

A profile may be incomplete. Incompleteness creates findings; it does not prevent recording.

## 7.2 Governance bodies

Support at least:

- General Assembly / membership meeting;
- Board;
- optional committees;
- other bodies established by registered by-laws or valid resolutions.

A body definition includes name, type, parent body, source, purpose, membership rules, decision authority reference, meeting rules, quorum configuration and effective period.

Do not assume every committee is a Board subcommittee or that all committees have identical authority.

## 7.3 Governance positions

A position is a reusable definition, not a user account.

Fields include:

- cooperative;
- governance profile;
- position code and display name;
- body;
- position class (director, officer, committee role, administrative role, other);
- source provision/resolution;
- required/optional status under that source;
- election or appointment method;
- eligibility rules;
- term rule;
- responsibilities;
- delegation/authority references;
- effective period;
- status.

The initial catalogue may offer Chairperson, Vice-Chairperson, Director, Secretary and Treasurer as suggested templates. These are not hard-coded mandatory positions for every cooperative. The actual configured position set derives from the cooperative's governing sources.

## 7.4 Chairperson and Vice-Chairperson

The system must support separate election/appointment records and terms.

Chairperson workflow:

1. identify the position and source;
2. identify the election authority and applicable procedure;
3. record the meeting and resolution;
4. record candidate/person and result;
5. record effective date and term;
6. attach minutes/election evidence;
7. record acceptance where required;
8. activate the appointment after required confirmation;
9. track expiry, vacancy, resignation, removal or replacement.

Vice-Chairperson follows the cooperative's applicable source. The system must distinguish:
- holding the Vice-Chairperson position;
- acting as Chairperson temporarily;
- formal replacement/election as Chairperson.

Acting authority requires a separate time-bounded acting appointment/delegation record. It must not overwrite the substantive appointment.

## 7.5 Other directors

Support arbitrary numbers and classifications of directors, including district/zone representation where provided for by the by-laws. Record eligibility evidence where the governing source requires it, election meeting, resolution, term and status.

## 7.6 Secretary and Treasurer

These are administrative officer positions when established by the cooperative's by-laws or valid governance decisions. Their existence must not be presumed universally.

Secretary responsibilities may include notices, agenda administration, attendance records, draft minutes, records custody, correspondence, resolution register and action tracking. The system must distinguish preparation of minutes from approval/confirmation of minutes.

Treasurer responsibilities may include financial record maintenance/oversight, receipts and payments records, supporting documents, financial reports and audit preparation. The role must not automatically confer payment approval or unrestricted financial permissions.

Position responsibilities and system permissions are separate models. An assigned duty does not automatically grant an application permission.

## 7.7 Committees

Committee configuration must support arbitrary types, including but not limited to Finance, Audit/Supervisory, Marketing, Procurement, Education and Training, Disciplinary and Production.

A committee record includes:

- committee identity and purpose;
- establishment source and meeting/resolution;
- parent/reporting body;
- terms of reference and version;
- responsibilities and delegated authority;
- membership rules;
- minimum/maximum membership if prescribed;
- eligibility restrictions;
- selection method;
- term and meeting rules;
- active/dissolved status.

Where the supplied legal baseline states section 39 requires at least three elected members who are not employees, implement this as a configurable statutory validation rule only after legal confirmation. In the initial permissive phase, fewer members, employee conflicts or missing establishment resolutions create findings and do not block record creation.

Committee membership is a temporal relationship. It may be linked to a person and source event; it must not be modelled as a free-text list.

# 8. People, membership and appointments

## 8.1 Person

A person record represents an individual. It must not be duplicated for each role. Store only data needed for cooperative operations and legal/identity requirements, with privacy controls and retention rules.

Person fields should include stable identifier, names, contact channels, optional identity attributes where justified, and record provenance. Sensitive identifiers must not be exposed in general dashboards or institutional exports unless required and authorized.

## 8.2 Cooperative membership

Membership is separate from person identity and separate from office appointment.

Membership fields include:
- cooperative;
- person/member reference;
- member number;
- membership application/admission event;
- admission date;
- status;
- share/capital references if in scope;
- termination/withdrawal event;
- supporting evidence.

A person can be a member without holding office. An officeholder may need to be a member if the applicable source requires it. The system must validate this relationship through configurable rules.

## 8.3 Appointment

An appointment connects a person to a position/body for a period.

Fields:
- person;
- position;
- body;
- appointment type (elected, appointed, acting, delegated);
- source meeting and resolution;
- authority source;
- effective start/end;
- term rule and calculated expiry;
- status;
- acceptance evidence;
- eligibility evidence;
- recorded by;
- event references.

Lifecycle events include nominated, elected, appointed, accepted, activated, reappointed, acting_started, acting_ended, resigned, removed, suspended, expired and superseded. The event model must preserve the sequence.

A current officeholder is derived from active appointments and valid dates, not overwritten text fields.

# 9. Meetings, minutes and resolutions

## 9.1 Meeting model

Support AGM, special general meeting, Board meeting, committee meeting and other configured meeting types.

Meeting fields include:
- cooperative and governance body;
- meeting type;
- scheduled/actual date and time;
- venue/mode;
- notice date and evidence;
- applicable notice rule;
- eligible membership/delegate population snapshot;
- attendance records;
- quorum rule and calculated result;
- agenda items;
- motions;
- voting records/results;
- minutes record and versions;
- approval/confirmation events;
- source authority and provenance.

The system must retain the eligible population snapshot used for quorum/voting so later membership changes do not rewrite historical calculations.

## 9.2 Minutes lifecycle

Minutes states:
- not_started;
- notes_in_progress;
- draft;
- submitted_for_review;
- corrections_requested;
- approved_or_confirmed;
- superseded.

Exact approval/confirmation terminology must be configurable according to the cooperative's by-laws and applicable law.

Workflow:
1. create meeting;
2. capture agenda and participants;
3. record notes, motions and decisions;
4. generate or prepare draft minutes;
5. Secretary or authorized recorder reviews;
6. submit draft for required review;
7. record correction requests and revised versions;
8. record the required approval/confirmation event;
9. lock the approved version against silent edits;
10. extract resolutions and action items;
11. link each resolution to the meeting, minutes version and evidence.

A draft must never be displayed as approved minutes. Corrections after approval create a correction/addendum event and new version, retaining the approved original.

Minutes assistance or AI-generated drafts are drafting aids. They do not constitute an official record until the cooperative's required approval process is completed.

## 9.3 Resolution model

Resolution categories include:
- Board/director election;
- Chairperson/Vice-Chairperson election;
- officer appointment;
- committee establishment/dissolution;
- committee membership election;
- terms-of-reference approval/amendment;
- by-law amendment;
- policy approval;
- financial approval;
- member education programme approval;
- audit appointment/report adoption;
- other.

Resolution lifecycle:
- draft;
- proposed;
- presented;
- approved;
- rejected;
- withdrawn;
- pending_external_action;
- completed;
- superseded.

Record motion text, proposer/seconder where applicable, voting method, votes for/against/abstentions, quorum result, outcome, source meeting and minutes version.

Do not infer approval from a typed statement. Approval must be an explicit recorded event with supporting meeting and voting information as required by the configured rules.

## 9.4 Resolution-to-state transformation

A confirmed resolution may create one or more domain changes:
- election resolution -> appointment records;
- officer appointment resolution -> appointment record;
- committee establishment -> committee record;
- committee election -> membership records;
- terms-of-reference resolution -> new ToR version;
- by-law amendment resolution -> proposed by-law version;
- audit adoption -> audit report adoption event;
- programme approval -> education programme version.

The transformation must be atomic: either the resolution and its resulting changes persist together, or none do. Resulting records must retain references to the originating resolution. Reprocessing must be idempotent and must not create duplicate appointments or committees.

# 10. Evidence admission, official approval and verification

This section is central to the product and must be implemented as a first-class domain capability.

## 10.1 Evidence record lifecycle

An evidence item may pass through distinct stages:

1. **Supplied:** an actor submits a document, claim or observation.
2. **Admitted:** an authorized actor accepts it into the cooperative's working evidence register.
3. **Officially approved/adopted:** the cooperative authority required by its by-laws or decision process approves it as an official cooperative record.
4. **Verified:** a permitted independent verifier examines a specific version and records a finding.
5. **Relied upon:** an institutional actor records reliance for a defined purpose, where supported.

Not every evidence item requires every stage. Requirements must declare which stages are required and why.

## 10.2 Admission rules

Chairman, Secretary, Treasurer or Verifier may admit records/evidence only where the action policy and scope permit. Admission records:
- evidence item and exact version;
- admitting actor;
- actor's active platform role;
- cooperative appointment/authority context, if any;
- admission date;
- admission decision;
- purpose/scope;
- limitations;
- reason or note;
- source evidence.

Admission must not automatically set `official_record=true`, `approved=true` or `verified=true`.

If the evidence is a document that requires formal approval by a specific position/body, the system must show: **“Admitted as supporting evidence — not yet an official cooperative record.”**

## 10.3 Official record approval

Official approval is a separate workflow governed by the cooperative's configured authority model.

Examples:
- minutes may require confirmation/approval by the process defined in the by-laws;
- a policy may require Board or AGM approval;
- audited financial statements may require presentation/adoption by the appropriate general meeting;
- an appointment may derive from an election resolution rather than a separate officer sign-off.

Approval must reference:
- the record/version;
- approving person(s);
- authority source (position, body, delegation, resolution);
- approval event/meeting;
- date;
- result;
- any conditions or limitations.

A Chairman's admission of a document is not necessarily the approval of that document. A Secretary's preparation of minutes is not approval of minutes. A Treasurer's submission of financial statements is not adoption by the membership.

## 10.4 Provenance taxonomy

Preserve and refine existing prototype provenance labels:

- `self_declared`
- `cooperative_supplied`
- `cooperative_admitted`
- `platform_enroller_collected`
- `platform_checked`
- `field_agent_assisted`
- `ta_programme`
- `external_source`
- `independently_verified`

Do not use `certified_app` as a generic synonym for platform-collected. A platform check must specify the actual check performed and its limitation.

For every evidence version record:
- supplier;
- supplied timestamp;
- source channel;
- collector, if different;
- admission actor/time/status;
- official approval actor/time/status;
- verification finding(s);
- limitations;
- validity period, if applicable;
- dispute state;
- fingerprint/checksum where used.

## 10.5 Verification

Verification is an independent finding, not a field that an uploader can set.

A verification assignment identifies target type and exact target version, verifier, scope, instructions and due date. A finding includes result, method, scope, limitation, evidence reviewed and timestamp.

Supported results should align with existing engine semantics, including:
- verified_conformant;
- verified_with_qualifications;
- verified_non_conformant;
- inconclusive.

Promotion rules from the current prototype must remain:
- promotion requires a qualifying finding on the same evidence version;
- version mismatch blocks promotion;
- conflicting findings require resolution;
- supplier cannot self-verify;
- governance verification may require the configured minutes sign-off/approval prerequisite;
- new evidence versions do not inherit prior verification.

## 10.6 Disputes and corrections

A dispute is a separate record with reason code, note, raiser, target version, status and resolution. Only permitted actors may raise, withdraw or resolve disputes. A dispute does not delete evidence.

Corrections create a new evidence version or correction event. The original remains available for audit. If a correction changes a governance fact, it may require a new resolution/approval rather than a simple data edit.

# 11. Validation and findings

## 11.1 Validation is not enforcement in the initial release

The first implementation must allow users to record incomplete and inconsistent facts. It must generate findings and next actions. It must not silently reject the reality being recorded.

Validation rules are versioned, source-linked and explainable. Each finding records rule identifier/version, target, severity, observed facts, expected condition, source, date, status and resolution evidence.

Suggested severities:
- informational;
- attention_required;
- material_gap;
- blocking_for_specific_transition.

“Blocking” applies only to a defined transition (for example, activating an appointment or presenting a dossier), not to the ability to record the underlying fact during onboarding.

## 11.2 Initial validation catalogue

Examples include:

**Identity**
- registration number missing;
- registration certificate not supplied;
- name differs between profile and certificate;
- certificate source/status not confirmed;
- duplicate potential cooperative record.

**By-laws**
- registered by-laws not supplied;
- version/registration status unknown;
- provisions not extracted;
- extracted provisions awaiting review;
- statutory requirement not represented in by-laws;
- amendment adopted but registration evidence absent;
- conflicting active by-law versions.

**Governance**
- no governance profile;
- Board composition not configured;
- configured Board composition differs from operative by-laws;
- Chairperson position unfilled;
- no source election/resolution for current appointment;
- appointment dates overlap or leave unexplained gaps;
- appointment term expired;
- Secretary/Treasurer position absent where the cooperative's own source requires it;
- appointment lacks required acceptance/eligibility evidence.

**Meetings and records**
- AGM due/overdue according to configured rule;
- meeting notice evidence absent;
- quorum not demonstrated;
- draft minutes not approved;
- resolution has no approved minutes/source;
- resolution not implemented;
- action item overdue.

**Committees**
- committee lacks establishment source;
- membership below configured minimum;
- eligibility conflict;
- missing terms of reference;
- reporting relationship not defined;
- committee inactive despite assigned responsibilities.

**Audit**
- audit provision not found/configured;
- audit activity not scheduled;
- auditor appointment evidence absent;
- audit report outstanding;
- audit report not presented/adopted where required;
- audit findings have no follow-up.

**Education and training**
- by-law provision not found/configured;
- no approved programme;
- delivery evidence absent;
- attendance or participant records incomplete;
- report/follow-up outstanding.

**Evidence**
- evidence only self-declared;
- admitted but not officially approved;
- stale/expired;
- disputed;
- verification absent where required;
- finding conflicts unresolved;
- limitation prevents reliance for a particular purpose.

Each finding must explain the next action and the responsible role/body where known.

## 11.3 Validation outputs

The dashboard must show:
- current state;
- requirements identified and configured;
- governance positions filled/vacant;
- upcoming/expired appointments;
- meetings and resolutions outstanding;
- committee formation gaps;
- audit and education obligations;
- evidence awaiting admission/approval/verification;
- platform capability gaps;
- unresolved findings;
- next recommended actions.

Do not collapse these into one percentage called “compliance”. A readiness summary may be derived for a defined purpose, but it must expose the basis and limitations.

# 12. Relational logical data model

This is a logical model and not a final vendor-specific DDL. The database design should use normalized relational entities, stable primary keys, foreign keys, unique constraints, temporal fields and append-only event records. Avoid storing all governance state in a JSON blob. JSON may be used for extensible rule parameters or captured payloads where justified, but not as a substitute for core relationships.

## 12.1 Core tables

### Tenant and identity
- `organizations` — cooperative legal/operational identity.
- `organization_identifiers` — registration numbers and other identifiers, typed and source-linked.
- `users` — authenticated platform accounts.
- `persons` — real-world individuals.
- `user_person_links` — link user account to person, with confirmation state.
- `organization_memberships` — person-to-cooperative membership over time.
- `organization_enrollment` — enrollment mode, status, handover and completion state.

### Roles and authority
- `platform_roles`
- `permissions`
- `role_permissions`
- `user_role_assignments` — scoped and time-bounded platform roles.
- `organization_appointments` — person-to-position appointment.
- `authority_delegations` — scoped, time-bounded authority derived from a source.
- `enroller_assignments` — platform enroller scope and assignment.
- `authentication_events` — OTP or other authentication checks.

### By-laws and requirements
- `bylaw_versions`
- `bylaw_documents`
- `bylaw_provisions`
- `legal_sources`
- `requirement_definitions` — reusable catalogue definitions.
- `organization_requirements` — cooperative-specific instantiated requirements.
- `requirement_sources` — links requirement to one or more source records.
- `requirement_responsibilities`
- `requirement_evidence_rules`
- `platform_capabilities`
- `requirement_capability_mappings`

### Governance
- `governance_profile_versions`
- `governance_bodies`
- `governance_positions`
- `position_responsibilities`
- `governance_appointments`
- `appointment_events`
- `committees`
- `committee_memberships`
- `terms_of_reference_versions`
- `delegated_authorities`

### Meetings and decisions
- `meetings`
- `meeting_notice_evidence`
- `meeting_eligible_population_snapshots`
- `meeting_attendance`
- `meeting_agenda_items`
- `motions`
- `votes`
- `minutes_versions`
- `minutes_approval_events`
- `resolutions`
- `resolution_effects`
- `governance_action_items`

### Compliance activities
- `compliance_obligations`
- `compliance_schedules`
- `audit_engagements`
- `audit_reports`
- `education_programmes`
- `training_events`
- `training_participants`
- `annual_return_filings`
- `compliance_activity_events`

### Evidence and assurance
- `evidence_items`
- `evidence_versions`
- `evidence_admissions`
- `record_approvals`
- `verification_assignments`
- `verification_findings`
- `evidence_disputes`
- `evidence_relationships`
- `evidence_requirement_links`
- `evidence_access_grants` (if item-level access is needed)

### Validation and history
- `validation_rule_definitions`
- `validation_rule_versions`
- `validation_findings`
- `validation_finding_events`
- `domain_events` — append-only business audit trail.
- `event_outbox` — reliable publication to downstream consumers.
- `record_fingerprints` — computed integrity fingerprints with algorithm/version metadata.

## 12.2 Key relationships

- One organization has many enrollment records, by-law versions, governance profile versions, people memberships, requirements, meetings and evidence items.
- One by-law version has many provisions; one provision may source many requirements.
- One requirement may have multiple source links, responsible roles, capability mappings and evidence links.
- One governance profile version has many bodies and positions.
- One governance body has many positions and may have parent/reporting relationships.
- One person may have many memberships and appointments over time.
- One appointment references one position and one person, plus its originating authority/source event.
- One committee has one or more terms-of-reference versions and many time-bounded memberships.
- One meeting has many attendees, agenda items, motions, minutes versions and resolutions.
- One resolution may generate multiple resolution effects; each effect references the resulting domain record.
- One evidence item has many immutable evidence versions.
- Admissions, approvals, findings and disputes reference exact evidence versions.
- One validation finding references a rule version and one or more affected domain records.
- Every material state change has one or more domain events.

## 12.3 Data constraints and invariants

At minimum:
- registration identifier uniqueness must be scoped appropriately and support duplicate-review rather than destructive rejection;
- one active appointment per position at a point in time unless the position rule explicitly permits multiple occupants;
- date ranges must be valid;
- committee membership and appointment overlaps must be evaluated against configured rules;
- foreign keys must prevent orphaned source references;
- resolution effects must be idempotent;
- approved minutes versions must be immutable;
- evidence versions must be immutable after submission; corrections create a new version;
- verification findings must reference a specific version;
- one actor cannot verify their own supplied evidence;
- authority must be valid at the event time;
- admission does not imply official approval;
- platform verification does not imply independent verification;
- no derived status may overwrite the source facts from which it was calculated.

# 13. Domain commands and state transitions

All commands must execute through an application/domain service, validate authorization and invariants server-side, persist state and audit events in one transaction, and publish downstream events through an outbox.

Initial command families:

**Enrollment**
- `CreateOrganizationWorkspace`
- `RecordOrganizationIdentity`
- `AttachRegistrationEvidence`
- `AssignEnroller`
- `RecordEnrollmentHandover`
- `ClaimOrganizationAccount`
- `ConfirmOrganizationIdentity`

**By-laws and requirements**
- `RegisterBylawVersion`
- `AttachBylawDocument`
- `ExtractBylawProvision`
- `ConfirmBylawProvision`
- `InstantiateRequirement`
- `AssignRequirementResponsibility`
- `RecordRequirementNotApplicable`
- `SubmitBylawAmendment`
- `RecordBylawRegistration`

**Governance**
- `CreateGovernanceProfile`
- `ConfigureGovernanceBody`
- `DefineGovernancePosition`
- `RecordNomination`
- `RecordElection`
- `RecordAppointment`
- `ActivateAppointment`
- `StartActingAppointment`
- `EndActingAppointment`
- `RecordResignation`
- `RecordRemoval`
- `CreateCommittee`
- `RecordCommitteeMembership`
- `ApproveTermsOfReference`

**Meetings**
- `ScheduleMeeting`
- `RecordMeetingNotice`
- `RecordAttendance`
- `RecordQuorumAssessment`
- `RecordMotion`
- `RecordVote`
- `SaveMinutesDraft`
- `SubmitMinutesForReview`
- `RequestMinutesCorrection`
- `ApproveMinutes`
- `CreateResolution`
- `ConfirmResolutionOutcome`
- `ApplyResolutionEffects`

**Evidence**
- `SupplyEvidence`
- `CreateEvidenceVersion`
- `AdmitEvidence`
- `ApproveOfficialRecord`
- `AssignVerification`
- `RecordVerificationFinding`
- `RaiseEvidenceDispute`
- `ResolveEvidenceDispute`
- `RecordEvidenceReliance`

**Compliance**
- `ConfigureAuditObligation`
- `ScheduleAudit`
- `RecordAuditorEngagement`
- `AttachAuditReport`
- `RecordAuditAdoption`
- `ConfigureEducationProgramme`
- `ScheduleTraining`
- `RecordTrainingDelivery`
- `RecordAnnualReturnSubmission`
- `RecalculateValidationFindings`

Commands must be idempotent where retries are possible. Each command should carry a command/idempotency key, actor, organization scope, correlation ID and expected aggregate version where optimistic concurrency is used.

# 14. Audit log and event architecture

## 14.1 Business audit log versus interaction telemetry

The current repository's `capture_event_schema.json` captures user interaction telemetry (screen views, clicks, tour events, exports and other UI events). It is not a sufficient business audit log.

Maintain two distinct streams:

1. **Domain/business events:** authoritative record of business state changes, authority, evidence, approvals and validation.
2. **Interaction telemetry:** user-interface behaviour used to understand product usage and workflow friction.

Telemetry must not be treated as proof that a cooperative action occurred. A click on “approve” is not an approval event. The domain command's successful persisted result is the authoritative event.

## 14.2 Domain event envelope

Every material event must include:
- event ID;
- event type and schema version;
- organization/tenant ID;
- aggregate type and ID;
- aggregate version;
- actor user ID;
- actor person ID where linked;
- actor platform role snapshot;
- organizational appointment/authority reference where applicable;
- event timestamp (UTC);
- effective date/time where different;
- correlation ID and causation ID;
- command/idempotency ID;
- source record/resolution reference;
- prior state and resulting state or a structured change set;
- evidence references;
- reason/limitation where relevant.

Do not store secrets, OTP values, passwords or unnecessary personal data in events.

## 14.3 Append-only corrections

Business events are append-only. If an incorrect record is corrected:
- preserve the original;
- create a correction/supersession event;
- reference the original event/record;
- state the reason and actor;
- create a new current projection;
- ensure downstream dossiers can reconstruct the history.

Database administrators and application users must not have ordinary update/delete paths for the authoritative event history. Retention/legal deletion requirements must be handled through a separately governed policy without falsifying the historical sequence.

# 15. Relational persistence and transaction boundaries

The relational implementation must enforce domain invariants at the service and database levels where feasible.

## 15.1 Transactional command pattern

A command transaction should:
1. load the relevant aggregate and version;
2. resolve actor identity and current permissions;
3. resolve cooperative appointment/delegation authority if required;
4. validate source, evidence and state preconditions;
5. apply domain transition;
6. persist current relational state;
7. append domain event(s);
8. append outbox message(s);
9. commit atomically.

Do not update a governance projection and then separately attempt to write its audit event. A committed state change without its event is unacceptable.

## 15.2 Derived projections

Dashboards, current officeholder lists, outstanding requirement summaries and readiness summaries may be projections. They must be rebuildable from authoritative records/events and must not become the only source of truth.

## 15.3 Concurrency

Use optimistic concurrency or equivalent controls for:
- minutes approval;
- resolution outcome;
- appointment activation;
- by-law current-version transition;
- evidence admission/approval;
- dispute resolution.

If two users edit the same draft, the system must detect the conflict and preserve both inputs or require reconciliation. Silent last-write-wins is not acceptable for authoritative governance records.

## 15.4 Multi-tenant isolation

All cooperative-owned records must be scoped to an organization. Authorization checks must prevent cross-cooperative reads/writes. Database row-level security may be used as defence in depth, but application authorization remains required. Platform-wide roles must have explicit, audited scope.

# 16. User experience requirements

The UI should be a progressive guided workflow, not a collection of disconnected tabs.

The user should always be able to see:
- current onboarding stage;
- what is known and its source;
- what remains unknown;
- which records are drafts, admitted, official, verified or disputed;
- who is responsible for the next action;
- what authority is required;
- which Symphony capabilities are available or not yet implemented;
- why a validation finding exists.

Recommended main areas:
1. Cooperative identity.
2. Enrollment and authority.
3. By-laws and requirements.
4. Governance structure.
5. People, members and appointments.
6. Meetings, minutes and resolutions.
7. Committees and responsibilities.
8. Audit and member education.
9. Evidence register.
10. Findings and next actions.

Avoid forcing a user to complete the entire setup in one sitting. Save/resume must be reliable. The UI must never display a seeded/demo value as if it were a real cooperative fact.

## 16.1 Role-specific experiences

**Self-enroller:** create workspace, supply initial identity evidence, begin governance/compliance configuration, view handover requirements.

**Platform enroller:** assigned cooperative queue, identity/authentication status, collection checklist, source/provenance capture, limitations, handover.

**Chairman:** review governance profile, confirm authority where appropriate, record election/appointment outcomes, approve decisions within authority, view vacancies and obligations.

**Vice-Chairperson:** view position and delegated/acting authority, perform actions only within current delegation.

**Secretary:** manage meetings, notices, attendance, draft minutes, resolutions, document register and action tracking; cannot approve their own draft where a separate authority is required.

**Treasurer:** manage financial evidence and audit preparation tasks; no implied payment approval or unrestricted financial permissions.

**Committee member/chair:** access committee mandate, meetings, actions and reporting within scope.

**Verifier:** assigned evidence versions, scope, review tools, findings and limitations; no source-record editing.

**Union/TA user:** only see cooperatives and records within explicit cohort/consent/authorization scope; identify support needs without becoming the cooperative's decision-maker.

## 16.2 Required status language

Use precise labels such as:
- Self-declared
- Supplied by cooperative
- Collected by platform enroller
- Platform check completed (scope shown)
- Admitted as supporting evidence
- Awaiting official approval
- Official cooperative record
- Independently verified (scope shown)
- Verification qualified
- Disputed
- Not evidenced
- Platform capability not implemented

Avoid:
- Certified, unless an actual certification authority/process exists;
- Compliant, as a blanket status;
- Verified, without naming who verified what and which version;
- Approved, without the approving authority and source;
- Complete, where only a document upload has occurred.

# 17. Authorization matrix — initial policy baseline

This matrix is a starting policy to be refined against the final role catalogue and cooperative authority configuration. It is not a substitute for server-side policy evaluation.

| Action | Self-enroller | Platform enroller | Chairman | Vice-Chair | Secretary | Treasurer | Verifier |
|---|---:|---:|---:|---:|---:|---:|---:|
| Create provisional workspace | Yes | Yes | No | No | No | No | No |
| Record identity/evidence | Yes, limited | Yes, assigned scope | Yes | Delegated | Yes | Yes | No |
| Admit supporting evidence | No by default | Only if policy permits, labelled platform action | Yes, within authority | Delegated | Yes, within authority | Yes, within authority | Yes, within verifier scope |
| Approve official minutes | No | No | Only if governing process grants it | Only if governing process grants it | Not for own draft; only if source permits | No by default | No |
| Record AGM election result | Draft/claim only | Collection only | Confirm/source-backed | Collection/authorized role | Record/source-backed | Record/source-backed | No |
| Activate appointment | No | No | Only where source grants authority | Only where source grants authority | No by default | No by default | No |
| Verify evidence | No | No | No, unless separately appointed verifier and non-conflicted | No | No | No | Yes, assigned |
| Record audit/education activity | Draft/claim | Collection | As authorized | Delegated | As authorized | As authorized | Verify only |
| Change by-law operative version | No | No | Initiate/confirm resolution only | No by default | Record process | No | No |

Policy evaluation must consider action, target, organization, actor, active platform role, active appointment, delegation, conflict-of-interest rules and source authority. The matrix must be configurable and versioned.

# 18. Acceptance criteria

## 18.1 Enrollment
- A user can self-enroll and create a provisional cooperative workspace.
- A platform administrator can provision an enroller.
- Enroller authentication and assigned scope are recorded.
- Self-enroller and enroller actions have distinct provenance.
- A workspace can be handed over without rewriting historical provenance.
- Self-enrollment does not grant protected cooperative authority.

## 18.2 Identity
- Cooperative identity can be recorded without a certificate.
- Missing evidence creates a finding rather than fabricated default data.
- Registration certificate data is not used as current Board membership.
- Annual return obligations are tracked separately from certificate validity/renewal.

## 18.3 By-laws
- Multiple by-law versions can be recorded.
- Provisions can be extracted and reviewed.
- Requirements can be sourced to specific provisions and legal references.
- Proposed/adopted-pending-registration amendments do not replace the operative registered version.
- Section 10(b)(i) and (ii) requirements can be configured and tracked independently.
- Platform capability status is distinct from cooperative implementation status.

## 18.4 Governance
- Arbitrary cooperative-specific positions and bodies can be configured.
- Chairperson and Vice-Chairperson can be represented separately.
- Secretary and Treasurer can be optional/configurable according to source.
- Positions are separate from persons.
- Appointments are temporal and retain history.
- Acting appointments are distinct from substantive appointments.
- Committee types and terms are configurable.
- Committee validation findings do not block initial capture.

## 18.5 Meetings and resolutions
- AGM and other meeting types can be recorded.
- Attendance and quorum use a retained eligible-population snapshot.
- Draft minutes are distinct from approved minutes.
- Approval events identify the required authority.
- Resolutions produce traceable state changes.
- Resolution effects are atomic and idempotent.
- By-law amendments remain pending external registration where applicable.

## 18.6 Evidence
- Evidence items have immutable versions.
- Admission is separate from official approval.
- Official approval identifies authority and source.
- Verification findings reference exact versions and scope.
- Self-verification is blocked.
- New versions do not inherit verification.
- Disputes and corrections preserve history.
- Provenance and limitations are visible in the evidence register and dossier.

## 18.7 Audit and validation
- Every material command produces a business audit event.
- Failed commands do not leave partial state changes.
- Validation findings are source-linked and explainable.
- Incomplete records can be saved.
- Dashboard summaries are derived from persisted records.
- Interaction telemetry is not treated as business evidence.

# 19. Implementation phases and dependency order

Do not begin by creating every table or building a generic workflow engine. Establish the domain contracts and state transitions first.

### Phase 0 — Domain decisions and oracle contracts
- Confirm actor categories and authority separation.
- Confirm enrollment state machine.
- Confirm evidence admission versus official approval semantics.
- Confirm by-law version lifecycle.
- Confirm meeting/minutes/resolution transitions.
- Confirm appointment and committee lifecycle.
- Confirm source hierarchy and conflict handling.
- Write scenario-based oracle tests for each transition and invariant.
- Resolve statutory statements requiring legal validation.

**Exit gate:** approved domain glossary, state-transition diagrams, permission matrix, logical ERD, event catalogue and executable acceptance scenarios.

### Phase 1 — Identity, enrollment and evidence foundation
- Users, persons, organizations and memberships.
- Enrollment and handover.
- Platform roles/permissions and scoped assignments.
- Evidence items/versions, provenance, admission and approval.
- Domain event log and outbox.
- Server-side authorization.

**Exit gate:** self-enroller and platform-enroller journeys persist correctly; evidence provenance is reconstructable; unauthorized actions fail closed.

### Phase 2 — By-law and requirement configuration
- By-law version/document/provision model.
- Requirement source and requirement register.
- Platform capability mapping.
- Requirement responsibility and evidence rules.
- Findings and next-action generation.

**Exit gate:** a cooperative can turn its actual by-laws into reviewed structured requirements without falsely marking them implemented.

### Phase 3 — Governance and appointments
- Governance profile versions.
- Bodies and positions.
- People/membership links.
- Appointment lifecycle and acting/delegated authority.
- Committee model and terms of reference.

**Exit gate:** historical and current governance can be reconstructed from source events; no fixed universal org chart is required.

### Phase 4 — Meetings, minutes and resolutions
- Meeting, notice, attendance and quorum.
- Minutes drafting/versioning/approval.
- Resolutions and deterministic effects.
- Atomic event-driven state transitions.

**Exit gate:** a recorded AGM can establish or change appointments, committees and by-law amendment proposals with full traceability.

### Phase 5 — Audit, education and recurring obligations
- Audit planning, engagement and reports.
- Education programme and training delivery.
- Annual return tracking.
- Recurrence and overdue findings.

**Exit gate:** the system distinguishes provisions, configured activities, scheduled work, delivered work and evidence.

### Phase 6 — Governance dashboard and institutional dossier
- Role-specific work queues.
- Governance status and next-action dashboard.
- Requirement-to-evidence traceability.
- Institutional export with provenance, limitations, approvals and findings.
- Cohort/union views with scoped access.

**Exit gate:** a union or institution can understand the cooperative's path and evidence basis without Symphony claiming to make the institution's decision.

### Phase 7 — Later enforcement
Only after operational evidence and approved contracts:
- block defined transitions where prerequisites fail;
- enforce quorum/voting rules;
- enforce appointment eligibility and committee composition;
- enforce external registration prerequisites;
- apply advanced delegation/conflict controls.

The database and domain model from earlier phases must support these controls without redesign.

# 20. Decisions that must be resolved before implementation contracts

The following decisions are deliberately not guessed:

1. What precise authentication and identity checks are required for a platform enroller, and what does each check prove?
2. Can a self-enroller later become an authorized cooperative user, and what independent acceptance/authority evidence is required?
3. What exact actions may a platform enroller perform without cooperative confirmation?
4. Which actors may admit each evidence class, and which classes require official approval?
5. What constitutes an official record for each document type under the cooperative's by-laws?
6. Who approves/ confirms minutes, and how does the rule vary by meeting type and by-law?
7. How are joint officeholders, combined offices, vacancies and overlapping terms handled?
8. What legal requirements govern Board composition, committee membership, audit arrangements and annual returns under current law and regulations?
9. Which audit workflow requirements are statutory, by-law-specific, Registrar practice or recommended governance practice?
10. Which source controls where the Act, registered by-laws and a later resolution appear inconsistent?
11. How are by-law amendments represented while pending Registrar registration, including rejection or requests for correction?
12. What retention, privacy, consent and access rules apply to personal/member records and meeting attendance?
13. What is the initial scope of the cooperative union role: assistance, delegated administration, oversight, or read-only portfolio visibility?
14. Which platform capability gaps should be visible to cooperative users versus internal administrators?
15. What exact event and evidence payloads are required for institutional dossier export?

Each decision must be recorded in an architecture decision record or domain decision register. No implementation agent should invent a default for unresolved authority or statutory questions.

# 21. Legal and factual verification register

The supplied notes contain detailed claims about the Co-operative Societies Act, audits, committee independence, auditor approval, annual return processes and ZamPortal. This specification preserves the clearly identified design concerns but does not treat every detailed assertion as verified law.

Before activating statutory validation rules, obtain and review:
- the current consolidated Co-operative Societies Act and amendments;
- applicable regulations and prescribed forms;
- current Registrar guidance/circulars;
- authoritative requirements for annual returns and filing;
- the legal status and requirements for auditors and audit committees;
- the cooperative's own registered by-laws.

For every legal catalogue entry store:
- jurisdiction;
- source title;
- provision;
- exact source text or authoritative excerpt;
- publication/version/effective date;
- source URL or document reference;
- review date;
- reviewer;
- legal validation status;
- supersession history.

Until confirmed, a rule should be labelled `proposed_legal_interpretation` or `needs_legal_validation`, not silently activated as a hard blocking rule.

# 22. Definition of done

The onboarding and governance domain is ready for relational implementation only when:

1. Every actor category has a defined identity, scope and authority boundary.
2. Enrollment and handover state transitions are documented.
3. The distinction between platform role, cooperative appointment, authority and provenance is enforced.
4. By-law versions, provisions and requirements have stable relational identities.
5. Governance profiles, bodies, positions, appointments and committees are temporally modelled.
6. Meetings, minutes and resolutions have explicit state machines.
7. Resolution effects are deterministic, atomic, idempotent and source-linked.
8. Evidence supply, admission, official approval, verification, dispute and reliance are separate operations.
9. Existing prototype evidence invariants are represented in executable tests.
10. Validation rules produce explainable findings and do not prematurely enforce future policy.
11. The logical ERD, event catalogue, permission matrix and domain glossary are approved.
12. Legal claims requiring external validation are identified and not presented as settled facts.
13. Scenario-based acceptance tests cover normal, incomplete, conflicting, unauthorized and correction paths.
14. The prototype's current hardcoded enrollment assumptions and no-op persistence paths are explicitly excluded from the new implementation baseline.

**End-state:** Symphony provides an auditable, cooperative-specific model of identity, governance and compliance progress. It shows what the cooperative's sources require, what its members and authorized bodies have decided, who currently holds authority, what activities have occurred, what evidence supports each claim, what remains uncertain, and what must happen next. It does not manufacture governance, certify compliance or make financing decisions.
