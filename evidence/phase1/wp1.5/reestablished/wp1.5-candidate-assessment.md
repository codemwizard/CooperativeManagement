# WP1.5 evidence re-establishment assessment

**Assessment date:** 2026-11-19 (local runner)
**Exact source candidate:** `b572d252dfd6733940011250918631a6c7f57a27` (`codex/wp1.5-reestablished`)
**Disposition:** Evidence re-established for local checks; WP1.5 is **not closed**. The candidate-specific PostgreSQL and hosted CI gates could not run in this environment. The task record was rebound to this source SHA with integration/BDD blocked and gate pending. No PASS is inferred from the historical d7fb record.

## Candidate and predecessor checks

- Source candidate is a clean reachable commit isolated from the dirty WP6.1 working copy. No WP6.1 uncommitted changes were copied into this worktree.
- Historical candidate `d7fbf5851b11b07b65bde36f062db7b21f487947` is treated as unrecoverable per owner direction. Its retained CI artifacts are historical and remain candidate-specific.
- The reconciled task record validates against `evidence/phase1/task-evidence.schema.json`; output is retained at `reestablished/task-evidence-schema-validation.raw.log`.
- `REM-WP0.3`, `REM-WP1.2`, `REM-WP1.3`, and `REM-WP1.4` evidence records name full SHAs that are ancestors of this candidate. WP1.2 and WP1.4 records say `gate_verified: passed`; WP0.3 is recorded in `evidence/phase1/tasks.json`; WP1.3 is recorded in `evidence/phase1/wp1.3/task-evidence.json` and pins to `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`.
- Comparing the WP1.5 closeout implementation baseline at `fb3d4f2cf6b1023cca5e90f2768783c892c96d13` with this candidate shows subsequent WP1.5-relevant changes: policy/table coverage grew to 39 tenant policies; the restricted-role suite now covers additional credential tables and authentication lookup function grants; the CI job gained WP5.4/WP5.5/WP6.1 acceptance steps. Those additions require current-candidate PostgreSQL/CI evidence; earlier 37-policy DB logs do not satisfy them.

## Acceptance checklist

| Acceptance criterion | Evidence on record | Result | Remaining limitation |
|---|---|---|---|
| Keep local environment files ignored/unmodified and out of evidence | No environment file was opened or changed during this work; see candidate status and this report | Partial | Full ignored-file inventory must be verified in the approved CI/workflow without reading secret contents. |
| Archive builder and independent verifier reject unsafe paths and retain safe files | `reestablished/archive-hygiene.raw.log` (9 tests and standalone verifier pass) | Pass (local) | Run again under required pinned toolchain and retain candidate CI artifact. |
| Compare all 39 live tenant policy definitions to frozen manifest | `reestablished/policy-manifest-unit.raw.log` (3 pure oracle tests pass); manifest `evidence/phase1/wp1.5-tenant-policy-manifest.json` | Partial | Live PostgreSQL catalog comparison not run. |
| Exercise every distinct inherited-parent path with app-role fixtures | `packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts` | Pending | Current candidate actual-role fixture run required. |
| Prove missing/empty tenant context and pool reuse fail closed | Same integration test; previous candidate logs only | Pending | Re-run against current candidate on isolated PostgreSQL 18. |
| Prove event_outbox RLS, exact writer function/ACL, and direct app-role denial | Same integration test and migration `0013_tenant_rls_app_role.sql` | Pending | Current candidate catalog and behavior run required. |
| Pin WP1.3 evidence to exact source SHA | `evidence/phase1/wp1.3/task-evidence.json` pins full SHA `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`; predecessor commit is an ancestor | Pass (record check) | This does not replace WP1.5 candidate CI. |
| Preserve failures through workflow pipelines | `reestablished/phase1-contract-tests.raw.log` (112 tests pass); `reestablished/phase1-structural-validator.raw.log` | Pass (local) | Hosted workflow must run on an immutable pushed candidate. |
| Clean install, replay, upgrade, failure rollback/retry, restricted-role DB, BDD, and required CI jobs on one candidate | `reestablished/wp1.5-environment-blocker.md`; workflow `.github/workflows/ci.yml` defines the required jobs | Blocked | No Docker command, no WP1.5 role URL variables, and no isolated PostgreSQL 18 service were available. No hosted run/artifact bundle for `b572d252...` exists in this workspace. |
| Candidate logs, metadata, checksums agree; historical d7 artifacts unchanged | `reestablished/*`; `reestablished/historical-d7-task-evidence.json` preserves prior record | Partial | Local checksums are generated with this evidence commit; candidate-specific CI logs/checksums still required. |
| Predecessor/task graph/evidence state reconcile; WP1.6 stays gated | `evidence/phase1/task-dependencies.yml`, `tasks.json`, WP1.2/WP1.3/WP1.4 records, and this pending WP1.5 record | Partial | WP1.5 must remain gate-pending until current candidate checks pass; verify no downstream record claims it as passing. |

