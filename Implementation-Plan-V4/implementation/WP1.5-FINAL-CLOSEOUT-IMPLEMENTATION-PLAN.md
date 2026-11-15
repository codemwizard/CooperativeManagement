# WP1.5 Final Closeout Implementation Plan

**Status:** Implementation and local verification completed for the current worktree; final candidate CI and immutable evidence pin remain pending. WP1.5 final closeout is reopened for the bounded evidence and policy-verification items below. The prior candidate `d7fbf5851b11b07b65bde36f062db7b21f487947` and CI run `43683206104` remain valid historical evidence for that exact candidate; they do not prove the current worktree or the additional policy assertions implemented here.

**Objective:** Close the review findings without rewriting accepted WP1.2, WP1.3, or WP1.4 behavior, and produce a reproducible WP1.5 record proving the approved tenant boundary, archive hygiene, and final candidate CI state.

**Authority and review set:**

- [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md) and [`WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md`](./WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md)
- [`TENANT_ISOLATION_CONTRACT.md`](../../docs/phase1/TENANT_ISOLATION_CONTRACT.md)
- [`tenant-table-policy-matrix.json`](../../evidence/phase1/tenant-table-policy-matrix.json), [`tenant-table-inventory.json`](../../evidence/phase1/tenant-table-inventory.json), and [`wp1.5-tenant-policy-manifest.json`](../../evidence/phase1/wp1.5-tenant-policy-manifest.json)
- [`tenant-rls-app-role.integration.test.ts`](../../packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts), migration `0013`, the WP1.5 BDD feature/manifest/step definitions, and [`task-dependencies.yml`](../../evidence/phase1/task-dependencies.yml)
- The supplied review text dated 2026-11-15 and the retained candidate evidence in `evidence/phase1/wp1.5/ci/d7fbf5851b11b07b65bde36f062db7b21f487947/`.

## 1. Scope and preserved decisions

This is a bounded WP1.5 closeout. It adds evidence and tests for the existing approved role/RLS design; it does not redesign the command transaction, idempotency, reconciliation, tenant contract, or API. WP1.2 and WP1.4 remain accepted. WP1.3 remains accepted behavior with an evidence-pin correction carried forward. The WP1.5 database suite continues to run predecessor regression tests, but failures must be assigned to their owning behavior and not “fixed” by weakening assertions.

Development credentials may remain in ignored local `.env`/`.env.local` files per the owner’s instruction. This plan does not read, print, copy, or rotate their values. Such files must remain untracked and must not enter Git commits, source-review ZIPs, release bundles, logs, or evidence archives. Actual cleanup and rotation is deferred to the maturity gate in §3. Rotation is not a prerequisite for this development closeout unless an independently confirmed live credential exposure requires it.

The previous CI run remains immutable, candidate-specific evidence. Do not edit its logs, checksums, summary, or SHA directory to make it appear to describe the new candidate. New work receives a new full source commit SHA and its own evidence directory.

## 2. Requirements-to-proof map

| Finding / requirement | Implementation proof | Required evidence |
|---|---|---|
| Review/source archives must not contain environment or secret-bearing files | Archive creation excludes these paths; independent archive inspector checks every member name, including nested paths; tests exercise both creation and inspection | Archive-hygiene test log, archive member listing, archive SHA-256; no secret values in evidence |
| All 37 tenant policies implement the approved resolution and write checks | Actual catalog policies are matched to the frozen manifest for every tenant table; behavior fixtures prove visibility and write denial across every distinct relationship class | Restricted-role integration log, policy/table comparison report with expected and actual policy identifiers/expressions, fixture matrix |
| `event_outbox` has the specifically approved boundary | Catalog test proves ENABLE and FORCE RLS and checks exact pending-only tenant-bound writer policy/function ACL; app role cannot directly read/write or assume writer identity | Catalog assertion output and negative/positive app-role tests |
| WP1.3 evidence must identify immutable tested source | Resolve and pin the exact source commit used by existing WP1.3 evidence; schema rejects `working-tree` when a gate is passed | WP1.3 task record, validator negative/positive test log, source commit and evidence cross-reference |
| Final npm/Bash workflow corrections need candidate-bound CI | Corrected workflow is executed on the exact final source SHA; all piped checks fail if their command fails | CI run ID/attempt, raw logs, sanitized summary, checksums, exact SHA and runtime/database versions |
| Task state and dependency data must agree | WP1.5 completion record is updated only after all gates pass; dependency validator and review index agree; WP1.6 remains gated by every graph prerequisite | Schema/dependency validation output and updated record/index |

