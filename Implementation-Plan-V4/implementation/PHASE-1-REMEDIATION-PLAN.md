# Phase 1 Remediation Implementation Plan

**Status:** Superseded for execution; Phase 1 remains In Progress  
**Scope:** Remediate and prove Phase 1 only: kernel, identity, default roles/capacities, privacy/test-data controls, and workspace shell.  
**Authority:** `06-phased-plan.md` WP-1.1–1.9; `03-specification-delta.md`; `03b-evidence-standing-model.md`; `04-architecture.md`; `05-tdd-strategy.md`; `02-decision-register.md`; `AI-Secure-Coding-Policy.md`; Phase 1 features and traceability matrix.  
**Review inputs:** `remediation/Prototype_V4_Phase0_Phase1_Review_and_Remediation_Plan.md` P1-01–P1-12; `docs/PHASE0_VERIFICATION_REPORT.md`; `docs/PHASE0_COMMAND_MAP.md`.  
**Phase 0 baseline:** PASS on `c70d3f439907e5ff37aee3953704e29d899e0032`, CI run 42201289720. The three earlier `/login` connection-refused browser failures are Phase 1 WP-1.9 acceptance work, not Phase 0 failures.

**Status:** Superseded for execution by [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md). Retained as the original reviewed plan for change history.

> This plan does not authorize Phase 2 work. It corrects Phase 1 completion claims, implements the unmet guarantees, and requires verifiable evidence from actual database/API/browser paths. A checked box, a passing mock, or an in-memory demonstration alone is not completion evidence.

## 1. Phase 1 outcome and boundaries

At Phase 1 exit, the project must have a working, tested foundation for later cooperative workflows:

1. Every accepted command is authorized server-side and commits its aggregate state, domain events, outbox rows, and idempotency receipt together, or commits none of them.
2. A repeated command with the same tenant, ID, and payload returns the first committed result. Reusing an ID with a different payload fails explicitly. Concurrent requests cannot apply a command twice or silently overwrite a newer aggregate version.
3. Tenant boundaries hold in application queries and PostgreSQL policies. Tenant scope is transaction-local on pooled connections and is also expressed as explicit predicates.
4. Unknown actions and missing/expired authority are denied. Roles, appointments, capacities, and delegations are derived from trusted persisted records. IFV grant/revoke operations are durable commands and auditable events.
5. Authentication uses one shared API contract, persisted credentials and sessions, authenticated password change, and actual browser-to-API communication. Temporary credentials are single-use, expire (default 72 hours), force password change, and never enter logs/events/receipts as plaintext.
6. PII controls enforce the intended audience boundaries, encrypted identifier storage, blind-index matching, consent/lawful-basis behavior, retention and auditable shredding. Union/TA/institutional responses contain no person-level member PII. Real mode fails closed before readiness if residency is missing or unapproved.
7. Test-mode purge-to-seed is a real, allowlisted, transactional PostgreSQL operation that refuses real/unknown targets and is repeatable. It preserves platform/legal catalogues, restores deterministic seed data, and records durable audit evidence.
8. The workspace is a real served application with tested `/login`, `/components`, shell routes, demo-only controls, and accessibility results from browser navigation to those routes.
9. The mandatory Phase 1 CI command explicitly runs the whole relevant test/build/typecheck/trace/regression set. Missing scripts or checks cannot silently pass.

**Out of scope:** enrolment state machine, evidence item/version workflows and standing engine, full IFV assignment/finding workflow, legal/by-law/governance/meeting feature implementation, guided journeys, offline UI/replay, deployment, Phase 2+, and legacy retirement. Phase 1 may persist and authorize capacity changes, but must not implement Phase 2 IFV evidence workflows. Keep unimplemented modules truthfully marked `not_implemented`.

## 2. Normative specification interpretation

Resolve implementation choices against these rules before coding; if source documents conflict, stop the affected work package and record a decision/clarification in `02-decision-register.md` before changing behavior.

| Area | Binding behavior | Source / constraint |
|---|---|---|
| Commands | Command carries tenant/organization, actor, client command ID, occurred and recorded times, device, expected version, correlation ID, type and payload. Same ID + same payload replays stored result; same ID + changed payload is rejected; stale writes preserve both inputs for reconciliation. State/event/outbox/receipt are one transaction. | `03` §9; AUD-001–004; INV-019/020; feature 09. Use repository naming already established (`tenant_id`/`organization_id`) consistently and document mappings. |
| Audit | Domain events are append-only; UI telemetry is not the business audit trail. Client payload cannot set authority, approval, or verification. | AUD-005/006; INV-018/021; feature 09. |
| Authorization | HARD rules always block. Policy decisions cannot infer permission from absence of a rule. Institutions/union/TA are read-only for cooperative source records. Capacity is scoped, time bounded, revocable; IFV is organisation-bound. Self-conflict compares person identity, not merely account ID. | `03` §2.1/§10; ADR-008/010/020; VER-001/003/006/007; UNI-001; feature 05/09. |
| Privacy | Statutory public inspection is a separate audience and exposes only name, address, occupation, date registered under the approved inspection process; institutional audiences receive aggregates/non-identifying evidence only. Statutory register fields use lawful basis `legal_obligation`; other purposes require recorded consent before entry. | `03` §8, PRV-001–009; O-19; feature 02. Do not use public-inspection rules to justify institutional disclosure. |
| Identifier handling | Test mode accepts only the specified synthetic form. Real-mode NRC format mismatch is advisory, not rejecting; previous-number links and masked citizenship digit are retained, and the digit never drives decisions. | `03` §8 PRV-f/g, PRV-009; feature 02. |
| Retention | Membership data uses the two-year floor pending legal review; transaction facts may remain pseudonymized after PII shredding; retention conflicts are flagged. Never state unresolved legal parameters as legally certified. | `03` §8 PRV-e; O-23; PRV-005/008. |
| Residency | Real-mode startup/readiness is refused when region is not approved. Local development key provider is not production crypto-shredding. No unapproved third-party processor receives personal data. | `03` §8 PRV-f; ADR-014/016. |
| UI | Workspace is route-based, capability gaps remain visible, vocabulary is presenter-controlled, readiness surfaces do not show scores, demo operations stay separate, and seed data is not represented as real. | UXW-001–004; EXT-001; `09-ui-ux-implementation.md`; feature 10. |
| Architecture | Domain remains pure TypeScript without I/O, React, database driver imports, or `any`; adapters own persistence/network; API validates untrusted inputs and maps classified domain errors to HTTP; migrations are forward-only. | ADR-005/006/022; `04`; secure coding policy. |

