# WP1.5 CI remediation implementation verification

> Historical local-only snapshot. Its then-open closure checklist is superseded by the passing candidate-pinned CI closeout in run `43683206104` on `d7fbf5851b11b07b65bde36f062db7b21f487947`; see `evidence/phase1/wp1.5/task-evidence.json` and `evidence/phase1/wp1.5/ci/d7fbf5851b11b07b65bde36f062db7b21f487947/`.

## Candidate and evidence limits

- Inspected base commit: `dd21c22b6301bd74534d5d09dacb6e04daf9ddc7`.
- These local checks were collected while the implementation was an uncommitted worktree based on the listed commit. This report records local results only; it does not claim a GitHub run or candidate-bound CI pass.
- Runtime reported during the implementation run: Node `26.7.0`, npm `12.2.0`, PostgreSQL `18.0` (Windows x64; package build `18.0-2`). The initial transient cluster had a WIN1252 template and was discarded; final closeout tests ran in a disposable cluster initialized with UTF8 and PostgreSQL `server_version_num=180000`. Credentials and connection strings are intentionally excluded.
- Raw outputs are retained in this directory. The hashes below bind these exact local files, not to a CI run or commit.

## Implemented changes

1. Reworked migration 0013 function creation and ACL sequencing. The append-only mutation function is created by the migration owner; the enqueue function is created while `symphony_outbox_writer` is active, with its constrained execute grants and fixed search path.
2. Made migration catalog tests compare object identities rather than PostgreSQL's search-path-dependent display strings. Added a full 0012-to-0013 injected-failure/rollback/retry integration case.
3. Made the reconciliation integration test derive and validate the configured `_test` database name instead of assuming `symphony_phase1_test`.
4. Added the missing TypeScript declaration for `validateTenantPolicyManifest`.
5. Separated Phase 0 BDD selection (`@phase0 and not @wip`) from the frozen Phase 1 BDD runner. Updated CI to report the installed Node/npm versions without installing a different npm globally, and to upload raw gate and DB evidence artifacts keyed to the workflow SHA.
6. Added script/toolchain contract tests for the CI behavior and Phase 0 BDD boundary.
7. Replaced BDD-AUD-005's in-memory-only path with a required PostgreSQL `symphony_app` path, explicit tenant filter plus RLS probe, unchanged foreign evidence snapshot, persisted security-attempt audit assertion, and fixture cleanup hook. Updated the public expected response to the product's generic `UNAUTHORIZED` contract while requiring internal audit code `TENANT_MISMATCH`.

## Executed checks and results

| Check | Result | Evidence |
|---|---|---|
| Clean migration install through 0013 as the provisioned migrator | Passed | [`clean-install-candidate.raw.log`](./clean-install-candidate.raw.log) |
| Full DB workspace suite after SQL ownership and configured DB-name fixes | Passed, 57/57 tests | [`db-workspace-candidate.raw.log`](./db-workspace-candidate.raw.log) |
| Earlier migration suite before adding the new 0013 atomicity case | Passed, 13/13 tests | [`migration-suite-attempt-2.raw.log`](./migration-suite-attempt-2.raw.log) |
| Migration suite including the new 0012→0013 atomicity case | Not verified: PostgreSQL failed with SQLSTATE `53100` (`No space left on device`) while creating the isolated database; 6 passed and 8 were skipped in that attempt | [`migration-suite-candidate.raw.log`](./migration-suite-candidate.raw.log) |
| Phase 0 BDD scope | Passed as configured, but selected zero `@phase0` scenarios; this is not behavioral Phase 0 coverage | [`phase0-bdd-scope.raw.log`](./phase0-bdd-scope.raw.log) |
| Phase 1 BDD | Failed, 35/39 scenarios passed; four mapped scenarios failed | [`phase1-bdd.raw.log`](./phase1-bdd.raw.log) |
| `verify:all` | Root/build/oracle/help/bundle and 273 tests passed; browser E2E had 6/36 failures | [`verify-all.raw.log`](./verify-all.raw.log) |
| Phase 0 script contracts | Passed, 9/9 tests | Local command output; no retained raw log |
| Toolchain contract tests | Passed, 3/3 tests | Local command output; no retained raw log |
| Toolchain verification | Passed: Node 26.7.0, npm 12.2.0, PostgreSQL package/server contract | Local command output; no retained raw log |
| Workspace typecheck (`typecheck:v4`) | Passed | Local command output; no retained raw log |
| Phase 1 structural contracts | Passed, 106 tests; 45-node dependency graph and gate manifest validated | Local command output; no retained raw log |
| Architecture gate | Passed, 132 modules / 260 dependencies | Local command output; no retained raw log |
| Traceability gate | Passed, 205 scenarios found and 26 hard non-WIP scenarios mapped | Local command output; no retained raw log |
| `git diff --check` | Passed after SQL EOF cleanup | Local command output |

