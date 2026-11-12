# Symphony Prototype: Build Plan (V3 freeze lifted, scoped)

**Document ID:** `SYMPHONY-BUILD-PLAN-3W-001` (revision 2)
**Date:** 2026-10-10
**Authority:** Founder order to lift the V3 architecture freeze (`DECISIONS.md` R33).
**Precedence:** founder directions of 2026-10-10 outrank `SYMPHONY-EXEC-PLAN-V3` (R34). The review amendments in R35 supersede the parts of R34 they name.
**Scope of the lift:** only the delta inventory in section 5. Everything else in V3 stays in force unless R34 or R35 says otherwise.
**Status:** plan only. No code written yet.

---

## 0. What I verified in the repository

The assessment text supplied earlier describes an older shell. The repo already has a first journey layer. This plan builds on it.

| Area | State today |
|---|---|
| Shell | `JourneyRouter.tsx` and `components/journeys/`: `LoginScreen`, `cooperative/` (8 steps), `nabii/`, `ta/`, `pfi/`, `vvb/`, `fieldagent/`, `portfolio/`, `discovery/`, `assetSummary.ts`. |
| Login | A role picker. No dashboard after sign-in: every role drops into step 1 of its journey. |
| NABII | Two states only (ready or not ready for Lender A) plus a portfolio tab. |
| TA | Queue, then a workbench whose only action is "assign independent verification". |
| Assets | `assetSummary.ts` separates members' livestock from cooperative assets. Used only as one line of text. |
| Seeded display data | `members_roster`, `coop_assets`, `certificate_officers`, `current_officers` already live in `cases.json` (R25). |
| Engine actions that exist | `upload_minutes`, `signoff_minutes`, `add_evidence`, `mark_verified`, `restructure_request`, `raise_dispute`, `resolve_dispute`, `withdraw_dispute`, `assign_verification`, `record_verification_finding`, `record_reliance`, `raise_finding`, `request_evidence`, `record_outcome`, `record_admission`, `confirm_payment`, `present_to_destination`, `export_dossier`. |
| Engine actions that do not exist | TA intervention, TA completion, discoverability or consent, an institution-to-cooperative message. |
| Real-name rule | `forbidden_terms.json` lists real lenders, including the lender named in your bank story. The UI, fixtures and source files must use "Lender A", "Lender B" and so on. |

**Not verified:** I have not run the app, Vitest, Playwright or the oracle. I have read only the login, router, NABII and TA journey code. PFI, VVB, portfolio, discovery and the shell are unread, so effort estimates for them are provisional until Day 1 (section 10).

---

## 1. Product boundary

This is the standard every screen is judged against.

- **Symphony provides evidence and makes it inspectable:** source, provenance, limitations and the identifiable people behind each claim.
- **The institution decides** what it believes, what it must verify and whether to proceed. Symphony never approves, offers or guarantees anything.
- **A Field Agent's statement is a traceable claim by an identifiable source.** It is not a Symphony guarantee, and a phone call to the agent does not change the claim's evidence level.
- **The value shown** is a shorter path from a first lead to an informed verification request, without starting from a call to the cooperative chairman.

### Strategy input: EcoVadis principles

I read the EcoVadis page. It lists seven principles and does not describe the scoring mechanics, so I use the principles only.

| Principle | How Symphony applies it |
|---|---|
| Evidence based | Every figure shows its evidence level (asserted, supported, verified). |
| Traceability and transparency | Every KPI and result has "How was this established?" within two clicks. |
| Diversification of sources | Each KPI shows how many distinct source types stand behind it, as a count and not a score. |
| Industry, location, size matter | Proportionate KPIs. The ESG-IRIS reference is a corporate dashboard (Scope 1 to 3 emissions, lawsuits, whistleblower cases); I borrow its layout, not its metrics. |
| Assessment by experts | Findings come from named human verifiers. No AI. |
| Continuous improvement | Baseline versus current, and "what changed since last review". |
| Technology | Deterministic engine, computed numbers. |

