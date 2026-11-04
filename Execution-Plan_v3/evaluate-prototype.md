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



### Journeys
Yes. The important change is that we should stop thinking of the prototype as a collection of portals and instead define **the story each stakeholder must be able to experience through its portal**.

The portals are different views of the **same persistent enterprise/project/evidence state**. The magic is what happens when that state moves from one institutional context to another without the SME starting again.

The overall story becomes:

> **Find/organise the enterprise → make it investment-ready → make it discoverable → make it assessable by the right institution → finance/implement → verify → monitor → reuse the same evidence for the next opportunity.**

And critically, **financing is not the end of the story**.

---

# 1. The Symphony journey map

I would define the prototype around **seven journeys**, even though some can share the same underlying portal.

| Stakeholder / Portal                      | Their question                                                                               | Journey Symphony must demonstrate                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **SME**                                   | “How do I become ready for opportunities I cannot currently access?”                         | **Zero → Registered → Evidence assembled → Gaps closed → Assessment Ready → Discoverable**                                                 |
| **NABII**                                 | “Can I actually turn enterprises into an investable pipeline?”                               | **Enterprise recruitment → rapid registration → readiness programme → interventions → investment-ready pipeline → discoverable portfolio** |
| **SBGI / TA**                             | “Which enterprises need what intervention, and which are appropriate for supported finance?” | **Portfolio → diagnose gaps → recommend TA → intervention → readiness → financing destination**                                            |
| **PFI**                                   | “Is there an enterprise here worth assessing, and can I trust what I'm seeing?”              | **Discover → filter → inspect → assess → query/verify → decide → retain reusable evidence**                                                |
| **VVB / verifier**                        | “What exactly am I being asked to verify, based on what evidence and what claim?”            | **Assignment → claim → evidence → verification → finding → governed record**                                                               |
| **Portfolio / Impact Manager**            | “What is happening across the portfolio after intervention/investment?”                      | **Portfolio → monitor → evidence changes → exceptions → outcomes → impact reporting**                                                      |
| **SME Readiness Marketplace / Discovery** | “Which enterprises fit my capital/programme/market requirements?”                            | **Opportunity/destination → search portfolio → discover matching enterprises → inspect readiness → engage → reuse evidence**               |

That last one is important.

**The marketplace is not necessarily a separate product. It is the consequence of having a persistent, governed portfolio of discoverable enterprises.**

---

# 2. SME Portal — **Zero to Assessment Ready**

This is probably the most important journey to demonstrate to NABII.

The mistake would be to demonstrate:

> “Here is a form where an SME enters information.”

That is ordinary software.

The demonstration needs to be:

> **“Here is an economically real but poorly documented enterprise. Watch what happens when we put it into Symphony.”**

## Stage 1 — Zero

Start with an SME/cooperative that has:

* members
* a real activity/project
* some registration information
* scattered documents
* informal governance records
* photographs
* invoices/receipts
* production information
* maybe financial records
* perhaps documents sitting on phones or in paper files

But it is not yet a coherent investment proposition.

The screen should communicate:

**Current state: economically real, institutionally poorly evidenced.**

That is the starting point.

---

## Stage 2 — Workshop registration

This is where your **five laptops / 50 SMEs** point becomes strategically important.

The prototype should visibly demonstrate:

### Workshop operator

**“Register Enterprise”**

Then rapidly capture:

1. enterprise identity
2. registration status
3. members
4. location
5. activity
6. project
7. contact information
8. basic governance
9. intended financing/use case

The important thing is the **throughput story**.

You want NABII to be able to mentally calculate:

> Five laptops × rapid assisted registration × 50 enterprises in a workshop = a viable pipeline-generation mechanism.

The workshop isn't supposed to complete every piece of evidence.

It creates the **enterprise record and the beginning of its governed state**.

---

# 3. SME — the one-week readiness journey

This is where I think the prototype needs to become much more explicit.

After the workshop:

### Day 1

**Registered**

The enterprise now exists in Symphony.

### During the week

