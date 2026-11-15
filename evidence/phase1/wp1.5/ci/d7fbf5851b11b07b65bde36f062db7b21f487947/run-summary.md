# WP1.5 CI closeout evidence

**Disposition:** WP1.5 acceptance passed.
**Candidate:** `d7fbf5851b11b07b65bde36f062db7b21f487947`
**GitHub Actions run:** `43683206104`, attempt `1`
**Runtime:** Node `26.7.0`; npm `12.2.0`; PostgreSQL `18.0` (`server_version_num=180000`)
**Original artifacts:** `CI-Results/WP1.5/wp1.5-run2/`, copied unchanged into this candidate-scoped directory. See `SHA256SUMS.txt` for checksums.

## Gate results

| Gate | Result | Evidence |
|---|---:|---|
| `npm run verify:phase0` | PASS | `phase0/phase0-gate.raw.log`; metadata in `phase0/phase0-ci-evidence.json` |
| CI-1 / CI-2 migration catalog assertions | PASS | Migration suite, `phase0/phase0-gate.raw.log`; 14/14 migration tests |
| CI-3 migration 0013 owner/bootstrap/failure recovery | PASS | `database/db-migrate.raw.log`; migration integration suite in Phase 0 gate log |
| CI-4 declaration/build regression | PASS | `legacy/verify-all.raw.log`; build, typecheck, 277/277 tests, 35/35 browser tests |
| CI-5 configured database identity regression | PASS | `database/db-integration.raw.log`; full 58/58 package suite including reconciliation integration |
| CI-6 Node/npm pin and npm CLI resolution | PASS | `phase0/phase0-gate.raw.log`; toolchain tests and explicit Node/npm/PostgreSQL verification |
| CI-7 tee/pipefail preservation | PASS | `phase0/phase0-gate.raw.log`; Phase 0 script contracts include the failing-command exit propagation test |
| Role bootstrap and clean migration install | PASS | `database/role-bootstrap.raw.log`, `database/db-migrate.raw.log`; migrations 0001–0013 applied |
| Actual-role DB integration | PASS | `database/db-integration.raw.log`; 11 files, 58 tests, including restricted-role/RLS and outbox checks |
| WP1.5 BDD-AUD-005 | PASS | `database/bdd-wp1.5.raw.log`; 1 scenario, 7 steps |
| Role finalization | PASS | `database/role-finalizer.raw.log`; temporary migrator membership revoked and final roles verified |
| Legacy verification | PASS | `legacy/verify-all.raw.log`; 35 browser E2E tests passed |

The Phase 0 BDD filter discovered zero `@phase0` scenarios. This is not WP1.5 BDD evidence; the separately tagged WP1.5 scenario ran and passed against PostgreSQL. The legacy browser result is supplementary workflow evidence, not a substitute for the database or BDD gates.

## Dependency reconciliation

WP1.5 prerequisites are WP0.3, WP1.2 and WP1.4. Their records report passing status. WP1.4's evidence record was corrected to schema-valid status values and pinned to its implementation commit `2df9151dd5b04d2b17245cd16bceb79db38a0183`; the CI run also reran its reconciliation integration as part of the complete database suite. WP1.2 remains pinned to `29317ff15dbb8010aa8768bb9ae451b54476875d`; WP0.3 remains passed in `evidence/phase1/tasks.json`.

WP1.5 is closed by its task record at `evidence/phase1/wp1.5/task-evidence.json`. WP1.6 is not thereby authorized: its other graph dependencies remain independently required. Independent review is tracked as a separate review gate and is not represented as completed by this CI run.
