# Phase 0 Remediation Implementation Plan — Reproducible Foundation

**Status:** In Progress — implementation and local verification underway; CI closure evidence pending  
**Version:** 1.1 — 6 November 2026  
**Authority:** `Implementation-Plan-V4/remediation/Prototype_V4_Phase0_Phase1_Review_and_Remediation_Plan.md` §3 P0-01–P0-05; `01-current-state-and-readiness-gap.md`; `02-decision-register.md`; `04-architecture.md`; `05-tdd-strategy.md`; `06-phased-plan.md`; `AI-Secure-Coding-Policy.md`; and the Phase 0 remediation plan review supplied on 6 November 2026.  
**Objective:** Restore Phase 0 as a reproducible, independently verifiable development foundation. Do not implement Phase 1 functionality as part of this task.

> **Completion discipline:** A task is complete only when the implementation, named checks, exact commands, environment, retained result, and independent verification are recorded. A green command that skipped work, ran the wrong suite, or used an undocumented environment is not evidence of completion.

## 1. Scope and boundaries

Phase 0 establishes a reproducible development foundation and an evidenced baseline. This plan remediates only:

1. Toolchain reconciliation.
2. Database lifecycle and migration integrity.
3. Phase 0 script and type-check corrections.
4. Phase 0 CI verification.
5. Archive and environment-file hygiene.
6. Phase 0 plan and decision-record reconciliation.

Do not implement authentication, privacy workflows, purge-to-seed, command-bus changes, workspace feature functionality, or Phase 1 integration tests under this task. `purge:seed`, API tests, workspace login/E2E, institutional privacy tests, and the integrated Phase 1 gate belong to Phase 1. Their absence must not block Phase 0 closure; their completion must not be claimed by this plan.

The original Phase 0 checkpoint and baseline are historical records. Preserve them unchanged as historical evidence. If original Git objects, CI run details, or test artifacts are unavailable, record that limitation; do not recreate or imply historical proof. Establish a separate current baseline on the remediation revision.

## 2. Governing specifications and non-negotiable rules

| Source | Requirement applied here |
|---|---|
| Remediation review §3, P0-01 | Resolve one supported Node/npm/PostgreSQL matrix before changing configuration; align every declaration and verify a clean install. |
| Remediation review §3, P0-02 | Every command claimed by the relevant phase plan must exist, execute its intended operation, and return failure when that operation fails. Scope scripts by phase. |
| Remediation review §3, P0-03 | Explicitly resolve Kysely versus raw `pg`; prove clean migration, safe replay, ordering, concurrency behavior, and recovery. Do not infer that a historical Testcontainers run never happened merely because its artefact is absent. |
| Remediation review §3, P0-04 | Separate historical, current-local, and current-CI evidence. Required type-check/migration/baseline checks cannot silently skip. Use explicit package-level type-check commands first; add a solution project only if it materially improves maintenance. |
| Remediation review §3, P0-05 | Inspect the archived environment file without exposing values; determine placeholder versus credential status; coordinate rotation if an actual credential was distributed; exclude prohibited material from all supported archives/exports. |
| `04-architecture.md` §§2, 4, 10 | Preserve legacy isolation, use PostgreSQL 18 unless an authoritative decision says otherwise, and retain forward-only SQL migration behavior. |
| `05-tdd-strategy.md` §§1, 9–11 | Tests precede implementation where practical; migration paths are tested; mandatory scripts are real; baseline and traceability evidence are reproducible. |
| `06-phased-plan.md` WP-0.1–0.9 | Existing decisions and Phase 0 scope remain authoritative unless formally amended. Preserve O-18–O-22 rulings, including O-22 as open. |
| `AI-Secure-Coding-Policy.md` | Never print, copy into reports, or commit secret values. Treat uncertain exposure as a stop condition and report it for resolution. |

### 2.1 Version authority rule

