# REM-WP1.5 CI Remediation and Closeout Plan

> Historical closeout plan. Its WP1.6 “must remain not started” section records the state when this plan was prepared. The six WP1.6-owned mapped scenarios have since passed through the real command path, with evidence retained in `evidence/phase1/wp2.3/task-evidence.json`; this is mapped acceptance evidence, not a standalone WP1.6 gate record. Current status is determined by the dependency graph and current task evidence, not the earlier readiness snapshot below.

**Status:** Historical candidate d7fbf5851b11b07b65bde36f062db7b21f487947 passed run 43683206104, attempt 1; those artifacts remain immutable. Current REM-WP1.5 gate verification passed for candidate 6f145875761a2c356bab790324c8a5615ec03652 in run 44575936287, attempt 1. The Phase 0 and restricted-role DB/WP1.5 jobs passed, with retained artifacts/checksums under evidence/phase1/wp1.5/ci/6f145875761a2c356bab790324c8a5615ec03652/. The overall workflow failed only in the separate legacy-e2e job on two login UI tests; per section 6 this does not negate REM-WP1.5 database acceptance. Full repository CI is not green. The canonical status remains evidence/phase1/wp1.5/task-evidence.json and the Phase 1 closure register.
**Plan owner:** Phase 1 implementation owner.
**Authority:** `PHASE-1-REMEDIATION-PLAN-v2.md` REM-WP1.5 and REM-WP1.6; `evidence/phase1/task-dependencies.yml`; `docs/phase1/TENANT_ISOLATION_CONTRACT.md`; `evidence/phase1/tenant-table-policy-matrix.json`; `evidence/phase1/wp1.5/task-evidence.json`.
**Current repository candidate when drafted:** `dd21c22b6301bd74534d5d09dacb6e04daf9ddc7`. This SHA identifies the plan's inspected starting tree only. Each implementation/CI evidence record must use the exact tested candidate SHA.

## 1. Objective

Resolve the four failures in the supplied CI log plus verification defects found while implementing this plan, retain candidate-bound database and CI evidence, complete every remaining REM-WP1.5 migration/RLS/outbox/role-bootstrap check, update REM-WP1.5 evidence without overstating results, and keep REM-WP1.6 blocked until every dependency in its graph row has a passing record.

The plan has two completion gates:

1. **CI repair gate:** the four observed failures are fixed with focused regression tests; CI retains raw job logs keyed to the commit SHA. Phase 0 BDD runs only `@phase0` scenarios, and the frozen Phase 1 BDD gate owns `@phase1` behavior.
2. **REM-WP1.5 closeout gate:** the exact candidate has a clean-install migration 0013 result, full actual-role DB integration result, migration failure-atomicity/upgrade evidence, complete outbox and append-only evidence, successful temporary-membership finalization, and a schema-valid task record pinned to that candidate.

Passing the broad DB workspace suite alone does not satisfy either gate. It is useful regression evidence, but it does not prove clean migration setup, migration 0013 failure atomicity/upgrade, REM-WP1.5-owned BDD acceptance, role finalization, or candidate-bound CI evidence. Phase 1/Phase 2 BDD and browser failures are recorded against their mapped owners and do not reopen the already-closed REM-WP0 baseline unless a dependency explicitly requires them.

**Gate ownership clarification:** REM-WP1.5 requires the complete `@symphony/db` suite to pass on its candidate because the CI job runs that suite as a regression gate. A failing REM-WP1.2/REM-WP1.3 test therefore blocks a clean REM-WP1.5 candidate result until it is diagnosed and resolved or shown to be an invalid local test environment; code ownership of a correction remains with the work package whose behavior/test is wrong. This does not transfer REM-WP1.2/REM-WP1.3 acceptance ownership or authorize rewriting their assertions to accommodate a misconfigured local database role. The CI contract provisions the PostgreSQL service's `symphony` bootstrap identity as the database administrator; local runs must use an identity meeting the same required privileges before treating forced-RLS-visible fixture counts or cleanup failures as product regressions.