**Score and IRIS+ (R34).** An illustrative proprietary **Symphony ESG Index** is allowed, with these conditions:
- It is named as illustrative and proprietary, its formula is shown, and each indicator shows its contribution.
- It is display only. It never feeds readiness (I4) and never appears as a lender requirement.
- IRIS+ labels read **"IRIS+ aligned metric (illustrative)"**. IRIS+ is published as a catalog of metrics and Core Metrics Sets and I found no compliance scheme, so "compliant" is not used. Metric codes come from the GIIN catalog and none are invented.
- No EcoVadis name, score, medal or alignment claim appears in the UI.

---

## 2. Design rules for every role

1. **Sign-in lands on the role's dashboard.** The journey starts from there.
2. **One stepper per role**, always visible ("Step n of N"). One primary action per screen.
3. **One `CaseState` underneath.** Roles see scoped views of it. No parallel data models.
4. **Boundary label on every screen** (I7), text from `help.json` via `VisibleStatement`. Existing journey components contain inline strings; new components follow the rule and existing ones are migrated as they are touched.
5. **Every number is computed** from fixtures or live engine state.
6. **Action labels on every consequential screen** (section 4). The user can always tell whether they are viewing, recording a claim, making a request, or recording a finding or decision.
7. **Demo personas, not a login façade.** Sign-in is a clearly labelled persona selector ("Demo sign-in: no authentication"). A persona routes to its dashboard. Nothing implies accounts, passwords or access control exist.

---

## 3. Journeys by role, from sign-in

### 3.1 SME / cooperative (greenfield, assisted by a Symphony technician)

Sign-in lands on the **cooperative dashboard in its empty state**.

| # | Screen | What happens | Rule |
|---|---|---|---|
| 1 | Sign-in | Demo persona selector. A **Create Account** link and a **Terms and Conditions** link, each opening one short static page ("Account creation is not part of this demo. Registration is technician-assisted after sign-in."; demo terms text). | You asked for both links; they are static. |
| 2 | Dashboard (empty) | One primary action: **Add first member**. | Technician persona: can enrol members and assign roles only. It has no access to governance, dossier or institutional views. |
| 3 | Member roster enrolment | Enrol one member in four blocks (section 7), including livestock. | Special-considerations field is voluntary. |
| 4 | Select roles | Members page as a list or grid. Select a member, edit, assign a role, **including Field Agent**. | The Field Agent is a cooperative-designated internal verifier with contact details. Their checks are labelled "Cooperative Field Agent: internal, not independent". An agent cannot verify their own livestock (I1). |
| 5 | Cooperative profile and registration | Save. **Add Member to Roster** opens the dashboard with KPIs from the seed. | |
| 6 | Select role to begin journey | Cooperative Enterprise roles only. | Chairman and Secretary proceed. Treasurer and Member see "not permitted for this step". The Secretary's authority to submit minutes stays distinct from the Field Agent's role. |
| 7 | Governance and officers | Current officers compared with the certificate. The certificate secretary is missing from the current officers list, so a discrepancy is recorded (R28). | Deterministic rule. The discrepancy is recorded, not adjudicated. |
| 8 | Operating and farming history | One season of history. | |
| 9 | Cooperative baseline | Baseline indicators with source and date. | |
| 10 | Dashboard (populated) | ESG-IRIS layout adapted to cooperative KPIs, with the illustrative Symphony ESG Index and IRIS+ aligned labels (section 1). Total assets split Members' and Cooperative-owned (section 8). | |
| 11 | Institutional readiness | Lender A and Lender B, computed (section 9). | |
| 12 | Present dossier | Chairman only. Uses `present_to_destination`. | Creates the snapshot record. It does not change the underlying evidence. |
| 13 | Logout | Returns to sign-in. | |

### 3.2 NABII (fund manager)

Sign-in lands on the **pipeline dashboard**:

1. **Dashboard.** National totals in four mutually exclusive states (section 6), plus programme KPIs. Assets compound with a composition bar. National and province figures are labelled **illustrative context** (synthetic seed). They are not drillable to enterprise records.
2. **Drill down** to the district and cohort level, where the **10 modelled cooperatives** are the live cohort. Counts for the cohort equal the list shown, exactly.
3. **Select an enterprise** to open its record with the computed reason for its state.
4. **Identify needs.** Recurring gaps across the live cohort, by requirement.
5. **Coordinate support.** Record a TA request on a gap.
6. **Discoverable pipeline.** Record a discoverability and consent change for an assessment-ready enterprise (full build, not the demo sprint).

NABII must be able to show that a weak cooperative can be found, its gaps acted on, and its state change after evidence or assistance is added.

### 3.3 SBGI / Technical Assistance

Sign-in lands on the **intervention dashboard**. Then: queue, select enterprise, inspect gap, record assignment (provider, scope, intended result), review evidence of completion, reassess readiness (computed).

TA completion never changes an evidence level. Independent verification is a separate assignment.

### 3.4 Bank (PFI)

Sign-in lands on the **lender dashboard**. Stepper: **Discover, Inspect, Query or verify, Assess, Decide, Monitor.** The officer's job is to find a credible opportunity and start the next step. The bank decides, never Symphony.

**Bank story (Chisamba Farmers Cooperative, `case-1`). This is the acceptance test for the bank vertical slice.**

1. **Unpromising first case.** The officer opens Chisamba. Lender A: not ready. Lender B: not ready. That does not close the door on serving the members another way.
2. **Alternative opportunity.** Under Lender B, the asset information shows substantial livestock. The screen separates Members' livestock from cooperative-owned assets. This is a possible direct-to-member opportunity, not cooperative collateral.
3. **Follow the claim to its source.** The officer opens the livestock claim: quantities, source, evidence level, date, and the Field Agent who claims to have checked the stock, with role and contact, labelled internal.
4. **Avoid starting from zero.** The officer calls the agent directly (demo contact from `contacts_seed.json`). The call does not change the claim's evidence level, and the screen says so.
5. **Initiate verification from the claim.** The officer requests verification (`assign_verification`) of the livestock claim, choosing an authorised internal bank verifier or an external verifier. The task is scoped to that claim and its evidence. The verifier records method, evidence examined and a finding. The finding is not a guarantee of any loan outcome.
6. **Put the opportunity in motion.** The officer sends the cooperative an enquiry proposing a direct-to-member arrangement with the cooperative helping to coordinate. It appears in the cooperative's view. It is not an approval, an offer, or a change to readiness.

**Pass conditions:** every figure in steps 2 to 4 resolves to a named source and contact; neither the call nor the verification request nor the enquiry changes an evidence level or readiness; the engine records each request as an event.

### 3.5 VVB (independent verifier)

Sign-in lands on the **assignment dashboard**. Then: queue, open assignment, review the defined claim, scope and source evidence, conduct verification and record **method and evidence examined**, record finding (result vocabulary as the engine defines it), publish to the governed record. There is no "verify the whole cooperative" form.

### 3.6 Portfolio manager and discovery marketplace

Not expanded in this plan. They stay as the existing `PortfolioJourney` and `DiscoveryTable`, reached from the Bank Monitor and Discover stages.

---

## 4. Action contract

Each consequential action shows a persistent label and a confirmation with **Before** (what will change), **After** (what was recorded, by whom, when, with what status) and **Unchanged** (related state this action does not change). The After state is read from the persisted engine event, never from an assumed success.

Labels: **VIEW ONLY**, **RECORD CHANGE**, **REQUEST / ASSIGNMENT**, **INSTITUTIONAL FINDING OR DECISION**.