The SME progressively uploads what it already has.

Not:

> “Complete this giant application.”

Instead:

> “Here are the requirements. Here is what you already have. Here is what is missing.”

For example:

**Governance**

* member register — supplied
* constitution/by-laws — supplied
* AGM minutes — missing
* board resolution — partial

**Operations**

* production records — supplied
* location evidence — supplied
* supplier records — partial

**Financial**

* bank statements — supplied
* sales records — partial
* financial statements — missing

**Project**

* project description — supplied
* project budget — supplied
* implementation evidence — partial

Now Symphony can show:

> **What is missing, who can provide it, and what can be verified.**

---

# 4. SME — assisted remediation

This is where the Symphony agent model becomes powerful.

The SME doesn't need to solve everything alone.

The system can say:

> **“These three requirements require assistance.”**

The agent visits the cooperative.

Or helps by phone.

The SME does not restart the process.

The information already collected remains there.

The agent helps resolve the outstanding requirements.

This gives you a very good demonstration moment:

### Before

> 43% readiness
> 17 unresolved requirements
> 6 unsupported claims
> 3 governance gaps

### After intervention

> 87% / Assessment Ready
> 2 exceptions
> 1 verification pending

The exact percentages should come from the actual prototype logic rather than invented performance claims. The **state transition** is what matters.

---

# 5. SME — Assessment Ready

This is the first major payoff.

The SME sees:

> **Assessment Ready for:**
>
> * Working-capital finance
> * Green investment programme
> * Agricultural equipment finance
> * Impact-investment programme

And potentially:

> **Not currently ready for:**
>
> * Equity investment
> * Large project finance

because the requirements are different.

This demonstrates one of Symphony's strongest architectural ideas:

**There isn't one universal “investment ready” state.**

There is a governed enterprise state that can be projected against different destinations.

---

# 6. SME — Discoverable

This is the part I think should be added much more strongly to the story.

The SME doesn't disappear after failing to obtain one loan.

Suppose:

> Bank A says no.

The SME is **not deleted from the financial ecosystem**.

Its governed state remains.

Then:

> Investor B searches Symphony.

They find the SME.

Investor B has different requirements.

The same evidence is reused.

The SME may now be:

> **Assessment Ready for Investor B**

without reconstructing its entire profile.

That is the beginning of the **SME readiness marketplace**.

---

# 7. NABII Portal — **Build the Pipeline**

NABII's journey should be completely different from the SME journey.

NABII needs to see:

> **“I can take a population of enterprises and systematically turn them into an investment-ready, discoverable pipeline.”**

The journey should be:

### 1. Recruit

NABII selects:

> Green agriculture cooperative programme
> 50 enterprises

### 2. Workshop

NABII sees:

> 50 enterprises registered
> 50 enterprise records created

This is where the five-laptop scenario should be visible.

### 3. Baseline

NABII sees:

| State                             | Enterprises |
| --------------------------------- | ----------: |
| Registered                        |          50 |
| Initial assessment                |          50 |
| Programme-ready                   |           X |
| Assessment-ready                  |           X |
| Financing-ready for destination A |           X |
| Financing-ready for destination B |           X |

The point isn't the particular numbers.

The point is that **NABII now has visibility of the pipeline rather than a collection of programme participants.**

---

## 8. NABII — manage interventions

NABII then sees:

> 12 enterprises have governance gaps
> 8 need financial-record assistance
> 7 need specialist technical evidence
> 5 require verification
> 3 are already assessment-ready

This changes NABII's role.

It isn't just:

> “We trained 50 SMEs.”

It becomes:

> “We know exactly what prevents each enterprise from becoming investable.”

Then NABII can coordinate:

* training
* mentorship
* TA
* specialist assistance
* verification
* programme interventions

---

# 9. NABII — investment-ready pipeline

This is the **NABII aha moment**.

NABII can now look at:

> **My portfolio of 200 enterprises**

and filter it by:

* sector
* province
* district
* project
* green activity
* readiness
* capital requirement
* financing destination
* evidence gaps
* verification status
* intervention history

