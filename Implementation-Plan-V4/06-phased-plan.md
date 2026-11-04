# 06 — Phased Plan

Vertical slices, cooperative process first. Sizes: S ≤ 3 days, M ≤ 2 weeks, L > 2 weeks, single engineer, indicative only. Every phase ends with a gate; no phase starts before the previous gate passes, except where marked parallel.

## Phase map

| Phase | Theme | Features (scenarios) | Gate summary |
|---|---|---|---|
| 0 | Decide, prepare, baseline | all skeletons `@wip` | Environment, baseline, pack v0.1.1, trace tool |
| 1 | Kernel, identity, default roles and capacities, shell | 09, part of 02, part of 10 | Commands atomic/idempotent; roles and IFV capacity grantable; PII protected; shell live |
| 2 | **Cooperative enrolment and evidence core, with the Internal Field Verifier** | 01, 03, 04 (claims), 05 | Walking skeleton end to end |
| 3 | By-laws, legal catalogue, requirements | 06 | Precedence, held drafts, legal routing |
| 4 | Governance: positions, appointments, committees | 07 | Combination rules, vacancy, history |
| 5 | Meetings, minutes (duty process), resolutions | 08, 04 (records) | Duty process, quorum snapshots, effects |
| 6 | Compliance (audit, education, annual return), findings and next actions | parts of 06, 10 | Findings engine, ranked actions |
| 7 | Extension framework, operational/ESG scaffolds, EQS adapters | 10 (EXT) | Capability registry live; indicator framework proven by one test indicator |
| 8 | Institutional and legacy port; parity; legacy retirement | legacy parity | 30 expected results match; parity gate |
| 9 | Hardening, offline capture, deployment readiness | non-functional | Offline replay, security review, performance |
| 10 | Guided journeys rebuilt on the workspace | `@journey` | Journeys pass over stable workspace |

## Phase 0 — Decide, prepare, baseline

| WP | Work | Size | Output |
|---|---|---|---|
| 0.1 | Ratify ADRs; resolve O-12 to O-17; log ADR-001 (freeze lifted) in `DECISIONS.md` and mark legacy-only rules | S | Updated `DECISIONS.md`, `AGENT.md`, README |
| 0.2 | Dev environment: Docker or local PostgreSQL, `docker-compose.yml`, CI with Postgres service, Node pin | M | Green empty pipeline |
| 0.3 | Scaffold `packages/*`, `apps/*`, dependency-cruiser rules, tsconfig project references | M | `verify:arch` passes on empty packages |
| 0.4 | Pack v0.1.1 → v0.2: fixes in `01` §5, new tables in `04` §4, migration 0001 rewritten | L | Migrations 0001–0006 applying on empty DB |
| 0.5 | Legal catalogue seed: the two in-force instruments (Act No. 20 of 1998; SI 26 of 1999 with Forms 1–6), the §13 statutory seeds as `text_checked`, all other entries `needs_legal_validation`, Cap. 397 flagged `repealed instrument`; obtain the missing Act sections (O-20) | S | `legal_sources` seed |
| 0.6 | Run legacy `verify:all` and record baseline counts and timings | S | `docs/BASELINE_2026-11.md` |
| 0.7 | Trace tool and Cucumber harness; copy features, mark `@wip`; generate matrix | M | `verify:trace` and `verify:bdd` run |
| 0.8 | Synthetic fixture corpus: by-laws, identifiers (reserved range), minutes | M | `testkit/fixtures` |
| 0.9 | Design tokens, `/components` page, a11y tooling | M | Token and contrast tests |

**Gate 0:** CI green on empty scaffold; baseline recorded; ADRs ratified; no feature code.

## Phase 1 — Kernel, identity, default roles and capacities, shell

| WP | Work | REQ | Size |
|---|---|---|---|
| 1.1 | Command bus: envelope, idempotency, optimistic concurrency, atomic state+event+outbox | AUD-001..003 | L |
| 1.2 | Tenancy and isolation | AUD-004 | M |
| 1.3 | Event store (append-only), outbox worker stub | AUD-001 | M |
| 1.4 | `testkit`, in-memory repository, repository contract suite on PostgreSQL | — | M |
| 1.5 | Authentication: users, sessions, temporary credentials, authentication events | ENR-010, ENR-004 | M |
| 1.6 | Authorisation engine; default role/position/capacity catalogue (`03` §2.1); capacity grants including **Internal Field Verifier** and Field Agent; delegations | VER-001, VER-007, UNI-001 | L |
| 1.7 | PII vault, KeyProvider (local), blind index, consent, masking serializer, retention policy table | PRV-001..005, PRV-008 | L |
| 1.8 | Test-data mode, purge-to-seed, residency switch, identifier guard | PRV-007 | M |
| 1.9 | Workspace shell, routing, context bar, persona navigation, DemoPanel, login and password-change, `presentEvidence` skeleton, CapabilityGap, capability registry | UXW-001..004, EXT-001 | L |