The implementation agent must not select versions independently or simply choose the newest versions. First inspect the accepted ADRs, architecture, package lockfile and dependency compatibility, Phase 0 record, CI setup, Compose configuration, and supported developer environment. Produce a short proposed matrix with evidence for each version. If those sources do not establish a compatible authoritative matrix, stop and report the conflict for an architectural decision before editing pins. The review currently identifies PostgreSQL 18 as the architecture/Phase 0 target, Node 22 in `.nvmrc` and CI versus Node 25–26 in package metadata, and an npm 11 declaration versus an observed npm 10 environment; these observations are conflicts to resolve, not permission to pick a version arbitrarily.

### 2.2 Migration decision rule

Raw `pg` instead of Kysely is a design deviation, not automatically a functional defect. Do not add a migration framework solely to satisfy an outdated checkbox. Assess the current runner and select one of two outcomes: implement the originally specified Kysely migrator, or formally approve raw `pg` in an ADR/decision record and amend the Phase 0 plan. In either case retain SQL-file migrations, deterministic ordering, transaction/failure semantics, duplicate protection, and safe schema selection. Do not run two competing migration systems.

### 2.3 TDD and BDD rules

- For each defect, first add a focused failing test/check that demonstrates that specific defect. A setup error or unrelated type error is not a valid RED result. Retain the failure output.
- Implement the smallest complete correction, then rerun the focused check and dependent Phase 0 gate. Do not weaken/remove assertions or lower the regression floor to get green.
- A script’s existence is not proof: exercise its underlying operation and confirm failure exit-code propagation.
- Phase 0 findings are primarily toolchain, build, migration and distribution concerns. Test them with config/contract tests, clean-install checks, PostgreSQL integration checks, workflow validation and archive inspection. Do not invent Gherkin product behavior for infrastructure.
- Existing Gherkin scenarios remain `@wip` unless the specified user-visible behavior is implemented and tested through the real application/API facade. “0 scenarios” means the BDD harness ran with no enabled scenarios; it is not BDD coverage.

## 3. Required sequence and dependency map

Execute in this order; do not establish a new baseline until the matrix, database path, scripts, and CI gate are stable.

| Order | Work package | Depends on | Exit condition |
|---:|---|---|---|
| 1 | P0-R1 Toolchain reconciliation | None | One documented and consistently configured Node/npm/PostgreSQL matrix. |
| 2 | P0-R2 Database lifecycle and migration integrity | P0-R1 | Start/stop and clean/replay/concurrent migration behavior is reproducible on the selected PostgreSQL version. |
| 3 | P0-R3 Script and type-check integrity | P0-R1; P0-R2 for DB commands | Every mandatory Phase 0 command exists, runs the intended operation, and cannot silently skip. |
| 4 | P0-R4 CI and baseline verification | P0-R1–R3 | CI runs the same fixed Phase 0 gate; a new current baseline and artifacts are retained separately from historical results. |
| 5 | P0-R5 Archive and environment hygiene | None; complete before any distribution | Archives exclude `.env` and prohibited secret material; placeholders and automated checks exist. If exposure is unknown, stop distribution pending resolution. |
| 6 | P0-R6 Plan and decision reconciliation | P0-R1–R5 | Deviations and evidence limitations are documented; Phase 0 status reflects the fixed closure gate. |

## 4. Work packages

### P0-R1 — Toolchain reconciliation

**Fixes:** P0-01. **Exit:** one documented Node/npm/PostgreSQL matrix is aligned across developer setup, package metadata, CI, Compose, and current baseline.

Tasks:

- [ ] R1.1 Inspect accepted architecture decisions/ADRs, package and lockfile compatibility, `.nvmrc`, `engines`, `packageManager`, CI setup, Compose images, README instructions, and the recorded baseline. Record conflicts and the evidence relevant to each candidate version.
- [ ] R1.2 Propose the exact Node, npm, and PostgreSQL versions and image tags. Do not change versions until the proposal is supported by existing authoritative decisions and dependency compatibility. If authority is ambiguous or sources conflict without a documented ruling, stop for an architectural decision.
- [ ] R1.3 Once authorized by the governing decisions, align `.nvmrc`, root `package.json` (`engines` and `packageManager` as appropriate), CI setup, Compose DB and test services, developer documentation, and the new current verification report. PostgreSQL image tags must be major-pinned; no floating `postgres:alpine`/`latest`.
- [ ] R1.4 Add a small automated matrix consistency check over the configuration sources. It must identify which sources disagree and fail before test execution. Add negative fixtures for at least one Node, npm, and PostgreSQL mismatch.
- [ ] R1.5 From a clean checkout using the documented exact versions, perform dependency installation without engine-ignore/force flags, start PostgreSQL, migrate, run the Phase 0 checks, and capture results. CI and local instructions must describe equivalent operations.