Then:

> **“These 27 enterprises are currently ready for this financing opportunity.”**

That is much more powerful than an SME database.

It is a **living investment pipeline**.

---

# 10. NABII — continuity

This is where your argument about invisibility becomes much stronger.

Without Symphony:

> Programme → SME → loan application → rejected → disappears.

With Symphony:

> Programme → SME → readiness record → PFI A → rejected → remains discoverable → PFI B → investor C → programme D.

The enterprise has **institutional continuity**.

The evidence doesn't belong to the failed application.

It belongs to the enterprise/project and its governed history.

That is a genuinely important product property.

---

# 11. SBGI / TA Portal — **Turn Risk-Support Money into Targeted Intervention**

SBGI should not look like another NABII dashboard.

Its journey should answer:

> **“Where does TA actually have the highest leverage?”**

Start with a population:

> 500 enterprises entering an SBGI-supported pipeline.

SBGI sees:

### Portfolio diagnosis

* 140 ready
* 180 need basic governance
* 90 need financial evidence
* 50 need specialist technical assistance
* 40 require verification

Then SBGI can ask:

> Where should TA money go?

---

## SBGI intervention journey

### Identify

> 25 enterprises are potentially suitable for supported lending but have recurring financial-readiness deficiencies.

### Recommend TA

> Assign financial management TA.

### Monitor

The portal shows:

> Before TA
> → missing financial records
> → incomplete governance
> → unsupported revenue claims

Then:

> After TA
> → financial evidence supplied
> → governance evidence completed
> → claims supported
> → assessment-ready

### Recommend financing pathway

Now SBGI can see:

> **Suitable for PFI assessment**

That is a much more compelling use of SBGI than simply showing another financing dashboard.

It demonstrates **risk preparation before risk transfer**.

And it fits SBGI's TA component rather than pretending SBGI is itself the lender.

---

# 12. PFI Portal — **Discover → Assess → Decide**

The PFI needs the most commercially realistic journey.

They don't want to be shown:

> “Look at all the wonderful documents Symphony stores.”

They want:

> **“Show me businesses that may be worth assessing.”**

---

## PFI Step 1 — Discover

The PFI enters:

> Sector: Agriculture
> Location: Eastern Province
> Financing: ZMW 500k–2m
> Green project: Yes
> Readiness: Assessment Ready

Symphony returns:

> 23 enterprises

That is the **marketplace/discovery moment**.

---

# 13. PFI Step 2 — inspect

The PFI selects one enterprise.

They immediately see:

### Enterprise

Who are they?

### Project

What are they trying to finance?

### Requirements

What requirements apply to this destination?

### Evidence

What supports each claim?

### Limitations

What isn't known?

### Verification

What has independently been checked?

### History

Who supplied it?

When?

What changed?

### Prior reliance

Has another institution already relied upon this evidence?

That is where governed evidence becomes commercially meaningful.

---

# 14. PFI Step 3 — query rather than restart

This is another important demonstration.

The PFI says:

> “I need the last six months of sales evidence.”

Instead of sending an email:

> “Please submit your documents again.”

Symphony records the request.

The SME uploads it.

The PFI receives the update.

The existing record changes state.

That is **continuity of evidence**.

---

# 15. PFI Step 4 — decide

Symphony must then stop.

The PFI decides:

> Admit
> Query
> Reject
> Proceed to verification
> Approve / decline

**Symphony does not decide creditworthiness.**

This is important because it makes the architecture credible to a real financial institution.

---

# 16. PFI Step 5 — post-decision continuity

This is where your earlier challenge to my criticism is correct.

Governed evidence absolutely has potential value **after the financing decision**.

Imagine:

> Loan approved.

The PFI then uses Symphony to monitor:

* enterprise status
* project status
* agreed milestones
* governance events
* evidence updates
* exceptions
* verification findings
* impact indicators
* covenant/supporting evidence

Now the same enterprise record that helped the PFI assess the borrower becomes the **portfolio monitoring record**.