## 3. Evidence ledger and task status rules

Before implementation, amend `PHASE-1-IMPLEMENTATION.md` so each task has separate fields: **implementation**, **unit-tested**, **integration-tested**, **BDD/UI-tested**, **gate-verified**, with path, exact command, environment, artifact/commit, verifier and date. Mark the existing WP-1.1–1.9 completion claims as **unverified/partial pending re-evidence**; do not erase historical implementation notes. Specifically annotate the review findings:

| Review ID | Remediation target | Completion evidence required |
|---|---|---|
| P1-01, P1-10 | Atomic PostgreSQL command receipt and full command-bus integration | Real PostgreSQL race/replay/fault-injection results, receipt/event/outbox/state assertions |
| P1-02 | Default-deny policy and persisted, scoped authority | Exhaustive policy matrix plus PostgreSQL-backed grant/revoke and forged-identity tests |
| P1-03 | Actual API server, compatible login contract, persisted sessions, password change | API integration and browser/API/database flow with no auth interception |
| P1-04 | Safe database purge-to-seed | Disposable-DB success, refusal, rollback, repeatability, post-purge seed and audit assertions |
| P1-05, P1-06 | Audience-specific privacy and durable privacy operations | Adversarial canary response tests; durable shred/restart; startup residency; persisted consent/retention |
| P1-07, P1-08 | Real routes, mounted demo mode, browser axe | Browser navigation to real route in demo and production modes; mounted demo behavior and bundle exclusion |
| P1-09 | Mandatory whole-project CI gate | Clean-checkout CI output proving each required script ran and failed the job when made to fail |
| P1-11 | Durable capacity grant/revoke and annotations | PostgreSQL state/events queried after commit; revoked actor denied; past finding annotation retained |
| P1-12 | Truthful task ledger | No completion status without linked artifacts matching the status level |

Never change a failing test to match code unless an authoritative spec change is approved first, documented in the decision register, and the scenario/traceability records are updated in the same change. Do not count skipped, pending, `@wip`, mocked-only, or test-only adapter results toward a production-path gate.

## 4. Execution order and dependency gates

| Order | Work package | Depends on | Blocking reason |
|---:|---|---|---|
| 0 | Evidence ledger/toolchain audit | Phase 0 PASS | Prevents false completion and establishes reproducible commands. |
| 1 | Atomic command bus + DB integration (R1) | WP0 | Foundation for all durable mutations. |
| 2 | Default-deny authorization + persisted capacities (R2/R8) | R1 transaction and command model | No mutation path proceeds while an unknown action can be allowed. |
| 3 | Durable privacy and audience boundaries (R3) | R1/R2; existing data schema review | No user/member data handling before controls are real. |
| 4 | Purge-to-seed (R4) | R1 audit/transaction utilities; schema inventory | Must have safe target identity and durable auditing. |
| 5 | API authentication integration (R5) | R1/R2; persisted identity model | Session creation/change/revocation uses durable commands and authority. |
| 6 | Shell/routes/demo/accessibility (R6) | Stable login contract and API | Browser evidence must use actual route and service. |
| 7 | CI/toolchain full gate (R7) | Commands become available incrementally; final after all | Gate must run all delivered behavior from clean checkout. |
| 8 | Phase 1 closeout | all preceding gates | Phase 2 entry is prohibited until closure decision is evidenced. |

Run static/type/architecture checks and focused tests continuously; do not wait until the last package to integrate. CI gate wiring begins in WP0 and gets expanded as suites arrive.

## 5. Work packages

### WP0 — Correct the evidence ledger and establish the Phase 1 gate baseline

**Findings:** P1-09, P1-12; all task claims.  
**Likely paths:** `implementation/PHASE-1-IMPLEMENTATION.md`, root `package.json`, `.github/workflows/ci.yml`, root/workspace `tsconfig*.json`, `tools/verify-trace.ts`, `docs/PHASE0_COMMAND_MAP.md`.

1. Confirm the current HEAD includes the Phase 0 PASS revision and record the actual current working tree/commit. Preserve user-created/untracked evidence; do not clean or overwrite it.
2. Run and record `npm run verify:phase0` on the current commit before Phase 1 changes. This establishes no regression below Phase 0’s verified floor.
3. Inspect all current root/workspace scripts and CI jobs. Replace `--if-present` for mandatory checks with an explicit script or a failing guard. Do not rename legacy `test:ui` semantics without preserving the legacy regression suite.
4. Mark Phase 1 task claims pending until the specific requirement-level path is demonstrated. Record exact existing partial implementations separately from completed remediation.
5. Add an aggregate Phase 1 verification command as the final named command in WP7; do not claim it exists before its definition and contract test exist.

