# WP1.5 local verification — 2026-11-12

> Historical local snapshot. WP1.5 was later closed by candidate-pinned CI run `43683206104` at `d7fbf5851b11b07b65bde36f062db7b21f487947`; see `task-evidence.json` and the `ci/d7fbf.../` evidence directory for the current disposition.

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
