# Phase 0 Command Map

This map describes the commands used to build and verify the Phase 0 foundation. The exact successful CI execution is commit `c70d3f439907e5ff37aee3953704e29d899e0032`, run [42201289720](https://github.com/codemwizard/CooperativeManagement/actions/runs/42201289720).

| Command | Implementation | Scope and prerequisites | Passing evidence |
|---|---|---|---|
| `npm run db:start` | `docker compose up --wait db -d` | Starts the local development PostgreSQL service; requires Docker Compose. | Compose readiness succeeds. CI runs this and `db:stop` before the gate. |
| `npm run db:stop` | `docker compose stop db` | Stops the local development PostgreSQL service. | Compose exits successfully. |
| `npm run db:test:start` / `npm run db:test:stop` | `docker compose up --wait db-test -d` / `docker compose stop db-test` | Starts/stops the isolated PostgreSQL 18 test service used by the Phase 0 CI job. | CI service reports PostgreSQL 18.6; sanitized Phase 0 evidence records the server version. |
| `npm run db:migrate` | `node --env-file-if-exists=.env.local --import tsx packages/db/src/migrate.ts` | Applies ordered SQL migrations to the configured development database. | Migration runner completes and records applied files. |
| `npm run db:migrate:test` | `node --import tsx packages/db/src/migrate.ts` | Applies migrations to the URL supplied in the test environment. | CI integration job migration step. |
| `npm run test:db:migrations` | `tools/require_migration_test_db.mjs` then `@symphony/db` migration tests | Requires `MIGRATION_TEST_DATABASE_URL`; tests clean install, replay, concurrent runners, failure/retry and schema invariants on PostgreSQL. | Phase 0 CI: 3 files, 9 tests passed. |
| `npm run test:db --workspace @symphony/db` | DB workspace Vitest suite | Runs repository and event-store PostgreSQL integration tests. Uses `DATABASE_URL` or the documented local default. | Local rerun after transactional cleanup fix: 5 files passed, 16 tests passed, 3 skipped. |
| `npm run typecheck:v4` | Forced TypeScript project build followed by explicit workspace typechecks | Checks domain, contracts, DB, testkit, API and workspace. | All six typechecks pass in the exact Phase 0 CI run. |
| `npm run test:unit` | `packages/domain` Vitest suite | Domain unit tests. | Phase 0 CI: 10 files, 70 tests passed. |
| `npm run test:phase0-contract` | `tests/tooling/phase0_scripts.test.ts` | Checks mandatory command targets, gate failure propagation, database wiring, and portable test paths. | Phase 0 CI: 8 tests passed. |
| `npm run test:bdd` | Cucumber with `cucumber.cjs` | Runs enabled non-`@wip` BDD scenarios. | Phase 0 CI: 49 scenarios / 224 steps passed. This does not claim Phase 1 feature coverage. |
| `npm run verify:trace` | `tools/verify-trace.ts` | Verifies requirement tags and hard-scenario step mappings. | Phase 0 CI: 205 scenarios found; all 26 enabled hard scenarios mapped. |
| `npm run verify:arch` | Dependency Cruiser with `.dependency-cruiser.cjs` | Checks package boundaries. | Phase 0 CI: no violations across 115 modules / 173 dependencies. |
| `npm run verify:archive-hygiene` | `tools/verify_archive_hygiene.py` and its unit tests | Checks Git-tracked paths and placeholder-only `.env.example`; accepts `--archive` to inspect a ZIP when a supported ZIP distribution exists. | Phase 0 CI: 5 tests passed; no tracked prohibited paths; template passes. No repository-local source ZIP/export generator is supported. |
| `npm run test:a11y` | Playwright wrapper on `tests/workspace/a11y.spec.ts` | Tests the Phase 0 `/components` scaffold. | Phase 0 CI: 1 test passed. |
| `npm run verify:legacy-floor` | Build, reference oracle, help validation, bundle hygiene and root Vitest | Preserves the existing non-browser regression floor. | Phase 0 CI: oracle, help and bundle checks passed; 10 files / 167 tests passed. |
| `npm run verify:phase0` | Ordered aggregate in root `package.json` | Mandatory Phase 0 foundation gate; runs contract, toolchain, archive, typecheck, architecture, domain, migration, BDD, trace, accessibility and legacy-floor checks. | Exact CI artifact reports `PASS`; sanitized log contains the complete successful run. |
| `npm run verify:all` | `verify:legacy-floor` then `test:e2e` | Full legacy browser E2E suite; includes Phase 1 login acceptance. Requires Playwright browser and app server. | Not a Phase 0 gate. The previously observed `/login` connection failures are carried in Phase 1 WP-1.9. |

## Distribution paths checked

- GitHub source archives are formed from tracked repository content; the hygiene gate rejects tracked `.env`, non-example `.env.*`, and private-key paths.
- The Phase 0 CI artifact contains only the sanitized gate log and machine-readable evidence, not an application/source bundle.
- No repository-local ZIP/export or release-package generator was found. If one is introduced, it must pass `verify_archive_hygiene.py --archive <zip>` before distribution.
