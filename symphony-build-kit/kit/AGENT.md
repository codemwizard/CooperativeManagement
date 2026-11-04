# AGENT.md: Symphony Interactive Prototype

You are building an interactive, demo-grade prototype of Symphony, a governed-state and evidence infrastructure. It is shown to a programme facilitator (NABII) and to banks. It is **not** a production system, has no real backend, and uses only fictional data.

Read this file fully before writing any code. Then work through the phases in order. **Stop at the end of each phase, run its gate, and report.** Do not start the next phase until the gate passes.

---

## 1. What the prototype must prove

One real-world cooperative can move from "economically real but poorly evidenced" to "assessable by a lender", and the same governed state then carries forward into decisioning, monitoring and portfolio views. The point is the **infrastructure**: governed state, evidence and traceability. It is not an SME onboarding form app.

The prototype must make visible, through use rather than explanation:
1. Readiness is **computed** from state plus a destination's requirements, never typed in.
2. The same state projected to different destinations gives different results.
3. Every state shows its basis: evidence, who, when, limitation, history.
4. Nobody verifies their own evidence.
5. The lender decides. Symphony never does.

## 2. Hard rules (invariants)

These come from `data/meta.json`. Violating any is a bug, not a trade-off.

- **I1** No self-verification.
- **I2** Supersede, never overwrite. Every change appends to history.
- **I3** Every state shows its basis and a limitation.
- **I4** Readiness is computed.
- **I5** Symphony records outcomes and findings made by others. It never makes them.
- **I6** No Arrangement object is built. The financing relationship is represented only by `financing`, `presentation` and outcome records.
- **I7** Every screen shows a boundary label from `meta.boundary_labels`.

Further rules:
- **No real lender names anywhere.** Lenders are "Lender A" and "Lender B". The programme is "NABII Programme Pipeline". "NABII" is the only real organisation name allowed. Test X2 scans for forbidden terms.
- **All names, figures and products are fictional.** Show an "Illustrative products." footer on the requirements screen.
- **Do not invent requirements, thresholds or seed values.** The data files are the source of truth. If something is missing or contradictory, stop and report it (see section 9).
- **No cooperative-facing fees or pricing on any screen.**

## 3. Files you are given

```
AGENT.md                     this file
data/meta.json                demo date, vocabulary, labels, invariants, mandatory limitation text
data/destinations.json        Lender A, Lender B, NABII Programme Pipeline: requirements, rules, covenants
data/cases.json               nine fictional cooperatives with evidence, projects, financing, presentation
data/roles.json               roles, action permissions, constraints
data/extension.json           post-financing teaser, static verification screen content
data/forbidden_terms.json     names that must never appear
tests/TEST_CASES.md           T1-T8, D1, X1-X3, reset test (written test cases)
tests/expected-results.json   expected readiness for every case x destination, and monitoring states
tools/reference_oracle.py     independent reference implementation used to cross-check data. NOT the app engine.
```

Run `python3 tools/reference_oracle.py` first. It must print `OK`. If it does not, stop and report.

## 4. Suggested stack

You may change this if you have a good reason, but state it in your Phase 1 report.

- TypeScript, React, Vite. Static output, no server.
- Vitest for engine tests. Playwright for UI tests.
- State in memory, persisted to `localStorage` so a refresh keeps the demo state. A visible **Reset demo** control restores `data/` fixtures.
- Deploy as a static site to Vercel.
- Layout: `src/engine/` (pure TypeScript, no React, no DOM), `src/data/` (imports of the JSON files, unmodified), `src/ui/`, `src/tours/`, `tests/`.

The engine must be a pure module so it can be tested without a browser.

## 5. Engine specification

### 5.1 Evidence levels and overlays
Order: `none < asserted < supported < verified`. Overlays: `disputed`, `stale`.
- An item is **stale** when `valid_until` exists and `demo_date > valid_until`.
- An item is **disputed** when it carries `disputed = true`.
- The demo date comes from `meta.demo_date` and must be a single injectable value, never `new Date()` in engine code.

