# REM-WP6.1 predecessor and closure implementation plan

**Status:** Implementation and focused acceptance complete; WP5.3 is exact-candidate gate-closed. WP6.1 exact-candidate preflight/final verification and origin CI remain.

**Candidate base:** `d9a8f47ed278918b507b1776b0bb9d426da37c1a` (`main` / `origin/main` at the time this plan was prepared).

**Scope:** Establish exact-candidate WP5.3 closure; implement the live Cucumber browser/API/PostgreSQL path for BDD-UXW-001–004; complete WP6.1 evidence and verification; push the verified feature branch for CI and review. WP2.2 and other already-passed predecessors are revalidated as ancestors, not reimplemented.

## 1. Current verified baseline

| Work package | Recorded status and candidate | Action for this plan |
|---|---|---|
| REM-WP0.9 | `gate_verified: passed`, commit `f1fa5f9413747c0ac3cbd73413179101d33f653e` in `evidence/phase1/tasks.json` | Confirm record and ancestry; no implementation work. |
| REM-WP0.10 | `gate_verified: passed`, same recorded commit in `evidence/phase1/tasks.json` | Confirm record and ancestry; no implementation work. |
| REM-WP1.5 | `gate_verified: passed`, commit `6f145875761a2c356bab790324c8a5615ec03652` | Confirm record and ancestry; no implementation work. |
| REM-WP2.2 | `gate_verified: passed`, commit `5c5c730843ba3b5627a5389383496b9653caae04` | Confirm exact record, verifier evidence and ancestry; do not repeat closure unless its record or source changes. |
| REM-WP5.2 | `gate_verified: passed`, commit `7003723da67057bac110b5e364fdadddee6c6785` | Confirm record and ancestry; no implementation work. |
| REM-WP5.3 | exact-candidate gate passed on `6ba1885035b330122570bf4602d88bcd19f73fc1` | Preserve and recheck the recorded preflight/final artifacts; no further implementation. |
| REM-WP6.1 | implementation and focused acceptance complete; live Cucumber passed; gate pending; evidence still needs exact candidate binding | Bind evidence to the final implementation candidate, run preflight/final verifier, then push for CI. |

Authoritative status is always the current task evidence and dependency registry, not this table. Re-read them before each candidate is cut. The verified `main` evidence files are `evidence/phase1/tasks.json`, `evidence/phase1/wp1.5/task-evidence.json`, `evidence/phase1/wp2.2/task-evidence.json`, `evidence/phase1/wp5.2/task-evidence.json`, `evidence/phase1/wp5.3/task-evidence.json`, and `evidence/phase1/wp6.1/task-evidence.json`.

The working repository is already on local `codex/wp6.1-closeout`, based on the candidate base above. The original mixed closeout work is retained at `stash@{0}`. Keep the stash until the final branch has been pushed and verified. Do not push the current dirty branch or mark either open gate passed.

## 2. Authority and acceptance constraints

Use these sources as binding:

- `Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md`, REM-WP5.3 and REM-WP6.1 sections, including the WP6.1 acceptance and stop conditions.
- `Implementation-Plan-V4/implementation/WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md`, especially the WP2.2 and WP5.3 evidence rules and the WP5.4/WP5.5 downstream boundaries.
- `evidence/phase1/task-dependencies.yml` and `evidence/phase1/tasks.json`.
- `evidence/phase1/bdd-scenarios.json`, `evidence/phase1/bdd-work-package-map.json`, and `features/10_workspace_and_capabilities.feature`.
- `evidence/phase1/wp5.3/task-evidence.json`, `tools/verify_wp5_3_closure.mjs`.
- `evidence/phase1/wp6.1/task-evidence.json`, `tools/verify_wp6_1_closure.mjs`.
- `evidence/phase1/wp6.1/workspace-context-contract.md`, `workspace-persona-catalogue.md`, and `verified-evidence-projection-contract.md`.
- `Implementation-Plan-V4/02-decision-register.md` D-18; accepted ADR-010 and IFV-4 in `Implementation-Plan-V4/03-specification-delta.md`.

Already approved UXW-004 decisions are: official appointment record supplies verifier name/title; display is allowed to authorized cooperative-record viewers and public-record viewers within the applicable public-record/fee rules; only exact `supports_claim` can produce a positive verified chip. Exact `cooperative_internal` maps to `cooperative-internal` under ADR-010/IFV-4. Keep these decisions in evidence; do not reopen them or attribute the mapping to D-11/Proposed ADR-011.

Do not introduce client-asserted authority, fake sessions, session-store redesign, unrelated authentication refactoring, or a general finding-authoring workflow. The four WP2.2 limitations (member activity/household persistence, tenant-specific directory data, authority grant/revoke lifecycle, and first-class cohort lifecycle) remain explicit limitations; they do not block the scoped route and menu assertions.