The initial broad Phase 1 BDD run is retained as historical evidence. It reported four failures before the WP1.5-owned BDD implementation and expected-response correction:

- BDD-AUD-001: WP1.2-owned state/event/outbox failure scenario.
- BDD-AUD-002 and BDD-AUD-003: WP1.3/WP1.6 idempotency behavior.
- BDD-AUD-005: WP1.5-owned cross-organisation scenario. Its prior in-memory implementation and stale expected code were replaced. The exact tagged scenario now passes separately through PostgreSQL `symphony_app`, explicit tenant filtering plus RLS, persisted audit verification, unchanged evidence assertion and fixture cleanup. The other three historical failures remain mapped to WP1.2 and WP1.3/WP1.6 and are not WP1.5 failures.

The six browser E2E failures are separate: two component-page load timeouts (Phase 2), three workspace login connection refusals on port 5174, and one login API timeout (Phase 1 authentication). They do not alter the individual WP1.5 DB results.

## Local raw-output SHA-256 manifest

The complete filename-to-SHA-256 list for every retained raw log is in [`raw-log-sha256.txt`](./raw-log-sha256.txt). These hashes identify local output files; they do not assert a CI run or commit identity.

## Final disposable UTF8 PostgreSQL rerun

The following checks were rerun after the BDD and migration changes, using freshly bootstrapped migration/app/outbox roles on the same disposable PostgreSQL 18 UTF8 cluster. Generated role credentials were kept only in process environment and a temporary environment file, which was deleted after finalization.

| Check | Result | Raw output |
|---|---|---|
| Clean migration install as `symphony_migrator` | Passed: migrations 0001–0013 applied in order | [`db-migrate-utf8-closeout.raw.log`](./db-migrate-utf8-closeout.raw.log) |
| Migration replay as `symphony_migrator` | Passed: 13 migrations were no-ops | [`db-replay-utf8-closeout.raw.log`](./db-replay-utf8-closeout.raw.log) |
| Migration suite, including migration 0013 upgrade/rollback/retry | Passed, 14/14 tests | [`migration-suite-utf8-closeout.raw.log`](./migration-suite-utf8-closeout.raw.log) |
| Full PostgreSQL DB workspace suite under provisioned roles | Passed, 11 files / 58 tests | [`db-workspace-utf8-closeout.raw.log`](./db-workspace-utf8-closeout.raw.log) |
| WP1.5 BDD-AUD-005 using `symphony_app` | Passed, 1 scenario / 7 steps, including the explicit tenant join/filter and RLS probe | [`bdd-wp1.5-utf8-final.raw.log`](./bdd-wp1.5-utf8-final.raw.log) |
| CI role finalizer | Passed: temporary migration membership revoked; app/writer attributes and membership state verified | [`role-finalizer-utf8-closeout.raw.log`](./role-finalizer-utf8-closeout.raw.log) |
| BDD cleanup probe | Passed: zero `BDD-AUD-005` tenant fixtures and zero audit records remained | command output following the focused rerun |

The final BDD additionally checks the explicit organization-to-tenant predicate together with RLS and asserts that the foreign evidence row and version count are unchanged. The command returns the generic `UNAUTHORIZED` response; the persisted internal denial remains `TENANT_MISMATCH`. Rationale and trace links are in [`BDD-AUD-005-contract-and-path.md`](./BDD-AUD-005-contract-and-path.md).

## Remaining WP1.5 closure work

1. Run the exact committed candidate through GitHub CI. Verify the `db-integration` job includes the focused WP1.5 BDD step, uploads all raw logs under the exact candidate SHA, and reports successful finalizer completion.
2. Reconcile `evidence/phase1/wp1.5/task-evidence.json` and dependency status to that same candidate/run after CI passes; do not copy the local pass into a CI result or claim CI green before the provider run is observed.
3. Do not rerun WP1.2 as a standalone task just because its regression tests run in the broad DB suite. Do not start WP1.6 until WP1.5, WP2.2, and WP5.3 have passing dependency records.

## Repository hygiene note

`test-results/.last-run.json` was generated by the local Playwright run and is not implementation evidence. It was restored to the checked-in version. The migration SQL file's trailing blank line was removed. No WP1.5 completion status or GitHub CI result is fabricated.
