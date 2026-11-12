# Symphony Interactive Prototype — Implementation Plan V3

**Document ID:** `SYMPHONY-IMPL-PLAN-V3`
**Governing Kit:** `symphony-build-kit-v2/`
**Governing Files:** `CLAUDE.md`, `FUNCTIONAL_SPEC_UPDATE_V1.md`, `UI_HELP_SPEC_V1.md`, `CAPTURE_SPEC.md`
**Deployment Target:** Static SPA → Vercel, root directory `Prototype/`
**Stakeholder Lenses:** NABII Zambia (TA Operating System) · Commercial PFIs / Lenders (Evidence-Based Credit Assessment)

---

## 1. What the Prototype Must Prove

One real cooperative can move from _economically real but poorly evidenced_ to _assessable by a lender_, and the same governed state carries forward into decisioning, monitoring, and portfolio views. The point is the **infrastructure**: governed state, evidence, and traceability. It is not an SME onboarding form.

The prototype makes visible — through use, not explanation:

1. Readiness is **computed** from state plus a destination's requirements. It is never typed in.
2. The same state projected to different destinations gives different results.
3. Every state shows its basis: evidence, who, when, limitation, history.
4. Nobody verifies their own evidence.
5. The lender decides. Symphony never does.

---

## 2. Hard Invariants

From `data/meta.json`. Violating any is a bug, not a trade-off.

| ID | Rule |
|---|---|
| **I1** | No self-verification |
| **I2** | Supersede, never overwrite — every change appends to history |
| **I3** | Every state shows its basis and a limitation |
| **I4** | Readiness is computed |
| **I5** | Symphony records outcomes and findings made by others. It never makes them |
| **I6** | No Arrangement object. Financing is represented only by `financing`, `presentation`, and outcome records |
| **I7** | Every screen carries a boundary label from `meta.boundary_labels` |

**Additional hard rules:**

- No real lender names anywhere. Use "Lender A", "Lender B", "NABII Programme Pipeline". NABII is the only real organisation name permitted. Test X2 enforces this.
- All names, figures, and products are fictional. Show "Illustrative products." on the requirements screen.
- Do not invent requirements, thresholds, or seed values. The data files are the source of truth.
- No cooperative-facing fees or pricing on any screen.
- **Capture isolation:** capture code never changes engine state, never records typed text, and never makes network calls.

---

## 3. Persona Journeys

```
SME         Establish → Assess → Remediate → Become Ready → Present
            (secretary, treasurer, chairman, member, field_agent)

LENDER      Receive → Inspect → Examine evidence → Dispute / request → Assign verification
            → Record reliance → Record own outcome
            (pfi_analyst, pfi_credit)

VERIFIER    Log in → Queue → Open assignment → Review evidence → Record finding
            (verifier)

NABII       Pipeline → Cohort → Interventions → Track readiness → Observe conversion
            (ta scoped to cohort; fund_manager sees all)

CAPTURE     Invisible — records behaviour only; presenter exports after the session
```

---

## 4. Screen Inventory

| Screen ID | View | Phase | Boundary Label |
|---|---|---|---|
| `login` | Persona and case selection (all roles incl. verifiers and NABII) | 3 | Beachhead |
| `enrollment` | Create organisation, officers, project, self-assessment | 3 | Beachhead |
| `sme_dashboard` | KPIs, alerts incl. "Evidence disputed (n)" | 3 | Beachhead |
| `org_state`, `project_state` | Governed metric cards | 3 | Beachhead |
| `requirements` | Destination checklist, "Illustrative products." | 3 | Beachhead |
| `gap_remediation` | T2 workflow, restructure, early off-take | 3 | Beachhead |
| `readiness_basis` | Full "Why?" with limitation chain | 3 | Beachhead |
| `destination_projection` | Destination switch, present | 3 | Beachhead |
| `present_modal` | Present to a destination, export | 3 | Beachhead |
| `lender_assessment` | Presented case, admission, disputes, assignments, reliance, outcome, export | 4 | Same state, extended |
| `facility_monitoring` | Facility, proceeds, covenants, baseline vs current | 5 | Same state, extended |
| `portfolio` | Computed portfolio | 6 | Same state, extended |
| `claim_view` | Claim, baseline, current, evidence, finding, reliance, assurance chain | 6 | Same state, extended: illustrative data |
| `verifier_queue` | Verifier's assigned work list | 6 | Same state, extended: illustrative data |
| `verifier_workbench` | Target, evidence, finding form | 6 | Same state, extended: illustrative data |
| `nabii_pipeline` | Computed funnel, intervention queue | 7 | Same state, extended |
| `nabii_cohort` | Cohort baseline vs current, interventions | 7 | Same state, extended |
| `nabii_directory` | Filterable cooperative list | 7 | Same state, extended |
| `tour_launcher` | Choose a tour | 8 | Beachhead |
| `/capture` (hidden, never logged) | Session list, exports, clear | 8 | none |

---

## 5. Architecture

### 5.1 Engine Modules (`src/engine/` — pure TypeScript, no React, injected clock)

| Module | Responsibility |
|---|---|
| `types.ts` | All types: cases, requirements, rules, evidence, disputes, assignments, findings, reliance, covenants, events, actors |
| `evaluate.ts` | Destination requirement evaluation; dispute-derived effective state; readiness summary |
| `actions.ts` | All actions: `(caseState, action, actor) → { ok, caseState, event } | { ok: false, code, rule }` |
| `covenants.ts` | Pure covenant monitoring against `meta.demo_date` |
| `pipeline.ts` | `funnel`, `cohortSummary`, `interventionQueue`, `gapsClosed` |
| `dossier.ts` | `buildDossier`, `dossierToCsv` |
| `scope.ts` | `visibleCases` (TA cohort enforcement, `ACCESS_DENIED_COHORT`) |

**Action constraint order:** role → scope → entity → segregation. Never mutate input.

### 5.2 Components (`src/components/`)

**Core:** `BoundaryLabel`, `GovernedMetricCard`, `RequirementCard`, `RequirementChain`, `EvidenceDrawer`, `TraceabilityTrigger`, `StateTransitionCard`, `DestinationSwitcher`, `RoleSwitcher`, `EventLogDrawer`

**Disputes & verification:** `DisputePanel`, `DisputeBanner`, `AssignmentCard`, `FindingForm`, `AssuranceChain`, `RelianceControl`

**Export:** `ExportMenu`

**Help (`components/help/`):** `HelpProvider`, `HelpTip`, `HelpPopover`, `HelpHint`, `VisibleStatement`, `TourBubble`, `StateLegend`

**Capture:** `CaptureProvider` (context and hooks only, no UI; never changes engine state)

### 5.3 Data Files