### 5.2 Requirement evaluation
For each requirement in a destination:
1. **Applicability.** If `applies_when` exists, compare the project field to `equals`. If not applicable, state = `not_applicable`, reason = the requirement's `why`.
2. **Rule kinds.**
   - `evidence`: item for `evidence_type`. If stale or disputed, state = `exception`. Else if level >= `min_level`, `satisfied`, otherwise `unresolved` (including when no item exists).
   - `evidence_count`: as `evidence`, and additionally the item's `count_field` (for example `seasons`) must be >= `min_count`.
   - `assessment_time`: state = `assessment_time` always. If an item exists, set `provided_early = true` and report its effective level. It never becomes `unresolved` or `exception`.
   - `fit`: compares `project.request` to the rule. It takes no evidence. `single_request` needs `structure = single`, amount within range, term within `max_term_months`. `per_group_request` needs `structure = per_group`, `amount_per_group` within range, term within range. Fit checks close only by restructuring the request.
3. Every result carries: `id`, `title`, `state`, `evidence_ref` (evidence type or null), `effective_level` (including `stale` or `disputed`), `min_level`, `provided_early`, `reason`.

### 5.3 Readiness
`ready = (no unresolved) and (no exception)`. Not applicable and assessment-time requirements never block.
The summary returns: `ready`, `unresolved[]`, `exceptions[]`, `not_applicable[]`, `assessment_time[]`, `satisfied` (count), `total`.

### 5.4 Assessment state
`in_progress` (default), `ready` (computed), `presented` (after present action), `under_assessment` (lender has opened it). Presented cases are **snapshots**: later changes do not alter what was presented. Keep both the snapshot and the live state.

### 5.5 Monitoring state
For financed cases, per covenant not received: `overdue` if due date is before the demo date; `due` if due within `monitoring_due_window_days`; otherwise `current`. A received covenant is never due or overdue. Case state is the worst covenant. Implement as a pure function.

### 5.6 Actions
Defined in `data/roles.json`. Every action takes `(caseState, action, actor)` and returns either `{ ok: true, caseState, event }` or `{ ok: false, code, rule }`. Never mutate the input.
- Check role permission first (`ROLE_NOT_PERMITTED`, or `READ_ONLY_ROLE` for lender, TA and verifier roles acting on SME evidence).
- Then the constraints: `SELF_VERIFICATION`, `SELF_CONFIRMATION`, `SIGNOFF_REQUIRED`.
- Changing an evidence item pushes the previous record onto its `history` before replacing it.
- Every successful action appends an event: `{ id, at, actor, action, target, before, after }`.
- Required actions: `add_evidence`, `upload_minutes`, `signoff_minutes`, `mark_verified`, `restructure_request`, `record_payment`, `confirm_payment`, `present_to_destination`, `request_evidence`, `raise_finding`, `record_outcome`.
- `record_outcome` is only available to `pfi_credit` and must be a deliberate user choice. Never pre-select an outcome.

### 5.7 Derived metrics
Provide pure functions for: gaps closed per case (events that moved a requirement from unresolved to satisfied), portfolio totals (financed count, exposure sum, monitoring distribution), and pipeline sort keys (readiness per destination, province, district, programme).

## 6. Phases

Each phase ends with: gate run, short report (what was built, test results, deviations, open questions), then **wait**.

### Phase 1: Engine, data loading, tests
Build `src/engine/` per section 5. Import the JSON data unmodified.
Implement tests T1-T7, T8a, D1, X1 in Vitest from `tests/TEST_CASES.md`, plus a test that evaluates all 27 case-destination pairs against `tests/expected-results.json`.
**Gate:** all of those pass. Report any place where the written test and the data disagree. Do not edit the data or the tests to make them pass.

