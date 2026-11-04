# 09 — UI/UX Implementation Plan

Addresses `Symphony UI UX Redesign Review and Proposal.md` (3 November 2026), the Financier evidence view, the Symphony dashboard mock and the Sopact reference, against the V4 architecture and the founder's decisions. Workspace shells come first; guided journeys are rebuilt afterwards (ADR-002).

## 1. Verdict on the proposal

| Aspect | Verdict |
|---|---|
| Direction (Evidence Readiness Workspace: tiles, status table, action panel, provenance drawer, persona navigation, no score) | **Adopted** |
| Component specifications (§4.1–4.15) and contrast-checked tokens (§3.5) | **Adopted**, extended for the new evidence states |
| Code findings | **Stale**: it audits `sme.tsx`, `phase2.tsx` and a 19-tab shell that no longer exist. The current legacy app is `JourneyRouter` plus journey components. The defects it lists still guide the new build (no URLs, enum leakage, scaffolding on screen, missing live regions, weak focus handling), but the refactor steps 2–3 become "build the new app", not "split `sme.tsx`" |
| "Replace the wizard with a non-blocking path" | **Adopted** in the workspace (Setup Path). Wizard-style guided journeys return later (Phase 10), built over the stable workspace |
| "Never show a score" | **Adopted for readiness surfaces.** The ESG Index and EQS stay as they are (ADR-004), shown only in their own labelled panel with the caption "Evidence-quality measure, not an ESG performance rating" (C10). The no-score test scans readiness surfaces, not that panel |
| Reject the reference donut and "Readiness: In Progress" pill | **Adopted** |
| Self-hosted fonts for X4 zero-network | **Adopted for a different reason**: the zero-network rule applies to the legacy app only, but self-hosting avoids third-party processors and keeps the residency posture clean |
| Sopact "answers with evidence you can check" | **Adopted** as the two-click traceability rule; AI output stays unconfirmed until a reviewer confirms (spec §6.2) |
| Proposed seven-area cooperative navigation | **Adopted**, with sub-sections for committees, audit, education and annual return (§3) |
| Status system: one primary chip plus secondary indicators | **Adopted**, with the vocabulary extended for Track R and audience-relative labels (§4) |
| Open items about Approved, `roles.json`, claim-report readiness, covenant mapping | **Carried to Phase 8** with the institutional screens; legacy behaviour is preserved until then |

## 2. Delivery approach

Vertical slices. Each domain phase ships its screens in the same phase, so the workspace grows with the model and never shows a flow the backend cannot support. Where a module is `not_implemented`, the screen shows the capability-gap chip and the proposal's wording "Platform capability not implemented" instead of an invented flow (proposal §5.3).

| Phase | UI delivered |
|---|---|
| 0 | Tokens, primitives skeleton in a `/components` page, a11y tooling, route skeleton behind a flag |
| 1 | Shell, context bar, persona navigation, login and temporary-password change, DemoPanel, `presentEvidence` adapter with unit tests, capability-gap component |
| 2 | Self-enroller placeholder screens (two actions), first-official onboarding, Setup Path, Evidence register, Provenance drawer v2, IFV workbench |
| 3 | By-laws and requirements screens, provision confirmation, legal-catalogue advisory queue (programme manager) |
| 4 | Governance: positions, appointments, committees; combination findings |
| 5 | Meetings, minutes (duty-process states), resolutions (`held_draft`), action items |
| 6 | Findings and next actions, compliance (audit, education, annual return) |
| 8 | Lender, verifier (external), NABII/TA/union pipeline and directory, portfolio, monitoring; ported from legacy with parity tests |
| 9 | Offline capture, hardening |
| 10 | Guided journeys rebuilt on the workspace |

## 3. Information architecture and routes

React Router, one `h1` per route, focus moves to the `h1` on navigation, `document.title` updated, skip link first (proposal §4.1).

