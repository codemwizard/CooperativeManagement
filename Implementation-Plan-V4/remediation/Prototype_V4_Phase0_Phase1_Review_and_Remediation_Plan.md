# Prototype V4 — Phase 0 and Phase 1 Implementation Review

**Reviewed artefact:** `Prototype-1.zip`  
**Plan reviewed:** `Implementation-Plan-V4/implementation/`  
**Review date:** 5 November 2026  
**Scope:** Phase 0 and Phase 1 only. This is a repository review, not a legal review or a production security certification.

## 1. Executive verdict

| Area | Verdict | Reason |
|---|---|---|
| Phase 0 — Decide, prepare, baseline | **Partially substantiated; gate evidence is incomplete** | The scaffold, decision documents, migrations, baseline record, feature files and tooling exist. However, the recorded gate contains configuration contradictions, some claimed commands are not represented by the current scripts, and the historical commit/CI evidence cannot be independently checked from this archive. |
| Phase 1 — Kernel, identity, authorisation, privacy, shell | **Not complete** | The plan itself leaves the Phase 1 gate unchecked. More importantly, several checked work-package tasks are only in-memory models, disconnected components, mocked tests or incomplete adapters. Some implemented paths violate the guarantees the phase is intended to establish. |

**Do not start Phase 2 on the strength of the checked task boxes.** First remediate the P0 items below, then run a reproducible Phase 1 gate against the actual PostgreSQL-backed application and workspace.

The central issue is evidence quality: a unit test or BDD scenario passing against an in-memory fake does not establish that the PostgreSQL repository, API, browser application and security boundary work together.

## 2. Review limits and evidence standard

The ZIP contains source, configuration, plan documents and a `.git` directory, but it does not contain Git object data. Consequently, the stated Phase 0 commit `218e22c` and the historical repository state at the Phase 0 checkpoint could not be independently reconstructed. The archive also does not contain a CI run record or a database execution transcript.

The available runtime for this review is Node 22.16.0 / npm 10.9.2, while the root `package.json` declares Node `>=25 <27` and npm `>=11.6.2`. PostgreSQL tooling was not available for a fresh migration run. I therefore did not claim that the project’s Node, PostgreSQL, browser or CI suites passed during this review. Findings below are based on direct source/configuration inspection and cross-checking the implementation against the plans.

Classification:
- **Implemented and evidenced:** source and tests support the stated behaviour.
- **Partial / stub:** an interface, in-memory model, placeholder or disconnected component exists, but the planned operational behaviour is not present.
- **Not evidenced:** the plan claims completion, but the archive does not provide enough evidence to substantiate it.
- **Defect:** implementation contradicts a required invariant or creates a security/integrity risk.

---

## 3. Phase 0 findings

### P0-01 — Runtime versions are inconsistent

**Severity: High — reproducibility / CI reliability**

Evidence:
- `.nvmrc` contains `22`.
- Root `package.json` declares Node `>=25 <27` and npm `>=11.6.2`.
- `.github/workflows/ci.yml` configures Node `22` in its jobs.
- `docker-compose.yml` uses `postgres:17-alpine`, while the Phase 0 record says PostgreSQL 18 and CI uses PostgreSQL 18.

The declared local runtime, package engine constraint, CI runtime and database versions are not one reproducible toolchain. The current review environment also cannot satisfy the root package engine declaration.

**Required correction:** choose one supported Node/npm/PostgreSQL matrix and align `.nvmrc`, `engines`, CI, Docker Compose, README and baseline record. Do not leave the project depending on whichever version happens to be installed.

### P0-02 — Phase 0 command/script claims do not match the current root scripts

**Severity: High — gate reliability**

The Phase 0 plan says `db:start` and `db:stop` were added. They are absent from the root `package.json` scripts. Phase 1 says `npm run purge:seed` is implemented; it is also absent.

The Phase 1 appendix lists `test:command`, `test:api` and a workspace-specific `test:ui` command, but these are not defined as root scripts. The existing root `test:ui` points to `tools/run_e2e.mjs`, which is the legacy E2E runner. `verify:v4` does not include the DB tests, API tests, workspace build/typecheck, a11y suite or login Playwright suite.