That is not cosmetic.

It means the PFI doesn't have:

> Application system → separate monitoring spreadsheet → separate impact-reporting process → separate verification files.

The governed enterprise/project state persists.

That is one of the stronger long-term arguments for Symphony.

---

# 17. VVB Portal — **Verify the specific thing that matters**

The VVB journey should be deliberately narrow.

A verifier shouldn't have to understand the entire enterprise.

They receive an assignment:

> **Verify claim X**

For example:

> “The cooperative has 143 active members.”

or:

> “The solar irrigation project has been installed at location X.”

or:

> “The reported production activity occurred during period Y.”

The VVB sees:

### Claim

What exactly am I verifying?

### Basis

What evidence already exists?

### Scope

What am I being asked to verify?

### Assignment

Who requested it?

### Findings

Verified / partially verified / unable to verify / contradicted.

### Evidence

What did the verifier inspect?

### Finding

What is the conclusion?

That finding becomes part of the governed record.

---

# 18. VVB — verification should change the enterprise state

This is important.

Verification should not simply generate:

> “PDF certificate.”

It changes the evidence state.

For example:

> ASSERTED
> ↓
> SUPPORTED
> ↓
> VERIFIED

Or:

> SUPPORTED
> ↓
> EXCEPTION

Then the PFI, NABII, SBGI and portfolio manager all see the **same resulting state** according to their permissions and destination.

That is the architectural payoff of having a governed evidence layer.

---

# 19. Portfolio Manager — **The missing major journey**

I agree with your criticism here.

Portfolio management is not an afterthought.

It is potentially one of the strongest commercial applications because the portfolio can belong to:

* a bank
* NABII
* SBGI
* NGO
* impact investor
* fund manager
* development programme
* guarantee programme
* Symphony itself

The journey is:

> **Portfolio acquisition → baseline → monitor → exception → intervention → verification → outcome → reporting**

---

# 20. Portfolio Manager Step 1 — acquire portfolio

The manager sees:

> **My portfolio: 200 enterprises**

Not just 200 names.

They have governed states.

They can see:

| Dimension    | View          |
| ------------ | ------------- |
| Enterprise   | Current state |
| Project      | Current state |
| Readiness    | Current state |
| Evidence     | Current state |
| Verification | Current state |
| Intervention | Current state |
| Financing    | Current state |
| Impact       | Current state |

---

# 21. Portfolio Manager Step 2 — detect exceptions

Instead of manually discovering problems, the portfolio view highlights:

> 14 enterprises have stale evidence
> 8 have unresolved governance exceptions
> 6 projects have verification findings
> 11 have missed milestones
> 4 require intervention

Then the manager drills down.

That is a very strong demonstration of why **governed evidence has value after financing**.

The value isn't merely:

> “We stored documents.”

It is:

> **“The portfolio's institutional state is continuously observable.”**

---

# 22. Portfolio Manager Step 3 — intervention

The manager assigns:

> TA
> Verification
> Governance remediation
> Site visit
> Financial review

Then watches the state change.

This gives Symphony a closed loop:

**Evidence → assessment → intervention → verification → monitoring → new evidence.**

---

# 23. Portfolio Manager Step 4 — impact reporting

Finally:

> 200 enterprises
> 137 assessment-ready
> 82 financed
> 64 active projects
> 51 verified projects
> 17 requiring intervention

And the underlying claims can be traced back to evidence.

This is potentially extremely attractive to impact investors and development programmes because they don't merely receive a narrative report.

They have an **auditable portfolio state**.

---

# 24. SME Readiness Marketplace — **the emergent network**

I would make this explicit in the prototype.

This is not necessarily a separate portal initially.

It is a **discovery mode** available to institutions looking for enterprises.

Imagine:

### Investor

> I am looking for:
>
> * agriculture
> * Zambia
> * green infrastructure
> * ZMW 2–10m
> * growth-stage
> * verified governance
> * project evidence available

Symphony returns:

> **18 matching enterprises**

