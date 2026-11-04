# Architectural Decisions Record (DECISIONS.md)

This document records the architectural choices and resolutions made per `AGENT.md` section 8.

## R0. Plan V3 Authority
- **Decision:** `Execution-Plan_v3` and the bundled `symphony-build-kit-v2/kit` documents/data/scripts are authoritative for the current prototype work. `AGENT.md` is retained as a legacy implementation brief only where it does not conflict with Plan V3.
- **Rationale:** The repository-level remediation direction explicitly made Plan V3 authoritative and identified the latest documents under `Prototype/Execution-Plan_v3`. Phase 6 is implemented as an interactive demonstrated surface, not a static read-only placeholder.

## 1. Project Scoping & Isolation
- **Decision:** The entire application runtime, data fixtures, tests, and configuration are confined inside `Prototype/`.
- **Rationale:** Enables direct static deployment to Vercel with `Prototype` designated as the project root directory.

## 2. Integrity Verification vs. Fabricated Ledger
- **Decision:** Rejected fake cryptographic hashes (e.g. `#sha256-...`) and fake node badges (e.g. `[SBGI-SECURE-NODE]`).
- **Rationale:** Preserves honest limitation posture. If records show fingerprints, they are computed via standard browser Web Crypto API (`crypto.subtle.digest`) over canonical record data and explicitly labeled as client-side record fingerprints.

## 3. Provenance & Event Feed
- **Decision:** All provenance feeds and drawer views are dynamically derived from the engine's live event log (`events[]`) and evidence history.
- **Rationale:** Ensures "no state appears magically." Avoids disconnected mock ledger assertions.

## 4. Test Suite Segregation
- **Decision:** Vitest configuration explicitly includes `tests/**/*.test.ts`, while Playwright executes `tests/**/*.spec.ts`.
- **Rationale:** Prevents Vitest from executing browser-dependent Playwright integration suites and throwing runner conflicts.

## 5. Security & Forbidden Terms Isolation
- **Decision:** `data/forbidden_terms.json` is never imported into frontend source code.
- **Rationale:** Prevents real commercial lender names from being bundled into client production bundles (`dist/`). Only Test X2 reads `forbidden_terms.json` via node filesystem inspection.