**Tests first:** add/extend `tests/tooling/phase1_scripts.test.ts` to assert every mandatory script resolves to an executable target, the aggregate includes DB/API/BDD/workspace/accessibility/login/trace/legacy checks, and missing targets cause nonzero exit. Prove each condition by temporarily substituting a fixture command that exits nonzero in the script-contract test, not by mutating production files during gate runs.

**Acceptance:** current Phase 0 gate still passes; status ledger distinguishes implementation from each evidence level; existing Phase 1 gate cannot pass by skipping required scripts.

### WP1 — Atomic command transaction, durable receipt, and PostgreSQL command-bus proof

**Findings:** P1-01, P1-10. **Requirements:** AUD-001–004; INV-018–020; SC-016–018; feature 09 AUD-001–006, AUD-014/015.  
**Likely paths:** `packages/domain/src/kernel/*`; `packages/db/src/repositories/*`; migrations under `packages/db`; `packages/db/src/__tests__/*`; testkit contract suite; feature 09 step definitions.

#### Behavior contract

- Reserve a receipt with unique `(tenant_id, command_id)` in the same transaction as optimistic state update, domain event insert, outbox insert and stored serialized result.
- For same ID + canonical same payload, return precisely the previously committed result and write no duplicate state/event/outbox.
- For same ID + different canonical payload, reject `IDEMPOTENCY_KEY_REUSED`; persist no new side effect.
- Concurrent first submissions with the same ID have one winner; the losing request reads and returns the committed receipt only if payload matches.
- A failed write at each boundary rolls back every affected row. Never leave receipt-only, event-only, or state-only outcomes.
- Stale version rejects and preserves both attempted inputs for reconciliation as required by AUD-003; do not silently discard rejected input or overwrite current state.
- Tenant mismatch/cross-tenant access is denied. Set RLS tenant context transaction-locally and retain explicit tenant filters for every read/write.
- Event tenant/aggregate/version and outbox tenant/event references must match the committed aggregate transition.

#### TDD sequence — tests before adapter/code change

1. Extend command-bus unit tests for replay, changed-payload key reuse, denial no-op, stale version/input preservation, tenant mismatch and error classification. First run must fail at behavior assertions while the runner/database/test harness itself passes.
2. Add PostgreSQL integration tests using the project’s chosen deterministic CI PostgreSQL 18 service (or Testcontainers if the project ratifies and uses it consistently). Use isolated schema/database per test run; do not rely on developers’ ambient `DATABASE_URL` or shared database state.
3. Assert actual rows directly after every scenario: aggregate version/state, `domain_events`, `event_outbox`, `command_receipts`, and reconciliation input storage. Verify counts and exact identifiers; do not infer success only from returned result.
4. Add deterministic fault injection at receipt reserve, state write, event insert, outbox insert, and result update/commit boundary. For each failure, verify no partial persisted rows after a fresh connection reads the database.
5. Add barriers/latches for concurrency tests: simultaneous identical IDs/same payload, same ID/different payload, and distinct commands with same expected version. Avoid sleeps as synchronization.
6. Implement receipt repository and transaction API, then rerun the same failing tests to green. Keep transaction ownership explicit so nested repositories use the caller’s transaction connection.
7. Run the repository contract suite against both in-memory and PostgreSQL adapters. Fix the contract assertion so `save_eventAndOutbox_inSameTransaction` reads and asserts both event and outbox tables, not just aggregate state.
8. Enable/execute the real Gherkin AUD scenarios via API/command facade. Steps must call production command handlers/adapters; no step may mutate test state directly to simulate the claimed result.

**Acceptance:** successful and rejected result semantics match feature 09; fault tests prove all-or-nothing persistence; concurrent replay gives one event set and a stable result; architecture gate remains clean; exact integration output is retained.

### WP2 — Default-deny authorization and durable capacity commands

**Findings:** P1-02, P1-11. **Requirements:** VER-001, VER-003, VER-006/007; UNI-001; AUD-006/014; INV-002/011/021/024. **BDD:** feature 05 VER-001–004, VER-015; feature 09 AUD-008/009; feature 10 UNI-001 if in Phase 1 scope per trace.  
**Likely paths:** `packages/domain/src/authz/*`; actor/policy ports; PostgreSQL repositories/projections/migrations; API command context; policy fixtures and `packages/testkit` step definitions.

#### Behavior contract

- Replace arbitrary action strings with a closed canonical action type and structured parameters (e.g. capacity kind is not concatenated into action text).
- Every command maps to an explicit authorization rule. Unknown, missing, malformed, or untrusted authority data yields deny. No default allow.
- Actor role, current appointments, capacity, delegation, scope, expiry, revocation, tenant and person identity come from persisted server-side state. Ignore forged role/capacity headers and client-supplied authority.
- Institutional read-only restrictions apply before action-specific allow rules and cover all source-record, capacity, governance and evidence mutations.
- Grant/revoke have separate explicit authority rules; a Secretary/member cannot revoke merely because a string misses a policy branch. Scope and effective times are checked consistently.
- Self-verification conflicts compare stable `person_id` across accounts and supplier/collector/admitter roles wherever the spec marks the conflict HARD. HARD conflicts always deny; policy-class conflicts must have advisory and blocking variants where specified.
- Capacity grant/revoke execute through the WP1 command bus. Persist capacity projection/event together. Revocation immediately affects subsequent authorization after commit and appends durable annotations to historical findings without deleting or rewriting the original finding.
- Preserve past authority and acts as history; do not rewrite/delete historical events to make a revocation appear retroactive.

#### TDD sequence