| Action | Label | Engine today | Visibly changes | Must not imply |
|---|---|---|---|---|
| Open provenance, view discrepancy, view history | VIEW ONLY | read | Nothing | |
| Field Agent records livestock claim or check | RECORD CHANGE | `add_evidence` on `asset_inventory`, level `asserted` or `supported` | The attributable claim and provenance | That Symphony verified the livestock |
| Officer discrepancy recorded | RECORD CHANGE | `add_evidence` with `has_discrepancy` (R28) | A scoped discrepancy keeping both officer lists | That it has been adjudicated |
| Bank requests verification | REQUEST / ASSIGNMENT | `assign_verification` | The assignment, claim and scope | That the claim is verified |
| Verifier publishes a finding | INSTITUTIONAL FINDING | `record_verification_finding` (gains `method_and_evidence_examined`) | The finding in the claim's history | That the whole cooperative is verified |
| Bank asks for evidence | REQUEST / ASSIGNMENT | `request_evidence` (needs a presented case) | An open request | That the requirement is satisfied |
| Bank sends enquiry or proposes a product | REQUEST / ASSIGNMENT | **new** `institution_message` | The interaction and its status | That the bank approved or offered a loan |
| Bank records decision | INSTITUTIONAL FINDING OR DECISION | `record_outcome` | The bank's outcome and basis | That Symphony decided |
| NABII requests TA | REQUEST / ASSIGNMENT | **new** `request_ta_intervention` | The request and intended result | That evidence improved |
| TA completion recorded | RECORD CHANGE | **new** `record_ta_completion` | The completion record and any submitted evidence | That a claim is verified |
| Discoverability or consent changed | RECORD CHANGE | **new** `set_discoverable` (full build) | The sharing state, who recorded it and when | That consent exists because a toggle was clicked |
| Dossier presented | RECORD CHANGE | `present_to_destination` | The presentation snapshot | That evidence changed |

**Scope rule:** this table is the contract to verify against the engine on Day 1. The four new actions are in the delta inventory. Any other missing write action is added only if it is essential to the two demos.

---

## 5. Delta inventory (the scope of the unfreeze)

Nothing outside this list may be added.

**Engine (`src/engine/`, pure).** R25 froze `types.ts`; R33 lifts that for these items only.
- `pipeline.ts`: `blockingExceptions(case, destination)`, `workflowState(case, destination)`, `stateDistribution(cases, destination)`.
- `actions.ts`: `institution_message`, `request_ta_intervention`, `record_ta_completion`, `set_discoverable` (last in the full build). `record_verification_finding` gains `method_and_evidence_examined`.
- `types.ts`: `TaIntervention`, `InstitutionMessage`, `discoverable`, and the new finding field.
- `esg.ts` (pure, deterministic index from case data).
- Reused, not rebuilt: officer comparison and discrepancy storage (R27, R28), asset helpers in `journeys/assetSummary.ts` (gain `memberLivestockByCategory`, `assetsByOwner`).

**Data (`data/`)**
- `cases.json`: **append** `case-10`. Display-only fields (livestock, verifying agent, contact references) may be added to `case-1`. Evidence and project data of `case-1` to `case-9` are not edited.
- `members_seed.json`, `coop_kpi_seed.json`, `national_seed.json` (synthetic, illustrative, aggregate only), `contacts_seed.json` (fictional contacts, editable to a real demo number), `iris_mapping.json`, `esg_index.json`.
- `roles.json`: add a technician persona limited to enrolment and role assignment; add journey-step permissions for the governance gate; add the Field Agent cooperative designation.
- `help.json`: all new visible text. `expected-results.json` and `reference_oracle.py`: add `case-10` and the four-state expectations. The baseline 27 results must not change.

**Screens and components:** persona sign-in, static terms and account pages, role dashboards (cooperative, NABII, TA, bank, VVB), member enrolment, member roles, cooperative profile, role gate, TA assignment, TA completion; `JourneyStepper`, `ActionLabel`, `ChangeConfirmation` (Before, After, Unchanged), `AssetSplitPanel`, `AssetCompositionBar`, `LivestockTable`, `StateDistribution`, `SourceCount`.

**Re-freeze:** at the Week 3 gate this inventory becomes the new baseline.

---

## 6. NABII four-state classification

States are computed, mutually exclusive and exhaustive. **First match wins, in this order:**

