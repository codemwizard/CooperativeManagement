# Symphony Prototype: Functional Spec Update v1.1

**Audience:** the AI agent that maintains `SYMPHONY-EXEC-PLAN` and builds the prototype.
**Purpose:** add five functions to the prototype and replace invented figures in the NABII views with computed ones. Update the implementation plan from this document. Do not add anything not listed here.

## 0. How to use this document

1. Read sections 1 to 3 first. They set scope, precedence and rules.
2. Update the implementation plan using section 11, which lists the changes phase by phase.
3. Add the new data files and data changes in section 8, then the engine changes in section 9.
4. Implement the tests in section 12 before the features they test.
5. Where this document and the existing plan conflict, **this document wins**. Where this document is silent, the existing plan, AGENT.md and the data files apply.
6. Do not change any existing value in `data/cases.json` or `tests/expected-results.json`. All new behaviour must leave the 27 baseline results unchanged.

New files delivered with this document:
`interventions.json`, `verification_seed.json`, `expected-pipeline.json`, a revised `capture_event_schema.json` (28 event types, 20 screens), and updated `meta.json` and `roles.json`. Place them as listed in section 8. The companion `UI_HELP_SPEC_V1.md` adds tooltips and popovers (see section 15).

## 1. Scope

| ID | Function | Priority |
|---|---|---|
| FR-1 | Evidence disputes: raise, show, resolve, withdraw | Must |
| FR-2 | Verifier workspace: assignments, findings, reliance | Must (reliance: Should) |
| FR-3 | Pipeline, cohort and intervention views computed from engine state | Must |
| FR-4 | Role-scoped views: TA sees its cohort, fund manager sees all | Should |
| FR-5 | Readiness record export: JSON, CSV, print view | Should (print view: Could) |

**Explicitly out of scope.** The agent must not build any of these, even if a reader might expect them:
- Any numeric readiness score, rating, or mapping to an institution's rating dimensions.
- Any integration with, or format specific to, an external system. Do not create an API, endpoints or webhooks, and do not claim one exists.
- Intervention assignment workflows, service-provider performance tracking, or fee or pricing screens.
- Authentication beyond the demo role switcher.
- Any figure that is not computed from `cases.json`, `extension.json`, `verification_seed.json` or live engine state.

## 2. Inherited rules (unchanged, restated because they constrain this work)

- Invariants I1 to I7 in `data/meta.json`. In particular: I2 supersede never overwrite; I5 Symphony records findings and outcomes made by others and never makes them.
- Real lender names must never appear in the UI, data, exports or bundle. Use "Lender A", "Lender B", "NABII Programme Pipeline". The current plan text contains a real lender name in the lender workspace header and the assurance chain. Replace it. NABII may be named.
- Every screen carries a boundary label. Add one label key, defined in section 8.1, for the interactive verification screens.
- The engine is a pure module. The demo date is injected. Capture code never changes engine state.
- Never show "approved", "bankable", "creditworthy" or any score as a Symphony output.

## 3. Glossary additions

- **Dispute:** a recorded objection to an evidence item, raised by a permitted role. It is separate from the evidence item.
- **Assignment:** a request that a named verifier review a target (a claim or an evidence item).
- **Finding:** a verifier's recorded result for an assignment.
- **Reliance:** a lender's recorded decision to rely, or not rely, on a finding for its own purposes. It is not an approval.

---

## 4. FR-1 Evidence disputes

### 4.1 Behaviour
1. A permitted user raises a dispute against one evidence item of a case, giving a reason code and a short note.
2. While any dispute against an evidence type is `open`, that evidence's effective state is `disputed`. Every requirement that uses that evidence type becomes `exception`. The case is not ready for any destination that uses it.
3. The dispute is visible on the requirement card, the evidence drawer, the lender workspace, the SME issue page, and in exports.
4. A dispute ends in exactly one of two ways:
   - **Resolved** by independent re-verification (4.4).
   - **Withdrawn** by the user who raised it.
5. Uploading new evidence does **not** close a dispute. The SME cannot dismiss a dispute by re-uploading. The new record supersedes the old one (history is kept) and awaits re-verification.
6. A presented snapshot never changes. Disputes raised after presentation appear in the live record and in a banner in the lender workspace labelled "Raised after presentation".

### 4.2 Data
Add `disputes: []` to every case state. Shape:

```
{
  "id": "dsp-<n>",
  "evidence_type": "<evidence type>",
  "raised_by": "<user_id>",
  "raised_role": "<role>",
  "raised_on": "<engine clock ISO timestamp>",
  "reason_code": "contradicted_by_other_evidence | verifier_concern | document_not_authentic | out_of_date | other",
  "note": "<1-200 characters, required>",
  "status": "open | resolved | withdrawn",
  "resolution": null | { "method": "independent_reverification | withdrawn", "by": "<user_id>", "on": "<timestamp>", "note": "<optional, up to 200 characters>" }
}
```

The existing `item.disputed` boolean is removed. Effective state is derived: an evidence item is disputed when an `open` dispute exists for its evidence type. Precedence of overlays: `disputed`, then `stale`, then the level.

### 4.3 Actions and constraints

| Action | Roles | Effect | Constraint codes |
|---|---|---|---|
| `raise_dispute` | `pfi_analyst`, `pfi_credit`, `verifier`, `ta`, `field_agent` | Appends an open dispute | `ROLE_NOT_PERMITTED`, `DISPUTE_REASON_REQUIRED` (reason code and note), `NO_SUCH_EVIDENCE`, `DISPUTE_ALREADY_OPEN` (one open dispute per evidence type), `SELF_DISPUTE` (raiser equals supplier of the evidence) |
| `resolve_dispute` | `field_agent` | Independent re-verification: marks the current evidence record Verified by the resolver, closes the dispute | `ROLE_NOT_PERMITTED`, `SELF_VERIFICATION` (resolver supplied the evidence), `SAME_VERIFIER` (resolver is the previous verifier of that evidence), `NO_OPEN_DISPUTE` |
| `withdraw_dispute` | any role that can raise | Closes the dispute as withdrawn | `NOT_DISPUTE_RAISER`, `NO_OPEN_DISPUTE` |

Rules:
- SME roles (`secretary`, `treasurer`, `chairman`, `member`) cannot raise, resolve or withdraw disputes.
- `resolve_dispute` pushes the previous evidence record to `history` (invariant I2) and appends an event.
- Update the `READ_ONLY_ROLE` rule text in `data/roles.json` to: "Lender, TA, fund manager and verifier roles cannot modify evidence items. Disputes, assignments, findings, reliance and requests are separate records."

### 4.4 UI
- **Dispute panel** in the evidence drawer: raise form (reason select, note field), open-dispute detail, history of disputes for that evidence.
- **Dispute banner** on a requirement card in `exception` caused by a dispute: "Disputed by <role> on <date>: <reason>".
- **SME dashboard alert** "Evidence disputed (n)" opens an issue page: what is disputed, who raised it, what is needed (independent field re-verification), owner role field agent.
- **Role-gated buttons** use the existing pattern: visible, disabled for roles without permission, with the rule as tooltip.
- Demo path (no seed change): as `pfi_credit`, raise a dispute on `case-8` `income_records`. Lender A turns not ready with exception `A7`. As `fa.mulenga`, resolve it. Lender A returns to ready.

## 5. FR-2 Verifier workspace

### 5.1 Behaviour
1. A verifier logs in through the login screen's persona selector and sees a profile card: name, organisation, kind (`institution_staff` or `independent`), scope. This shows that an institution's existing verification staff can be given the role.
2. The verifier's queue lists assignments addressed to them, with case, target, scope and status.
3. Opening an assignment shows the workbench: the target, baseline and current values (for claims), the evidence list, limitations, and any existing disputes.
4. The verifier records a finding. The assignment becomes `completed`.
5. A recorded finding **never changes an evidence item or a claim's evidence**. If the verifier wants to challenge evidence, they use `raise_dispute` separately (invariant I5).
6. A lender may record reliance on a finding.

### 5.2 Data
Load `verification_seed.json` into the app. Per-case state gains:

```
verification: {
  "assignments": [ { id, case_id, target:{kind:"claim"|"evidence", ref}, scope, assigned_to, assigned_by, assigned_on|scenario_date, status:"assigned|completed", scenario? } ],
  "findings":    [ { id, assignment_id, result:"verified|partially_verified|not_verified|unable_to_determine", scope, basis:[<evidence refs>], limitation, verifier, recorded_on } ],
  "reliance":    [ { id, finding_id, relying_role, relying_user, reliance:"relied|not_relied", note?, recorded_on } ]
}
```