1. Turn the policy specification into a reviewed, versioned fixture table: every default role/capacity from `03` §2.1 × relevant action, each expected allow/deny/advise decision, scope, appointment, expiry, delegation and read-only rule. Reviewer signs fixture mapping to spec rows before production changes.
2. Add table-driven tests for every row and negative boundary cases: unknown action; missing actor; forged client role; wrong tenant/org; secretary/member grant and revoke; revoked/expired capacity; expired/out-of-scope delegation; cross-account same-person IFV conflict; each institutional role × every mutating action. A fixture coverage assertion fails if a role/action combination is absent.
3. Test authorization through the command bus: denial causes zero state/event/outbox/receipt side effects except explicitly specified security-attempt audit; the denied attempt must not be recorded as a successful business command.
4. Add PostgreSQL tests for grant, revoke, concurrent revoke/use ordering, persisted scope/expiry and historical annotation. Read from a fresh transaction after commit.
5. Implement canonical identifiers and explicit policy branches, followed by durable capacity handlers/projections through WP1 transaction boundary.
6. Bind VER/AUD/UNI scenarios to the same command facade and trusted persisted fixtures. Include both positive and adversarial cases; do not call the policy function directly from BDD steps.

**Acceptance:** exhaustive matrix default-denies every unlisted action; all permitted cases trace to an explicit rule; actual grant/revoke events and capacity records persist atomically; revoked capacity is unusable immediately after commit; past findings remain and show annotation; no Phase 2 assignment/finding workflow is introduced.

### WP3 — Durable privacy controls, serializers, retention, key lifecycle and residency

**Findings:** P1-05, P1-06. **Requirements:** PRV-001–006, PRV-008/009; INV-014/022; ADR-014–016; feature 02 PRV-001–008/012–014 as assigned to Phase 1.  
**Likely paths:** `packages/domain/src/privacy/*`; key-provider ports/adapters; DB migrations/repositories; `apps/api/src/serialisers/*`; API startup/readiness; structured logger and test scrubbers; BDD feature 02 steps.

#### Behavior contract

- Split output schemas/serializers by audience and purpose. Public register inspection is read-only, logged, and limited to approved statutory fields after the required member/public inspection basis/fee-reference condition. Union/TA/PFI/NABII/VVB/institutional outputs contain only permitted aggregates, capability gaps and non-identifying evidence; no member-level statutory fields.
- Cooperative officer access is purpose/need scoped; own-record and other-member rules follow PRV requirements. Do not make broad role-based disclosure the default.
- Test full serialized HTTP bodies and nested metadata using unique canaries for names, addresses, occupation, email, NRC, phone, sensitive notes, filenames and member-specific text. Scan recursively; assert no canary occurs in prohibited audience output. Pattern scans alone are insufficient.
- Identifiers remain encrypted at rest using injected `KeyProvider`; blind-index normalization is exact and documented, stable for equivalent normalized inputs and different across pepper/key contexts. Duplicate detection opens review; never merges identities silently.
- Events, command receipts, logs, errors, traces and outbox payloads never contain plaintext PII or credentials. Keep only pseudonymous IDs and minimal metadata. Scrubber tests must prove detection, but production behavior must prevent emission rather than rely on scrubbing after the fact.
- `LocalDevKeyProvider` is marked and enforced as local/test-only. Implement a durable provider adapter (persistent wrapped keys or approved KMS-compatible port) for the Phase 1 demonstrable environment; document key custody/rotation, nonce generation, algorithm/version metadata and failure behavior. Do not call an in-memory deletion set crypto-shredding.
- Shredding is a command: identify eligible per-person data keys, destroy/deactivate them durably, persist immutable audit record and resulting pseudonymous state. Restart a fresh process and prove decryption remains impossible while transaction facts/events remain available under pseudonymous IDs. If production KMS is not yet deployed, label adapter limitations clearly and do not claim production deployment readiness.
- Consent is stored per person/purpose before non-statutory PII entry. Statutory fields use `legal_obligation`; withdrawal updates persisted state and triggers retention evaluation. Retention policy entries/version and review flags are durable. Apply the two-year membership floor pending legal validation; transaction records preserve conflict flag and pseudonymized facts.
- Run residency validation as an awaited API startup dependency before binding/listening/readiness. Missing, malformed or disallowed real-mode region exits nonzero and does not accept traffic. Test mode must not falsely claim a production residency location.

#### TDD sequence

1. Add failing service/repository/API tests for audience serializer separation and all canaries. Check nested objects and error responses, not only a selected NRC regex.
2. Add API tests per audience, including public inspection authorization/read-only behavior and fee receipt reference without payment processing. Verify no extra fields through schema allowlists.
3. Add persistent consent/retention tests across fresh DB connections; assert no PII entry without applicable consent/lawful basis and persisted withdrawal/retention events.
4. Add key lifecycle integration test: generate, encrypt, persist wrapped key, decrypt, issue shred, restart adapter/process, fail decrypt with classified error; verify irreversible key state and audit record. Test ciphertext tampering and unknown key failure.
5. Add event/log/receipt/outbox snapshots and recursive scanners using synthetic canaries; assert actual production serializers and logger adapters are exercised.
6. Add startup integration tests that launch app with valid test config, valid approved real region, absent region, and unapproved region. In invalid real-mode cases assert listener is not reachable/readiness false.
7. Implement audience serializers, persistence adapters, durable key lifecycle, retention command and startup gate; keep cryptographic operations behind domain ports and adapters.
8. Bind PRV BDD steps to API/database behavior and use synthetic-only identifiers. Ensure the test-mode examples exactly match the regex specified in `03` and the feature file.

**Acceptance:** no prohibited audience contains any canary; test-only provider cannot be wired in a real-mode process; shred survives restart; real-mode invalid residency prevents readiness; consent/retention/audit are durable; no claim implies counsel or infrastructure certification.

