# Phase 4-6 Remediation Plan

Status: draft for review  
Date: 2026-10-08  
Scope: `Prototype/` only

## Authority Reset

### R0. Plan V3 is authoritative

**Issue:** Current implementation and documentation still carry mixed authority from older `AGENT.md`, `TEST_CASES.md`, README, and archived implementation notes. This has caused conflicts such as Phase 6 being described as read-only/static in older docs while Plan V3 requires interactive verification.

**Remediation:**
- Declare `Execution-Plan_v3/SYMPHONY-EXEC-PLAN-V3.md` and `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/docs/SYMPHONY-EXEC-PLAN-V3.md` as the controlling plan for this prototype.
- Use `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/**` as the authoritative source for latest kit documents, data references, scripts, and tests when working inside `Prototype/`.
- Update `Prototype/DECISIONS.md` with an explicit authority decision.
- Update or annotate conflicting local docs only where needed so future work does not follow stale text.

**Acceptance:**
- `DECISIONS.md` records Plan V3 and `Prototype/Execution-Plan_v3` as current authority.
- Any local doc conflict is listed with the governing replacement.

### R1. Missing documents are not missing

**Issue:** Earlier reviews treated `CLAUDE.md`, `FUNCTIONAL_SPEC_UPDATE_V1.md`, and `UI_HELP_SPEC_V1.md` as missing. They are present under:
- `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/CLAUDE.md`
- `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/docs/FUNCTIONAL_SPEC_UPDATE_V1.md`
- `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/docs/UI_HELP_SPEC_V1.md`

**Remediation:**
- Read these files before patching.
- Adjust any plan references or local documentation that imply they are absent.
- Use the kit copies for help placement, UI test expectations, and action semantics.

**Acceptance:**
- Remediation implementation cites the correct `Prototype/Execution-Plan_v3/...` paths.
- No further work relies on stale “document missing” assumptions.

## Must Fix Before Phase 7

### M1. `FindingForm` is pre-filled

**Issue:** `FindingForm` defaults to `verified` with pre-filled scope and limitation. Plan V3 says verifier outcomes must be deliberate; current claim test passes by submitting defaults.

**Remediation:**
- Change `FindingForm` to start with no selected result and empty scope/limitation.
- Require all fields before submitting.
- Show helper text only after a result is selected.
- Update Phase 6 tests to explicitly select result and fill fields for both `asg-1` and `asg-2`.

**Acceptance:**
- Submitting without fields is blocked or disabled.
- Tests fail if the default verified path returns.

### M2. Reliance is not role-gated and verifier shortcut bypasses workspace

**Issue:** Claim view always records reliance as `pfi_credit`, and reliance controls are visible regardless of active role. Lender screen also has a shortcut that records a verifier finding as `verified`, bypassing the verifier workbench.

**Remediation:**
- Show reliance controls only for lender roles permitted by `record_reliance`.
- Record reliance using the active role, not a hard-coded actor.
- Remove the lender-screen “Record verifier finding” shortcut or replace it with navigation to `verifier_queue` / `verifier_workbench`.
- Ensure verifier findings can only be recorded from verifier context.

**Acceptance:**
- Non-lender roles cannot see or use reliance controls.
- Lender screen cannot create a verifier finding directly.
- UI tests verify both allowed and blocked paths.

### M3. Lender actions overwrite/invent presentation records

**Issue:** `request_evidence` and `record_outcome` overwrite `presentation.lender_response`. On unpresented cases they create a presentation object, which can inflate funnel counts. `record_outcome` has no presented-case precondition.

**Remediation:**
- Add precondition: lender response/outcome actions require an existing presentation or financing relationship, as defined by Plan V3 and current fixture semantics.
- Preserve existing seeded `presentation.lender_response` history rather than overwriting it.
- Store lender requests/outcomes under `case.lender` as append-only records and derive presentation response display from latest record without mutating seeded state destructively.
- Keep funnel computation from being inflated by invented presentations.

**Acceptance:**
- Case-8 seeded A7 request remains visible after additional lender actions.
- Unpresented case lender outcome/request is blocked.
- Unit tests cover `request_evidence`, `record_outcome`, seeded response preservation, and funnel stability.

### M4. `roles.json` was edited

**Issue:** `data/roles.json` gained `record_admission` and three constraint codes, contrary to the “data unmodified” rule and the instruction to stop/report when role actions are missing.

**Remediation:**
- Compare current `Prototype/data/roles.json` against authoritative `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/data/roles.json`.
- Decide whether to:
  - revert the fixture change and implement Phase 4 admission using existing permitted action semantics, or
  - retain the data change only with an explicit Plan V3 authority/decision record if kit data already includes it.
- Record the ruling in `DECISIONS.md`.

**Acceptance:**
- `roles.json` is either restored to kit authority or explicitly justified.
- Tests cover any retained role/action behavior.

### M5. Required visible text missing on `lender_assessment`

**Issue:** `help.json` requires `boundary.sentence`; lender assessment currently shows only `lender.decides`. `reliance.caption` is required adjacent to reliance controls and is absent.