The API-backed login browser test is REM-WP5-owned and is not a REM-WP1.5 dependency or closeout criterion. It remains a required check in the later Phase 1/REM-WP5 gate with `playwright.phase1.config.ts`, which starts the workspace and API servers and requires an isolated test database. The legacy `test:e2e` suite must not discover that test under `playwright.config.ts`; its run is recorded separately and cannot block or satisfy REM-WP1.5. This separation does not waive the REM-WP5.3 implementation or its dependency gate for REM-WP1.6.

## 2. Status at plan drafting and final evidence boundary

- At plan drafting, `evidence/phase1/wp1.5/task-evidence.json` reported a blocked integration and gate status. That historical state has been superseded by the passing run recorded at `evidence/phase1/wp1.5/ci/d7fbf5851b11b07b65bde36f062db7b21f487947/run-summary.md` and the updated canonical task record.
- `evidence/phase1/wp1.5/local-verification.md` and the dated local reports remain historical evidence. They document constraints and failures observed in earlier local environments; they do not override the later hosted run using the provisioned CI administrator and roles.
- The supplied `npm run test:db --workspace @symphony/db` run reported 11 files and 57 tests passed, including command transaction/audit, concurrency, reconciliation, and tenant/RLS suites. Preserve this as a distinct full-DB-run artifact with its own commit and runtime provenance. It does not replace either CI artifact below.
- The earlier supplied CI log lacked a visible workflow run ID and candidate SHA and remains historical, unpinned input. The later `wp1.5-run2` artifacts provide candidate SHA `d7fbf5851b11b07b65bde36f062db7b21f487947`, run ID `43683206104`, attempt `1`, and matching SHA-named Phase 0/database/legacy artifact sets; only those artifacts are used for this closeout.
- Historical REM-WP1.1/REM-WP1.2/REM-WP1.4 records and historical PostgreSQL 18.0/18.6 results remain unchanged. Every new record reports the actual PostgreSQL server version and package build used.

## 3. Observed CI failures and required corrections