### WP4 — Operational purge-to-seed with target safety

**Finding:** P1-04. **Requirements:** PRV-007, AUD-001/AUD-005, feature 02 PRV-011.  
**Likely paths:** `packages/domain/src/privacy/data-mode-guard.ts` (pure validation only); DB operation under `packages/db` or API/ops adapter; explicit SQL/table registry; seed scripts; root `package.json`; CI disposable DB job.

#### Behavior contract

- Add the documented root `npm run purge:seed` only after the operation exists. It requires explicit `DATA_MODE=test`, a dedicated test DB identity/name/marker and least-privilege credentials. Missing, contradictory, production-like, or unrecognized target metadata refuses before any delete statement.
- Enumerate tenant-owned purge tables in an ordered allowlist reviewed against all migrations/FKs. Never use unreviewed `TRUNCATE ... CASCADE`, `DROP SCHEMA`, or “all tables” discovery. Legal/platform catalogues and capability definitions are preserved and checked against versions/hashes.
- Purge and deterministic reseed run in one transaction. Failure at any purge or seed point restores the pre-run DB state. Repeating after success has the same seed state and does not duplicate rows.
- Create a durable audit event containing actor/service identity, timestamp, validated target identity, operation/version and per-table counts; never include PII values. Audit behavior must coexist with purge policy (preserve audit history or retain the current run outside the tenant tables by explicit design).
- The normal test path uses disposable PostgreSQL; there is no production credential available to the purge job. CLI output must clearly identify refused vs completed operations without exposing connection secrets.

#### TDD sequence

1. Build a schema inventory test from migrations that compares purge allowlist against known tenant-owned tables and explicitly asserts protected catalogue tables are absent from the delete list. New tenant table without a policy entry must fail the test.
2. Add destructive-command unit tests for missing test mode, real mode, wrong DB marker, production-like name/role, absent marker, and unknown DB. Verify zero SQL/delete calls in each refusal.
3. Add disposable-PostgreSQL integration tests with sentinel tenant rows, catalogue rows, existing audit history and deterministic seed rows. Assert exact table counts/content before and after; no tenant data remains; catalogues unchanged; seed content exact; audit committed.
4. Inject failure after each purge/seed stage and prove rollback from a separate connection. Run twice and prove idempotence.
5. Implement allowlisted transaction and target guard; expose script; add CLI output contract test. No command may print or log `DATABASE_URL`/secret values.
6. Add PRV-011 Gherkin step that invokes the actual CLI against the ephemeral DB. It must assert row state and durable audit, not just a service return flag.

**Acceptance:** safe refusal occurs before mutation; successful operation is atomic, repeatable and auditable; protected catalogues remain intact; root script is real and mandatory in the Phase 1 gate.

### WP5 — Persisted authentication and API-to-workspace end-to-end login

**Findings:** P1-03; carryforward from Phase 0 browser run. **Requirements:** ENR-010, ENR-004; INV-021; PRV-004; feature 01 ENR-003/004 only if valid Phase 1 mapping, feature 02 PRV-001/002 where auth privacy applies, feature 10 login acceptance.  
**Likely paths:** `apps/api/src/server.ts` (create/register if still absent), `apps/api/src/routes/auth.ts`, identity repositories/migrations, workspace `LoginPage.tsx`, auth/session client, Playwright config/spec, API tests.

#### Contract and security decisions

- First read current `03`, accepted ADRs, API schemas and feature scenarios. Publish one versioned Zod request/response contract and generate/use the same contract types on client/server. Align identifier semantics (`userId` vs email), credential field names, `forcedChangeRequired`, errors and session transport. Do not create a second mismatched DTO.
- Build a real Fastify server entrypoint, register auth plugin, health/readiness and protected test route, close database pool cleanly. Validate all input with size limits and parameterized database operations.
- Persist credential hashes and used/expiry/forced-change state; enforce atomic single-use under concurrent login attempts. Hash with Argon2id per accepted stack. Never store plaintext password/temp credential, never echo secrets, and never log request bodies containing secrets.
- Persist sessions with secure random opaque tokens stored hashed at rest, expiry/revocation and device/user linkage; establish documented cookie/session/CSRF protections. Do not put long-lived tokens in localStorage. Cookie flags depend on deployment mode and are tested.
- A password-change request requires authenticated session and current credential, validates new password policy, rotates/revokes relevant sessions atomically, clears forced-change status, and does not place secrets in command event/receipt payloads. Implement real accessible form and POST flow, not a GET link.
- Keep in-memory credential/session adapters only under explicit test constructors; production server composition must fail if they are selected.

#### TDD sequence

1. Contract tests first: schema acceptance/rejection, shared request/response typing, error mapping, no secret fields in responses. Include invalid lengths, malformed JSON and rate/resource limits as appropriate.
2. Domain tests: Argon2id verification, temporary credential single-use including simultaneous requests, 72-hour expiry boundary/time injection, forced change, session expiry/revocation, authentication event PII exclusion, password absence from event/receipt/log.
3. API integration with real PostgreSQL: valid login, invalid/expired/used credential, concurrent consume, session-backed protected route, unauthenticated password change denied, password rotation invalidates old session, new credential works. Test each using actual Fastify server + repository.
4. Workspace component tests may cover validation/error rendering, but are supplemental. Playwright must start the real API and workspace with seeded synthetic user and real DB service. Do not intercept/mock `/auth/login` in acceptance tests.
5. Browser scenarios: valid credentials redirect, invalid credentials show safe error, first login forces password update, successful update reaches workspace, refresh retains/validates session, expired/revoked session returns to login. Assert request actually reached API (server-side audit/test correlation ID), no token/credential appears in DOM, logs or URLs.
6. Reproduce original three connection-refused failures in a clean CI-like run, correct server startup/readiness/port coordination, and rerun the exact Playwright spec without weakening assertions or adding arbitrary sleeps. Use health checks and deterministic teardown.
7. Bind BDD authentication steps to live API fixture where the scenarios assert API/product behavior; never treat API mocks as end-to-end evidence.