## 3. Credential and archive policy for this development phase

1. Keep local development `.env` and `.env.local` files usable and ignored by Git. Verify names/status using `git status --ignored` and ignore-rule checks; do not open or display their contents as part of this work.
2. Ensure archive creation operates from an explicit allowlist or explicit exclusion rules that cover root and nested `.env`, `.env.*` (including `.env.local`), private keys, credential files, local database dumps, and other repository-defined secret-bearing paths. Do not rely on `.gitignore`: ignored files can still be swept into a ZIP by a naïve recursive packer.
3. Inspect archive member names before writing/publishing the archive and again after creation. Reject unsafe entries independent of path depth, slash convention, or case where the platform/archive format is case-insensitive. Reject traversal entries (`..`), absolute paths, and duplicate normalized paths as well.
4. Tests use synthetic filenames and sentinel files with fake values only. Failure output reports the offending member path and rule identifier, never file contents or values.
5. Add a release-readiness/maturity checklist item: before a shared staging environment, real-data use, external source distribution, or production deployment, inventory and rotate credentials that were used during development, remove local credential files from deployment inputs, and verify secret storage/rotation ownership. Record this as deferred, not as a WP1.5 blocker.

## 4. Work packages and execution order

### WP1.5-FC0 — Freeze inputs and establish a clean candidate

1. Record current branch, full `HEAD`, `git status --short`, Node/npm/PostgreSQL versions, migration identity, app identity, and database name. Never record connection strings or passwords.
2. Confirm the d7fb historical artifact manifest still verifies; do not use that candidate as the new candidate.
3. Identify all files that the review/source archive generator includes and locate all generated archives. Add no archive based on an unrestricted recursive workspace copy.
4. Confirm the target test database is isolated (`DATA_MODE=test`, dedicated `*_test` DB), and tests use the provisioned identities rather than owner/superuser fallback.
5. Save a baseline report listing reviewed source and test files. Any untracked user evidence stays untouched and unstaged unless it is explicitly selected as a deliverable.

**Exit:** reproducible starting SHA/environment is documented, historical checksums pass, and the test DB/roles are identified without exposing credentials.

### WP1.5-FC1 — Archive hygiene (red/green TDD)

1. Read the archive builder and existing hygiene verifier. Document the exact archives/build outputs in scope and the supported path/name rules.
2. First write failing unit/contract tests using temporary fixture trees. Cases must include root `.env`, `.env.local`, nested `Prototype/.env`, nested `.env.production`, private key-like files, database dumps, path traversal, absolute names, case variants, and safe ordinary files. Assert both archive builder exclusion and verifier rejection of a deliberately contaminated archive.
3. Run only the new test and capture the expected red result. A test that merely checks `.gitignore` is insufficient.
4. Implement a shared, deterministic member-name policy or equivalent single source of truth. Make the builder exclude unsafe entries before archiving and make the verifier independently reject them after archive creation. Do not special-case only the three names from the review.
5. Add a positive test proving normal source files and required implementation/evidence documents remain present. Ensure nested path handling works on Windows and Linux.
6. Run the focused tests, then the repository archive-hygiene gate. Create a test archive from synthetic fixtures; list and verify its members. Do not use a live local environment file as a test fixture.

**Acceptance:** unsafe names are absent from produced archives and independently rejected if injected; safe files remain; no secret contents are read; all gates exit nonzero on failure.

### WP1.5-FC2 — Verify every tenant policy against the approved manifest

#### FC2.a Define the test oracle before production-code edits

1. Read the tenant contract, inventory, matrix, manifest, migration 0013, and test schema together. Produce a checked-in mapping of every `tenant_scoped` table to its expected policy name, command (`SELECT`/`INSERT`/`UPDATE`/other approved command), expected `USING`, expected `WITH CHECK`, and tenant-resolution source.
2. Require exact set equality among (a) tenant-scoped table names in inventory/matrix, (b) manifest policy entries, and (c) database catalog rows. Fail on missing, duplicate, unexpected, stale, or unclassified entries. Assert the documented count 37 from those sets; do not merely compare a hard-coded count with itself.
3. Compare the actual catalog's `pg_policies` `qual` and `with_check` values with each approved manifest expression using a narrow canonicalization routine that only removes PostgreSQL-rendering differences proven irrelevant (whitespace, redundant outer parentheses, and identifier quoting where unambiguous). Keep expected and actual expressions in failure diagnostics. Do not use substring checks, permissive regexes, a “contains tenant_id” heuristic, or silently normalize operators/casts/function calls.
4. If safe normalization cannot distinguish a harmless render difference from a semantic change, fail closed and update the manifest only through a reviewed migration/contract change. Never auto-regenerate the expected manifest from the live database during test setup.
5. Add tests for the comparator itself: equality for known equivalent renderings; rejection for changed tenant setting, removed predicate, wrong parent join, changed operator, missing `WITH CHECK`, extra permissive policy, and unexpected command/grantee.