| ID | Observed failure | Required correction | Required regression proof |
|---|---|---|---|
| CI-1 | `migration-runner.integration.test.ts` expects `to_regclass('symphony.phase0_recovery_fixture')` to stringify as `symphony.phase0_recovery_fixture`; PostgreSQL returns the unqualified `phase0_recovery_fixture` when `symphony` is on `search_path`. | Assert the relation resolves to a non-null OID and that `pg_class.relnamespace` names schema `symphony`; do not assert `regclass` display text. | Keep rollback/no-ledger/retry assertions. Add/adjust the focused assertion so it passes with either qualified or unqualified `regclass` rendering while proving the object is in the correct schema. |
| CI-2 | The security-attempt FK test compares `pg_get_constraintdef` text to `REFERENCES symphony.tenants(id)`; PostgreSQL returns `REFERENCES tenants(id)` under the active `search_path`. | Assert the FK structurally using `pg_constraint.confrelid`, `pg_class.relname`, and `pg_namespace.nspname`, plus the constrained `tenant_id` column. | Test that the FK targets exactly `symphony.tenants(id)` without depending on display qualification. Do not weaken the assertion to merely “some foreign key exists.” |
| CI-3 | `npm run db:migrate:test` reaches `0013_tenant_rls_app_role.sql` and fails with `must be owner of function symphony.enqueue_command_outbox_message`. | Reproduce on a fresh disposable PostgreSQL 18.0 database using the exact CI bootstrap/migration identities. Identify the failing statement and query `session_user`, `current_user`, `pg_proc.proowner`, schema owner, and membership/SET ROLE attributes at that boundary. Correct function creation/ownership sequencing so the migration can install the fixed-search-path `SECURITY DEFINER` function and transfer/use its intended `symphony_outbox_writer` owner without broadening runtime privileges. Preserve migration-owner/app-role separation and ensure the CI finalizer removes temporary membership. | Red test starts from migration 0012 and proves 0013 fails atomically if the ownership precondition is absent or the controlled ownership step fails: no partial grants/policies/function/ledger row. Green tests prove clean install through 0013 and upgrade 0012→0013 with function owner and execute grants exactly as specified, under the real CI bootstrap roles. Never solve this by running product migrations as cluster superuser or granting broad permanent privileges. |
| CI-4 | `verify:all` build fails because `tests/tooling/phase1_contracts.test.ts` imports `validateTenantPolicyManifest`, exported by `tools/phase1-contracts.js` but absent from `tools/phase1-contracts.d.ts`. | Add the matching typed declaration to the `.d.ts` surface, with parameter/return types aligned to the implementation; retain the test import and call. | TypeScript build/typecheck must compile the test and validator surface. Add a type-level or compile-path assertion if the existing build does not include this test file; do not remove the validation test or suppress the missing export. |
| CI-5 (found during verification) | The REM-WP1.4 reconciliation integration test hard-codes `symphony_phase1_test`, while CI bootstraps `symphony_test`; the DB suite fails before exercising its scenarios. | Derive the expected target database from `PHASE1_TEST_APP_DATABASE_URL`, and still require its name to end with `_test`. | Run the reconciliation tests in both the configured CI database and an isolated local test database; assert the connected `current_database()` equals the parsed configured name. |
| CI-6 (reported by the follow-up CI run) | GitHub's Node 26.7.0 runner selected a bundled npm CLI that did not match the repository's exact npm 12.2.0 requirement. The former workflow comment incorrectly assumed the runner bundle already supplied the approved version. | Add `tools/prepare_ci_npm.sh`: verify Node against `toolchain.json`, prepare the exact npm under `$RUNNER_TEMP/symphony-npm` (never globally), verify the CLI directly, create explicit `npm`/`npx` wrappers that invoke that CLI, add their directory through `$GITHUB_PATH`, and publish the expected `NPM_BIN` through `$GITHUB_ENV`. Before `npm ci`, assert `command -v npm` equals `NPM_BIN` and that `npm --version` is 12.2.0. | The toolchain contract validates the helper, wrapper creation, workflow invocation, resolved npm path assertion, and direct CLI version check. `verify:toolchain` must execute `npm --version` rather than trust inherited `npm_config_user_agent`. Include tests that reject a missing helper, global installation and a missing executable-path assertion. |
| CI-7 (reported by the follow-up CI review) | Logging steps pipe bootstrap, migration, database tests, focused BDD, finalizer and legacy verification through `tee` without an explicit pipefail shell; a failing command can therefore be reported as success. | Set workflow-wide `defaults.run.shell: bash`. GitHub's explicit Bash mode runs each step with `-e -o pipefail`; retain the raw `tee` logs and do not rewrite commands to mask their original exit codes. | Contract-test that workflow default and every expected log pipeline are present. Execute a command that exits 23 through the same Bash `-e -o pipefail` plus `tee` pipeline and assert the step receives exit 23. Run that regression on Linux CI, where Bash is available. |

The supplied CI output showed earlier checks passing: 8 script-contract tests, 3 toolchain tests, archive hygiene, typecheck, architecture analysis (132 modules / 260 dependencies), and 92 domain tests. Migration tests had 11 passes and 2 failures; the separate migration step failed in 0013; and `verify:all` stopped during build before E2E. Local execution after fixes later exposed four `@phase1` BDD failures and six browser E2E failures; the exact owners and outcomes are recorded in the execution report. These failures must not be relabelled as Phase 0 or REM-WP1.5 failures unless the scenario owner map assigns them to REM-WP1.5. The REM-WP1.5-owned cross-organisation BDD scenario remains a REM-WP1.5 acceptance item and must be resolved or accurately remapped through the reviewed contract process.

## 4. Ordered implementation and proof sequence

### WP1.5-CI-A — Preserve source evidence and pin the repair candidate

1. Record the CI workflow name, run ID/URL, event, branch, exact candidate SHA, checkout cleanliness, Node/npm/PostgreSQL versions, job names, and exit codes from provider metadata.
2. Preserve the pasted CI log and the earlier 57-test full DB workspace output as immutable inputs. Copy or attach their raw bytes under candidate-scoped evidence; compute SHA-256. Keep raw logs free of credentials, database URLs, generated passwords, and personal data. If sanitization changes the bytes, retain a separately labeled sanitized copy and hash; do not call it raw.
3. The supplied log's attachment SHA-256 is `321f7cf9b98a2187546e298d8869602aad756cd1733b681c55af59dddee9d336`. The earlier full DB output attachment SHA-256 is `ab18c52d00f767f25ef2c064803eeb63278ad4eb4bb0cb0400f2ef50959c4771`. Record both as user-provided historical inputs until their source run SHAs are confirmed.
4. Create a clean worktree from the current target branch before implementation. Do not change REM-WP1.5 status or reuse the earlier blocked record as if it described the new candidate.