1. **Remediation required:** a blocking exception remains open for the selected destination.
2. **Assessment-ready:** destination readiness passes and no blocking exception remains.
3. **Initial record:** no evidence for that destination is above `asserted`.
4. **Evidence progressing:** everything else.

**Blocking exception** (one function, `blockingExceptions`, used by both readiness display and classification so the two cannot disagree): an engine overlay `disputed` or `stale` on evidence behind a requirement for that destination, or an open officer discrepancy on `governance_officers` evidence. The second clause is my proposal; if you prefer that a discrepancy show only as an unresolved gap, remove it and the case moves to Evidence progressing.

Required tests: no case is both ready and in Remediation required; counts at each level sum to the cohort; each filtered list equals its count.

**Counts at each level.** National and province figures are the synthetic seed plus the live state of the 10, labelled illustrative. The seed has no enterprise records, so it is shown as a non-clickable "other enterprises (aggregate, not modelled)" line. Drill-down lists exist only for the 10 live cases, and the list equals the live count exactly.

---

## 7. Member enrolment fields and livestock display

- **Identity and inclusivity:** gender (male, female, prefer not to say), date of birth or age, household head (yes or no), special considerations (voluntary self-identification). Headship by gender and the **youth flag** are separate computed attributes. A head under 35 years qualifies as a youth-led household whatever the gender, so counts can overlap and dashboards say so.
- **Land and asset:** land status (customary, titled, rented, none), farm size in hectares, bank or mobile money (yes or no, provider), **livestock by category with count and reported encumbrance status**.
- **Education and digital:** highest education, primary language, device (smartphone, feature phone, none).
- **Community welfare:** household size, water source, energy source for cooking and lighting.

**Livestock display.** It must say what is actually present. "Unregistered" and "unencumbered" are not synonyms, and the screen never implies a registry connection.

| Livestock category | Total count | Reported encumbrance status (as reported by source) | Registry check | Security interest holder (as reported) | Recorded by |
|---|---|---|---|---|---|
| Beef cattle (Herd A) | 150 | Reported unencumbered | Not performed | None reported | Field Agent, with contact |
| Dairy cows (Herd B) | 50 | Reported unencumbered | Not performed | None reported | Field Agent, with contact |
| Goats (Batch 2026) | 300 | Reported unencumbered | Not performed | None reported | Field Agent, with contact |

- Each row shows its evidence level (`asserted` or `supported`), source and date. A row with a registry search would need the search and its recorded outcome in the fixture; none are seeded.
- R26 still applies: a newly added row defaults to `Not recorded`. The demo seed sets `Reported unencumbered`.
- All three rows are unencumbered with no holder, so no real lender name appears. Any encumbered example uses "Lender A", "Lender B".

---

## 8. Assets: Members' versus cooperative-owned, by drill-down level

Aggregate levels may compound, but the split is always one click away and the composition is visible. From enterprise level down, always split.

| Level | Where | Display |
|---|---|---|
| L0 | NABII, bank and portfolio dashboards | One compound "declared assets" figure with a composition bar: Members' assets and Cooperative-owned, both labelled. |
| L1 | State lists, discovery results, TA queue | Two separate columns. No combined column. |
| L2 | Enterprise record (cooperative dashboard, bank Inspect, NABII record, TA inspect) | Two separate panels with their own headers and limitation text. Members' panel shows livestock **by category across all members**, not per person. Caption: "Members' personal property. Not cooperative assets and not cooperative collateral." |
| L3 | Individual member | SME-side roles for their own cooperative only. Institutions never see named members or household details (R29). |

---

## 9. Greenfield case and expected readiness

New fixture `case-10`, a fictional greenfield cooperative: not irrigated, working-capital purpose, one season of history, single request within range.

**Lender A** (11 requirements; A8 and A9 not applicable, A10 assessment-time): 5 satisfied (A3, A4, A5, A7, A11) and 3 unresolved (A1 registration, because the officer discrepancy blocks `verified`; A2 governance; A6, one season where two are needed).