## 3. Stage A — prepare and reconcile the candidate branch

1. Preserve the existing safety stash. Confirm `main` is clean and still equals the fetched `origin/main`; fetch before any eventual push and rebase/merge only if origin advanced.
2. On `codex/wp6.1-closeout`, inventory the current diff and select only WP5.3 closure artifacts and WP6.1 implementation/evidence plus necessary shared migrations, contracts, RLS inventory/policy updates and tests. Exclude WP1.5 diagnostic outputs, unrelated WP2.1 edits, generated files, credentials, `.env*`, and unrelated evidence. Review staged paths before each commit.
3. Reconcile the task graph with the closure verifier. WP6.1 graph must explicitly contain the verifier-required direct predecessors `REM-WP0.9`, `REM-WP2.2`, and `REM-WP5.3`. Keep each existing graph rationale and validate that all IDs resolve to authoritative records. Do not use a manual task-status override.
4. Preserve the frozen BDD owner map: UXW-001–004 belong to REM-WP6.1; UXW-015 remains REM-WP6.3. Select only the four WP6.1 IDs in the dedicated runner. Do not retag, delete, weaken, or mark required scenarios `@wip`.
5. Confirm Node `v26.7.0`, npm `12.2.0`, and `npm run verify:toolchain`. Keep local database URLs in ignored `.env.local`; never copy credentials into logs or Git.

**Exit:** cleanly reviewed scope list, graph/verifier consistency, toolchain pass, local working credentials available, and no changes to `main`.

## 4. Stage B — close REM-WP5.3 as its own exact candidate

The current WP5.3 implementation and focused test results exist, but its evidence has no immutable candidate SHA and its gate remains pending. Close it before using it as a WP6.1 predecessor.

1. Inspect the current WP5.3 source and its accepted policy/evidence: `docs/phase1/AUTHENTICATION_CONTRACT.md`, D-10/D-14, the REM-WP5.3 plan, the WP5.2 predecessor record, and the current dependency graph. Do not expand scope to WP5.4/5.5.
2. Run and capture, on the exact WP5.3 implementation candidate, the existing commands required by `tools/verify_wp5_3_closure.mjs`: API/PostgreSQL integration, migration/session tests, `typecheck:v4`, architecture, phase 1 contracts, and `git diff --check`. Retain raw logs under `evidence/phase1/wp5.3/`; confirm no canary secrets or credentials appear.
3. Commit the bounded WP5.3 implementation/test artifacts and verifier, if they are not already present in the candidate scope. Record that implementation commit SHA in `evidence/phase1/wp5.3/task-evidence.json` while leaving `gate_verified: pending`; commit the evidence-only change within `evidence/phase1/wp5.3/`.
4. Run `node tools/verify_wp5_3_closure.mjs <implementation-sha> --preflight` on a clean worktree. It must prove WP0.10 and WP5.2 passing predecessor records and ancestor SHAs, exact artifact presence/content, pinned npm, and candidate identity.
5. If preflight passes, make only the WP5.3 evidence change `gate_verified: passed`, commit it under `evidence/phase1/wp5.3/`, and run `node tools/verify_wp5_3_closure.mjs <implementation-sha>` in final mode. Retain both verifier outputs under `evidence/phase1/wp5.3/`.

**Exit:** final verifier prints `PASS`; WP5.3 is complete with an immutable implementation SHA and all required statuses passed/not-applicable. Any failure remains pending and is corrected before WP6.1 candidate work proceeds.

## 5. Stage C — implement the live WP6.1 Cucumber path

Add a dedicated `npm run test:wp6.1:bdd` entry and runner, recommended at `tools/run_wp6_1_bdd.mjs`. Keep `tools/run_wp6_1_routes.mjs` and `tests/workspace/routes.spec.ts` as supporting Playwright acceptance; they do not replace Cucumber.

### Runner and test world

- Extend Cucumber World with scenario-local browser/page, base URL, persisted fixture IDs and the selected workspace context. Add hooks to start/close the browser and create/delete unique synthetic PostgreSQL fixtures safely.
- Start the real Fastify API and Vite workspace using the bounded-process/readiness pattern in `tools/run_wp6_1_routes.mjs`.
- Refuse execution unless `DATA_MODE=test`, both `PHASE1_TEST_ADMIN_DATABASE_URL` and `PHASE1_TEST_APP_DATABASE_URL` exist, both point to local PostgreSQL `_test` databases, and services become ready. Use admin role only for fixture setup/cleanup; use app role for all application reads.
- Authenticate through the actual `/auth/csrf` and `/auth/login` flow and let the browser carry the issued session cookie. Never fabricate the cookie/session or inject a client authority claim.
- Select only `BDD-UXW-001`, `002`, `003`, and `004`. Write a valid Cucumber JSON report to `evidence/phase1/wp6.1/cucumber-report.json` and console output to `evidence/phase1/wp6.1/cucumber-run.log`; ensure both are tracked and candidate-bound.
- Reuse/extract the fixture setup and persona expectations from `tests/workspace/routes.spec.ts`; avoid a second identity model. The active source branch currently exercises six shared workflow contexts plus separate Chairperson, Vice-Chairperson, and Treasurer accounts. Reconcile the exact example list against the frozen feature/owner map before writing assertions; execute every frozen example without changing the map to fit the implementation.

