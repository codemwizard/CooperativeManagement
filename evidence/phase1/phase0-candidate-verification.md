# Phase 0 verification for the WP0 working candidate

- Date: 2026-11-07
- Base commit: `c25b616fa2e0f75b14327d87747880a227cbb8b2`
- Candidate state: dirty working tree; this result covers the complete tested working tree and is not a clean-commit result.
- Runtime: Node 26.7.0, npm 12.2.0, PostgreSQL 18.0.
- Database: `symphony_phase1_test`, isolated from the development database; `DATA_MODE=test`.
- Database role: `symphony`, owner of the isolated test database. The database URL was derived from the configured development connection by changing only its database name to `symphony_phase1_test`; no URL or credentials were emitted in the run output.

## Commands and results

`npm run verify:phase0`: **passed**, exit code 0, using the already installed npm 12.2.0 CLI and Node 26.7.0. The gate completed all prescribed checks:

- Phase 0 script contract: 8 tests passed.
- Toolchain tests: 2 passed; runtime validator confirmed Node 26.7.0, npm 12.2.0 and PostgreSQL 18.
- Archive hygiene tests: 5 passed; hygiene check passed.
- Workspace/package typechecks: passed.
- Dependency architecture: passed, 115 modules / 173 dependencies checked.
- Domain unit tests: 71 passed, including the WP0.8 exact 72-hour expiry boundary.
- PostgreSQL migration integration: 9 passed across 3 files against `symphony_phase1_test`.
- BDD: 49 scenarios / 224 steps passed.
- Traceability: passed; 205 scenarios scanned and all 26 hard non-`@wip` scenarios had step definitions.
- Accessibility: 1 browser test passed with zero axe violations.
- Legacy floor: production build, reference oracle (10 cases × 3 destinations), help validation (91 entries / 23 tour steps / 8 visible texts), bundle hygiene, and repository Vitest suite passed (261 tests across 11 files, including 94 WP0 contract/tooling tests).

The command returned exit code 0. The production build emitted a non-fatal large-chunk advisory. This proves the Phase 0 gate on the recorded dirty candidate under the active pinned toolchain; it does not claim Phase 1 product-path behavior. WP0.13 still requires a clean exact-commit rerun and independent review before closure. The previous dirty-tree pass under npm 11.19.0 is preserved separately at `evidence/phase1/phase0-candidate-verification-npm11.19.0.md`. Historical CI Phase 0 evidence remains separately identified at commit `c70d3f439907e5ff37aee3953704e29d899e0032`, GitHub Actions run `42201289720`.
