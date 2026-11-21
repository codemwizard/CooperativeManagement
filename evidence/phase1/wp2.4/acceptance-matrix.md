# REM-WP2.4 Acceptance Matrix

| Criterion | Evidence | Verification |
|---|---|---|
| Protected-command-first for capacity grant and revoke | `packages/db/src/__tests__/postgres-capacity-delegation-command.integration.test.ts`; raw output `local/2026-11-21/postgres-capacity-ta-serialization.log` | A held `FOR SHARE` blocks the actual app-role mutation; source mutation commits only after release. |
| Protected-command-first for direct TA-scope grant and revoke | Same test file and raw output | Same barrier; target, tenant, manager/delegatee, and referenced union lock inputs are resolved from persisted command context. |
| Mutation-first for capacity grant/revoke | Same test file and raw output | Each command commits source plus changed versions; a later protected transaction observes source state and versions. |
| Mutation-first for direct TA-scope grant/revoke | Same test file and raw output | Same source/version checks. |
| Exact D-16 version deltas | Same test file and raw output | Organization, tenant, and changed delegatee actor/tenant rows increment once; grantor and referenced union rows do not increment when their authority facts are unchanged. |
| Immutable grant history through revoke | Same test file and raw output | The original grant event ID, type, payload, and sequence are unchanged; revoke appends the second event. |
| Expiry does not itself mutate authority versions | Same test file and raw output | An elapsed persisted capacity grant is inactive at PostgreSQL transaction time; source remains unrevised and versions remain constant. |
| Two protected readers and canonical lock infrastructure | `packages/db/src/__tests__/postgres-authority-scope-locks.integration.test.ts`; raw output `local/2026-11-21/postgres-authority-scope-infrastructure.log` | REM-WP2.6 acceptance rerun: concurrent `FOR SHARE` readers both hold; writer waits until both release. |
| D-16 scope, cross-tenant, frozen source, version guard, rollback requirements | REM-WP2.6 predecessor evidence at `1b195317eaa342c91efabb2f987bb6b87daaec6c`, plus the rerun above | Actual app role; exact predecessor and artifact hashes are checked by the WP2.4 closure verifier. |
| No TA cohort/descendant cascade and no Phase 1 person/shared-identity lock | `authority-dependency-inventory.json` v3; D-19; contract tests | Validator and tests require one cooperative per TA command and keep person/shared-identity outside Phase 1 scope rows. |
| Complete DB workspace regression | Raw output `local/2026-11-21/postgres-full-db-suite-with-env.log` | All PostgreSQL workspace tests pass with the three configured isolated roles loaded from `.env.local`. |

The direct-TA model has no parent or descendant rows to revoke. Generic multi-scope order, deduplication, cross-tenant rejection, and dual-reader serialization remain WP2.6-owned infrastructure evidence; WP2.4 does not claim a cohort chain that D-19 did not approve.
