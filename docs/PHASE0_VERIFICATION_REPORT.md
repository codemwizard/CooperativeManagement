# Phase 0 Remediation Verification Report

**Status:** Phase 0 scaffold exists; remediation gate remains open  
**Date:** 6 November 2026 (Africa/Johannesburg)  
**Base commit:** `dea3c1507f96237f76adb7d4ddeb5c7d32609cb3`  
**Working tree:** remediation changes are uncommitted; this base SHA is not the remediation revision  
**Independent verifier:** not yet performed

## Evidence scope

This report records current local verification only. The exact remediation revision has not run in CI, and the current working tree has not been committed. Historical Phase 0 checkpoint counts and claims remain in [`BASELINE_2026-11.md`](BASELINE_2026-11.md); no original CI run URL, downloadable test artifact, or independently verifiable historical Git object was available during this remediation. This report does not retroactively verify that checkpoint.

## Toolchain and decisions

| Component | Selected and locally verified |
|---|---|
| Node.js | 26.7.0 |
| npm | 11.19.0 |
| PostgreSQL | 18.0 (local disposable cluster); Compose and CI use PostgreSQL 18 |
| CI runner | `ubuntu-latest`, configured but not executed in this run |

Node/npm choices follow the user-selected installed runtime and the package compatibility range. PostgreSQL 18 follows ADR-005 and the architecture decision. Raw `pg` SQL migration execution under a session advisory lock is recorded in ADR-022; Kysely remains the repository/query adapter. The migration integration environment is a disposable local PostgreSQL 18 cluster; CI uses the isolated PostgreSQL 18 Compose service.

## Current local results

| Check | Result | Evidence |
|---|---|---|
| Clean dependency install | PASS | `npm ci --offline` completed with 377 packages added and 0 reported vulnerabilities. Offline was required by the restricted local network; CI uses ordinary `npm ci`. |
| Toolchain contract | PASS | `npm run test:toolchain` — 2 passed; `npm run verify:toolchain` — Node 26.7.0 / npm 11.19.0 / PostgreSQL 18 declarations match. |
| Phase 0 command contract | PASS | `npm run test:phase0-contract` — 3 tests passed. Confirms mandatory commands and targets exist, Phase 0 ordering/scope are correct, and a failing command prevents later chain steps from running. |
| Archive/environment hygiene | PASS | `npm run verify:archive-hygiene` — 5 tests passed; Git index has no prohibited environment/private-key path and `.env.example` passed placeholder validation. ZIP member filtering was tested with a sentinel `.env` fixture. |
| Explicit package type-check | PASS | `npm run typecheck:v4` completed for domain, contracts, DB, testkit, API, and workspace. It builds referenced declaration projects before dependent checks. Strictness issues discovered in existing tests/steps were corrected without removing assertions. |
| Architecture | PASS | `npm run verify:arch` — 114 modules and 171 dependencies, no dependency violations. |
| Domain unit suite | PASS | `npm run test:unit` — 10 files, 70 tests passed. |
| Migration runner and schema invariants | PASS | `npm run test:db:migrations` on disposable PostgreSQL 18 — 3 files, 9 tests passed. Includes schema rejection before connecting, transaction rollback without a false ledger row, two simultaneous clean runners, deterministic complete ledger, replay as a no-op, real PostgreSQL failure/retry, append-only `domain_events`, conditional/partial indexes, required event FK, `registered_current`, and actual `allow_minor_members=false` / `registered_current` seed execution. |
| Applied migration files | PASS | 9 files, lexically ordered: `0001_kernel.sql`, `0002_identity.sql`, `0003_policy.sql`, `0004_enrolment.sql`, `0005_evidence.sql`, `0006_legal.sql`, `0006b_governance_stub.sql`, `0007_aggregate_states.sql`, `0008_rls_tenant_isolation.sql`. |
| BDD harness | PASS | `npm run test:bdd` — 49 enabled scenarios and 224 steps passed. These are harness results and are not claimed as coverage of Phase 1 behavior. |
| Traceability | PASS | `npm run verify:trace` — 205 feature scenarios found, 174 tagged `@wip`, 26 hard non-`@wip` scenarios mapped to step definitions; all requirement tags resolve. |
| Accessibility scenario | PASS | `npm run test:a11y` — 1 test passed and the command exited successfully. It uses the shared Vite/Playwright lifecycle wrapper to shut down the local server cleanly. |
| Phase 0 aggregate | PASS (local) | `npm run verify:phase0` completed all component gates in sequence against a fresh disposable PostgreSQL 18.0 database. Toolchain was Node 26.7.0 / npm 11.19.0; the migration DB was `symphony_migrations_test` with `DATA_MODE=test`. The post-aggregate focused reruns are listed below. |
| CI workflow and evidence writer | PASS (configuration) | Workflow YAML parses; the Phase 0, existing DB integration, and full legacy E2E jobs are present and use the pinned matrix. The evidence writer was exercised with a sentinel credential URL; it emitted sanitized JSON/log data without the sentinel. No workflow run has occurred. |
| Legacy verification floor | PASS | `npm run verify:legacy-floor` — oracle (10 cases × 3 destinations), help (91 entries, 23 tour steps, 8 visible texts), sanitized bundle check, and 10 files / 162 Vitest tests passed. |
| Full legacy `verify:all` including E2E | FAIL | 32 of 35 browser tests passed. The three `tests/workspace/login.spec.ts` tests failed to connect to `http://127.0.0.1:5174/login` (`ERR_CONNECTION_REFUSED`). These Phase 1 login E2E checks are explicitly outside Phase 0 scope in the remediation plan; they remain visible here and are not relabelled as passed. |
| Compose DB lifecycle | NOT RUN locally | Docker is unavailable on the local host. CI workflow executes `db:start` and `db:stop`, then starts/stops the isolated test service with health checks. |
| CI aggregate and retained artifact | NOT RUN | Requires the remediation revision to run in GitHub Actions. The Phase 0 job is configured to retain sanitized per-run JSON evidence and gate logs for 90 days; existing DB and full legacy E2E coverage remains in separate jobs. |

