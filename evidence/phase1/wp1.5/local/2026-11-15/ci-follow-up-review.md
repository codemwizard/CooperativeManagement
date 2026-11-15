# WP1.5 CI follow-up review

## Inputs reviewed

This review is based on the CI output pasted by the project owner. No GitHub Actions status or artifact query was made.

The pasted run reports:

1. `verify:toolchain` failed because the hosted Node 26.7.0 runner's installed npm was `11.19.0`, while the repository contract requires `12.2.0`.
2. The reviewer identified that GitHub's unspecified Linux run shell is not equivalent to explicit `shell: bash` for pipeline status: the `tee` pipelines in DB and legacy jobs could return tee's success while masking the command's failure.

## Corrections made in the worktree

### CI-6: deterministic npm version without a global install

- Added `tools/prepare_ci_npm.sh`.
- It reads the required Node/npm versions from `toolchain.json`, rejects a Node mismatch, and installs npm `12.2.0` only under `$RUNNER_TEMP/symphony-npm`.
- It creates explicit `npm` and `npx` wrappers that call the exact installed CLI, adds that wrapper directory through `$GITHUB_PATH`, and records its full expected path in `$GITHUB_ENV`.
- Each job asserts `command -v npm` equals `NPM_BIN` and checks `npm --version` before `npm ci`. `verify:toolchain` now executes the resolved npm command directly instead of trusting a possibly inherited `npm_config_user_agent` value.
- Added the preparation step to all three workflow jobs before npm version verification and `npm ci`.
- Extended `tools/verify_toolchain.mjs` and `tools/toolchain-contract.mjs` to validate the helper's local-prefix install, direct version check, workflow invocation, and the absence of global npm installation.

### CI-7: preserve failures across `tee`

- Added workflow-wide `defaults.run.shell: bash`; every workflow `run` step now uses GitHub's explicit Bash shell with `-e -o pipefail`.
- Added contracts that require the Bash default and all seven evidence-capturing `tee` pipelines.
- Added a functional failure-propagation test that runs `node` exit 23 through `bash --noprofile --norc -e -o pipefail` and `tee`. The test runs on Linux CI; it is skipped on Windows because the available `bash.exe` is a WSL shim and is denied by the local host.

## Local checks

- `npm run test:toolchain`: passed, 4/4, including rejection of global npm installation.
- `npm run test:phase0-contract`: passed, 10 passed and 1 Linux-only pipeline test skipped on Windows.
- `npm run verify:toolchain`: passed with Node `26.7.0`, npm `12.2.0`, and PostgreSQL `18.0` package build `18.0-2`.
- `git diff --check`: passed.

The functional Bash pipeline regression was not executed on this Windows host. It is deliberately enabled on Linux CI, which is the environment whose shell semantics were implicated in the report. No CI pass is claimed for these follow-up changes. The previous pushed candidate does not include this follow-up worktree state.

## Required follow-up

Commit these fixes and run CI on that exact candidate. Confirm the npm preparation reports `12.2.0`, and that a failing logged command makes the owning job fail while preserving its raw log. Only then reconcile the WP1.5 task record; do not infer CI success from the earlier candidate's local tests.

## Work-package gate ownership

- The no-mock browser-to-API login test is owned by WP5.3. Its failed run does not block WP1.5 closeout, which depends on WP0.3, WP1.2, and WP1.4. Keep it in the dedicated Phase 1/WP5 gate and exclude it from the generic legacy E2E config that runs without the API/test-database composition.
- The WP1.5 CI job does run the complete `@symphony/db` package suite. Any failure there blocks a clean WP1.5 candidate gate even when its implementation owner is WP1.2 or WP1.3. Diagnose it under the owning contract and retain both the focused owner-specific result and full WP1.5 candidate regression result; do not erase, downgrade, or weaken an assertion to make the broad gate green.
- On this Windows workstation, `symphony` connected to `symphony_phase1_test` is neither superuser, table owner for all forced-RLS fixtures, nor `BYPASSRLS`; the configured `postgre` admin URL rejects authentication. Consequently broad-suite outbox counts, fixture cleanup, and the WP1.5 BDD administrator precondition do not represent the CI bootstrap identity. The focused actual-role WP1.5 integration suite passes locally with its test-only policy inspection, but a complete local DB suite/BDD pass must wait for a valid isolated test administrator matching the CI privilege contract. This is an environment limitation, not a claimed WP1.2/WP1.3 product pass.

## Follow-up execution on 2026-11-15