### WP1.5-CI-B — Fix catalog assertion portability (CI-1 and CI-2)

1. Add/fix the tests first. Demonstrate the two observed failures against the PostgreSQL 18.0 CI service.
2. Replace formatted-name assertions with catalog identity assertions:
   - For the recovery fixture, assert `to_regclass(...) IS NOT NULL`, then join the returned OID to `pg_class`/`pg_namespace` and assert schema `symphony`, relation name `phase0_recovery_fixture`, and the expected row after retry.
   - For the FK, assert `conrelid` is `symphony.security_attempts`, `confrelid` is `symphony.tenants`, and the FK column/target column are `tenant_id`/`id`. A textual rendering may be retained only as diagnostic output, not the contract assertion.
3. Run `npm run test:db:migrations` against a disposable PostgreSQL 18.0 test DB. Require all migration-runner tests to pass, including rollback/no ledger/retry, constraints, REM-WP1.1 receipt schema, REM-WP1.2 security-attempt schema, REM-WP1.4 inbox/RLS, and non-empty legacy receipt refusal.

### WP1.5-CI-C — Repair migration 0013 function ownership (CI-3)

1. Reproduce on a fresh CI-equivalent PostgreSQL 18.0 database. Capture identities and function ownership before migration 0013, immediately before the failing ownership statement, and after rollback. Record role memberships and `SET ROLE` capability without printing passwords/URLs.
2. Write a deterministic failing integration case that exercises the exact clean bootstrap and migration-owner role. Prove the current failing run leaves migration 0013 absent from the ledger and leaves no partial policies, grants, trigger changes, or function changes.
3. Implement the narrow migration correction based on the ownership boundary. Create the enqueue function and its exact grants while `SET LOCAL ROLE symphony_outbox_writer` is active, then `RESET ROLE`; do not use a broad grant or superuser fallback. Requirements:
   - `symphony_app` remains non-owner, non-superuser, NOCREATEDB/NOCREATEROLE, NOINHERIT, NOBYPASSRLS, and cannot `SET ROLE` to the outbox writer.
   - `symphony_outbox_writer` remains NOLOGIN/NOINHERIT and receives only the exact schema/table privileges and function ownership needed to enqueue an event for the transaction-local tenant.
   - Any migration-role membership needed for ownership transfer is temporary, explicit, created by the CI bootstrap, and revoked by the `always()` finalizer. The finalizer must verify no membership remains and the final role flags match the matrix.
   - Function `search_path`, tenant validation, event visibility, event/outbox atomicity, PUBLIC EXECUTE revocation, and app-role EXECUTE grant remain exact. No blanket grants, superuser migration execution, or permanent migration-role inheritance.
4. Green proof must include: clean install through 0013; rerunning the migration is a no-op; upgrade from a database stopped at 0012 succeeds; injected 0013 failure rolls back all catalog/data/ledger effects; retry after removing the injected fault succeeds; function owner and ACL are correct; app role cannot write `event_outbox` directly or assume writer role; app can enqueue only through the constrained function with valid tenant/event context.

### WP1.5-CI-D — Restore the TypeScript contract declaration (CI-4)

1. Keep the test that calls `validateTenantPolicyManifest`; add its declaration to `tools/phase1-contracts.d.ts` and ensure it models the accepted manifest/matrix input shape and `string[]` validation errors.
2. Run the workspace typecheck and the legacy `npm run build`/`npm run verify:all` path far enough to prove the missing-export error is gone. No `@ts-ignore`, declaration suppression, test deletion, or excluded test path is acceptable.

### WP1.5-CI-E — Focused local/candidate verification

Run in order on the disposable target, recording exact exit code and artifact for each:

1. `npm run test:db:migrations`
2. `npm run db:migrate:test` on an empty isolated DB; confirm migrations 0001–0013 apply in order as `symphony_migrator`.
3. `npm run db:migrate:test` again; confirm all migrations are no-ops as the same migration identity.
4. Migration-0013 failure-atomicity and 0012→0013 upgrade tests, including complete before/after catalog snapshots for policies, grants, triggers, RLS flags and ledger state.
5. `npm run test:db --workspace @symphony/db` with the exact CI admin, migration, and application URLs produced by the bootstrap. Confirm all suites pass, including `tenant-rls-app-role.integration.test.ts`, security-attempt audit, command transaction, reconciliation, event-store immutability, and outbox worker tests. No role fallback is permitted.
6. The REM-WP1.5-owned `BDD-AUD-005` cross-organisation command scenario in the Phase 1 manifest must pass through its declared real DB path; a domain-only `UNAUTHORIZED` result is not accepted as proof of the SQL tenant boundary.
7. `npm run typecheck:v4`
8. `npm run verify:arch`
9. `npm run verify:trace`
10. `npm run verify:phase1:contracts`
11. `npm run test:toolchain` and `npm run verify:toolchain`

The attached 57/57 full DB run may be linked as historical supporting evidence; rerun on the final repair candidate after CI-1–CI-5 so it binds to the final code and migrations. Do not rerun REM-WP1.2 as a separate task solely because the broad DB suite includes REM-WP1.2 test files; retain its existing focused record and link the candidate regression result as cross-work-package evidence.

### WP1.5-CI-F — Clean CI acceptance and finalizer

1. Push/open the repair candidate through the normal CI workflow. The `db-integration` job must provision the disposable migration/app/outbox roles, apply migrations from a clean database, run the complete DB workspace suite, and execute its `always()` finalizer even when setup/migration/tests fail.
2. Require the REM-WP1.5 database job to complete clean install, replay/upgrade/failure-atomicity suite, full actual-role DB suite, and finalizer successfully. The Phase 0 job must use the Phase 0-only BDD filter; Phase 1/Phase 2 BDD and E2E failures must be kept in their mapped owner task records and must not be attributed to REM-WP1.5. REM-WP1.5's own BDD-AUD-005 remains required as specified in WP1.5-CI-E.
3. Verify uploaded logs/evidence identify the exact commit and runtime versions. Preserve full raw stdout and sanitized artifacts with immutable run ID and checksums. A green finalizer is mandatory: it revokes temporary `symphony_outbox_writer` membership from `symphony_migrator` and confirms the app/writer role flags and memberships. A passing DB test job with a failed/skipped finalizer is not a pass.
4. Required final outputs under `evidence/phase1/wp1.5/`:
   - `ci/<candidate-sha>/phase0-gate.raw.log` plus sanitized CI evidence;
   - `ci/<candidate-sha>/role-bootstrap.raw.log`;
   - `ci/<candidate-sha>/db-migrate.raw.log`;
   - `ci/<candidate-sha>/db-integration.raw.log` (includes the previously missing restricted-role suite);
   - `ci/<candidate-sha>/role-finalizer.raw.log`;
   - `ci/<candidate-sha>/verify-all.raw.log` when the legacy job is run; classify it separately from REM-WP1.5 DB acceptance;
   - migration clean-install, replay, upgrade, failure-atomicity and retry logs;
   - `task-evidence.json` pinned to the exact candidate SHA, recording environment, role identities, exact commands, results, counts, artifact paths, coverage limitations, and CI run ID.

### WP1.5-CI-G — REM-WP1.5 evidence and dependency closeout

