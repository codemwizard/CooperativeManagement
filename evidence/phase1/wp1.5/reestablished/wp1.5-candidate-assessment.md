# WP1.5 candidate closure assessment

**Assessment date:** 2026-11-19
**Exact source candidate:** `8eb49ca4a4707080f216d7c10f4246854e6b4857` on isolated branch `codex/wp1.5-reestablished`.
**Current evidence commit before this reconciliation:** `dc34ae46e8f8fe091712ae84c381d236fb073d97`.
**Disposition:** Local WP1.5 acceptance and Phase 0 regression checks pass on the exact source candidate. Gate verification remains pending only for candidate-specific hosted CI/artifact evidence and its final reconciliation. The old d7fb SHA is unrecoverable by owner direction; its evidence remains historical and unchanged.

## Candidate/predecessor and environment

- Source candidate was created in an isolated worktree; the active dirty WP6.1 main checkout was not copied or modified by candidate source work.
- `REM-WP0.3`, `REM-WP1.2`, `REM-WP1.3`, and `REM-WP1.4` source SHAs are ancestors of the candidate. Their task records remain the predecessor evidence sources.
- A disposable local PostgreSQL 18.0 cluster was initialized in the OS temp directory, then bootstrapped through `node tools/bootstrap_wp1_5_database.mjs`. It applied migrations 0001–0015. PostgreSQL evidence confirms 39 tenant policy expressions, matching this source candidate's frozen manifest, and uses separate `symphony_migrator`, `symphony_app`, and `symphony_outbox_writer` roles.
- The sanitized database/role record `candidate-postgres-role-state.json` contains no URLs or passwords. The finalizer revoked temporary role membership; app, migrator and writer roles satisfy the no-superuser/no-inherit/no-membership attributes.
- Toolchain gate reports Node 26.7.0, npm 12.2.0, PostgreSQL 18.0.

## Acceptance reconciliation

| Criterion | Evidence | Result | Remaining limitation |
|---|---|---|---|
| Environment files remain private and excluded from evidence | `set-env.ps1` was dot-sourced; secret values were never printed. `candidate-phase0-gate-exact.raw.log` includes archive hygiene and repository file scan. | Pass locally | No environment values are retained. |
| Archive builder + independent verifier reject unsafe paths and retain safe files | `candidate-phase0-gate-exact.raw.log`; 9 archive tests and standalone verifier passed. | Pass | Hosted candidate job remains pending. |
| Live tenant policies match frozen manifest; effective grants correct | `candidate-postgres-db-suite-final.raw.log`; WP1.5 actual-role suite reports all 39 policies and effective grants matched. | Pass locally | Hosted same-SHA rerun pending. |
| Every distinct inherited-parent path and missing/empty/mismatched scope tested under app role | Same DB log; all five WP1.5 actual-role tests passed, including unfiltered parent-chain checks and pooled transaction-local context. | Pass locally | Hosted same-SHA rerun pending. |
| Event outbox RLS/writer ACL and denied direct app access | Same DB log; test verifies outbox boundary and atomic command path. | Pass locally | Hosted same-SHA rerun pending. |
| WP1.3 exact SHA and predecessor evidence | `evidence/phase1/wp1.3/task-evidence.json` pins `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`, an ancestor of source candidate. | Pass (predecessor record) | This is separate predecessor evidence. |
| Workflow failure propagation and Phase 1 structure | `candidate-phase1-contracts-final.raw.log`, `phase1-structural-validator.raw.log`; 112 tests and structural graph validation passed. | Pass locally | Candidate-specific hosted CI pending. |
| Clean install, replay, 0012→0013 upgrade, migration rollback/retry | `candidate-postgres-db-migrate.raw.log` and `candidate-postgres-db-suite-final.raw.log`; migrations 0001–0015 applied; all 65 DB tests passed across 12 files. | Pass locally | Hosted same-SHA rerun pending. |
| Restricted-role DB suite, cross-organisation BDD, final role state | `candidate-postgres-db-suite-final.raw.log`, `candidate-postgres-bdd.raw.log` (1/1 scenario, 7/7 steps), `candidate-postgres-role-finalizer.raw.log`, `candidate-postgres-role-state.json`. | Pass locally | Hosted artifact bundle pending. |
| Phase 0 and legacy regression gates | `candidate-phase0-gate-exit.raw.log` records `PHASE0_EXIT=0`; `candidate-legacy-floor.raw.log` records `LEGACY_FLOOR_EXIT=0`; accessibility passed 1/1 and legacy test suite 286 passed/1 skipped. | Pass locally | Hosted candidate run pending. |
| Candidate artifacts/checksums and task status align | `task-evidence.json` is rebound to `8eb49ca...`; checksums in `SHA256SUMS.txt`; evidence schema validator. | Pass locally | Recompute manifest after this report’s final edit/commit. Hosted run ID, raw logs, and artifact checksums remain outstanding. |