**Required correction:** define the scripts that the plans actually require, or correct the plans to name the real commands. The final gate must call the real suites, not a similarly named legacy suite.

### P0-03 — Phase 0 migration implementation differs from the plan

**Severity: Medium-High — migration reproducibility**

Evidence:
- Phase 0 WP-0.4.1 specifies a Kysely migrator.
- `packages/db/src/migrate.ts` uses raw `pg` to read and execute SQL files directly.
- The current migration directory contains eight files: `0001`–`0006`, `0006b`, `0007` and `0008`. The seven-file Phase 0 record is consistent with the Phase 0 migration set; `0007` and `0008` are later additions, so the count alone is not a defect.
- The local `docker-compose.yml` uses PostgreSQL 17, not the PostgreSQL 18 specified by the Phase 0 record.

Using raw `pg` is not automatically wrong, but it is a design deviation that must be explicit. The migration runner also lacks an advisory lock, so concurrent invocations can race while applying the same pending migration. The Phase 0 plan also records a Testcontainers smoke test, but the current package manifests and source contain no Testcontainers dependency or smoke-test artefact; the historical run is therefore not independently evidenced in this archive.

**Required correction:** either implement the planned Kysely migration mechanism or formally amend the decision/plan to adopt the raw SQL runner. Add a migration lock, validate the schema identifier before interpolation, record checksums, and test the exact migration sequence against a clean PostgreSQL 18 database. Preserve the seven-migration Phase 0 result as historical, and separately record the later Phase 1 migrations.

### P0-04 — Phase 0 CI-green claim is not independently evidenced

**Severity: Medium — assurance**

The plan records a successful CI scaffold gate and a commit hash. The ZIP has no Git objects from which to verify that commit and contains no CI run URL/log/artifact. The CI workflow itself also uses `npm run typecheck --if-present`, but the root package has no `typecheck` script. That step can therefore succeed without type-checking anything.

The root TypeScript configuration references only `tsconfig.node.json`; it does not form a solution project referencing all packages and apps. The Phase 0 table records package-specific type-checking, not a full-project type-check.

**Required correction:** make type-checking explicit for every workspace package and app, and preserve the CI run evidence used to close the gate. Do not count an `--if-present` no-op as a successful check.

### P0-05 — Sensitive environment file is included in the ZIP

**Severity: High if it contains live credentials**

The archive includes `Prototype/.env`. `.gitignore` excludes `.env`, but that does not prevent it from being copied into an archive. The Git metadata is incomplete, so I cannot establish from this ZIP whether the file was committed or whether its values are live.

**Required correction:** remove `.env` from distributable archives and repository exports; provide `.env.example` with placeholders. If the included file contains credentials that were shared beyond the trusted development environment, rotate them. Confirm the file is not tracked in the actual Git repository.

### Phase 0 conclusion

The Phase 0 *scaffold* is substantially present: the monorepo directories, decision records, baseline document, migrations, feature files, traceability tool, testkit and workspace accessibility placeholder exist.

However, Phase 0 should be recorded as **“scaffold present; gate evidence requires reconciliation”**, not treated as independently proven complete. The current snapshot cannot prove the historical “no feature code” checkpoint because the relevant commit objects are missing and Phase 1 code is now present. The version/script/database discrepancies above must be corrected before Phase 0 can be treated as a reliable foundation.

---

## 4. Phase 1 findings

### P1-01 — Command receipt is outside the atomic transaction

**Severity: Critical — INV-019 / INV-020**

Evidence:
- `packages/domain/src/kernel/command-bus.ts`: dispatch reads the receipt, calls `repository.save(...)`, then separately calls `receiptStore.save(...)`.
- `packages/db/src/repositories/postgres-repository.ts`: the transaction covers aggregate state, domain events and outbox messages, but not the command receipt.
- No PostgreSQL `CommandReceiptStore` adapter exists in the repository. `command_receipts` exists in the SQL schema/RLS migration, but the code search finds only the interface, in-memory test stores and table typing.

