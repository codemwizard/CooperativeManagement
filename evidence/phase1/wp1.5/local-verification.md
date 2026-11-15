# WP1.5 local verification — 2026-11-12

> Historical local snapshot. Candidate-pinned CI run `43683206104` passed for `d7fbf5851b11b07b65bde36f062db7b21f487947`; follow-up review found additional policy-oracle and same-candidate verification requirements, so final closeout is reopened. The CI record remains valid only for that SHA.

This is partial implementation evidence, not a WP1.5 closure record. No connection string or password is stored here.

## Passed

- `npm run db:migrate:test` applied `0013_tenant_rls_app_role.sql` to `symphony_phase1_test` as `symphony`; PostgreSQL reported server version `180000`.
- A second `npm run db:migrate:test` skipped migrations 0001–0013 as already applied.
- `npm run test:migrations --workspace @symphony/db` passed all 13 tests, including migration transaction rollback/retry behavior and the existing upgrade migration checks.
- `npm run typecheck:v4` passed.
- `npm run verify:phase1:contracts` passed all 106 tests and the structural validator.
- The live `symphony_app` privilege audit compared every matrix operation across the 55 tables. It found the missing `enrolment_sessions` SELECT/INSERT/UPDATE grants; migration 0013 was corrected and the grant applied to the already-migrated local database. The repeat audit found no mismatches.
- Live catalog checks confirmed schema USAGE without CREATE; no explicit app/PUBLIC column ACLs, sequence privileges, or PUBLIC function EXECUTE; only the outbox enqueue function is executable by `symphony_app`; global catalogue reads work; control-plane tenant reads are denied.
- Direct PostgreSQL checks passed unset and empty context against all 37 tenant-scoped tables (74 table/context cases), cross-tenant parent insert denial, same-connection A→B→A isolation with post-commit context reset, and invocation of the outbox capability function inside a transaction that was rolled back.

## Still required for closure

- Run `tenant-rls-app-role.integration.test.ts` and the complete DB integration suite with the separate administrator, migration, and `symphony_app` URLs. The local environment has no usable administrator URL; `symphony` is not a superuser and cannot revoke the temporary membership granted by `postgres`.
- Run the configured clean-install CI role-bootstrap/integration job and retain its result. Its finalizer must revoke `symphony_outbox_writer` membership from the migration role and verify the final role state.
- Retain a full migration-0013-specific failure-atomicity/upgrade result and complete all append-only/outbox worker assertions under the intended test roles.

`WP1.5` remains open until those checks pass; the live migration and focused checks do not substitute for the restricted-role integration gate.

## Current local closeout execution — 2026-11-15

This section records the implementation work after the historical d7fb candidate. It is local evidence for the current worktree and does not claim that a current candidate SHA has passed CI.

### Results

- `node node_modules/vitest/vitest.mjs run tests/tooling/phase1_contracts.test.ts`: **110 passed**. This includes the regression contract requiring the WP1.2 security-audit integration to connect through the restricted `symphony_app` identity.
- `node tools/phase1-contracts.js`: **passed**; the 45-node task graph is known and acyclic, mandatory command and BDD IDs resolve, and the 55-table inventory validates.
- `node tools/run_python_tool.js -m unittest tests/tooling/test_archive_hygiene.py -v`: **8 passed**; `tools/verify_archive_hygiene.py`: **passed**.
- Full database suite on PostgreSQL 18 with isolated test admin and the migration integration URL supplied for the actual `symphony_migrator` role: **62 passed across 12 files**. The first attempt correctly exposed two local URL/role-setup errors; after supplying the required identity, the final run passed. Temporary migrator membership and password were restored after the run. No credentials or connection strings were emitted or retained.
- The security-attempt persistence integration now uses `PHASE1_TEST_APP_DATABASE_URL` and proves `current_user = symphony_app` before exercising the write: **5 passed**.
- WP1.5 BDD-AUD-005 with the feature's required `NODE_ENV=test`, `DATA_MODE=test`, and `SYNTHETIC_ONLY=true`: **1 scenario, 7 steps passed**.
- Post-run role audit confirmed PostgreSQL 18.0 / `server_version_num=180000`, admin role `postgres`, no `symphony_migrator` outbox-writer membership, and `symphony_app` remains non-superuser/non-inheriting. Sanitized values are retained in `local/2026-11-15/final-db-role-state.json`.
- Typecheck across project-reference build and all six workspaces: **passed**. Architecture check: **passed**, 134 modules and 266 dependencies.
- WP1.3 domain unit regression suite: **92 passed across 13 files**. Its PostgreSQL concurrency, WP1.2 transaction/audit regression, and later DB behavior also passed in the full 62-test database run.
- Source-review ZIP for commit `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`: **1,081 members**, independent verifier passed, and all three tracked nested ZIP files were excluded. The archive SHA-256, complete member-name listing, and build log are retained under `local/2026-11-15/source-review-fb3d4f2.*`.
- WP1.3 evidence now pins to the tested full source SHA `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`; schema validation returned no errors. It does not claim hosted CI or independent review.
- The closeout checksum manifest verified all **29** listed logs, reports, archive/member artifacts, role metadata, and WP1.3 evidence hashes.

### Raw logs

- Phase 1 contract tests: `local/2026-11-15/final-phase1-contract-tests.raw.log`
- Structural and dependency validation: `local/2026-11-15/final-phase1-structural-validator.raw.log`
- Archive tests and archive verifier: `local/2026-11-15/final-archive-hygiene.raw.log`
- Full PostgreSQL suite: `local/2026-11-15/final-db-suite-bootstrapped.raw.log`
- Restricted app-role audit test: `local/2026-11-15/security-audit-app-role.raw.log`
- WP1.5 BDD-AUD-005: `local/2026-11-15/final-bdd-wp1.5.raw.log`
- Workspace typecheck: `local/2026-11-15/final-typecheck-v4.raw.log`
- Architecture dependency check: `local/2026-11-15/final-verify-arch.raw.log`
- Domain unit suite: `local/2026-11-15/final-domain-unit.raw.log`
- Source-review archive build and independent verification: `local/2026-11-15/source-review-archive-builder.raw.log`; member listing, report and ZIP: `local/2026-11-15/source-review-fb3d4f2.members.txt`, `.report.json` and `.zip`.
- The failing first security-audit-role contract run is retained as `local/2026-11-15/security-audit-role-contract.red.raw.log` as the TDD red result.
- The nested opaque-archive regression test first failed because a tracked `.zip` was copied into the source review ZIP. The builder now excludes opaque archive containers; the red result is `local/2026-11-15/archive-nested-container.red.raw.log` and the green run is in `local/2026-11-15/final-archive-hygiene.raw.log`.
- The independent-verifier contract first failed because the builder did not invoke `verify_archive_hygiene.py`; the builder now runs that standalone verifier and deletes output on failure. Red result: `local/2026-11-15/archive-independent-verifier.red.raw.log`.

### Still required

- Run the approved Phase 0 gate and final candidate checks on the exact commit containing this evidence/index reconciliation, retain all resulting candidate artifacts, and obtain the same-SHA CI artifact bundle from the project owner. WP1.3 remains pinned to tested source commit `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`.
- Reconcile WP1.5 task/dependency/review-index state only after the final candidate CI jobs and evidence checksums pass. The d7fb record remains unchanged and historical.