### Phase 2: Shared components and design system
Build the reusable primitives with Storybook-style demo page or a `/components` route:
- **Governed Metric Card:** title, state badge, one-line value, evidence summary, verified by and date, limitation, and buttons History, Evidence, Raise issue.
- **Requirement Card:** requirement, destination, applicability (with reason when excluded), state, evidence, limitation, action.
- **Requirement chain:** Requirement, Applicability, Evidence, Verification, Finding, State. Make the chain visible as steps.
- **Evidence drawer:** type, supplied by and on, verified by and on (or "Not verified"), limitation, history list.
- **"How was this established?"** interaction that opens the chain and then the evidence drawer.
- **State Transition card:** previous state, action, evidence, verification, new state.
- **Destination switcher:** Lender A, Lender B, NABII Programme Pipeline.
- **Role switcher:** all roles from `roles.json`. Buttons not permitted for the active role are visibly disabled with the rule as a tooltip.
- **Boundary label** component.
- State badges for evidence levels, requirement states, monitoring states. Never colour alone: include text.
**Gate:** one component renders correctly for each state in the vocabulary; T8b's "two clicks to evidence" holds on the demo page.

### Phase 3: SME hero path (stages 1-9, label: Beachhead)
Screens:
1. **Login and role entry.** Email or phone plus PIN field (not validated), plus the demo role selector. Choosing SME roles lets the user pick a cooperative.
2. **Enrollment** (first login for a new organisation): create organisation, assign officers (Asserted until accepted), create project, short self-assessment seeding Asserted cards. State clearly on screen: *No bank. No programme. No loan required.* Enrolling a new cooperative may be simulated with a prefilled form.
3. **SME dashboard.** KPIs: readiness per destination, requirements by evidence tier (stacked bar), open gaps, days to next expiry. Alert panel. Each alert opens an **Issue page** (what is wrong, requirement affected, owner, evidence needed, button to resolve).
4. **Menu:** Home, Organization State (Legal, Governance, Membership, Finance), Project State (Activity, Assets, Production, Environmental), Requirements, Evidence Library, Profile.
5. **Current state** screens with one Governed Metric Card per section, using the seeded evidence.
6. **Requirements screen** for the selected destination, with the footer "Illustrative products."
7. **Gap and remediation panel** with the State Transition card. The hero journey (T2) must be executable end to end through the UI, with the readiness badge changing as the engine recomputes.
8. **Assessment readiness** and **Readiness basis** ("Why?"), ending with the text: *Assessment Ready does not constitute financing approval.*
9. **Destination projection and Present.** Switch destinations on unchanged state. Show the line: *Same enterprise. Same project. Different requirement context.* Present creates the destination-scoped snapshot.
Include the **Restructure request** action (T6) and **Add early off-take evidence** action (T4), with their results visible.
**Gate:** T1, T2, T4, T5, T6, T7 reproduced through the UI by Playwright. Reset returns to baseline (reset test).

### Phase 4: Lender workspace and outcome (stage 10, label: Same state, extended)
- Received case: organisation, project, requirements, evidence, findings, limitations, history, all from the presented snapshot.
- Lender can: accept or reject evidence, request more evidence (creates a request visible to the SME), add their own finding, and choose an outcome: approved, declined, deferred, or more evidence requested.
- Use `case-8` as the seeded example of "more evidence requested" and show the SME-side response.
- Show the line: *Symphony established the state. The lender makes the decision.*
**Gate:** an outcome cannot be recorded without an explicit choice; the SME view shows the lender's request; no engine path sets an outcome automatically.

### Phase 5: Post-disbursement (stages 11-12, label: Same state, extended)
- Facility summary with illustrative figures from `financing.facility`.
- Use of proceeds: planned versus evidenced, with the gap highlighted.
- Covenant list with monitoring state per covenant and for the case. `case-6` shows current. `case-7` shows overdue, with alert, owner and affected requirement, and the drill chain alert, issue, requirement, evidence.
- **Baseline vs current** for the hero case, from `data/extension.json`: metric, baseline, current, evidence, who established it, when.
**Gate:** X1 passes in the UI. The overdue exception traces to its evidence.

