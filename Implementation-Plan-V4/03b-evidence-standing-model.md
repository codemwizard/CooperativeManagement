# 03b — Evidence Standing Model (normative, round 2)

Answers the founder's brief: evidence states differ by **role** (who entered it and in what capacity), **pipeline stage** (where in Symphony's process it sits) and **organisation relationship** (who is looking at it). It replaces the round-1 record-class table in `03` §4.3.

## 1. The three differentiators

| Differentiator | Question it answers | Stored as |
|---|---|---|
| **Origin and duty** (role) | Who entered or acted, in what capacity, and was it their duty? | `origin`, `duty_holder_match`, actor capacities at the time of the act |
| **Pipeline stage** | Which part of the Symphony process is this in? | `stage` on the organisation (S0–S4), stamped on each act |
| **Audience** (organisation relationship) | Whose perspective is the label written from? | Computed per viewer; never stored |

Standing is **computed** from events by one pure function (`computeStanding`). The client never supplies it (EVD-007).

## 2. Three evidence tracks

| Track | What it is | Examples | State model |
|---|---|---|---|
| **C: Claims** | Facts about members, households, assets, production | "10 goats", income, land, farming history | Level ladder: asserted → supported → verified (§3) |
| **R: Records** | The cooperative's own records, produced through duties | Minutes, resolutions, financial statements, member register, committee reports, notices, by-law versions | Duty process: working copy → awaiting submission → draft → approved (§4) |
| **X: Issued documents** | Documents issued by an outside authority | Registration certificate, ZRA documents, chief/headman letters, Registrar by-law registration, external auditor's report | Supplied → admitted → checked (§7). Authenticity is never assumed from admission |

All tracks project to the same outputs: `level` (asserted/supported/verified), `assurance_class`, `record_status` (R only), `flags`, and a display label. Destinations therefore keep working on the legacy level (`03` §4.2).

## 3. Track C: claims

### 3.1 Acts that move a claim

| Act | Who | Effect |
|---|---|---|
| Enter | Anyone with write scope | Sets starting level from origin (§3.2) |
| Attach support | Anyone | `asserted → supported` if the support item qualifies (§3.3) |
| Attest observation | Field Agent or officer who *observed* | Sets `verified[cooperative_internal]`, basis `observation_attested` |
| Record finding | Internal Field Verifier (not supplier/collector) | `verified[cooperative_internal]` on that exact version |
| Platform check | Enroller or Symphony staff | `verified[platform]`, scoped to source/provenance review |
| External finding | VVB or other independent verifier | `verified[independent_external]` |
| Admit | Officer or IFV | Accepts into the register; changes the **label**, never the level |
| Amend | Anyone | New version; **resets to the origin's starting level**, no inheritance |

### 3.2 Starting level by origin

| Origin | Starts at | Basis label |
|---|---|---|
| Member, on their own phone or device | `asserted` | "Self-declared by member" |
| Officer entering on the member's behalf (no observation) | `supported` | "Recorded by [position]; officer-attested" |
| Field Agent entering a **transcribed statement** | `supported` | "Recorded by field agent" |
| Field Agent attesting **direct observation** | `verified` · `cooperative_internal` | "Observed by field agent [employer]" |
| Officer attesting direct observation | `verified` · `cooperative_internal` | "Observed by [position]" |
| Internal Field Verifier entering with observation | `verified` · `cooperative_internal` | "Verified by internal verifier" |
| Platform enroller entering as proxy (S0) | `supported` | "Entered by enroller as cooperative's proxy" |
| TA/programme record | `supported` | "Programme record" |

Attesting observation needs a mandatory statement of what was observed, how and when. Without it the entry stays at the transcription row. This applies the founder's rule that an official or field agent entering data rates above self-attestation, **from the cooperative's perspective only** (§6). (Confirm O-14.)

### 3.3 Support items

Types: document, community-authority letter (headman, senior community person), witness statement, photo/recording, third-party record. Each item records supporter, their standing (`issuer`, `community_authority`, `member_peer`, `officer`), date and what it supports. A support item qualifies when it is relevant to the exact claim and version; a letter that does not mention the claim does not qualify.

### 3.4 Worked example: "I have 10 goats"

| Step | Act | Result (from cooperative perspective) |
|---|---|---|
| 1 | Member enters "10 goats" | `asserted` · "Self-declared by member" |
| 2 | Member attaches a headman's letter stating 10 goats | `supported` · "Self-declared, with community-authority letter" |
| 3 | Secretary admits it | Same level; label adds "Admitted to register by Secretary" |
| 4 | Internal Field Verifier counts the goats, records a finding | `verified` · `cooperative_internal` · "Verified by internal verifier (scope: head-count on 12 Oct)" |
| 5 | Member amends to 12 goats | New version, back to `asserted` |
| 6 | Field Agent visits and attests observing 12 | `verified` · `cooperative_internal` · "Observed by field agent" |

An institution viewing step 4 or 6 sees "Cooperative-verified, not independent" (§6).

## 4. Track R: records and the Duty Matrix