**Acceptance:** browser login, forced password change, session enforcement, expiration and error paths pass through actual browser/API/PostgreSQL stack; no auth interception in integration suite; old `/login` connection-refused failures are explained by root cause and eliminated.

### WP6 — Real workspace routes, demo panel, accessibility and honest capability shell

**Findings:** P1-07, P1-08; UXW acceptance. **Requirements:** UXW-001–004, EXT-001; Phase 1 assigned BDD UXW-001–004/015.  
**Likely paths:** `apps/workspace/src/App.tsx`, `components-page.ts` or proper route component, shell/demo components, presenters, `tests/workspace/*.spec.ts`, Vite config, Cucumber feature 10.

1. Route and navigation tests first: start the actual Vite workspace server and navigate with Playwright to `/components`, `/login`, and workspace shell route. Assert route-specific title, one h1, landmarks, expected content and no fallback/404. Do not use `page.setContent()` for route-level acceptance.
2. Implement `/components` as a real route in the workspace app or amend the authoritative route specification and all gate references before choosing another route. Preserve the Phase 0 `/components` test intent while making it exercise the app.
3. Mount `DemoPanel` in shell only when `VITE_DEMO=true`. Prove demo controls work (persona switch, reset confirmation, demo date) against test-mode behavior. Prove non-demo UI has no controls and production output omits demo-only component/code through an explicit build-analysis assertion. Exclusion alone is not proof of a working demo mode.
4. Keep capability registry-driven gaps; missing backing modules remain visible and cannot offer invented workflows. Presenter functions remain the single mapping point for user-facing status vocabulary. Add tests against rendered DOM, not only presenter return strings, for snake_case and banned/overclaim phrases.
5. Test keyboard route changes, focus management, reload/back/forward behavior to the level required by enabled Phase 1 scenarios. Run axe on actual served `/components`, `/login`, and workspace shell, with zero violations. Keep a route list in test output so an accidental empty route loop cannot pass.
6. Ensure seeded values are explicitly demo/test and cannot render for a non-demo/non-seed tenant. Check accessible labels, focus, semantic landmarks and error announcements.
7. Run the Phase 1 UXW BDD scenarios against the real workspace where UI behavior is claimed. Retain `@wip` for scenarios whose full behavior belongs to later phases; do not remove tags to inflate the enabled count.

**Acceptance:** real route responses pass; DemoPanel is mounted only in demo mode and proven usable there; production bundle check proves conditional exclusion; axe zero on each required URL; UI displays no invented feature capability or unsupported status.

### WP7 — Complete toolchain/typecheck/CI command and failure-propagation gate

**Finding:** P1-09, supporting P1-01–08/10/11. **Authority:** Phase 0 pins Node 26.7.0, npm 11.19.0, PostgreSQL 18.6; ADR-005 and Phase 0 report.  
**Likely paths:** root `package.json`, workspace scripts/manifests, solution TS configs, `.github/workflows/ci.yml`, Playwright/Cucumber config, migration/seed tools, CI evidence collector.

1. Keep exact runtime pins consistent with `.nvmrc`, package engines, npm lockfile/packageManager, Docker Compose, CI matrix, and docs. Current Phase 0 report records Node 26.7.0/npm 11.19.0/PostgreSQL 18.6; any change requires an ADR and a fresh baseline.
2. Add a TypeScript solution config referencing every new workspace (`packages/domain`, contracts, DB, testkit, API, workspace) and keep legacy TypeScript project separately explicit. Use project references/build order; no `skipLibCheck`/exclude workaround to hide errors unless the existing architectural standard explicitly permits it and the reason is documented.
3. Add explicit scripts for API tests, workspace build/typecheck, command tests, full DB integration, BDD, UI/Playwright, a11y, trace, architecture, privacy/purge nonfunctional tests, and legacy floor. Reconcile `test:ui` with existing legacy runner: use a distinct `test:workspace` or similarly unambiguous name; do not silently replace legacy E2E coverage.
4. Create root `verify:phase1` with a fixed, documented order. It must include `verify:phase0` or the equivalent Phase 0 floor, plus all Phase 1 suites, migrations on clean PostgreSQL 18, API/auth, workspace build/typecheck, BDD/trace, a11y and no-mock login browser tests. It must never include Phase 2 feature claims.
5. Add script contract tests that inspect each invoked command and prove it runs the intended project/spec files. A successful `echo`, no-op target, `--if-present`, empty test discovery, zero enabled scenarios, or swallowed exit code is a gate failure.
6. CI provisions an isolated PostgreSQL 18.6 service/database, readiness-probes it, applies all forward-only migrations from zero, seeds deterministic fixtures, and cleans up in `finally`/job teardown. Service failures must be reported as infrastructure/setup failures, not mislabeled product test failures.
7. CI runs all required checks from a clean checkout on the pinned toolchain. Preserve command, commit SHA, runtime/service versions, suite counts, skipped/pending counts, artifacts and sanitized logs. Mask secrets; never upload `.env`, DB URLs, temp credentials, or PII.
8. Add negative proof: a CI contract test deliberately substitutes a required child command returning nonzero and asserts aggregate fails; another removes/renames a required script in a fixture manifest and asserts preflight fails. This prevents silent gate gaps.