| File | Used by |
|---|---|
| `cases.json`, `destinations.json`, `roles.json`, `meta.json` | Engine, all views |
| `extension.json` | `facility_monitoring` baseline vs current; `claim_view` baseline and current |
| `verification_seed.json` | Verifier users, claims, `asg-1` (case-8 income records), `asg-2` (claim-1), `suggested_demo_finding` |
| `interventions.json` | Intervention queue in `nabii_pipeline` and `nabii_cohort`; class tooltips |
| `help.json` | All help bubbles and required visible statements |
| `tours.json` | Both tours (13 bank steps, 10 NABII steps) |
| `capture_event_schema.json` | Capture validation (test X4); 28 event types, 20 screens |
| `forbidden_terms.json` | Test X2 only. Never imported by the app |
| `expected-results.json` | Tests only (27 baseline results) |
| `expected-pipeline.json` | Tests only (funnel + cohort + intervention baseline) |
| `capture_questions.json` | Presenter use only. **Not bundled** |
| `session_notes_template.json` | Presenter use only. **Not bundled** |

---

## 6. Phase-by-Phase Implementation Blueprint

All phases run in order. Each phase ends with a gate test run and a short report (features built, test results, deviations, open questions). **Stop and wait for review before starting the next phase.**

---

### Phase 0: Tooling & Environment Setup

**Goal:** Verify the build kit, validate all data, pin the environment, and establish baseline scripts before any feature code is written.

**Steps:**

1. **Pre-build checks (must both print OK):**
   - `python3 tools/reference_oracle.py`
   - `python3 tools/validate_help.py`

2. **Environment:**
   - Node 22, installed inside WSL (not the Windows install). Pin `engines.node` to `"22.x"` in `package.json`.
   - Stack: TypeScript, React, Vite. Vitest for engine tests. Playwright for UI tests.

3. **Tooling configuration:**
   - `tsconfig.json`: `resolveJsonModule: true`, `noEmit: true`. Build script: `tsc --noEmit && vite build`.
   - `vite.config.ts`: static output, no server-side code.
   - `vitest.config.ts`: `include: ["tests/**/*.test.ts"]` only — never picks up Playwright `*.spec.ts` files.
   - `playwright.config.ts`: `webServer` pointing at `vite preview`. Install Chromium with system dependencies.

4. **Package scripts:**
   - `npm run dev` — Vite dev server
   - `npm run build` — `tsc --noEmit && vite build`
   - `npm run test` — Vitest (engine only)
   - `npm run test:e2e` — Playwright
   - `npm run verify:oracle` — `python3 tools/reference_oracle.py`
   - `npm run verify:help` — `python3 tools/validate_help.py`

5. **Typography:** system-font fallback only: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. No external font imports.

6. **Start `DECISIONS.md`** — log every open judgement call made from this point onward.

7. **Start `README.md`** — skeleton covering run, test, reset, and redeploy.

**Gate 0:** Both `reference_oracle.py` and `validate_help.py` print OK. Dev server starts. `DECISIONS.md` and `README.md` exist.

---

### Phase 1: Pure State Engine, Fixture Loading & Full Test Matrix

**Goal:** Build the deterministic TypeScript engine in `src/engine/` that reproduces all 27 baseline results, all dispute, verification, pipeline, scope, and export logic — with zero browser dependencies.

#### Engine Modules

**`types.ts`**
- Comprehensive typing from `data/meta.json`, `data/roles.json`, `data/destinations.json`, `data/cases.json`.
- `disputes[]` per case: `{ id, evidence_type, raised_by, raised_role, raised_on, reason_code, note, status, resolution }`. The `item.disputed` boolean is removed.
- `verification: { assignments, findings, reliance }` per case loaded from `verification_seed.json`.
- Evidence effective state derived: disputed when an `open` dispute exists for its `evidence_type`; overlay precedence: `disputed` → `stale` → level.
- Verification states: `not_requested`, `pending`, `verified`, `partially_verified`, `not_verified`, `unable_to_determine`.

**`evaluate.ts`**
- Rule kinds: `evidence`, `evidence_count`, `assessment_time`, `fit`.
- Effective state derives `disputed` from `case.disputes[]` (not a boolean).
- Every result carries: `id`, `title`, `state`, `evidence_ref`, `effective_level`, `min_level`, `provided_early`, `reason`.
- Readiness: `ready = (no unresolved) && (no exception)`.
- 27 baseline results unchanged by dispute/verification additions.

**`actions.ts`**
All actions take `(caseState, action, actor)`, return `{ ok: true, caseState, event } | { ok: false, code, rule }`. Never mutate input. Constraint order: **role → scope → entity → segregation.**

| Action | Roles | Key Constraints |
|---|---|---|
| `add_evidence` | `secretary`, `treasurer`, `chairman`, `member`, `field_agent` | `ROLE_NOT_PERMITTED`, `READ_ONLY_ROLE` |
| `verify_evidence` | `field_agent` | `SELF_VERIFICATION`, `SIGNOFF_REQUIRED` |
| `raise_dispute` | `pfi_analyst`, `pfi_credit`, `verifier`, `ta`, `field_agent` | `DISPUTE_REASON_REQUIRED`, `NO_SUCH_EVIDENCE`, `DISPUTE_ALREADY_OPEN`, `SELF_DISPUTE` |
| `resolve_dispute` | `field_agent` | `SELF_VERIFICATION`, `SAME_VERIFIER`, `NO_OPEN_DISPUTE` |
| `withdraw_dispute` | Any role that can raise | `NOT_DISPUTE_RAISER`, `NO_OPEN_DISPUTE` |
| `assign_verification` | `pfi_credit`, `pfi_analyst`, `ta` | `NO_SUCH_TARGET`, `NO_SUCH_VERIFIER` |
| `record_verification_finding` | `verifier` | `NOT_ASSIGNEE`, `ASSIGNMENT_COMPLETED`, `FINDING_FIELDS_REQUIRED`, `SELF_VERIFICATION` |
| `record_reliance` | `pfi_credit` | `NO_FINDING`, `RELIANCE_ALREADY_RECORDED` |
| `request_more_evidence` | `pfi_analyst`, `pfi_credit` | `READ_ONLY_ROLE` guard on SME evidence |
| `record_outcome` | `pfi_credit` | Must be an explicit choice; never pre-selected |
| `export_dossier` | `pfi_credit`, `pfi_analyst`, `secretary`, `treasurer`, `chairman` | — |
| `present` | `secretary`, `treasurer`, `chairman` | Creates frozen snapshot |
| `restructure_request` | `secretary`, `treasurer`, `chairman` | Closes fit check, proves fit ≠ evidence gap |

