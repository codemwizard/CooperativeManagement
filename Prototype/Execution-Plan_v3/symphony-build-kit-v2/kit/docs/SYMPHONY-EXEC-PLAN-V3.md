# Symphony Interactive Prototype: Implementation Plan V3

**Document ID:** `SYMPHONY-EXEC-PLAN-V3` (supersedes V2)
**Target:** self-contained static deployment in `Prototype/` on Vercel
**Audience:** the AI agent that builds the prototype, and the presenter

## 0. Governing documents and precedence

Where two documents disagree, the one higher in this list wins.

| Rank | Document | Role |
|---|---|---|
| 1 | `docs/FUNCTIONAL_SPEC_UPDATE_V1.md` (v1.1) | Disputes, verifier workspace, computed pipeline, scoped roles, export |
| 2 | `docs/UI_HELP_SPEC_V1.md` | Tooltips, popovers, helper text, required visible statements, tours |
| 3 | `docs/CAPTURE_SPEC.md` | Automatic session capture, events, exports, tests X4 to X10 |
| 4 | `AGENT.md` (same content as `CLAUDE.md`) | Engine specification, invariants, working agreements |
| 5 | This plan | Phase order, gates, integration |
| 6 | `data/*.json`, `tests/*.json` | Source of truth for values. Never edited to make a test pass |

### Changes from V2
1. **Verifier workspace is interactive.** `StaticVerificationView` is replaced by `claim_view`, `verifier_queue` and `verifier_workbench`.
2. **Disputes, scoped roles, export and the help system are added.** V2 omitted them.
3. **Figures corrected.** The pipeline, cohort and intervention numbers in V2 did not match the data and are replaced by values computed from the engine (section 7).
4. **Capture aligned to `CAPTURE_SPEC.md`.** Test numbering, 28 event types, no in-app notes editor, storage key `symphony.capture.v1`.
5. **Removed:** the "Standard Application Baseline" comparison panel, "immutable" wording, "Green Bond / ESG" in the assurance chain, and the pre-seeded verifier finding.

## 1. Rules that apply everywhere

**Boundary statement.** The sentence below is rendered through `VisibleStatement id="boundary.sentence"`, never typed into a component.

> Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision.

**Invariants** (from `data/meta.json`): I1 no self-verification; I2 supersede, never overwrite; I3 every state shows its basis and limitation; I4 readiness is computed; I5 Symphony never makes outcomes or findings; I6 no Arrangement object; I7 every screen has a boundary label; I8 findings, disputes and reliance never change evidence.

**Data hygiene**
- No real lender name anywhere: "Lender A", "Lender B", "NABII Programme Pipeline". Test X2 scans `src/` and `dist/` against `data/forbidden_terms.json`. "NABII" is allowed.
- Every figure on screen comes from the fixtures or live engine state. No typed-in numbers.
- No score, rating, mapping to an external methodology, API, or integration claim.
- Wording: say "append-only history", never "immutable". Say "blocked within the application", never "impossible".
- Help text exists only in `data/help.json` and `data/tours.json`. Components contain no explanatory strings.
- Presenter material (`capture_questions.json`, `session_notes_template.json`) is not imported by the app and is excluded from the bundle.

**Architecture freeze (amended).** Screens and components are exactly those in sections 3 and 4. The amendment from V2 adds `claim_view`, `verifier_queue`, `verifier_workbench`, `nabii_cohort`, the help components, and the dispute, assignment, finding, reliance and export components. Nothing else may be added.

## 2. Perspectives

Five roles of use over one governed state. The role switcher exposes all of them; the login screen offers the persona groups.

```
SME             Establish → Assess → Remediate → Become Ready → Present      (secretary, treasurer, chairman, member, field agent)
LENDER          Receive → Inspect → Examine evidence → Dispute / request → Assign verification → Rely → Record own outcome    (pfi_analyst, pfi_credit)
VERIFIER        Log in → Queue → Open assignment → Review evidence → Record finding          (verifier)
NABII           Pipeline → Cohort → Interventions → Track readiness → Observe conversion     (ta scoped to cohort, fund_manager all)
CAPTURE         Invisible: records behaviour only; presenter exports after the session
```

## 3. Inventory