**TDD evidence:** consistency check fails against the current contradictory declarations (RED), names the mismatch, and passes only after all sources agree (GREEN). Clean install validates the actual selected runtime rather than only parsing version strings.  
**BDD:** not applicable; no product behavior is changed.

### P0-R2 — Database lifecycle and migration integrity

**Fixes:** missing `db:start`/`db:stop`, PostgreSQL mismatch, migration deviation and unproven migration behavior (P0-02/P0-03). **Exit:** database starts/stops and a fresh database migrates from zero; replay and concurrent invocation cannot reapply or corrupt migrations.

Tasks:

- [ ] R2.1 Resolve the Kysely/raw `pg` deviation under §2.2. Record the selected approach and reasons in the appropriate ADR/decision record and update Phase 0 WP-0.4.1 wording. Preserve the historical wording/result as historical; do not edit already-applied migration files to make the record appear consistent.
- [ ] R2.2 Implement `db:start` and `db:stop` as documented root scripts delegating to the selected Compose services. Confirm startup readiness and propagate Compose failures. A mocked command test may verify argument/exit propagation, but closure also requires a real disposable database smoke run.
- [ ] R2.3 Define deterministic migration ordering and a migration history identity. Detect already-applied migrations and do not execute them again. If adding checksums, define the algorithm and behavior on mismatch; applied-file drift must fail clearly rather than rewrite history.
- [ ] R2.4 Assess concurrency and partial-failure paths. Add a PostgreSQL advisory lock or another reviewed serialization mechanism if concurrent runs could race. Specify lock ownership/release and retry behavior. Prove two simultaneous invocations produce one valid migration history and no duplicate DDL.
- [ ] R2.5 Validate the schema identifier before interpolation. Use safe identifier quoting supported by the selected driver; reject malformed, quoted, comment-like, or injection-shaped identifiers before sending SQL.
- [ ] R2.6 Test one clean database from zero through the complete current ordered migration set on the exact PostgreSQL version in P0-R1. Verify server version and target DB identity before setup. Also verify re-running migrations is safe and does not reapply or corrupt the schema.
- [ ] R2.7 Test seeded upgrade, applied migration history, failure/retry behavior, and key Phase 0 schema invariants that the original plan specifies (append-only `domain_events`, required partial/conditional indexes and FKs, `registered_current` default, 11-digit cooperative registration pattern, and `allow_minor_members=false`). Keep later migration additions distinct from the historical Phase 0 migration count.
- [ ] R2.8 Choose and document one deterministic integration environment: pinned PostgreSQL service in CI or Testcontainers. A local PostgreSQL instance is acceptable for local work if disposable and version-verified. Missing Testcontainers artefacts mean the historical run cannot be independently evidenced from the archive; do not claim this proves it never ran.
- [ ] R2.9 Retain a migration report listing exact files applied, order, count, PostgreSQL version, and clean/replay/concurrency results. No connection strings or secret values in the report.

**TDD evidence:** focused tests demonstrate replay, locking, invalid schema refusal, checksum/history mismatch and failure recovery. Integration assertions query the real PostgreSQL catalogs and rows; mocked repository tests alone are insufficient.  
**BDD:** not applicable; migration mechanics are infrastructure.

### P0-R3 — Phase 0 script and type-check integrity

**Fixes:** P0-02 and P0-04. **Exit:** every command claimed by the Phase 0 plan exists and executes the correct operation; mandatory Phase 0 checks cannot pass by skipping.

Tasks:

- [ ] R3.1 Create a Phase 0 command map: documented command, root script name, underlying executable/config, exact scope, prerequisites, expected result/artifact. Include at minimum `db:start`, `db:stop`, `db:migrate`, `db:migrate:test` if documented, `test:unit`, `test:bdd`, `verify:trace`, `verify:arch`, `verify:all` (legacy), and one explicit Phase 0 aggregate gate. Add other commands only when they are required by the Phase 0 plan.
- [ ] R3.2 Remove `--if-present` from mandatory Phase 0 checks. A missing script, config, test file, or package must fail with a clear message. Do not require Phase 1 commands such as `purge:seed`, API tests, login E2E, or full application integration for Phase 0 closure.
- [ ] R3.3 Define explicit package-level type-check commands for every Phase 0 package/app that exists and is in scope. Have the root Phase 0 gate invoke each explicitly and fail on any nonzero result. Do not rely on cross-platform wildcard expansion. A TypeScript solution project may be introduced later only if it materially improves maintenance; it is not required as the immediate repair.
- [ ] R3.4 Add a command contract check that compares the Phase 0 command map to root scripts and target files. Verify a command cannot be a no-op and that aggregate scripts preserve failure exit codes. Use negative controls: remove a target, inject a type error into a disposable fixture, and force an underlying suite failure; each must make the gate fail.
- [ ] R3.5 Ensure `verify:all` remains the legacy regression suite and is not presented as a V4 test command. Preserve its existing floor; document whether baseline count includes the accessibility test and how Playwright/Vitest counts are computed.
- [ ] R3.6 Do not represent Phase 1 script gaps as Phase 0 defects. Keep a separate Phase 1 backlog/status for `test:command`, `test:api`, workspace-specific `test:ui`, and `purge:seed` until that phase implements them.

**TDD evidence:** contract tests fail for missing/misdirected mandatory Phase 0 scripts and pass only when scripts run the expected target; negative controls prove failure propagation. Every package type-check is explicitly visible in output.  
**BDD:** not applicable; these are developer command contracts.

### P0-R4 — CI and baseline verification

**Fixes:** P0-04. **Exit:** current CI executes the same fixed Phase 0 aggregate gate and retains results for the exact revision; a new current baseline is established without overwriting historical data.

Tasks:

- [ ] R4.1 Separate evidence into three records: (a) historical Phase 0 checkpoint evidence, (b) current local verification, and (c) current CI verification. Record unavailable historical commit objects/CI logs as unavailable; do not try to reconstruct them through source edits.
- [ ] R4.2 Define one Phase 0 aggregate command that invokes the required toolchain assertion, explicit package type-checks, architecture check, Phase 0 unit/contract tests, clean/replay migration tests, traceability check, and the required legacy regression floor. Include BDD harness execution only if it is a Phase 0 required check and report enabled scenario count accurately.
- [ ] R4.3 Update CI to use the P0-R1 matrix and run that aggregate command from a clean checkout. No mandatory `--if-present`, `continue-on-error`, or conditional omission. If PostgreSQL is a service, health-check it and verify its server version before migrations.
- [ ] R4.4 Retain artifacts for the exact commit: commit SHA, actual runtime/database versions, command list, exit results, test counts, migration report, and sanitized logs. A local pass is not CI evidence; a green CI run on another revision does not verify this revision.
- [ ] R4.5 Establish a new current baseline after P0-R1–R3 stabilize. Store it separately from `docs/BASELINE_2026-11.md` historical record (for example `docs/PHASE0_VERIFICATION_REPORT.md` plus linked machine-readable artifacts). Do not reduce historical counts or silently change thresholds.
- [ ] R4.6 Validate the workflow YAML and confirm its required job graph actually calls the aggregate gate. Execute CI on the remediation revision and retain the run URL/artifact references. A YAML parse alone is insufficient.

**TDD evidence:** CI-contract validation fails when a mandatory script is removed or made optional; actual workflow fails on a forced failing fixture and passes on the clean remediation revision. Evidence must identify which suites ran, passed, failed, and skipped; required skipped count is zero.  
**BDD:** no new product scenarios. Report actual enabled BDD count; zero enabled scenarios must not be labelled BDD coverage.

### P0-R5 — Archive and environment-file hygiene