This creates a correctness hole. If state/events/outbox commit and receipt persistence fails, a retry can apply the same command again. Two concurrent requests can also both pass the initial receipt lookup before either writes its receipt. The current PostgreSQL repository tests do not close this gap because they test repository persistence, not a PostgreSQL-backed command bus with atomic receipt/idempotency handling.

**Required correction:** move receipt reservation, state transition, event insert, outbox insert and stored result into one database transaction. Enforce a unique `(tenant_id, command_id)` constraint and handle duplicate-key races by returning the committed receipt. Add concurrent same-command-ID and post-commit-failure tests against PostgreSQL.

### P1-02 — Authorisation has fail-open paths; revocation is not protected

**Severity: Critical — INV-011 / INV-024 / authority integrity**

Evidence:
- `packages/domain/src/authz/policy-engine.ts` ends with `return 'allow'` for any same-tenant action not explicitly handled.
- The mutating-action set contains `GrantCapacity` and `RevokeCapacity`, but `CapacityService` calls the policy engine with names such as `GrantCapacity:internal_verifier` and `RevokeCapacity:internal_verifier`.
- The exact-name institutional read-only guard therefore does not match those capacity actions.
- There is a dedicated grant branch, but no dedicated revoke branch. A same-tenant actor who reaches the default branch can be allowed to revoke a capacity.
- `OFFICER_ACTIONS` and the separate `ApproveMinutes` branch duplicate the same action, leaving the latter branch unreachable.

This is not a cosmetic policy-table gap. The default policy is fail-open, and the revoke path does not require an authorised officer. The seven policy unit tests do not demonstrate that every command is denied by default or that revocation is restricted.

**Required correction:** default-deny unknown actions; define a canonical action enum (do not encode action plus capacity type in ad hoc strings); implement explicit grant and revoke rules; enforce institutional read-only rules against canonical action identifiers; add negative tests for every role/action pair and for unknown actions. The server must derive actor roles, appointments and capacities from trusted persisted state.

### P1-03 — Authentication route and workspace login contracts do not match

**Severity: Critical — authentication is not integrated**

Evidence:
- `apps/api/src/routes/auth.ts` expects `{ userId, credential, deviceId }`.
- `apps/workspace/src/routes/LoginPage.tsx` sends `{ email, password }`.
- API success returns `forcedChangeRequired`; the workspace checks `requiresPasswordChange`.
- API returns a session token but does not persist a session. The credential store is an in-memory `Map`.
- The API package declares `src/server.ts` as its development entry point, but that file is absent. `apps/api/src/index.ts` only exports a version constant; there is no code registering `authRoutes`.
- The Playwright login tests intercept/mock `/auth/login`, so they prove the UI response branches, not communication with the actual API.
- The password-change UI links to `/auth/change-password` with a normal GET link, while the API defines a POST endpoint. The route also does not enforce an authenticated session.

**Required correction:** agree one request/response contract; implement and register the API server; persist and validate sessions; implement an authenticated password-change flow; and add an end-to-end test that starts the real API and workspace together without intercepting the auth request. Keep the in-memory credential store explicitly test-only.

### P1-04 — Purge-to-seed is only an in-memory demonstration

**Severity: Critical for test-data safety / destructive-operation control**

Evidence:
- `PurgeSeedService` in `packages/domain/src/privacy/data-mode-guard.ts` only clears three in-memory arrays and returns booleans claiming catalogues, roles and demo tenant were restored.
- It does not connect to PostgreSQL, truncate tenant tables, run seed scripts or write a durable audit event.
- Root `package.json` has no `purge:seed` script.
- BDD data-mode steps use the in-memory `PurgeSeedService`.

The checked WP-1.8 tasks and gate summary overstate what exists. The required operational command does not exist.

**Required correction:** implement a guarded database purge service for test mode only. It must refuse to run in real mode, run in one transaction, use an explicit allowlist of tenant-data tables, preserve platform/legal catalogues as specified, reseed deterministically, and write a durable audit record. Test it against a disposable PostgreSQL database, including a refusal test against real mode.

### P1-05 — Institutional masking still returns member statutory fields

**Severity: Critical — privacy boundary**

