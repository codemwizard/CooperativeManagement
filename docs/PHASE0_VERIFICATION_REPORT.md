# Phase 0 Remediation Verification Report

**Status:** Phase 0 scaffold exists; remediation gate remains open  
**Date:** 6 November 2026 (Africa/Johannesburg)  
**Remediation commit:** `e69a43c8a3b2821ca1b9cad3780ab0015d2461a7` (`main`, pushed to `origin`)
**Independent verifier:** not yet performed

## Evidence scope

This report records local verification of the remediation and its CI follow-up fixes, plus the first two CI runs for the pushed remediation commits. Historical Phase 0 checkpoint counts and claims remain in [`BASELINE_2026-11.md`](BASELINE_2026-11.md); no original CI run URL, downloadable test artifact, or independently verifiable historical Git object was available during this remediation. This report does not retroactively verify that checkpoint.

## Toolchain and decisions

| Component | Selected and locally verified |
|---|---|
| Node.js | 26.7.0 |
| npm | 11.19.0 |
| PostgreSQL | 18.0 (local disposable cluster); Compose and CI use PostgreSQL 18 |
| CI runner | `ubuntu-latest`; remediation run [42174847546](https://github.com/codemwizard/CooperativeManagement/actions/runs/42174847546) and follow-up run [42176935319](https://github.com/codemwizard/CooperativeManagement/actions/runs/42176935319) |

Node/npm choices follow the user-selected installed runtime and the package compatibility range. PostgreSQL 18 follows ADR-005 and the architecture decision. Raw `pg` SQL migration execution under a session advisory lock is recorded in ADR-022; Kysely remains the repository/query adapter. The migration integration environment is a disposable local PostgreSQL 18 cluster; CI uses the isolated PostgreSQL 18 Compose service.

## Current local results

| Check | Result | Evidence |
|---|---|---|
| Clean dependency install | PASS | `npm ci --offline` completed with 377 packages added and 0 reported vulnerabilities. Offline was required by the restricted local network; CI uses ordinary `npm ci`. |
| Toolchain contract | PASS | `npm run test:toolchain` — 2 passed; `npm run verify:toolchain` — Node 26.7.0 / npm 11.19.0 / PostgreSQL 18 declarations match. |
| Phase 0 command contract | PASS | `npm run test:phase0-contract` — 5 tests passed. Confirms mandatory commands and targets exist, DB startup does not bypass the migration runner, legacy verification builds its bundle, Phase 0 ordering/scope are correct, and a failing command prevents later chain steps from running. |
| Archive/environment hygiene | PASS | `npm run verify:archive-hygiene` — 5 tests passed; Git index has no prohibited environment/private-key path and `.env.example` passed placeholder validation. ZIP member filtering was tested with a sentinel `.env` fixture. |
| Explicit package type-check | PASS | `npm run typecheck:v4` completed for domain, contracts, DB, testkit, API, and workspace. It builds referenced declaration projects before dependent checks. Strictness issues discovered in existing tests/steps were corrected without removing assertions. |
| Architecture | PASS | `npm run verify:arch` — 114 modules and 171 dependencies, no dependency violations. |
| Domain unit suite | PASS | `npm run test:unit` — 10 files, 70 tests passed. |
| Migration runner and schema invariants | PASS | `npm run test:db:migrations` on disposable PostgreSQL 18 — 3 files, 9 tests passed. Includes schema rejection before connecting, transaction rollback without a false ledger row, two simultaneous clean runners, deterministic complete ledger, replay as a no-op, real PostgreSQL failure/retry, append-only `domain_events`, conditional/partial indexes, required event FK, `registered_current`, and actual `allow_minor_members=false` / `registered_current` seed execution. |
| Applied migration files | PASS | 9 files, lexically ordered: `0001_kernel.sql`, `0002_identity.sql`, `0003_policy.sql`, `0004_enrolment.sql`, `0005_evidence.sql`, `0006_legal.sql`, `0006b_governance_stub.sql`, `0007_aggregate_states.sql`, `0008_rls_tenant_isolation.sql`. |
| BDD harness | PASS | `npm run test:bdd` — 49 enabled scenarios and 224 steps passed. These are harness results and are not claimed as coverage of Phase 1 behavior. |
| Traceability | PASS | `npm run verify:trace` — 205 feature scenarios found, 174 tagged `@wip`, 26 hard non-`@wip` scenarios mapped to step definitions; all requirement tags resolve. |
| Accessibility scenario | PASS | `npm run test:a11y` — 1 test passed and the command exited successfully. It uses the shared Vite/Playwright lifecycle wrapper to shut down the local server cleanly. |
| Phase 0 aggregate | PASS (prior local run; current fixes not included) | Before the current Compose/build follow-up edits, `npm run verify:phase0` completed all component gates against a fresh disposable PostgreSQL 18.0 database. This environment now has neither Docker nor `MIGRATION_TEST_DATABASE_URL`, so the aggregate cannot be rerun here for the current tree. |
| CI workflow and evidence writer | PARTIAL / CI FAILED | Workflow YAML parses; Phase 0, existing DB integration, and full legacy E2E jobs use the pinned matrix. The evidence writer was exercised with a sentinel credential URL and sanitized the output. CI run [42174847546](https://github.com/codemwizard/CooperativeManagement/actions/runs/42174847546) used this exact commit. The DB integration job passed. The Phase 0 job failed at “Verify the local PostgreSQL lifecycle commands” before `npm run verify:phase0` ran, so there is no exact-commit CI aggregate result. GitHub retained artifact `phase0-evidence-e69a43c8a3b2821ca1b9cad3780ab0015d2461a7` (567 bytes); its download requires authentication unavailable in this environment, so its contents are not claimed as inspected gate evidence. The full legacy E2E job also failed; that failure remains separately classified for Phase 1 ownership. |
| Legacy verification floor | PASS (updated locally) | `npm run verify:legacy-floor` first runs `npm run build`, then the oracle (10 cases × 3 destinations), help (91 entries, 23 tour steps, 8 visible texts), sanitized bundle check, and 10 files / 164 Vitest tests. The generated bundle passed sanitization from a build performed in this run. |
| Full legacy `verify:all` including E2E | FAIL (updated locally) | After the build-backed legacy floor passed, 32 of 35 browser tests passed. All three `tests/workspace/login.spec.ts` tests failed to connect to `http://127.0.0.1:5174/login` (`ERR_CONNECTION_REFUSED`). These are Phase 1 login E2E checks and remain visible as a separate outstanding failure. |
| Compose DB lifecycle | FAILED in CI; fix pending CI confirmation | The supplied excerpt from follow-up run [42176935319](https://github.com/codemwizard/CooperativeManagement/actions/runs/42176935319), job [127757445533](https://github.com/codemwizard/CooperativeManagement/actions/runs/42176935319/job/127757445533), shows `npm run db:start` waiting for `symphony_db`, which exited with code 1. The Compose `db` service had mounted the whole `migrations/` directory into PostgreSQL's automatic `docker-entrypoint-initdb.d` hook, making container startup execute application migrations outside `migrate.ts`. The actual PostgreSQL statement error is absent from the excerpt, so this is a configuration defect addressed by removing that implicit migration path, not a proven diagnosis of the exact SQL failure. Docker is not installed locally; only CI can confirm the Compose startup fix. |
| CI aggregate and retained artifact | NOT RUN / ARTIFACT RETAINED | The Phase 0 gate did not execute because `db:start` failed before the test service and aggregate steps. Artifact `phase0-evidence-e69a43c8a3b2821ca1b9cad3780ab0015d2461a7` is listed for run [42174847546](https://github.com/codemwizard/CooperativeManagement/actions/runs/42174847546), but its contents could not be downloaded for inspection in this environment. Rerun CI after the pending fix and record the exact gate outcome and inspectable artifact. |
| CI legacy E2E job | FAILED at clean-checkout setup | The supplied log for job [127757445803](https://github.com/codemwizard/CooperativeManagement/actions/runs/42176935319/job/127757445803) says `verify:bundle` failed because ignored `dist/` did not exist. `verify:legacy-floor` now starts with `npm run build`, making the check self-contained; the local run then reached Playwright and exposed the three Phase 1 login connection failures noted above. CI must confirm this clean-checkout fix. |

The `.env` file was checked locally without recording its values. Its entries were local development configuration; no live credential was identified in this inspection. The current Git index does not track `.env`; `.env.example` contains placeholders. This inspection cannot establish whether a prior external copy exists or prove a third party never received it. No claim of historical rotation or archive-wide delivery audit is made. No repository-local ZIP/export generator was found; the unrelated `UI-Designs.zip` is not an application source distribution. Automated checks cover tracked paths and ZIP member lists when a distributable ZIP is supplied.

The final full local aggregate was rerun after the command-contract check, npm pin validation, PostgreSQL failure/retry case, and schema/seed invariant checks were added; it passed on 6 November. The final run includes the 3 command-contract tests, 9 PostgreSQL migration/invariant tests, all six package type-checks, 49 BDD scenarios, the accessibility test, and the 162-test legacy floor.

After that aggregate, the existing standalone DB and full legacy E2E CI jobs were restored, and the toolchain contract was extended to check PostgreSQL service image tags in the workflow. The updated focused toolchain tests and actual runtime check passed; the final workflow YAML parse passed as well.

## Open closure items

- Push the Compose lifecycle and clean-build fixes, then confirm `db:start`, `db:stop`, and isolated PostgreSQL startup succeed in CI.
- Run the revised exact commit through the full Phase 0 CI aggregate; retain the successful workflow URL and inspect the artifact contents.
- Confirm the aggregate `test:a11y` process exits successfully in CI.
- Keep the independent full legacy E2E failure visible and resolve its Phase 1 login failures within Phase 1 ownership.
- Obtain an independent review of the resulting revision and this evidence.

**Phase 0 closure gate: OPEN.** The prior full local aggregate passed, and the updated local bundle/build and legacy floor pass. The updated Compose lifecycle has not run locally or in CI yet; a successful exact-revision CI aggregate, artifact inspection, and independent review remain pending. The separate Phase 1 login E2E failure also remains open. Phase 1 remains In Progress.
