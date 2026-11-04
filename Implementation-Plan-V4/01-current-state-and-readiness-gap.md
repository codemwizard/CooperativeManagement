# 01 — Current State and Readiness Gap

What the project has today, what the upgrade requires, and what must exist before Phase 1 begins. Findings come from reading code and documents on 3 November 2026; nothing was executed.

## 1. Baseline facts

| Area | Today (as read) |
|---|---|
| Stack | Vite + React + TypeScript, static deploy on Vercel (`vercel.json` SPA rewrite), Node ≥25 pinned, Vitest + Playwright, Python reference oracle |
| UI | Role-based linear journeys via `JourneyRouter.tsx` (D24, D32); no URL routing; `RoleGate`; `ProvenanceDrawer`; `evidenceChips.ts` |
| Engine | Pure TS: `applyAction(case, action)` over a JSON `CaseState`; evidence keyed by evidence *type*; events array; `version` counter |
| Persistence | Per-case localStorage envelope (schema 2.0, SHA-256 checksum); explicitly not an audit trail |
| Auth | Persona picker; `actorForRole()` hardcodes actors; `roles.json` is a static action→role table |
| Governance | Fixed Chairman/Secretary/Treasurer in `CoopGovernance.tsx`; `current_officers` is an editable roster; one unversioned `signoff_minutes` event |
| Evidence levels | `asserted / supported / verified` (frozen vocabulary); destinations evaluate against these; 10 cases × 3 destinations = 30 expected results |
| Metrics | EQS (4 of 10 indicators active) and an illustrative ESG Index; both read case JSON |
| Tests | Traceability matrix reports 159 Vitest + 31 Playwright; README still says 27 + 12 (stale) |
| Docs | `AGENT.md`, `DECISIONS.md` (D1–D36) and README describe a no-backend, zero-network prototype — now superseded by ADR-003 |

## 2. Gap table: what the upgrade requires

| # | Capability | Today | Required (source) | Gap | WP |
|---|---|---|---|---|---|
| G1 | Persistence | Browser envelope | PostgreSQL, transactional commands, append-only events, outbox (Spec §12–15) | Entire tier | 1.1–1.4 |
| G2 | Identity and sessions | Persona picker | Authenticated users, stable `user_id`, authentication events, enroller attestation (Spec §4.3) | Entire tier | 1.5 |
| G3 | Authorisation | Static role table + hidden buttons | Server-side policy over platform role, **capacity**, appointment, delegation, source authority (Spec §4.1, §17) | Policy engine | 1.6 |
| G4 | Evidence | Type-keyed JSON, in-place history | Item/version split, admission, official approval, findings, disputes, assurance class (Spec §10) | Remodel | 2.1–2.5 |
| G5 | Internal Field Verifier | `field_agent` role marks verified | Org-bound capacity, `cooperative_internal` assurance, conflict rules (founder brief) | New | 2.4 |
| G6 | Enrolment and handover | `CreateAccountJourney` with hardcoded actor, no-op governance callback | Self/assisted modes, proxy attestation, handover, resumable stages (Spec §5) | New | 2.6–2.8 |
| G7 | By-laws and requirements | None | Versions, provisions, precedence, requirement dimensions, legal catalogue (Spec §6) | New | 3.x |
| G8 | Governance | Three fixed offices | Profiles, bodies, positions, appointments, committees, combinability rules (Spec §7–8) | New | 4.x |
| G9 | Meetings and resolutions | One event | Meetings, quorum snapshots, minutes versions, resolutions, effects (Spec §9) | New | 5.x |
| G10 | Findings engine | `evaluate.ts` for destinations only | Versioned, source-linked findings, next actions (Spec §11) | Extend | 6.x |
| G11 | PII | Roster in plain JSON | Encrypted vault, NRC blind index, masking, consent, retention (decision 4/5) | New | 1.7 |
| G12 | Workspace UI | Journeys, no routes | Workspace shells with routing, status strip, capability gaps | New shell | 1.8 + per phase |
| G13 | Test tooling | Vitest, Playwright, oracle | + BDD runner, DB integration harness, trace gate, a11y checks | Add | 0.3–0.6 |
| G14 | Hosting | Vercel static | API + PostgreSQL in an approved region (residency, ADR-016) | Decision | 0.2 |

## 3. Prerequisites that must exist before Phase 1