**Fixes:** P0-05. **Exit:** every supported distributable archive/export excludes `.env` and prohibited secret files, includes a placeholder-only `.env.example`, and has an automated content check.

Tasks:

- [ ] R5.1 Inspect the supplied archive’s `.env` locally without printing or copying its values into chat, logs, reports, or commits. Determine whether its entries are placeholders/local-only values or actual credentials (record categories and exposure assessment, not secret values). Inspect the actual repository’s tracked-file list separately; `.gitignore` alone is not evidence that a file is untracked.
- [ ] R5.2 If actual credentials were distributed outside the trusted environment, coordinate rotation with the credential owner and record only the rotation status/reference. If credential status or exposure cannot be determined, stop distribution and report the uncertainty for resolution; do not make unsupported claims that it is safe.
- [ ] R5.3 Remove real local environment files from archive/export inputs and, if tracked, from version control. Provide `.env.example` with all required variable names and conspicuous placeholders only. Never copy a real `.env` and attempt partial redaction.
- [ ] R5.4 Inventory each supported distribution path (source archive, local ZIP/export script, CI artifact, release packaging). Add explicit exclusions for `.env`/`.env.*` except `.env.example`, private keys, credentials, local database files, and other project-defined secret paths. Ensure the example file is included.
- [ ] R5.5 Add automated archive/package tests that generate each supported archive in a temporary location and inspect member paths. Include sentinel secret files in a fixture and prove the packaging check rejects them without printing their contents. Add a repository hygiene check for tracked forbidden files and a placeholder check for `.env.example`.
- [ ] R5.6 Generate and inspect a distributable archive after remediation. Retain a sanitized manifest/check result, not secret-bearing contents.

**TDD evidence:** tests fail against a fixture containing `.env`, a private key, or sentinel credential; pass only after every supported packaging path excludes them and includes placeholder configuration.  
**BDD:** not applicable.

### P0-R6 — Plan and decision reconciliation

**Fixes:** plan/implementation deviations and historical evidence overclaims. **Exit:** plans and decision records describe the actual Phase 0 foundation and its evidence level without conflating Phase 1.

Tasks:

- [ ] R6.1 Amend the original Phase 0 implementation plan’s status/gate record so unchecked or unavailable evidence is not presented as independently verified. Preserve the original checkpoint table as historical with provenance notes; append current remediation results instead of overwriting it.
- [ ] R6.2 Record the approved migration approach, toolchain matrix, test environment choice, and any remaining deviations in the appropriate ADR/decision record. Keep O-22 open unless separately resolved by its designated authority.
- [ ] R6.3 Reconcile package scripts and CI documentation with the Phase 0 command map. Move Phase 1-only command gaps to Phase 1 status and do not make them prerequisites to Phase 0 closure.
- [ ] R6.4 Produce `docs/PHASE0_VERIFICATION_REPORT.md` containing: exact commit SHA; runtime versions; database version; commands executed; pass/fail results; migration count and files; current baseline results; historical evidence limitations; CI run and artifact references; known limitations; decision/ADR references; independent verifier and date. The report must not contain secrets.
- [ ] R6.5 Set Phase 0 status to complete only after the fixed closure gate in §5 passes from a clean checkout. Keep Phase 1 at its existing `In Progress` status; this plan does not close Phase 1.

**TDD evidence:** evidence/report validation rejects missing required fields, missing artifacts, unsupported historical claims, or Phase 0 marked complete while a gate row is not passed.  
**BDD:** not applicable.

## 5. Fixed Phase 0 definition of done

The implementation agent does not decide completion based on task count. Phase 0 remediation is complete only when every row below is `PASS` on the exact remediation revision and the evidence is retained.