**Remediation:**
- Add `VisibleStatement id="boundary.sentence"` to `lender_assessment`.
- Add `VisibleStatement id="reliance.caption"` adjacent to `relied-btn` / reliance controls.
- Ensure placement follows `UI_HELP_SPEC_V1.md`.

**Acceptance:**
- Help validator passes.
- UI tests assert both visible statements on relevant screens.

### M6. Wrong boundary label for Phase 6 illustrative screens

**Issue:** `claim_view`, `verifier_queue`, and `verifier_workbench` use `extended`. Plan/help require `extended_demonstrated`.

**Remediation:**
- Extend `BoundaryLabel` usage so Phase 6 illustrative screens use `extended_demonstrated`.
- Keep `lender_assessment`, `facility_monitoring`, and `portfolio` as `extended` unless Plan V3 says otherwise.

**Acceptance:**
- Boundary-label test checks each Phase 4-6 screen explicitly.

### M7. Approved outcome is missing

**Issue:** Lender outcome selector omits `approved`, while `AGENT.md`, Plan V3, and `meta.outcome_states` include it. This requires an explicit product decision because readiness language must not imply Symphony approval.

**Remediation:**
- Add an explicit decision entry:
  - either allow lender-owned `approved` outcome with clear “lender decision” language, or
  - intentionally omit it and document why.
- If allowed, add `approved` to engine validation and UI selector as a lender-owned outcome only.

**Acceptance:**
- Decision recorded.
- Tests assert outcome is explicit, never pre-selected, and lender-owned.

### M8. Wrong provenance/export labeling

**Issue:** `buildDossier` ignores its `source` argument. Exports can be labelled `presented_snapshot` while holding live data; stored presentation snapshot contains only evaluation, not evidence/findings.

**Remediation:**
- Make dossier source/provenance truthful.
- If exporting a presented snapshot, use the stored snapshot and identify missing evidence/findings honestly.
- If exporting live state, label as `live_state`.
- Consider expanding presentation snapshot to include evidence/finding references only if Plan V3 permits.

**Acceptance:**
- Unit tests verify source labels and payload basis.
- UI export tests distinguish presented vs live data.

### M9. Monitoring due window hard-coded to 30 days

**Issue:** UI uses `30` days while `meta.monitoring_due_window_days` and help text say `14`.

**Remediation:**
- Replace all hard-coded monitoring window values with `meta.monitoring_due_window_days`.
- Update tests to assert the meta-driven value, not the current data accident.

**Acceptance:**
- `covenantState`, `monitoringState`, `facility_monitoring`, and `portfolioSummary` all use injected/meta window.
- Unit tests cover due/current/overdue around 14 days.

## Should Fix

### S1. Help placement gaps

**Issue:** Several help entries are unused or placed on screens not listed in `help.json`: `monitoring.*`, `covenant.*`, `portfolio.*`, `verification.*`, `lender.admission.*`, `dispute.reason.*`, and `reliance.help`.

**Remediation:**
- Read `UI_HELP_SPEC_V1.md`.
- Add `HelpPopover` / `HelpHint` placements according to `help.json`.
- Move or remove misplaced help usages.

**Acceptance:**
- `validate_help.py` passes.
- Targeted UI tests assert representative help IDs on Phase 4-6 screens.

### S2. Lender workspace is too scripted

**Issue:** Lender workspace lacks admission table, received-case panel, editable/real payloads, `requires_independent_query`, displayed admissions/findings/outcomes, disabled buttons with rule tooltips, and has one global `blocked` string leaking across screens.

**Remediation:**
- Add received-case panel showing organisation/project/presented context.
- Add admission table and include `accepted`, `requires_independent_query`, `rejected`.
- Display recorded admissions, lender findings, requests, and outcomes.
- Scope blocked messages per screen or action.
- Disable unavailable controls with rule/help text where possible.

**Acceptance:**
- Phase 4 test asserts recorded records are visible.
- Blocked message does not leak between unrelated screens.

### S3. Seeded case-8 A7 request is not shown SME-side

**Issue:** Current Phase 4 test creates a new A1 request rather than showing the seeded A7 request on the SME side.

**Remediation:**
- Load/display seeded `presentation.lender_response` for case-8.
- Show it on SME dashboard and/or relevant requirement view.
- Preserve it when new requests are added.

**Acceptance:**
- Test starts with case-8 and sees A7 request without creating a new request.

### S4. “Raised after presentation” comparison is thin

**Issue:** Uses date-only comparison and repeated hard-coded clock literal.

**Remediation:**
- Centralize demo action timestamp.
- Compare against presentation timestamp/date with documented semantics.
- Render dispute timing based on event data.

**Acceptance:**
- Tests cover pre-presentation and post-presentation disputes.

### S5. Covenant-to-evidence mapping is invented

**Issue:** `covenantEvidenceRef` invents a fallback `income_records`, and the Phase 5 test asserts it.