Rules:
- SME roles (`secretary`, `treasurer`, `chairman`, `member`) cannot raise, resolve, or withdraw disputes.
- `resolve_dispute` pushes prior evidence to `history` (invariant I2) and appends an event.
- Changing an evidence item pushes the previous record to `history` before replacing it.
- Every successful action appends: `{ id, at, actor, action, target, before, after }`.
- Presented snapshots are frozen. Disputes raised after presentation appear in the live record and in a "Raised after presentation" banner on the lender workspace.

**`covenants.ts`**
- Pure function. Demo date from `meta.demo_date` (injected, never `new Date()`).
- Per covenant: `overdue` if due before demo date and not received; `due` if within `monitoring_due_window_days`; else `current`. Case state = worst covenant.

**`pipeline.ts`**

`funnel(cases, evaluateFn)` — Stage conditions per `FUNCTIONAL_SPEC_UPDATE_V1.md` section 6.1:

| Stage | Condition | Baseline |
|---|---|---|
| Enrolled | any case | 9 |
| Ready (programme) | readiness for N is true | 7 |
| Ready for a lender | readiness for A or B is true | 5 |
| Presented | `presentation != null` or `financing != null` | 3 |
| Lender response recorded | `presentation.lender_response` exists or `financing != null` | 3 |
| Financed | `financing.status == "financed"` | 2 |

`cohortSummary(cases, baselineSnapshot, evaluateFn)` — per cohort: cases, programme-ready count, per NABII requirement group (`legal`, `governance`, `membership`, `project`, `environment`, `inclusion`) count of satisfied cases, baseline vs current, gaps closed.

`interventionQueue(cases, destination, interventionsConfig, evaluateFn)` — classifies every open requirement:
- `exception` state → class `blocked`
- `fit` rule → class `restructure`
- Otherwise → look up `evidence_type` in `interventions.json`

`gapsClosed(baseline, current)` — requirements that were `unresolved` or `exception` in baseline and are `satisfied` now, per destination.

**`dossier.ts`**
- `buildDossier(caseState, destination, source)` → JSON object: `export_version: 1`, `illustrative: true`, `boundary_statement`, `destination`, `generated_from`, `case`, `project`, `readiness`, `requirements[]`, `disputes[]`, `findings[]`, `reliance[]`, `limitations_summary`, `note: "Export of the readiness record. Not mapped to any institution's system."`
- `dossierToCsv(dossier)` → 13-column CSV: `requirement_id, title, state, applicability_reason, evidence_type, evidence_level, supplied_by, supplied_on, verified_by, verified_on, limitation, dispute_status, finding_result`
- Never include `notes` or `demo_role`. No real lender names.

**`scope.ts`**
- `visibleCases(cases, actor)` — TA users see only cases whose `programme` is in their `cohorts`. Direct access to another cohort's case returns `ACCESS_DENIED_COHORT`. `fund_manager` sees all.

**Data Loader**
- Adds `disputes: []` to every case in memory at load time.
- Merges seeded assignments from `verification_seed.json` into `verification.assignments`.
- Keeps a **read-only baseline snapshot** (`Object.freeze`) of the loaded fixtures for cohort comparison.
- Persists mutable state to `localStorage` under key `symphony.demo.v1`. Reset restores fixtures. **Reset never touches `symphony.capture.v1`.**

#### Phase 1 Test Suite (`tests/engine.test.ts`)

All 33 new tests run at Gate 1 alongside the original matrix.

**Original tests:** T1, T2, T3, T4, T5a–e, T6, T7, T8a, D1, X1, and the 27-result regression loop over `expected-results.json`.

**New dispute tests (P1–P5):**
- **P1:** `case-8` baseline. `pfi_credit` raises dispute on `income_records`. Lender A: `ready=false`, `exceptions=[A7]`. N and B unchanged.
- **P2:** Continue P1. `fa.mulenga` resolves. Dispute `resolved`, evidence re-verified. Lender A: `ready=true`.
- **P3:** `case-6`. `pfi_credit` raises on `registration`. `fa.banda` (original verifier) tries resolve → `SAME_VERIFIER`. `fa.mulenga` resolves → accepted.
- **P4:** Constraint battery: empty note → `DISPUTE_REASON_REQUIRED`; non-existent type → `NO_SUCH_EVIDENCE`; second open dispute → `DISPUTE_ALREADY_OPEN`; supplier raising own → `SELF_DISPUTE`; `secretary` raising → `ROLE_NOT_PERMITTED`; `treasurer` resolving → `ROLE_NOT_PERMITTED`; non-raiser withdrawing → `NOT_DISPUTE_RAISER`.
- **P5:** `case-8` presented snapshot exists. Raise dispute afterwards. Snapshot unchanged; live state shows dispute; banner reads "Raised after presentation".

**Verification tests (V1–V4):**
- **V1:** Seeded `asg-1`. `vrf.mulenga` records finding `not_verified`. Assignment completed. Evidence level unchanged.
- **V2:** Constraint battery: wrong assignee → `NOT_ASSIGNEE`; second finding → `ASSIGNMENT_COMPLETED`; empty limitation → `FINDING_FIELDS_REQUIRED`; verifier who supplied evidence → `SELF_VERIFICATION`.
- **V3:** After V1, `pfi_credit` records reliance → accepted. Same user again → `RELIANCE_ALREADY_RECORDED`. `secretary` → `ROLE_NOT_PERMITTED`. Reliance before any finding → `NO_FINDING`.
- **V4:** `assign_verification` by `ta` to `vrf.sakala` for claim → accepted. By `secretary` → `ROLE_NOT_PERMITTED`. To non-verifier → `NO_SUCH_VERIFIER`. To missing target → `NO_SUCH_TARGET`.

**Pipeline tests (F1–F4):**
- **F1:** Baseline funnel equals `expected-pipeline.json` `funnel` (9, 7, 5, 3, 3, 2) with correct case lists.
- **F2:** Baseline cohort summary equals `expected-pipeline.json` `cohorts`. Baseline equals current.
- **F3:** Intervention queue for N, A, B at baseline. Class counts equal `expected-pipeline.json` `open_interventions_by_destination`. `case-3` registration is `blocked`. Fit items are `restructure`.
- **F4:** Apply T2 sequence on `case-1`. Gaps closed for A = 2 (A2, A6). Funnel "Ready for a lender" = 6. Other stages unchanged.

**Scope tests (R1–R2):**
- **R1:** `ta.officer1` requests cases → receives cases 1–5 only. `case-8` → `ACCESS_DENIED_COHORT`. Evidence mutation → `READ_ONLY_ROLE`.
- **R2:** `fm.officer1` requests cases → all nine. `raise_dispute` → `ROLE_NOT_PERMITTED`.