**Acceptance:** one documented command reproduces Phase 1 gate from clean checkout; each mandatory component has nonzero-failure propagation; CI evidence has exact commit/runtime/service and executed counts; legacy baseline remains at or above Phase 0 baseline.

### WP8 — Integrated Phase 1 verification and closure review

1. Run all focused suites after each WP; then run clean migrations and the full `verify:phase1` on a clean checkout/CI run. Run the full legacy `verify:all` separately where its browser setup overlaps; preserve both outputs.
2. Produce a requirement-to-evidence table mapping every Phase 1 REQ/INV/scenario to production implementation, unit test, integration/API/UI test as appropriate, BDD scenario, exact command and CI artifact.
3. Re-run traceability and inspect the enabled/pending/`@wip` report. Every enabled scenario must execute with real step definitions. Report counts by feature and scenario IDs, not just overall green status.
4. Review migration up/replay/rollback safety, transaction ownership, indexes/constraints/RLS, seed determinism, configuration defaults, structured error codes, resource limits, logging redaction, secrets, session cookies/CSRF, and dependency boundary rules.
5. Verify no Phase 2 implementation has leaked in: no enrolment/evidence workflows presented as complete. Capabilities for those remain `not_implemented` and visible.
6. Update `PHASE-1-IMPLEMENTATION.md` with accurate task evidence and gate results; update `docs/PHASE1_VERIFICATION_REPORT.md` and command map with exact CI artifact/run, test counts, skipped tests, migration inventory and deviations. Never overwrite Phase 0 report.
7. Close Phase 1 only by explicit closure record after an independent review of the evidence ledger. If any blocking row is unresolved, Phase 1 remains In Progress and Phase 2 stays frozen.

## 6. Functional TDD standard (mandatory for every remediation)

Every behavior change follows the same auditable loop:

1. **Spec before test:** cite exact REQ, invariant, ADR, Gherkin scenario and source section. Convert ambiguous rules into an accepted decision before asserting behavior.
2. **Observable test first:** write the smallest test at the correct boundary. For DB/API/browser requirements, do not substitute a domain mock. Use synthetic fixtures only. Include expected allow and deny, success and failure, and boundary conditions.
3. **Prove red:** run only the new/changed test and retain output showing it fails at the intended behavior assertion. A compile error, unavailable DB, bad fixture, missing browser, or import failure is not a valid red. If a test cannot run due infrastructure, fix the test environment first and repeat.
4. **Implement minimum faithful behavior:** write production code with no `any`, placeholders, fixed success results, fake repositories in production composition, swallowed errors, broad catches, or hardcoded values/secrets. Input validation, parameterized SQL, transaction boundaries, error classification, structured redacted logging, type safety, and resource limits are mandatory per secure coding policy.
5. **Prove green and regression:** run the focused test, package tests/typecheck, and all dependent suites. Keep assertions unchanged. Refactor only while green; rerun after refactor.
6. **Mutation/negative proof where applicable:** tests should fail if a guard is removed or inverted (default-deny, tenant filter, masking, refusal guard). Use policy-table/mutation tests for high-risk rules; do not count line coverage as evidence of semantics.
7. **Evidence:** record exact commands, Node/npm/PostgreSQL versions, commit, outcomes, skipped count, artifact path and date. A pass without a reproducible artifact is not a gate pass.

No “test” may merely assert a method was called when the requirement is a persisted state transition. No fake implementation may satisfy a BDD scenario claiming a live HTTP/database result. Unit tests may use in-memory adapters for domain logic, but DB contract and external behavior must also be verified with real PostgreSQL/API/browser paths.

## 7. BDD rules and scenario accuracy

1. Gherkin is an executable product contract. Each enabled scenario must assert the actual observable behavior in the feature wording and must not assert a weaker proxy (e.g. static component HTML for a route, mocked fetch for login, returned event object for persisted capacity).
2. Keep `@REQ-*`, `@BDD-*`, `@phase1`, class tags (`@hard`, `@policy`, `@gate`), invariant/SC tags and `@ui` accurate. Trace tool must validate every ID against sources and every enabled step against executable definitions.
3. For hard invariants, run once and assert identical denial/behavior independent of enforcement mode. For policy rules, run advisory and blocking variants as the spec requires; advisory records/labels/findings while blocking rejects the transition. Never make a HARD rule advisory.
4. The acceptance BDD must go through the application/command/API facade. Database-backed scenarios use isolated PostgreSQL. UI scenarios navigate the served workspace. Test setup may seed actors and records through a controlled fixture builder, but the action under test must use the same production service/route/component path as users.
5. Use synthetic people, identifiers, organizations, credentials and data. Do not copy real legal example personal data into fixtures; illustrative by-law structure may be modeled without copying its text.
6. Preserve later-phase scenarios as `@wip` until corresponding workflow exists. Phase 1’s target set is the Phase 1 gate in `PHASE-1-IMPLEMENTATION.md`, with UXW-001–004/015, the specified feature 09, feature 02 privacy/data-mode and applicable feature 05 authorization scenarios. Reconcile the exact selected IDs with `verify:trace`; do not broadly run “not @wip” as proof if later-phase scenarios are intentionally enabled or absent.
7. At gate time report each feature’s total, enabled, passed, failed, skipped/pending, and `@wip` counts. Zero enabled scenarios for a required area is failure.

## 8. Production-ready coding and review standard