| ID | Prerequisite | Owner | Blocking? |
|---|---|---|---|
| P-1 | ADR-001…021 ratified; conflicts C1–C10 ruled (`02`) | Founder | Yes |
| P-2 | Dev environment: Docker (or local PostgreSQL 16+ (C:\Program Files\PostgreSQL\18)), Node pinned, `docker-compose.yml`, CI with a Postgres service. **Docker presence unknown.** | Engineering | Yes |
| P-3 | Repo layout accepted (`04` §2): new workspaces beside the untouched legacy app | Architect | Yes |
| P-4 | Domain Transition Pack v0.1.1 defect fixes (list in §5) | Architect | Yes for WP-1.1 |
| P-5 | Baseline recorded: run `npm run verify:all`, store results as the regression floor | Engineering | Yes |
| P-6 | Hosting/residency decision (ADR-016) | Founder | Before Phase 1 exit, not start |
| P-7 | Legal validation register opened; statutory catalogue seeded as `needs_legal_validation` | Founder + counsel | No (permissive mode) |
| P-8 | Synthetic fixture corpus: by-laws (structure modelled on the illustrative example, not its text), NRC-like identifiers, minutes | Engineering | Before Phase 3 |
| P-9 | Library selections ratified (ADR-005) | Architect | Yes |

## 4. Legacy defects: what must not be ported

The V4 domain is built fresh, not by modifying `engine/actions.ts`. These legacy behaviours are recorded so they are not reproduced:

1. `record_ta_completion` writes evidence level `supported` and is missing from the evidence-mutating action list, so the TA role bypasses `READ_ONLY_ROLE`.
2. `markVerified`, `resolveDispute` and `resolveFindingConflict` write `verified` without a version-matched finding, contradicting the code comment that only two functions may.
3. `add_evidence` on an existing item keeps the same `version_id`; only `amend_claim` increments it.
4. `JourneyRouter` fabricates a finding (`find-static-1`, result `verified`) for `record_reliance` and a presentation for `record_outcome`.
5. `recordReliance` does not check for an open dispute.
6. `signoff_minutes` is unversioned and any sign-off ever recorded satisfies the governance check.
7. Officer names are seeded as fallbacks; the certificate-officer list is treated as a roster.
8. Finding results carry both the legacy (`verified`, `partially_verified`) and the six-outcome vocabularies.

Each is covered by a V4 scenario (`traceability-matrix.md`, "Legacy defect" rows). The legacy app is quarantined (ADR-007); fix only what breaks its own tests.

## 5. Domain Transition Pack defects (v0.1.1 scope)

1. `minutes_versions` immutability trigger blocks `status`/`approved_by`/`approved_at` updates, so `ApproveMinutes` cannot succeed. Move approval to `minutes_approval_events`.
2. `evidence_versions.submission_status` allows `admitted`/`rejected`, which the immutability trigger forbids; admissions live in `evidence_admissions`. Remove those values.
3. No composite constraint forces `verification_findings.evidence_version_id` = its assignment's version (INV-010).
4. No partial unique index for one open dispute per target.
5. `requirements` is cooperative-scoped but destinations are shared; `source_documents.cooperative_id` is NOT NULL for legislation. Add a catalogue tier.
6. Appointment exclusion constraint rejects overlaps unconditionally; permissive mode must record and flag them. Predicate must include `enforce_exclusive` (ADR-008).
7. `users.email_normalized` unique globally; persons need typed identifiers, not an NRC column (people without NRCs exist).
8. Missing tables: consent, PII vault, assurance class, record-class policy, precedence policy, enrolment sessions, capacities, command receipts, capability registry, indicator framework, destinations and the institutional tables the prototype already has.
9. Scenarios SC-001…020 assume reject-on-violation. Each is classed HARD or POLICY (`03` §10) and POLICY scenarios gain an advisory variant.
10. The Python oracle tests helpers defined in the test file; SC-003 and SC-020 assert literals. Replace with executable BDD against real code.

## 6. Documentation to update (Phase 0)

`AGENT.md` and README (static/no-network statements, stale test counts), `DECISIONS.md` (add ADR cross-reference and mark D14, D22, D23, D24, D33 and the X4 zero-network scope superseded **for the new apps only**), `TEST_CASES.md`, `tests/TRACEABILITY_MATRIX.md`. The EQS specification and ESG data files are not edited (ADR-004).