Evidence:
- `apps/api/src/serialisers/masking-serialiser.ts` gives institutional roles the fields in `STATUTORY_FIELDS` (name, address, occupation, date registered).
- The same file’s comments say union/TA/institutional roles must have all member PII removed.
- The masking tests focus on NRC/email patterns; they do not assert that names, addresses and occupations are absent from union/TA/lender responses.

Public register inspection is a distinct audience and may have a statutory-field basis. That does not justify exposing those fields to union/TA/institutional roles. The current test can pass while personal names and addresses are still disclosed.

**Required correction:** separate `public_inspection` serialization from institutional serialization. Institutional views should return permitted aggregates and non-identifying evidence, not member-level statutory fields. Add tests with unique synthetic names, addresses and occupations and assert none appear in union/TA/PFI output.

### P1-06 — Privacy controls are local simulations, not durable controls

**Severity: High — privacy / retention assurance**

Evidence:
- `LocalDevKeyProvider` derives a key deterministically from the root key and `keyRef`; `deleteKey()` only adds the key reference to an in-memory `Set`. A process restart loses the deletion marker, so this is not durable crypto-shredding.
- `RetentionPolicy.shred()` returns key references for a caller to delete but does not call the key provider or persist a shred record.
- `DataModeGuard.enforceResidency()` is a method that a caller must remember to invoke; there is no demonstrated application startup gate that refuses to start outside the approved region.
- The consent service and several privacy tests are domain-level models, not database-backed command handlers.

These can be acceptable Phase 1 development adapters if labelled as such. They are not evidence that the production privacy/retention boundary is implemented.

**Required correction:** mark the local provider as test/dev only; create a durable key-provider port backed by a KMS or persistent wrapped-key store; make shred an auditable command that actually deletes/destroys the relevant key; and enforce residency during API startup before accepting traffic. Add restart and persistence tests.

### P1-07 — `/components` accessibility test does not test a real route

**Severity: Medium — workspace acceptance evidence**

Evidence:
- `apps/workspace/src/App.tsx` defines `/login`, `/workspace/*`, `/` and fallback routes; it does not define `/components`.
- `apps/workspace/src/components-page.ts` exports an HTML string.
- `tests/workspace/a11y.spec.ts` calls that function and injects the HTML using `page.setContent()`. It does not navigate to `/components` or test the workspace application.

The test establishes that a static placeholder fragment has no axe violations. It does not establish that `/components` is accessible in the workspace app.

**Required correction:** expose the page through an actual route or explicitly change the plan to use the legacy route. Run axe against the real browser URL served by the workspace app.

### P1-08 — DemoPanel exists but is not mounted

**Severity: Medium — WP-1.9.4 incomplete**

`apps/workspace/src/demo/DemoPanel.tsx` exists, but repository search finds no import or mount of `DemoPanel`. It therefore cannot be used in development or demo mode. A production bundle that does not contain an unused component does not prove that the component is correctly gated; it may simply never have been included.

**Required correction:** mount it in the intended shell only when `VITE_DEMO=true`, verify it is usable in demo mode, and separately verify it is absent from a production build.

### P1-09 — Type-check and CI gates do not cover the full project

**Severity: High — build assurance**

Evidence:
- Root `tsconfig.json` includes legacy `src` and `tests`; its only project reference is `tsconfig.node.json`.
- Package/app projects have their own tsconfigs, but are not assembled into a root solution project.
- CI calls root `npm run typecheck --if-present`, but no root `typecheck` script exists.
- CI does not build the workspace or type-check/test the API package.
- `verify:v4` omits DB tests, API tests, workspace build/typecheck, a11y and login Playwright tests.

**Required correction:** create a solution `tsconfig` referencing all packages and apps; add explicit root scripts for each package/app; make CI fail if any required script is missing; and include all Phase 1 suites in one gate command.

### P1-10 — PostgreSQL tests do not prove the planned command-bus guarantees

**Severity: High — evidence gap**

The Phase 1 plan specifies PostgreSQL/Testcontainers concurrency and repository contract tests. The current DB tests use a configured local `DATABASE_URL`; there is no Testcontainers dependency or smoke-test source in `packages/db`. The domain command-bus concurrency and failure tests use in-memory repositories. The repository contract test named `save_eventAndOutbox_inSameTransaction` checks that aggregate state can be loaded, but does not independently query and assert the event and outbox rows in that contract case.