**Export tests (E1–E2):**
- **E1:** CSV for `case-1`, destination A. Exactly 13 columns. Row count equals A's requirement count (11). No `notes` or `demo_role`.
- **E2:** JSON for `case-8` with open dispute and finding. Contains `illustrative: true`, boundary statement, dispute, finding. No real lender name.

**Gate 1:** All 27 baseline results pass unchanged. All P1–P5, V1–V4, F1–F4, R1–R2, E1–E2 pass. Oracle and help validator OK. Zero edits to any fixture or expected value.

---

### Phase 2: Design System, Help System & Shared Primitives

**Goal:** Build all shared components, the full help system, the capture provider skeleton, and the vanilla CSS design system before any screen-level work.

**Design System (`src/styles/`):**
- CSS custom properties for colour tokens, spacing scale, typography scale, border radii, shadow levels.
- Light and dark themes via `prefers-color-scheme` and a `[data-theme]` toggle.
- Evidence tier utilities: colour + text tokens for `Asserted`, `Supported`, `Verified`, `Disputed`, `Stale`.
- Readiness language tokens: "Assessment Ready" / "Not yet ready". Never "approved", "bankable", "creditworthy", "score".

**Core Components:**
- `BoundaryLabel`: labels from `meta.boundary_labels` with tooltip from `boundary.*` help entries. Never hard-coded strings.
- `GovernedMetricCard`: state card with one-line limitation visible without interaction (invariant I3 + H11).
- `RequirementCard`, `RequirementChain`, `EvidenceDrawer`, `TraceabilityTrigger`, `StateTransitionCard`, `DestinationSwitcher`, `RoleSwitcher`, `EventLogDrawer`.
- `StateLegend`: touch-accessible chip explaining all state meanings. State badges never carry popovers — their meaning is in the legend and tooltips.

**Dispute & Verification Components:**
- `DisputePanel`: raise form (reason select + note field), open dispute detail, dispute history for that evidence.
- `DisputeBanner`: "Disputed by `<role>` on `<date>`: `<reason>`" on requirement cards in exception state.
- `AssignmentCard`: shows assignment target, scope, assignee, status.
- `FindingForm`: result select (with helper text per result), scope, limitation. Never pre-selected.
- `AssuranceChain`: `Claim → Evidence → Verification finding → Lender reliance → Portfolio reporting`. Each node shows computed state or "Not yet recorded".
- `RelianceControl`: lender-only; records "relied" or "not relied". Label must never use "approved".
- `ExportMenu`: JSON, CSV, and print-view options. Shows "Export of the readiness record. Not mapped to any institution's system." Each export emits a `dossier_export` capture event.

**Help System (`src/components/help/`):**
- `HelpProvider`: context; resolves help ids from `help.json`; enforces one open bubble at a time; throws on missing ids in development.
- `HelpTip`: tooltip — 300 ms open delay, 100 ms close delay. Opens on hover/focus on desktop; as a popover on touch.
- `HelpPopover`: popover — 320 px wide; opens on tap, Enter, or Space; `aria-expanded` true when open; Escape closes; "See more" link is next tab stop; focus never trapped.
- `HelpHint`: helper text shown on focus or selection (dispute reasons, finding results, admission options).
- `VisibleStatement`: renders `required_visible_text` entries from `help.json`. Text must be visible without any interaction, not `aria-hidden`, not clipped. Not inside a closed popover.
- `TourBubble`: driven entirely by `tours.json`. Does not emit `help_open`.

**Attribute conventions on every interactive element:**
- `data-testid="<unique-id>"` — for Playwright.
- `data-help-id="<id>"` — for help system. All ids must exist in `help.json`.
- `data-required-text="<id>"` — where visible statements are required.
- Allow-list `CAPTURE_TESTIDS` — elements included in `ui_click` capture events.

**`CaptureProvider`** (skeleton only in Phase 2 — fully wired in Phase 8):
- Context and hooks. No UI whatsoever.
- Never changes engine state.

**Component Demo Route** (`/dev-components`): exercises every state — asserted, supported, verified, disputed, stale — and every help pattern. **Excluded from production bundle.**

**Gate 2:** H1 (oracle validates `help.json`), H2 (all `data-help-id` ids exist in `help.json`), H3 (keyboard: focus opens tooltip / Enter opens popover / Escape closes), H4 (touch emulation: tap opens popover on tooltip-only elements), H8 (click 1 opens "How was this established?" / click 2 opens evidence drawer), T8b (two clicks to state badge to evidence drawer). One component renders for each state in the vocabulary.

---

### Phase 3: SME Hero Path (Stages 1–9, Label: Beachhead)

**Goal:** Deliver the complete cooperative journey from enrollment to presenting a case to a destination.

**Screens:**

1. **`login`** — Email/phone + PIN (not validated) + demo role selector. SME roles let user pick a cooperative. Verifier personas selectable. NABII personas selectable.
2. **`enrollment`** — Create organisation, assign officers (Asserted until accepted), create project, short self-assessment seeding Asserted cards. Visible on screen: *"No bank. No programme. No loan required."*
3. **`sme_dashboard`** — KPIs: readiness per destination, requirements by evidence tier (stacked bar), open gaps, days to next expiry. Alert panel includes **"Evidence disputed (n)"** — clicking opens an Issue page: what is disputed, who raised it, what is needed (independent field re-verification), owner role field agent.
4. **`org_state`, `project_state`** — Governed metric cards per section (Legal, Governance, Membership, Finance; Activity, Assets, Production, Environmental). One-line limitation visible on each card without interaction.
5. **`requirements`** — Destination checklist. Footer: "Illustrative products."
6. **`gap_remediation`** — State Transition card. T2 hero journey executable end-to-end through the UI, readiness badge recomputed live. Includes restructure request (T6) and early off-take evidence (T4).
7. **`readiness_basis`** — Full "Why?" ending with: *"Assessment Ready does not constitute financing approval."*
8. **`destination_projection`** — Switch destinations on unchanged state. Visible line: *"Same enterprise. Same project. Different requirement context."*
9. **`present_modal`** — Creates frozen destination-scoped snapshot. Export dossier as JSON or CSV.

**Help placement per `UI_HELP_SPEC_V1.md`:**
- `sme_dashboard`: `readiness.*`, `evidence.*`, `destination.*`, `boundary.beachhead`
- `org_state`, `project_state`: `evidence.*`
- `requirements`: `evidence.*`, `requirement.*`, `destination.*`
- `gap_remediation`: `state_transition.*`, `action.*`
- `readiness_basis`, `destination_projection`, `present_modal`: `readiness.*`, `destination.*`, `boundary.beachhead`

**Replace** all static explanatory paragraphs that duplicate help entries with `VisibleStatement` or `HelpTip`/`HelpPopover` components. Help text lives only in `help.json`.