### 3.1 Screens
| Screen id | View | Phase | Boundary label |
|---|---|---|---|
| `login` | Persona and case selection, including verifiers and NABII roles | 3 | Beachhead |
| `enrollment` | Create organisation, officers, project, self-assessment | 3 | Beachhead |
| `sme_dashboard` | KPIs, alerts including "Evidence disputed" | 3 | Beachhead |
| `org_state`, `project_state` | Governed metric cards | 3 | Beachhead |
| `requirements` | Destination checklist, "Illustrative products." | 3 | Beachhead |
| `gap_remediation` | T2 workflow, restructure, early off-take | 3 | Beachhead |
| `readiness_basis` | The full "Why?" | 3 | Beachhead |
| `destination_projection` | Destination switch, present | 3 | Beachhead |
| `present_modal` | Present to a destination, export | 3 | Beachhead |
| `lender_assessment` | Presented case, admission, disputes, assignments, reliance, outcome, export | 4 | Same state, extended |
| `facility_monitoring` | Facility, proceeds, covenants, baseline vs current | 5 | Same state, extended |
| `portfolio` | Computed portfolio | 6 | Same state, extended |
| `claim_view` | Claim, baseline, current, evidence, finding, reliance, assurance chain | 6 | Same state, extended: illustrative data |
| `verifier_queue`, `verifier_workbench` | Verifier work | 6 | Same state, extended: illustrative data |
| `nabii_pipeline` | Computed funnel, interventions | 7 | Same state, extended |
| `nabii_cohort` | Cohort baseline vs current, interventions | 7 | Same state, extended |
| `nabii_directory` | Filterable cooperative list | 7 | Same state, extended |
| `tour_launcher` | Choose a tour | 8 | Beachhead |
| `/capture` (hidden, not logged) | Session list, exports, clear | 8 | none |

### 3.2 Engine modules (`src/engine/`, pure, no React, injected clock)
`types.ts`, `evaluate.ts`, `actions.ts`, `covenants.ts`, `pipeline.ts`, `dossier.ts`, `scope.ts`.

### 3.3 Components (`src/components/`)
- **Core:** `BoundaryLabel`, `GovernedMetricCard`, `RequirementCard`, `RequirementChain`, `EvidenceDrawer`, `TraceabilityTrigger`, `StateTransitionCard`, `DestinationSwitcher`, `RoleSwitcher`, `EventLogDrawer`.
- **Disputes and verification:** `DisputePanel`, `DisputeBanner`, `AssignmentCard`, `FindingForm`, `AssuranceChain`, `RelianceControl`.
- **Export:** `ExportMenu`.
- **Help (`components/help/`):** `HelpProvider`, `HelpTip`, `HelpPopover`, `HelpHint`, `VisibleStatement`, `TourBubble`, `StateLegend`.
- **Capture:** `CaptureProvider` (hooks only, no UI).

### 3.4 Data files and where they are used
| File | Used by |
|---|---|
| `cases.json`, `destinations.json`, `roles.json`, `meta.json` | Engine, all views |
| `extension.json` | `facility_monitoring` baseline vs current; `claim_view` baseline and current |
| `verification_seed.json` | Verifier users, claim, assignments `asg-1` (case-8 income records) and `asg-2` (claim-1) |
| `interventions.json` | Intervention queue in `nabii_pipeline` and `nabii_cohort`; class tooltips |
| `help.json` | All help bubbles and required visible statements |
| `tours.json` | Both tours |
| `capture_event_schema.json` | Capture validation (test X4) |
| `forbidden_terms.json` | Test X2 only. Never imported by the app |
| `expected-results.json`, `expected-pipeline.json` | Tests only |
| `capture_questions.json`, `session_notes_template.json` | Presenter use only. Not bundled |

## 4. Tooling rules (Phase 0)

Run before coding. Report in `DECISIONS.md`.
- `python3 tools/reference_oracle.py` and `python3 tools/validate_help.py` must both print OK.
- Node 22, installed inside WSL (not mixed with the Windows install). Pin `engines.node` to `22.x`.
- Vite, React, TypeScript, Vitest, Playwright. Vitest `include` is `tests/**/*.test.ts` only, so it never picks up Playwright `*.spec.ts` files.
- `tsconfig`: `resolveJsonModule: true`, `noEmit: true`. Build script `tsc --noEmit && vite build`.
- `playwright.config.ts` with a `webServer` pointing at `vite preview`. Install Chromium with system dependencies.
- System-font fallback only. No external fonts.
- Add `npm run verify:help` for `validate_help.py` and `npm run verify:oracle` for the oracle.
- Deliverables beyond code: `README.md` (run, test, reset, redeploy) and `DECISIONS.md`.