### 4.1 Principle

Anyone may create and version a record at any time (permissive). **What the state shows depends on whether the duty-holder has taken it into the duty process.** Three separate acts, each naming the exact version: *author* (anyone), *submit* (the duty-holder), *approve* (the approver).

### 4.2 States

| State | When | Label example (minutes) |
|---|---|---|
| `working_copy` | Authored by someone who is not the duty-holder; nobody has submitted it | "Working copy, outside Secretary process" |
| `awaiting_duty_submission` | Same, flagged for the duty-holder to take over | "Awaiting Secretary submission" |
| `draft_submitted` | **The duty-holder authored or submitted this exact version** | "Draft, awaiting approval by Chairperson or Vice-Chairperson" |
| `returned` | Approver asked for changes; a new version is needed | "Returned with comments" |
| `approved_official` | Approver approved this exact version | "Official cooperative record, approved by [name, position]" |
| `rejected` / `superseded` | Terminal states | |

Rules:
1. The Secretary uploading minutes goes straight to `draft_submitted` (founder example).
2. Anyone else uploading goes to `awaiting_duty_submission` with flag `authored_outside_duty_process`. They can keep versioning. The Secretary can **adopt** a specific version (submit it: "Prepared by X; submitted by Secretary Y") or write a new one. The outside-process flag stays on the history, visible in the drawer.
3. Approval needs the version to be `draft_submitted`. In advisory mode, approving an unsubmitted version is recorded with finding EVD-001 and label "Approved without duty submission".
4. Approver equals preparer: allowed, labelled "Approved by preparer", counted only if policy `distinct_actors` is false.
5. Duty position vacant or unknown: any officer may submit "in place of vacant [duty]"; the label says so.
6. `approvers_required` and `distinct_actors` are configurable per class (dual sign-off is configuration).

### 4.3 Duty Matrix v1 (seed; editable per organisation; review O-13)

| Record class | Preparer / submitter (duty-holder) | Approver | Approval mode | Official label |
|---|---|---|---|---|
| Notice of meeting, agenda | Secretary | Chairperson or Vice | position | "Official notice" |
| Minutes (any meeting) | Secretary | Chairperson or Vice (or per by-law) | position | "Official cooperative record" |
| Resolution record | Secretary | Chairperson or Vice | position, backed by approved minutes | "Official resolution" |
| By-law version / amendment | Secretary (draft) | General meeting; then Registrar | meeting + `external_registrar` | "By-law of record" only after Registrar submission |
| Member register | Secretary | Chairperson or Vice | position | "Official register" |
| Financial statements, cash book, ledgers, budgets | Treasurer | Board; adoption at general meeting | meeting_resolution | "Adopted financial statements" |
| Payment/contribution records | Treasurer | Treasurer's own record; checked by audit/supervisory committee | committee_review | "Recorded; reviewed" |
| Audit/inspection report | Audit/supervisory committee (or external auditor) | General meeting | meeting_resolution | "Adopted audit report" |
| Training plan and attendance | Education committee or Secretary | Board | position/committee | "Official training record" |
| Credit/loan decisions (where applicable) | Credit committee | Board | committee | "Official credit record" |
| Chairperson's/Board report | Chairperson | Board/General meeting | meeting_resolution | "Presented report" |
| Annual return | Secretary | Chairperson/Vice, then Registrar | position + `external_registrar` | "Filed return" after filing evidence |
| By-law interpretation | Any officer proposes | Chairperson or Vice | position | "Approved interpretation" |
| IFV grant/revocation | Chairperson or Vice, or enroller on cooperative's behalf | Chairperson or Vice | position | "Authorised internal verifier" |

### 4.4 Position duty profiles

| Position | Prepares/submits | Approves | May also |
|---|---|---|---|
| Chairperson / Vice-Chairperson | Chair's report, notices of convening | Minutes, resolutions, member register, by-law interpretations, IFV assignment, annual return | Admit all classes; co-chair; Vice acts when Chair absent (acting record) |
| Secretary | Minutes, agendas, notices, resolutions, member register, correspondence, annual return, by-law drafts | Nothing officially alone | Admit all classes |
| Treasurer | Financial statements, ledgers, budgets, payment records | Nothing officially alone; statements need Board/AGM adoption | Admit all classes |
| Audit/supervisory committee | Audit and inspection reports | Reviews Treasurer's records | Members may not sit on the Board |
| Education committee | Training plans and attendance | | |
| Credit committee (if constituted) | Loan decisions | | |
| Board / Executive Committee | | Financial statements, committee reports, budgets (before general meeting) | |
| Member | Own claims; own attendance | | Inspect register (read-only) |
| Field Agent | Observations | | Employer-scoped |
| Internal Field Verifier | Findings | | Not on own supplied/collected versions |

New position or committee types need no code: add a row to the Duty Matrix.

## 5. The enroller's two hats (C1, ADR-019)