| Persona | Primary navigation | Routes |
|---|---|---|
| Self-enroller (placeholder) | Certificate details · Create officer accounts · Hand over | `/enrol/certificate`, `/enrol/accounts`, `/enrol/handover` |
| Cooperative official (Chair, Vice, Secretary, Treasurer, committee) | **Overview · Identity · By-laws and requirements · Governance · Meetings and resolutions · Evidence register · Findings and next actions** | `/coop/:orgId/overview`, `/identity`, `/bylaws`, `/governance`, `/meetings`, `/evidence`, `/findings` |
| Internal Field Verifier | Cooperative navigation plus **Verification queue · Workbench** | `/coop/:orgId/verify`, `/verify/:itemVersionId` |
| Member | My records · Register (inspection) | `/me/records`, `/coop/:orgId/register` |
| Enroller (assisted) | Sessions · Enrol · Platform check | `/enroller/sessions`, `/enroller/:sessionId/...` |
| Programme manager / NABII | Pipeline · Cohort · Directory · **Legal catalogue review** · Delegations | `/nabii/pipeline`, `/nabii/catalogue`, `/nabii/delegations` |
| TA / union | Cohort · Capability gaps | `/ta/cohort`, `/ta/cohort/:orgId/gaps` (no PII) |
| Lender / PFI | Cases · Case evidence view · Monitoring · Portfolio | `/lender/...` (Phase 8) |
| External verifier (VVB) | Queue · Workbench | `/verifier/...` (Phase 8) |
| Platform admin | Enrollers · Catalogues · Capabilities · Policies | `/admin/...` |
| Demo (dev/test only) | Collapsible DemoPanel: persona switch, reset to seed (confirm), tours, event log, scripted steps | Never inside persona screens |

Sub-sections: Governance holds Positions and appointments, Committees; Meetings holds Meetings, Minutes, Resolutions, Action items; By-laws and requirements holds By-laws, Requirements, Audit, Education, Annual return. Deep links and filter state live in the URL.

## 4. The status system with the V4 evidence model

One adapter: `presentEvidence(standing, audience)` returns `{ label, tone, icon, a11yText, scopeText, flags }`. It is the only place enums become words. A test fails on snake_case in rendered text and on banned phrases ("compliant", "certified" without authority, bare "Verified").

### 4.1 Primary chip vocabulary (extends proposal §3.4)

| Underlying standing | Chip text | Shape |
|---|---|---|
| asserted | Self-declared | Half-filled, indigo |
| supported | Supported (proof attached) | Half-filled, amber |
| Track R `working_copy` / `awaiting_duty_submission` | Working copy, outside [duty] process | Dashed outline |
| Track R `draft_submitted` | Draft, awaiting approval | Open square |
| Track R `approved_official` | Official cooperative record | Filled square |
| `verified[cooperative_internal]` | Cooperative-verified (internal) | Filled circle with inner ring |
| `verified[platform]` | Platform-checked (scope) | Filled circle with notch |
| `verified[independent_external]` | Independently verified (scope) | Filled circle |
| `held_draft` | Held as draft: by-law not amended | Hourglass |
| disputed | Disputed | Triangle |
| stale | Stale | Clock |
| none | Not evidenced | Dashed circle |

Colour pairs from proposal §3.5 are kept and the tone map is extended with one more contrast-checked pair for platform-checked. Shape, colour and text always appear together.

### 4.2 Secondary indicators (strip)

Admission · official approval · verification on this exact version (with assurance class) · currency · dispute · "outside duty process" flag · "proxy entry and platform check by same person" disclosure flag. Hover, focus or expand shows detail.

### 4.3 Verified chips carry scope

Expanded form always reads "by [verifier], scope, version [n], assurance class". Institutions always see the audience-relative sentence from `03b` §6.

## 5. Components (proposal §4, with V4 additions)

