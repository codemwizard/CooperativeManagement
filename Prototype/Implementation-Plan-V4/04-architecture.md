# 04 — Target Architecture

## 1. Principles

1. **Domain first.** Rules live in a pure TypeScript package; API, UI and tests all call it.
2. **Commands in, events out.** All writes are commands that validate, change state, append events and enqueue outbox messages in one transaction.
3. **Facts, not statuses.** Store source facts and events; derive statuses as projections that can be rebuilt.
4. **Advisory by policy, strict by integrity.** HARD invariants are code and database constraints; POLICY rules are data (`enforcement_mode`).
5. **Strangle, don't rewrite.** The legacy app keeps running while the new workspace is built beside it.
6. **Additive extension.** New metrics and modules add rows and modules, not columns or rewrites (`07`).

## 2. Repository layout

```
Prototype/                       (repo root stays the legacy app — untouched)
  src/ data/ tests/ tools/ ...   legacy: Vite app, engine, 159 + 31 tests
  Implementation-Plan-V4/        this pack
  packages/
    domain/                      pure TS: kernel, enrollment, identity, bylaws, governance,
                                 meetings, evidence, assurance, validation, privacy, extension
    contracts/                   Zod schemas, command/event types, OpenAPI generation
    db/                          SQL migrations (0001 from pack v0.1.1 → 00nn), seeds, repository adapters
    testkit/                     builders, fake clock/ids, in-memory repositories, step helpers
  apps/
    api/                         Fastify: auth, command endpoint, projections, outbox worker
    workspace/                   new React app: workspace shells, React Router
  features/                      Gherkin (copied from this pack when Phase 0 completes)
  docker-compose.yml  .github/workflows/
```

Rules: `domain` imports nothing outside itself (checked by dependency-cruiser). `db` and `api` depend on `domain`. `workspace` depends on `contracts` and `domain` (read-only helpers such as status presenters). Legacy code never imports the new packages, and the new packages never import `src/engine` (the legacy engine is not a library).

## 3. Layers

```
workspace UI ──HTTP──▶ api (auth, validation, serialisation, masking)
                          │
                          ▼
                application services (command bus)
                  1 load aggregate+version  2 resolve actor, capacities, appointments, delegations
                  3 authorise (policy decision)  4 validate preconditions  5 apply domain transition
                  6 persist state  7 append domain event(s)  8 append outbox  9 commit
                          │ ports: Repository, Clock, IdGen, KeyProvider, Outbox, PolicyStore
                          ▼
                    domain (pure)            db (PostgreSQL adapters)
```

Outputs of a command: result, new aggregate version, event ids, **findings produced**. A failed command leaves nothing behind.

## 4. Persistence

PostgreSQL 18 (C:\Program Files\PostgreSQL\18\bin), schema `symphony`. Starting point is the pack's `0001_initial.sql` after the v0.1.1 fixes (`01` §5), extended in this order.

| Migration group | Tables (new or changed) |
|---|---|
| Kernel | `command_receipts`, `domain_events` (append-only trigger), `event_outbox`, `tenants`, `capability_registry` |
| Identity and access | `users`, `persons`, `person_identifiers` (typed, encrypted, blind index), `person_pii_vault`, `consent_records`, `platform_roles`, `permissions`, `role_permissions`, `user_role_assignments`, `capacity_grants`, `delegations`, `authentication_events`, `enrolment_sessions`, `enroller_assignments` |
| Policy | `enforcement_policies`, `duty_matrix_rows` (replaces `record_class_policies`; `03b` §4), `approval_policies`, `precedence_policies`, `position_combination_rules`, `acceptance_policies` (per audience/destination), `retention_policies`, `identity_check_methods` |
| Enrolment | `organizations`, `organization_identifiers`, `organization_enrollment`, `enrolment_handovers` |
| Evidence | `evidence_items` (+ `track` C/R/X), `evidence_versions` (immutable, + `origin`, `stage`), `evidence_support_items`, `evidence_admissions` (+ `kind`: claim admission or duty submission), `record_approvals`, `verification_assignments`, `verification_findings` (+ `assurance_class`, composite FK to assignment version), `platform_checks`, `observation_attestations`, `evidence_disputes` (partial unique open), `evidence_relationships`, `evidence_requirement_links` |
| By-laws and requirements | `bylaw_versions`, `bylaw_documents`, `bylaw_provisions`, `legal_sources` (+ `legal_validation_status`), `requirement_definitions` (catalogue tier), `organization_requirements`, `requirement_sources`, `meeting_rules`, `membership_rules`, `resolution_class_rules` |
| Governance | `governance_profile_versions`, `governance_bodies`, `governance_positions`, `appointments` (+ `enforce_exclusive`), `appointment_events`, `committees`, `committee_memberships`, `terms_of_reference_versions`, `delegated_authorities` |
| Meetings | `meetings`, `meeting_eligible_snapshots`, `meeting_attendance`, `agenda_items`, `motions`, `votes`, `minutes_versions` (immutable), `minutes_approval_events`, `resolutions`, `resolution_effects`, `action_items` |
| Compliance | `compliance_obligations`, `audit_engagements`, `audit_reports`, `education_programmes`, `training_events`, `annual_return_filings` |
| Validation | `validation_rule_versions`, `validation_runs` (immutable), `validation_findings`, `validation_finding_events` |
| Extension | `domain_modules`, `indicator_definitions`, `indicator_observations`, `indicator_calculations` |
| Institutional (Phase 8) | `destinations`, `presentations`, `lender_findings`, `lender_outcomes`, `facilities`, `covenants`, `ta_interventions`, `institution_messages` |