#### FC2.b Make the integration test prove row behavior

1. Add tests first and show red against a deliberately substituted wrong policy in a disposable database (or a test-only catalog fixture); never weaken or mutate the canonical migration to manufacture a green result.
2. As the actual `symphony_app` role, run queries without explicit tenant predicates. For every table directly keyed by `tenant_id`, prove a tenant-A session cannot see tenant-B rows and cannot INSERT/UPDATE a row assigned to tenant B. Where the runtime grant intentionally disallows a command, prove the denial is due to the expected privilege boundary and record that separately from RLS behavior.
3. Enumerate every distinct inherited-parent relationship from the inventory (for example, child → organization → tenant, and any other distinct chain). For each equivalence class, identify every member table and prove with representative fixtures that:
   - a valid tenant-A parent/child chain is visible in tenant A;
   - tenant B sees no tenant-A rows;
   - a cross-tenant or mismatched-parent child cannot be inserted or updated;
   - orphan/missing parent behavior fails closed according to FK/policy contract.
   The test output names each class and all tables it covers. A class may combine tables only when their resolution SQL and inherited path are identical and the catalog comparison above independently checks every member table.
4. Exercise missing and empty `app.tenant_id`, transaction-local context cleanup on connection-pool reuse, and context changes between tenants. Verify no session-level tenant value leaks across transactions.
5. Use an independent connection through the app pool for all application observations. Admin/setup connections may create fixtures, but must not perform the assertions that claim app-role isolation. Cleanup uses isolated fixture IDs and restores any altered trigger/policy state in `finally`/teardown.

#### FC2.c Prove outbox boundary explicitly