## 5. Phases

Each phase ends with a gate run and a short report (built, tests, deviations, open questions). Stop and wait for review.

### Phase 1: Engine, data loading, tests
- Implement section 5 of `AGENT.md`, plus the changes in `FUNCTIONAL_SPEC_UPDATE_V1.md` sections 4 to 9:
  - `evaluate.ts`: effective state derives `disputed` from open disputes in `case.disputes[]`. Baseline 27 results unchanged.
  - `actions.ts`: all actions in the role file, including `raise_dispute`, `resolve_dispute`, `withdraw_dispute`, `assign_verification`, `record_verification_finding`, `record_reliance`, `export_dossier`. Constraint order: role, scope, entity, segregation. Never mutate input.
  - `pipeline.ts`: `funnel`, `cohortSummary`, `interventionQueue`, `gapsClosed`. `dossier.ts`: `buildDossier`, `dossierToCsv`. `scope.ts`: `visibleCases`.
  - The loader adds `disputes: []` and `verification: {assignments, findings, reliance}` to each case in memory and merges seeded assignments. It keeps a read-only baseline snapshot for cohort comparison.
- Update the oracle for disputes and pipeline values (`FUNCTIONAL_SPEC_UPDATE_V1.md` section 8.4).
- **Tests:** T1 to T7, T8a, D1, X1, the 27-result regression, P1 to P5, V1 to V4, F1 to F4, R1, R2, E1, E2.
- **Gate 1:** all pass; 27 of 27 baseline results unchanged; oracle and help validator OK; zero edits to fixtures.

### Phase 2: Design system, help system, shared primitives
- Build the core, dispute, verification, export and help components (section 3.3), vanilla CSS tokens, light and dark themes.
- Add `data-testid` to every interactive element per `FUNCTIONAL_SPEC_UPDATE_V1.md` section 10, and `data-help-id` and `data-required-text` attributes per the help spec.
- `StateLegend` gives touch users state meanings. State badges never carry popovers.
- `HelpProvider` enforces one open bubble at a time, resolves tokens, and throws on missing ids in development.
- Component demo route exercises every state: asserted, supported, verified, disputed, stale.
- **Tests:** T8b (state badge to evidence drawer in two clicks), H1 to H4, H8, plus a render test for every pattern.
- **Gate 2:** all above pass.

### Phase 3: SME hero path (stages 1 to 9)
- Screens: `login` (with all personas), `enrollment`, `sme_dashboard`, `org_state`, `project_state`, `requirements`, `gap_remediation`, `readiness_basis`, `destination_projection`, `present_modal`.
- Dashboard KPIs: readiness per destination, requirements by evidence tier, open gaps, days to next expiry. Alerts include "Evidence disputed (n)", opening an issue page (what is disputed, who raised it, what is needed, owner role).
- Executing T2 end to end through the UI. Early off-take evidence (T4) and restructure request (T6) with their effects visible.
- Required visible statements from `help.json` on each listed screen. Help bubbles per the placement map.
- Present creates a frozen snapshot. The "Same enterprise. Same project. Different requirement context." line is visible.
- **Tests:** T1, T2, T4, T5, T6, T7 reproduced through the DOM; H5 and H11 for SME screens; Reset test.
- **Gate 3:** all pass; Reset restores `case-1` exactly.

### Phase 4: Lender workspace and decisioning (stage 10)
- `lender_assessment`: presented snapshot with requirements, evidence, findings, limitations, history.
- Lender actions: accept or reject evidence (admission), request more evidence (the case-8 loop shows on the SME side), **raise dispute**, **assign verification**, add own finding, **record reliance** on an existing finding, **record outcome** (explicit choice, never pre-selected), **export** the readiness record (JSON, CSV, print view).
- Disputes show on requirement cards, evidence drawer and the lender banner; disputes raised after presentation show "Raised after presentation".
- Visible panel: "Symphony established" versus "Lender decides", and `lender.decides`. No time-saving or comparison panel.
- **Tests:** P1 to P5 and V4 reproduced through the UI; E1, E2; H5, H5b, H11; outcome cannot be recorded without a choice; SME view shows lender requests.
- **Gate 4:** all pass; X2 clean on source so far.

