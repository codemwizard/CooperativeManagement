# Phase 0 Remediation Verification Report

**Status:** Phase 0 remediation complete; Phase 1 login E2E failures carried forward
**Date:** 6 November 2026 (Africa/Johannesburg)  
**Original remediation commit:** `e69a43c8a3b2821ca1b9cad3780ab0015d2461a7` (`main`, pushed to `origin`)
**Verified Phase 0 revision:** `c70d3f439907e5ff37aee3953704e29d899e0032` (`main`, pushed to `origin`)
**CI run:** [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720), attempt 1; retained artifact `phase0-evidence-c70d3f439907e5ff37aee3953704e29d899e0032`
**Independent verifier:** no separate reviewer assigned; Codex reviewed the retained artifact and log on 6 November 2026. This is recorded as a limitation, not represented as independent review.

## Evidence scope

This report records local verification of the remediation and CI follow-up fixes, plus the first three CI runs for the pushed remediation commits. Historical Phase 0 checkpoint counts and claims remain in [`BASELINE_2026-11.md`](BASELINE_2026-11.md); no original CI run URL, downloadable test artifact, or independently verifiable historical Git object was available during this remediation. This report does not retroactively verify that checkpoint.

## Toolchain and decisions

| Component | Selected and locally verified |
|---|---|
| Node.js | 26.7.0 |
| npm | 11.19.0 |
| PostgreSQL | 18.0 (local disposable cluster); Compose and CI use PostgreSQL 18 |
| CI runner | `ubuntu-latest`; latest Phase 0 gate run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720) |

Node/npm choices follow the user-selected installed runtime and the package compatibility range. PostgreSQL 18 follows ADR-005 and the architecture decision. Raw `pg` SQL migration execution under a session advisory lock is recorded in ADR-022; Kysely remains the repository/query adapter. The migration integration environment is a disposable local PostgreSQL 18 cluster; CI uses the isolated PostgreSQL 18 Compose service.

## Current local results