1. Catalog assertions must require `event_outbox.relrowsecurity = true` and `relforcerowsecurity = true`.
2. Compare every outbox policy's table, name, role, command, `USING`, and `WITH CHECK` against the approved manifest. Assert the writer rule is limited to pending messages associated with a domain event visible to the transaction tenant; reject extra permissive policies.
3. Verify function owner, fixed `search_path`, security-definer status, PUBLIC privilege revocation, exact app EXECUTE grant, and writer/table grants from PostgreSQL catalogs.
4. With `symphony_app`, prove direct `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and role assumption are denied as appropriate; prove valid enqueue through the narrow function succeeds; prove wrong-tenant, missing-context, non-pending, and unrelated-event attempts fail and leave no outbox row.

**Acceptance:** all 37 policies have catalog-to-manifest matches and appropriate behavioral proof for each distinct relationship class; outbox invariants and privilege boundary are tested under real restricted identities. RLS enabled/forced counts alone do not pass this work package.

### WP1.5-FC3 — Repair and pin WP1.3 evidence (carry-forward)

1. Inspect WP1.3 task record, schema, source history, retained test logs, and later WP1.4/WP1.5 predecessor regression logs. Identify the exact commit whose tracked source and tests correspond to the evidence; do not infer it from a nearby commit or use `working-tree`.
2. If the tested state cannot be mapped unambiguously to an existing commit, reproduce the listed WP1.3 required tests on a clean candidate and pin that candidate instead. This is evidence correction only; do not reopen the accepted behavior absent a failing test.
3. Add schema/validator cases proving a passed WP1.3 record with `commit: working-tree`, malformed SHA, or SHA inconsistent with the referenced candidate is rejected; a valid full SHA is accepted.
4. Update `evidence/phase1/wp1.3/task-evidence.json`, its artifact references, and review index. Preserve old raw logs and record the relationship between original evidence and any rerun.
5. Run the validator and report the exact source commit and commands. Keep WP1.3’s bounded retry semantics unchanged.

**Acceptance:** WP1.3 passed evidence is pinned to one immutable full source SHA with a validator that prevents reintroducing the placeholder.

### WP1.5-FC4 — Final candidate verification and CI

1. Finish FC1–FC3 and run focused checks in this order: archive-hygiene tests; policy comparator tests; restricted-role RLS integration suite; migration suite/clean install/replay/0012→0013 upgrade/failure atomicity; WP1.5 BDD; DB workspace suite; typecheck/architecture/trace/phase contract validators; toolchain checks; full required Phase 0 gate and applicable WP1.5 workflow jobs.
2. BDD remains mapped to behavior: WP1.5 scenarios use the actual database and restricted DB identities to prove the tenant boundary. Define or retain scenarios with these observable contracts, mapped to stable scenario IDs in the Phase 1 manifest:
   - **Direct tenant key:** Given tenant A and tenant B rows in each directly tenant-keyed fixture table, when the app connection sets transaction-local context to A and queries without an application-supplied tenant filter, then only A rows are returned; an A-scoped attempt to insert or update a B-owned row is rejected.
   - **Inherited tenant key:** Given parent rows owned by A and B plus child rows linked through each documented relationship class, when the restricted app role queries as A without an explicit tenant filter, then it sees only descendants of A; attempts to attach or mutate a child across the parent tenant boundary are rejected. Each scenario names the relationship class and all tables represented by that class.
   - **Absent context:** Given the app role has no tenant setting or an empty setting, when it selects or attempts an allowed write on a tenant-scoped table, then it receives no tenant rows and the write is rejected; it must not inherit a previous pooled connection's tenant.
   - **Outbox capability:** Given a visible domain event owned by A, when the app calls the approved enqueue capability with a pending message under A context, then exactly the intended row is committed; wrong-tenant, missing-context, non-pending, unrelated-event, and direct table-write attempts are denied and leave no row.
   Drive each scenario through actual PostgreSQL connections as `symphony_app`; setup may use the isolated administrator identity. The BDD step implementation must not add a tenant predicate that could make a broken policy appear correct. Assert catalog/policy properties separately in the integration test; a filtered read or domain-only `UNAUTHORIZED` result is not RLS proof. These scenarios do not claim HTTP authentication/session behavior, which belongs to its owning API/authentication work package. Preserve the existing AUD-005 path and manifest tags; do not move Phase 1 scenarios into a Phase 0 filter.
3. Before each logging pipeline, set explicit `shell: bash` or equivalent `pipefail` behavior. Add/retain a regression test that runs a failing command through the exact logging wrapper and proves the wrapper returns nonzero. Cover bootstrap, migration, DB integration, focused BDD, finalizer, and legacy verification pipelines.
4. Ensure the CI toolchain selects the declared exact Node/npm versions (Node `26.7.0`, npm `12.2.0`) before verification. The verifier compares actual runtime versions with package/workflow declarations; do not update only documentation, skip the check, accept a major-only version, or use a bundled npm CLI that differs from the approved version.
5. Run CI on the exact full commit SHA containing all final source, test, migration, workflow and documentation changes. A run on a parent commit or a dirty worktree is supporting evidence only. No GitHub results are inferred from local tests or a prior run. Retain provider-exported evidence or the authorized CI artifact bundle for the exact final SHA and run ID.
6. Store new artifacts under `evidence/phase1/wp1.5/ci/<full-final-sha>/` with raw logs, sanitized summary, runtime/database/role identity metadata, archive member report, policy comparison/fixture report, CI run ID/attempt, and SHA256SUMS. Check hashes after copying. Never put credentials or connection strings in evidence.

**Acceptance:** every mandatory job succeeds on the same clean commit, pipeline failure propagation is demonstrated, role finalizer ran successfully even on failure paths, and evidence SHA/run IDs are consistent. Historical d7 evidence is linked, not overwritten.

### WP1.5-FC5 — Reconcile records and close

1. Validate all changed task records against `task-evidence.schema.json`; run the dependency validator and confirm WP1.5 prerequisites are passing.
2. Update WP1.5 evidence with the final SHA, exact CI run/attempt, command set, identity/version metadata, counts, artifact paths/checksums, policy coverage model, and limitations. Set all required statuses to passed only after FC0–FC4 pass.
3. Keep WP1.3’s record separately pinned; add its evidence as a predecessor reference. Do not rewrite WP1.2/WP1.4 results or claim their task ownership changed.
4. Update the WP1.5 implementation plan, Phase 1 plan summary, implementation index, tenant-policy evidence metadata, and independent-review document index so they all show the same candidate/status. Preserve previous records as historical and link them.
5. Run the evidence/schema/dependency/document-index validators after the last edit. A documentation edit that changes the candidate SHA requires the repository’s candidate/evidence pinning procedure to be followed; do not claim the evidence commit itself was exercised by an earlier CI run unless the gate is designed to test it and the record says so.
6. Independent review remains the separate Phase 1 review gate already defined by project governance. It is not a reason to omit implementation work or fabricate an independent sign-off in the WP1.5 task record.

## 5. Test design and anti-shortcut rules

- **Real TDD:** for every new invariant, commit/write the assertion first, run it against the current implementation and preserve the failing result, then make the smallest production change, rerun to green, and run relevant regression suites. A test written after the implementation with no demonstrated red run is not recorded as TDD evidence.
- **Real database:** catalog and row-security assertions run against PostgreSQL 18 with the provisioned app, migration, and admin roles. No owner/superuser fallback may satisfy an app-role assertion. Record `current_user`, database, and server version; never log secrets.
- **BDD:** scenario text describes externally observable tenant outcomes and setup uses the declared real DB step path. Each step has a meaningful assertion and failure diagnostic. No skipped/pending/undefined steps, mocked RLS result, filtered query presented as proof of RLS, or API/login requirement imported from a later WP.
- **No coverage laundering:** no table-count-only assertion, policy-name-only check, broad regex, vacuous “row absent” after a tenant filter, test-only grant that leaks into the app role, or all-assertions-under-admin shortcut.
- **No gate weakening:** do not delete/skip tests, broaden grants, disable FORCE RLS, accept wildcard versions, alter workflow filters to hide failures, downgrade assertion severity, or regenerate the frozen manifest from the implementation under test.
- **Reproducibility:** use isolated disposable fixtures with deterministic cleanup; exact commands, exit codes, test counts, environment versions and artifact paths are recorded. Each gate fails fast and pipes preserve upstream status.

## 6. Completion checklist

WP1.5 final closeout is complete only when every item below is evidenced against the final candidate:

- [ ] Local `.env` files remain ignored and unmodified; no secret values were inspected or copied.
- [ ] Archive builder and independent archive verifier reject root/nested secret-bearing paths and unsafe archive paths; positive safe-file inclusion is tested.
- [ ] All 37 tenant-scoped catalog policies equal the frozen approved manifest under strict comparison; expected/actual `USING` and `WITH CHECK` are verified.
- [ ] Every distinct inherited-parent path has app-role negative and positive fixtures, and all member tables are named in the coverage report.
- [ ] Missing/empty tenant context and pool reuse fail closed; no tenant context leaks.
- [ ] `event_outbox` ENABLE/FORCE, exact pending-only tenant-bound writer policy/function ACL, and denied direct app access are proven.
- [ ] WP1.3 evidence is pinned to an exact full SHA and its validator rejects `working-tree` for passed evidence.
- [ ] Final npm/Bash workflow correction tests pass; all pipeline wrappers preserve failures.
- [ ] Migration clean install, replay, upgrade, failure-atomicity/retry, restricted-role DB suite, WP1.5 BDD, and required CI jobs pass on one exact final SHA.
- [ ] Candidate-scoped raw logs, summaries, metadata and checksums verify; prior d7 artifacts remain unchanged.
- [ ] WP1.2–WP1.5 evidence, task graph, plan summaries, and review index agree; WP1.6 remains unstarted until all its direct dependencies pass.

## 7. Deferred maturity gate and out-of-scope work

Before shared staging, real-data access, external distribution, or production deployment, perform the credential inventory/rotation and move credentials to the approved deployment secret mechanism. This is explicitly deferred during current development, subject to the archive exclusion rules above.

WP1.5 does not implement API composition/login, HTTP authorization mapping, reconciliation authorization (WP1.7), missing WP2/WP5 dependencies, production key custody, backup deletion guarantees, or Phase 1 closure. These stay in their owning work packages and dependency graph.

## 8. Current closeout state

The prior d7fb CI record remains passed for its exact source candidate. Implementation for the additional archive, policy-oracle, row-behavior, outbox, workflow-contract, and app-role audit findings is committed and locally verified as recorded below. WP1.3 evidence is pinned to tested source commit `fb3d4f2cf6b1023cca5e90f2768783c892c96d13` and passes schema validation. The new final-closeout gate remains **pending** until the approved Phase 0 gate and candidate-bound CI evidence pass on the exact final candidate SHA, and the candidate-specific hashes/checksums are validated. Do not change the WP1.5 task record’s historical d7fb SHA or claim CI acceptance for this new candidate.

## 9. Execution record — 2026-11-15

### Implemented

- Archive member validation now rejects environment/credential/key/database-backup names, absolute and traversal paths, and normalized duplicate members. The source-review ZIP builder enumerates the committed Git tree and excludes unsafe names before reading blobs; opaque nested archive formats are excluded so their internal members cannot bypass validation. Its output is independently checked before it is retained.
- The tenant policy manifest now freezes all 37 tenant-scoped table expressions and the event-outbox writer policy/function contract. A narrow PostgreSQL deparser comparison is used; table-set comparison rejects missing, unexpected, or duplicate entries.
- The actual-role DB suite now verifies catalog expressions plus unfiltered row visibility/writes across every distinct manifested tenant-parent path. `symphony_app` remains the identity for all application assertions; admin connections are limited to fixture setup and teardown.
- The WP1.2 security-attempt integration regression is corrected to use `PHASE1_TEST_APP_DATABASE_URL`, and it asserts the connected identity is exactly `symphony_app`. It no longer attempts the app-only write using the migration identity.
- Passed WP1.3 evidence can no longer use the `working-tree` sentinel. The applicable schema and negative/positive contract test enforce a full lowercase 40-hex commit SHA.
- The workflow contract requires explicit Bash `pipefail` for logged commands and tests that a failing command remains a failing pipeline. Toolchain checks use the exact installed Node 26.7.0/npm 12.2.0 declarations.

### Local verification retained

- Phase 1 contract tests: **110 passed**. Raw log: `evidence/phase1/wp1.5/local/2026-11-15/final-phase1-contract-tests.raw.log`.
- Phase 1 contract tests: **110 passed**. Structural/dependency validator: **passed** with 45 known acyclic task nodes, all required gate/BDD IDs resolving, and the 55-table inventory.
- Full `@symphony/db` Vitest suite with isolated test admin and temporary `symphony_migrator` URL: **62 passed, 12 files**. Temporary membership/password changes were restored after the run. Raw log: `evidence/phase1/wp1.5/local/2026-11-15/final-db-suite-bootstrapped.raw.log`.
- Focused security-attempt integration using `symphony_app`: **5 passed**. It verifies current role, database, and PostgreSQL version before recording the denial. Raw log: `evidence/phase1/wp1.5/local/2026-11-15/security-audit-app-role.raw.log`.
- WP1.5 BDD-AUD-005 under `NODE_ENV=test`, `DATA_MODE=test`, and `SYNTHETIC_ONLY=true`: **1 scenario and 7 steps passed**. Raw log: `evidence/phase1/wp1.5/local/2026-11-15/final-bdd-wp1.5.raw.log`.
- Archive hygiene tests: **8 passed**; independent repository archive verifier passed.
- Nested-archive TDD regression: the new test first failed because `docs/phase1.zip` was included in the source-review ZIP; after excluding opaque archives, the focused test and complete archive suite pass. Red output is retained at `evidence/phase1/wp1.5/local/2026-11-15/archive-nested-container.red.raw.log`.
- Independent-verifier TDD regression: the builder test first failed because the generated ZIP had not passed the standalone `verify_archive_hygiene.py`; the builder now invokes that verifier and removes output on verifier failure. Red output is `evidence/phase1/wp1.5/local/2026-11-15/archive-independent-verifier.red.raw.log`.
- Traceability verification: **passed**, covering 205 scenarios, with all 26 hard non-WIP scenarios mapped to step definitions.
- Source-review archive built from commit `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`: standalone verifier passed; **1,081 members** listed; the three tracked nested ZIP archives were excluded. Archive SHA, full member list, and verifier output are retained in `evidence/phase1/wp1.5/local/2026-11-15/source-review-fb3d4f2.*`.
- WP1.3 evidence record now pins to `fb3d4f2cf6b1023cca5e90f2768783c892c96d13`; schema validation returned no errors. This pin identifies tested source; it does not claim hosted CI.

### Remaining closure gates

1. Run `npm run verify:phase0` using the approved Node 26.7.0/npm 12.2.0 toolchain on the exact final candidate and retain the result. The earlier local attempt stopped at migration integration because its URL did not designate the provisioned migrator; the corrected full DB suite passed, but this is not a substitute for the complete Phase 0 gate.
2. Obtain candidate-specific CI results via the owner-provided CI artifact bundle (no GitHub query is made by this task), retain raw outputs and checksums, and reconcile WP1.5 task/dependency/review-index records only after all same-SHA gates pass.
3. Keep the prior d7fb evidence immutable. WP5.3 API-backed login and other downstream dependencies remain separately owned; this work does not authorize WP1.6 or close Phase 1.