### Phase 5: Post-disbursement monitoring (stages 11 and 12)
- `facility_monitoring` for `case-6` (and `case-7` for contrast), all values from fixtures:
  - Facility ZMW 180,000, 24 months, disbursed 2026-06-10 (case-6). Case-7: ZMW 350,000.
  - Use of proceeds, computed planned versus evidenced: case-6 Seed and fertiliser 120,000 / 120,000; Equipment hire 60,000 / 45,000, a computed difference of 15,000. Case-7 Feed and veterinary inputs 250,000 / 210,000; Cold-storage equipment hire 100,000 / 100,000. The difference is shown as a computed figure, not as a requirement "exception".
  - Covenant list with state per covenant and per case: case-6 current, case-7 overdue (quarterly cash statement due 2026-09-15). Alert, issue and covenant drill chain.
  - Baseline versus current for the hero case from `extension.json` (180 ha to 190 ha, field condition, water use), with who established it, when, and the GPS accuracy limitation. This is an extended scenario. Its facility figure (ZMW 300,000) is never added to portfolio totals.
- **Tests:** X1 in the UI; figures match fixtures; the overdue covenant traces to its evidence.
- **Gate 5:** pass.

### Phase 6: Portfolio and interactive verification (stages 13 to 16)
- `portfolio`: every number computed from `cases.json` (9 cooperatives; 2 financed; exposure ZMW 530,000; monitoring: 1 current, 1 overdue; ready counts per destination). Every number clickable. Click path: number, filtered project list, project requirement view (two clicks), then the evidence drawer (third click).
- `claim_view`: claim-1 with baseline and current, evidence list, limitation, and the assurance chain **Claim → Evidence → Verification finding → Lender reliance → Portfolio reporting**. Each node shows computed state or "Not yet recorded".
- `verifier_queue` and `verifier_workbench`:
  - Verifier personas `vrf.mulenga` (institution staff) and `vrf.sakala` (independent), with a profile card (name, organisation, kind, scope).
  - Queue shows assigned work. The workbench shows the target, baseline and current, evidence, limitations and disputes, and a finding form (result, scope, limitation) with helper text per result.
  - Recording a finding completes the assignment. It never changes evidence.
- Demo paths: (a) lender assigns, or uses seeded `asg-1` (case-8 income records), verifier records a finding, lender records reliance; (b) seeded `asg-2` for the claim, finding, reliance, assurance chain updated.
- **Tests:** V1 to V3 through the UI; U1; T8b with portfolio; H5 for the verifier screens; every portfolio total equals the engine reduction.
- **Gate 6:** pass.

### Phase 7: NABII pipeline, cohort, interventions, scoped roles
- Replace every figure from V2 with computed ones.
  - `nabii_pipeline`: funnel Enrolled 9, Ready (programme) 7, Ready for a lender 5, Presented 3, Lender response recorded 3, Financed 2. Click a stage to list its cooperatives. Intervention queue per destination, by class from `interventions.json`.
  - `nabii_cohort`: per programme cohort, number of cases, programme-ready count, and per requirement group (legal, governance, membership, project, environment, inclusion) the count satisfied. Baseline beside current, gaps closed. Cohort 1 baseline: 5 cases, 3 ready; satisfied 4, 4, 4, 5, 4, 4. Cohort 2: 4 cases, 4 ready; 4 in every group.
  - `nabii_directory`: filter and sort by province, district, programme, readiness per destination, gaps closed.
- Scoped roles: `ta.officer1` (Readiness Cohort 1 only) and `fm.officer1` (all). The engine enforces `ACCESS_DENIED_COHORT`. Both are read-only on evidence.
- **Tests:** F1 to F4, R1, R2 in the UI; U2 (mutating a fixture changes the numbers).
- **Gate 7:** pass; no number on these screens is typed in.