- `node ..\..\node_modules\vitest\vitest.mjs run src/__tests__/tenant-rls-app-role.integration.test.ts --reporter=verbose` from `packages/db`, with the isolated `symphony_phase1_test` URLs and test mode: **passed, 4/4**. The administrator URL for this run used the locally available `symphony` credentials; the test confirmed actual application connections use `symphony_app`. No credential values are recorded.
- `node tools/run_e2e.mjs tests/workspace/login.spec.ts`: **passed, 3/3**. The runner now starts both the legacy 5173 app and workspace 5174 app.
- `npm run test:phase1:contracts`: **passed, 107/107**; includes the regression proving the API-backed login acceptance stays excluded from generic legacy E2E and remains wired into the dedicated Phase 1 login gate.
- `npm run verify:phase1:contracts`: **passed**; contract structure/dependency graph validation passed.
- Full `@symphony/db` package run using the available non-superuser `symphony` local identity: **failed, 16 tests; passed, 34; skipped, 8**. The failures include outbox inspection returning zero under forced RLS, RLS-denied fixture setup, and cleanup blocked by dependent outbox/security-attempt rows. These are not comparable to the CI configuration, whose PostgreSQL service bootstrap user is superuser. Do not close the full-suite regression gate based on this run; obtain a correctly privileged isolated local admin or the candidate CI run.
- Dedicated `login-api.spec.ts` could not start its API server because `apps/api/package.json` points to missing `apps/api/src/server.ts`. This is a WP5 implementation defect and does not gate WP1.5. It remains open for WP5.3 and the later Phase 1 gate; no login API pass is claimed.
- Retried the configured `PHASE1_TEST_ADMIN_DATABASE_URL` directly via Node's native `--env-file=.env.local` loading, without emitting the URL or password. PostgreSQL rejected it with SQLSTATE `28P01` for role `postgre`. The local `symphony` role has `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, and `rolbypassrls=false`. Thus the requested local administrator path remains unavailable with the credentials currently stored in `.env.local`.
- Full generic legacy E2E after the split ran 35 tests: **33 passed and 2 Phase 2 component-shell tests timed out** on `/components`. The 3 login-page tests passed. Those component failures belong to their mapped Phase 2 tests and are recorded separately from WP1.5 acceptance.

The test-only inspection policy added to the WP1.5 integration fixture targets only `current_user`, never `symphony_app`; it is removed in `afterAll` and recreated idempotently before each fixture run. Its purpose is to let a non-superuser local schema administrator verify rows hidden by `FORCE ROW LEVEL SECURITY`, while the app-role read-denial assertions remain unchanged.

## Final isolated-cluster verification on 2026-11-15

After the connection retry, the administrator URL loaded from `.env.local` connected successfully as PostgreSQL superuser `postgres`. To avoid collisions with project roles already present in the workstation cluster, verification used a fresh temporary PostgreSQL 18 cluster bound to `127.0.0.1:55439` and a fresh UTF-8 database `symphony_wp1_5_test`. The cluster and generated role credentials are local-only; no application/real data was used. Raw outputs and checksums are retained beside this report.

- `node tools/bootstrap_wp1_5_database.mjs`: passed; created disposable `symphony_migrator`, `symphony_app`, and `symphony_outbox_writer` identities.
- `npm run db:migrate:test`: passed clean install; migrations 0001–0013 applied in order.
- `npm run db:migrate:test`: passed replay; all migrations were no-ops.
- `npm run test:db:migrations`: passed, 14/14, including clean install, concurrent replay, 0012→0013 upgrade, injected failure rollback, and retry.
- `npm run test:db --workspace @symphony/db`: passed, 58/58 across 11 files. This includes WP1.2/WP1.3 regressions, WP1.4 persistence, and WP1.5 actual-role RLS/outbox checks.
- `npm run test:bdd:wp1.5`: passed, 1 scenario and 7 steps; the cross-organisation behavior used PostgreSQL and `symphony_app` probes.
- `npm run verify:phase0`: passed with Node 26.7.0, npm 12.2.0 and PostgreSQL 18.0. Results include 4 toolchain tests, typecheck, architecture (132 modules/263 dependencies), 92 domain tests, 14 migration tests, traceability, accessibility, and the legacy floor (276 passed, 1 skipped). The Phase 0 BDD filter reported 0 scenarios; [PHASE0_COMMAND_MAP.md](../../../../../docs/PHASE0_COMMAND_MAP.md) explicitly records that Phase 0 has no enabled `@phase0` scenarios and does not claim BDD behavior coverage.
- `bash --noprofile --norc -e -o pipefail -c 'node -e "process.exit(23)" | tee /dev/null'`: observed exit 23 using Git for Windows Bash. The existing contract test skips its Bash runtime case on Windows; this manual probe verifies the same failure propagation on the host.
- `node tools/finalize_wp1_5_database.mjs`: passed after all tests; verified temporary migrator membership was revoked and final role attributes were correct.

This closes the **local WP1.5 implementation and runtime verification** gates, including the full regression suite. The canonical task record remains gate-blocked until the exact committed candidate has the required SHA-bound CI artifacts from the workflow (including the CI finalizer). No remote CI query or result is claimed here. WP5.3's API-backed login test remains a separate, still-open WP5 item and is not a WP1.5 criterion.