**Gate 3:** T1, T2, T4, T5, T6, T7 all reproduced through the DOM via Playwright. H5 (required visible statements present without interaction), H11 (one-line limitation visible on every requirement card). Reset restores `case-1` to exact baseline.

---

### Phase 4: Lender Assessment Workspace & Decisioning (Stage 10, Label: Same state, extended)

**Goal:** Deliver the commercial credit officer experience without displaying real bank names.

**`lender_assessment` screen:**

- **`VisibleStatement id="boundary.sentence"`**: replaces the static `InstitutionalBoundaryBanner`. Stays permanently visible.
- Received case: organisation, project, requirements, evidence, findings, limitations, history — all from the presented snapshot.
- **Evidence Admission Table:** maps each requirement to its evidence item, verification status, and mandatory limitation. One-line limitation visible on card (H11).
- **Lender actions:**
  - Accept or reject evidence (PFI analyst/credit)
  - Request more evidence (creates request visible to SME; demo on `case-8`)
  - Raise a dispute against an evidence item
  - Assign verification to a named verifier
  - Record reliance on a finding (pfi_credit only)
  - Add internal credit finding
  - Record outcome: explicit manual choice `[Approved | Declined | Deferred | More Evidence Requested]`. Never pre-selected. Never automated.
- **Post-presentation dispute banner:** "Raised after presentation" when disputes exist after snapshot.
- **Seeded assignments:** `asg-1` (case-8 income records) and `asg-2` (claim-1) visible in the workspace.
- **Remove** the "Before Symphony / After Symphony" time-saving panel. Bank question B1 establishes the real baseline.
- **Disabled buttons** show the constraint rule as a tooltip. Triggering a rejected action shows blocked-action message inline: `"Blocked (CODE): <rule text>"` (H5b).

**Help placement:** `evidence.*`, `requirement.*`, `dispute.*`, `finding.*`, `reliance.help`, `boundary.extended`, visible `reliance.caption` adjacent to the reliance control.

**Gate 4:** Outcome cannot be submitted without explicit manual selection. SME view updates with lender requests. No automated underwriting path. H5 (visible statements present), H5b (blocked-action messages inline). Zero forbidden terms (X2).

---

### Phase 5: Post-Disbursement Monitoring & Continuity (Stages 11–12, Label: Same state, extended)

**Goal:** Prove that pre-financing evidence becomes the baseline for post-financing facility monitoring and green-finance compliance.

**`facility_monitoring` screen:**

- **Facility summary (`case-6`):** ZMW 180,000, 24 months, Lender A. (`case-7`: ZMW 350,000 for contrast.)
- **Use of proceeds (`case-6`):**
  - Seed and fertiliser: ZMW 120,000 planned / ZMW 120,000 evidenced.
  - Equipment hire: ZMW 60,000 planned / ZMW 45,000 evidenced.
  - Displayed as a **computed difference** (ZMW 15,000), not as a requirement "exception".
- **Covenant health monitor:**
  - `case-6`: all covenants current.
  - `case-7`: quarterly cash statement overdue since 2026-09-15. Alert → Issue → Covenant → Evidence drill chain.
- **Baseline vs current (`data/extension.json`):**
  - Cultivated area: 180 ha → 190 ha; field condition; rain-fed water source.
  - Establisher: `fa.banda`, timestamp: 2027-03-10, GPS accuracy: ±5 m.
  - Extension facility figure (ZMW 300,000) **is never added to portfolio totals**.

**Help placement:** `monitoring.*`, `covenant.*`, `boundary.extended`.

**Gate 5:** Test X1 passes in UI. Overdue exception traces to its evidence. All figures match fixtures. Extension figure absent from any aggregate.

---

### Phase 6: Portfolio Intelligence & Interactive Verification (Stages 13–16, Label: Same state, extended)

**Goal:** Deliver computed portfolio aggregation and fully interactive verification workspace.

**`portfolio` screen:**
- Computed from `cases.json` (9 cooperatives):
  - Total cooperatives: 9
  - Financed: 2 (cases 6 and 7)
  - Total exposure: ZMW 530,000
  - Monitoring: 1 current, 1 overdue
  - Ready counts per destination
- Every number is clickable. Click path (T8b):
  - Click number (1) → filtered project list
  - Click project row (2) → project requirement view
  - Click requirement (3) → evidence drawer

**`claim_view` screen:**
- Claims from `verification_seed.json` (replaces static `extension.json` content).
- Baseline + current values, evidence list, limitation.
- Assurance chain: **Claim → Evidence → Verification finding → Lender reliance → Portfolio reporting**. Each node shows computed state or "Not yet recorded".

**`verifier_queue` screen:**
- Verifier persona selector: `vrf.mulenga` (institution staff) and `vrf.sakala` (independent) with profile card (name, organisation, kind, scope).
- Queue lists assignments with case, target, scope, status.

**`verifier_workbench` screen:**
- Target (claim or evidence), baseline and current values, evidence list, limitations, existing disputes.
- `FindingForm`: result (`verified | partially_verified | not_verified | unable_to_determine`), scope, limitation. All required, non-empty. Never pre-selected.
- Recording a finding completes the assignment. **It never changes an evidence item** (invariant I5).
- Verifiers may also raise a dispute separately if they wish to challenge evidence.

**Boundary label for claim, queue, workbench:** `extended_demonstrated` = "Same state, extended: illustrative data".

**Help placement:** `finding.result.*`, `verification.*`, `reliance.help`, `boundary.extended_demonstrated`, visible `reliance.caption`.

**Demo paths:**
- **(a)** As `pfi_credit`, view `asg-1` (case-8 income records). Switch to `vrf.mulenga`, open queue, record finding. Return as lender, record reliance. Observe evidence level unchanged.
- **(b)** `asg-2` claim path using claim-1.

**Gate 6:** Every portfolio total equals the engine computation. No portfolio number is hardcoded. T8b holds. V1–V3 pass in UI. U1 (all DOM paths succeed; disabled buttons show rule tooltip; two-click rule holds from disputed requirement to evidence). H5 for verifier screens.

---

### Phase 7: NABII Pipeline, Cohort & TA Operating System (Label: Same state, extended)

**Goal:** Deliver the complete ecosystem management layer computed strictly from the 9 seed cases and `interventions.json`.

**`nabii_pipeline` screen:**
- **Funnel** (computed from engine via `pipeline.ts`):

  | Stage | Baseline |
  |---|---|
  | Enrolled | 9 |
  | Ready (programme) | 7 |
  | Ready for a lender | 5 |
  | Presented | 3 |
  | Lender response recorded | 3 |
  | Financed | 2 |

  Clicking a stage lists its cooperatives, each linking to its read-only case view.