- Preserve package boundaries: pure domain rules in `packages/domain`; contracts/schemas in shared contracts where established; persistence in DB adapters; HTTP/session composition in API; presentation and navigation in workspace. No DB imports in domain or workspace.
- Use the repository’s established naming, lint, TypeScript strictness, test conventions, dependency injection, migrations and error types. Do not introduce a parallel pattern when an established abstraction fits; record necessary deviations.
- No `any`, unsafe casts that bypass validation, unchecked client authority, SQL interpolation of untrusted values, dynamic purge-table names from user input, or plaintext secrets/PII in telemetry.
- Parameterize SQL. Validate all external input at API/CLI boundaries and enforce DB constraints for integrity conditions. Use least-privilege service accounts and pool cleanup.
- Make mutation boundaries explicit and atomic. Handle uniqueness/concurrency errors as domain outcomes; never retry a non-idempotent operation blindly.
- Migrations are forward-only, immutable after application, tested on empty and seeded PostgreSQL 18.6, and include required constraints/indexes/RLS. Any schema change includes rollback/failure expectations, compatibility notes, and exact migration test evidence.
- Errors have stable codes, safe client messages and internal structured context without secrets. Logs identify correlation/command/tenant pseudonym where appropriate but omit member identifiers and credentials.
- Configure time, ID generation and crypto randomness through appropriate ports for deterministic tests; production secrets and cryptographic keys come from validated configuration/provider, never source code.
- Bound request body, pagination, query, password work, purge duration/batch size as appropriate. Test resource-limit and shutdown paths.
- UI is semantic, keyboard accessible, responsive to errors, has no misleading readiness score or capability promise, and exposes only presenter-mapped labels.
- Review all changed files for accidental secrets, test bypasses (`test.skip`, `.only`, broad `@wip` removal), ignored assertions, debug endpoints, production test adapters and package drift before merge.

## 9. Phase 1 closure gate

All rows are mandatory; no compensating score or checkbox average. Each row links to exact retained evidence on the exact commit.

| Gate | Required proof |
|---|---|
| Phase 0 foundation | `verify:phase0` PASS at/above baseline on Phase 1 candidate commit; Phase 0 CI artifact retained. |
| Atomicity/idempotency | PostgreSQL command-bus tests cover transaction rollback at every write boundary, concurrent duplicate ID, changed-payload key reuse, stale-version race, event/outbox consistency, tenant isolation. |
| Authorization/capacity | Default-deny exhaustive action matrix; server ignores forged role; every allow is explicit; persisted capacity grant/revoke; revoked actor denied; historical annotation remains; person-level conflict tests. |
| Authentication | Real API/workspace/PostgreSQL Playwright flow; temp credential single-use/expiry/forced change; authenticated password change; session persist/expiry/revoke; original connection refusals fixed; no auth route interception. |
| Privacy | Full-body audience canary tests; no member-level PII for union/TA/institution; public inspection isolated and limited; encrypted IDs/blind index; no PII/credentials in events/logs/receipts; durable shred survives restart; consent/retention persistence; residency startup refusal. |
| Test-data operation | `purge:seed` succeeds only on marked disposable test DB; allowlist reviewed; transaction rollback/failure tests; catalogue preservation; deterministic repeat; durable audit. |
| Workspace | `/components`, `/login`, shell are actual routes; demo mode proven mounted/usable; production demo exclusion proven; capability gaps honest; axe zero on all required live routes. |
| Type/architecture/toolchain | Exact pinned versions; full workspace and legacy type-check; architecture rules pass; no mandatory `--if-present`; all mandatory script targets verified. |
| BDD/trace | All Phase 1 in-scope scenarios pass on real paths; every scenario ID resolves; no missing steps; no enabled scenario without assertions; counts by feature retained. |
| Regression/CI | Clean checkout `verify:phase1` PASS with all required suites, failure propagation tested, evidence includes commit/runtime/DB versions/logs/counts; `verify:all` remains at or above baseline. |
| Scope | No Phase 2 workflow claimed complete; relevant capabilities remain accurately `not_implemented`; no unresolved critical/high Phase 1 finding. |
| Review | Evidence ledger independently reviewed; no known P1-01–P1-12 finding remains open or mislabeled. |

**Closure decision:** status stays **In Progress** until every row has evidence. Only then record Phase 1 PASS and authorize Phase 2 entry under `06-phased-plan.md`.

## 10. Stop conditions

Stop the affected work and keep Phase 1 open if any of these occur:

- Any authorization path falls through to allow, or an actor can provide their own authority claims.
- State, event, outbox, receipt, capacity or purge audit can be partially committed.
- A tenant-scoped query or DB policy can return or mutate another tenant’s row.
- A prohibited audience receives any PII canary, or a real-mode process starts without approved residency.
- Shredded data becomes decryptable after restart, or local in-memory deletion is represented as durable shredding.
- Purge can target production/unknown DB or uses unreviewed cascade deletion.
- Login acceptance can pass with the API mocked, or browser service readiness is nondeterministic.
- Required CI command is missing, skipped, runs zero tests, swallows child failure, or silently downgrades the baseline.
- A Phase 2 behavior is implemented to satisfy a Phase 1 test without explicit scope decision.

## 11. Required Phase 1 implementation artifacts

Upon execution, retain/update:

- `implementation/PHASE-1-IMPLEMENTATION.md` — corrected task/evidence ledger, not a blanket rewrite of history.
- `implementation/PHASE-1-REMEDIATION-PLAN.md` — this execution plan with dated completion evidence appended per WP.
- `docs/PHASE1_VERIFICATION_REPORT.md` — exact commit, environment, commands, counts, outcome, skipped/pending, known limits and artifact links.
- `docs/PHASE1_COMMAND_MAP.md` — exact scripts, target suites, prerequisites and output evidence.
- `02-decision-register.md` — only approved spec/architecture deviations or resolutions to ambiguities.
- Traceability output and CI evidence bundle with sanitized logs; no secrets, `.env`, PII or plaintext credentials.