Then the investor opens one.

They don't receive an empty application form.

They receive the enterprise's **current governed readiness state**.

---

# 25. And the really interesting case: the “bad” SME

Your example is important.

An SME may currently be:

> financially weak.

That doesn't mean:

> commercially irrelevant.

A VC might care about:

* location
* distribution network
* customer base
* land access
* production capability
* strategic assets
* management team
* technology
* market position
* project potential

Therefore the same enterprise can be:

> **Not suitable for Bank A**

but:

> **Potentially interesting to Investor B.**

The platform shouldn't hide the negative information.

It should make the **whole governed state discoverable**.

That is much more interesting than a simple “loan marketplace.”

It becomes an:

> **SME opportunity/readiness marketplace.**

---

# 26. The complete Symphony story

If I were designing the prototype demonstration now, I would make the whole thing tell this story:

```text
                     NABII
                       │
                       ▼
              FIND / RECRUIT SMEs
                       │
                       ▼
             ┌─────────────────┐
             │ SME REGISTRATION │
             └────────┬────────┘
                      │
                WORKSHOP
              50 SMEs / day
                      │
                      ▼
             INITIAL ENTERPRISE
                   STATE
                      │
                      ▼
              SELF-SERVICE + TA
                      │
                      ▼
              EVIDENCE ASSEMBLY
                      │
                      ▼
              GAP IDENTIFICATION
                      │
              ┌───────┴────────┐
              ▼                ▼
           TA/AGENT          VVB
              │                │
              └───────┬────────┘
                      ▼
               READINESS STATE
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
       PFI A       PFI B       INVESTOR C
          │           │            │
          ▼           ▼            ▼
       ASSESS       ASSESS       DISCOVER
          │
          ▼
       DECISION
          │
          ▼
       FINANCED
          │
          ▼
   PORTFOLIO MANAGEMENT
          │
     ┌────┼────────┐
     ▼    ▼        ▼
  MONITOR VERIFY  INTERVENE
     │    │        │
     └────┴────────┘
          │
          ▼
       NEW STATE
          │
          ▼
   DISCOVERABLE AGAIN
          │
     ┌────┼─────────────┐
     ▼    ▼             ▼
   BANK INVESTOR     PROGRAMME
```

That is the **continuity thesis**.

The SME doesn't disappear when one transaction ends.

---

# 27. What each stakeholder should experience as its “Aha”

I would actually design the demo around these moments.

### **NABII**

> “We can turn a programme into a measurable, continuously discoverable investment pipeline.”

### **SME**

> “I don't have to repeatedly start from zero every time I approach another institution.”

### **SBGI**

> “We can see exactly where TA can make enterprises more financeable and whether the intervention actually closed the gap.”

### **PFI**

> “I can discover enterprises that I would otherwise never see, inspect the evidence behind them, ask for what is missing, and make my own decision.”

### **VVB**

> “I know exactly what I am being asked to verify, and my finding becomes part of the institutional record.”

### **Portfolio Manager**

> “I can see the actual state of my portfolio rather than reconstructing it from spreadsheets, reports and disconnected documents.”

### **Investor / Marketplace participant**

> “I can search a live population of enterprises against what I am looking for rather than waiting for somebody to send me a deal.”

---

# 28. The most important change to the prototype story

I would therefore **not** organize the demonstration as:

> SME Portal → NABII Portal → PFI Portal → VVB Portal

as though they were independent products.

I'd organize it as **one enterprise travelling through the Symphony ecosystem**, with each portal revealing what that stakeholder needs to see.

The central demonstration becomes:

> **One SME. One governed state. Multiple institutional uses.**

Start with an SME that is poorly evidenced.

Then:

**NABII finds it → workshop registers it → SME builds its record → TA closes gaps → VVB verifies selected claims → SME becomes assessment-ready → PFI discovers it → PFI assesses it → PFI decides → portfolio manager monitors it → another institution later discovers the same enterprise for a different opportunity.**

That is considerably stronger than showing a collection of dashboards.