## Candidate source fixes made

The first exact candidate Phase 0 run reached the legacy-floor build and reported three unused declarations. Three minimal fixes were made and committed as source candidate `8eb49ca4a4707080f216d7c10f4246854e6b4857`: remove unused `BrowserContext` type import from `tests/workspace/login-api.spec.ts`; stop storing the already-consumed `resultDataSchemas` constructor parameter as a property in `packages/db/src/repositories/postgres-command-receipt-store.ts`; mark the unused first `PostgresRepository` constructor parameter `_db` in `packages/db/src/repositories/postgres-repository.ts`. Runtime behavior did not change. `npm run build` and `npm run verify:legacy-floor` then passed.

## Remaining to finish this stage

1. Push/source candidate `8eb49ca4a4707080f216d7c10f4246854e6b4857` to the authorized CI trigger (or obtain its CI run through the project’s established process).
2. Retain the exact-SHA Phase 0 and WP1.5 DB CI jobs/artifacts. Confirm run SHA, job outcomes, raw logs, and SHA256 checksums; preserve previous d7fb artifacts unchanged.
3. Reconcile task evidence with hosted run ID/attempt and verified artifact checksums. Only then change `gate_verified` from `pending` to `passed` and synchronize status summaries/dependency records if required.

No manual dependency override or downstream gate pass is claimed.


## Revalidation after incorporating remote main

Candidate commit: 6f145875761a2c356bab790324c8a5615ec03652 (merge of fetched origin/main SHA 910fc6055c189133643c52812150b04d38bf01f2). The working tree outside WP1.5 evidence matches the earlier tested source tree at 8eb49ca4a4707080f216d7c10f4246854e6b4857.

| Check | Result | Evidence |
|---|---|---|
| Apply migrations 0001–0015 on fresh disposable PostgreSQL 18 UTF-8 cluster | Passed | candidate-merge-db-migrate.raw.log |
| Restricted-role PostgreSQL suite | 12/12 files, 65/65 tests passed | candidate-merge-postgres-db-suite.raw.log |
| WP1.5 BDD-AUD-005 | 1/1 scenario, 7/7 steps passed | candidate-merge-postgres-bdd.raw.log |
| Phase 0 gate | Exit 0; all constituent checks completed | candidate-merge-phase0-gate.raw.log |
| Role finalizer | Passed | candidate-merge-role-finalizer.raw.log |

The first attempt against the configured shared test database failed 4/65 database tests because its D-18 trigger reflected later schema state. The next fresh-cluster attempt used Windows default WIN1252 encoding and could not apply migration 0001. Both diagnostic logs are retained; neither is used as acceptance evidence. A fresh UTF-8 PostgreSQL 18 cluster then passed the listed checks. The Phase 0 log includes an esbuild “The build was canceled” line after the accessibility test passed; the overall verifier returned exit 0 and its remaining legacy-floor checks passed.

Gate remains pending: hosted CI for the candidate and hosted artifact retention/checksum reconciliation have not yet occurred. The candidate is 18 commits ahead of the current main merge-base and includes broader shared work-package history; review the full PR scope before merging to main.

## Hosted candidate CI and final WP1.5 gate disposition

Candidate SHA: 6f145875761a2c356bab790324c8a5615ec03652. GitHub Actions run 44575936287, attempt 1, push branch phase/wp1.5-reestablished.

| Required result | Verification | Evidence |
|---|---|---|
| Phase 0 job | Passed | evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/phase0/phase0-ci-evidence.json |
| Restricted-role DB/WP1.5 job | Passed; 12 files and 65 tests | evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/database/db-integration.raw.log |
| WP1.5 cross-organisation BDD-AUD-005 | Passed; 1 scenario and 7 steps | evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/database/bdd-wp1.5.raw.log |
| Always-run role finalizer | Passed | evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/database/role-finalizer.raw.log |
| Artifact retention and checksums | Three hosted bundles, 90-day retention; download sizes and SHA-256 verified | evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/provider-artifact-manifest.json and SHA256SUMS.txt |

The overall workflow conclusion is failure because the separate legacy-e2e job failed two tests in tests/workspace/login.spec.ts (33 passed). The Vite proxy could not connect to the absent API server at 127.0.0.1:3000 for /auth/session. The authoritative WP1.5 CI plan says verify:all browser failures are separately reported and do not establish or negate WP1.5 DB acceptance. Therefore REM-WP1.5 gate_verified is passed for this exact candidate, while full repository CI remains red.

The candidate branch includes 18 commits beyond the current main merge-base. The gate result does not authorize merging that cumulative history into main; review/split its broader work-package scope separately.
