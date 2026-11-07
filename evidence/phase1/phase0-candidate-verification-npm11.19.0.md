# Phase 0 verification for the WP0 working candidate

- Date: 2026-11-07
- Base commit: `c25b616fa2e0f75b14327d87747880a227cbb8b2`
- Candidate state: dirty working tree; this result is for the complete tested working tree after the WP0.1–WP0.11 contract/test additions, not the base commit alone.
- Runtime: Node 26.7.0, npm 11.19.0, PostgreSQL 18.0.
- Database: `symphony_phase1_test`, isolated from the existing `symphony` database; `DATA_MODE=test`.
- Database role: `symphony`, owner of the isolated test database. A transaction-only privilege probe verified `CREATE SCHEMA`, `CREATE TABLE`, `ALTER TABLE`, `INSERT`, `UPDATE`, and `DELETE`; it was rolled back. The subsequent migration integration tests created and tested the intended migration schema in the dedicated test database.

## Commands and results

`npm run test:db:migrations`: **passed**, 3 files / 9 tests. PostgreSQL integration cases covered concurrent clean installation, migration replay, failed-migration rollback and retry, schema invariants, and global seeds.

`npm run verify:phase0`: **passed**, exit code 0 on the working tree. The full sequence completed:

- Phase 0 script contract: 8 tests passed.
- Toolchain tests: 2 passed; runtime validation confirmed Node 26.7.0, npm 11.19.0 and PostgreSQL 18.
- Archive hygiene tests: 5 passed; hygiene check passed.
- Workspace/package typechecks: passed.
- Dependency architecture: passed, 115 modules / 173 dependencies checked.
- Domain unit tests: 71 passed, including the WP0.8 exact 72-hour expiry boundary.
- PostgreSQL migration integration: 9 passed across 3 files.
- BDD: 49 scenarios / 224 steps passed.
- Traceability: passed; 205 scenarios scanned and all 26 hard non-`@wip` scenarios had step definitions.
- Accessibility: 1 browser test passed with zero axe violations.
- Legacy floor: production build, reference oracle (10 cases × 3 destinations), help validation (91 entries / 23 tour steps / 8 visible texts), bundle hygiene, and repository Vitest suite passed (261 tests across 11 files, including 94 WP0 contract/tooling tests).

The command returned exit code 0. PowerShell's `npm.ps1` wrapper emitted a non-fatal access-denied diagnostic while probing a roaming npm CLI path; the configured npm 11.19.0 scripts ran and every prescribed check completed. This proves the Phase 0 gate on the recorded dirty candidate only. It does not claim Phase 1 product-path behavior. Before WP0.13 closure, rerun the gate on the exact clean candidate commit. Historical CI Phase 0 evidence remains separately identified at commit `c70d3f439907e5ff37aee3953704e29d899e0032`, GitHub Actions run `42201289720`.