The `.env` file was checked locally without recording its values. Its entries were local development configuration; no live credential was identified in this inspection. The current Git index does not track `.env`; `.env.example` contains placeholders. This inspection cannot establish whether a prior external copy exists or prove a third party never received it. No claim of historical rotation or archive-wide delivery audit is made. No repository-local ZIP/export generator was found; the unrelated `UI-Designs.zip` is not an application source distribution. Automated checks cover tracked paths and ZIP member lists when a distributable ZIP is supplied.

The final full local aggregate was rerun after the command-contract check, npm pin validation, PostgreSQL failure/retry case, and schema/seed invariant checks were added; it passed on 6 November. The final run includes the 3 command-contract tests, 9 PostgreSQL migration/invariant tests, all six package type-checks, 49 BDD scenarios, the accessibility test, and the 162-test legacy floor.

After that aggregate, the existing standalone DB and full legacy E2E CI jobs were restored, and the toolchain contract was extended to check PostgreSQL service image tags in the workflow. The updated focused toolchain tests and actual runtime check passed; the final workflow YAML parse passed as well.

## Open closure items

- Commit the remediation and run the exact revision through the CI aggregate; retain the workflow URL and artifact reference.
- Confirm the aggregate `test:a11y` process exits successfully in CI.
- Run Docker Compose lifecycle commands in CI (not available locally).
- Keep the unrelated Phase 1 login E2E failures visible and resolve them within Phase 1 ownership.
- Obtain an independent review of the resulting revision and this evidence.

**Phase 0 closure gate: OPEN.** The full local aggregate passes, but exact-revision CI, Compose lifecycle verification, retained CI run/artifact references, and independent review are still pending. Phase 1 remains In Progress.