### Phase 8: Tours, capture, reset
- **Tours:** `tour_launcher` and `TourBubble` driven entirely from `tours.json` (13 bank steps, 10 NABII steps). They include the dispute, verifier, reliance and export steps.
- **Reset:** restores fixtures, clears events, disputes, findings, reliance, presentation and outcomes, resets the demo date. It never touches the capture log.
- **Capture** per `CAPTURE_SPEC.md`:
  - Session starts automatically; `?audience=bank|nabii|other&label=...&indicator=off`.
  - 28 event types per `data/capture_event_schema.json`; screen registry as in the schema.
  - Storage key `symphony.capture.v1`; cap 20,000 events; failure never breaks the app.
  - Ctrl+Shift+E ends the session and downloads the session JSON. The hidden `/capture` route lists sessions and exports JSON, `events.csv`, `screens.csv` and `sessions.csv`, with a confirmed "Clear capture data".
  - No notes editor and no question display in the app. Questions are asked after the demo using `capture_questions.json` and the notes template.
  - `help_open` events per the help spec: id only, 5-second dedup, tooltip only after its delay.
- **Tests:** H6, H9, C1, X4 to X10, tour completion with no console error, Reset test.
- **Gate 8:** pass.

### Phase 9: Hardening and deployment
- Tests: H7, H10, X2 (against `src/` and `dist/`), X3, `validate_help.py`, the full Vitest and Playwright suites against the production build.
- Check laptop, tablet and phone widths, light and dark themes, keyboard-only and touch emulation.
- Confirm the bundle contains no `tests/`, `tools/`, `forbidden_terms.json`, `capture_questions.json` or `session_notes_template.json`.
- `npm run build`, deploy to Vercel with Root Directory `Prototype`. Report URL and redeploy steps.
- **Gate 9:** all green; live URL verified from a clean browser.

## 6. Test matrix

| Group | IDs | Source |
|---|---|---|
| Pre-build | Oracle, `validate_help.py` | Tools |
| Original | T1 to T8b, D1, X1 to X3, Reset | `tests/TEST_CASES.md` |
| Disputes | P1 to P5 | `FUNCTIONAL_SPEC_UPDATE_V1.md` |
| Verification | V1 to V4 | same |
| Pipeline | F1 to F4 | same, with `expected-pipeline.json` |
| Scope | R1, R2 | same |
| Export | E1, E2 | same |
| UI and data | U1, U2, C1 | same |
| Capture | X4 to X10 | `CAPTURE_SPEC.md` |
| Help | H1 to H11 (including H5b) | `UI_HELP_SPEC_V1.md` |

Capture tests, as defined in `CAPTURE_SPEC.md` (V2 of this plan numbered them differently, and that numbering is withdrawn): X4 schema conformance, X5 no network, X6 reset isolation, X7 no typed text or personal data, X8 failure tolerance, X9 derived metrics, X10 export formats.

## 7. Reference values

Computed at `demo_date = 2026-10-06` from the fixtures. These are tests, not display text.

| Item | Value |
|---|---|
| Baseline readiness | 27 results in `expected-results.json` |
| Funnel | 9, 7, 5, 3, 3, 2 |
| Ready per destination | Lender A: cases 5, 6, 7, 8. Lender B: case 9. Programme: 7 cases (all except 3 and 4) |
| Open interventions | Programme: 3 standard, 1 specialist, 0 restructure, 1 blocked. Lender A: 9, 4, 1, 1. Lender B: 18, 8, 8, 1 |
| Cohort values across all nine cases | Registration 8, governance 8, membership 8, project 9, environment 8, inclusion 8 |
| Portfolio | 9 cooperatives, 2 financed, exposure ZMW 530,000, 1 current and 1 overdue |
| After the T2 sequence on case-1 | Gaps closed for Lender A = 2; ready for a lender = 6 |

## 8. Execution directives

1. Stop and report at each gate. Do not begin the next phase until review.
2. Write tests before the feature they cover.
3. Never edit a fixture or expected value to make a test pass. Report disagreements.
4. Keep the engine free of UI and of the system clock.
5. Keep a running `DECISIONS.md` for every open choice you make.
6. If a spec is silent or contradictory, stop and report with two options.

## 9. Defaults chosen (do not change without approval)

- Verification is interactive. Findings never change evidence. Reliance is recorded only by `pfi_credit`.
- Disputes close only by independent re-verification or withdrawal.
- Intervention classes and owners are as in `interventions.json`.
- The funnel stage definitions are those in `FUNCTIONAL_SPEC_UPDATE_V1.md` section 6.1.
- `ta` is scoped by cohort. `fund_manager` is not.
- Capture records behaviour only, locally, and survives Reset.
- Help bubbles never replace a visible statement or a blocked-action message.