1. Update `evidence/phase1/wp1.5/task-evidence.json` only after WP1.5-CI-A through WP1.5-CI-F all pass. Set `integration_test` and `gate_verified` to `passed`; preserve precise role/environment values and limitations. Do not use `working-tree` for a completed record.
2. Update the canonical REM-WP1.5 record at `evidence/phase1/wp1.5/task-evidence.json` and any existing mirrored REM-WP1.5 status/navigation records so they agree with the task graph. `evidence/phase1/tasks.json` currently contains REM-WP0 completion records; do not invent or duplicate a REM-WP1.5 entry there unless the repository's evidence model is deliberately changed. Preserve `local-verification.md` as historical partial evidence; add new records rather than rewriting its historical observations.
3. Run the evidence schema/dependency validator. REM-WP1.5 can pass only if its prerequisites REM-WP0.3, REM-WP1.2 and REM-WP1.4 have passing immutable records. The REM-WP1.5 task evidence must not claim production readiness or Phase 1 closure.
4. Commit implementation, tests, migrations, and evidence; then record the resulting full SHA in the task record in a follow-up evidence commit if needed by the repo's candidate-pinning process. Produce candidate-specific review hashes only after the final clean candidate commit exists.

## 5. REM-WP1.6 start gate

REM-WP1.6 must remain **not started** until every direct dependency in `evidence/phase1/task-dependencies.yml` has a passing completion record: REM-WP1.1, REM-WP1.2, REM-WP1.3, REM-WP1.4, REM-WP1.5, REM-WP2.2, and REM-WP5.3. REM-WP1.5 closeout alone does not satisfy REM-WP2.2 or REM-WP5.3. REM-WP1.7 is downstream inbox authorization and is not a REM-WP1.6 start dependency. The post-WP1.5 schedule is documented in [`PHASE-1-REMEDIATION-ROADMAP-FROM-WP1.6.md`](./PHASE-1-REMEDIATION-ROADMAP-FROM-WP1.6.md).

Before REM-WP1.6 starts:

- The dependency validator must report no missing or failing ancestors for REM-WP1.6.
- Each predecessor record must be schema-valid, pinned to its implementation candidate, and have passing required status fields/artifacts.
- REM-WP1.2 remains recorded as complete from its own task evidence; this plan does not reopen it or silently transfer its ownership.
- If any listed predecessor is pending/blocked, record REM-WP1.6 as not started and continue only independent work allowed by the graph.

When the gate passes, REM-WP1.6 follows its existing plan: actual API composition tests and mapped BDD prove HTTP mapping, authenticated session/tenant derivation, safe public responses, and persisted database effects. Do not infer HTTP behavior from the REM-WP1.5 database suite.

## 6. Stop conditions and acceptance

Stop the affected migration/role task and keep its gate red if the fresh database role differs from the recorded identity, the function owner/ACL is ambiguous, the finalizer cannot revoke temporary membership, a test passes only as a superuser/owner fallback, or evidence omits the exact candidate/run ID. Continue independent toolchain/type/test fixes where safe.

**REM-WP1.5 passes only when** CI-1 through CI-7 have regression proof; migration 0013 clean install, replay, upgrade, rollback and retry all pass as the actual migrator; the full DB workspace suite passes under actual provisioned roles; all 55 tables and the constrained outbox function match their policy; app/RLS/pool and append-only/outbox assertions pass; BDD-AUD-005 passes on the mapped real DB path; the CI finalizer verifies final role state; all verification pipelines preserve their real exit codes; and complete evidence is retained and pinned to the exact candidate.

**REM-WP1.5 CI acceptance passes only when** the candidate's `db-integration` workflow job, migration checks, REM-WP1.5-owned BDD-AUD-005 scenario, and always-run role finalizer pass on the same clean commit. `verify:all` browser failures and non-WP1.5 Phase 1 BDD failures are separately reported against their mapped tasks; they do not establish or negate REM-WP1.5 database evidence. Do not mark the full repository CI green while any required workflow job fails.

**Historical disposition (2026-11-15):** Candidate `d7fbf5851b11b07b65bde36f062db7b21f487947` passed the CI jobs and tests listed above. The subsequent review found that this run did not prove every approved policy expression and did not include later workflow changes. Its run and artifacts are preserved as candidate-specific evidence, not erased or relabeled. Final closeout is pending the work in [`WP1.5-FINAL-CLOSEOUT-IMPLEMENTATION-PLAN.md`](./WP1.5-FINAL-CLOSEOUT-IMPLEMENTATION-PLAN.md). The plan does not claim independent review or Phase 1 closure. REM-WP1.6 remains gated by every direct dependency in the task graph.