Claims live in `verification_seed.json` under `claims` and replace the single claim in `extension.json` `static_verification`. Remove the pre-seeded finding from `extension.json`. The interactive flow produces it. Suggested demo finding values are in `verification_seed.json` under `suggested_demo_finding`.

Records marked `scenario: "extended"` belong to the labelled extended scenario. Never compare their `scenario_date` with `meta.demo_date`.

Update `meta.verification_states` to: `not_requested`, `pending`, `verified`, `partially_verified`, `not_verified`, `unable_to_determine`. A claim or evidence target with no assignment is `not_requested`, with an assigned assignment is `pending`, and with a completed one takes the finding result.

### 5.3 Actions and constraints

| Action | Roles | Constraint codes |
|---|---|---|
| `assign_verification` | `pfi_credit`, `pfi_analyst`, `ta` | `ROLE_NOT_PERMITTED`, `NO_SUCH_TARGET`, `NO_SUCH_VERIFIER` (assignee must be a verifier user) |
| `record_verification_finding` | `verifier` | `ROLE_NOT_PERMITTED`, `NOT_ASSIGNEE` (actor is not the assignee), `ASSIGNMENT_COMPLETED`, `FINDING_FIELDS_REQUIRED` (result, scope, limitation all required, non-empty), `SELF_VERIFICATION` (verifier supplied the target evidence) |
| `record_reliance` | `pfi_credit` | `ROLE_NOT_PERMITTED`, `NO_FINDING`, `RELIANCE_ALREADY_RECORDED` (one per finding per user) |

Reliance is recorded as the lender's own decision. It must never be pre-selected, and its UI text must not use "approved".

### 5.4 UI
- Login: add the persona "Verifier" and a selector for `vrf.mulenga` and `vrf.sakala`.
- New screens: `verifier_queue` and `verifier_workbench`. The assurance chain on the claim view reads **Claim → Evidence → Verification finding → Lender reliance → Portfolio reporting**, each node showing its state computed from the records. Nodes with no record show "Not yet recorded".
- The lender workspace gets an "Assign verification" control on any evidence item, and shows findings and reliance beside the evidence.
- Boundary label for the claim, queue and workbench: `extended_demonstrated` (section 8.1).
- Demo paths: (a) as `pfi_credit`, view `asg-1` (case-8 income records), switch to `vrf.mulenga`, open it, record a finding, and observe that the evidence level does not change; (b) the claim path using `asg-2`.

## 6. FR-3 Computed pipeline, cohort and intervention views

These replace the hard-coded content in the plan's `PipelineConversionView`, `CohortOperatingView` and the TA tracker. **No figure on these screens may be typed in.** Remove the 100 to 7 funnel, the 6/10 to 9/10 category matrix, and the 17/11/4/2 workload counts.

Reference values at baseline are in `tests/expected-pipeline.json`. The engine's output must match them exactly.

### 6.1 Funnel
Stages are cumulative counts of cases. A case counts at a stage if the condition holds. Stage order is fixed:

| Stage | Condition | Baseline count |
|---|---|---|
| Enrolled | any case | 9 |
| Ready (programme) | readiness for destination N is true | 7 |
| Ready for a lender | readiness for A or B is true | 5 |
| Presented | `presentation != null` or `financing != null` | 3 |
| Lender response recorded | `presentation.lender_response` exists, or `financing != null` | 3 |
| Financed | `financing.status == "financed"` | 2 |

Clicking a stage lists its cases. The list is computed, with each row linking to the case's read-only view.

### 6.2 Cohort view
For each programme cohort (`case.programme`) show the number of cases, the number programme-ready, and for each NABII requirement group (`legal`, `governance`, `membership`, `project`, `environment`, `inclusion`) the count of cases whose destination-N requirements in that group are all satisfied. Show **baseline** beside **current**:
- Baseline is the engine evaluation of the fixtures as loaded at start or reset. Keep the loaded fixtures as an immutable snapshot for this purpose.
- Current is the live state.
- Show the difference. Show "gaps closed" as the number of requirements that were `unresolved` or `exception` in the baseline and are `satisfied` now, per destination.