- **Intervention queue** per destination, classified by `interventions.json`:
  - Counts at top by class (`standard`, `specialist`, `restructure`, `blocked`).
  - `case-3` registration → class `blocked`.
  - Fit items → class `restructure`.
  - Each row: case, requirement, class, owner role, action text, link.
  - Baseline counts per destination match `expected-pipeline.json`.

**`nabii_cohort` screen:**
- Per programme cohort, per NABII requirement group: count satisfied, baseline vs current, gaps closed.
- Cohort 1 baseline: 5 cases, 3 programme-ready; satisfied per group: Legal 4, Governance 4, Membership 4, Project 5, Environment 4, Inclusion 4.
- Cohort 2 baseline: 4 cases, 4 programme-ready; satisfied per group: all 4.

**`nabii_directory` screen:**
- Filterable and sortable by province, district, programme, readiness per destination, gaps closed.
- Clicking a row opens the same read-only SME view.

**Scoped roles:**
- `ta.officer1` scoped to Cohort 1 only. Navigating to another cohort's case shows "Outside your cohort" and `ACCESS_DENIED_COHORT`. Engine enforces this, not only the UI.
- `fm.officer1` sees all cohorts, all cases, read-only.
- Both roles are `READ_ONLY_ROLE` on evidence. `ta` may `assign_verification` and `raise_dispute`. `fund_manager` may do neither.

**No figure on any of these screens may be typed in.** All numbers are produced by engine functions.

**Help placement:** `funnel.*`, `intervention.*`, `cohort.*`, `cohort.gaps_closed`, `destination.N`.

**Gate 7:** F1–F4, R1, R2, U2 (mutating a fixture changes numbers) all pass. No hardcoded number on pipeline, cohort, directory, or intervention screens.

---

### Phase 8: Tours, Automatic Session Capture & Reset

**Goal:** Package the application for executive demonstration with a fully automatic, zero-network session capture system and deterministic reset.

#### 8.1 Guided Tour Mode

Both tours driven entirely by **`tours.json`** — 13 bank steps, 10 NABII steps.

**Bank tour (13 steps):**
Presented case → Prominent boundary statement → Evidence admission table → Raise dispute on `case-8` `income_records` → Lender A turns not ready (exception) → Switch to `fa.mulenga` → Resolve dispute → Lender A returns ready → Assign verification of same evidence → Switch to `vrf.mulenga` → Open queue → Record finding → Return as lender, record reliance → Export readiness record as CSV → Manual credit decision → Disbursement & Proceeds audit → Overdue covenant exception → Portfolio aggregation → Destination comparison.

**NABII tour (10 steps):**
Pipeline conversion view → Cohort category progress → Open intervention queue for destination N → Filter by class → Open `blocked` item (case-3 registration) → Switch to `ta.officer1` to show scoped cohort view → Live governance gap closure → Destination projection → Environmental baseline → Hand-off to Lender A.

`TourBubble` renders steps from `tours.json`. Each step has `anchor_testid` and `expected_screen`. Bubble must not cover the anchor. Next, Back, and Exit controls work at every step. `TourBubble` does **not** emit `help_open`.

#### 8.2 Deterministic Reset

- One-click **Reset Demo** button.
- Restores data fixtures, clears case events, disputes, findings, reliance, presentations, outcomes, and resets the demo date.
- **Hard invariant:** Reset **never** erases the session capture log. Capture data lives in `symphony.capture.v1` — an entirely separate `localStorage` key that Reset never touches.
- Reset closes the current capture session with reason `reset` and starts a new one automatically.

#### 8.3 Automatic Session Capture — per `CAPTURE_SPEC.md`

**Principles:**
1. **Invisible.** Nothing capture-related appears on demo screens.
2. **Behaviour only.** Events record views, dwell times, and control usage. Never typed text, PINs, or personal data.
3. **Local only.** Zero network calls. No analytics libraries.
4. **Isolated.** Capture never affects engine state. A capture failure must never break the app.
5. **Survives Reset.**

**Session lifecycle:**
- Session starts automatically on first page load.
- URL parameters (set by presenter before session): `?audience=bank|nabii|other&label=bank-1&indicator=off`
  - `audience` defaults to `unlabelled`. `label` is a short code for the meeting (no names).
  - `session_id`: `S-YYYYMMDD-HHMM-xxxx` (4 random hex characters).
  - `indicator=on` shows a small recording dot. Default is **off**.
- Session ends on: Ctrl+Shift+E · tour completion · 20-minute idle timeout · `pagehide` · Reset (reason `reset`, closes and starts new).

**Idle handling:** After 30 s without input, emit `idle_start`. On next input, emit `idle_end`. Idle excluded from `active_ms`.

**Event model (28 event types, 20 screens):**
- Every event base: `v=1`, `session_id`, `seq` (no gaps, starts at 1), `t_ms` (from `performance.now()`, never decreasing), `ts` (ISO 8601 UTC wall clock), `type`, `screen_id`, `tour_id`, `tour_step`, `case_id`, `destination_id`, `role`, `payload`.
- Full schema in `data/capture_event_schema.json`.
- `screen_id` must be one of the 20 registered screens. `/capture` route is never logged.

**`help_open` event** (per `UI_HELP_SPEC_V1.md` section 10):
- Emitted when a tooltip (after 300 ms delay), popover, or helper text is opened.
- Payload: `help_id`, `pattern` (`tooltip`, `popover`, `helper`), `via` (`hover`, `focus`, `tap`, `key`).
- At most one `help_open` per `help_id` per 5 seconds per session.
- Never contains the help text. Never contains typed text.
- `TourBubble` emits `tour_step` only — the `tour` pattern value is reserved and must not be emitted.

**`ui_click` events:** only for elements with a `data-testid` in the `CAPTURE_TESTIDS` allow-list. Never logs element text.

**Storage:**
- Key: `symphony.capture.v1` in `localStorage`.
- Write in batches every 2 seconds and on `pagehide` and `visibilitychange`.
- If `localStorage` unavailable or full: keep events in memory, emit one `error` event with `source: "storage"`.
- **Cap: 20,000 events per session.** At limit, stop logging and emit one `error` with `source: "cap"`.