### Phase 6: Portfolio and static verification (stages 13-16, label: Same state, extended)
- **Portfolio dashboard** computed from `cases.json`: cooperatives, assessment-ready count per destination, financed count, exposure, monitoring distribution, open exceptions. Every number is clickable.
- Click path: number, then a filtered project list, then a project's requirement view (T8b second rule).
- **Static verification screen** from `data/extension.json`: claim, baseline, current, evidence list, finding, assurance chain. Label: *Same state, extended: illustrative. Not built.* Read-only, no interactive verification.
**Gate:** every portfolio number equals the engine's computation; no portfolio number is hardcoded.

### Phase 7: NABII pipeline view
- Table of all nine cooperatives: readiness state per destination, province, district, programme, gaps closed, baseline captured. Sortable and filterable by each.
- Click a row to open the same read-only SME view with the same cards. The technical-assistance role cannot edit evidence. It may edit only its verification queue entries (read-only for this prototype).
- **Programme view:** current, upcoming and expired programmes; drill into "Readiness Cohort 1" and show the cohort's readiness distribution and most common gaps (computed).
- Map toggle optional: if built, pins by readiness state.
**Gate:** the pipeline reads from the same engine and cards as the SME view.

### Phase 8: Tours, reset and interest capture
- **Guided tour mode** with two scripts, each a sequence of highlighted next clicks:
  - **Bank tour:** presented case, lender finding and outcome, bank-side view of remediation history, disbursement and proceeds, monitoring exception, portfolio, destination switch.
  - **NABII tour:** pipeline view, one mid-remediation cooperative, close a gap live, destination projection, environmental baseline, present and hand off, one extension screen.
- **Reset** button restoring fixtures and the demo date.
- **Interest-capture sheet** (a notes panel, not part of the demo UI): tally of screens revisited, tour chosen, free-text quotes, and the closing questions from the tour scripts. Export as JSON and CSV to the user's machine only. No network calls.
**Gate:** both tours run start to finish from reset without a console error.

### Phase 9: Hardening and deployment
- Run X2 (forbidden terms), X3 (boundary labels), the full Vitest and Playwright suites.
- Check on a laptop and a tablet and a phone width.
- Remove all test and debug content from the build. Confirm the production bundle does not include `tools/` or `tests/`.
- Deploy to Vercel. Report the URL and how to redeploy.
**Gate:** all tests green, deployment URL working from a clean browser.

## 7. UI principles

- **State, not documents.** Every screen shows a state with its basis. Avoid a plain file-list look.
- Evidence tiers use both colour and text: Asserted, Supported, Verified, Disputed, Stale.
- Readiness language: use "Assessment Ready", never "approved", "bankable", "creditworthy" or a score.
- Do not collapse the six state dimensions into one status.
- Minimal and legible. Prefer a few well-built components reused everywhere.

## 8. Working agreements

- Commit at the end of every phase with a message naming the phase and the gate result.
- Write tests before or with each feature. Never delete or weaken a test to pass a gate.
- Keep the engine free of UI and date-of-today dependencies.
- Prefer small, reviewable changes. Report deviations from this file plainly.
- Keep a `DECISIONS.md` listing every choice you made that this file left open.

## 9. When the spec is wrong or silent

Stop and report instead of guessing. Include: what you found, why the data or text conflicts, and two options. Examples that warrant stopping: a requirement whose rule kind is not in section 5.2; a seed case whose expected result cannot be reproduced; a role action not listed in `roles.json`.

Known judgement calls already made in the data (do not change without approval):
- N4 and N6 are modelled as evidence items (`project_definition`, `participation_profile`). `case-4` has `participation_profile` at `asserted`, so N6 is unresolved for it.
- `case-9` has A11 unresolved, because a per-group request is not a single-facility request.
- Expected results in `tests/expected-results.json` are computed at `demo_date = 2026-10-06`.

## 10. Definition of done

- All gates passed and reported.
- Both tours run from reset.
- Deployed on Vercel.
- X2 passes: no real lender names anywhere.
- A one-page `README.md` explains how to run, test, reset and redeploy.