| Hat | Act | Origin | Result | Conflict handling |
|---|---|---|---|---|
| Cooperative's proxy | Enters data with a representative present, in an enrolment session | `platform_enroller_proxy` | Track C `supported` (proxy attestation); Track X/R admitted-as-supporting | Enroller is `proxy_operator`, not the supplier. The representative is the supplier |
| Symphony due diligence | Reviews source/provenance records (sights originals, compares to registry copy) | platform check | `verified[platform]` with scope and limits | Same person allowed, with visible flag "proxy entry and platform check by the same person"; policy `require_distinct_reviewer` (default off) forces a second staff member |

The platform check proves only what the reviewer did (for example "sighted original, matched registration number to certificate copy; not validated against the Registrar's register"). IFV-6 still applies to supplier and collector on the cooperative side.

## 6. Audience standing (organisation relationship)

The same evidence reads differently depending on who looks. Labels are generated per audience by `presentEvidence(standing, audience)`.

| Underlying standing | Member / cooperative official | Symphony platform (programme manager, TA, union) | Institution (lender, fund) | Independent verifier |
|---|---|---|---|---|
| `asserted` | "Self-declared" | "Self-declared by member" | "Self-declared, no supporting proof" | "Claim only" |
| `supported` | "Supported by [proof]" | same | "Supported; not verified" | "Claim with support" |
| `verified[cooperative_internal]` | "Verified by our internal verifier" | "Cooperative-verified (internal)" | "Cooperative-verified, **not independent**; your own due diligence applies" | "Cooperative-verified; subject to independent verification" |
| `verified[platform]` | "Checked by Symphony (scope)" | "Platform-checked; counts toward Symphony readiness" | "Platform-checked; **you decide whether to accept it**" | "Platform-checked; not independent verification" |
| `verified[independent_external]` | "Independently verified (scope)" | same | "Independently verified (scope, verifier, version)" | n/a (their own) |
| `approved_official` (R) | "Official cooperative record" | same | "Official cooperative record approved by [position]; authenticity not independently verified" | same |
| `held_draft` | "Held as draft: by-law not yet amended" | same | "Held as draft" | same |

**Acceptance (ADR-011, O-11):** each destination or audience has `accepted_assurance_classes`. Symphony programme views accept `cooperative_internal`, `platform` and `independent_external`. Each institution configures its own list; the default for the legacy destinations is `any`, which leaves the 30 expected results unchanged. A third party that does not accept a class simply sees the item as "not accepted by your policy"; it is never hidden.

## 7. Track X: issued documents

`supplied → admitted → checked`. Admission by an officer records that the cooperative holds it, not that it is genuine. A **check** (platform check, IFV finding, or external verification) states what was compared (for example certificate number against a copy of the Registrar's registration). Documents the Registrar issues for by-laws feed the by-law version status (`submitted_to_registrar`, `registered_current`).

## 8. Pipeline stages

| Stage | Meaning | Who acts | What evidence typically does |
|---|---|---|---|
| **S0 Enrolment** | Workspace created, identity and authority being established | Self-enroller (certificate details, accounts only), first official, enroller (proxy + platform check) | Certificate `asserted` (self-enroller) → admitted by first official → platform-checked. Proxy entries `supported` |
| **S1 Cooperative operations** | Cooperative runs governance and records | Officers, committees, members, field agents, IFV | Tracks C and R run in full; IFV findings; duty process |
| **S2 Programme / TA** | Union or programme works with the cooperative | TA/union (delegated scope), programme manager | Programme records `supported`; capability gaps; no PII; legal advisory routing |
| **S3 Institutional due diligence** | Lender or fund reviews | PFI roles, independent verifier (VVB) | Institution sees audience-relative labels; own findings stay separate (`institutional`); reliance recorded by the institution |
| **S4 Monitoring** | After financing | PFI monitoring, IFV, field agent | Currency/staleness matters; re-verification on new versions |

An act is only available in the stage it belongs to (for example institutional findings in S3/S4). The stage is a field on the organisation and is stamped on each act, so history shows what stage a fact entered in.

## 9. Overlays

- **Dispute:** separate record on a version; label "Disputed" overrides display until resolved; history retained.
- **Currency:** per class staleness window (for example attendance records vs certificates). Stale shows "Stale since [date]"; does not change level.
- **Held:** resolution conflicting with the by-law of record is `held_draft` (`03` §5).
- **Conflict:** two IFV findings that disagree block promotion until a third IFV or external verifier resolves.

## 10. The computation (`computeStanding`)

Input: track, origin, version events (author, submit, approve), support items, findings with assurance class and scope, platform checks, disputes, policies (Duty Matrix, acceptance), stage, audience, now. Output: `{ level, assuranceClass, recordStatus, flags[], labelKey, scopeText, a11yText, nextActions[] }`.

Invariants (property-tested): standing never rises without an event that names the exact version; a new version resets to origin start; admission alone never changes `level`; no output depends on client-supplied status; the function is pure and deterministic for the same inputs.

## 11. Requirements

EVD-007 to EVD-011 in `03` §12. Scenarios: `features/03_evidence_standing.feature`, `04_duty_process_records.feature`, `05_internal_field_verifier.feature`.