**`/capture` route (hidden — not linked from any screen, not logged in capture):**
- Lists all sessions with metadata.
- Exports for each session:
  - Session JSON: `{ session, events[], summary }` — includes all derived metrics under `summary`.
  - All sessions JSON.
  - `events.csv`: `session_id, seq, t_ms, ts, type, screen_id, tour_id, tour_step, case_id, destination_id, role, payload_json`
  - `screens.csv`: `session_id, screen_id, views, revisits, first_view_t_ms, total_dwell_ms, total_active_ms, mean_active_ms, max_single_active_ms, entered_via_tour, entered_via_nav`
  - `sessions.csv`: `session_id, audience, label, started_at, duration_ms, active_ms, tours_started, tours_completed, tour_exit_step, off_script_count, destination_switches, role_switches, blocked_actions, successful_actions, traceability_opens, max_drill_clicks, outcomes_recorded, resets, idle_gap_count, longest_idle_ms, time_to_first_traceability_open_ms`
- "Clear capture data" button behind a confirmation. Only code path that deletes capture data.
- **No notes editor. No question display.** Questions from `capture_questions.json` are used after the demo, not during.

**Ctrl+Shift+E:** ends the active session (calculates final dwell time) and immediately triggers browser download of the session JSON.

**Per-session derived metrics** (computed at export, in `summary`): `duration_ms`, `active_ms`, `idle_gap_count`, `idle_total_ms`, `longest_idle_ms`, `tours_started`, `tours_completed`, `tour_exit_step`, `off_script_count`, `off_script_ratio`, `destination_switches`, `role_switches`, `blocked_actions` (by code), `successful_actions`, `traceability_opens`, `max_drill_clicks`, `outcomes_recorded`, `resets`, `time_to_first_traceability_open_ms`, `top_screens_by_active` (top 5), `screens_never_viewed`, `help_open_by_id` (counts), `top_help_ids` (top 5).

**Post-session workflow (presenter — never in the app):**
1. Before session: open app with `?audience=...&label=...`. Tell attendees interactions are logged on this device with no names.
2. Run demo. Do not take notes during.
3. After demo: ask questions in `suggested_order` from `capture_questions.json` for that audience, ending with C5.
4. Within 15 minutes: fill in `session_notes_template.json` (roles only, short quotes under 20 words). Save as `notes-<session_id>.json`.
5. Press Ctrl+Shift+E to download session JSON.
6. Compare automatic screen ranking with C3; blocked actions with B3/B8; commitment level with follow-up actions.
7. Keep session JSON and notes together and off shared folders.

**Gate 8:** H6 (both tours run from reset; every `anchor_testid` visible on its `expected_screen`; no console error), H9 (`help_open` events validate against schema; id only in payload; 5-second dedup), C1 (all emitted events validate against `capture_event_schema.json`), X4–X10 (capture test suite), Reset test (case data restored, capture log preserved).

---

### Phase 9: Hardening, Bundle Sanitization & Vercel Deployment

**Goal:** Verify zero leakage of forbidden terms, exercise all responsive modes, and deploy a clean production bundle.

**Test runs against production build:**
- H7 (no source file contains any help text verbatim — all explanatory strings in `help.json` only)
- H10 (no banned word or real lender name in rendered bubble text)
- `npm run verify:help` (validate_help.py OK)
- X2 (scan `src/` and `dist/` against `forbidden_terms.json` — zero matches)
- X3 (every rendered route displays its mandatory boundary label)
- Full Vitest and Playwright suites against the production build

**Responsive and accessibility checks:**
- Laptop, tablet, and phone widths
- Light and dark themes
- Keyboard-only navigation
- Touch emulation

**Bundle verification:**
Confirm the production `dist/` contains **none** of:
- `tests/`
- `tools/`
- `forbidden_terms.json`
- `capture_questions.json`
- `session_notes_template.json`
- `/dev-components` route

**Deployment:**
1. `npm run build` → clean static output in `dist/`.
2. Deploy via Vercel CLI or Git integration with **Root Directory set to `Prototype/`**.
3. Report the live URL and redeploy steps in `README.md`.

**Gate 9:** All Vitest and Playwright suites green against the production build. Live Vercel URL verified from a clean browser cache. `README.md` complete with run, test, reset, and redeploy instructions.

---

## 7. Complete Verification & Test Matrix