### 6.3 Intervention queue
Derived. For a selected destination, list every open requirement (state `unresolved` or `exception`) across the visible cases. Classify each using `interventions.json`:
- state `exception` is always class `blocked`;
- a `fit` rule is always class `restructure`;
- otherwise class is looked up by the rule's `evidence_type`.

Each row shows: case, requirement, class, owner role, action text, and a link to the requirement view. Show counts by class at the top. Baseline counts per destination are in `expected-pipeline.json`. The intervention classes and owner roles in `interventions.json` are proposed modelling choices, so keep them in the data file and never hard-code them.

### 6.4 Directory
The cooperative directory is filterable and sortable by province, district, programme, readiness per destination, and gaps closed. All columns are computed or come from `cases.json`.

## 7. FR-4 Role-scoped views and FR-5 Export

### 7.1 Scoped roles (FR-4)
Add roles `ta` (scoped) and `fund_manager` to `data/roles.json`, plus a `users` block:

```
"users": [
  { "user_id": "ta.officer1", "role": "ta", "cohorts": ["Readiness Cohort 1"] },
  { "user_id": "fm.officer1", "role": "fund_manager", "cohorts": "all" }
]
```

- A `ta` user sees pipeline, cohort, directory and intervention views only for cases whose `programme` is in their cohorts. Navigating directly to another cohort's case shows an "Outside your cohort" state and returns `ACCESS_DENIED_COHORT`. The engine must enforce this, not only the UI.
- A `fund_manager` user sees all cohorts and all cases, read-only.
- Both roles are read-only on evidence (`READ_ONLY_ROLE`). `ta` may use `assign_verification` and `raise_dispute`. `fund_manager` may do neither.
- Add action `view_cohort` for `ta` and `fund_manager`, and update `view_pipeline` to include both.

### 7.2 Readiness record export (FR-5)
Available from the lender workspace and the SME presented view, for the selected case and destination. Three formats:

- **JSON.** Object with: `export_version: 1`, `illustrative: true`, `boundary_statement` (the standard boundary sentence), `destination` (display name and product), `generated_from` (`presented_snapshot` or `live_state`), `case` (name, district, programme), `project`, `readiness` (summary from the engine), `requirements[]`, `disputes[]`, `findings[]`, `reliance[]`, and `limitations_summary`.
- **CSV.** One row per requirement. Exact columns: `requirement_id, title, state, applicability_reason, evidence_type, evidence_level, supplied_by, supplied_on, verified_by, verified_on, limitation, dispute_status, finding_result`.
- **Print view.** A print-optimised page with the same content and the boundary sentence in the header. Priority Could.

Rules:
- The export contains no score and no institution-specific mapping. Add the line "Export of the readiness record. Not mapped to any institution's system." to the export dialog and to the JSON `note` field.
- Never include internal fields: `notes`, `demo_role`.
- No real lender names appear in exports.
- Each export emits a `dossier_export` capture event.

---

## 8. Data and configuration changes

### 8.1 `data/meta.json`
- Add `boundary_labels.extended_demonstrated`: `"Same state, extended: illustrative data"`.
- Replace `verification_states` with the list in 5.2.
- Add `dispute_reason_codes` (list from 4.2) and `finding_results` (`verified`, `partially_verified`, `not_verified`, `unable_to_determine`).
- Add `invariants` entry: "I8 Findings, disputes and reliance are records. They never change evidence items."

### 8.2 `data/roles.json`
- Add roles `ta` (scoped) and `fund_manager`. Keep existing roles.
- Add actions: `raise_dispute`, `resolve_dispute`, `withdraw_dispute`, `assign_verification`, `record_verification_finding`, `record_reliance`, `export_dossier`, `view_cohort`. Permissions are in sections 4.3, 5.3 and 7.1. `export_dossier`: all roles that can view a case.
- Add constraint codes in 4.3, 5.3 and 7.1 with one-line rule text each. Reuse `SELF_VERIFICATION` and `ROLE_NOT_PERMITTED`.
- Add the `users` block in 7.1 and update `READ_ONLY_ROLE` text per 4.3.

### 8.3 Files
- `data/interventions.json` (delivered).
- `data/verification_seed.json` (delivered). Remove `static_verification.finding` from `data/extension.json`.
- `tests/expected-pipeline.json` (delivered).
- `data/capture_event_schema.json` (replace the earlier version).
- `data/cases.json`: **no value changes.** The loader adds `disputes: []` and `verification: {assignments: [], findings: [], reliance: []}` to each case in memory, then merges the seeded assignments by `case_id`.

