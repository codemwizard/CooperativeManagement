# REM-WP2.6 Authority scope serialization infrastructure

**Status:** REM-WP2.6 gate verified against implementation candidate `1b195317eaa342c91efabb2f987bb6b87daaec6c`. The exact-candidate preflight and final verifier passed; see `task-evidence.json` and the retained verifier logs. Migrations `0019_authority_scope_versions.sql` and `0020_authority_scope_frozen_lock_policy.sql` provide the D-16 version table, constraints, update trigger, RLS policies, least-privilege table grants, bootstrap rows and frozen-scope lock visibility. The typed resolver, canonical lock helper, transaction-local actor context, frozen-source grants and fail-closed readiness check are implemented.
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

At the time WP2.6 was implemented, WP2.3 command work was gated on the immutable WP2.6 candidate and task evidence. That prerequisite is now satisfied, and REM-WP2.3 has registered and verified the supported capacity/delegation writers. Current WP2.3 status and candidate-bound evidence are in `../wp2.3/task-evidence.json`; do not use the historical entry conditions below as the current execution status.

## Local verification references

Raw logs are retained under `local/2026-11-20/`:

- `migration-apply.raw.log`: migration runner showed migrations 0019 and 0020 applied in the isolated PostgreSQL 18 database.
- `migration-suite.raw.log`: isolated PostgreSQL 18 clean-install, replay, upgrade and failure/retry migration suite.
- `postgres-db-suite.raw.log`: full DB workspace suite, including actual `symphony_app` RLS/privilege and WP2.6 serialization checks.
- `phase1-contract-verification.raw.log`: Phase 1 contracts, feature parity and structural gate checks.
- `typecheck-v4.raw.log`: full V4 workspace TypeScript project-reference check.
- `preflight.raw.log` and `closure-verification.raw.log`: exact-candidate gate preflight and final verification outputs.

`working-tree-verification.json` records the implementation source base, candidate SHA, environment and SHA-256 checksums for each raw log. The application and migration source snapshot tested before commit is the snapshot committed at the candidate SHA.

No capacity/delegation command implementation or mutation behavior belongs here. REM-WP2.3 consumes this infrastructure. REM-WP2.4 owns the race and immutable-history proof after both implementation candidates exist.

## Remaining boundary

WP2.6 closes D-16 infrastructure and frozen-source enforcement. REM-WP2.3 now registers the supported capacity/delegation writers and consumes this lock service. REM-WP2.4 owns the race-order and immutable-history proof; its evidence and current gate state are recorded in `../wp2.4/task-evidence.json`.