| ID | Group | Level | Summary | Gate |
|---|---|---|---|---|
| **Oracle** | Pre-build | Tool | `python3 tools/reference_oracle.py` prints OK across all 27 cases | 0 |
| **H1** | Pre-build | Data | `python3 tools/validate_help.py` prints OK | 0 |
| **T1** | Original | Engine | `case-1` baseline across A, B, N | 1 |
| **T2** | Original | Engine + UI | 4-step remediation flips Lender A; history immutable | 1 / 3 |
| **T3** | Original | Engine | `case-3` expired registration produces exception on A, B, N | 1 |
| **T4** | Original | Engine + UI | Early off-take marks `provided_early=true`; readiness unchanged | 1 / 3 |
| **T5a–e** | Original | Engine + UI | RBAC: self-verify, self-confirm, missing signoff, wrong role, PFI read-only | 1 / 3 |
| **T6** | Original | Engine + UI | Restructure closes B7 fit check, breaks A11 | 1 / 3 |
| **T7** | Original | Engine | `case-9` ready for B and N; blocked on A | 1 |
| **T8a** | Original | Engine | Every state resolves to evidence id, verifier, timestamp, limitation | 1 |
| **T8b** | Original | UI | Two clicks to project; three clicks to evidence drawer | 2 / 6 |
| **D1** | Original | Engine | Foreign keys, covenant ids, no self-verified seed records | 1 |
| **X1** | Original | Engine + UI | 14-day due window; `case-6` current, `case-7` overdue | 1 / 5 |
| **P1** | Disputes | Engine | `case-8` dispute → Lender A not ready; N and B unchanged | 1 |
| **P2** | Disputes | Engine | Resolve dispute → evidence re-verified; Lender A ready | 1 |
| **P3** | Disputes | Engine | `SAME_VERIFIER` block; resolved by different field agent | 1 |
| **P4** | Disputes | Engine | Full constraint battery (7 cases) | 1 |
| **P5** | Disputes | Engine | Snapshot frozen; live state shows dispute; banner "Raised after presentation" | 1 |
| **V1** | Verification | Engine | Finding recorded; evidence level unchanged | 1 |
| **V2** | Verification | Engine | Full constraint battery (4 cases) | 1 |
| **V3** | Verification | Engine | Reliance recorded once; second attempt blocked; `NO_FINDING` before finding | 1 |
| **V4** | Verification | Engine | `assign_verification` constraint battery | 1 |
| **F1** | Pipeline | Engine | Baseline funnel = (9,7,5,3,3,2); case lists correct | 1 |
| **F2** | Pipeline | Engine | Cohort summary equals `expected-pipeline.json`; baseline = current | 1 |
| **F3** | Pipeline | Engine | Intervention class counts match `expected-pipeline.json` | 1 |
| **F4** | Pipeline | Engine | After T2: gaps closed A=2, funnel "ready for lender"=6 | 1 |
| **R1** | Scope | Engine | `ta.officer1` sees cohort 1 only; `ACCESS_DENIED_COHORT` on case-8 | 1 |
| **R2** | Scope | Engine | `fm.officer1` sees all; `raise_dispute` → `ROLE_NOT_PERMITTED` | 1 |
| **E1** | Export | Engine | CSV 13 columns; row count = A's requirement count (11); no internal fields | 1 |
| **E2** | Export | Engine | JSON contains `illustrative:true`, boundary, dispute, finding; no lender names | 1 |
| **H2** | Help | UI | All `data-help-id` ids exist in `help.json`; screens arrays match actual usage | 2 |
| **H3** | Help | UI | Keyboard: focus opens tooltip; Enter/Space opens popover; Escape closes | 2 |
| **H4** | Help | UI | Touch: tap opens popover; badge click never opens bubble; tap outside closes | 2 |
| **H5** | Help | UI | Required visible statements present without interaction on all listed screens | 3/4/5/6/7 |
| **H5b** | Help | UI | Blocked-action message `"Blocked (CODE): <rule>"` visible inline | 4 |
| **H6** | Help | UI | Both tours run from reset; anchors visible; no console error | 8 |
| **H7** | Help | Source | No source file contains verbatim help text | 9 |
| **H8** | Help | UI | State badge: click 1 opens basis; click 2 opens evidence drawer | 2 |
| **H9** | Help | UI | `help_open` events validate against schema; id only; 5-second dedup | 8 |
| **H10** | Help | UI | No banned word or real lender name in rendered bubble text | 9 |
| **H11** | Help | UI | One-line limitation visible on every requirement card without interaction | 2/3 |
| **U1** | UI & data | UI | Demo paths in §4.4 and §5.4 succeed through DOM; disabled buttons show rule | 6 |
| **U2** | UI & data | UI | Mutating a fixture changes funnel, cohort, queue numbers accordingly | 7 |
| **C1** | UI & data | Engine | All emitted events during demo validate against `capture_event_schema.json` | 8 |
| **X2** | Security | Build | Scan `src/` and `dist/` against `forbidden_terms.json`; zero matches | 4 / 9 |
| **X3** | Security | UI | Every rendered route shows its boundary label | 9 |
| **X4** | Capture | Capture | Schema conformance: `seq` no gaps; `t_ms` never decreasing; `session_end` last | 8 |
| **X5** | Capture | Capture | No outbound network calls during full tour (Playwright records zero non-same-origin requests) | 8 |
| **X6** | Capture | Capture | Reset preserves `symphony.capture.v1`; closes session `reason:reset`; engine = baseline | 8 |
| **X7** | Capture | Capture | Typed text never appears in any event or export | 8 |
| **X8** | Capture | Capture | `localStorage` failure: tour completes; no uncaught exception; `error source:storage` in memory | 8 |
| **X9** | Capture | Capture | Fixed event fixture produces expected `summary` values (write fixture first) | 8 |
| **X10** | Capture | Capture | CSV headers match `CAPTURE_SPEC.md` section 9 exactly; JSON re-validates against schema | 8 |
| **Reset** | UI | UI | Reset restores `case-1` baseline; clears events/disputes/findings; capture log intact | 3 / 8 |

**Total: 65 tests (original T1–T8b, D1, X1, Reset + 33 new FR tests + 12 help tests + 3 UI/data + capture renumber).**

---

## 8. Reference Values

Computed at `demo_date = 2026-10-06` from the fixtures. These are tests, not display text.

| Item | Value |
|---|---|
| Baseline readiness | 27 results in `expected-results.json` |
| Funnel | 9, 7, 5, 3, 3, 2 |
| Ready per destination | Lender A: cases 5, 6, 7, 8 · Lender B: case 9 · Programme: 7 (all except 3 and 4) |
| Open interventions | Programme: 3 standard, 1 specialist, 0 restructure, 1 blocked · Lender A: 9, 4, 1, 1 · Lender B: 18, 8, 8, 1 |
| Cohort 1 | 5 cases; registration 4, governance 4, membership 4, project 5, environment 4, inclusion 4 |
| Cohort 2 | 4 cases; all groups: 4 |
| Portfolio | 9 cooperatives, 2 financed, ZMW 530,000 exposure, 1 current, 1 overdue |
| After T2 on case-1 | Gaps closed for Lender A = 2 (A2, A6); ready for a lender = 6 |

---

## 9. Execution Directives

1. **Stop-and-report at every gate.** Run gate tests, generate a concise report (features built, test results, deviations, open questions), and **pause for review** before starting the next phase.
2. **Write tests before or with each feature.** Never delete or weaken a test to pass a gate.
3. **Never edit a fixture or expected value to make a test pass.** Report disagreements with two options.
4. **Keep the engine free of UI and date-of-today dependencies.** The demo date is always injected.
5. **Keep `DECISIONS.md` current.** Every open choice logged with the rationale.
6. **If a spec is silent or contradictory, stop and report** — include what was found, why it conflicts, and two options.
7. **Scope lock.** No additional architecture, screens, or database concepts beyond the 9 build phases.
8. **Offline typography resiliency.** System-font fallback only. No external font imports.

---

## 10. Defaults (Do Not Change Without Approval)

- Verification is interactive. Findings never change evidence. Reliance is recorded only by `pfi_credit`.
- Disputes close only by independent re-verification or withdrawal. New evidence never closes them.
- The resolver of a dispute must be a field agent who is neither the supplier nor the previous verifier.
- Intervention classes and owner roles are as in `interventions.json`.
- Funnel stage definitions are those in `FUNCTIONAL_SPEC_UPDATE_V1.md` section 6.1.
- `ta` is scoped by cohort. `fund_manager` is not. `fund_manager` may not raise disputes.
- Capture records behaviour only, locally, and survives Reset. It never shows UI during the demo.
- Help bubbles never replace a visible statement or a blocked-action message.
- Tooltip delay 300 ms, close delay 100 ms, popover width 320 px.
- State badges never carry popovers. Meanings are in the `StateLegend` and tooltips.
- Help text lives in `help.json` only. No explanatory strings in components or source files.
- Tour bubbles do not emit `help_open`.
- Screen id `claim_view` replaces `static_verification` everywhere (capture schema, help entries, plan).
- `capture_questions.json` and `session_notes_template.json` are presenter material — never bundled.

---

## 11. Definition of Done

- All 9 phase gates passed and reported.
- Both tours run from reset without a console error.
- Deployed on Vercel. Live URL verified from a clean browser cache.
- X2 passes: no real lender names in `src/` or `dist/`.
- `DECISIONS.md` complete with all open choices.
- `README.md` complete: how to run, test, reset, and redeploy.