### 8.4 Reference oracle
Update `tools/reference_oracle.py`: derive `disputed` from `case.disputes[]` instead of `item.disputed`; add the funnel, cohort and intervention computations; compare against `tests/expected-pipeline.json`. The oracle must still print OK for the 27 baseline results.

---

## 9. Engine changes (`src/engine/`)

- `types.ts`: add `Dispute`, `Assignment`, `Finding`, `Reliance`, `ClaimRecord`, `UserScope`, `Intervention`, and the new action names and codes.
- `evaluate.ts`: derive `disputed` from open disputes. No other change to evaluation. The 27 baseline results are unchanged.
- `actions.ts`: implement the actions in 4.3, 5.3 and 7.1 with the constraint order: role permission, then scope, then entity checks, then segregation checks. Every success appends an event and never mutates the input. Every failure returns `{ ok: false, code, rule }`.
- `pipeline.ts` (new): pure functions `funnel(cases, results)`, `cohortSummary(cases, results, baselineResults)`, `interventionQueue(cases, results, destinationId, scope)`, `gapsClosed(baselineResults, currentResults)`.
- `dossier.ts` (new): pure `buildDossier(case, destinationId, source)` and `dossierToCsv(dossier)`.
- `scope.ts` (new): `visibleCases(user, cases)`.
- Evaluation of the funnel and cohort uses injected results, never recomputes inside views.

## 10. UI changes

New or changed components. Every interactive element listed has the `data-testid` shown. Add these ids to `CAPTURE_TESTIDS`.

| Component | Test ids |
|---|---|
| `DisputePanel`, `DisputeBanner` | `raise-dispute-btn`, `dispute-reason-select`, `dispute-note-input`, `resolve-dispute-btn`, `withdraw-dispute-btn` |
| `AssignmentCard`, `VerifierQueueView` | `assign-verification-btn`, `verifier-queue-row-<assignment id>` |
| `VerifierWorkbenchView`, `FindingForm` | `finding-result-select`, `finding-scope-input`, `finding-limitation-input`, `finding-submit-btn` |
| `AssuranceChain` | `chain-node-<claim|evidence|finding|reliance|portfolio>` |
| `RelianceControl` | `relied-btn`, `not-relied-btn` |
| `ExportMenu` | `export-json-btn`, `export-csv-btn`, `export-print-btn` |
| `FunnelView` | `funnel-stage-<stage key>` |
| `InterventionQueue` | `intervention-row-<case>-<requirement>`, `intervention-class-filter` |
| `CohortView` | `cohort-row-<cohort key>` |

All new screens carry a boundary label. New screen ids: `verifier_queue`, `verifier_workbench`, `nabii_cohort`, and `claim_view` (replaces `static_verification`).

## 11. Changes to the implementation plan, phase by phase

- **Document header:** add this document and `UI_HELP_SPEC_V1.md` to the governing documents. Add an amendment note to the architecture freeze: the screens added are `verifier_queue`, `verifier_workbench` and `claim_view` (replacing `static_verification`), plus the components in section 10 and in the help spec.
- **Phase 1 (engine):** add `pipeline.ts`, `dossier.ts`, `scope.ts`; extend `actions.ts` and `types.ts`; update the oracle; add tests P1 to P5, V1 to V4, F1 to F4, R1 and R2, E1 and E2. The gate is: baseline 27/27 still passes, all new tests pass.
- **Phase 2 (components):** add `DisputePanel`, `DisputeBanner`, `AssignmentCard`, `FindingForm`, `AssuranceChain`, `RelianceControl`, `ExportMenu`. Extend `EvidenceDrawer` with disputes and findings. The two-click rule must hold with disputes present.
- **Phase 3 (SME):** add the dispute alert and issue page. No other change.
- **Phase 4 (lender workspace):** add raise dispute, assign verification, record reliance, export. Show disputes and findings. Remove the real lender name from the header text.
- **Phase 5 (monitoring):** unchanged, except that every figure must come from `cases.json` and `extension.json`. Use the extension data's use-of-proceeds items and each case's facility amount.
- **Phase 6 (portfolio and verification):** replace `StaticVerificationView` with the interactive claim view, the verifier queue and the workbench. Replace "Zanaco" in the assurance chain with the generic "Lender". Portfolio numbers remain computed. The portfolio click path is two clicks to a project's requirement view and a third to its evidence. Align the plan text with test T8b, which says the same.
- **Phase 7 (NABII):** replace the funnel, cohort and tracker content with sections 6.1 to 6.4. Add the scoped roles. Remove every invented number listed in section 6.
- **Phase 8 (tours and capture):** add steps to the tours (section 11.1). Update capture per the revised schema.
- **Phase 9:** run the full suite, including the new tests and X2.