**Gate 1:** scenarios in features 09 and the privacy parts of 02 pass; roles and IFV capacity grantable and revocable with audit; no PII in any union/TA response; purge-to-seed works; `/components` accessible.

## Phase 2 — Cooperative enrolment and evidence core, with the IFV

Walking skeleton: self-enroller records certificate details → creates a Secretary account → hands over → Secretary logs in, admits certificate → enroller platform-checks → authority accepted → workspace active → Secretary uploads minutes (draft) → Chairperson grants IFV capacity to a member → IFV verifies a member claim → status strip shows the right labels for member, official, platform and institution views.

| WP | Work | REQ | Size |
|---|---|---|---|
| 2.1 | Organisation, certificate details, enrolment state machine, activation gate | ENR-001, ENR-007, ENR-009, ID-001 | M |
| 2.2 | Self-enroller placeholder scope (three acts), temporary-credential accounts, handover and closure | ENR-006, ENR-005 | M |
| 2.3 | Assisted enrolment: enrolment sessions, representative presence, proxy entry, identity-check methods | ENR-002..004 | L |
| 2.4 | Evidence core: items/versions (tracks C/R/X), support items, admissions, approvals, disputes | EVD-001..004, EVD-011 | L |
| 2.5 | `computeStanding` with origins, audiences, stages; level projection; property tests | EVD-005..010 | L |
| 2.6 | Observation attestation, platform checks, proxy-operator disclosure flag | EVD-007, VER-007 | M |
| 2.7 | IFV workflow: assignments, findings (exact version), conflict rules on `person_id`, revocation behaviour, assurance classes | VER-001..008 | L |
| 2.8 | Persons, identifiers, NRC duplicate review, fallback identifiers | ID-005 | M |
| 2.9 | Screens: enrolment, Setup Path, Evidence register, Provenance drawer v2, IFV workbench, status strip | UXW-002, UXW-005 | L |
| 2.10 | Offline-tolerant replay test (design check only) | ENR-008 | S |

**Gate 2:** features 01, 03, 05 and claim scenarios of 04 pass in both modes; walking skeleton demonstrated; SC-009..013 equivalents green; all HARD invariants in scope tested.

## Phase 3 — By-laws, legal catalogue, requirements

WPs: 3.1 by-law documents and versions with statuses; 3.2 provisions (manual, import, AI-assisted) with confirmation; 3.3 precedence policy and `held_draft`; 3.4 legal catalogue with programme-manager validation and TA/union advisory routing and the disclaimer; 3.5 requirement definitions and dimensions; 3.6 meeting/membership/resolution rules extraction; 3.7 screens. REQ: BYL-001..009, GOV-008, ID-002..004.
**Gate 3:** feature 06 passes; amendment not operative until released; legal entries never block; precedence reversed rule demonstrated.

## Phase 4 — Governance

WPs: 4.1 governance profile versions, bodies, positions; 4.2 appointments and events, vacancy/combined/unknown states, acting appointments; 4.3 combination rules with enforcement mode and the founder defaults; 4.4 committees and memberships; 4.5 certificate officers as history; 4.6 screens. REQ: GOV-001..007.
**Gate 4:** feature 07 passes in both modes; exclusion constraint conditional on `enforce_exclusive`; SC-002..005, SC-020 equivalents green.

## Phase 5 — Meetings, minutes, resolutions

WPs: 5.1 meetings, eligible-population and rule snapshots, attendance, quorum computation; 5.2 Track R duty process (author/submit/adopt/approve), minutes versions and approvals; 5.3 resolutions, `held_draft`, effects idempotent and atomic; 5.4 by-law amendment flow to submitted state; 5.5 action items; 5.6 screens with DutyProcessTimeline. REQ: MTG-001..006, EVD-008.
**Gate 5:** features 04 (records) and 08 pass; SC-006..008 equivalents green; Duty Matrix rows exercised by table tests.

## Phase 6 — Compliance, findings, next actions