### Frozen scenario obligations

| Scenario | Live assertions required |
|---|---|
| BDD-UXW-001 | For every frozen persona example, establish persisted session, retrieve server-derived contexts, select the intended context in the UI, assert the exact navigation labels, click every link, and assert the destination URL, one visible/focused `h1`, and expected document title. Include Chairperson, Vice-Chairperson and Treasurer examples where they appear in the approved feature/owner map. |
| BDD-UXW-002 | Browser-open an evidence route with filter/sort query; assert focus on its `h1`, navigate to a second route, use Back and Forward and assert URL/focus each time, reload the original route and assert its query is preserved. |
| BDD-UXW-003 | Iterate an explicit nonempty route inventory; wait for each actual route to render; inspect visible DOM text; reject snake_case enum values and unsupported vocabulary (`compliant`, unsupported `approved`, bare `Verified`). Do not generate an empty/DOM-derived inventory. |
| BDD-UXW-004 | Seed persisted assignment, exact evidence version, finding and appointment-backed immutable attribution; read through the authenticated app-role API and expand the actual rendered item. Assert verifier name/office, scope, exact version and exact `cooperative-internal` label. Add negative persisted/rendered cases for adverse and inconclusive outcomes, legacy/unknown (including NULL), absent finding/attribution/scope, mismatched versions, and unknown assurance values; none may render the positive chip. |

The positive projection must remain fail-closed across assignment/finding/version consistency, completion, exact `supports_claim`, nonblank approved scope, complete appointment-backed snapshot, and exact `cooperative_internal`. Do not add a finding write workflow; migration-backed controlled fixture setup is sufficient for this acceptance. Keep real legal-public-record classification/fee workflow out of this shell and preserve it as an explicit production limitation.

### Evidence and test commands

Retain the new command output and Cucumber JSON report under `evidence/phase1/wp6.1/`. Retain the focused Playwright route output under the WP6.1 evidence directory as well. Then run, from the candidate branch:

```powershell
node --version
npm --version
npm run verify:toolchain
npm run typecheck:v4
npm run verify:arch
npm run verify:phase1:contracts
npm run test:wp6.1
npm run test:wp6.1:bdd
```

The JSON report must be parsed and checked for all four IDs, every frozen UXW-001 outline example, nonzero executable steps, and only `passed` step results. There may be no missing, duplicate, undefined, pending, skipped, failed, or `@wip` active examples. Do not claim gate closure from process exit alone.

**Exit:** all above checks pass against source that will be included in the candidate; the report and logs are retained, valid, secret-scanned and tracked.

## 6. Stage D — bind WP6.1 implementation and close its gate

1. Update `evidence/phase1/wp6.1/task-evidence.json` with `implementation=complete`, focused test statuses passed, `bdd_ui_test=passed`, `gate_verified=pending`, exact evidence environment (Node 26.7, npm 12.2, PostgreSQL 18 after query verification, app role, test mode), nonempty route inventory, commands/artifact paths, and all actual limitations. Set its `commit` to the immutable implementation candidate SHA in an evidence-only follow-up commit. Keep `unresolved_decisions` empty only because D-18 and ADR-010/IFV-4 already resolve the relevant choices.
2. Ensure all code, contracts, migrations, tests, runner, reports and raw logs are in the candidate or allowed WP6.1 evidence-only commits. The verifier permits post-candidate changes only below `evidence/phase1/wp6.1/`.
3. Confirm passing WP0.9, WP2.2 and WP5.3 records and ensure their implementation SHAs are ancestors of the WP6.1 implementation candidate. WP2.2 need not be reclosed if its unchanged passing record and SHA remain valid ancestors.
4. On a clean worktree, run `node tools/verify_wp6_1_closure.mjs <implementation-sha> --preflight`. Correct every reported issue; never set gate status to passed to satisfy preflight.
5. After preflight passes, update only the WP6.1 evidence status to `gate_verified=passed`, commit that evidence-only change, then run `node tools/verify_wp6_1_closure.mjs <implementation-sha>` in final mode. Retain preflight/final outputs under `evidence/phase1/wp6.1/` while respecting the candidate evidence-only rule.