## 6. Offline Font Resiliency
- **Decision:** CSS token system implements standard system font stacks fallback (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Rationale:** Guarantees pristine UI rendering in offline bank conference rooms.

## 7. Phase 1 Data Authority Over Plan Wording
- **Decision:** Phase 1 follows `data/roles.json` for role permissions and action names where the implementation plan text differs.
- **Rationale:** The V3 plan explicitly makes `data/*.json` the source of truth for values. Current data makes `present_to_destination` chairman-only and `add_evidence` available to secretary, treasurer, and chairman. Wider plan wording is treated as a later product choice requiring data change approval.

## 8. Phase 1 Engine Signatures
- **Decision:** Engine helpers accept precomputed evaluation maps where possible, including `cohortSummary`, `interventionQueue`, and `funnel`.
- **Rationale:** The plan requires views to use injected results rather than recomputing inside views. Passing result maps makes that dependency explicit and keeps reducers deterministic.

## 9. Windows Runtime Tooling
- **Decision:** This prototype is configured for the current Windows runtime (`node >=25 <27`, `npm >=11.6.2`) and uses `tools/run_python_tool.js` to invoke the bundled Codex Python runtime when `python` is not on PATH.
- **Rationale:** The active workspace is `C:\Workspace\GitHub\Symphony\Prototype`, and the user directed Windows execution. The wrapper prefers `PYTHON` when supplied and otherwise falls back to the bundled local runtime.

## 10. Evidence Re-Supply Semantics
- **Decision:** Re-supplying evidence through SME actions clamps the new evidence level to `asserted` or `supported`, clears verification fields, and does not carry forward a previous `verified` level.
- **Rationale:** This preserves I1 no self-verification and D1 verified evidence invariants. Verification must be performed by a permitted verifier/field agent action.

## 11. Deferred Phase 1 Surface
- **Decision:** Snapshot creation (`present_to_destination`), lender outcome/request/admission actions, localStorage persistence, reset, and UI capture are deferred to their corresponding later phases.
- **Rationale:** The Phase 1.1 patch focuses on pure engine correctness and the review defects. These later surfaces require UI/state-shell integration and are explicitly exercised in Phases 3, 4, and 8.

## 12. Help Text Duplication Risk
- **Decision:** `dossier.ts` currently carries the export boundary statement and note as constants for Phase 1 export tests.
- **Rationale:** Phase 1 has no help rendering layer yet. Phase 2's help system should replace these constants with `VisibleStatement`/`help.json` sourcing where applicable to satisfy H7.

## 13. Phase 3 Presentation Snapshot Action
- **Decision:** Added `present_to_destination` to the pure engine action layer and kept presentation state on the case record.
- **Rationale:** Phase 3 requires the UI to freeze a presented readiness snapshot. Keeping this as an engine action preserves event logging, role enforcement, and reset semantics instead of creating a UI-only side channel.

## 14. Phase 3 Single-Shell Routing
- **Decision:** The SME hero path uses a compact in-app screen switcher instead of adding a routing library.
- **Rationale:** The prototype is still a static Vite app with a fixed screen inventory. Local screen state keeps the Phase 3 flow testable without adding dependency or route complexity.

## 15. Phase 2 Remediation Scope
- **Decision:** Added the missing Phase 2 primitive surfaces as reusable React components: dispute, verification, assurance, reliance, export, event log, state transition, and capture shell.
- **Rationale:** Later phases need these components, but Phase 2's intent is to establish the shared primitives and test ids. Full capture persistence remains governed by Phase 8.

## 16. Phase 3 Role and Evidence Integrity
- **Decision:** SME actions now use the active persona as the actor, and requirement cards without linked evidence render explicit rule/applicability basis instead of falling back to registration evidence.
- **Rationale:** This enforces role semantics through the UI and preserves I3/I4 by preventing fit or not-applicable rows from displaying misleading evidence limitations.

## 17. Phase 4 Lender Records Are Separate Records
- **Decision:** Lender admissions, evidence requests, lender findings, and outcomes are stored under `case.lender` and never mutate cooperative evidence.
- **Rationale:** The Phase 4 boundary is that Symphony establishes readiness state while the lender records its own assessment decisions. Keeping these records separate preserves I5 and makes SME-visible lender requests explicit without changing evidence levels.

## 18. Phase 5 Monitoring Computes From Financing Records
- **Decision:** Facility monitoring renders only cases with `financing.status == "financed"`, computes use-of-proceeds differences and covenant state from fixture records, and keeps the `extension.json` hero facility explicitly excluded from portfolio totals.
- **Rationale:** Phase 5 is post-disbursement monitoring of recorded facilities, not a new credit decision or portfolio seed. Computing from `cases.json` preserves the fixture authority and keeps the illustrative extension scenario visibly separate.

## 19. Phase 6 Portfolio and Verification Stay Evented
- **Decision:** Portfolio totals are reduced from live case state and destination evaluations, while verifier findings and lender reliance use the engine actions already responsible for assignments, findings, and reliance records.
- **Rationale:** Phase 6 needs clickable portfolio evidence paths and interactive verifier work without mutating evidence. Keeping these flows on engine state preserves role enforcement, event logging, and the boundary between evidence, verifier findings, lender reliance, and portfolio reporting.

## 20. Phase 4-6 Review Remediation Decisions
- **Decision:** Lender outcomes include `approved`, but outcomes remain lender-owned, explicitly selected, and never preselected or inferred by Symphony.
- **Rationale:** `approved` is a valid lender outcome in `meta.outcome_states`, while I5 still requires Symphony to establish readiness evidence only.

- **Decision:** The Phase 4 lender records added to `data/roles.json` are retained: `record_admission`, `OUTCOME_REQUIRED`, `REQUEST_FIELDS_REQUIRED`, `PRESENTATION_REQUIRED`, and `INVALID_ADMISSION`.
- **Rationale:** The kit `roles.json` predates the Phase 4 admission workflow. The records are needed for lender-owned assessment actions and remain separate from cooperative evidence.

- **Decision:** `reliance.caption` is required on `lender_assessment` only. The earlier verifier-workbench placement is inapplicable because reliance is recorded by the lender, not the verifier.
- **Rationale:** Reliance is the lender's own record against a finding. Showing the caption next to the lender control avoids implying verifier authority over reliance.

- **Decision:** Portfolio claim reporting is ready when a finding is `verified` and reliance is `relied`, conditionally ready when a finding is `partially_verified` and reliance is `relied`, and not ready otherwise.
- **Rationale:** Reliance alone is insufficient; the verifier result and lender reliance together determine whether a claim can flow to reporting.

- **Decision:** Covenant-to-evidence mapping is limited to `quarterly_cash_statement -> income_records`, `season_end_production_report -> farming_history`, and `registration_renewal_evidence -> registration`. Unknown covenants have no canonical mapping and the UI states that explicitly.
- **Rationale:** The previous fallback to income records invented provenance. Unknown mappings must remain visible as missing, not silently reassigned.

- **Decision:** Monitoring windows use `meta.monitoring_due_window_days`, and demo action timestamps use a shared `demoActionAt` derived from `meta.demo_date`.
- **Rationale:** This keeps Phase 5/6 behavior data-driven and avoids hidden constants diverging from the kit metadata.

## 21. Phase 7 NABII Pipeline Screens
- **Decision:** Phase 7 implements the three Plan V3 screen IDs exactly: `nabii_pipeline`, `nabii_cohort`, and `nabii_directory`.
- **Rationale:** Plan V3 freezes the screen inventory and names these as distinct Phase 7 surfaces. Keeping them separate makes funnel, cohort, intervention, and directory behavior directly testable.

- **Decision:** Pipeline, cohort, intervention, directory readiness, and gaps-closed numbers are rendered from existing engine functions: `funnel`, `cohortSummary`, `interventionQueue`, `evaluationMap`, `gapsClosed`, and `visibleCases`.
- **Rationale:** The Phase 7 gate requires no typed-in numbers and scoped TA/fund-manager behavior. Reusing the engine reducers keeps UI numbers aligned with the verifiers and fixture mutations.

## 22. Phase 8 Guided Tours and Session Capture
- **Decision:** Guided tours are driven strictly by `data/tours.json` without embedded text in UI components. The automatic session capture engine operates 100% locally in `localStorage` under `symphony.capture.v1` with zero outbound network traffic and no PII capture.
- **Rationale:** Demonstrations must run completely offline in bank or stakeholder conference rooms. Capture provides structured feedback without surveillance or data leakage. Resetting demo state preserves historical capture logs across sessions.

## 23. Phase 9 Bundle Sanitization and Hardening
- **Decision:** Production builds (`dist/`) are audited by `tools/verify_bundle.py` to ensure that test files, tools, forbidden term lists, and question templates are strictly excluded from client distribution. Every rendered view displays its mandatory `BoundaryLabel`.
- **Rationale:** Symphony governs honest readiness evidence; the production deployment must never contain developmental artifacts or unanchored mock claims.

## 24. Role-Specific Linear Journeys Replace 19-Tab Navigation
- **Decision:** The prototype replaces the 19-tab horizontal navigation menu with role-specific, linear guided journeys featuring one task per screen and a clean 3px progress indicator.
- **Rationale:** Users must experience an institutional progression and guided transformation rather than navigating an application's internal data structure.

## 25. Separation of Display-Only Data Concerns
- **Decision:** Display-only fields (`members_roster`, `coop_assets`, `certificate_officers`, `current_officers`) live in `data/cases.json`, and their TypeScript definitions reside strictly in `src/components/journeys/types.display.ts`. The core engine types in `src/engine/types.ts` remain completely untouched and frozen.
- **Rationale:** Preserves core evaluation engine integrity and existing oracle compatibility while enabling rich cooperative roster and asset transformation visuals.

## 26. Initial Encumbrance Initialized to "Not Recorded"
- **Decision:** Initial member livestock encumbrance is stored as `"Not recorded"` and rendered as a selected-but-muted default option.
- **Rationale:** Prevents the UI from implying an unverified or premature legal/commercial claim that no authorised person has made.

## 27. Member Enrollment Precedes Governance Determination
- **Decision:** Member roster enrollment (Step 3: `CoopMembers.tsx`) strictly precedes officer determination (Step 4: `CoopGovernance.tsx`). At least one member must be enrolled before officers can be chosen. Current officers inherit their `member_id` from the enrolled roster, and comparison between certificate officers and current officers compares by `member_id`.
- **Rationale:** Guarantees that valid member IDs exist to compare against. If an ID is missing or differs between certificate and current officer records, a discrepancy is deterministically flagged.

## 28. Governance Discrepancies Stored via Governed Evidence Action
- **Decision:** Any officer discrepancy between certificate records and current officers is stored into `caseState.evidence.governance_officers` via `applyAction('add_evidence', ...)` at the `asserted` level with `has_discrepancy: true`.
- **Rationale:** The discrepancy becomes an audited event in the engine's event log and can be evaluated deterministically against destination requirements without phantom UI state.

## 29. Personal Data Access Boundary
- **Decision:** Institutional portals (NABII, TA, PFI, VVB, and Portfolio) never receive raw individual member names or individual household livestock assets. External components must only consume aggregate calculations via `memberAssetSummary()` and `coopAssetSummary()`.
- **Rationale:** Protects personal member data privacy while preserving institutional visibility into enterprise productive capacity and encumbrance risk.

## 30. Portfolio Management as a First-Class Journey
- **Decision:** Portfolio surveillance is established as a first-class journey separate from single-institution underwriting, allowing continuous covenant monitoring and facility compliance tracking.
- **Rationale:** Post-disbursement performance and covenant monitoring represent an ongoing operational workflow distinct from initial credit assessment.

## 31. Browser-Session LocalStorage Persistence for Demo Simulation
- **Decision:** Draft state is persisted locally in `localStorage['symphony.draft.v1']`. "Save and exit" writes the draft, and "Resume draft" restores it across browser reloads.
- **Rationale:** Provides seamless workshop-to-follow-up continuity for demonstrations without introducing external server dependencies or state corruption.

## 32. Removal of Obsolete Tab Wrappers
- **Decision:** The deprecated `src/components/sme.tsx` wrapper is removed and completely replaced by `src/JourneyRouter.tsx`.
- **Rationale:** Eliminates redundant navigation layers, ensuring a single authoritative entry point for role-based guided journeys.

## 33. V3 Architecture Freeze Lifted (Scoped)
- **Decision:** By order of the founder (primary human authority), the `SYMPHONY-EXEC-PLAN-V3` section 1 architecture freeze ("Nothing else may be added") and the R25 freeze on `src/engine/types.ts` are lifted for the delta inventory in `Prototype/THREE_WEEK_BUILD_PLAN.md` section 4 only, dated 2026-10-10. The freeze is reinstated at the Week 3 gate with that inventory as the new baseline.
- **Still in force:** invariants I1 to I8, no real lender names (test X2), no score, rating or external-methodology mapping, every figure computed from fixtures or live engine state, frozen state vocabulary (`asserted`, `supported`, `verified`; overlays `disputed`, `stale`), `case-1` to `case-9` and the 27-result baseline unedited, R26 (new encumbrance entries default to `Not recorded`), R28 (discrepancies stored via governed evidence), R29 (institutions receive aggregates only).
- **Rationale:** The journey redesign needs a dashboard layer per role, a four-state pipeline classification, TA intervention records and a technician role. None of these fit the V3 inventory or the frozen engine types. Lifting the freeze for a listed delta keeps the change reviewable instead of open-ended.
- **External input:** EcoVadis rating principles are used as design strategy only. R34 governs the score and IRIS+ labelling.

## 34. Founder Directions of 2026-10-10 Outrank V3
- **Decision:** The founder's directions of 2026-10-10 take precedence over `SYMPHONY-EXEC-PLAN-V3`. They amend V3's "No score, rating, mapping to an external methodology" rule as follows:
  - A proprietary, illustrative **Symphony ESG Index** may be shown, with its formula and per-indicator breakdown on screen. It is display only and never feeds readiness evaluation (I4).
  - Indicators carry **"IRIS+ aligned metric (illustrative)"** labels using metric names and codes verified against the GIIN catalog. No code is invented. The wording "IRIS+ compliant" is not used: IRIS+ is published as a catalog of metrics and Core Metrics Sets, and I found no compliance scheme.
  - The livestock column "Official Registry Status" is kept as seeded demonstration data under the illustrative boundary label, at evidence level `asserted`.
  - A household whose head is under 35 years is a youth-led household.
  - NABII's top-level figures are national totals (synthetic seed plus the 10 modelled cooperatives, which appear only on drill-down).
  - Field Agent is a cooperative-designated internal verifier assigned at the select-roles step.
- **Not amended:** invariants I1 to I8, no real lender names, R26, R28, R29.
- **Rationale:** The prototype must show a believable national pipeline and an attributable evidence trail to non-technical stakeholders, with every illustrative element labelled.

## 35. Review Amendments to the Build Plan
- **Decision (2026-10-10, founder: "make these suggested changes"):**
  - **Livestock display** supersedes the R34 bullet on "Official Registry Status". The screen shows source-reported encumbrance status, a separate "Registry check: Not performed" field, the reported holder, and the Field Agent with contact. Unregistered and unencumbered are not treated as synonyms. No registry connection is implied.
  - **NABII state precedence:** Remediation required is evaluated before Assessment-ready. A single function `blockingExceptions` feeds both readiness display and classification, so a case cannot be ready and in remediation.
  - **Synthetic aggregates:** national and province totals are labelled illustrative context and are not drillable. Drill-down lists exist only for the 10 live cases and equal their counts.
  - **Sign-in** is a labelled demo persona selector. Create Account and Terms are static informational pages. The technician persona is limited to enrolment and role assignment.
  - **Action labels:** consequential actions carry VIEW ONLY, RECORD CHANGE, REQUEST / ASSIGNMENT or INSTITUTIONAL FINDING OR DECISION labels, with Before, After and Unchanged confirmation driven by the persisted engine event.
  - **Bank story:** the institution decides. A Field Agent's check is a traceable claim, not a Symphony guarantee. Verification is requested through the existing `assign_verification` workflow.
  - **Schedule:** a demo sprint (bank slice for Tuesday 13 Oct, NABII slice for Wednesday 14 Oct) precedes the three-week build.
  - **Lender B:** option (a). The computed result is shown; `destinations.json` is not edited.
- **Not amended:** invariants I1 to I8, no real lender names (`forbidden_terms.json` includes the lender named in the bank story, so fixtures and UI use Lender A and Lender B), R26, R28, R29.
- **Rationale:** The prototype must tell an honest story to institutions that know registry practice. Every screen has to say what is actually recorded and by whom.

## V4 Architecture Decision Records (ADR-001–ADR-021)

> These ADRs govern the new V4 database-backed workspace (`packages/`, `apps/`).
> The legacy prototype (`src/`, `data/`, `tests/`) remains governed by sections 1–35 above.
> Authority: `Implementation-Plan-V4/02-decision-register.md`.

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | **Lift all V3/R25/R33/Week-3 freezes** for the new apps. Still binding: no real lender names, honesty/anti-overclaim language, personal-data boundary (D29), forbidden-term rules, every HARD invariant in `03` §10. | Accepted |
| ADR-002 | **Workspace shells first.** Guided journeys built later on a stable workspace; legacy journeys stay as demo until parity, then retire and rebuild as guided journeys. | Accepted |
| ADR-003 | **The prototype becomes database-driven.** Zero-network (X4) and no-backend rules apply to the **legacy app only**. | Accepted |
| ADR-004 | **Keep the ESG Index and EQS as they are.** Both are evidence-quality measures. All documentation of how they work is preserved. | Accepted |
| ADR-005 | **Stack:** TypeScript end-to-end; PostgreSQL 18 (local or Docker); Fastify API; Zod schemas; Kysely + SQL migrations; Cucumber.js for BDD; Testcontainers/Docker Postgres for integration (Docker optional — local PostgreSQL is the fallback); React Router in the new workspace app. | Accepted |
| ADR-006 | **Pure domain package** (`packages/domain`): no I/O, no React, no `pg`. Shared by API, workspace and tests. Enforced by dependency-cruiser. | Accepted |
| ADR-007 | **Legacy quarantine:** current app and engine stay at repo root, unmodified except to keep their tests green, until parity. New code lives in `packages/` and `apps/`. | Proposed |
| ADR-008 | **Advisory by default, enforceable by configuration.** Every governance rule has an `enforcement_mode` per organisation. HARD integrity rules are never configurable. | Accepted |
| ADR-009 | **Duty Matrix** (replaces round-1 record-class table; `03b` §4). | Accepted |
| ADR-010 | **Internal Field Verifier** is a *capacity*, bound to one organisation, producing findings of assurance class `cooperative_internal`. | Accepted |
| ADR-011 | **Assurance class** is a dimension on every finding. Evidence level is a derived projection so destinations keep working. | Proposed |
| ADR-012 | **Source precedence (round 2):** statute > by-law of record > resolutions > default. Release trigger default: `registered_current` (Act s.20(2), O-18 ruling). | Accepted |
| ADR-013 | **Position combinability defaults:** any position may be combined except Chairperson with Vice-Chairperson; audit-committee members may not sit on the Board. | Accepted |
| ADR-014 | **PII engineering:** NRC and identifiers encrypted at field level; HMAC blind index; role-based masking; events carry no PII. `KeyProvider` port: local now, OpenBao later. | Accepted |
| ADR-015 | **Consent and retention:** consent per person per purpose; withdrawal supported; two-year post-exit floor (Act ss.34, 37(6)); `retention_conflict_review_required` for financial records. | Proposed |
| ADR-016 | **Hosting / residency:** test data only; DB purged periodically to seed data. Architecture behaves as if the Data Protection Act and residency rules were enforced. | Accepted |
| ADR-017 | **Offline-tolerant commands:** every command carries `commandId`, `occurredAt`, `deviceId`, `expectedVersion` for idempotent offline replay. Offline UI is Phase 9. | Proposed |
| ADR-018 | **Identity-check method is configuration.** Methods: `otp`, `in_person_attested`, `document_sighted`, `password`. An authentication event never proves a cooperative fact. | Accepted |
| ADR-019 | **Platform enroller checks** are recorded as scoped `platform` checks on an exact evidence version. Proxy entry and platform check are two distinct acts. Same-person disclosure flag; optional `require_distinct_reviewer` policy (default off). | Accepted |
| ADR-020 | **Union/TA scope** is a delegation chain: NABII/programme manager → union → assigned cohorts. Full capability gaps visible; no member PII or sensitive data. | Accepted |
| ADR-021 | **Dossier export payload unchanged** for now; extended only with provenance fields in Phase 8. | Accepted |

### Superseded legacy decisions (for new apps only)

The following legacy DECISIONS.md sections are superseded **for `packages/` and `apps/` only**; they remain in force for `src/`:

- Section 14 (single-shell routing) → superseded by ADR-002 (React Router workspace)
- Section 22 (Phase 8 tours/capture) → capture becomes telemetry; tour rebuilt as guided journey in Phase 10
- Section 23 (bundle sanitization) → V4 has its own `verify:v4` pipeline
- Section 24 (role-specific linear journeys) → superseded by ADR-002 (workspace shells first)
- Section 33 (V3 architecture freeze) → superseded by ADR-001 (freeze lifted)

### Round 5 Rulings (O-18 to O-21) — 4 November 2026

| Open item | Ruling | Applied |
|---|---|---|
| O-18 | Default release trigger: **`registered_current`** (Act s.20(2): amendment takes effect only after registration). Configurable to `submitted_to_registrar`. | `precedence_policies` seed; `03` §5 updated; ADR-012 updated |
| O-19 | Register inspection supports **public** inspection on payment of a prescribed fee (Act ss.21, 28). Fee recorded by receipt reference; Symphony does not process it. Public view: statutory fields only (name, address, occupation, date registered). | PRV-006, PRV-d, PRV-010 finalised |
| O-20 | Full Act read (ss.1–60(3)(a), 74–85, Schedules I–II). All seeds in `03` §13 (S-001–S-035) carry status `text_checked`. Cooperative registration number is **11 digits, numerals only** (Form 2, SI 26/1999). | `organisation_identifiers` pattern `^\d{11}$`; Act seeds `text_checked` |
| O-21 | Minor members: default **off** (`allow_minor_members = false`). Legal reviewer to advise on guardian consent. | `ID-008` locked; `membership_rules` seed `allow_minor_members = false` |
| O-22 | Still open — missing Act pages 244–247 (ss.60(3)(b)–73). Upload remaining pages when available. | Tracked open |