### 11.1 Tour additions
- **Bank tour:** after the evidence admission table, raise a dispute on `case-8` `income_records`, show Lender A turning not ready, switch to `fa.mulenga` and resolve it. Then assign verification of the same evidence, switch to the verifier, open the queue, record a finding, return as the lender and record reliance. Finally, export the readiness record as CSV.
- **NABII tour:** after the funnel, open the intervention queue for destination N, filter by class, open one `blocked` item (case-3 registration). Switch to `ta.officer1` to show the scoped cohort view.

## 12. Tests

All use `demo_date = 2026-10-06`. Where a test says "baseline", start from fixtures. Add the tests to `tests/TEST_CASES.md`.

| ID | Level | Given / When | Then |
|---|---|---|---|
| **P1** | Engine | `case-8` baseline. `pfi_credit` runs `raise_dispute` on `income_records`, reason `verifier_concern`, a note | A: `ready=false`, `exceptions=[A7]`, `unresolved=[]`. N and B results unchanged from baseline. Evidence level and history unchanged |
| **P2** | Engine | Continue P1. `fa.mulenga` runs `resolve_dispute` | Dispute `status=resolved`, `method=independent_reverification`. `income_records.level=verified`, `verified_by=fa.mulenga`, history gained one entry. A: `ready=true` |
| **P3** | Engine | `case-6` baseline. `pfi_credit` raises a dispute on `registration`. Then `fa.banda` (the original verifier) tries `resolve_dispute` | Rejected `SAME_VERIFIER`. Then `fa.mulenga` resolves it. Accepted. A and N return to ready |
| **P4** | Engine | Constraint set: raise with empty note; raise on a non-existent evidence type; raise twice on one evidence type; supplier raising against own evidence; `secretary` raising; `treasurer` resolving; non-raiser withdrawing | Respectively `DISPUTE_REASON_REQUIRED`, `NO_SUCH_EVIDENCE`, `DISPUTE_ALREADY_OPEN`, `SELF_DISPUTE`, `ROLE_NOT_PERMITTED`, `ROLE_NOT_PERMITTED`, `NOT_DISPUTE_RAISER`. State unchanged in each |
| **P5** | Engine | `case-8` presented snapshot exists. Raise a dispute afterwards | Snapshot content equals the pre-dispute snapshot. Live state shows the dispute. The lender workspace banner reads "Raised after presentation" |
| **V1** | Engine | Seeded `asg-1`. `vrf.mulenga` records a finding `not_verified` with scope and limitation | Assignment `completed`. Finding stored. `income_records` evidence unchanged. No dispute created. Verification state of the target is `not_verified` |
| **V2** | Engine | Constraint set: `vrf.sakala` recording on `asg-1`; recording twice; empty limitation; a `verifier` who supplied the target | `NOT_ASSIGNEE`, `ASSIGNMENT_COMPLETED`, `FINDING_FIELDS_REQUIRED`, `SELF_VERIFICATION` |
| **V3** | Engine | After V1, `pfi_credit` runs `record_reliance` with `relied`. Then again by the same user. Then `secretary` tries | First accepted. Second `RELIANCE_ALREADY_RECORDED`. Third `ROLE_NOT_PERMITTED`. Reliance before any finding: `NO_FINDING` |
| **V4** | Engine | `assign_verification` by `ta` to `vrf.sakala` for a claim; by `secretary`; to a user who is not a verifier; to a missing target | Accepted; `ROLE_NOT_PERMITTED`; `NO_SUCH_VERIFIER`; `NO_SUCH_TARGET` |
| **F1** | Engine | Baseline funnel | Counts equal `expected-pipeline.json` `funnel` (9, 7, 5, 3, 3, 2) and the case lists match |
| **F2** | Engine | Baseline cohort summary | Equals `expected-pipeline.json` `cohorts`. Baseline equals current |
| **F3** | Engine | Intervention queue for N, A and B at baseline | Class counts equal `expected-pipeline.json` `open_interventions_by_destination`. The `case-3` registration item is class `blocked`. Fit items are class `restructure` |
| **F4** | Engine | Apply the T2 sequence on `case-1`, then compute | Gaps closed for A = 2 (`A2`, `A6`), for B = 0, for N = 0. Funnel "Ready for a lender" = 6. Other stages unchanged |
| **R1** | Engine | `ta.officer1` requests case lists and `case-8` | Receives cases 1 to 5 only. `case-8` returns `ACCESS_DENIED_COHORT`. Evidence modification returns `READ_ONLY_ROLE` |
| **R2** | Engine | `fm.officer1` requests case lists and attempts `raise_dispute` | Receives all nine cases. `ROLE_NOT_PERMITTED` |
| **E1** | Engine | Build the CSV for `case-1`, destination A | Header equals the 13 columns in 7.2 exactly. Row count equals A's requirement count (11). No `notes` or `demo_role` content anywhere |
| **E2** | Engine | Build the JSON for `case-8` with an open dispute and a finding | Contains `illustrative: true`, the boundary statement, the dispute and the finding. Contains no real lender name |
| **U1** | UI | Playwright: the demo paths in 4.4 and 5.4 | All steps succeed through the DOM. Disabled buttons show the rule tooltip. The two-click rule holds from a disputed requirement to its evidence |
| **U2** | UI | Playwright: no hard-coded figures | Mutate a fixture case (for example, change one seeded evidence level) in a test build. The funnel, cohort and queue numbers change accordingly |
| **C1** | Engine | Run the demo paths while capturing | Every emitted event validates against the revised `capture_event_schema.json`. New screens appear only with valid `screen_id` values |