| Component | Source | V4 notes |
|---|---|---|
| AppShell, ContextBar | Proposal §4.1–4.2 | Context bar adds **Acting as [position/capacity]** and stage chip (S0–S4); persona change announced in a polite live region |
| SummaryTile | §4.3 | Counts only; links; baseline deltas; no percentage readiness |
| StatusChip + EvidenceStrip | §4.4 | Per §4 above |
| StateTable | §4.5 | Columns: Claim/Record · Status strip · Evidence on file · Gap · Owner and next step. Real table, caption, one button per row |
| ProvenanceDrawer v2 | §4.6, extends legacy `ProvenanceDrawer` | Sections: Supplied · Admitted/Submitted · Officially approved · Verified (class, scope, version) · Disputes · History · **Duty process** (outside-process flag, adoption) · Limitation. Focus trap, `inert` background, Escape and focus return |
| ActionPanel | §4.7 | Ranking (§6). Unavailable actions are `aria-disabled` with the reason as text ("Needs Chairperson or Vice-Chairperson approval") |
| FindingCard | §4.8 | Grouped by severity; "Blocking" always names the transition. Legal findings carry the fixed disclaimer and route to advisory queue |
| SetupPath | §4.9 | Six groups; every step reachable; dependency notes, no locks, no percentage |
| DisputePanel | §4.10 | As proposed |
| VerifierWorkbench | §4.11 | Shows the exact version, assurance class "Cooperative internal" for IFV, conflict decline message when supplier/collector |
| LenderDecision | §4.12 | Phase 8 |
| Pipeline/Directory | §4.13 | Phase 8; TA/union variants hide PII |
| BlockedMessage | §4.14 | `role="alert"`, rule code in small monospace, scoped to the action |
| Tour/Help | §4.15 | Rebuilt with the guided journeys in Phase 10; legacy tours stay in the legacy app |
| **CapabilityGap** (new) | proposal §5.3 | Chip and panel when a module is `not_implemented` |
| **DutyProcessTimeline** (new) | `03b` §4 | Author → submit → approve with actors and versions |
| **AudienceNote** (new) | `03b` §6 | One-line "how this reads to your audience" |
| **EnrolmentSessionBar** (new) | `03` §3 | Shows representative present, session id, methods used; blocks assisted writes when absent |
| **TempPasswordGate** (new) | ADR-018 | Forced change at first login |

## 6. Next-action ranking

Inputs: open findings (severity, blocking transition), requirement dependency, stage, actor authority, effort hint. Order: (1) actions that unblock a named transition the current persona can perform, (2) actions the persona can perform on material gaps, (3) actions requiring someone else, shown with the owner role. At most four shown; one primary. The ranking function is pure and table-tested. The Financier view's four example actions map to Request, Schedule, Request, Refer.

## 7. Tokens, type and layout

Tokens exactly as proposal §3.5 (all contrast ratios retained), 4 px spacing grid, radii 8/12, scale 12/14/16/20/24/32, tabular numerals. Fonts self-hosted variable woff2. Grid `240px 1fr`, collapse to top drawer below 960 px and bottom bar below 640 px. Dark mode is out of scope for the first release.

## 8. Accessibility and quality gates

- eslint-plugin-jsx-a11y; `@axe-core/playwright` on every route; a keyboard-only Playwright path through each persona's core flow.
- Contrast test over every token pair; screenshot checks at 375, 768 and 1440 px.
- Radix UI or React Aria for Dialog, Popover, Tooltip, Select, Tabs, RadioGroup.
- Focus rules: route change focuses `h1`; drawer traps focus; blocked messages never steal focus.
- Reduced-motion respected.
- Tests: no snake_case or banned words in rendered text; no score or percentage readiness on readiness surfaces; no unscoped "Verified".
- Performance: route code splitting, memoised selectors, telemetry batched and PII-free (replaces the legacy per-event localStorage rewrite).

## 9. Legacy handling

The legacy app stays reachable at `/legacy/*` until parity (Phase 8 exit), then is retired and its journeys rebuilt as guided journeys (O-7). The legacy `data-testid` and `window.__SYMPHONY_*` test hooks are kept only in the legacy app; the new app has its own stable `data-testid` contract documented in the component library so Playwright specs survive markup changes.

## 10. UI acceptance (BDD, tag `@ui`)

Scenarios in `features/10_workspace_and_capabilities.feature` cover: persona navigation and URLs, evidence strip vocabulary, audience-relative labels, outside-process flag, blocked-action semantics, capability-gap visibility, DemoPanel separation, reset confirmation, self-enroller three-screen scope, and the no-score/no-enum tests.