WPs: 6.1 audit engagements and reports, education and training records, annual return filings (separate from certificate); 6.2 validation runs (immutable), findings catalogue (`03` §11), next-action ranking; 6.3 Overview tiles, Findings screen; 6.4 requirement status projection across dimensions. REQ: ID-004, BYL-005, UXW-002..005.
**Gate 6:** every finding rule has a scenario; ranking table tests green; no score on any readiness surface.

## Phase 7 — Extension framework

WPs: 7.1 module registry and contract (`07`); 7.2 indicator framework tables and one test indicator added by data only; 7.3 operational and ESG module spec stubs registered as `not_implemented` with capability gaps visible; 7.4 EQS/ESG Index input adapters over projections, preserving current outputs on fixtures; 7.5 documentation (`08`) kept and linked. REQ: EXT-001..005.
**Gate 7:** adding an indicator requires no migration; EQS fixture outputs identical to legacy; module registry shown in UI.

## Phase 8 — Institutional and legacy port

Port in this order, each behind parity tests against the legacy flow: destinations and `evaluate` via level projection (30 expected results exact), presentation snapshot and dossier (payload unchanged), lender findings/outcomes/reliance with the legacy bugs fixed, verifier (external), PFI six-stage and NABII pipeline, TA interventions, union delegation screens, portfolio/covenants/monitoring, discoverability. Resolve carried open questions (Approved outcome, `roles.json` additions, claim-report readiness, covenant mapping).
**Gate 8 (parity):** 30 expected results match; legacy Playwright journeys have V4 equivalents passing; no legacy-only feature left in the ledger without a ruling; legacy retired by ADR.

## Phase 9 — Hardening, offline capture, deployment readiness

Offline queue and sync, conflict reconciliation UI, performance budgets, security review and threat model, backup/restore, observability without PII, OpenBao `KeyProvider` implementation behind the same interface, deployment to the chosen environment, runbook for moving from test mode to real mode (a checklist, not an action).
**Gate 9:** offline replay scenarios pass; restore drill done; pen-test checklist cleared.

## Phase 10 — Guided journeys

Rebuild role-based guided journeys on top of the stable workspace routes, reusing its components and commands. Scenarios tagged `@journey`. Entry criteria: Gate 9 and workspace stability (no open S1/S2 defects for two weeks).

## Legacy parity ledger

| Legacy feature | Disposition | Phase | Guard |
|---|---|---|---|
| Cooperative journey (8 steps), `CreateAccountJourney` | Replaced by workspace enrolment, later rebuilt as guided journey | 2 / 10 | Features 01 |
| Governance journey (3 offices) | Replaced by governance model | 4 | Feature 07 |
| Evidence engine (levels, promotion, conflicts, disputes) | Re-specified; invariants ported | 2 | SC mapping |
| Destinations, requirement evaluation, 30 results | Ported through level projection | 8 | Golden file |
| Presentation snapshot, dossier | Ported, payload unchanged | 8 | Contract test |
| Lender (PFI) six-stage journey, findings, outcomes, reliance | Ported with legacy bugs fixed | 8 | Parity tests |
| NABII four-state pipeline, directory, discoverability | Ported | 8 | Parity tests |
| TA interventions, institution messages | Ported; union delegation added | 8 | Parity tests |
| VVB/external verifier journey | Ported | 8 | Parity tests |
| Field agent journey | Replaced by Field Agent capacity and IFV | 2 | Feature 05 |
| Portfolio, covenants, monitoring | Ported | 8 | Parity tests |
| EQS, ESG Index | Kept as is, read through adapters | 7 | Fixture parity |
| Tours, help, capture, reset | Legacy only until retirement; new tours with guided journeys; capture becomes telemetry | 8 / 10 | Help-check retained |
| Persistence envelope, forbidden terms, bundle checks | Legacy only | 8 | Retired with legacy |

## Risks

| Risk | Mitigation |
|---|---|
| Scope breadth (many domain areas) | Vertical slices; each gate demonstrates something usable; extension modules stay `not_implemented` visibly |
| Spec ambiguity in permissive mode | Dual-mode scenarios; configuration over code; open items tracked in `02` |
| Legal content unvalidated | Always advisory; programme-manager validation workflow; fixed disclaimer |
| Evidence-model complexity | `computeStanding` pure, table-tested, property-tested; one place for labels |
| Parity drift with legacy | Parity ledger, golden files, legacy suite kept green until retirement |
| Environment unknown (Docker) | WP-0.2 first; in-memory repository allows domain work to proceed |
| PII leakage | Masking serializer, scrubber tests, no PII in events, test-mode guard |