| Verification | Required evidence/result |
|---|---|
| Clean dependency installation | Pass from clean checkout using the documented Node/npm matrix without bypass flags. |
| Database lifecycle | `db:start` and `db:stop` work against the documented Compose service and propagate failures. |
| Database version | Actual PostgreSQL server version matches the documented pinned version (architecture target is PostgreSQL 18 unless formally amended). |
| Fresh migration | Entire current migration chain applies successfully from an empty disposable database; exact files/order/count retained. |
| Migration replay | Second run applies no migrations again, changes no schema unexpectedly, and leaves history intact. |
| Migration concurrency | Concurrent invocation cannot apply a migration twice or corrupt schema/history; result is tested on real PostgreSQL. |
| Migration failure/recovery | A controlled failure has documented state and safe retry/recovery; no false successful ledger entry. |
| Type-check | Every required Phase 0 package/app is invoked explicitly; any introduced type error fails the gate. |
| Unit/contract checks | Required Phase 0 unit/contract tests pass; missing test targets fail rather than skip. |
| Traceability | Required Phase 0 references resolve; BDD enabled-scenario count is explicit and not overstated. |
| CI | Current CI runs the same Phase 0 aggregate gate on the exact revision with no optional mandatory checks. |
| Archive hygiene | Generated distributable is automatically checked; `.env` and prohibited secret files are absent; `.env.example` is placeholder-only. |
| Current baseline | Current results are retained in a new report/artifact separate from the historical baseline. |
| Plan status | Decisions/deviations and historical limitations are documented; Phase 0 completion status is supported by all rows above. |

Required result for each row is `PASS`; `FAIL`, `NOT RUN`, `SKIPPED`, or missing evidence means Phase 0 remains open. The current report must say **“Phase 0 scaffold exists; remediation gate remains open”** until the full gate passes.

## 6. Stop conditions

Stop implementation and report the unresolved decision or failure if:

- authoritative Node/npm/PostgreSQL versions cannot be established from current accepted decisions and compatibility evidence;
- the migration strategy cannot be reconciled without changing an existing architectural decision;
- a clean database migration fails or recovery behavior is unsafe;
- mandatory tests cannot be executed, or the baseline/regression floor would need to be weakened;
- the archive contains credentials and their type/exposure status is unknown;
- an actual credential was distributed and rotation needs the credential owner;
- satisfying a Phase 0 gate would require implementing Phase 1 functionality;
- historical artifacts are unavailable (record the limitation and establish a new baseline; do not attempt to fabricate history).

## 7. Required deliverables

1. Updated, mutually consistent toolchain configuration and documented matrix.
2. Working database lifecycle commands.
3. One approved migration approach with documented locking/concurrency and failure behavior, clean/replay migration evidence, and a migration report.
4. Explicit Phase 0 verification scripts, including package-level type-check commands and a non-skipping aggregate gate.
5. CI workflow that executes the same Phase 0 gate and retains current-run evidence.
6. Archive/export hygiene rules, automated checks, and placeholder-only `.env.example`.
7. Updated Phase 0 implementation plan and relevant decision records.
8. `docs/PHASE0_VERIFICATION_REPORT.md` with the fields listed in P0-R6.4.

## 8. Execution report template

```text
Remediation revision / exact commit SHA:
Historical checkpoint evidence: available | unavailable (details/reference)
Toolchain decision reference:
Toolchain: Node / npm / PostgreSQL / CI runner
Clean dependency install: command / result / artifact
Database lifecycle: commands / results / artifacts
Migration approach and ADR:
Migration files, order, count, clean result, replay result, concurrency result:
Phase 0 type-check commands and results:
Phase 0 unit/contract, architecture, traceability and legacy results:
BDD enabled scenario count (report coverage accurately):
CI run URL and retained artifacts:
Archive hygiene result and sanitized manifest:
Current baseline artifact:
Known limitations / open decisions:
Independent verifier / timestamp:
Phase 0 closure gate: PASS | FAIL | NOT RUN
Phase 1 status: In Progress (not changed by this plan)
```

## 9. Current execution record

The current run is recorded in [`docs/PHASE0_VERIFICATION_REPORT.md`](../../docs/PHASE0_VERIFICATION_REPORT.md). This plan remains **In Progress** because the remediation changes are uncommitted, the exact remediation revision has not run in CI, and the complete legacy `verify:all` command has three pre-existing Phase 1 login-server connection failures. Those login tests are reported separately and are outside the Phase 0 gate by §1 and P0-R3.2. Do not mark Phase 0 complete until the closure conditions in §5 are met.
