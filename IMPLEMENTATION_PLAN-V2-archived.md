# Symphony Interactive Prototype: Full Technical & Institutional Implementation Plan

**Document ID:** `SYMPHONY-EXEC-PLAN-V2`  
**Target:** Self-Contained Deployment in `Prototype/` for [Vercel](https://vercel.com)  
**Governing Documents:** [Prototype/AGENT.md](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/AGENT.md), [symphony-build-kit/kit/README.md](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/symphony-build-kit/kit/README.md), [TEST_CASES.md](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/TEST_CASES.md), [CAPTURE_SPEC.md](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/CAPTURE_SPEC.md)  
**Stakeholder Lenses:** **NABII Zambia** (Market Facilitator & TA Operating System) & **Commercial PFIs / Lenders** (PFI Credit & Green Finance Assessment)

---

## 1. The Core Institutional Boundary & Demonstration Anthem

Throughout the application, on screen banners, transition modals, and guided tours, the prototype prominently displays this foundational boundary:

> ### **“Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision.”**

This single principle separates Symphony from ordinary onboarding forms or automated underwriting algorithms. It gives commercial credit officers confidence that Symphony does not overstep into their risk mandate, while giving ecosystem facilitators a measurable way to track enterprise readiness.

---

## 2. The Three Distinct Institutional Perspectives

The prototype avoids forcing all actors into a single generic workflow. It models three explicit, differentiated perspectives over the same underlying governed state:

```
1. SME / TA PERSPECTIVE
   Establish ──► Assess ──► Remediate ──► Become Ready ──► Present

2. PFI / BANK PERSPECTIVE (Lender A)
   Receive ──► Inspect Requirements ──► Examine Evidence ──► Identify Gaps ──► Request/Assess ──► Make Own Decision

3. NABII FACILITATOR PERSPECTIVE
   Identify ──► Cohort ──► Intervene ──► Track Readiness ──► Present ──► Observe Conversion
```

### Strict Scope Boundary & Data Hygiene
* **Zero Real Bank Names in UI (Test X2):** The interface strictly displays `"Lender A"` and `"Lender B"`. Commercial bank names (e.g. Zanaco, Stanbic, Absa) are strictly prohibited on all screens, headers, buttons, and assurance chains.
* **Zero Invented Funnel/Cohort Data:** Pipeline conversion and cohort views are computed directly from the 9 seed cases (`data/cases.json`). No external 100-SME numbers are invented.
* **Architecture Freeze:** No additional entities, screens, or mock databases beyond what is specified in this document and `AGENT.md`.

---

## 3. Executive Architectural Strategy

The prototype demonstrates an underlying **governed state and evidence infrastructure** bridging the information asymmetry between SME development programs and commercial finance.

```
       [TA / ECOSYSTEM LAYER]                    [INSTITUTIONAL DEBT LAYER]
           NABII Zambia                                   Lender A
  ┌─────────────────────────────┐               ┌─────────────────────────────┐
  │ • 9-Cooperative Pipeline    │               │ • PFI Assessment Dossier    │
  │ • TA Intervention Operating │               │ • Structured Pre-Assessment │
  │   System (Workload Tracker) │               │ • Evidence Admission Matrix │
  │ • Dynamic Conversion Stages │               │ • Prominent Boundary Banner │
  │ • Destination Projection    │               │ • Independent Credit Decision│
  └──────────────┬──────────────┘               └──────────────┬──────────────┘
                 │                                             │
                 ▼                                             ▼
        [PRE-FINANCING STATE]                         [POST-DISBURSEMENT]
         Governed Readiness                            Facility Monitoring
         Chisamba Farmers Co-op                        • Use of Proceeds Checks
         2027 Climate-Smart Maize                      • Overdue Covenant Tracking
         (Computed, Immutable Basis)                   • Green Claim Assurance
```

---

## 4. Phase-by-Phase Implementation Blueprint

Execution strictly follows the **stop-and-report phase gates** defined in `AGENT.md`. No phase begins until the preceding gate passes.

---

### Phase 1: Pure State Engine, Fixture Loading & Test Matrix
**Goal:** Build the deterministic TypeScript state machine in `src/engine/` that reproduces all data fixtures, role rules, and tests without browser dependencies.

* **Module Inventory (`src/engine/`):**
  * `types.ts`: Comprehensive typing for cases, requirements, rules, evidence, covenants, events, and actors matching `data/meta.json` and `data/roles.json`.
  * `evaluate.ts`: Pure functional evaluation of destination requirements:
    * Evaluates rules: `evidence`, `evidence_count` (e.g. seasons), `assessment_time`, and `fit` (`single_request` vs `per_group_request`).
    * Computes readiness: `ready = (no unresolved) && (no exceptions)`.
    * Implements destination projection: transforms state against Lender A, Lender B, and NABII without mutating baseline data.
  * `actions.ts`: State transition function: `(caseState, action, actor) => { ok, caseState, event } | { ok: false, code, rule }`:
    * Enforces role RBAC from `data/roles.json`.
    * Prevents self-verification (`SELF_VERIFICATION`), self-confirmation (`SELF_CONFIRMATION`), and un-signed governance (`SIGNOFF_REQUIRED`).
    * Appends prior records to `history` stack (Invariant **I2: Supersede, never overwrite**).
    * Restructures requests (T6) to prove product-fit separation from evidence gaps.
  * `covenants.ts`: Pure covenant evaluator: checks due dates against `meta.demo_date = "2026-10-06"`. Worst covenant determines case monitoring state (`overdue` > `due` > `current`).
* **Test Suite Implementation (`tests/engine.test.ts`):**
  * Implement Vitest tests for:
    * **T1:** Baseline evaluation of `case-1` across all 3 destinations.
    * **T2:** Hero gap remediation sequence (upload -> signoff -> verify -> add farming history) flipping Lender A only.
    * **T3 & T3b:** Staleness date propagation on `case-3` (expired registration exception).
    * **T4:** Optional early off-take evidence behavior (`assessment_time`).
    * **T5a–e:** RBAC enforcement (role violations, self-verification, signoff blocks, PFI read-only guards).
    * **T6:** Request restructuring logic on Lender B fit checks.
    * **T7:** Heterogeneous readiness on `case-9` (Ready for B and N; blocked on A).
    * **T8a:** Basis traceability and mandatory limitation texts.
    * **D1:** Fixture integrity checks on `data/cases.json`.
    * **X1:** Covenant monitoring logic (`case-6` current vs `case-7` overdue).
    * **Regression Matrix:** Loop over all 27 permutations (9 cases × 3 destinations) asserting exact parity with `tests/expected-results.json`.
* **Gate 1:** All Vitest unit tests pass. 27/27 permutations match `expected-results.json`. Zero fixture edits.

---

### Phase 2: Design System, Reusable Visual Primitives & Audit Drawer
**Goal:** Build the modular UI components in `src/components/` following Vanilla CSS tokens, ensuring every state reflects its basis in 2 clicks (T8b).

* **Component Inventory (`src/components/`):**
  * `BoundaryLabel.tsx`: Persistent badge rendering `"Beachhead"`, `"Same state, extended"`, or `"Same state, extended: illustrative. Not built."` (Invariant **I7**).
  * `InstitutionalBoundaryBanner.tsx`: Prominently renders the signature anthem:  
    *“Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision.”*
  * `GovernedMetricCard.tsx`: Metric title, state badge, value, evidence summary, verifier/date, limitation disclosure, and action triggers (`data-testid="metric-card-*"`).
  * `RequirementCard.tsx`: Requirement title, destination context, applicability tag, rule state, limitation text, and remediation trigger.
  * `RequirementChain.tsx`: Interactive visual stepper: `Requirement → Applicability → Evidence → Verification → Finding → State`.
  * `EvidenceDrawer.tsx`: Slide-over drawer detailing evidence type, supplier, timestamp, verifier, limitation, and complete immutable history stack.
  * `TraceabilityTrigger.tsx`: The signature **"How was this established?"** component that opens the Requirement Chain (Click 1) and Evidence Drawer (Click 2).
  * `StateTransitionCard.tsx`: Displays before/after state diffs with initiating actor and evidence reference.
  * `DestinationSwitcher.tsx`: Toggles between Lender A, Lender B, and NABII Programme Pipeline.
  * `RoleSwitcher.tsx`: Toggles active persona across `roles.json`. Disabled actions display role tooltips.
  * `EventLogDrawer.tsx`: Collapsible bottom panel rendering the live event stream derived dynamically from engine `events[]`.
* **Playwright Component Gate (`tests/components.spec.ts`):**
  * Verifies rendering of all vocabulary states: `asserted`, `supported`, `verified`, `disputed`, `stale`.
  * Automates **T8b**: Verifies that any state badge reaches its evidence drawer in at most 2 clicks.
* **Gate 2:** Storybook/demo route confirms component rendering; T8b Playwright test passes cleanly.

---

### Phase 3: SME Hero Path (Stages 1–9: The Beachhead)
**Goal:** Implement the end-to-end journey of Chisamba Farmers Cooperative (`case-1`) from unassessed fragmentation to Lender A readiness.

* **Screens Implemented (`src/views/sme/`):**
  1. `LoginView.tsx`: PIN input + persona switcher with cooperative selector.
  2. `EnrollmentView.tsx`: Simulates organization creation with banner: *"No bank. No programme. No loan required."*
  3. `SMEDashboardView.tsx`: KPIs (readiness per destination, stacked bar of evidence tiers, days to next expiry, alert panel).
  4. `OrganizationStateView.tsx`: Governed cards across Legal, Governance, Membership, and Financial sections.
  5. `ProjectStateView.tsx`: 2027 Climate-Smart Maize project baseline (Activity, Assets, Production, Environmental).
  6. `RequirementsView.tsx`: Active destination checklist with footer: *"Illustrative products."*
  7. `GapRemediationView.tsx`: State transition workflow executing Test T2 end-to-end (upload minutes -> chairman signoff -> field agent verification -> add farming history).
  8. `ReadinessBasisView.tsx`: The "Why?" drill-down screen concluding with the prominent banner:  
     *“Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision.”*
  9. `DestinationProjectionView.tsx`: Instant destination toggle demonstrating: *"Same enterprise. Same project. Different requirement context."* (A: Ready; B: Blocked on Group Fit). Includes request restructuring action (T6).
  10. `PresentToDestinationModal.tsx`: Handoff transition to Lender A with frozen snapshot generation and clear disclaimer: *"Assessment Ready does not constitute financing approval."*
* **Gate 3:** Playwright script executes tests T1, T2, T4, T5, T6, and T7 in sequence through the real DOM. Reset control restores exact baseline.

---

### Phase 4: Lender A / PFI Assessment Workspace & Decisioning (Stage 10)
**Goal:** Deliver the commercial credit officer experience answering the bank's trust, time-saving, and evidence-admission questions without displaying real bank names.

* **Screen Architecture (`src/views/lender/PFIAssessmentView.tsx`):**
  * **Prominent Institutional Boundary Header:**
    ```
    ┌────────────────────────────────────────────────────────────────────────┐
    │  SYMPHONY ESTABLISHED & GOVERNED READINESS EVIDENCE                    │
    │  Lender A establishes creditworthiness, security & makes the decision  │
    └────────────────────────────────────────────────────────────────────────┘
    ```
  * **Structured Pre-Assessment Comparison:**
    * *Standard Application Baseline:* Unstructured, unverified documentation with high verification burden.
    * *Symphony Dossier:* Structured presentation with pre-validated provenance, verified field visits, and transparent limitations.
  * **Evidence Admission Table:**
    * Maps each requirement to its evidence item, field agent verification, and mandatory limitation.
    * Includes interactive **PFI Admission Status** toggle: `[Accepted | Requires Independent Registry Query]`.
  * **Non-Underwriting Disclaimers Panel:**
    * Visual distinction:
      * *Symphony Established:* Requirement state, evidence provenance, field verification, data limitations.
      * *Lender A Determines:* Creditworthiness, repayment capacity, security, risk appetite, pricing, approval.
  * **Interactive Assessment Actions:**
    * Accept/Reject evidence.
    * Request additional evidence (opens SME remediation request loop tested on `case-8`).
    * Add internal credit finding.
    * **Record Outcome Choice:** Explicit manual choice `[Approved | Declined | Deferred | More Evidence Requested]`. Never pre-selected.
* **Gate 4:** An outcome cannot be submitted without manual selection; SME view instantly updates with lender requests; no automated underwriting path exists; zero matches for forbidden terms (Test X2).

---

### Phase 5: Post-Disbursement Monitoring & Continuity (Stages 11–12)
**Goal:** Prove to lenders that pre-financing evidence becomes the baseline for post-financing facility monitoring and green-finance compliance.

* **Screen Architecture (`src/views/monitoring/FacilityMonitoringView.tsx`):**
  * **Facility Summary (`case-6`):** Active facility details from `data/cases.json`:
    * Facility amount: **ZMW 180,000**, 24 months, Lender A (`status: financed`).
  * **Use of Proceeds Audit (`case-6`):** Planned allocation vs. evidenced expenditures from fixtures:
    * Working Capital: ZMW 120,000 planned / ZMW 120,000 evidenced (`Current`).
    * Equipment Hire: ZMW 60,000 planned / ZMW 45,000 evidenced (`Exception: ZMW 15,000 unevidenced gap`).
  * **Covenant Health Monitor:**
    * Live evaluation of covenants from `destinations.json` and `cases.json`.
    * Contrast `case-6` (all covenants current) against `case-7` (Quarterly cash statement overdue since `2026-09-15` -> Overdue Exception Alert).
    * Click path: Alert → Issue → Covenant → Evidence drill-chain.
  * **Baseline vs. Current Environmental Matrix (`data/extension.json`):**
    * Demonstrates hero post-financing: Cultivated area (180 ha → 190 ha), field condition, rain-fed water source.
    * Displays who established each measurement (`fa.banda`), timestamp (`2027-03-10`), and GPS accuracy limitation (+/- 5 m).
* **Gate 5:** Automated test confirms Test X1 covenant calculations. Overdue exception traces seamlessly to missing covenant evidence; figures strictly match fixtures.

---

### Phase 6: Portfolio Intelligence & Static VVB Verification (Stages 13–16)
**Goal:** Deliver portfolio aggregation for donors/investors and substantiate post-financing green claims without inventing data or creating click-depth violations.

* **Screen Architecture (`src/views/portfolio/`):**
  * `PortfolioDashboardView.tsx`: Aggregates the 9 seed cases dynamically:
    * Total cooperatives: **9**
    * Financed count: **2** (`case-6` and `case-7`)
    * Total Portfolio Exposure: **ZMW 530,000** (Case 6: K180,000 + Case 7: K350,000)
    * Monitoring Distribution: **1 Current** (`case-6`), **1 Overdue** (`case-7`)
    * Invariant: Every number is computed; zero hardcoded figures.
  * **Click Path Compliance (Test T8b):**
    * **Two clicks to a project:** Click exposure/status number (1) → Land on filtered project list; Click project row (2) → Land on project requirement view.
    * **Three clicks to evidence:** From project requirement view, click requirement (3) → Evidence drawer opens.
  * `StaticVerificationView.tsx`: Read-only VVB assurance screen driven by `data/extension.json`:
    * Green claim: *Cultivated area increased from 180 ha to 190 ha during 2026/27 monitoring period.*
    * Evidence list: Field boundary GPS shapefiles, geo-tagged photos, calculation sheets.
    * VVB Finding: Verified within scope by `vvb.reviewer1` on `2027-03-24`.
    * Assurance Chain: `Claim → Evidence → Assessment → VVB Verification → Institutional Reliance (Lender A) → Green Bond / ESG Portfolio Reporting`.
    * Boundary Label: *"Same state, extended: illustrative. Not built."*
* **Gate 6:** Portfolio totals strictly sum to 530,000; T8b "two clicks to project, three to evidence" holds; static verification screen carries required non-interactive boundary labels.

---

### Phase 7: NABII Pipeline View & TA Operating System
**Goal:** Deliver the complete ecosystem management layer for NABII Zambia, transforming Symphony into an operational Technical Assistance (TA) solution computed strictly from the 9 cooperatives.

* **Screen Architecture (`src/views/nabii/`):**
  1. `PipelineConversionView.tsx`: The Pipeline Stage Conversion Tracker:
     * Computed dynamically from `data/cases.json`:
       * Enrolled / Baseline Capturing: 9
       * Active Gap Remediation: 7
       * Assessment Ready (NABII): 6
       * Assessment Ready (Lender A): 3
       * Presented to Lenders: 2
       * Financed & Active: 2
     * Click any stage count to filter the active cooperative list below it.
  2. `CohortOperatingView.tsx`: **Readiness Cohort Analysis (The 9 Cooperatives)**:
     * Progression breakdown across evidence categories derived from case states:
       * Registration: 8/9 Established
       * Governance: 4/9 Established
       * Financial Records: 3/9 Established
       * Project Definition: 9/9 Established
       * Environmental Baseline: 4/9 Established
     * **TA Workload & Intervention Tracker:**
       * Open Interventions: Standard (Minutes, Membership) vs Specialist (Financial Reconstruction, GPS boundary) vs Blocked.
  3. `CooperativeDirectoryView.tsx`:
     * Master grid of all 9 cooperatives filterable by Province, District, Readiness per destination, and Closed Gaps count.
     * Click row opens read-only SME view. Enforces `READ_ONLY_ROLE` for TA users on SME evidence.
* **Gate 7:** Pipeline tables and cohort statistics derive synchronously from the pure state engine and 9 seed cases without hardcoded external numbers.

---

### Phase 8: Tours, Reset & Automated Session Capture
**Goal:** Package the application for executive demonstration with a private, zero-network session capture system and deterministic reset.

* **Guided Tour Mode (`src/tours/`):**
  * `BankTour.tsx` (Lender Track): Presented case → Prominent boundary banner → Evidence admission table → Manual credit decision → Disbursement & Proceeds audit → Overdue covenant exception → Portfolio aggregation → Destination comparison.
  * `NABIITour.tsx` (Facilitator Track): Pipeline conversion view → Cohort category progress → Live governance gap closure → Destination projection → Environmental baseline → Hand-off to Lender A.
* **Deterministic Reset Engine:**
  * One-click **Reset Demo** button restoring data fixtures, clearing case events, and resetting the demo date.
  * **Hard Invariant (Test X5):** Reset must **never** erase the session capture log. Capture records live in a separate `localStorage` namespace (`symphony_capture_*`).
* **Session Capture System (`CAPTURE_SPEC.md`):**
  * `CaptureProvider`: Context provider wrapping the app, silently starting a session on first load with zero in-app typing.
  * **URL Query Tagging (Test X10):** Automatically labels meetings: `?audience=bank&label=bank-1` or `?audience=nabii&label=nabii-1`.
  * **26 Interaction Event Types (Test X6):** Automatically logs screen views, dwell times, tour steps, destination/role switches, blocked actions, readiness changes, traceability drawer opens, lender decisions, and idle pauses per `data/capture_event_schema.json`.
  * **Privacy & Local Storage (Test X4 & X7):** Strictly zero network calls (`fetch`/`xhr`), zero tracking of typed text or DOM strings. In-memory buffer persisted solely to local device storage.
  * **Keyboard Shortcut & Hidden Route (Test X8 & X9):**
    * `Ctrl + Shift + E`: Ends the active session, calculates final dwell time, and immediately triggers browser downloads of the session `JSON` and `CSV`.
    * `/capture` (or `Ctrl + Shift + N`): Presenter cockpit displaying live stats, question guides, notes editor, and manual exports.
  * **Structured Discovery Questionnaire (`data/capture_questions.json`):**
    * 8 NABII questions (N1–N8).
    * 10 Bank questions (B1–B10) — including B1 to uncover the actual baseline documentation.
    * 5 Common questions (C1–C5) — including the **C5 Commitment Ladder** (Level 1–6).
  * **Post-Session Notes Template (`data/session_notes_template.json`):**
    * Structured template to be completed by the presenter within 15 minutes post-demo.
* **Gate 8:** Both tours run cleanly; tests X4–X10 pass; reset restores cases while preserving capture logs; CSV export matches schema.

---

### Phase 9: Hardening, Bundle Sanitization & Vercel Production Deployment
**Goal:** Verify zero leakage of forbidden terms, build the static bundle, and deploy to Vercel.

* **Audit Checks:**
  * **Test X2:** Scan all source files (`src/`), JSON exports, and the production build (`dist/`) against `data/forbidden_terms.json`. Ensure zero occurrences of real bank names (e.g. Zanaco, Stanbic, Absa) in shipped code. (NABII is permitted).
  * **Test X3:** Validate that every rendered route displays its mandatory boundary label.
  * **Tests X4–X10:** Re-run the full capture test suite against the production build.
  * Bundle Verification: Ensure `tests/` and `tools/` are excluded from `dist/`.
* **Deployment Validation:**
  * Run `npm run build` -> Verify clean static output in `dist/`.
  * Deploy via Vercel CLI / Web Git Integration with Root Directory set to `Prototype`.
* **Gate 9:** All Vitest and Playwright test suites green; live Vercel URL verified from a clean browser cache.

---

## 5. Complete Verification & Test Harness Summary

| Test ID | Name | Target Layer | Verification Criteria |
| :---: | :--- | :--- | :--- |
| **Oracle** | Pre-Build Cross-Check | Python Tool | `python3 tools/reference_oracle.py` returns `OK` across all 27 cases. |
| **T1** | Baseline Destination Parity | Engine (Vitest) | `case-1` evaluated on A (unresolved A2, A6), B (unresolved B3-B5, B7), N (ready). |
| **T2** | Hero Gap Remediation | Engine & UI | 4-step remediation flips Lender A to ready; B and N remain stable; immutable history verified. |
| **T3** | Staleness Exception Propagation | Engine (Vitest) | `case-3` expired registration produces exception on A, B, and N; valid prior to demo date. |
| **T4** | Assessment-Time Optionality | Engine (Vitest) | Adding off-take evidence marks `provided_early = true` without mutating readiness. |
| **T5** | Segregation of Duties (RBAC) | Engine (Vitest) | Blocks self-verification (`T5b`), self-confirmation (`T5d`), missing signoff (`T5c`), wrong roles (`T5e`). |
| **T6** | Request Restructuring | Engine & UI | Restructuring request closes B7 fit check but breaks A11; proves fit is not an evidence gap. |
| **T7** | Heterogeneous Case Readiness | Engine (Vitest) | `case-9` ready for B and N, blocked on A. Proves readiness is contextual. |
| **T8a** | Engine Provenance Traceability | Engine (Vitest) | Every state resolves to evidence ID, verifier, timestamp, and mandatory limitation text. |
| **T8b** | Two-Click Project, Three-Click Evidence | UI (Playwright) | Two clicks to a project; three clicks to open the evidence drawer. |
| **D1** | Fixture Integrity | Engine (Vitest) | Validates foreign keys, covenant IDs, and no self-verified seed records. |
| **X1** | Covenant Monitoring Window | Engine (Vitest) | Evaluates 14-day due window against demo date; `case-6` current, `case-7` overdue. |
| **X2** | Sanctions / Forbidden Terms | Build Scanner | Scans `dist/` and `src/` against `data/forbidden_terms.json`; zero unallowed matches. |
| **X3** | Boundary Label Compliance | UI (Playwright) | Every screen carries `"Beachhead"`, `"Same state, extended"`, or `"illustrative"`. |
| **X4** | Zero Outbound Network Calls | Capture Suite | Asserts `fetch`, `xhr`, `sendBeacon` are never called during capture. |
| **X5** | Demo Reset Isolation | Capture Suite | Asserts reset wipes case mutations but strictly preserves session capture logs. |
| **X6** | Event Schema Conformance | Capture Suite | All 26 event types serialize valid payloads per `capture_event_schema.json`. |
| **X7** | Privacy & PII Sanity | Capture Suite | Asserts typed text or DOM form inputs are never logged. |
| **X8** | CSV Serialization Integrity | Capture Suite | Asserts CSV export contains exact 10 headers and valid row escapes. |
| **X9** | Keyboard Shortcut Trigger | Capture Suite | `Ctrl + Shift + E` successfully dispatches download of JSON and CSV files. |
| **X10** | URL Parameter Ingestion | Capture Suite | `?audience=...&label=...` properly populates session metadata. |
| **Reset** | Deterministic Reset Test | UI (Playwright) | Triggering UI reset restores `case-1` to baseline, clearing events and presentations. |

---

## 6. Execution Directives

1. **Stop-and-Report Protocol:** Upon completion of each phase, the system runs the phase gate tests, generates a concise gate report (features built, test results, deviations, decisions), and **pauses for review** before initiating the subsequent phase.
2. **Prominent Boundary Presence:** Ensure the signature statement is displayed visibly across the hand-off from **Assessment Readiness $\rightarrow$ Lender A Assessment**.
3. **Offline Typography Resiliency:** Ensure all styling relies on Vanilla CSS tokens and system fallbacks (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) to safeguard against offline bank conference room environments.
4. **Scope Lock:** Do not add further architecture, screens, or database concepts beyond the defined 9 build phases.
