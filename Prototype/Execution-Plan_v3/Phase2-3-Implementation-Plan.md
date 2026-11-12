**Remediation Plan**
Goal: bring Phase 2 and Phase 3 from “working slice” to gate-compliant against `SYMPHONY-EXEC-PLAN-V3.md`, `help.json`, `tours.json`, and `TEST_CASES.md`.

**Priority 0: Integrity Bugs**
1. Fix evidence fallback bugs.
   - Requirements without evidence, fit checks, and not-applicable rows must not display registration limitations or open the registration drawer.
   - Add explicit “No evidence item” / fit-rule / applicability basis rendering.
   - Tests: A11 fit card, A8 not-applicable card, missing evidence card, drawer unavailable or correct basis shown.

2. Fix projection summary exceptions.
   - Show unresolved and exception IDs separately.
   - Case 3 must show `exception: N1`, not “No unresolved requirements” alone.
   - Tests: case-3 destination N/A/B projection.

3. Replace hard-coded KPI values.
   - Compute “days to next expiry” from evidence validity dates and `meta.demo_date`.
   - Evidence tier counts should derive from current case evidence and include stale/disputed overlays where applicable.

**Priority 1: Phase 2 Component Completion**
4. Build missing required primitives:
   - `StateTransitionCard`
   - `EventLogDrawer`
   - `DisputePanel`
   - `DisputeBanner`
   - `AssignmentCard`
   - `FindingForm`
   - `AssuranceChain`
   - `RelianceControl`
   - `ExportMenu`
   - `CaptureProvider` shell only if Phase 2 requires presence, full behavior can wait for Phase 8.

5. Complete existing primitives.
   - `GovernedMetricCard`: unique test ids, evidence drawer, state badge, verified by/date, limitation, history, raise issue hook.
   - `DestinationSwitcher`: controlled component with `onChange`.
   - `RoleSwitcher`: all roles, controlled component with `onChange`.
   - `EvidenceDrawer`: show evidence type, structured history, no raw `JSON.stringify`.
   - `RequirementChain`: each chain node must show meaningful basis content, not just labels.

6. Fix help behavior.
   - `HelpTip`: 300 ms open delay, 100 ms close delay.
   - Escape closes.
   - Outside click/tap closes.
   - Touch opens without hover dependency.
   - “See more” becomes a focusable control.
   - State badges should not carry popovers if spec says state meanings come through `StateLegend`.

7. Complete design system.
   - Add spacing/type/radius/shadow tokens.
   - Add light/dark theme support via `prefers-color-scheme` and `[data-theme]`.
   - Resolve `DECISIONS.md` font-stack contradiction.

8. Fix component demo route.
   - Demo every state: `asserted`, `supported`, `verified`, `disputed`, `stale`, plus requirement states.
   - Move or flag `/components`/`/dev-components` so Phase 9 can exclude it from production if required.

**Priority 2: Phase 3 SME Flow Completion**
9. Make active persona real.
   - Actions should use selected role/user, not hard-coded actors.
   - Forbidden actions should be disabled or rejected visibly with rule text.
   - Cover T5a-T5e through the UI.

10. Complete enrollment.
   - Add actual create-organisation/officers/project/self-assessment UI or clearly scoped demo controls that call engine actions.
   - Selecting case/persona should navigate into the journey.

11. Complete dashboard.
   - KPIs: readiness per destination, evidence tier distribution, open gaps, days to next expiry.
   - Add dispute alert issue page: what is disputed, who raised it, what is needed, owner role.

12. Complete org/project state screens.
   - Do not derive them only from Lender A groups.
   - Add named sections expected by the plan: finance, activity, assets, production, environmental.
   - Ensure tour anchors exist, especially `metric-card-environmental-baseline`.

13. Complete gap remediation.
   - Add `StateTransitionCard`.
   - Show readiness impact on the remediation screen itself.
   - Wire help entries: `step.upload_minutes`, `step.signoff_minutes`, `step.field_verification`, `step.add_evidence`, `step.restructure_request`.

14. Complete readiness basis.
   - Add readiness verdict.
   - Show ownership / what is needed per unresolved requirement.
   - Use `chain.*`, `rule.*`, and relevant destination help.
   - Keep boundary statement and not-approval statement placed per help spec.

15. Complete present modal/export.
   - Show frozen snapshot contents.
   - Add `ExportMenu` using `buildDossier` / `dossierToCsv`.
   - Source boundary/export text from `help.json`, not duplicated constants.

16. Add dispute path.
   - UI can raise dispute.
   - Requirement cards, evidence drawer, dashboard alert, and issue page reflect it.
   - Dispute state must affect computed readiness through engine state.

**Priority 3: Test Gates**
17. Expand Gate 2 tests.
   - H1-H4, H8.
   - Escape and outside-click close.
   - Touch behavior.
   - Render test for every help pattern.
   - Component demo verifies every state.
   - T8b with unique selectors.

18. Expand Gate 3 tests.
   - T1, T2, T4, T5, T6, T7 through DOM.
   - H5 and H11 placement checks.
   - Exact reset baseline check, not just readiness/gap count.
   - Present snapshot/export tests.
   - Dispute alert/issue-page test.

19. Keep running full gates after each remediation cluster:
   - `npm run verify:oracle`
   - `npm run verify:help`
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e`

**Execution Order**
1. Integrity bugs: evidence fallback, exceptions display, hard-coded KPI.
2. Functional controls: active role, destination switcher, role switcher.
3. Missing Phase 2 components and help behavior.
4. Phase 3 screen completion: enrollment, dashboard, remediation, readiness basis, presentation/export, disputes.
5. Test expansion and final gate report.

This plan keeps the current foundation, but stops treating the current passing tests as sufficient gate evidence.