**Regression.** After each change, `tests/expected-results.json` (27 results), T1 to T8a, D1 and X1 must still pass unchanged.

## 13. Acceptance criteria

The update is complete when:
1. All tests in section 12 and all existing tests pass.
2. Every number on the pipeline, cohort, directory, portfolio and intervention screens is produced by an engine function and changes when a fixture changes (U2).
3. A dispute can be raised, shown on every relevant surface, and resolved or withdrawn, and the case's readiness follows.
4. A verifier can log in, see their queue, record a finding, and the lender can record reliance, with evidence never altered by a finding.
5. A TA user cannot reach another cohort's case through the UI or the engine.
6. The readiness record exports as JSON and CSV with no system-specific mapping and no real lender names.
7. The implementation plan has been updated and its phase gates restated to include the new tests.
8. No score, rating, mapping to an external methodology, API or integration claim appears anywhere.

## 14. Defaults chosen in this document

These are modelling choices. Do not change them without approval:
- Disputes are closed only by independent re-verification or withdrawal. New evidence never closes them.
- The resolver of a dispute must be a field agent who is neither the supplier nor the previous verifier.
- Findings never change evidence levels.
- Only `pfi_credit` records reliance.
- Intervention classes and owner roles are as in `interventions.json`.
- Funnel stage conditions are as in 6.1. "Presented" includes financed cases.
- The `ta` role is scoped by cohort. The `fund_manager` role is not.
- The verifier of a claim is an independent verifier or institution staff. The same role covers both, distinguished by the `kind` field.

## 15. Amendments from `UI_HELP_SPEC_V1.md`

1. **Help pattern.** Explanations of definitions, rules and processes move into tooltips, popovers and helper text. Their wording lives only in `data/help.json`. Required statements are rendered by `VisibleStatement` and must be visible without interaction.
2. **Explanatory text in this document's UI sections.** Where sections 4.4, 5.4, 6 and 7 describe explanatory text for roles, reason codes, finding results, intervention classes, funnel stages, cohort terms or export formats, implement it as help entries, not as fixed text blocks.
3. **Tours.** Tour narration is driven from `data/tours.json`. The tour additions in section 11.1 are included there.
4. **Tests.** Add H1 to H11 from the help spec to the test list in section 12. Add H5b as the inline blocked-message check.
5. **Acceptance.** Add acceptance criterion 9: the acceptance criteria of `UI_HELP_SPEC_V1.md` are met.
6. **Removals.** Remove the lender workspace's "Before Symphony / After Symphony" panel.
