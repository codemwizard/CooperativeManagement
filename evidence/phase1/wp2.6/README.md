# REM-WP2.6 Authority scope serialization infrastructure

**Status:** Implementation and local PostgreSQL verification are complete; exact-candidate gate status is recorded in `task-evidence.json` only after `npm run verify:wp2.6` passes. Migrations `0019_authority_scope_versions.sql` and `0020_authority_scope_frozen_lock_policy.sql` provide the D-16 version table, constraints, update trigger, RLS policies, least-privilege table grants, bootstrap rows and frozen-scope lock visibility. The typed resolver, canonical lock helper, transaction-local actor context, frozen-source grants and fail-closed readiness check are implemented.
**Entry:** REM-WP0.4, REM-WP2.1 and REM-WP2.2 candidate-bound evidence must pass.
**Normative design:** `../wp2.4/authority-scope-serialization-spec.md` and D-16.

## Bounded scope

Implement the D-16 infrastructure required before REM-WP2.3 mutations:

- PostgreSQL `authority_scope_versions` migration, constraints, version trigger and ordered bootstrap;
- actual `symphony_app` RLS/privilege boundary and frozen-source DML denial;
- typed scope tuple construction from persisted trusted facts;
- canonical scope provisioning and lock acquisition, with `FOR SHARE` for protected reads and `FOR UPDATE` for authority mutations;
- startup/registration validation that rejects missing scope rows and writers for frozen authority sources;
- atomic scope-version increments and rollback behavior at the transaction boundary.

Do not start REM-WP2.3 command implementation until the WP2.6 candidate SHA and task evidence are established. The repository currently has no centralized authority command registry; WP2.3 must create and validate the exact supported writer registrations before enabling capacity/delegation source DML. Until then, migrations deny app-role DML on all authority source tables, including the future supported writer tables.

## Local verification references

Raw logs for the current uncommitted working tree are retained under `local/2026-11-20/`:

- `migration-suite.raw.log`: isolated PostgreSQL 18 clean-install, replay, upgrade and failure/retry migration suite.
- `postgres-db-suite.raw.log`: full DB workspace suite, including actual `symphony_app` RLS/privilege and WP2.6 serialization checks.
- `phase1-contract-verification.raw.log`: Phase 1 contracts, feature parity and structural gate checks.
- `typecheck-v4.raw.log`: full V4 workspace TypeScript project-reference check.

These are implementation verification artifacts, not candidate-bound task evidence. Their exact source state is the uncommitted working tree based on the branch HEAD recorded in `working-tree-verification.json`.

No capacity/delegation command implementation or mutation behavior belongs here. REM-WP2.3 consumes this infrastructure. REM-WP2.4 owns the race and immutable-history proof after both implementation candidates exist.

## Acceptance evidence

Use PostgreSQL 18 and the actual restricted application role for runtime operations. Retain DDL/migration output, bootstrap completeness, actual-role privilege probes, lock ordering and scope-version assertions, frozen-writer negative cases, rollback evidence, environment/toolchain and exact implementation SHA. Do not create a task-evidence record until implementation and required gates actually pass.