There are useful PostgreSQL tests in `packages/db/src/__tests__/postgres-repository.test.ts`, including concurrent version handling and rollback on event insert failure. They are not a substitute for an end-to-end PostgreSQL command-bus test that includes idempotency receipts and outbox.

**Required correction:** add PostgreSQL integration tests for the complete command dispatch transaction, receipt uniqueness/replay, concurrent same-version commands, concurrent duplicate command IDs, tenant isolation and rollback at each write boundary. Use Testcontainers or a deterministic CI PostgreSQL service, but document the chosen approach consistently.

### P1-11 — Capacity service returns events but does not persist them

**Severity: High — authority/audit gap**

`CapacityService.execute()` returns `CapacityGranted` / `CapacityRevoked` event objects. It does not persist them, update a capacity projection, or atomically annotate existing findings. The `annotateFindings` flag and text are instructions to a caller, not proof that annotations were made. The tests validate the returned result, not durable audit state.

**Required correction:** wire capacity commands through the command bus and PostgreSQL transaction. Persist grants/revocations and finding annotations as events; verify that revoked users cannot act after the revocation commit and that past findings remain with an auditable annotation.

### P1-12 — Phase 1 work-package checkboxes overstate completion

**Severity: High — plan governance**

All task checkboxes in WP-1.1 through WP-1.9 are checked, but the plan’s own Phase 1 Gate has 11 unchecked items. The source review confirms that some checked tasks are not implemented at the claimed level: WP-1.8’s DB purge command is absent; WP-1.9’s DemoPanel is unmounted and the login is mocked/disconnected; WP-1.1 lacks atomic receipt persistence; WP-1.6 has fail-open policy paths.

**Required correction:** change task checkboxes to reflect the actual evidence level. A task that has only an in-memory model should say “domain reference model implemented” rather than “database purge implemented”. Add explicit `implemented`, `unit-tested`, `integration-tested`, and `gate-verified` status fields to prevent a single checkbox from conflating these states.

---

## 5. Remediation plan — ordered work

Do this in order. Do not spend time polishing workspace screens until the command and authority invariants are safe.

### R0 — Freeze Phase 2 and correct the plan’s evidence ledger

**Goal:** stop false completion claims.

1. Keep Phase 1 status as `In Progress`; do not mark its gate passed.
2. Reclassify WP tasks:
   - WP-1.1: partial — PostgreSQL repository exists; command receipt transaction is missing.
   - WP-1.5: partial — credential service and route plugin exist; persistent session/API integration is missing.
   - WP-1.6: defective — default-allow and revoke authorization gaps.
   - WP-1.7: partial — local crypto/masking models exist; institutional masking and durable shredding need correction.
   - WP-1.8: not implemented operationally — no database purge command/script.
   - WP-1.9: partial — shell exists; API login integration, actual `/components` route and DemoPanel mounting are incomplete.
3. Replace “checkbox means verified” with evidence fields: implementation path, test path, exact command, test environment, result artifact, verifier/date.
4. Preserve the existing legacy prototype baseline; do not lower the regression floor.

**Exit:** plan status accurately matches repository evidence; no Phase 2 start.

### R1 — Close the kernel transaction and idempotency invariant

**Goal:** make INV-019 / INV-020 true in PostgreSQL.

1. Add a PostgreSQL command-receipt repository.
2. Implement one transaction boundary covering:
   - unique receipt reservation by tenant and command ID;
   - aggregate optimistic concurrency update;
   - domain event inserts;
   - outbox inserts;
   - stored command result.
3. On duplicate command ID:
   - same payload: return the original committed result;
   - different payload: reject with `IDEMPOTENCY_KEY_REUSED`.
4. Ensure a failed transaction leaves no aggregate, event, outbox or receipt change.
5. Ensure event tenant/aggregate IDs match the aggregate being committed.
6. Avoid session-scoped tenant state on pooled connections; use transaction-local tenant context and explicit tenant predicates.

**Required tests:** PostgreSQL-backed command dispatch tests for rollback at each write boundary, same-command concurrent replay, same ID/different payload, stale expected version, cross-tenant attempt and outbox consistency.

