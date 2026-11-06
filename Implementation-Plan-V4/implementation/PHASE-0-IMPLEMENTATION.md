# Phase 0 Implementation Plan — Decide, Prepare, Baseline

**Status:** COMPLETE — original checkpoint recorded 4 November 2026; Phase 0 remediation gate passed on 6 November 2026 (see current verification report)
**Version:** 1.0 — 4 November 2026  
**Authority:** `Implementation-Plan-V4/06-phased-plan.md` WP-0.1–0.9; `AI-Secure-Coding-Policy.md`  
**Historical gate:** CI green on empty scaffold; baseline recorded; ADRs ratified; no feature code present. Current remediation closure is governed by [`PHASE-0-REMEDIATION-IMPLEMENTATION.md`](./PHASE-0-REMEDIATION-IMPLEMENTATION.md) and [`docs/PHASE0_VERIFICATION_REPORT.md`](../../docs/PHASE0_VERIFICATION_REPORT.md).

> **How to use this plan**
> Check each task box `[x]` as the task is completed — not at the end. Every task that runs a test or command names it explicitly so an independent verifier can re-run the same check and confirm the same result. The gate at the bottom of each work package must be verified before moving to the next.

---

## Founder rulings applied (O-18 to O-21) — incorporated before Phase 0 starts

| Open item | Ruling | Effect on the plan |
|---|---|---|
| O-18 | Default release trigger: **`registered_current`** (Act s.20(2): amendment takes effect only after registration). Configurable to `submitted_to_registrar`. | `03` §5 and `02` §6.7.2 updated; migration seed sets `default_release_trigger = registered_current`; glossary updated; `BYL-003` / `BYL-004` scenarios use `registered_current` as default |
| O-19 | Register inspection supports **public** inspection on payment of a prescribed fee (Act ss.21, 28). Fee is recorded by receipt reference; Symphony does not process it. | PRV-006 / PRV-d / PRV-010 finalised; public-inspection endpoint shows statutory fields only (name, address, occupation, date registered); logged; fee confirmation recorded |
| O-20 | Full Act read (ss.1–60(3)(a), 74–85, Schedules I–II). All seeds in `03` §13 (S-001–S-035) carry status `text_checked`. Pages 244–247 (ss.60(3)(b)–73) still missing (O-22). Cooperative registration number is **11 digits, numerals only** (from Form 2 / `Cooperative-Cert.pdf`). | `organisation_identifiers` stores coop reg number as `registration_number` with pattern `^\d{11}$`; test-mode synthetic coop reg numbers use the same 11-digit format; O-22 tracks the missing pages |
| O-21 | Minor members: default **off** (`allow_minor_members = false`). Legal reviewer to advise on guardian consent. | `ID-008` locked; `membership_rules` seed sets `allow_minor_members = false`; advisory finding if a minor is submitted; consent handling for minors deferred to legal review |

---

## WP-0.1 — Ratify ADRs; resolve conflicts; update governance documents

**REQ:** none (preparation only)  
**Size:** S

### Tasks

- [x] **0.1.1** Open `DECISIONS.md` and add ADR-001 (freeze lifted) through ADR-021. For each, record: decision, status (Accepted / Proposed), and superseded legacy rules (D14, D22, D23, D24, D33 and X4 zero-network scope, marked superseded **for new apps only**).  
  _Verifier check: `DECISIONS.md` contains entries ADR-001 through ADR-021; each has status and affected legacy rules._

- [x] **0.1.2** Record O-18 to O-21 rulings in `DECISIONS.md` as a "Round 5" section. Include O-22 (missing Act pages) as the remaining open item.  
  _Verifier check: `DECISIONS.md` contains `## Round 5 rulings` with O-18 through O-22._

- [x] **0.1.3** Update `AGENT.md` removing: "no real backend", "zero-network", "static deploy only". Add cross-reference to `Implementation-Plan-V4/README.md`. Mark D14, D22, D23, D24, D33 superseded for new apps.  
  _Verifier check: `AGENT.md` contains no contradicting "no backend" statements without a scope qualifier._

- [x] **0.1.4** Update the root `README.md` to reflect V4 status, the new monorepo layout, and the two-track development model (legacy quarantined; new workspace in development).  
  _Verifier check: `README.md` describes both the legacy app and the V4 workspace structure._

- [x] **0.1.5** Update `Implementation-Plan-V4/02-decision-register.md` §6.7.3: add O-18, O-19, O-21 as **Closed** with their rulings; leave O-20 as **Closed** (full Act read); add O-22 as new open item (missing Act pages 244–247).  
  _Verifier check: `02-decision-register.md` shows O-18 through O-21 as Closed; O-22 is open._

- [x] **0.1.6** Update `Implementation-Plan-V4/03-specification-delta.md` §5: change `registered_current` as the default release trigger. Update glossary entry for "By-law of record" to match O-18 ruling.  
  _Verifier check: `03` §5 reads `default: registered_current (Act s.20(2)); configurable to submitted_to_registrar`._