Database rules: immutability triggers on versions, minutes versions, events and runs; **approvals, admissions and findings live in their own tables** so immutable rows are never updated; composite foreign keys tie findings to assigned versions; the exclusion constraint on appointments applies only where `enforce_exclusive = true`; row-level security as defence in depth, never as the only control. Migrations are forward-only SQL with a tested up path and a restore-from-backup down strategy.

## 5. Authorisation

A policy decision takes (action, target, organisation, actor, platform roles, capacities, active appointments, delegations, record-class policy, conflict facts, enforcement mode) and returns one of `allow`, `allow_with_label`, `advise` (allow plus finding), `deny`. Permissions come from data, are versioned, and are checked on the server on every command. UI hiding is cosmetic. Conflict facts (supplier, collector, admitter, approver of the exact version) are computed on `person_id`.

## 6. Privacy engineering

- `KeyProvider` port with `LocalDevKeyProvider` now; `OpenBaoTransitKeyProvider` later. Same interface; swap is configuration.
- Field encryption: AES-256-GCM with a per-person data key wrapped by the provider; deleting the key crypto-shreds the person.
- Blind index: HMAC-SHA-256 of the normalised identifier with a provider-held pepper; supports duplicate detection without decrypting.
- Masking happens in the API serialiser from a field-level policy table. Tests assert no response for union/TA/institution roles contains an identifier pattern.
- Events and logs carry `person_id` only. A log scrubber test scans for NRC-shaped strings.
- Telemetry (UI interaction) is a separate, opt-in, PII-free stream (AUD-005). The legacy zero-network capture rule stays with the legacy app.
- **Test-data mode (ADR-016):** `DATA_MODE=test` accepts only synthetic identifiers from a reserved range; a scheduled `purge_to_seed` job truncates all tenant data and restores the seed set (schema, catalogues, demo tenant), writing a purge audit record; `DATA_MODE=real` refuses to start unless `DATA_RESIDENCY_REGION` is on the approved list and the key provider is not the local dev provider. The same code paths run in both modes, so moving to real data is configuration, not redesign.
- **Temporary credentials:** Argon2id hashes, single use, expiry, forced change, first-login audit event; no credential ever appears in logs or events.

## 7. Offline-tolerant commands (design now, UI later)

Command envelope fields from `03` §9 make a command replayable days later from a device with no connectivity: client-generated ids, `occurred_at` (when it happened) separate from `recorded_at` (when the server saw it), `device_id`, and `expected_version`. Sync is a batch endpoint that applies commands in order, returns per-command results, and preserves both sides on version conflict. The enrolment session attestation is captured on the device and signed into the envelope. Building the offline UI is Phase 9; no schema or command change is needed then.

## 8. Workspace app

The full UI/UX plan (routes, status vocabulary, components, gates) is `09-ui-ux-implementation.md`; this section only fixes the architectural constraints.

- React Router; every record has a URL. `/legacy/*` redirects to the old app during parity.
- Shell: persona switcher (dev only), organisation header, left navigation by area (Identity, Enrolment and authority, By-laws and requirements, Governance, People and appointments, Meetings and resolutions, Committees, Audit and education, Evidence register, Findings and next actions), right-hand **provenance drawer** (extended from the legacy one, with focus trap and focus return).
- `presentEvidence()` and `presentRequirement()` presenters (extending `evidenceChips.ts`) are the only place status vocabulary is produced; a test fails if snake_case enum text reaches rendered output or if a banned word ("compliant", "certified" without authority, bare "verified") appears.
- Every status area shows the **capability-gap chip** when the backing module is `not_implemented`.
- Design tokens, StatusChip with shape cues (not colour only), SummaryTile, StateTable, ActionPanel from the redesign proposal; a11y checks (jsx-a11y, axe in Playwright).
- Demo tooling (persona switch, reset, tours) lives in a separate `DemoPanel` mounted only when `VITE_DEMO=true`.

## 9. Transition from the prototype

| Concern | Approach |
|---|---|
| Evidence standing | `computeStanding(track, origin, events, policies, stage, audience)` is a pure domain function (`03b` §10) shared by API projections and the UI presenters; it is never persisted. |
| Demo data | Importer maps `data/cases.json` into a flagged demo tenant (`is_demo = true`). Demo values are never shown outside it. |
| Evaluate / destinations | Compatibility projection (`04` §4 level projection) feeds a ported `evaluate` in Phase 8; the 30 expected results are the acceptance test. |
| Roles | `roles.json` becomes seed data for `permissions`/`role_permissions`; a build-time check validates every referenced role and capacity exists (fixes the `coop_field_agent` mismatch). |
| Capture schema | Kept for telemetry only. |
| Dossier | Ported in Phase 8, payload unchanged (ADR-021). |
| EQS / ESG Index | Read through input adapters over projections (Phase 8, `07`). |

## 10. Environments and CI

Local: `docker compose up` (PostgreSQL), `npm run dev:api`, `npm run dev:workspace`. CI: install, lint, typecheck, architecture tests, unit and policy tests, DB integration (Postgres service), BDD, trace gate, build, Playwright + axe. The legacy `verify:all` stays a required job. Staging and production hosting follow ADR-016.