**Exit:** no command can commit state without its event, outbox and idempotency receipt.

### R2 — Replace fail-open authorisation with default-deny policy

**Goal:** no command is permitted merely because it is unknown.

1. Introduce a canonical action identifier/type; capacity type should be a structured parameter, not part of an ad hoc action string.
2. Default unknown actions to `deny`.
3. Explicitly implement `GrantCapacity` and `RevokeCapacity` policy branches.
4. Ensure institutional read-only rules apply to all capacity and governance mutations.
5. Enforce actor identity, tenant, current appointments, capacity scope, delegation scope and expiry from trusted server-side records.
6. Change self-verification checks to compare the underlying person identity for supplier/collector conflicts, not merely a login user ID.
7. Remove duplicate `ApproveMinutes` handling and enumerate every command that requires officer authority.
8. Persist capacity changes and revocation annotations through the command bus.

**Required tests:** role/action matrix with both allow and deny cases, including unknown action, read-only institution, secretary revoke attempt, ordinary member revoke attempt, cross-tenant grant/revoke, expired delegation, expired capacity and alternate account for same person.

**Exit:** every mutation has an explicit policy; unknown actions fail closed; no role can grant/revoke outside its authority.

### R3 — Make privacy boundaries real and test them with adversarial data

**Goal:** institutional views do not leak member identity; shredding and residency claims are truthful.

1. Split serializers by audience:
   - public inspection: statutory fields only, subject to the approved inspection process;
   - cooperative officer: permitted cooperative access with own-record and need-based controls;
   - union/TA/PFI/NABII/VVB: aggregates and permitted non-identifying evidence only.
2. Add canary values for names, addresses, occupation, email, NRC, phone and member-specific notes. Assert that institutional responses contain none of them.
3. Mark `LocalDevKeyProvider` as test-only. Do not describe its in-memory deletion set as durable crypto-shredding.
4. Implement durable key destruction or a persistent wrapped-key lifecycle; make shredding a command with an immutable audit record.
5. Enforce residency before API startup/readiness, not only when an optional helper is called.
6. Ensure consent/withdrawal and retention transitions are persisted and auditable.

**Exit:** privacy tests cover the full response payload and process restart; no institutional member-level PII leakage; real mode refuses startup when residency configuration is absent or disallowed.

### R4 — Complete test-data purge-to-seed safely

**Goal:** implement the operation the plan currently claims exists.

1. Add `npm run purge:seed`.
2. Require an explicit test-mode configuration and a database identity that cannot connect to production.
3. Use an allowlisted ordered purge of tenant-owned tables; do not use broad unreviewed `TRUNCATE ... CASCADE`.
4. Preserve legal catalogues, platform roles and capability definitions; restore the agreed demo tenant and deterministic fixtures.
5. Write a durable purge event/audit record with actor, timestamp, target database identity and row counts.
6. Add a hard refusal test for real mode and a rollback test for mid-purge failure.
7. Run the legacy oracle/regression suite after the purge and verify expected seed state.

**Exit:** command works only against a disposable test database and is repeatable/idempotent.

### R5 — Wire the API and workspace authentication path end to end

**Goal:** browser login uses the actual API contract.

1. Define one login request and response schema. Align `LoginPage.tsx`, `auth.ts`, API tests and BDD.
2. Add the missing API server entrypoint and register the auth plugin.
3. Replace the in-memory credential map with a repository-backed credential store before calling this an operational login flow.
4. Persist sessions securely; validate session state on protected API routes; revoke or rotate sessions on password change.
5. Implement a real password-change form and authenticated POST request.
6. Do not return or log credential material. Use a safe cookie/session transport decision and document CSRF/session protections.
7. Replace mocked-only Playwright tests with a test that launches the API and workspace together. Keep isolated UI branch tests as additional tests, not as integration evidence.

**Exit:** login, temporary credential expiry/single use, forced password change and authenticated access work through the actual browser/API/database stack.

### R6 — Repair the workspace shell acceptance evidence

**Goal:** prove the actual app routes and demo controls work.