**Lender B** (8 requirements; B8 assessment-time, leaving 7 that can be satisfied or unresolved). **Decided: option (a).** The engine's computed result is shown and `destinations.json` is not edited: 4 satisfied (B2, B4, B5, B6) and 3 unresolved (B1 registration, B3 member register, B7 per-group fit). The oracle expects these figures.

---

## 10. Schedule

Dates for the two demos are taken from your review: **bank demo Tuesday 13 Oct, NABII demo Wednesday 14 Oct.** Today is Saturday 10 Oct. The three-week build starts after the demos.

### Demo sprint (Sat 10 to Wed 14 Oct): two vertical slices

| Day | Work |
|---|---|
| Sat 10 | Baseline: run oracle, help validator, Vitest, Playwright and `verify:all`; confirm 27 of 27. Read the unread PFI, VVB, portfolio, discovery and shell code. Audit section 4 against the engine and confirm `case-1` has `asset_inventory` evidence and that verifier users carry an internal or external kind. Add the data files needed by the bank slice. |
| Sun 11 | **Bank slice:** `case-1` display additions, bank dashboard, Inspect with asset split and livestock provenance, Field Agent contact panel. |
| Mon 12 | **Bank slice complete:** verification request via `assign_verification`, verifier method and evidence field, `institution_message` and its cooperative-side view, `ActionLabel` and `ChangeConfirmation`. Playwright test of the bank story. Rehearse. Start NABII engine work (`workflowState`, tests). |
| Tue 13 | Bank demo. **NABII slice:** four-state dashboard, drill-down to the 10 live cases, enterprise record with reason, gap identification, TA request. |
| Wed 14 | NABII slice: show the resulting state change after an evidence or TA action; reconcile counts; Playwright test; NABII demo. |

**Cut line if time runs short:** persona selector only (no static pages), no ESG Index, no SME journey changes, no discoverability, no TA completion. Keep the two slices and their tests.

Demo state resets between sessions; the demo transition for NABII can use Chisamba, whose notes say closing A2 and A6 makes it ready for Lender A.

### Week 1 (from Thu 15 Oct): SME journey

Persona sign-in and static pages; technician persona; member enrolment and roles (including Field Agent); cooperative profile; role gate; governance and officers; operating history. **Gate W1:** steps 1 to 8 run end to end in Playwright, the role gate blocks Treasurer and Member, the discrepancy is recorded, and the 27 baseline results are unchanged.

### Week 2: Dashboards, TA, ESG

Cooperative baseline; populated dashboard with the Symphony ESG Index and IRIS+ aligned labels; readiness for Lenders A and B; present dossier and logout; TA dashboard, assignment, completion and computed reassessment; discoverability and consent. **Gate W2:** four-state counts reconcile; TA completion never changes an evidence level (test).

### Week 3: Remaining roles, hardening, re-freeze

VVB dashboard and scoped workbench; bank Query, Assess, Decide and Monitor polish; cross-role end-to-end run on one case; update `help.json`, `tours.json` and the capture registry; X2 including `dist/`, X3, `verify:bundle`, responsive check; `DECISIONS.md` and `README.md`; re-freeze with section 5 as baseline. **Gate W3:** `npm run verify:all` green; each of the five roles reaches its end state from sign-in in one run.

---

## 11. Founder answers and remaining defaults

- **Applied:** score and IRIS+ labels (R34, with "aligned" wording); youth under 35; Field Agent as internal verifier; NABII national totals with the 10 live cases on drill-down; Lender B option (a); Chisamba bank story as acceptance test.
- **Superseded by your latest instruction:** keeping "Official Registry Status" exactly as drafted. Section 7 now separates reported status from registry check (R35).
- **Defaults awaiting your veto:** equal ESG pillar weights in `esg_index.json`; synthetic national seed generated by me; disability self-identification shown only as aggregates, with small counts suppressed at a threshold you set; mobile-money provider options used only if absent from `forbidden_terms.json`; the officer-discrepancy clause in `blockingExceptions`.