**Exit:** final verifier prints `PASS REM-WP6.1 exact candidate`; all required predecessors, BDD report entries, raw artifacts and environment checks are proven. If any mandatory test or predecessor fails, keep the gate pending and report the exact failure and smallest repair.

## 7. Stage E — push and CI review

1. Review `git diff --check`, staged-path list, `git status --short`, and commit ancestry. Ensure no secrets, generated output, unrelated WP1.5/WP2.1 changes, or evidence with a mismatched SHA is included.
2. Fetch `origin`; verify the candidate is based on current `origin/main`. If main advanced, integrate it and rerun all affected tests and both closure verifiers against the resulting exact candidate.
3. Push `codex/wp6.1-closeout` to origin only after WP5.3 and WP6.1 final verifiers pass. Do not push directly to `main`.
4. Wait for CI on the pushed SHA. Record the workflow/run URL, exact SHA, job results, and retained CI artifacts. If CI fails, fix on the same feature branch, create a new exact candidate, and repeat impacted verifications; do not transfer the previous candidate's PASS.
5. Report the final branch/SHA, push result, CI result, each WP6.1 acceptance criterion and evidence path, predecessor statuses/SHAs, and remaining non-gate production limitations. Keep the safety stash until pushed CI evidence and the final report are reconciled; then remove it only after confirming the branch contains every intended change.

## 8. Acceptance ledger for final report

| Criterion | Required evidence | Pass condition |
|---|---|---|
| WP5.3 predecessor | `evidence/phase1/wp5.3/task-evidence.json`, raw command logs, preflight and final verifier outputs | Exact immutable candidate; WP0.10/WP5.2 pass and are ancestors; final verifier PASS. |
| WP6.1 dependencies | `evidence/phase1/task-dependencies.yml`, `tasks.json`, WP0.9/WP2.2/WP5.3 records | Graph matches verifier; every required predecessor has passing statuses and an ancestor implementation SHA. |
| UXW-001 | retained Cucumber report + raw run log | Every frozen outline example proves server-derived persona context, exact menu, real links, route, title and one focused h1. |
| UXW-002 | retained Cucumber report + raw run log | Real browser proves focus, Back/Forward, reload and URL query persistence. |
| UXW-003 | report and explicit route inventory in WP6.1 evidence | Nonempty inventory, actual DOM scan on each route, no forbidden vocabulary. |
| UXW-004 | migration/API/fixture logs, Cucumber report, rendered browser assertions | Positive chip uses persisted exact-version finding and approved attribution; all negative/unknown/incomplete fixtures fail closed. |
| Toolchain and focused checks | retained command logs | Node/npm pinned versions and typecheck, architecture, contracts, Playwright and Cucumber commands pass. |
| Exact-candidate gate | clean evidence HEAD, candidate SHA, WP6.1 preflight/final verifier outputs | Preflight and final verifier PASS; implementation/test/gate states remain distinct. |
| Origin CI | pushed branch SHA and provider run/artifact references | CI passes on the exact pushed SHA; no claims based on a different candidate. |

**Out of scope and retained limitations:** production hosting and production data; legal classification and fees for public-record disclosure; member activity/household persistence; tenant-specific directory records; authority grant/revoke lifecycle; first-class cohort lifecycle; complete finding-authoring/write lifecycle; independent security/accessibility review. Do not state these capabilities are implemented as a condition of this bounded WP6.1 gate.

## 9. Implementation progress

| Item | Result | Evidence |
|---|---|---|
| Candidate isolation and predecessor ancestry | Local branch `codex/wp6.1-closeout` is based on updated `main`; WP1.5, WP2.2, WP0.9 and WP0.10 passing SHAs are ancestors. | Git ancestry checks; task records. |
| REM-WP5.3 exact closure | PASS on candidate `6ba1885035b330122570bf4602d88bcd19f73fc1`; preflight and final verifier passed. | `evidence/phase1/wp5.3/closure-preflight.log`, `closure-final.log`, and `task-evidence.json`. |
| Live WP6.1 Cucumber | PASS: 12 scenarios, 71 steps; nine UXW-001 contexts and UXW-002–004 each executed with all steps passing. | `evidence/phase1/wp6.1/cucumber-report.json`, `cucumber-run.log`. |
| Focused implementation checks | PASS: typecheck, workspace build/unit tests, API/PostgreSQL tests, migration gate, restricted-role RLS, architecture, Phase 1 contracts, Playwright routes, and pinned toolchain. | Raw logs listed in `evidence/phase1/wp6.1/task-evidence.json`. |
| REM-WP6.1 exact closure and push | Pending. Bind the WP6.1 record to the exact candidate after this progress update, run preflight/final verification, then push the feature branch for CI. | `tools/verify_wp6_1_closure.mjs`; final gate artifacts to be retained in `evidence/phase1/wp6.1/`. |