1. Mount `DemoPanel` in the intended shell behind `VITE_DEMO`.
2. Add `/components` to the workspace route or update the plan to reference the correct app/route.
3. Run axe against the real served `/components`, `/login` and workspace shell URLs.
4. Verify production bundle exclusion only after confirming the demo panel is mounted in demo builds.
5. Add route tests for navigation, unknown capability labels and accessible landmarks.

**Exit:** workspace builds; demo controls work only in demo mode; actual routes pass a11y checks.

### R7 — Reconcile the toolchain, scripts and CI

**Goal:** one repeatable gate command.

1. Choose the Node/npm/PostgreSQL versions and align `.nvmrc`, `package.json`, CI and Docker Compose.
2. Decide PostgreSQL 18 as the single test target if that remains the architectural decision; remove the local PG17 mismatch.
3. Add a root TypeScript solution config referencing `packages/domain`, `contracts`, `db`, `testkit`, `apps/api` and `apps/workspace`.
4. Add explicit scripts for:
   - all workspace typechecks;
   - domain unit tests;
   - DB integration tests;
   - API tests;
   - BDD;
   - workspace build;
   - workspace a11y and login E2E;
   - traceability;
   - legacy regression.
5. Make missing scripts fail the gate; do not use `--if-present` for mandatory checks.
6. Update CI to run every required suite, including API tests and workspace build/typecheck.
7. Add migration locking/checksums and verify clean-database migration from zero.
8. Remove `.env` from archive/export packaging and add `.env.example`.

**Exit:** a clean checkout on the documented toolchain can install, migrate, typecheck, test and build from one documented command.

---

## 6. Proposed Phase 1 closure gate

Do not close Phase 1 until all rows below have a retained result artifact.

| Gate | Required evidence |
|---|---|
| Kernel atomicity | PostgreSQL command-bus tests prove aggregate + event + outbox + receipt commit/rollback together |
| Idempotency | Concurrent duplicate command ID returns one stored result and creates one event set |
| Concurrency | PostgreSQL test proves only one command wins for a shared expected version |
| Tenant isolation | Cross-tenant reads/writes denied by application policy and DB RLS |
| Authorisation | Default-deny action matrix; grant/revoke and IFV conflicts tested against persisted actor state |
| Authentication | Real API + browser login, single-use/expiry, forced password change and session enforcement |
| Privacy | Institutional canary PII tests; durable key-shred/restart tests; logs/events checked |
| Test mode | Database-backed purge-to-seed succeeds in test DB and refuses real mode |
| Workspace | Workspace build, real `/components` route, DemoPanel demo/production checks |
| Accessibility | axe passes on actual served routes, not injected HTML only |
| Traceability | Every enabled scenario maps to requirement, implementation and executable test |
| Regression | Legacy baseline remains at or above 159 Vitest / 31 Playwright plus oracle/help/bundle checks |
| CI | All above run on the pinned toolchain from a clean checkout |

## 7. Recommended execution order and stop conditions

1. **R0 plan/evidence correction** — immediately.
2. **R1 kernel transaction** and **R2 default-deny authorisation** — before any further domain workflow implementation.
3. **R3 privacy** and **R4 purge-to-seed** — before real/member data or operational test data is introduced.
4. **R5 authentication integration** — before exposing the workspace to users.
5. **R6 shell acceptance** — after API contracts are stable.
6. **R7 CI/toolchain** — run continuously, with the final integrated gate at the end.

**Stop conditions:**
- Any default-allow authorisation path remains: stop.
- Any state/event/outbox/receipt can diverge after a failed command: stop.
- Any institutional response contains member-level PII: stop.
- Purge can run against a real database: stop.
- Login tests pass only because the API is mocked: do not claim authentication integration.
- Mandatory CI checks can silently skip because scripts are missing: do not close the phase.

## 8. Final recommendation

Phase 0 produced a useful foundation, but its evidence ledger and environment configuration need reconciliation. Phase 1 has meaningful code, but the current checked task boxes are not a reliable measure of completion.

**The immediate priority is not to build more features. It is to make the kernel, authorisation, privacy and test-data guarantees true in the PostgreSQL-backed execution path, then prove them with integration tests.** Only after that should Phase 1 be closed and Phase 2 begin.