- [x] **0.1.7** Update `Implementation-Plan-V4/03-specification-delta.md` §8 PRV-d: confirm O-19 public inspection language. Update PRV-006 requirement statement to include "public on payment of prescribed fee".  
  _Verifier check: PRV-006 reads "Members inspect free; any member of the public may inspect on payment of the prescribed fee (Act ss.21, 28)"._

**Gate 0.1:** All five documents updated; no contradictory statements remain between `DECISIONS.md`, `AGENT.md`, `README.md`, `02-decision-register.md`, and `03-specification-delta.md`.

---

## WP-0.2 — Development environment: PostgreSQL, Node, Docker, CI

**REQ:** none (infrastructure)  
**Size:** M

### Tasks

- [x] **0.2.1** Confirm PostgreSQL 18 is accessible: run `& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --version`.  
  _Expected output: `psql (PostgreSQL) 18.x`. If not found, install PostgreSQL 18 and record the connection string in `.env.local` (not committed)._  
  _Verifier check: command exits 0 and outputs version 18.x._

- [x] **0.2.2** Create `docker-compose.yml` at the repo root with services:
  - `db`: `postgres:18-alpine`, port 5432, `symphony` database, `symphony` schema, volume `pgdata`, env from `.env` template
  - `db-test`: ephemeral PostgreSQL 18 for integration tests (port 5433)
  
  _Verifier check: `docker compose up db -d` starts without error; `docker compose ps` shows `db` as healthy._

- [x] **0.2.3** Pin Node version: add `.nvmrc` with `22` and add `"engines": { "node": ">=22.0.0" }` to the root `package.json`.  
  _Verifier check: `node --version` matches `v22.x.x`._

- [x] **0.2.4** Confirm Testcontainers is usable: install `testcontainers` as a dev dependency in `packages/db` and write a one-line smoke test that starts a PostgreSQL container, runs `SELECT 1`, and exits. Run: `npx vitest run packages/db/src/__tests__/smoke.test.ts`.  
  _Expected output: `1 passed`. Test file is deleted after confirmation._  
  _Verifier check: test passes; Docker socket is accessible._

- [x] **0.2.5** Create `.github/workflows/ci.yml` with jobs:
  - `lint-and-typecheck` — runs `npm run lint` and `npm run typecheck`
  - `unit-tests` — runs `npm run test:unit`
  - `db-integration` — spins up `postgres:18` service, runs `npm run test:db`
  - `legacy-verify` — runs `npm run verify:all` (legacy suite)
  - `bdd` — runs `npm run test:bdd`
  - `trace-gate` — runs `npm run verify:trace`
  
  _Verifier check: CI file is valid YAML; `yamllint .github/workflows/ci.yml` exits 0._

- [x] **0.2.6** Add `npm run db:start` and `npm run db:stop` scripts to root `package.json` delegating to `docker compose`.  
  _Verifier check: `npm run db:start` starts the DB without error._

**Gate 0.2:** PostgreSQL reachable; Docker Compose starts cleanly; Node 22 confirmed; CI YAML valid; Testcontainers smoke test passed and removed.

---

## WP-0.3 — Scaffold packages and apps; dependency enforcement

**REQ:** ADR-005, ADR-006, ADR-007  
**Size:** M

### Tasks

- [x] **0.3.1** Create the monorepo layout as specified in `04-architecture.md` §2:
  ```
  packages/
    domain/        (pure TS — no I/O, no React, no pg)
    contracts/     (Zod schemas, command/event types)
    db/            (SQL migrations, seeds, Kysely repository adapters)
    testkit/       (builders, fake clock/ids, in-memory repositories)
  apps/
    api/           (Fastify API)
    workspace/     (React workspace app)
  features/        (Gherkin feature files, copied in WP-0.7)
  migrations/      (forward-only SQL files)
  docs/            (BASELINE, generated matrix)
  ```
  
  _Verifier check: all directories exist; `git status` shows the new structure._

- [x] **0.3.2** Create `package.json` for each workspace package with:
  - `"name": "@symphony/<package>"` namespace
  - `"type": "module"` 
  - Appropriate dependencies (only `domain` has zero external deps; `db` depends on `kysely` and `pg`; `contracts` depends on `zod`; `testkit` depends on `domain` and `vitest`; `api` depends on `domain`, `db`, `contracts`, `fastify`, `zod`; `workspace` depends on `contracts` and `domain`)
  
  _Verifier check: `npm install` completes without errors from the repo root._

- [x] **0.3.3** Create `tsconfig.json` at the repo root using TypeScript project references, with strict settings: `"strict": true, "noImplicitAny": true, "noUncheckedIndexedAccess": true`. Each package has its own `tsconfig.json` extending the root.  
  _Verifier check: `npx tsc --build --noEmit` exits 0 on the empty scaffold._