## Fresh local verification

All commands below ran in the isolated candidate worktree. The raw output files are under `evidence/phase1/wp1.5/reestablished/`.

| Command | Result | Detail |
|---|---|---|
| `node --version` | Pass | `v26.7.0` |
| `npm --version` | Pass as a version query | Sandbox reports `11.19.0`; the owner-provided interactive PowerShell transcript reports `12.2.0`. In the sandbox, `npm.ps1` cannot access the user-level npm CLI and falls back to the system npm. |
| `node node_modules/vitest/vitest.mjs run tests/tooling/phase1_contracts.test.ts` | Pass | 112 tests |
| `node tools/phase1-contracts.js` | Pass | 45-node graph is known/acyclic; structural checks only |
| `npm run test:db --workspace @symphony/db -- src/__tests__/tenant-policy-manifest.test.ts` | Pass | 3 policy-oracle helper tests; no database assertions |
| `npm run verify:archive-hygiene` | Pass | 9 tests and independent repository verifier |

## Exact documents governing this disposition

1. `Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md` — WP1.5 place in task order and requirement to bind CI evidence to the exact candidate.
2. `docs/phase1/TENANT_ISOLATION_CONTRACT.md` — accepted tenant/RLS contract and current catalog boundaries.
3. `evidence/phase1/task-dependencies.yml` — WP1.5 predecessor edges and downstream gate dependencies.
4. `evidence/phase1/task-evidence.schema.json` — task evidence schema and status constraints.
5. `evidence/phase1/wp1.5/task-evidence.json` — now records this candidate and pending gate; `reestablished/historical-d7-task-evidence.json` preserves the superseded SHA-bound record.
6. `evidence/phase1/wp1.5-tenant-policy-manifest.json`, `evidence/phase1/tenant-table-inventory.json`, and `evidence/phase1/tenant-table-policy-matrix.json` — policy oracle inputs.
7. `packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts`, `packages/db/src/__tests__/tenant-policy-manifest.test.ts`, `migrations/0013_tenant_rls_app_role.sql`, and `.github/workflows/ci.yml` — executable proof and CI path.
8. `Implementation-Plan-V4/implementation/WP1.5-FINAL-CLOSEOUT-IMPLEMENTATION-PLAN.md` — detailed FC0–FC4 and 11-item closeout checklist retained in history at `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`; it is not present in the current candidate tree. Its criteria are summarized above, not silently treated as a current live verifier.

## Smallest next actions

1. Run the candidate in the approved Linux CI environment with Node `26.7.0` and npm `12.2.0`; provision clean isolated PostgreSQL 18 roles and run the exact CI workflow on the immutable source SHA.
2. Collect raw logs/artifact bundle, verify checksums, and review actual app-role catalog and row-behavior results, including all 39 policies and authentication function grants.
3. Reconcile this task record and any review index/dependency records only after every mandatory same-candidate result passes. Until then, `integration_test: blocked`, `bdd_ui_test: blocked`, and `gate_verified: pending` are intentional and accurate.