**Remediation:**
- Look for covenant mapping in Plan V3, kit docs, or fixtures.
- If no canonical mapping exists, show “No canonical evidence mapping recorded” rather than inventing one.
- Record a decision if a prototype mapping is needed.

**Acceptance:**
- No fallback evidence mapping without a documented source.

### S6. Claim assurance chain has hard-coded readiness semantics

**Issue:** Chain hard-codes `claim-1`, `4 items`, and treats any finding plus any reliance as “Ready for reporting,” including negative findings/non-reliance.

**Remediation:**
- Compute each chain node from claim, evidence list, finding result, reliance value, and portfolio reporting rule.
- Define portfolio-reporting readiness criterion in `DECISIONS.md`.
- Require positive finding and positive reliance if that is the selected criterion.

**Acceptance:**
- Tests cover `verified/relied`, `not_verified/relied`, `verified/not_relied`, and no finding.

### S7. Missing unit coverage for Phase 4-6 engine helpers/actions

**Issue:** No Vitest coverage for `record_outcome`, `request_evidence`, `record_admission`, `raise_finding`, `present_to_destination`, `covenantState`, or `portfolioSummary`.

**Remediation:**
- Add focused unit tests before or alongside fixes.
- Include mutation protection checks where actions should not alter evidence.

**Acceptance:**
- Unit tests fail on overwrite, invented presentation, wrong monitoring window, or hardcoded portfolio totals.

### S8. Phase 4-6 UI tests are too loose

**Issue:** Specs do not check evidence unchanged, disputed requirement two-click path, seeded request, or exact help placement.

**Remediation:**
- Tighten Playwright assertions around:
  - evidence unchanged after findings/reliance/admissions,
  - dispute visibility on cards/drawer/banner,
  - seeded case-8 A7 request,
  - help/visible text placement,
  - no pre-selected finding/outcome.

**Acceptance:**
- UI tests fail for the current known gaps before fixes.

### S9. Verifier workbench omits claim evidence list

**Issue:** Workbench shows baseline/current and limitation for claims, but not the claim evidence list.

**Remediation:**
- Render claim evidence list for claim assignments.

**Acceptance:**
- UI test sees all claim evidence items in verifier workbench.

### S10. Monitoring screen changes global active case

**Issue:** Selecting case-6/case-7 in `facility_monitoring` changes the global active case.

**Remediation:**
- Keep monitoring screen selection local unless the user explicitly opens that case elsewhere.

**Acceptance:**
- Selecting monitoring contrast case does not change dashboard active case.

## Documentation / Decision Items

### D1. Resolve older-doc conflicts

**Issue:** Older documents conflict with Plan V3:
- `AGENT.md` says Phase 6 is read-only/static.
- `TEST_CASES.md` has old X3 and X4-X10 expectations.
- README says Node 22 while `package.json` pins Node 25.

**Remediation:**
- Document that Plan V3 supersedes these conflicts for current work.
- Update README Node guidance to Node 25 if approved.
- Update local test documentation to Plan V3 numbering if approved.

### D2. `reliance.caption` placement conflict

**Issue:** `help.json` requires `reliance.caption` on `verifier_workbench` near `relied-btn`, but reliance is lender-only.

**Remediation:**
- Apply product ruling:
  - move reliance controls/caption to lender-only screens, or
  - update help placement metadata if Plan V3 permits.

### D3. Portfolio reporting readiness criterion missing

**Issue:** No current authoritative document defines when the portfolio-reporting node is ready.

**Remediation:**
- Add a decision criterion before changing chain logic.

### D4. `DECISIONS.md` is incomplete

**Issue:** Decisions #17-#19 omit role gating, presentation mutation, roles data edit, boundary label selection, outcome choice, monitoring window, and covenant mapping. #12 remains open.

**Remediation:**
- Add decisions for each resolved item.
- Close or update #12.

## Proposed Execution Order

1. Read `Prototype/Execution-Plan_v3/symphony-build-kit-v2/kit/CLAUDE.md`, `FUNCTIONAL_SPEC_UPDATE_V1.md`, and `UI_HELP_SPEC_V1.md`.
2. Add failing unit/UI tests for M1-M9 and key S-items.
3. Fix authority/documentation decisions R0-R1, D1-D4.
4. Fix engine safety issues M3, M4, M7-M9.
5. Fix UI role/visibility/help issues M1, M2, M5, M6, S1-S3.
6. Fix semantic/detail gaps S4-S10.
7. Run:
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e`
   - `npm run verify:oracle`
   - `npm run verify:help`
   - forbidden-term scan over `src`, `data`, and `dist`

## Review Questions

1. Should `approved` be enabled as a lender-owned outcome, or intentionally omitted despite `meta.outcome_states`?
2. Should `roles.json` be restored to the kit version, or can Plan V3 authorize the added `record_admission` action?
3. What exact rule should mark claim portfolio reporting ready?
4. Should covenant-to-evidence mapping be removed unless a canonical source exists?
5. Should older local docs be patched now, or should `DECISIONS.md` alone declare Plan V3 supersession for this prototype?