| Check | Result | Evidence |
|---|---|---|
| Clean dependency install | PASS | The exact CI workflow performed ordinary `npm ci` before run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720) reached the Phase 0 gate. Locally, `npm ci --offline` completed with 377 packages added and 0 reported vulnerabilities. |
| Toolchain contract | PASS | `npm run test:toolchain` — 2 passed; `npm run verify:toolchain` — Node 26.7.0 / npm 11.19.0 / PostgreSQL 18 declarations match. |
| Phase 0 command contract | PASS | CI `test:phase0-contract` — 8 tests passed, including command presence/targets, gate failure propagation, database lifecycle wiring, and portable workspace paths. |
| Archive/environment hygiene | PASS | CI `verify:archive-hygiene` — 5 tests passed; Git index has no prohibited environment/private-key path and `.env.example` passed placeholder validation. A ZIP created from the exact verified commit with `git archive --format=zip` also passed `node tools/run_python_tool.js tools/verify_archive_hygiene.py --archive <archive>`; the temporary ZIP was removed after inspection. ZIP member filtering was tested with a sentinel `.env` fixture. |
| Explicit package type-check | PASS | CI `typecheck:v4` explicitly checked domain, contracts, DB, testkit, API, and workspace after force-building referenced declaration projects. |
| Architecture | PASS | CI `verify:arch` — 115 modules and 173 dependencies, no dependency violations. |
| Domain unit suite | PASS | CI `test:unit` — 10 files, 70 tests passed. |
| Migration runner and schema invariants | PASS | CI `test:db:migrations` on PostgreSQL 18.6 — 3 files, 9 tests passed. Includes schema rejection before connecting, transaction rollback without a false ledger row, two simultaneous clean runners, deterministic complete ledger, replay as a no-op, real PostgreSQL failure/retry, append-only `domain_events`, conditional/partial indexes, required event FK, `registered_current`, and actual `allow_minor_members=false` / `registered_current` seed execution. |
| Applied migration files | PASS | 9 files, lexically ordered: `0001_kernel.sql`, `0002_identity.sql`, `0003_policy.sql`, `0004_enrolment.sql`, `0005_evidence.sql`, `0006_legal.sql`, `0006b_governance_stub.sql`, `0007_aggregate_states.sql`, `0008_rls_tenant_isolation.sql`. |
| BDD harness | PASS | `npm run test:bdd` — 49 enabled scenarios and 224 steps passed. These are harness results and are not claimed as coverage of Phase 1 behavior. |
| Traceability | PASS | CI `verify:trace` — 205 feature scenarios, 174 `@wip`, 26 hard non-`@wip` scenarios mapped; all requirement tags resolve. |
| Accessibility scenario | PASS | CI `test:a11y` — 1 Playwright accessibility test passed. |
| Phase 0 aggregate | PASS | The retained artifact reports `PASS` for `npm run verify:phase0` on exact commit `c70d3f439907e5ff37aee3953704e29d899e0032`; the sanitized log reaches the end of the gate. Run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720), artifact `phase0-evidence-c70d3f439907e5ff37aee3953704e29d899e0032`. |
| Legacy verification floor | PASS | CI built the bundle, passed oracle (10 cases × 3 destinations), help (91 entries, 23 tour steps, 8 visible texts), bundle sanitization, and Vitest (10 files, 167 tests passed). |
| Full legacy `verify:all` including browser E2E | FAIL; carried forward to Phase 1 | The prior full run had 32/35 browser tests pass; the three failures were `tests/workspace/login.spec.ts` connection refusals at `/login`. The Phase 0 gate intentionally runs `verify:legacy-floor` plus a separate `/components` accessibility test; it excludes `test:e2e` and login acceptance. Login behavior belongs to Phase 1 WP-1.9 and Phase 1 Gate 1.9. These failures do not invalidate the Phase 0 gate. |
| Compose DB lifecycle | PASS in exact Phase 0 workflow | In run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720), the Phase 0 job completed its prerequisite DB lifecycle and isolated PostgreSQL startup steps before the aggregate; PostgreSQL server version recorded in the artifact is 18.6. |
| Prior standalone DB integration failure | Remediated; not the current Phase 0 gate result | The earlier `test:db` failure was caused by concurrent suites toggling a shared append-only trigger outside a transaction. Commit `c70d3f4` wraps trigger disable/delete/enable cleanup atomically. The local `npm run test:db --workspace @symphony/db` passed 16 tests (3 skipped); this standalone command is not part of `verify:phase0`, whose real-PostgreSQL migration suite passed 9/9 in the exact CI run. |
| Full legacy CI E2E job | Separate Phase 1 result; excluded from Phase 0 closeout | Earlier job [127757445803](https://github.com/codemwizard/CooperativeManagement/actions/runs/42176935319/job/127757445803) failed during clean-checkout setup because `dist/` was absent; `verify:legacy-floor` now builds `dist/` first and passed in the exact Phase 0 CI run. The full login E2E result is not included in the Phase 0 artifact. The previously observed three `/login` failures are Phase 1 WP-1.9 carry-forward items, not Phase 0 failures. |

The `.env` file was checked locally without recording its values. Its entries were local development configuration; no live credential was identified in this inspection. The current Git index does not track `.env`; `.env.example` contains placeholders. This inspection cannot establish whether a prior external copy exists or prove a third party never received it. No claim of historical rotation or archive-wide delivery audit is made. No repository-local ZIP/export generator was found; the unrelated `UI-Designs.zip` is not an application source distribution. Automated checks cover tracked paths and ZIP member lists when a distributable ZIP is supplied.

The final full local aggregate was rerun after the command-contract check, npm pin validation, PostgreSQL failure/retry case, and schema/seed invariant checks were added; it passed on 6 November. The final run includes the 3 command-contract tests, 9 PostgreSQL migration/invariant tests, all six package type-checks, 49 BDD scenarios, the accessibility test, and the 162-test legacy floor.

After that aggregate, the existing standalone DB and full legacy E2E CI jobs were restored, and the toolchain contract was extended to check PostgreSQL service image tags in the workflow. The updated focused toolchain tests and actual runtime check passed; the final workflow YAML parse passed as well.

## Closure decision

**Phase 0 closure gate: PASS — Phase 0 remediation is complete for the exact verified revision `c70d3f439907e5ff37aee3953704e29d899e0032`.** The retained CI artifact reports `PASS`; the full sanitized log shows the required scripts, clean type-check, architecture, unit tests, real-PostgreSQL migration tests, 49 BDD scenarios, traceability, accessibility check, and legacy regression floor all completed successfully. CI recorded Node 26.7.0, npm 11.19.0, and PostgreSQL 18.6. The migration files and order are listed above. The artifact's optional `testSummaries` and `migrationFilesApplied` JSON arrays are empty because those formats are not emitted by the current log/parser; the sanitized log and this report retain the actual counts and migration inventory. This metadata limitation does not hide a failed or skipped Phase 0 check.

The earlier full browser run's three login failures are Phase 1 WP-1.9 work and are carried forward in [`PHASE-1-IMPLEMENTATION.md`](../Implementation-Plan-V4/implementation/PHASE-1-IMPLEMENTATION.md). They are outside `verify:phase0` by the Phase 0 remediation plan §1 and do not block Phase 0 closure. Phase 1 remains In Progress. No separate independent verifier was assigned; that limitation is recorded above.