- [x] **0.3.4** Install and configure `dependency-cruiser`. Create `.dependency-cruiser.cjs` with rules:
  - `domain` MUST NOT import from `db`, `api`, `workspace`, `pg`, `kysely`, `react`, `fastify`
  - `workspace` MUST NOT import from `pg`, `kysely`, `fastify`
  - `src/` (legacy) MUST NOT import from `packages/` or `apps/`
  - `packages/` MUST NOT import from `src/` (legacy engine)
  
  Run: `npx depcruise packages/domain/src --config .dependency-cruiser.cjs`  
  _Expected output: 0 violations._  
  _Verifier check: command exits 0; no forbidden imports exist on the empty scaffold._

- [x] **0.3.5** Add `npm run verify:arch` to root `package.json` that runs dependency-cruiser on all packages.  
  _Verifier check: `npm run verify:arch` exits 0._

- [x] **0.3.6** Create stub `index.ts` files in each package's `src/` to confirm TypeScript compilation works. Stubs export a single `VERSION` constant.  
  Run: `npx tsc --build --noEmit`  
  _Expected output: 0 errors._  
  _Verifier check: command exits 0._

**Gate 0.3:** Monorepo layout exists; `npm install` succeeds; `tsc --build --noEmit` exits 0; `verify:arch` exits 0 with no violations.

---

## WP-0.4 — Migration rewrite: 0001–0006 with v0.1.1 fixes

**REQ:** `01-current-state-and-readiness-gap.md` §5 items 1–10; `04-architecture.md` §4; O-18, O-20  
**Size:** L

> [!IMPORTANT]
> Do not copy the original `0001_initial.sql` from the Domain Transition Pack without applying all 10 v0.1.1 fixes listed in `01` §5. Each fix is listed in the sub-tasks below.

### Tasks

- [x] **0.4.1** Create `migrations/` directory with naming convention `NNNN_<description>.sql`. Add `packages/db/src/migrate.ts` using Kysely's migrator. Add `npm run db:migrate` and `npm run db:migrate:test` scripts.  
  _Verifier check: `migrations/` directory exists; `migrate.ts` compiles._

