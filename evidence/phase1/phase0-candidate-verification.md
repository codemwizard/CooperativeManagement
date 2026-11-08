# Phase 0 verification for the WP0 clean candidate commit

- Date: 2026-11-07
- Verified commit: `f1fa5f9413747c0ac3cbd73413179101d33f653e` (`main`, origin/main)
- Candidate state: clean working tree (`nothing to commit, working tree clean`).
- Runtime: Node 26.7.0, npm 12.2.0, PostgreSQL 18.0.
- Database: `symphony_phase1_test`, isolated from the development database; `DATA_MODE=test`.
- Database role: `symphony`, owner of the isolated test database. Derived from configured development connection by changing database name to `symphony_phase1_test`; no URL or credentials emitted in run output.
- Independent Reviewer: Gemini 3.8 Flash (High), session `1fcbac00-0538-45bf-9355-7d7403ea4820`.

## Commands and results

`npm run verify:phase0`: **passed**, exit code 0, using the active npm 12.2.0 CLI and Node 26.7.0 against `symphony_phase1_test`. The gate completed all 12 prescribed checks:

- Phase 0 script contract: 8 tests passed (`tests/tooling/phase0_scripts.test.ts`).
- Toolchain tests: 2 passed (`tests/tooling/verify_toolchain.test.mjs`); runtime validator confirmed Node 26.7.0, npm 12.2.0 and PostgreSQL 18.
- Archive hygiene tests: 5 passed (`tests/tooling/test_archive_hygiene.py`); hygiene check passed; no private keys or prohibited environment paths in Git index.
- Workspace/package typechecks: passed (`@symphony/domain`, `@symphony/contracts`, `@symphony/db`, `@symphony/testkit`, `@symphony/api`, `@symphony/workspace`).
- Dependency architecture: passed, 115 modules / 173 dependencies checked against `.dependency-cruiser.cjs`.
- Domain unit tests: 71 passed across 10 files in `packages/domain`, including the WP0.8 exact 72-hour expiry boundary.
- PostgreSQL migration integration: 9 passed across 3 files against `symphony_phase1_test` (serialization, rollback without ledger corruption, retry safety, global seeds).
- BDD: 49 scenarios / 224 steps passed.
- Traceability: passed; 205 scenarios scanned and all 26 hard non-`@wip` scenarios had step definitions.
- Accessibility: 1 browser test passed with zero axe violations on `/components`.
- Legacy floor: production build, reference oracle (10 cases × 3 destinations), help validation (91 entries / 23 tour steps / 8 visible texts), bundle hygiene, and repository Vitest suite passed (261 tests across 11 files, including 94 WP0 contract/tooling tests).

The command returned exit code 0 on the clean working tree. The production build emitted a non-fatal large-chunk advisory. This independently validates the Phase 0 baseline gate on the clean candidate commit `f1fa5f9413747c0ac3cbd73413179101d33f653e` under the active pinned toolchain. WP0 closure is approved by the project owner. Historical dirty-tree evidence and the prior pass under npm 11.19.0 are retained separately; historical CI Phase 0 evidence remains separately identified at commit `c70d3f439907e5ff37aee3953704e29d899e0032`, GitHub Actions run `42201289720`.