And it directly answers the issue you raised: **the value of Symphony is not exhausted when the first PFI says yes or no.** The enterprise's governed state becomes persistent institutional infrastructure, which is what creates continuity, discoverability and eventually the conditions for a real SME readiness marketplace.

## End Prototype section

## Greencode Hackathon self-introduction
https://www.garage48.org/events/greencodezambia
Hello everyone,
Much has been said about SMEs and finance, but the problem can be broken down to just three things: Exposure, Continuity, and Discovery.
First, Exposure. When a Zambian SME needs capital, they have zero visibility. They knock on the door of one commercial bank. If that bank says no—just like what happened to 90% of small businesses during the 2020 stimulus fund—that transaction dies right there.
Second, Continuity. In our current financial ecosystem, there is no memory. When that SME is rejected, they are completely deleted from the process. If they want to try another lender or a developmental program, they have to start back at absolute zero, rebuilding their paperwork and proof from scratch.
Third, Discovery. On the other side, lenders and impact funds are actively hunting for investable businesses, but they are blind. They cannot find or verify the economically real enterprises hidden across our informal economy.
Symphony solves all three. We have built a persistent, governed readiness engine that transforms how capital finds small businesses. Instead of a single-use application, Symphony maintains an auditable enterprise state that maps an SME's data against multiple capital destinations simultaneously.

### What goes here (unfinished speech section)


So remember, Investor readiness is not about finance, not about your product and not even about your skill. It is about expressing your potential, gaining exposure, and knowing you will find the right fit only if you persist.

## End draft speech




In line with the wishes of the sponsors, what I present is a highly ambitious project. Bear with me as I take you through the various user journeys as quickly as I can in the time allotted.

If there is one thing to remember about Symphony it is this.
We don't design projects, we don't advise compliance or business practice. And hear me out, we don't do AI yet.
All Symphony does is one thing, and one thing alone - we capture data, prove its provenance, establish its lineage and chain of custody and provide it to the apporpriate downstream users in the most original state with all governance decisions and end states encapsulated around it.
This is what we call a claim. Everything has to be a provable claim.

The rest are all expansion and scale options that can be explored once we are up and running. Right now Zambia needs a platform it can rely on. Where anyone, from the most impoverished rural farmer to the largest mining conglomerate can utilize for not just impact assessment at its most granular level, but also Supply Chain management in cross-border trading.


1. There is an opportunity here to leverage the enrollment process into a never-ending data collection enterprise so that institutions like Vitalite, Lupiya, etc can use the information. See how the memebership registrations process I propose can highlight this revenue source.
2.Look at the numbers. Lima Links had increased access from 37,000 in 2018 to 175,000 at time of the article.
Now imagine we figures. Zambia has over 150,000 cooperatives. That is the TAM. Lets say we register 10% of those which is 15,000+. Each cooperative has minimum 10 members so we will have data for 150,000 individual farmers or people from just encouraging full registration of members. And the good thing is that unlike lima links, we get them onboard the platform almost free though TA assistance and also following up with Cooperatives to thoroughly do their registration. 
3. I need to gather possible complimentary or competing platforms
4. Start deciding what are bellweather tests for the market and what to use as a weathervane to show trends
5. Instead of following up on individual farmeers, we provide a Hub and Spock approach where institutions get access to thousands of farmers through cooperative hubs. These can be clustered or fragmented depending on granularity required.
6. Analytics can be applied through the data
The sticky point is how to motivate cooperatives to carry out the drive on a consistent level. This is why I insist that every registration should have a default evidence collection/verifier role. The most cost effective way is to approach the local chief and with a tribute payment of K5,000, he could send order to all cooperatives in his chiefdom for them to update the records everytime they have cooperative community work would be one way. All he needs is the phone numbers of the verifiers. They would then carry out quick surveys. Later we could integrate something like Lima Links mssd short message.

https://cgspace.cgiar.org/server/api/core/bitstreams/6ea0009e-909f-4ae0-a182-bd590b07c9bd/content