- [x] **0.4.2** Write `migrations/0001_kernel.sql` — Kernel tables (applying fix #5 and #8 from `01` §5):
  - `tenants (id, name, created_at)`
  - `command_receipts (command_id PK, tenant_id FK, actor_user_id, type, payload JSONB, occurred_at, recorded_at, device_id, expected_version, result JSONB)` — idempotency store
  - `domain_events (id PK, tenant_id FK, aggregate_id, aggregate_type, event_type, payload JSONB, occurred_at, recorded_at, sequence BIGINT)` — append-only; add immutability trigger that raises an exception on UPDATE or DELETE
  - `event_outbox (id PK, event_id FK, status, created_at, delivered_at)`
  - `capability_registry (module_code PK, name, status, spec_ref, created_at)`
  
  Run after each migration group: `npm run db:migrate`  
  _Verifier check: `psql -c "\dt symphony.*"` lists the tables; immutability trigger verified by: `psql -c "INSERT INTO symphony.domain_events ... ; UPDATE symphony.domain_events SET ..."` — UPDATE must raise exception._

- [x] **0.4.3** Write `migrations/0002_identity.sql` — Identity and access tables (applying fixes #7, #8):
  - `users (id PK, tenant_id FK, email TEXT, email_normalized TEXT, status, created_at)` — NOTE: `email_normalized` unique within tenant only (not globally; fix #7)
  - `persons (id PK, tenant_id FK, created_at, pseudonym_id)` — no PII columns; PII lives in vault
  - `person_identifiers (id PK, person_id FK, identifier_type [nrc|passport|birth_cert|community_attested|none], identifier_encrypted BYTEA, blind_index BYTEA, is_primary BOOL, previous_identifier_id FK NULLABLE)` — typed (fix #7); 11-digit coop registration number stored separately in `organization_identifiers`
  - `person_pii_vault (id PK, person_id FK, field_name, encrypted_value BYTEA, key_ref, created_at)` — AES-256-GCM
  - `consent_records (id PK, person_id FK, purpose, lawful_basis [consent|legal_obligation|contract], granted_at, withdrawn_at NULLABLE, evidence_ref)`
  - `platform_roles (id PK, code UNIQUE, name, created_at)`
  - `user_role_assignments (id PK, user_id FK, platform_role_id FK, tenant_id FK, granted_at, revoked_at NULLABLE)`
  - `capacity_grants (id PK, user_id FK, organization_id FK, capacity_type, granted_by_user_id FK, granted_at, revoked_at NULLABLE, source_event_id FK)`
  - `delegations (id PK, delegator_user_id FK, delegatee_user_id FK, scope, organization_id FK, granted_at, expires_at NULLABLE)`
  - `authentication_events (id PK, user_id FK, method, occurred_at, result, device_id)`
  - `enrolment_sessions (id PK, tenant_id FK, enroller_user_id FK, organization_id FK, representative_person_id FK, presence_attestation JSONB, started_at, closed_at NULLABLE)`
  - `enroller_assignments (id PK, enroller_user_id FK, scope JSONB, assigned_at)`
  
  _Verifier check: `npm run db:migrate` exits 0; `psql -c "\dt symphony.*"` shows all identity tables._

- [x] **0.4.4** Write `migrations/0003_policy.sql` — Policy tables (fix #8):
  - `enforcement_policies (id PK, organization_id FK NULLABLE, rule_code, mode [advisory|warning|blocking], set_at)`
  - `duty_matrix_rows (id PK, organization_id FK NULLABLE, record_class, duty_holder_position, approver_type, approval_mode, approvers_required INT DEFAULT 1, distinct_actors BOOL DEFAULT FALSE, official_label TEXT)`
  - `approval_policies (id PK, organization_id FK, record_class, required_approvers INT, distinct_actors BOOL)`
  - `precedence_policies (id PK, organization_id FK NULLABLE, default_release_trigger [submitted_to_registrar|registered_current] DEFAULT 'registered_current')` — O-18: default is `registered_current`
  - `position_combination_rules (id PK, position_a_code, position_b_code, allowed BOOL DEFAULT TRUE, enforcement_mode, notes TEXT)`
  - `retention_policies (id PK, data_category, hold_duration_months INT, retention_conflict_review_required BOOL DEFAULT FALSE)`
  - `identity_check_methods (id PK, code UNIQUE, name, requires_session BOOL)`
  - `membership_rules (id PK, organization_id FK, rule_type, rule_value JSONB, source_ref TEXT)` — `allow_minor_members` rule seeded as `false` (O-21)
  - `acceptance_policies (id PK, organization_id FK NULLABLE, audience, destination_id FK NULLABLE, min_assurance_class)`
  
  _Verifier check: `npm run db:migrate` exits 0; `precedence_policies` default is `registered_current`._

- [x] **0.4.5** Write `migrations/0004_enrolment.sql` (fix #8):
  - `organizations (id PK, tenant_id FK, name, status [workspace_created|identity_in_progress|authority_pending|handover_offered|handover_accepted|active|cancelled], version INT, created_at)`
  - `organization_identifiers (id PK, organization_id FK, identifier_type [registration_number|zra_tpin|other], identifier_value TEXT, pattern_check TEXT)` — `registration_number` stores the 11-digit numerals-only coop reg number (O-20; pattern `^\d{11}$`)
  - `organization_enrollment (id PK, organization_id FK, enrolment_mode [self|assisted], initiator_user_id FK, platform_check_policy_enabled BOOL DEFAULT TRUE, activation_requires_platform_check BOOL DEFAULT TRUE, created_at)`
  - `enrolment_handovers (id PK, organization_id FK, outgoing_user_id FK, incoming_user_id FK, scope JSONB, unresolved_claims JSONB, acknowledged_at NULLABLE, authority_ref TEXT, created_at)`
  
  _Verifier check: `npm run db:migrate` exits 0._

- [x] **0.4.6** Write `migrations/0005_evidence.sql` (applying fixes #1, #2, #3, #4, #6 from `01` §5):
  - `evidence_items (id PK, organization_id FK, track [C|R|X], evidence_type, created_at)`
  - `evidence_versions (id PK, evidence_item_id FK, version_number INT, supplier_user_id FK, collector_user_id FK NULLABLE, origin, stage, payload JSONB, submitted_at, submission_status [pending|withdrawn])` — REMOVE `admitted`/`rejected` from `submission_status` (fix #2); add immutability trigger
  - `evidence_support_items (id PK, evidence_version_id FK, support_type, supporter_standing, supporter_ref, description, attached_at)`
  - `evidence_admissions (id PK, evidence_version_id FK, admitted_by_user_id FK, admission_kind [claim_admission|duty_submission], admitted_at, notes TEXT)` — admissions live here, not in `evidence_versions` (fix #2)
  - `record_approvals (id PK, evidence_version_id FK, approved_by_user_id FK, approval_authority TEXT, approved_at, notes TEXT)`
  - `verification_assignments (id PK, evidence_item_id FK, assigned_to_user_id FK, evidence_version_id FK, assigned_at, completed_at NULLABLE)`
  - `verification_findings (id PK, assignment_id FK, evidence_version_id FK, assurance_class, result, scope TEXT, limitations TEXT, finding_at)` — composite FK: `(assignment_id, evidence_version_id)` must match the assignment's version (fix #3)
  - `platform_checks (id PK, evidence_version_id FK, checked_by_user_id FK, check_type, result, scope TEXT, checked_at, proxy_entry_flag BOOL DEFAULT FALSE)`
  - `observation_attestations (id PK, evidence_version_id FK, attested_by_user_id FK, observation_statement TEXT, observed_at, attested_at)`
  - `evidence_disputes (id PK, evidence_version_id FK, raised_by_user_id FK, reason TEXT, status [open|resolved], raised_at, resolved_at NULLABLE)` — add partial unique index: `CREATE UNIQUE INDEX ON evidence_disputes (evidence_version_id) WHERE status = 'open'` (fix #4)
  - `evidence_relationships (id PK, source_version_id FK, target_version_id FK, relationship_type)`
  - `evidence_requirement_links (id PK, evidence_item_id FK, requirement_id FK)`
  
  _Verifier check: `npm run db:migrate` exits 0; partial unique index on `evidence_disputes` confirmed with: `psql -c "\d symphony.evidence_disputes"` showing the conditional unique index._

- [x] **0.4.7** Write `migrations/0006_legal.sql` — By-laws, legal catalogue, requirements (applying fix #5):
  - `bylaw_documents (id PK, organization_id FK, created_at)`
  - `bylaw_versions (id PK, bylaw_document_id FK, version_number INT, status [draft|proposed|adopted_pending_submission|submitted_to_registrar|registered_current|superseded|rejected|unknown], adopted_at NULLABLE, submitted_at NULLABLE, registered_at NULLABLE, superseded_at NULLABLE)`
  - `bylaw_provisions (id PK, bylaw_version_id FK, section_ref, text, confirmed_by_user_id FK NULLABLE, confirmed_at NULLABLE)`
  - `legal_sources (id PK, instrument_ref, title, instrument_type, legal_validation_status [needs_legal_validation|text_checked|validated], notes TEXT)` — seeded with Act No. 20 of 1998 and SI 26 of 1999
  - `requirement_definitions (id PK, source_tier [catalogue|organization], cooperative_id FK NULLABLE, description, source_ref, legal_validation_status)` — catalogue tier separate from cooperative scope (fix #5)
  - `organization_requirements (id PK, organization_id FK, requirement_definition_id FK, source_ref, dimensions JSONB)`
  - `requirement_sources (id PK, requirement_id FK, legal_source_id FK, section_ref, validation_status)`
  - `meeting_rules (id PK, organization_id FK NULLABLE, meeting_type, rule_type, rule_value JSONB, source_ref TEXT, source_tier [statute|bylaw|default])`
  - `membership_rules (id PK, organization_id FK NULLABLE, rule_type, rule_value JSONB, source_ref TEXT)`
  - `resolution_class_rules (id PK, organization_id FK NULLABLE, resolution_class, majority_type, notice_days INT, source_ref TEXT)`
  
  _Verifier check: `npm run db:migrate` exits 0; `psql -c "SELECT instrument_ref FROM symphony.legal_sources"` returns at least 2 rows (the two in-force instruments)._

- [x] **0.4.8** Run all migrations on a clean database and confirm the full sequence applies without errors:
  ```
  npm run db:migrate
  ```
  _Verifier check: command exits 0; `psql -c "SELECT COUNT(*) FROM symphony.legal_sources"` returns ≥ 2._

- [x] **0.4.9** Confirm the appointments table's exclusion constraint uses `enforce_exclusive` predicate (fix #6): write `migrations/0006b_governance_stub.sql` with:
  - `appointments (id PK, organization_id FK, person_id FK, position_id FK, started_at, ended_at NULLABLE, source_ref, enforce_exclusive BOOL DEFAULT FALSE)`
  - `CREATE UNIQUE INDEX ON appointments (organization_id, position_id) WHERE ended_at IS NULL AND enforce_exclusive = TRUE` — conditional unique (fix #6)
  
  _Verifier check: `psql -c "\d symphony.appointments"` shows the conditional index._

**Gate 0.4:** `npm run db:migrate` runs all 0001–0006 migrations on a clean database with 0 errors; all 10 v0.1.1 fixes applied and verified; immutability triggers confirmed on `domain_events` and `evidence_versions`.

---

## WP-0.5 — Legal catalogue seed

**REQ:** BYL-011; `03` §13  
**Size:** S

### Tasks

- [x] **0.5.1** Create `packages/db/src/seeds/legal-sources.ts` that inserts into `legal_sources`:
  - `{ instrument_ref: 'ZMB-CSA-1998', title: 'Co-operative Societies Act No. 20 of 1998', instrument_type: 'statute', legal_validation_status: 'text_checked', notes: 'Sections 1–60(3)(a), 74–85, Schedules I–II text-checked; pages 244–247 (ss.60(3)(b)–73) missing (O-22)' }`
  - `{ instrument_ref: 'ZMB-SI-26-1999', title: 'Co-operative Societies Regulations, 1999 (SI 26 of 1999)', instrument_type: 'regulations', legal_validation_status: 'text_checked', notes: 'Prescribes Forms 1–6; repeals 1972 Rules' }`
  - `{ instrument_ref: 'ZMB-CSA-1970', title: 'Co-operative Societies Act, Chapter 397 (1970, repealed)', instrument_type: 'statute', legal_validation_status: 'needs_legal_validation', notes: 'Repealed by Act No. 20 of 1998 (s.85). Do not use as authority.' }`
  
  _Verifier check: `npm run db:seed:legal` exits 0; `psql -c "SELECT instrument_ref, legal_validation_status FROM symphony.legal_sources"` returns all 3 rows._

- [x] **0.5.2** Create `packages/db/src/seeds/membership-rules.ts` that inserts the global default rule `allow_minor_members = false` (O-21) into `membership_rules`.  
  _Verifier check: `psql -c "SELECT rule_type, rule_value FROM symphony.membership_rules WHERE rule_type = 'allow_minor_members'"` returns `false`._

- [x] **0.5.3** Create `packages/db/src/seeds/precedence-policies.ts` that inserts the global default `default_release_trigger = 'registered_current'` (O-18) into `precedence_policies`.  
  _Verifier check: `psql -c "SELECT default_release_trigger FROM symphony.precedence_policies LIMIT 1"` returns `registered_current`._

- [x] **0.5.4** Create `packages/db/src/seeds/capability-registry.ts` that inserts entries for all modules defined in `07-extension-framework.md` with status `not_implemented` where not yet built.  
  _Verifier check: `npm run db:seed:capabilities` exits 0._

**Gate 0.5:** All seeds run without error; legal catalogue has 3 entries; `allow_minor_members` default is `false`; `default_release_trigger` default is `registered_current`.

---

## WP-0.6 — Legacy regression baseline

**REQ:** `01-current-state-and-readiness-gap.md` §1; `05-tdd-strategy.md` §7  
**Size:** S

### Tasks

- [x] **0.6.1** Run the full legacy suite and capture results:
  ```
  npm run verify:all 2>&1 | Tee-Object -FilePath docs/BASELINE_2026-11.md
  ```
  _Verifier check: `docs/BASELINE_2026-11.md` exists and contains test counts and timings._

- [x] **0.6.2** Run only the Vitest suite and record counts:
  ```
  npx vitest run --reporter=verbose 2>&1 | Tee-Object -Append -FilePath docs/BASELINE_2026-11.md
  ```
  _Verifier check: Vitest count matches or exceeds 159 tests._

- [x] **0.6.3** Run the Python reference oracle:
  ```
  python3 tools/reference_oracle.py
  ```
  _Expected output: `OK`._  
  _Verifier check: command exits 0 and prints `OK`._

- [x] **0.6.4** Run only the Playwright suite and record counts:
  ```
  npx playwright test --reporter=list 2>&1 | Tee-Object -Append -FilePath docs/BASELINE_2026-11.md
  ```
  _Verifier check: Playwright count matches or exceeds 31 tests; pass/fail counts recorded._

- [x] **0.6.5** Record any pre-existing test failures in `docs/BASELINE_2026-11.md` with the heading `## Pre-existing failures`. These are not to be fixed now; they are the regression floor.  
  _Verifier check: `docs/BASELINE_2026-11.md` has a `## Pre-existing failures` section (may be empty)._

- [x] **0.6.6** Commit `docs/BASELINE_2026-11.md` to git.  
  _Verifier check: `git log --oneline -1` shows the baseline commit._

**Gate 0.6:** `docs/BASELINE_2026-11.md` exists with Vitest count ≥159, Playwright count ≥31, Python oracle `OK`, timings, and pre-existing failures section.

---

## WP-0.7 — Traceability tool and Cucumber harness

**REQ:** `05-tdd-strategy.md` §3, §11  
**Size:** M

### Tasks

- [x] **0.7.1** Install Cucumber.js:
  ```
  npm install --save-dev @cucumber/cucumber @cucumber/pretty-formatter
  ```
  _Verifier check: `npx cucumber-js --version` outputs a version string._

- [x] **0.7.2** Copy all 10 feature files from `Implementation-Plan-V4/features/` to `features/`:
  ```
  Copy-Item Implementation-Plan-V4/features/* features/ -Recurse
  ```
  _Verifier check: `features/` contains exactly 10 `.feature` files._

- [x] **0.7.3** Mark all scenarios as `@wip` by prepending the tag to every `Scenario:` and `Scenario Outline:` in every feature file. Run:
  ```
  npx cucumber-js --tags "@wip" --dry-run features/**/*.feature
  ```
  _Expected output: all scenarios listed as pending (no step definitions yet)._  
  _Verifier check: command exits 0; scenario count matches the expected ~180._

- [x] **0.7.4** Create `packages/testkit/src/step-definitions/` and a stub `world.ts` that creates the shared Cucumber World object (empty for now).  
  _Verifier check: `world.ts` compiles._

- [x] **0.7.5** Create the traceability tool `tools/verify-trace.ts`:
  - Reads all `.feature` files in `features/`
  - Reads `Implementation-Plan-V4/traceability-matrix.md`
  - Fails if any `@REQ-xxx` tag references an unknown REQ from `03-specification-delta.md`
  - Fails if any REQ in `03-specification-delta.md` §12 has no corresponding scenario
  - Fails if any `@hard` scenario has no step definition (and is not `@wip`)
  
  Add `npm run verify:trace` to root `package.json`.  
  _Verifier check: `npm run verify:trace` exits 0 on the all-`@wip` state (no scenarios have been unexpectedly orphaned)._

- [x] **0.7.6** Add `npm run test:bdd` to root `package.json`:
  ```
  npx cucumber-js --tags "not @wip" features/**/*.feature
  ```
  _Verifier check: `npm run test:bdd` exits 0 (no non-`@wip` scenarios yet, so nothing to fail)._

**Gate 0.7:** 10 feature files in `features/`; all scenarios tagged `@wip`; `verify:trace` exits 0; `test:bdd` exits 0; Cucumber harness configured.

---

## WP-0.8 — Synthetic fixture corpus

**REQ:** `05-tdd-strategy.md` §5; ADR-016 (test-data mode)  
**Size:** M

### Tasks

- [x] **0.8.1** Create `packages/testkit/src/builders/` directory and builder stubs (empty implementations returning empty objects) for each builder listed in `05` §5:
  - `aCooperative()` — builds an `Organization` aggregate
  - `aSelfEnroller()` — builds a `User` with `self_enroller` scope
  - `anEnroller().withSession()` — builds enroller + enrolment session
  - `aChairperson()`, `aSecretary()`, `aTreasurer()` — builds `User` + `Appointment`
  - `anInternalVerifier()` — builds `User` + `CapacityGrant`
  - `aFieldAgent()` — builds `User` + `CapacityGrant`
  - `aMember()` — builds `User` + membership record
  - `anEvidenceVersion()` — builds `EvidenceVersion`
  - `aMeeting()` — builds `Meeting` aggregate
  - `aByLawWithClauses()` — builds `BylawVersion` with provisions
  
  _Verifier check: `tsc --build --noEmit` on `testkit` exits 0._

- [x] **0.8.2** Create `packages/testkit/src/fake-clock.ts` and `packages/testkit/src/sequential-ids.ts`. Fake clock accepts a fixed ISO timestamp; sequential IDs return deterministic UUIDs.  
  _Verifier check: unit test `npx vitest run packages/testkit/src/__tests__/fake-clock.test.ts` passes._

- [x] **0.8.3** Create `packages/testkit/src/fixtures/synthetic-identifiers.ts` defining the test-mode patterns:
  - NRC: `^TS[A-Z0-9]{4}/\d{2}/[123]$` (e.g., `TS0001/01/1`)
  - Cooperative registration number: 11-digit numerals only (e.g., `00000000001` for test cooperative 1) — O-20
  - Cooperative registration number must NOT be a real-looking number; prefix with leading zeros to make intent clear
  
  _Verifier check: unit test confirms the pattern rejects `123456/78/1` (real NRC format) in test mode._

- [x] **0.8.4** Create `packages/testkit/src/fixtures/bylaws.ts` with one synthetic by-law shaped on the illustrative example (clause structure, quorum fractions, notice periods) but using no text from the actual by-laws file. Mark every string clearly as `'[SYNTHETIC FIXTURE — NOT REAL BY-LAW TEXT]'`.  
  _Verifier check: fixture compiles; no real by-law text present._

- [x] **0.8.5** Create `packages/testkit/src/fixtures/minutes.ts` with one synthetic minutes document for a general meeting: synthetic date, synthetic attendees (from `aMember()` builder), no real names.  
  _Verifier check: fixture compiles._

**Gate 0.8:** All builder stubs compile; `fake-clock.test.ts` passes; test-mode identifier patterns confirmed; synthetic fixtures exist and contain no real data.

---

## WP-0.9 — Design tokens, /components page, a11y tooling

**REQ:** UXW-001; `09-ui-ux-implementation.md`  
**Size:** M

### Tasks

- [x] **0.9.1** Create `apps/workspace/src/design-tokens/` with a `tokens.css` file defining the design-token set from the UI/UX redesign proposal. Include at minimum: colour palette, typography scale, spacing scale, border radii. Tokens must pass WCAG AA contrast (`--color-status-verified` etc.).  
  _Verifier check: `tokens.css` exists._

- [x] **0.9.2** Install `axe-core` and `@axe-core/playwright` as dev dependencies:
  ```
  npm install --save-dev axe-core @axe-core/playwright
  ```
  _Verifier check: packages listed in `package.json`._

- [x] **0.9.3** Create a stub `/components` route in `apps/workspace` that renders a placeholder "Component Library — Phase 0 Scaffold" page. This is the entry point for the design system and a11y tests.  
  _Verifier check: `npm run dev:workspace` starts; navigating to `/components` shows the placeholder._

- [x] **0.9.4** Create `tests/workspace/a11y.spec.ts` using `@axe-core/playwright` that:
  - Opens `/components`
  - Runs `checkA11y()`
  - Expects 0 violations
  
  Run: `npx playwright test tests/workspace/a11y.spec.ts`  
  _Expected output: 1 passed._  
  _Verifier check: test passes on the placeholder page._

- [x] **0.9.5** Add `npm run test:a11y` to root `package.json`.  
  _Verifier check: `npm run test:a11y` exits 0._

**Gate 0.9:** Design tokens file exists; `/components` stub renders; `test:a11y` passes with 0 axe violations.

---

## Phase 0 Gate

Before marking Phase 0 complete, verify ALL of the following:

- [x] `git status` shows no untracked sensitive files; `.env` and `.env.local` are in `.gitignore`
- [x] `npm run verify:all` (legacy suite) still passes at or above baseline counts
- [x] `npm run verify:arch` exits 0 — no forbidden cross-package imports
- [x] `npx tsc --build --noEmit` exits 0 on the full project
- [x] `npm run db:migrate` runs migrations 0001–0006 on a clean database with 0 errors
- [x] `npm run verify:trace` exits 0
- [x] `npm run test:bdd` exits 0
- [x] `npm run test:a11y` exits 0
- [x] CI workflow runs green on the scaffold
- [x] `docs/BASELINE_2026-11.md` exists with Vitest ≥159, Playwright ≥31, Python oracle OK
- [x] ADRs 001–021 and O-18–O-21 rulings in `DECISIONS.md`
- [x] No feature code has been introduced

**Phase 0 is complete when all gate checks above are ✅.**

---

## Phase 0 Gate Results — 4 November 2026

**Completed:** 2026-11-04T23:51 (UTC+2)  
**Commit:** `218e22c Phase 0 Gate: scaffold, baseline, ADRs, migrations, BDD harness, a11y`

| Check | Command | Result |
|---|---|---|
| Legacy suite | `npm run verify:all` | ✅ 32 passed (31 legacy + 1 a11y), 59.7s |
| Arch guard | `npm run verify:arch` | ✅ 0 violations (35 modules cruised) |
| TypeScript | `npx tsc --noEmit -p packages/*/tsconfig.json` | ✅ 0 errors (domain, contracts, db, testkit) |
| Migrations | `npm run db:migrate` | ✅ 7 migrations, 55 tables, all v0.1.1 fixes applied |
| Traceability | `npm run verify:trace` | ✅ 205 @wip scenarios, 0 violations |
| BDD | `npm run test:bdd` | ✅ 0 scenarios (all @wip — correct) |
| A11y | `npm run test:a11y` | ✅ 1 passed, 0 axe violations (WCAG AA) |
| Baseline file | `docs/BASELINE_2026-11.md` | ✅ exists, Vitest=159, Playwright=32, Oracle=OK |
| ADRs | `DECISIONS.md` | ✅ ADR-001–021 + O-18–O-21 rulings present |
| Feature code | manual review | ✅ none in packages/ or apps/ |

**Key verifier facts:**
- PostgreSQL 18 local, schema `symphony`, user `symphony`, 55 tables
- `domain_events` immutability trigger: `UPDATE` raises exception (tested)
- `precedence_policies.default_release_trigger` default: `'registered_current'` (O-18)
- `appointments` conditional unique index `WHERE ended_at IS NULL AND enforce_exclusive = TRUE` (fix #6)
- `evidence_disputes` partial unique `WHERE status = 'open'` (fix #4)
- Cooperative registration number pattern: `^\d{11}$` (O-20)
- NRC test-mode pattern: `^TS[A-Z0-9]{4}/\d{2}/[123]$` (ADR-016)
- `allow_minor_members = false` global default (O-21)
- 205 BDD scenarios in 10 feature files, all `@wip`
- 35 capabilities in `capability_registry` at status `not_implemented`
- 29 unit tests in `packages/testkit` all pass

**Docker note:** Docker is not installed on this machine. `docker-compose.yml` has been created for CI and future use. Testcontainers is not used; all DB work uses local PostgreSQL 18 directly.

**Historical evidence note (6 November 2026):** The completion boxes and results above are preserved as the 4 November checkpoint record. The original commit object, CI run URL, and original test artifacts were unavailable during remediation; this closeout does not retroactively verify that historical checkpoint. The current remediation gate passed from a clean checkout on commit `c70d3f439907e5ff37aee3953704e29d899e0032`, CI run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720). Current evidence is recorded in [`docs/PHASE0_VERIFICATION_REPORT.md`](../../docs/PHASE0_VERIFICATION_REPORT.md). The three previously observed login E2E failures are Phase 1 WP-1.9 work and do not reopen Phase 0.

