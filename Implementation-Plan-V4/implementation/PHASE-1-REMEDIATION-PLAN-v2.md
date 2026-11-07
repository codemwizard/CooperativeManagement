# Phase 1 Remediation Implementation Plan — v2.1 amendment

**Status:** Contract reconciliation required before implementation; Phase 1 remains In Progress  
**Scope:** Remediate and prove Phase 1 only: kernel, identity, default roles/capacities, privacy/test-data controls, and workspace shell.  
**Authority:** `06-phased-plan.md` WP-1.1–1.9; `03-specification-delta.md`; `03b-evidence-standing-model.md`; `04-architecture.md`; `05-tdd-strategy.md`; `02-decision-register.md`; `AI-Secure-Coding-Policy.md`; Phase 1 features and traceability matrix.  
**Review inputs:** `remediation/Prototype_V4_Phase0_Phase1_Review_and_Remediation_Plan.md` P1-01–P1-12; `docs/PHASE0_VERIFICATION_REPORT.md`; `docs/PHASE0_COMMAND_MAP.md`.  
**Phase 0 baseline:** PASS on `c70d3f439907e5ff37aee3953704e29d899e0032`, CI run 42201289720. The three earlier `/login` connection-refused browser failures are Phase 1 WP-1.9 acceptance work, not Phase 0 failures.

**Revision note:** v2 supersedes the initial remediation plan for execution. This v2.1 execution baseline incorporates targeted review clarifications in place, without a wholesale rewrite or change to Phase 1 scope. The v1 document remains historical. WP0 is the next authorized activity; WP1 implementation must not start until WP0 exit sign-off.

**Closure decision/action register:** Use [`PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md`](PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md) as the consolidated queue of owner decisions, WP0 evidence actions, Phase 1 closure actions, and current blockers. The WP0 exit checklist and §9 remain normative acceptance criteria; the register makes their decisions and next steps traceable in one place.

> This plan does not authorize Phase 2 work. It corrects Phase 1 completion claims, implements the unmet guarantees, and requires verifiable evidence from actual database/API/browser paths. A checked box, a passing mock, or an in-memory demonstration alone is not completion evidence.

## 1. Phase 1 outcome and boundaries

At Phase 1 exit, the project must have a working, tested foundation for later cooperative workflows:

1. Every successful command is authorized server-side and commits its aggregate state, domain events, outbox rows, and idempotency receipt together, or commits none of them. An authorized terminal stale/conflict result may atomically persist a safe rejection receipt and protected reconciliation inbox record without changing aggregate/event/outbox state. Authentication/authorization denials before command acceptance do not create a business receipt.
2. A repeated command with the same tenant, command ID, original authenticated actor, and semantic command envelope returns the first committed result. Reuse by a different actor or with a different semantic envelope is rejected without disclosing the stored result. Concurrent requests cannot apply a command twice or silently overwrite a newer aggregate version.
3. Tenant boundaries hold in application queries and PostgreSQL policies. Tenant scope is transaction-local on pooled connections and is also expressed as explicit predicates.
4. Unknown actions and missing/expired authority are denied. Roles, appointments, capacities, and delegations are derived from trusted persisted records. IFV grant/revoke operations are durable commands and auditable events.
5. Authentication uses one shared API contract, persisted credentials and sessions, authenticated password change, and actual browser-to-API communication. Temporary credentials are single-use, expire at the 72-hour default specified in `03` §3.1 (configurable only through the established policy), force password change, and never enter logs/events/receipts as plaintext.
6. PII controls enforce audience boundaries, encrypted identifier storage, blind-index matching, consent/lawful-basis behavior and retention policy. The selected Phase 1 key provider's deletion/shredding behavior is tested and described at its actual maturity; no production-grade key destruction claim is made without an approved provider and deployment configuration. Union/TA/institutional responses contain no person-level member PII. Real-data and production profiles fail closed before readiness if residency or an approved key provider is missing or unapproved.
7. Test-mode purge-to-seed is a real, allowlisted, transactional PostgreSQL operation that refuses real/unknown targets and is repeatable. It preserves platform/legal catalogues, restores deterministic seed data, and records durable audit evidence.
8. The workspace is a real served application with tested `/login`, `/components`, shell routes, demo-only controls, and accessibility results from browser navigation to those routes.
9. The mandatory Phase 1 CI command explicitly runs the whole relevant test/build/typecheck/trace/regression set. Missing scripts or checks cannot silently pass.

**Out of scope:** enrolment state machine, evidence item/version workflows and standing engine, full IFV assignment/finding workflow, legal/by-law/governance/meeting feature implementation, guided journeys, offline UI/replay, deployment, Phase 2+, account recovery, general user administration/provisioning, MFA, external identity federation, and legacy retirement. Phase 1 may persist and authorize capacity changes, but must not implement Phase 2 IFV evidence workflows. Keep unimplemented modules truthfully marked `not_implemented`.

**Decision rule:** WP0 resolves the technical/security contracts before implementation starts. The project owner has directed that owner signatures and legal validations for the approved baseline be assumed granted (2026-11-07); this does not permit unsupported legal claims, invented sources, or broader claims than the validated scope. No agent may choose an arbitrary cryptographic design, replay rule, destructive audit boundary, or authority race behavior merely to satisfy a test.

**Implementation restraint:** no new infrastructure or speculative abstraction without an accepted WP0 decision; implement the smallest design that satisfies the referenced Phase 1 requirement and established architecture. A contract may be comprehensive while its implementation remains deliberately minimal. Do not introduce a reusable framework, service abstraction, or infrastructure component unless an accepted requirement or demonstrated implementation constraint needs it. No opportunistic refactor. Changes outside a task’s permitted paths require a written reason and scope approval before editing. “Application composition path” means the actual configured app/API/database adapters used by the product code under test; it does not mean production hosting or production-grade infrastructure. Use precise path labels: domain path, PostgreSQL integration path, API composition path, browser-to-API path, and production deployment configuration.

## 2. Normative specification interpretation

Resolve implementation choices against these rules before coding; if source documents conflict, stop the affected work package and record a decision/clarification in `02-decision-register.md` before changing behavior.

| Area | Binding behavior | Source / constraint |
|---|---|---|
| Commands | Command carries tenant/organization, actor, client command ID, occurred and recorded times, device, expected version, correlation metadata, type and payload. Same ID + same semantic envelope replays the stored result to the original actor; same ID + changed semantic envelope is rejected; stale writes preserve both inputs for reconciliation. State/event/outbox/receipt are one transaction. | `03` §9; AUD-001–004; INV-019/020; feature 09. Use repository naming already established (`tenant_id`/`organization_id`) consistently and document mappings. WP0.1 classifies each metadata field as immutable logical-command data or per-request transport/trace data. |
| Receipt identity and replay | Unique key is `(tenant_id, command_id)`; receipt also binds actor ID, command type, command schema version, keyed canonical semantic-envelope digest (HMAC-SHA-256), canonicalization version, digest key version, result classification, and a schema-validated safe result representation. Digest input is exactly tenant, authenticated actor, type, schema version, canonical validated payload, and expected aggregate version where applicable. RFC 8785 JCS is used; invalid/ambiguous JSON is rejected. Client `occurred_at`, device identity, trace/correlation/request IDs and server timestamps are attribution/transport metadata and excluded from the semantic digest. `command_id` is lookup identity and not digest input. Same key with changed actor/type/schema/digest is rejected as key reuse. Replay returns the committed result only to the original authenticated actor in that tenant; another actor gets a non-disclosing denial without the stored result. Replay does not re-run the command or depend on current mutation authority, but it must revalidate actor identity/session and tenant ownership. | Owner-approved by supplied decision ruling. Executable vectors remain required before schema/adapter implementation; receipt never stores raw command/request objects or an unkeyed digest vulnerable to guessing. |
| Canonical payload profile | Use RFC 8785 JSON Canonicalization Scheme (JCS) as the sole canonical byte representation, versioned as `jcs-rfc8785-v1`. Reject duplicate object keys before ordinary JSON parsing; reject invalid Unicode/lone surrogates. Do not apply global Unicode normalization: string values are hashed as supplied after schema validation; any semantic field normalization is defined by that command’s versioned schema before canonicalization. Materialize schema defaults before canonicalizing; reject unknown fields. JCS object-key ordering, IEEE-754 number serialization, array order, and omitted-vs-null distinction follow the named standard. Numeric schemas accept only their defined numeric domain; identifiers/precision-sensitive decimals are strings, and integers must be safe integers. | Contract vectors pin behavior and include duplicate-key parser rejection; no adapter may implement its own canonicalization. Store command schema and canonicalization versions in receipt. On retry, use the stored versions; retain old validators/canonicalizers through receipt retention. If a required version is unavailable, fail closed and never execute as a new command. A changed profile requires a new version and compatibility test. |
| HMAC key rotation | Receipt stores the HMAC digest key version. On replay, read that receipt version and compute the candidate digest using the retained verification key for that version; compare constant-time. Keep old verification keys available for at least the maximum receipt retention period. If the required key is unavailable, fail closed with an operationally classified error and alert; never treat it as a new command or silently recompute under the active key. New receipts use the active version. | WP0.1 defines receipt retention duration, the named operational owner for historical key and canonicalizer availability/access, and a retirement procedure requiring evidence that no retained receipt needs the version, approved retirement, and a recovery path for missing material. This is an ownership/operations contract, not authorization to add a key-management subsystem. Key material never resides in receipt rows or logs. |
| Transaction uncertainty and receipt visibility | Database commit outcome is authoritative, not the HTTP response. Receipt reservation, business state, events, outbox and final safe result are written in one database transaction and are invisible to other transactions until commit; no pending or partially populated receipt is a replayable terminal result. A concurrent request encountering the unique `(tenant_id, command_id)` reservation waits for the owner transaction or uses a bounded retry/query strategy. If the owner rolls back, a contender may acquire the reservation and execute; if it commits, the contender reads and validates the committed result. A lost response after commit is resolved by retrying the same identity and reading its committed receipt. Ambiguous commit is resolved by retry/query under the same identity. Serialization/deadlock retries are bounded and never generate a new logical command ID. | WP1.2/WP1.3 inject pre-commit, post-commit-response-loss, ambiguous-commit, reservation contention, owner rollback/commit and retryable transaction failures; verify with independent fresh connections. |
| Command rejection and receipts | Authentication/authorization denial before command acceptance creates no business receipt or command mutation. Record a separate append-only security-attempt observation under a server-generated `security_attempt_id`; tenant, trusted authenticated actor, observed command ID/type, keyed semantic-envelope digest, time and safe denial code are observational metadata only (no raw payload/PII). By default, this observation never reserves or binds `(tenant_id, command_id)` and never changes later authorization or receipt behavior. Only the accepted command receipt, uniquely keyed `(tenant_id, command_id)`, establishes business identity and binds actor/type/schema/digest. A denied request retried by the same or a different actor is evaluated under current authorization; if accepted, it may establish the receipt if the key is still unused. Two authorized actors racing an unseen command ID contend on the receipt transaction: one committed receipt wins; the other may replay only when actor and semantic envelope match, otherwise receives a non-disclosing key-reuse denial. A denied request racing an accepted request cannot reserve or block the receipt. If authorization denies but the required security-attempt audit write fails, perform no command mutation or business receipt and return a generic retryable service-unavailable response rather than claiming the denial was durably audited; alert/record the audit-channel fault and permit retry. Accepted command processing is governed by its receipt transaction and must never bypass authorization because the audit channel failed. If WP0.1 finds an authoritative requirement for permanent pre-acceptance binding, it must explicitly approve that exception, threat model, protections and complete race table before implementation; absent that evidence, the no-binding rule above controls. An authorized command that reaches deterministic terminal evaluation (including stale-version conflict) stores a safe terminal receipt atomically with any reconciliation inbox record, while leaving aggregate/events/outbox unchanged. Its retry returns only the committed terminal result. | WP0.1 ratifies acceptance boundary, server-generated attempt identity, append-only audit shape, audit-failure response/retry behavior, receipt concurrency outcomes and error classes. Pre-acceptance observations and business receipt identity remain separate namespaces. |
| Reconciliation | A stale/conflicting command’s input is retained in a separate encrypted, tenant-scoped reconciliation inbox with its own access policy, retention/deletion policy, and audit metadata. It is not a command receipt, domain event, outbox payload, or arbitrary log entry. Keep only the fields needed to let an authorized user reconcile; classify and encrypt any personal data. Encryption uses the general field-encryption operation of the accepted `KeyProvider` contract; the inbox does not call, depend on, or store blind-index results. Tenant isolation uses the WP1.5 RLS/filter/context boundary. The safe receipt may refer to it using an opaque reconciliation ID only. | AUD-003 requires both inputs preserved; PRV-002/004/005 constrain storage. WP0 resolves exact schema/access/retention and backup semantics; WP1 tests no leakage and persistence. |
| Tenant isolation | Tenant tables are explicitly classified; global catalogues are explicitly identified and read-only/controlled. Test RLS under the actual least-privilege application role, never owner/superuser. Consider `FORCE ROW LEVEL SECURITY` per table where owner bypass would otherwise defeat the stated guarantee. | AUD-004; INV-001; ADR-005/022. |
| Capacity revocation | Authorization is checked inside the same transaction as the protected mutation. The transaction acquires a lock/read that serializes against capacity revocation. A command whose authorization linearizes before revocation may commit before revocation; revocation waits for it. A command linearizing after revocation commit is denied. No command may pass an unlocked stale authority snapshot and commit after revocation. | WP0 ratifies lock/isolation strategy; WP2 tests both serial orders against PostgreSQL. |
| Authorization dependencies | Inventory every mutable fact used to allow a command: platform role, appointment and source/current status, capacity and revocation, delegation and revocation, scope, expiry, tenant membership, person identity/conflict attributes, and any policy/configuration version. The command transaction locks or otherwise serializes against every mutable dependency. Immutable/snapshot-based inputs are documented with their version and effective-time semantics. | WP0.4 produces dependency inventory; WP2 concurrency tests cover each mutable dependency in scope, not only capacity rows. |
| Runtime mode | One authoritative `RUNTIME_PROFILE` selects exactly one of four profiles: `test` (synthetic-only, isolated disposable DB, ephemeral test key, purge only through dedicated role); `demo` (synthetic-only, disposable demo DB, configured demo actors/tenant, development/demo key, no purge); `real-data-staging` (approved residency, persistent least-privilege app role, approved managed key, demo/purge disabled); `production` (production build, approved residency and production key, hardened controls, demo/purge disabled). `APP_ENV`/`DATA_MODE` must match the selected profile. Conflicting or missing profile/config fails startup. | Owner-approved in supplied decision ruling. WP0.11 must prove each actual application startup composition and forbidden mismatch before readiness/mutating DB access. `DATA_MODE`/`VITE_DEMO` alone never establish authorization or deployment safety. |

The minimum accepted profile matrix is:

| Profile | `APP_ENV` | `DATA_MODE` | Database/key/auth composition | Demo/purge |
|---|---|---|---|---|
| Test/demo | `test` | `test` | Isolated disposable database; least-privilege app role; local/test key provider; synthetic identities only. | Demo controls permitted only for authorized test actor and designated demo tenant. A tenant-scoped demo reset is separate from `purge:seed`; purge only via dedicated purge service role. |
| Synthetic development | `development` | `test` | Development database; local adapters; synthetic identities only; no live user/member records. | Demo UI may be enabled only for synthetic test tenant; demo reset is tenant-scoped and cannot invoke `purge:seed`. The guarded purge command remains a separate operation. |
| Real-data staging | `staging` | `real` | Approved residency; persistent least-privilege app role; approved non-test key provider; persistent auth/session controls; redacted logging. | Demo and purge disabled. |
| Production | `production` | `real` | Production build; approved residency and key provider; hardened secrets, sessions, logging and access controls. | Demo and purge disabled. |

All other pairs are rejected at startup until separately ratified. In particular, real data with test/development app environment, local keys or purge credentials is prohibited. `APP_ENV=production` with `DATA_MODE=test` is not an implicit allowed profile; add it only by an approved contract change with explicit controls.
| Audit | Domain events are append-only; UI telemetry is not the business audit trail. Client payload cannot set authority, approval, or verification. | AUD-005/006; INV-018/021; feature 09. |
| Authorization | HARD rules always block. Policy decisions cannot infer permission from absence of a rule. Institutions/union/TA are read-only for cooperative source records. Capacity is scoped, time bounded, revocable; IFV is organisation-bound. Self-conflict compares person identity, not merely account ID. | `03` §2.1/§10; ADR-008/010/020; VER-001/003/006/007; UNI-001; feature 05/09. |
| Privacy policy/legal assumptions | Preserve source, status, reviewer and version for public-inspection rules, fee conditions, lawful-basis mappings and retention parameters. Until a named legal reviewer validates them, store configurable policy assumptions and mark `needs_legal_validation`; do not present them as settled statutory interpretation or make them irreversible. Technical controls (masking, encryption, minimization) remain enforceable regardless. | `03` §8, O-19/O-23, PRV-001–009; decision register legal validation entries. |
| Identifier handling | Test mode accepts only the specified synthetic form. `DATA_MODE=real` NRC format mismatch is advisory, not rejecting; previous-number links and masked citizenship digit are retained, and the digit never drives decisions. | `03` §8 PRV-f/g, PRV-009; feature 02. |
| Retention | Membership data uses the two-year floor pending legal review; transaction facts may remain pseudonymized after PII shredding; retention conflicts are flagged. Never state unresolved legal parameters as legally certified. | `03` §8 PRV-e; O-23; PRV-005/008. |
| Residency | Real-data and production profiles refuse startup/readiness when region is absent or unapproved. Local development key provider is not a production key provider or crypto-shredding control. No unapproved third-party processor receives personal data. | `03` §8 PRV-f; ADR-014/016. |
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
| P1-05, P1-06 | Audience-specific privacy and privacy-operation maturity | Adversarial canary response tests; chosen key provider behavior/limitations; startup residency; persisted consent/retention |
| P1-07, P1-08 | Real routes, mounted demo mode, browser axe | Browser navigation to real route in demo and production modes; mounted demo behavior and bundle exclusion |
| P1-09 | Mandatory whole-project CI gate | Clean-checkout CI output proving each required script ran and failed the job when made to fail |
| P1-11 | Durable capacity grant/revoke | PostgreSQL state/events queried after commit; revoked actor denied; historical findings remain immutable and authority history is derivable without a Phase 2 annotation workflow |
| P1-12 | Truthful task ledger | No completion status without linked artifacts matching the status level |

Never change a failing test to match code unless an authoritative spec change is approved first, documented in the decision register, and the scenario/traceability records are updated in the same change. Do not count skipped, pending, `@wip`, mocked-only, or test-only adapter results toward a production-path gate.

## 4. Execution order and dependency gates

| Order | Work package | Depends on | Blocking reason |
|---:|---|---|---|
| 0 | Baseline and contract reconciliation | Phase 0 PASS | Resolves receipt, inbox, RLS role, revocation race, purge audit, demo authority, privacy/legal assumptions, API/BDD and gate contracts. |
| 1 | Command receipt and transaction foundation (WP1.1–1.3) | WP0.1–0.3; task-level graph | Establishes typed receipt, atomic transaction, replay and concurrency behavior. |
| 2 | Tenant isolation (WP1.5) | WP0.3, WP1.2 | RLS and tenant context must pass before tenant-scoped reconciliation or vault integration. |
| 3 | General field-encryption prerequisite (WP3.2) | WP0.7, WP1.2, WP1.5 | The accepted general field-encryption operation and its local/test provider are established separately from blind-index behavior. WP3.1 audience serializers proceed independently under WP0.7/WP0.9. |
| 4 | Reconciliation inbox (WP1.4) | WP0.2, WP1.1–1.2, WP1.5, WP3.2 | Encrypted storage and tenant isolation are both proven before inbox completion. |
| Parallel after WP1.5 | Default-deny authorization + persisted capacities (WP2) | WP0.4 and each task's graph prerequisites | No mutation path proceeds while unknown action can be allowed; do not wait for WP1.4 if WP2 predecessors pass. |
| 5 | Remaining privacy controls (WP3.3–3.5) | Each task’s contract dependencies | Conditional privacy persistence, key lifecycle, and residency controls proceed only when their actual prerequisites pass. |
| 6 | Purge-to-seed (WP4) | WP0.5; WP1 transaction utilities; schema inventory | Destructive operation cannot start before audit and target boundaries are accepted. |
| 7 | API authentication (WP5) | WP1/WP2; WP0.8–0.10 | Sessions and forced-change restrictions use durable identity and authority. |
| 8 | Workspace integration (WP6) | Route/a11y tests start WP0; protected flows follow WP5 | Browser acceptance exercises actual app and API. |
| 9 | Continuous CI gate (WP7) | Script contract starts WP0, expands at every boundary | Missing integration is found early, not at phase end. |
| 10 | Independent closure (WP8) | All preceding gates | Phase 2 entry only after independent evidence review. |

Run static/type/architecture checks and focused tests continuously; do not wait until the last package to integrate. CI gate wiring begins in WP0 and gets expanded as suites arrive.

**WP1 task-level execution sequence:** follow the graph and execute the reconciliation critical path `WP1.1 → WP1.2 → WP1.3 → WP1.5 → WP3.2 → WP1.4`; execute WP1.6 only after WP1.1–WP1.5 and WP2.2 all have passing records. WP3.1 is a separate serializer/audience task and may proceed independently after WP0.7/WP0.9; it is not an encryption or residency prerequisite. WP3.2 cannot precede WP1.5, and WP1.4 cannot precede WP3.2 or WP1.5. WP2 may proceed in parallel as soon as its own predecessors, including WP1.5, pass. Other work may proceed in parallel only where every listed predecessor has a passing record; the workstream table never overrides task-level gates.

**Verification cadence:** every atomic task runs its focused tests and affected package/type/architecture checks. At each management-workstream boundary, run that workstream's focused integration tests, upstream integration gates and Phase 0 regression gate `npm run verify:phase0` on the exact candidate commit; CI is the normal execution location when the local run is expensive. Run the Phase 1 aggregate at agreed integration milestones and final closure, not automatically after every atomic task. Record exact path/configuration/artifacts. No boundary gate may be omitted or replaced by an undocumented subset.

## 5. Work packages

### WP0 — Correct the evidence ledger and establish the Phase 1 gate baseline

**Findings:** P1-09, P1-12; all task claims.  
**Likely paths:** `implementation/PHASE-1-IMPLEMENTATION.md`, root `package.json`, `.github/workflows/ci.yml`, root/workspace `tsconfig*.json`, `tools/verify-trace.ts`, `docs/PHASE0_COMMAND_MAP.md`.

#### WP0 decision and contract tasks — required before implementation

**Phase boundary:** WP0 produces accepted decisions, contracts, inventories, schemas, executable contract/model vectors, and gate checks. It does not implement the command bus, inbox persistence, tenant RLS rollout, purge endpoint, demo route, authentication/session stack, or final application composition assigned to later work packages. A test that requires one of those not-yet-built product paths is **out of scope for WP0**, not a WP0 blocker. Record that test level as `not_applicable` for the WP0 task and add a `deferred_followups` entry naming the downstream task and its acceptance evidence. Do not claim the downstream behavior passed; its owning task remains responsible for implementing and exercising it before Phase 1 acceptance. Conversely, missing WP0 contract artifacts, mappings, pure/model vectors, or gate checks remain WP0 work and must not be hidden as deferred product tests.

| Task | Bounded objective and authority | Test/evidence first | Exit |
|---|---|---|---|
| WP0.1 Receipt/replay contract | Apply the approved D-01 ruling: semantic envelope is tenant, authenticated actor, command ID/type/schema, canonical validated payload and expected aggregate version where applicable. Use RFC 8785 JCS and HMAC-SHA-256 with key/canonicalization versions. Exclude client `occurred_at`, device identity, request/trace/correlation IDs and server timestamps from digest; preserve attribution separately. Accepted command alone binds `(tenant_id, command_id)`; pre-acceptance denials use a server-generated security-attempt ID, never reserve business IDs. Replay is actor/tenant bound; changed envelope is rejected; terminal accepted stale/conflict result is safe and atomic; security audit failure prevents protected operation and creates no business receipt. | Executable contract/model vectors cover JCS equivalence/rejection; schema/canonicalizer and HMAC-version lookup; changed actor/type/payload; transport-metadata invariance; all denied/accepted/racing actor outcomes; audit failure/retry; rollback/invisible reservation; uncertain commit; safe stale result and redaction. Vectors must exercise the documented oracle and prove each expected decision; a product DB/API path is not required in WP0. | `COMMAND_TRANSACTION_CONTRACT.md` plus passing decision-linked vectors. PostgreSQL contention/rollback and real API redaction are deferred to WP1.1–WP1.3/WP1.6. |
| WP0.2 Reconciliation contract | Apply approved D-02: minimal encrypted inbox fields; current original-actor membership/permission; audited takeover by explicitly authorized tenant reconciliation officer; corrected command gets a fresh ID; lifecycle `open` → `resolved`/`superseded`; policy-configured expiry and separately documented active/replica/backup deletion. Do not invent a universal retention duration or claim cryptographic inaccessibility without proof. | Contract-schema and executable access/lifecycle model vectors cover original actor, permitted officer, unrelated actor/tenant, expiry, takeover audit requirement, tombstone/deletion policy and fresh correction ID. Product encryption, persistence, RLS, replica/backup execution are not expected before their implementation tasks. | `RECONCILIATION_CONTRACT.md` plus passing contract vectors. Inbox/API/DB/crypto implementation-path proof is deferred to WP1.4/WP1.5/WP3.2 and operational acceptance. |
| WP0.3 RLS/application role contract | Apply approved D-03: classify every table tenant/global/control-plane; specify ENABLE+FORCE RLS for every tenant table; define non-owner/non-superuser/no-BYPASSRLS runtime identity, separate migration identity, grants, transaction-local tenant context and explicit predicates. Specify pool reuse/missing-context behavior. | Complete the 53-table classification and proposed grant/policy matrix; contract tests reject unclassified tables, owner/runtime identity conflation, missing FORCE RLS, and missing-context permissive behavior. Live role probes and PostgreSQL RLS/pool tests are downstream implementation evidence. | `TENANT_ISOLATION_CONTRACT.md` and complete reviewable inventory/grant design. Live policies and PostgreSQL probes are deferred to WP1.5/WP7.1. |
| WP0.4 Revocation linearization contract | Apply approved D-04: inventory every mutable authorization dependency (role, appointment/source, capacity, delegation, membership, scope, expiry, person conflict, policy version). Define how every authority-changing path updates actor/tenant authority aggregate/version atomically; protected-command shared lock, authority-change exclusive lock and deterministic order. Document immutable/snapshot inputs. | Complete dependency/change-path inventory and executable model vectors for both serial outcomes and each dependency class; tests reject an unclassified mutable dependency or mutation path. PostgreSQL barrier/race tests are not WP0 evidence. | `AUTHORIZATION_CAPACITY_CONTRACT.md` and passing contract/model vectors. Live serialization and race evidence is deferred to WP2.1/WP2.4. |
| WP0.5 Purge/audit boundary and target identity | Apply approved D-05: test profile only; dedicated purge identity and explicit disposable DB marker; verify DB/schema/connection target and profile before SQL; reviewed table allowlist; no CASCADE/broad truncation; preserve catalogues/audit; reset+seed+success audit atomic; refusal events separate; no production-capable credential. | Record the exact target marker, dedicated role capability boundary and reviewed table allowlist. Unit/preflight tests prove each missing/mismatched input rejects before issuing SQL. Successful purge, transaction rollback and durable audit tests require the later purge implementation. | `PURGE_OPERATION_CONTRACT.md` and passing preflight tests. Database role and execution-path proof is deferred to WP4.1/WP4.2. |
| WP0.6 Demo authority contract | Apply approved D-06: configured synthetic demo actor(s)/tenant and server-side named-command/resource allowlist. Demo actors are not ordinary staff/admin and cannot change real records, access arbitrary tenants or invoke purge. `VITE_DEMO` is presentation-only; missing/conflicting mode denies. Define configuration keys and deny rules without provisioning production identities. | Contract/policy vectors reject production/real-data mode, wrong actor/tenant, forged role, arbitrary target and purge invocation; positive vector allows only the configured synthetic scope. No running API or real tenant is required in WP0. | Approved demo-control contract and passing policy vectors. API authorization and workspace flows are deferred to WP6.2. |
| WP0.7 Privacy requirement and legal assumptions register | Apply approved D-07: preserve lawful-basis distinctions, data minimization, audience boundaries and configurable treatment of legal meanings not individually source-backed. Owner/legal approval is assumed by instruction; no legal claim may exceed the source and mapped scope. Produce the field→purpose/source→entity→command/transition→audience→basis/consent→retention/deletion→scenario map for every WP3.3 candidate. | Traceability assertions ensure uncertain legal meanings remain assumptions and every proposed persisted entity/transition maps to a specific accepted requirement and BDD ID or is explicitly deferred. | `PRIVACY_CONTROL_CONTRACT.md`, complete mapping, and assumption list; technical controls remain testable engineering requirements. |
| WP0.8 Credential lifetime source | Apply approved D-08: exactly 72 hours from server-side issuance, server/database time, single-use, forced password change, no runtime override; changing it requires a decision-register and contract revision. | Injected-clock tests immediately before, exactly at and immediately after 72 hours against the existing credential policy function; audit/redaction assertions. Cite ENR-010 and `03` §3.1. No DB-backed auth path required in WP0. | Source trace, contract rule and passing boundary tests. Persistent credential/session behavior remains assigned to WP5.1–WP5.3. |
| WP0.9 API/BDD/gate contracts | Freeze Phase 1 scenario IDs and shared API contract; create gate contract and script failure-propagation tests. Map every frozen scenario to its owning implementation package and actual required test path. | Prove the manifest is complete and immutable, mandatory scripts resolve, and missing/no-op/zero-test/failing child targets fail the gate. Product scenarios not yet implemented are recorded as scheduled follow-ups; a strict BDD run may expose them but is not a WP0 pass criterion. | Frozen scenario/API/gate contract and passing gate-contract tests. Scenario behavior is tested by its mapped WP1–WP6 task and the final Phase 1 gate. |
| WP0.10 Session security policy | Apply approved D-10: opaque server-side sessions; HttpOnly/Secure/SameSite=Lax/Path=/ cookie; synchronizer CSRF plus Origin validation; rotate at login and privilege/tenant changes; logout revokes current; password change revokes all; independent concurrent sessions; 30-minute idle and 12-hour absolute lifetime; progressive account/source rate delay with generic failure and no permanent lockout; strict forced-change endpoint allowlist; no remember-me bypass. Preserve the D-08 72-hour temporary credential. Password complexity policy is not specified by the supplied ruling and must have an authoritative source before WP5 completes. | Contract matrix and pure policy vectors cover every accepted value, boundary, denial and forced-change route allowlist. Do not require a live session store/API/browser in WP0. | `AUTHENTICATION_CONTRACT.md`, policy matrix and passing contract vectors. Session persistence/API/browser behavior is deferred to WP5.1–WP5.5. |
| WP0.11 Environment mode composition | Apply approved D-11: `RUNTIME_PROFILE` is the single authoritative selector for `test`, `demo`, `real-data-staging`, and `production`; validate `APP_ENV` and `DATA_MODE` against it and deny missing/conflicting settings before readiness or mutating DB access. Specify profile-specific synthetic/real data, key provider, residency, demo and purge rules. | Matrix-driven contract/configuration-function tests cover each allowed profile and every prohibited/mismatched combination. Starting the full app or connecting a mutating DB role is not required while the composition entry point does not exist. | `runtime-mode-matrix.json` v2 plus passing matrix tests. Actual startup/readiness/mutating-role proof belongs to application composition and WP7 CI acceptance. |
| WP0.12 Common evidence record | Define a versioned machine-readable YAML/JSON schema shared by all workstream reports: task ID; independent status fields; commit; environment; commands/results/artifacts; behavior/path/configuration/limitations; reviewer; unresolved decisions. Validate no secret/PII fields or unsafe artifact references. | Schema validation tests include valid sample, missing required field, invalid status, secret-bearing field, and path/command shape. | `evidence/phase1/task-evidence.schema.json` and one checked example; all artifacts consume the same schema. |
| WP0.13 Contract baseline, dependency map and closure-review readiness | Aggregate WP0.1–WP0.12 passing records, approved decisions, sources, contract versions, unresolved question+owner, test IDs/expected outcomes, deferred scope, evidence schema, and Phase 0 gate result. Review every graph edge against a necessary technical/contractual prerequisite; record edge reasons and remove chronology-only edges. Identify a separate independent reviewer before implementation is complete, confirm availability and independence, and record reviewer identity or owner/date/action to resolve availability. The owner has authorized an independent AI review model, subject to the independence conditions in WP8. | Validator rejects WP0.13 completion if any WP0.1–WP0.12 predecessor lacks a passing completion record, if required decisions/artifacts are unresolved, or if graph is cyclic, task IDs are unknown, an edge lacks a requirement/contract/path-based reason, or an edge contradicts implementation boundaries. Reviewer availability/independence and fallback action are recorded; an implementer cannot review their own work. | Owner-approved `PHASE1_CONTRACT_BASELINE.md` plus `evidence/phase1/task-dependencies.yml`, edge rationale, WP0.1–WP0.12 completion evidence, and reviewer-readiness record; WP1 cannot begin before sign-off. |

The accepted WP0.1 contract must contain this state/race table. Under the default model, a pre-acceptance security observation is audit-only and never decides who owns a future command ID:

| Situation | Required outcome |
|---|---|
| Denied attempt; same actor retries | Re-evaluate current authorization; no inherited denial and no ID reservation. |
| Denied attempt; different actor submits same unused ID | Independently evaluate current authorization. If accepted, receipt may establish that actor/envelope; denial observation does not bind the ID. |
| Two actors submit an unused ID concurrently and both are authorized | Unique receipt transaction chooses the committed winner. The loser may replay only if original authenticated actor and semantic envelope match; otherwise non-disclosing key-reuse denial. |
| Denial audit write fails | No command mutation or receipt; return the ratified generic retryable service-unavailable response, alert, and allow retry. |
| Accepted command races a denial observation | Accepted receipt follows its own transaction/identity rules; the security observation cannot block or disclose it. |
| Committed receipt is replayed | Return safe stored result only to the original authenticated actor in that tenant; changed actor/envelope is rejected without result disclosure. |

If WP0.1 approves the exceptional permanent-binding model, it must replace the applicable rows with one coherent, tested policy; mixing observational and authoritative binding outcomes is prohibited.

The initial dependency map must include at least these task edges (the YAML file may add task-local subtasks, but may not remove or weaken these prerequisites):

```yaml
version: 1
tasks:
  WP0.1: []
  WP0.2: [WP0.1]
  WP0.3: []
  WP0.4: []
  WP0.5: [WP0.3]
  WP0.6: [WP0.3]
  WP0.7: []
  WP0.8: []
  WP0.9: []
  WP0.10: []
  WP0.11: []
  WP0.12: []
  WP0.13: [WP0.1, WP0.2, WP0.3, WP0.4, WP0.5, WP0.6, WP0.7, WP0.8, WP0.9, WP0.10, WP0.11, WP0.12]
  WP1.1: [WP0.1, WP0.12, WP0.13]
  WP1.2: [WP1.1, WP0.3]
  WP1.3: [WP1.2]
  WP1.4: [WP0.2, WP1.1, WP1.2, WP1.5, WP3.2]
  WP1.5: [WP0.3, WP1.2]
  WP1.6: [WP1.1, WP1.2, WP1.3, WP1.4, WP1.5, WP2.2]
  WP2.1: [WP0.4, WP1.5]
  WP2.2: [WP1.1, WP1.2, WP1.5, WP2.1]
  WP2.3: [WP2.2]
  WP2.4: [WP0.4, WP2.1, WP2.2, WP2.3]
  WP2.5: [WP2.1, WP2.2, WP2.3, WP2.4]
  WP3.1: [WP0.7, WP0.9]
  WP3.2: [WP0.7, WP1.2, WP1.5]
  WP3.3: [WP0.7, WP1.2]
  WP3.4: [WP0.11, WP3.2]
  WP3.5: [WP0.11, WP3.2, WP3.4]
  WP4.1: [WP0.3, WP0.5, WP1.2]
  WP4.2: [WP4.1, WP1.2]
  WP4.3: [WP4.2, WP0.9]
  WP5.1: [WP0.9, WP0.10, WP0.11, WP1.1]
  WP5.2: [WP5.1, WP1.2]
  WP5.3: [WP0.10, WP5.2, WP2.2]
  WP5.4: [WP5.3, WP6.1]
  WP5.5: [WP5.2, WP5.3, WP5.4]
  WP6.1: [WP0.9]
  WP6.2: [WP0.6, WP2.2, WP6.1]
  WP6.3: [WP6.1]
  WP7.1: [WP0.9, WP0.12]
  WP7.2: [WP1.6, WP2.5, WP3.5, WP4.3, WP5.5, WP6.3, WP7.1]
  WP8: [WP0.13, WP7.2]
```

Dependency review rationale for the corrected edges: `WP1.4` requires `WP1.5` for RLS/tenant filtering and `WP3.2` for the generic encryption operation; it does not depend on blind-index behavior or `WP3.1`. `WP3.2` requires `WP1.5` because the identifier vault must be tested under the accepted tenant boundary; it has no serializer/audience dependency. `WP3.3` requires the WP0.7 requirement map and WP1.2 persistence foundation, but no unconditional WP3.1 serializer or WP3.2 identifier-vault prerequisite; WP0.7 may add a WP3.1 or WP3.2 edge only when a specific mapped requirement demonstrably needs that behavior, and WP0.13 must ratify that edge before execution. `WP4.1` requires `WP0.3` because purge target and role guards rely on the application-role and grant model. `WP5.2` has no identifier-vault dependency, so its former `WP3.2` edge is removed. `WP3.5` does not require conditional consent/retention persistence in `WP3.3` or serializer work in `WP3.1`; residency startup checks use WP0.11, encryption/provider selection (`WP3.2`), and provider lifecycle/composition (`WP3.4`). `WP6.3` uses deterministic synthetic fixtures and does not require WP6.2 demo reset controls, so that edge is removed. `WP6.2` requires `WP2.2` for trusted actor/tenant context. WP0.13 must record and validate the same technical or contractual reason for every other edge; this paragraph does not replace that edge-by-edge review or permit chronology-only edges.

WP0 edge rationale: WP0.2 consumes the accepted command identity/acceptance boundary from WP0.1; WP0.5 and WP0.6 use the role/grant and tenant boundary established in WP0.3; WP0.13 is the aggregate sign-off and therefore requires passing records for every WP0.1–WP0.12 task. Other WP0 decision tasks are independently authorable; WP0.13's gate, not their drafting order, prevents sign-off until each passes. The validator must include and enforce every WP0 ID rather than treating absent graph nodes as implicitly complete.

Update these edges only through a reviewed contract-baseline change. The validator must reject cycles, unknown task IDs, missing predecessors, and execution of a task whose predecessor lacks a passing completion record.

All workstream artifacts use this common record shape (the schema file is authoritative and may add validation constraints):

```yaml
schema_version: 1
task_id: WP1.2
status:
  implementation: complete
  unit_test: passed
  integration_test: passed
  bdd_ui_test: not_applicable
  gate_verified: pending
commit: "<sha>"
environment:
  node: "26.7.0"
  npm: "12.2.0"
  postgres: "18.6"
  database_role: "phase1_app_test; non-owner; non-superuser; no BYPASSRLS"
  data_mode: "test"
  key_provider: "local-test"
commands:
  - command: "<exact command>"
    result: passed
    artifact: "<repo-relative path or CI artifact identifier>"
claims:
  behavior_proved: "<observable result and scenario IDs>"
  path_proved: "<domain/PostgreSQL/API/browser/CLI path and test doubles>"
  configuration_proved: "<relevant runtime, role, mode and flags>"
  coverage_limitations:
    - "<what this evidence does not prove>"
limitations:
  - "<known limitation>"
unresolved_decisions: []
reviewer: "<name or pending>"
```

Artifacts must never include secrets, raw connection strings, credentials, PII, or unrestricted local absolute paths. Use this same record for all task/workstream evidence; narrative reports link to records instead of redefining fields.

After those contracts are accepted:

1. Confirm the current HEAD includes the Phase 0 PASS revision and record the actual current working tree/commit. Preserve user-created/untracked evidence; do not clean or overwrite it.
2. Run and record `npm run verify:phase0` on the current commit before Phase 1 code changes.
3. Inspect all root/workspace scripts and CI jobs. Replace `--if-present` for mandatory checks with an explicit script or failing guard; preserve legacy `test:ui` semantics.
4. Mark Phase 1 task claims pending until the requirement-level application-composition path is evidenced. Record partial implementations separately.
5. Create and continuously expand the aggregate Phase 1 gate; do not defer integration discovery to phase end.

**Tests first:** add/extend `tests/tooling/phase1_scripts.test.ts` to assert every mandatory script resolves to an executable target, the aggregate includes DB/API/BDD/workspace/accessibility/login/trace/legacy checks, and missing targets cause nonzero exit. Prove each condition by temporarily substituting a fixture command that exits nonzero in the script-contract test, not by mutating production files during gate runs. In parallel, start WP3 audience-canary/route contracts and WP5 API/browser contract tests; production implementation still waits on its data/security dependencies. Use established test conventions and tooling. Every WP0 test must resolve a named decision, prevent a specific implementation error, or verify a required gate; record that purpose and expected failure before adding it. Do not build a generalized test framework or duplicate existing tooling solely because contracts are executable.

**WP0 exit checklist — all required before WP1:**

- [ ] `PHASE1_CONTRACT_BASELINE.md` contains approved decisions and authoritative sources, unresolved questions with named owner and blocked/deferred status, accepted contract versions, test IDs and expected results, explicitly deferred matters, dependency map/schema versions, and exact Phase 0 PASS commit/artifact. It is signed by the project decision owner.
- [ ] Security-attempt and business-receipt identity/concurrency semantics are explicit and exercised by deterministic contract/model vectors, including all six race-table outcomes, audit-channel failure/retry behavior, expected atomic visibility, owner rollback/commit outcomes, and prohibition on returning pending/partial receipts. PostgreSQL proof of transaction visibility, rollback, contention and uncertain commit is explicitly deferred to WP1.1–WP1.3. The default attempt-ID-only model does not reserve command IDs; any exception has an authoritative source, threat justification and approved protections.
- [ ] Digest semantics distinguish logical command correlation from per-request trace correlation and explicitly classify `occurred_at` and device metadata; legitimate retries with new request correlation retain the same semantic digest.
- [ ] Reconciliation contract defines generic field encryption without blind-index coupling, required WP1.5 tenant isolation, lifecycle/access rules and policy-owned active/replica/backup expiry. Tests of actual encrypted rows, deletion, tombstones, replicas and restore behavior are assigned to WP1.4/WP1.5 and operational acceptance.
- [ ] WP0 accepts the receipt/canonicalization/HMAC contract, reconciliation lifecycle, RLS table/grant design, authorization dependency/linearization model, purge target/audit preflight, demo policy, key/provider scope, legal assumptions, credential lifetime, session policy, environment matrix, scenario-to-work-package map, evidence schema and justified dependency map. Runtime implementation checks remain with their named downstream tasks.
- [ ] WP0.7 includes a requirement-to-persisted-entity/command/transition/BDD mapping for WP3.3; every unmapped candidate is deferred, and implementation scope is limited to the minimum persistence required by accepted Phase 1 behavior.
- [ ] A separate independent reviewer is identified and available before implementation is complete, or the responsible owner and dated action to resolve availability are recorded. An independent AI review is permitted by owner direction only if it receives the exact candidate and artifacts without relying on implementer reporting, inspects source/evidence, reruns selected critical checks where possible, and reports findings/limitations. The implementer cannot review their own work.
- [ ] Phase 0 `npm run verify:phase0` PASS is rerun and retained on the exact candidate commit; Phase 1 evidence distinguishes WP0 contract/model checks from downstream product-path checks and records downstream work in `deferred_followups`.
- [ ] Common evidence schema and dependency validator execute successfully; the manifest includes WP0.1–WP0.13, WP0.13 cannot pass without all WP0.1–WP0.12 records, the graph is acyclic with known tasks and justified prerequisites, and execution is rejected when any predecessor lacks a passing record. The Phase 1 gate contract detects missing/no-op/zero-test/swallowed-failure scripts.
- [ ] WP0 contract/model vectors execute for command identity/correlation, security-attempt and receipt race outcomes, expected audit/atomicity decisions, reconciliation access/lifecycle/expiry policy, evidence schema, dependency validation, and gate failure propagation; each vector maps to a WP0 decision, implementation risk, or required gate. Product-path integration tests are listed against WP1–WP7 owners and are not WP0 prerequisites.
- [ ] No unresolved P0 decision is delegated to the WP1 implementation agent.

**Acceptance:** current Phase 0 gate still passes; status ledger distinguishes implementation from each evidence level, uses `not_applicable` for product paths outside WP0, and records those paths in `deferred_followups`; WP0 exit checklist is signed; existing Phase 1 gate cannot pass by skipping required scripts. WP1 remains blocked until WP0 contract deliverables and closure review are complete, not until WP1-owned behavior is prematurely implemented.

### WP1 — Atomic command transaction, durable receipt, and PostgreSQL command-bus proof

**Findings:** P1-01, P1-10. **Requirements:** AUD-001–004; INV-018–020; SC-016–018; feature 09 AUD-001–006, AUD-014/015.  
**Likely paths:** `packages/domain/src/kernel/*`; `packages/db/src/repositories/*`; migrations under `packages/db`; `packages/db/src/__tests__/*`; testkit contract suite; feature 09 step definitions.

#### Atomic task breakdown

The workstream is a sequence of independently gated tasks. Do not hand the entire workstream to one implementation pass or start a dependent task while its predecessor lacks a recorded green gate.

| Task | Bounded change | Required red proof | Exact green boundary |
|---|---|---|---|
| WP1.1 Receipt contract/storage shape | Implement only the ratified receipt identity, canonical hash/version, actor binding, and safe-result schema from WP0.1. | Add `packages/domain/src/kernel/__tests__/command-receipt-contract.test.ts`; expected red: canonicalization, actor/type binding or safe-result assertion fails. Command: `npx vitest run packages/domain/src/kernel/__tests__/command-receipt-contract.test.ts`. | Domain receipt contract + migration/type shape only; no dispatch change. Green: same command + `npm run typecheck:v4`. |
| WP1.2 Transaction boundary | Make aggregate, event, outbox and receipt writes share caller-owned transaction; receipt reservation unique. | Add `packages/db/src/__tests__/command-transaction.integration.test.ts`; expected red: fault injection leaves at least one partial row or missing receipt. Command: `npx vitest run packages/db/src/__tests__/command-transaction.integration.test.ts`. | PostgreSQL transaction adapter only. Green: same command on isolated PG18 + `npm run verify:arch`. |
| WP1.3 Idempotency/concurrency/uncertain commit | Implement winner/loser duplicate behavior, optimistic concurrency and bounded transaction retry per accepted contract. | Add `packages/db/src/__tests__/command-bus-concurrency.integration.test.ts`; expected red: duplicate event/result, lost-response retry ambiguity, changed actor/type/payload acceptance, or stale-version overwrite. Command: `npx vitest run packages/db/src/__tests__/command-bus-concurrency.integration.test.ts`. Use barriers, not sleeps. | PostgreSQL command bus only. Green: same command; exactly one event set/result; fresh-connection receipt resolves uncertainty; bounded retry never duplicates effect. |
| WP1.4 Reconciliation | Store stale/conflicting inputs only in the ratified encrypted inbox; enforce ownership, lifecycle, retention, RLS and explicit tenant predicates. Use the general field-encryption operation from WP3.2 `KeyProvider`; do not use or depend on blind-index behavior. | Add `packages/db/src/__tests__/reconciliation-inbox.integration.test.ts`; expected red: stale input leaks into receipt/event/outbox/log, plaintext persists, original actor cannot read, authorized officer cannot take over, unrelated actor/tenant can read, command ID is reused, retention omits tombstone, or cross-tenant access succeeds under the actual app role. Command: `npx vitest run packages/db/src/__tests__/reconciliation-inbox.integration.test.ts`. | Minimal inbox/reconciliation record only; encryption uses the generic field-encryption port and accepted test/local provider; WP1.5 RLS and explicit filters; no case-management UI/workflow. Green: same focused command under least-privilege role, with direct canary assertions proving inbox plaintext is absent from receipts/events/outbox/logs and access/tenant rules hold. No WP3.1 serializer suite is a prerequisite. |
| WP1.5 Tenant isolation | Apply explicit filters, transaction-local context, RLS and role grants to classified tables. | Add `packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts`; expected red: missing/wrong context or pooled reuse exposes cross-tenant row. Command: `npx vitest run packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts`. | PostgreSQL policies and repository filters only. Green: same command under non-owner/non-superuser role + repository contract suite. |
| WP1.6 Application composition/BDD | Route actual product command facade through verified transaction/auth adapters under test application configuration. | Feature 09 mapped scenarios must fail through facade before wiring; BDD setup cannot insert outcome under test. Command: `npm run test:bdd -- --tags "<WP1 IDs frozen in WP0.9>"`. | Test composition/step definitions and required facade wiring only. Green: exact tagged command + `npm run verify:trace` + WP1 PostgreSQL integration suite. |

#### Behavior contract

- Reserve a receipt with unique `(tenant_id, command_id)` in the same transaction as optimistic state update, domain event insert, outbox insert and stored serialized result.
- For same tenant/ID + canonical same semantic envelope + original authenticated actor, return precisely the previously committed result and write no duplicate state/event/outbox.
- For same ID with a different authenticated actor or canonical semantic envelope, reject `IDEMPOTENCY_KEY_REUSED` without disclosing the stored result; persist no new side effect.
- Concurrent first submissions with the same ID have one winner; the losing request reads and returns the committed receipt only if payload matches.
- A failed write at each success-transaction boundary rolls back every affected row. Never leave event/outbox/state committed without the receipt or vice versa. A terminal stale/conflict outcome is a separately classified transaction containing only its safe receipt and reconciliation inbox record; it contains no successful state/event/outbox write.
- Receipt result is a versioned, safe result DTO that allowlists result code, aggregate version, opaque event/aggregate references and non-sensitive outcome fields. It never stores raw request, command payload, exception, or arbitrary response object. Do not expose personal data in receipt results.
- Stale version rejects and preserves both attempted inputs in the separate WP0.2 reconciliation inbox. It is not stored in the receipt/event/outbox/log. Inbox values have field-level encryption, tenant/actor access policy, retention/deletion handling and audit metadata.
- Tenant mismatch/cross-tenant access is denied. Set RLS tenant context transaction-locally and retain explicit tenant filters for every read/write. App integration tests use a dedicated least-privilege role that is neither table owner nor superuser and cannot `BYPASSRLS`; test missing context and wrong context.
- Test tenant context on reused pooled connections in both request orders (tenant A then B and B then A), after rollback and after connection error. No context may persist past its transaction. Apply/test `FORCE ROW LEVEL SECURITY` where owner bypass would undermine the guarantee; table classification distinguishes tenant tables from global catalogues.
- Event tenant/aggregate/version and outbox tenant/event references must match the committed aggregate transition.

#### TDD sequence — tests before adapter/code change

1. Complete WP1.1 contract/type/schema red-green before touching command dispatch.
2. Add PostgreSQL tests under an explicit test application role with isolated test schema/database and no ambient developer DB assumptions. Test role setup must itself assert no superuser/owner/`BYPASSRLS` privileges.
3. Assert actual rows directly after every scenario: aggregate version/state, `domain_events`, `event_outbox`, `command_receipts`, reconciliation inbox, and attempted/refused security audit where specified. Include assertions that pre-acceptance denials do not create business receipts and authorized stale/conflict attempts persist only the safe terminal receipt/inbox. Do not infer persistence from a returned result.
4. Inject deterministic failures at receipt reserve, state write, event insert, outbox insert and result update/commit boundary; fresh connections verify rollback. Inject security-attempt audit write failures; prove denied requests never mutate, return only the ratified generic retryable service-unavailable outcome when mandatory audit cannot commit, and succeed in recording the denial on retry after recovery. Verify accepted commands remain governed by the receipt transaction and are never accepted by bypassing authorization because audit storage failed.
5. Use barriers/latches (never sleeps) for identical duplicate, actor mismatch, payload mismatch and competing expected-version tests.
6. Complete WP1.2 then WP1.3 before WP1.5; keep transaction ownership explicit so repositories use the caller transaction.
7. Complete WP1.5 and prove app-role RLS/pool context first. Then complete WP3.2 (including general field encryption) before beginning WP1.4. WP3.1 serializer/audience tests and implementation remain independently gated and are not a WP1.4 prerequisite.
8. Complete WP1.4 with protected reconciliation data under the WP1.5 app-role RLS boundary; assert pool context cannot leak, including tenant A→B and B→A reuse.
9. Run repository contract suite against in-memory and PostgreSQL adapters; assert actual event and outbox rows in `save_eventAndOutbox_inSameTransaction`.
10. Only after WP1.1–1.5 and WP2.2 pass, wire production command facade and enable real Gherkin scenarios under WP1.6. Steps call handlers/adapters; no direct mutation of outcome rows.

**Acceptance:** receipt/reconciliation contracts are approved; successful/rejected semantics match feature 09; fault tests prove all-or-nothing persistence; concurrent replay gives one event set and a stable safe result; RLS tests use least-privilege role and prove no context leakage; architecture gate remains clean; each atomic task has its own retained evidence.

### WP2 — Default-deny authorization and durable capacity commands

**Findings:** P1-02, P1-11. **Requirements:** VER-001, VER-003, VER-006/007; UNI-001; AUD-006/014; INV-002/011/021/024. **BDD:** feature 05 VER-001–004, VER-015; feature 09 AUD-008/009; feature 10 UNI-001 if in Phase 1 scope per trace.  
**Likely paths:** `packages/domain/src/authz/*`; actor/policy ports; PostgreSQL repositories/projections/migrations; API command context; policy fixtures and `packages/testkit` step definitions.

#### Atomic task breakdown

| Task | Bounded objective and authority | Tests first / expected red | Implementation boundary and green command |
|---|---|---|---|
| WP2.1 Policy matrix | Canonical action IDs and complete role/capacity/action fixture from `03` §2.1, INV-011/024 and feature 09/05. | `packages/domain/src/authz/__tests__/policy-table.test.ts`; unknown/missing action and every role/action row fail against current default-allow. `npx vitest run packages/domain/src/authz/__tests__/policy-table.test.ts`. | Pure domain policy + testkit fixture only; no DB/API changes. Green: same command plus `npm run typecheck:v4`. |
| WP2.2 Trusted authority loading | Server derives identity, appointments, role, memberships, capacity, delegation, expiry and person IDs from DB; rejects forged client claims. | `apps/api/src/__tests__/trusted-actor-context.test.ts`; forged headers, wrong tenant and stale/missing authority must fail against current API composition. `npx vitest run apps/api/src/__tests__/trusted-actor-context.test.ts`. | API auth context and persisted policy read adapters. Green: same focused command + `npm run typecheck:v4` + DB role checks. |
| WP2.3 Capacity grant/revoke persistence | Grant/revoke use WP1 command transaction and explicit rules; immutable event history, current projection. | PostgreSQL tests assert grant/revoke state+events; unauthorized actor yields no mutation; history is durable. | Capacity handlers/repository/migration; never mutate historical findings. Green: `npm run test:db --workspace @symphony/db` plus focused command tests. |
| WP2.4 Authority race and history interpretation | Serialize protected mutation against every mutable dependency from WP0.4; historical finding rows remain unchanged. | Barrier tests for command-first and revoke-first orders across dependencies; assert serial result and unchanged historical finding bytes. | Transaction locks/version checks and read projection only; no finding workflow/annotation table. Green: focused PostgreSQL race suite. |
| WP2.5 BDD and scope closure | Bind authorized/denied scenarios through actual command/API composition and freeze in-scope IDs. | Feature 05 VER-001–004/015 and feature 09 AUD-008/009 use trusted persisted fixtures; fail when steps call policy directly. | Step definitions and test composition only. Green: exact tagged `npm run test:bdd -- --tags "<reviewed WP2 IDs>"`, trace and integration gate. |

Each row must have the common task evidence record and an individual completion report before the next dependency starts.

#### Behavior contract

- Replace arbitrary action strings with a closed canonical action type and structured parameters (e.g. capacity kind is not concatenated into action text).
- Every command maps to an explicit authorization rule. Unknown, missing, malformed, or untrusted authority data yields deny. No default allow.
- Actor role, current appointments, capacity, delegation, scope, expiry, revocation, tenant and person identity come from persisted server-side state. Ignore forged role/capacity headers and client-supplied authority.
- Institutional read-only restrictions apply before action-specific allow rules and cover all source-record, capacity, governance and evidence mutations.
- Grant/revoke have separate explicit authority rules; a Secretary/member cannot revoke merely because a string misses a policy branch. Scope and effective times are checked consistently.
- Self-verification conflicts compare stable `person_id` across accounts and supplier/collector/admitter roles wherever the spec marks the conflict HARD. HARD conflicts always deny; policy-class conflicts must have advisory and blocking variants where specified.
- Capacity grant/revoke execute through the WP1 command bus. Persist capacity projection/event together. Revocation does not update historical findings and does not introduce a finding annotation workflow. Historical findings remain immutable; readers derive authority-at-time and current revocation context from the capacity event history when that view is required by an in-scope Phase 1 test. Do not build the Phase 2 finding workflow to demonstrate this.
- Revocation race rule (ratified in WP0.4): authorization is evaluated under the same transaction/lock boundary as the protected mutation. If the protected command obtains and validates the authority lock first, it may commit before revocation; revocation waits and takes effect afterward. If revocation commits first, a later authorization denies. No command may commit after revocation while relying on an unlocked stale authority read.
- Preserve past authority and acts as history; do not rewrite/delete historical events to make a revocation appear retroactive.

#### TDD sequence

1. Turn the policy specification into a reviewed, versioned fixture table: every default role/capacity from `03` §2.1 × relevant action, each expected allow/deny/advise decision, scope, appointment, expiry, delegation and read-only rule. Reviewer signs fixture mapping to spec rows before production changes.
2. Add table-driven tests for every row and negative boundary cases: unknown action; missing actor; forged client role; wrong tenant/org; secretary/member grant and revoke; revoked/expired capacity; expired/out-of-scope delegation; cross-account same-person IFV conflict; each institutional role × every mutating action. A fixture coverage assertion fails if a role/action combination is absent.
3. Test authorization through the command bus: denial causes zero state/event/outbox/receipt side effects except explicitly specified security-attempt audit; the denied attempt must not be recorded as a successful business command.
4. Add PostgreSQL tests for grant, revoke, both serial orders of concurrent revoke/use, persisted scope/expiry, and historical finding immutability. Read from a fresh transaction after commit; assert revocation adds only capacity history and does not mutate finding rows.
5. Implement canonical identifiers and explicit policy branches, followed by durable capacity handlers/projections through WP1 transaction boundary.
6. Bind VER/AUD/UNI scenarios to the same command facade and trusted persisted fixtures. Include both positive and adversarial cases; do not call the policy function directly from BDD steps.

**Acceptance:** exhaustive matrix default-denies every unlisted action; all permitted cases trace to an explicit rule; actual grant/revoke events and capacity records persist atomically; serial ordering matches the agreed linearization rule; historical findings remain byte-for-byte unchanged; no Phase 2 assignment/finding workflow or annotation schema is introduced.

### WP3 — Privacy controls (management workstream; atomic tasks below)

**Findings:** P1-05/P1-06. **Authority:** PRV-001–009, INV-014/022, ADR-014–016, feature 02 only for scenarios assigned to Phase 1.  
**Likely paths:** `packages/domain/src/privacy/*`, DB privacy adapters/migrations, `apps/api/src/serialisers/*`, API startup/readiness and structured logger. The tasks below are independently gated; no arbitrary cryptographic architecture may be selected to satisfy “durable”.

#### WP3.1 — Audience disclosure and serialization

**Objective:** enforce different audiences and purposes with allowlisted response schemas. Union/TA/PFI/NABII/VVB/institutional output is aggregate/non-identifying only. Public inspection and officer access are separate policies.  
**Red first:** add `apps/api/src/__tests__/masking-serialiser.integration.test.ts`; API tests use unique canaries for name, address, occupation, email, NRC, phone, sensitive notes, filenames and member-specific text; recursively assert absence from institutional responses and exact allowed fields for each audience. Tests must fail against current serializer. Cover nested metadata and error responses. Run `npx vitest run apps/api/src/__tests__/masking-serialiser.integration.test.ts`.  
**Implementation boundary:** serializers/API response schemas only; no retention/key architecture in this task. Public inspection policy remains sourced/configurable and marked `needs_legal_validation` pending legal review.  
**Green gate:** `npx vitest run apps/api/src/__tests__/masking-serialiser.integration.test.ts` passes against API composition; allowlist rejects extra fields; union/TA/institution canaries absent; public inspection is read-only and logs only permitted access metadata. Do not treat legal-policy assumptions as validated law.

#### WP3.2 — Identifier encryption and blind index

**Objective:** prevent plaintext identifier persistence and support duplicate-review matching without decrypting or silently merging.  
**Before implementation:** add a blind-index threat model to `PRIVACY_CONTROL_CONTRACT.md`: exact field-by-field normalization; tenant scope or cross-tenant match policy; fields indexed (no blanket indexing); blind-index HMAC key distinct from encryption key; rotation/re-index rollout and key-version overlap; principals allowed to initiate matching; and exact match produces a duplicate-review candidate only (advisory), never an automatic identity merge or legal identity decision. Document equality leakage and low-entropy guessing risk plus how key access/rate limits reduce it.  
**Red first:** add `packages/db/src/__tests__/identifier-vault.integration.test.ts` and `packages/domain/src/privacy/__tests__/blind-index-contract.test.ts`; inspect actual stored bytes/columns; test normalization, tenant isolation, key separation, rotation/re-index behavior, unauthorized match requests, collision behavior and tamper detection; duplicate opens review and leaves persons separate. Commands: `npx vitest run packages/domain/src/privacy/__tests__/blind-index-contract.test.ts` and `npx vitest run packages/db/src/__tests__/identifier-vault.integration.test.ts`.  
**Implementation boundary:** the accepted `KeyProvider` contract exposes a general field-encryption/decryption operation and a separate blind-index operation. WP1.4 may use only the general field-encryption operation for reconciliation payload fields; it does not consume blind-index APIs or matching policy. Implement only the interface and local/test adapter already authorized by ADR-014; do not add a new KMS/wrapped-key service without a ratified ADR and deployment need. Mark the local adapter non-production and prevent real-data/production composition from claiming it is a production key manager.  
**Green gate:** both focused commands pass on isolated PG18 where applicable; WP3.2 contract tests prove general field encryption/decryption and blind-index APIs are separate, and WP1.4 proves encrypted inbox round-trip through the general operation; stored identifier rows contain ciphertext and scoped blind index only; exact normalized match behavior is deterministic under injected test keys; encryption and HMAC keys are distinct; rotation/re-index procedure is tested; unauthorized match requests fail; wrong key/tamper fails closed; match opens review only; no identifier appears in event/receipt/outbox/log canary scan.

#### WP3.3 — Minimum required privacy-state persistence (conditional scope)

**Objective:** persist only the privacy state and transitions required by the accepted Phase 1 contract and mapped BDD scenarios. Per-person/purpose consent, lawful-basis provenance, withdrawal state, policy versions, and retention evaluation are candidates for implementation, not a blanket feature mandate.
**Scope gate before implementation:** WP0.7 produces a row-by-row and transition-by-transition mapping to an authoritative Phase 1 requirement and named BDD scenario, including the behavior the scenario proves. Implement a field, entity, command, or transition only when that mapping demonstrates it is required. If the source requires only a data-entry condition or retention of a policy reference, implement that minimum. Defer general consent management, broad lawful-basis histories, a consent portal, scheduled retention platform, legal rules engine, and unmapped transitions. Record each deferred item and reason in the contract baseline. If no accepted requirement justifies persistence for one of the candidate categories, do not add it.
**Red first:** add/shape `packages/db/src/__tests__/consent-retention.integration.test.ts` only after the mapping fixes its expected domain behavior. Each DB-backed case must name its requirement and BDD scenario; it proves the required acceptance/rejection or persistence behavior across a fresh connection. Statutory-field policy remains sourced/configurable and is not represented as legally verified until review. Run `npx vitest run packages/db/src/__tests__/consent-retention.integration.test.ts` when at least one mapped persistence requirement exists; otherwise record the task’s evidence as a scope decision with no migration/code change and test the applicable data-entry condition at its existing boundary.
**Implementation boundary:** represent the two-year floor and public inspection/fee rules as versioned, configurable, `needs_legal_validation` policy values only where the accepted Phase 1 requirement needs them. Do not hard-code an irreversible statutory interpretation. Transaction facts retain pseudonymous IDs and conflict flags as specified. No generalized privacy-management subsystem.
**Green gate:** every new persisted field and transition traces to the WP0.7 mapping and passing BDD/integration evidence; no unmapped schema or workflow was introduced; required state is durable/auditable at the specified boundary; policy source/status is queryable where applicable; no unvalidated policy is described as certified or used as a legally settled irreversible rule. A justified no-code/defer outcome is valid evidence when the accepted contract requires no new persistence.

#### WP3.4 — Key lifecycle and shredding decision

**Objective:** establish truthful key deletion semantics without inventing infrastructure.  
**Red first:** add `packages/domain/src/privacy/__tests__/key-provider-lifecycle.test.ts`; tests distinguish process-local key deletion from durable deletion and prove selected adapter behavior across restart. Run `npx vitest run packages/domain/src/privacy/__tests__/key-provider-lifecycle.test.ts`.  
**Implementation boundary:** ADR-014 selects a local implementation now and OpenBao later. Phase 1 therefore requires the existing `KeyProvider` port plus a clearly labeled local/test implementation and a composition guard that refuses it in real-data and production profiles. It does not require inventing a new production key-management architecture or claiming backup-safe cryptographic erasure. A shred operation may only be called “durable” if key destruction state survives restart and the relevant backup/restore model is also addressed; otherwise call it local key deletion and record the limitation. Production KMS and production-grade key custody remain out of scope absent approved ADR/deployment target.  
**Green gate:** focused lifecycle command passes; provider behavior and limitation stated accurately; test-only provider rejected in real-data/production composition; any behavior claimed as durable survives the stated restart/restore test. Phase 1 only requires the ADR-014 local/test provider unless a new provider is explicitly ratified. The Phase 1 report must say production key custody/shredding remains open and the system is not ready for real personal data or production deployment.

#### WP3.5 — Residency and startup enforcement

**Objective:** enforce the accepted real-data/production startup rule before listening/readiness.  
**Red first:** add `apps/api/src/__tests__/residency-startup.integration.test.ts`; launch tests for test mode, approved real region, missing region and unapproved region; invalid real-data/production launch must not bind/listen and readiness must remain false. Run `npx vitest run apps/api/src/__tests__/residency-startup.integration.test.ts`.  
**Implementation boundary:** config validation and API composition; region allowlist/version must come from approved configuration, not hardcoded guesswork.  
**Green gate:** focused startup command passes; startup awaits validation before server bind; errors are classified and contain no secrets; test mode is not misrepresented as a real residency deployment.

#### WP3 integration gate

After each subtask, run its focused unit/integration tests, affected workspace typechecks, `verify:arch`, canary/privacy tests, and relevant BDD IDs. Run full WP3 integration only after the contracts pass. BDD steps call actual API/domain composition and PostgreSQL where persistence is asserted. Synthetic data only; exact enabled/pass/skip counts retained.

### WP4 — Operational purge-to-seed with target safety

**Finding:** P1-04. **Requirements:** PRV-007, AUD-001/AUD-005, feature 02 PRV-011.  
**Likely paths:** `packages/domain/src/privacy/data-mode-guard.ts` (pure validation only); DB operation under `packages/db` or API/ops adapter; explicit SQL/table registry; seed scripts; root `package.json`; CI disposable DB job.

#### Atomic task breakdown

| Task | Bounded objective | Tests first / expected red | Implementation boundary and green command |
|---|---|---|---|
| WP4.1 Target guard and table/audit inventory | Validate test mode, dedicated target identity/marker/schema, purge role, approved connection target, credential isolation, table allowlist and DB-protected audit table under the accepted WP0.3 application-role and grant model. | Add `packages/db/src/__tests__/purge-target-guard.test.ts` plus migration inventory tests; each absent/wrong target field and production-capable credential must fail before first delete call. `npx vitest run packages/db/src/__tests__/purge-target-guard.test.ts`. | Config/preflight and privilege/migration inventory only; no purge writes. Green: focused command + role/privilege integration test on isolated PostgreSQL. |
| WP4.2 Transactional purge/reseed | Execute allowlisted tenant deletion, deterministic reseed and protected success audit atomically. | Add `packages/db/src/__tests__/purge-seed.integration.test.ts`; failure injection proves data and success audit both roll back. | DB operation only; use explicit table registry, no cascade discovery. Green: `npx vitest run packages/db/src/__tests__/purge-seed.integration.test.ts` on disposable PG18. |
| WP4.3 CLI and BDD | Expose root script and bind PRV-011 to actual CLI/database. | Script contract test fails on absent command; Gherkin asserts row contents, preserved catalogue and audit, not return flag. | CLI/seed and BDD glue only. Green: `npm run purge:seed` in disposable DB, tagged Cucumber scenario, script contract and trace. |

All tasks depend on WP0.5 and carry an independent task record. The purge job is provisioned only with dedicated test credentials that are technically incapable of connecting to production.

#### Behavior contract

- Add the documented root `npm run purge:seed` only after the operation exists. It requires explicit `DATA_MODE=test`, a dedicated test DB identity/name/marker and least-privilege credentials. Missing, contradictory, production-like, or unrecognized target metadata refuses before any delete statement.
- Enumerate tenant-owned purge tables in an ordered allowlist reviewed against all migrations/FKs. Never use unreviewed `TRUNCATE ... CASCADE`, `DROP SCHEMA`, or “all tables” discovery. Legal/platform catalogues and capability definitions are preserved and checked against versions/hashes.
- Purge and deterministic reseed run in one transaction. Failure at any purge or seed point restores the pre-run DB state. Repeating after success has the same seed state and does not duplicate rows.
- The successful purge audit ledger is a protected operational table outside the purge allowlist, written atomically in the same database transaction as purge/reseed. It records actor/service identity, timestamp, validated target identity, operation/version and per-table counts, never PII. Rollback removes both purge effects and its success audit row.
- Refused/attempted purge security records are distinct from successful-operation audit. Write them through the WP0-approved control-plane/security logging channel, with best-effort/failure behavior documented. They must never claim success and must not require mutating the target DB before its safety is established.
- The normal test path uses disposable PostgreSQL; there is no production credential available to the purge job. CLI output must clearly identify refused vs completed operations without exposing connection secrets.

#### TDD sequence

1. Build a schema inventory test from migrations that compares purge allowlist against known tenant-owned tables and explicitly asserts protected catalogue tables are absent from the delete list. New tenant table without a policy entry must fail the test.
2. Add destructive-command unit tests for missing `DATA_MODE=test`, `DATA_MODE=real`, wrong DB marker, production-like name/role, absent marker, and unknown DB. Verify zero SQL/delete calls in each refusal.
3. Add disposable-PostgreSQL integration tests with sentinel tenant rows, catalogue rows, existing audit history and deterministic seed rows. Assert exact table counts/content before and after; no tenant data remains; catalogues unchanged; seed content exact; audit committed.
4. Inject failure after each purge/seed stage and prove rollback from a separate connection, including absence of success audit row. Run twice and prove idempotence. Verify the audit ledger survives a successful subsequent purge and is not in the allowlist.
5. Implement allowlisted transaction and target guard; expose script; add CLI output contract test. No command may print or log `DATABASE_URL`/secret values.
6. Add PRV-011 Gherkin step that invokes the actual CLI against the ephemeral DB. It must assert row state and durable audit, not just a service return flag.

**Acceptance:** safe refusal occurs before mutation; successful operation and success audit commit atomically; rollback removes both; refused-attempt records are separate and clearly classified; audit ledger and protected catalogues remain intact; root script is real and mandatory in the Phase 1 gate.
The purge job must have no credential, network identity or role grant capable of connecting to a production database; this is a required technical test and configuration review, not an operational preference.

### WP5 — Persisted authentication and API-to-workspace end-to-end login

**Findings:** P1-03; carryforward from Phase 0 browser run. **Requirements:** ENR-010, ENR-004; INV-021; PRV-004; feature 01 ENR-003/004 only if valid Phase 1 mapping, feature 02 PRV-001/002 where auth privacy applies, feature 10 login acceptance.  
**Likely paths:** `apps/api/src/server.ts` (create/register if still absent), `apps/api/src/routes/auth.ts`, identity repositories/migrations, workspace `LoginPage.tsx`, auth/session client, Playwright config/spec, API tests.

#### Atomic task breakdown

| Task | Bounded objective | Tests first / expected red | Implementation boundary and green command |
|---|---|---|---|
| WP5.1 Shared API contract/server composition | One request/response schema, Fastify entrypoint/plugin/health/readiness and validated config. | `apps/api/src/__tests__/auth-contract.test.ts` rejects mismatch, malformed/oversize fields and unsafe errors; `npx vitest run apps/api/src/__tests__/auth-contract.test.ts`. | Shared schema and server composition only. Green: focused command + API typecheck. |
| WP5.2 Credential persistence/consumption | Argon2id credential hash, 72-hour default, single-use concurrency and no secret persistence. | Existing auth unit tests plus new PostgreSQL auth repository test; concurrent consumption and exact expiry boundaries red. | Identity service/repository/migration. Green: focused domain + DB integration tests and trace. |
| WP5.3 Sessions and forced-change authorization | Persist hashed opaque sessions, policy lifetimes, CSRF, rate limit, logout, rotation, forced-change route allowlist from WP0.10. | API tests assert protected route denied/only password change allowed, then allowed after change; expiry/logout/CSRF/rate boundaries. | API middleware/session repository. Green: `npx vitest run apps/api/src/__tests__/auth-session-policy.test.ts` + PG integration. |
| WP5.4 Workspace login/password UI | Actual accessible login and password-change path calling the shared API. | Playwright fails with real services before integration; assert no route interception and server-side correlation. | Workspace UI/API client only. Green: `npx playwright test tests/workspace/login.spec.ts` with API+workspace+PG. |
| WP5.5 BDD and regression | Enable only reviewed Phase 1 auth scenarios and preserve the three carried-forward login failures as acceptance checks. | BDD/live browser behaviors fail if service is mocked or server unavailable. | Cucumber binding and CI orchestration only. Green: tagged BDD + Playwright + trace. |

Dependencies are enforced by the WP0 task graph; WP5 cannot implement persistence before WP1 and cannot pick session settings before WP0.10.

#### Contract and security decisions

- First read current `03`, accepted ADRs, API schemas and feature scenarios. Publish one versioned Zod request/response contract and generate/use the same contract types on client/server. Align identifier semantics (`userId` vs email), credential field names, `forcedChangeRequired`, errors and session transport. Do not create a second mismatched DTO.
- Build a real Fastify server entrypoint, register auth plugin, health/readiness and protected test route, close database pool cleanly. Validate all input with size limits and parameterized database operations.
- Persist credential hashes and used/expiry/forced-change state; enforce atomic single-use under concurrent login attempts. Hash with Argon2id per accepted stack. Never store plaintext password/temp credential, never echo secrets, and never log request bodies containing secrets.
- Persist sessions with secure random opaque tokens stored hashed at rest, expiry/revocation and device/user linkage; establish documented cookie/session/CSRF protections. Do not put long-lived tokens in localStorage. Cookie flags depend on deployment mode and are tested.
- Any session with `forcedChangeRequired=true` is server-side restricted from every protected application/API route except the password-change route (and explicitly public health/login routes). A UI redirect is not the control.
- A password-change request requires authenticated forced-change session and current credential, validates new password policy, rotates session identifier to prevent fixation, revokes or rotates prior sessions according to the WP0 auth contract, clears forced-change status atomically, and does not place secrets in command event/receipt payloads. Implement real accessible form and POST flow, not a GET link.
- Define and test logout/session revocation, CSRF behavior for cookie-authenticated unsafe methods, and brute-force/rate-limiting behavior. Use deterministic limits/configuration and classified errors; do not silently omit these from acceptance.
- Keep in-memory credential/session adapters only under explicit test constructors; production server composition must fail if they are selected.

#### TDD sequence

1. Contract tests first: schema acceptance/rejection, shared request/response typing, error mapping, no secret fields in responses. Include invalid lengths, malformed JSON and rate/resource limits as appropriate.
2. Domain tests: Argon2id verification, temporary credential single-use including simultaneous requests, ratified lifetime boundary/time injection, forced change, session expiry/revocation, authentication event PII exclusion, password absence from event/receipt/log.
3. API integration with real PostgreSQL: valid login, invalid/expired/used credential, concurrent consume, normal protected route denied for forced-change session, password-change route allowed, successful change lifts restriction, old/rotated session rejected, logout revocation, CSRF and configured rate-limit behavior. Test via actual Fastify server + repository.
4. Workspace component tests may cover validation/error rendering, but are supplemental. Playwright must start the real API and workspace with seeded synthetic user and real DB service. Do not intercept/mock `/auth/login` in acceptance tests.
5. Browser scenarios: valid credentials redirect, invalid credentials show safe error, first login forces password update, successful update reaches workspace, refresh retains/validates session, expired/revoked session returns to login. Assert request actually reached API (server-side audit/test correlation ID), no token/credential appears in DOM, logs or URLs.
6. Reproduce original three connection-refused failures in a clean CI-like run, correct server startup/readiness/port coordination, and rerun the exact Playwright spec without weakening assertions or adding arbitrary sleeps. Use health checks and deterministic teardown.
7. Bind BDD authentication steps to live API fixture where the scenarios assert API/product behavior; never treat API mocks as end-to-end evidence.

**Acceptance:** browser login, forced password change, session enforcement, expiration and error paths pass through actual browser/API/PostgreSQL stack; no auth interception in integration suite; old `/login` connection-refused failures are explained by root cause and eliminated.

### WP6 — Real workspace routes, demo panel, accessibility and honest capability shell

**Findings:** P1-07, P1-08; UXW acceptance. **Requirements:** UXW-001–004, EXT-001; Phase 1 assigned BDD UXW-001–004/015.  
**Likely paths:** `apps/workspace/src/App.tsx`, `components-page.ts` or proper route component, shell/demo components, presenters, `tests/workspace/*.spec.ts`, Vite config, Cucumber feature 10.

#### Atomic task breakdown

| Task | Bounded objective | Tests first / expected red | Implementation boundary and green command |
|---|---|---|---|
| WP6.1 Real routes and accessible shell | `/components`, `/login`, and workspace shell are real routes, with route/navigation/focus behavior. | `tests/workspace/routes.spec.ts` navigates actual served app and fails on missing/fallback routes; no `page.setContent()`. | Workspace route components/router only. Green: `npx playwright test tests/workspace/routes.spec.ts` + axe against the served URLs. |
| WP6.2 Demo controls and server authorization | Mount demo UI only under build flag and enforce reset authorization on server independent of flag. | UI positive/negative tests plus API denial tests for prod, missing marker, wrong actor, wrong tenant; verify zero data mutation and purge never called. | Demo UI + minimal explicit API guard only; no generalized demo service framework. Green: focused Playwright/API tests + production bundle assertion. |
| WP6.3 Capability and presentation acceptance | Capability gaps and supported vocabulary are honest in rendered UI. | Rendered-DOM assertions fail on snake_case/banned terms, missing gaps, invented actions or seeded values in non-demo tenant; use an explicit synthetic fixture/profile and do not require WP6.2 reset controls. | Existing presenters/components only. Green: feature 10 assigned scenarios, axe and trace. |

WP6.1 and WP6.3 contract tests can start in WP0. WP6.3 uses its own deterministic synthetic fixtures and does not depend on demo reset or WP6.2. Protected login integration waits for WP5. Demo server guard depends on WP0.6 and cannot call WP4 purge operation.

1. Route and navigation tests first: start the actual Vite workspace server and navigate with Playwright to `/components`, `/login`, and workspace shell route. Assert route-specific title, one h1, landmarks, expected content and no fallback/404. Do not use `page.setContent()` for route-level acceptance.
2. Implement `/components` as a real route in the workspace app or amend the authoritative route specification and all gate references before choosing another route. Preserve the Phase 0 `/components` test intent while making it exercise the app.
3. Mount `DemoPanel` in shell only when `VITE_DEMO=true`. Prove demo controls work (persona switch, reset confirmation, demo date) against test-mode behavior. Prove non-demo UI has no controls and production output omits demo-only component/code through an explicit build-analysis assertion. `VITE_DEMO` is only a presentation/build flag, never authorization. Every demo/reset API operation is refused server-side unless an explicit authorized test/demo server environment, actor, and demo tenant are present; it cannot call purge or mutate a non-demo tenant. Exclusion alone is not proof of a working demo mode.
   - Add live API negative tests for production configuration, unauthenticated/unauthorized actor, absent test/demo marker, and a non-demo tenant. Assert no database row changes and no purge is invoked. The positive demo reset test uses only disposable test data and the dedicated demo tenant.
4. Keep capability registry-driven gaps; missing backing modules remain visible and cannot offer invented workflows. Presenter functions remain the single mapping point for user-facing status vocabulary. Add tests against rendered DOM, not only presenter return strings, for snake_case and banned/overclaim phrases.
5. Test keyboard route changes, focus management, reload/back/forward behavior to the level required by enabled Phase 1 scenarios. Run axe on actual served `/components`, `/login`, and workspace shell, with zero violations. Keep a route list in test output so an accidental empty route loop cannot pass.
6. Ensure seeded values are explicitly demo/test and cannot render for a non-demo/non-seed tenant. Check accessible labels, focus, semantic landmarks and error announcements.
7. Run the Phase 1 UXW BDD scenarios against the real workspace where UI behavior is claimed. Retain `@wip` for scenarios whose full behavior belongs to later phases; do not remove tags to inflate the enabled count.

**Acceptance:** real route responses pass; DemoPanel is mounted only in demo mode and proven usable there; production bundle check proves conditional exclusion; axe zero on each required URL; UI displays no invented feature capability or unsupported status.

### WP7 — Complete toolchain/typecheck/CI command and failure-propagation gate

**Finding:** P1-09, supporting P1-01–08/10/11. **Authority:** Node 26.7.0 and npm 12.2.0 are the active owner-directed toolchain pins; historical Phase 0 artifacts record npm 11.19.0. PostgreSQL 18.6 is the CI service version; ADR-005 and retained CI evidence.
**Likely paths:** root `package.json`, workspace scripts/manifests, solution TS configs, `.github/workflows/ci.yml`, Playwright/Cucumber config, migration/seed tools, CI evidence collector.

#### Atomic task breakdown

| Task | Bounded objective | Tests first / expected red | Implementation boundary and green command |
|---|---|---|---|
| WP7.1 Gate command contract | Explicit scripts/solution typecheck/phase1 aggregate; no silent skips and failure propagation. | `tests/tooling/phase1_scripts.test.ts` verifies target scripts, intended files and failing child propagation. | Root/workspace manifests and TS configs. Green: script contract + `npm run typecheck:v4` + `verify:arch`. |
| WP7.2 CI composition/evidence | Clean-checkout CI runs all Phase 1 suites with pinned versions, PG role/config and artifact schema. | CI fixture proves missing command, zero discovery and child failure fail the job; service health failure classified separately. | Workflow/evidence collection only, no product bypass. Green: full `verify:phase1` CI artifact validates against WP0.12 schema. |

WP7 begins in WP0 and is expanded at each integration boundary; it is not deferred until product work is complete.

1. Keep exact runtime pins consistent with `.nvmrc`, package engines, npm lockfile/packageManager, Docker Compose, CI matrix, and docs. Active pins are Node 26.7.0/npm 12.2.0; historical Phase 0 reports record npm 11.19.0 and remain unchanged. The owner directed the new active npm pin on 2026-11-07; the Phase 0 gate must be rerun under the active pins before WP0.13 closure.
2. Add a TypeScript solution config referencing every new workspace (`packages/domain`, contracts, DB, testkit, API, workspace) and keep legacy TypeScript project separately explicit. Use project references/build order; no `skipLibCheck`/exclude workaround to hide errors unless the existing architectural standard explicitly permits it and the reason is documented.
3. Add explicit scripts for API tests, workspace build/typecheck, command tests, full DB integration, BDD, UI/Playwright, a11y, trace, architecture, privacy/purge nonfunctional tests, and legacy floor. Reconcile `test:ui` with existing legacy runner: use a distinct `test:workspace` or similarly unambiguous name; do not silently replace legacy E2E coverage.
4. Create root `verify:phase1` with a fixed, documented order. It must include `verify:phase0` or the equivalent Phase 0 floor, plus all Phase 1 suites, migrations on clean PostgreSQL 18, API/auth, workspace build/typecheck, BDD/trace, a11y and no-mock login browser tests. It must never include Phase 2 feature claims.
5. Add script contract tests that inspect each invoked command and prove it runs the intended project/spec files. A successful `echo`, no-op target, `--if-present`, empty test discovery, zero enabled scenarios, or swallowed exit code is a gate failure.
6. CI provisions an isolated PostgreSQL 18.6 service/database, readiness-probes it, applies all forward-only migrations from zero, seeds deterministic fixtures, and cleans up in `finally`/job teardown. Service failures must be reported as infrastructure/setup failures, not mislabeled product test failures.
7. CI runs all required checks from a clean checkout on the pinned toolchain. Preserve command, commit SHA, runtime/service versions, suite counts, skipped/pending counts, artifacts and sanitized logs. Mask secrets; never upload `.env`, DB URLs, temp credentials, or PII.
8. Add negative proof: a CI contract test deliberately substitutes a required child command returning nonzero and asserts aggregate fails; another removes/renames a required script in a fixture manifest and asserts preflight fails. This prevents silent gate gaps.

**Acceptance:** one documented command reproduces Phase 1 gate from clean checkout; each mandatory component has nonzero-failure propagation; CI evidence has exact commit/runtime/service and executed counts; legacy baseline remains at or above Phase 0 baseline.

### WP8 — Independent Phase 1 closure review

WP0.13 identifies the separate independent reviewer and records availability/independence before implementation is complete. The owner has amended the review model to permit a separate AI review session/model that did not implement the work or produce primary evidence. Independence is process-based: the reviewer must not have authored implementation changes, tests, primary evidence, or the implementation agent's acceptance conclusions. A clean context by itself is insufficient if the reviewer participated in that work. Record the reviewer model/provider and separate session identifier, exact candidate commit, review scope, and a declaration that the reviewer had no role in implementation or primary-evidence production. Provide repository access so the reviewer can inspect source and evidence; repository access does not compromise independence. Give the reviewer the requirements, candidate commit, and verification commands, but request an independent assessment rather than a target verdict. The reviewer inspects source and raw retained results, reruns selected critical checks where possible, and reports findings, limitations, and unverified claims in their own words. The owner records the review artifact and disposition. If reviewer availability changes, record a replacement and repeat the independence check. This is independent AI review, not legal, regulatory, or external-auditor assurance.

If a qualifying independent reviewer is not available, implementation work and automated gates may be recorded as passed, but formal Phase 1 closure remains **pending independent review** and Phase 2 remains frozen. Do not substitute self-review or the implementation report for independent review. AI review does not constitute legal or regulatory approval.

1. Inspect the evidence ledger against the actual source tree and CI artifacts, not only implementation reports.
2. Independently rerun or validate selected critical tests: transaction rollback/replay, RLS with app role, default-deny/revocation race, forced-change API restriction, privacy canary response, purge refusal/rollback and real browser login. Record which were rerun and environment.
3. Inspect all changed migrations and security-sensitive code, including privilege grants, policy defaults, secret/log handling, session/CSRF/rate limiting, demo server guards and purge table allowlist.
4. Verify no tests were weakened, skipped, marked pending, or reclassified to obtain a pass. Inspect `test.skip`, `.only`, tag changes, expected-count changes, empty test discovery and CI conditionals.
5. Verify every Phase 1 requirement has the appropriate evidence path and that claims do not exceed the tested path/configuration. Review every unresolved limitation/deviation and its owner.
6. Sign a closure decision with reviewer name/date, commit, artifacts inspected, tests independently rerun, findings, accepted limitations and Phase 2 entry recommendation. If any blocking row is unresolved, Phase 1 remains In Progress and Phase 2 stays frozen.

## 6. Atomic task execution and functional TDD standard

WP1–WP7 are management workstreams, not implementation-sized handoffs. Each workstream must be decomposed into atomic tasks before assigning an implementation agent. Use IDs such as `WP1.1`, `WP1.2` and `WP3.1`; one task should have one behavior boundary and an independently runnable focused gate. No task may start while its predecessor's completion report is missing.

Every atomic task entry in the work log must include all of these fields before code is changed:

| Field | Required content |
|---|---|
| Task and bounded objective | One observable behavior to establish; explicit in/out scope. |
| Authority | Exact REQ/INV/ADR, specification section, BDD scenario ID and review finding addressed. |
| Permitted files/modules | Exact expected source/test/config paths; explain any additional path before editing it. |
| Test-first plan | Exact test file(s), exact command, expected red assertion and why current behavior is wrong. |
| Implementation boundary | Adapter/domain/API/UI boundary; prohibited shortcuts and dependency constraints. |
| Green verification | Exact focused command, affected typecheck/architecture command, regression command and required result/count. Add missing scripts explicitly rather than using vague command names. |
| Evidence/completion report | Commit, environment, actual red/green output, result artifact, passed/failed/skipped counts, files changed, reviewer, unresolved limits/deviations. |

If the exact test command or expected assertion cannot be named before implementation, the task is not ready. Tests do not have to use a prescribed filename if repository conventions differ, but the actual path and command must be stated in its task record before code changes.

### Required workstream artifacts

Each artifact is concise and becomes the authoritative handoff to the next workstream; include machine-readable contract fields where useful, not copied implementation logs.

| Workstream | Required output |
|---|---|
| WP0 | `docs/phase1/PHASE1_CONTRACT_BASELINE.md`, `evidence/phase1/task-evidence.schema.json`, `evidence/phase1/task-dependencies.yml` |
| WP1 | `docs/phase1/COMMAND_TRANSACTION_CONTRACT.md` and transaction/RLS evidence |
| WP2 | `docs/phase1/AUTHORIZATION_CAPACITY_CONTRACT.md` and versioned policy matrix |
| WP3 | `docs/phase1/PRIVACY_CONTROL_CONTRACT.md` and legal-policy assumptions register |
| WP4 | `docs/phase1/PURGE_OPERATION_CONTRACT.md` and destructive-operation test evidence |
| WP5 | `docs/phase1/AUTHENTICATION_CONTRACT.md` and browser/API/database evidence |
| WP6 | `docs/phase1/WORKSPACE_ACCEPTANCE_REPORT.md` with tested routes/modes |
| WP7 | `docs/PHASE1_COMMAND_MAP.md` and clean-checkout CI evidence |

### Test-first loop

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

Every evidence row and every claim in the verification report must have four explicit statements:

| Evidence field | Required statement |
|---|---|
| Behavior proved | Exact guarantee observed, including assertion/result and scenario IDs. |
| Path proved | Exact layer/composition exercised (domain, repository, API, browser, CLI); identify test doubles, if any. |
| Configuration proved | Node/npm/PostgreSQL versions, DB role/privileges, environment mode, key provider, relevant feature flags and server composition used. |
| Coverage limitation | What was not exercised (e.g. production KMS, hosted deployment, legal validation, all API routes). No evidence may imply a broader guarantee. |

| Gate | Required proof |
|---|---|
| Phase 0 foundation | `verify:phase0` PASS at/above baseline on Phase 1 candidate commit; Phase 0 CI artifact retained. |
| Atomicity/idempotency | PostgreSQL command-bus tests cover transaction rollback at every write boundary, concurrent duplicate ID, changed-payload key reuse, stale-version race, event/outbox consistency, tenant isolation. |
| Authorization/capacity | Default-deny exhaustive action matrix; server ignores forged role; every allow is explicit; persisted capacity grant/revoke; serial ordering matches contract; historical findings remain immutable; person-level conflict tests. |
| Authentication | Browser-to-API path through workspace and API composition backed by PostgreSQL; temp credential single-use/expiry/forced change; authenticated password change; session persist/expiry/revoke; original connection refusals fixed; no auth route interception. |
| Privacy | Full-body audience canary tests; no member-level PII for union/TA/institution; public inspection isolated with pending legal assumptions labeled; encrypted IDs/blind index; no PII/credentials in events/logs/receipts; selected key adapter behavior accurately tested and stated (no production-shred claim without production provider); only WP0.7-mapped consent/retention persistence; residency startup refusal. |
| Test-data operation | `purge:seed` succeeds only on marked disposable test DB; allowlist reviewed; transaction rollback/failure tests; catalogue preservation; deterministic repeat; durable audit. |
| Workspace | `/components`, `/login`, shell are actual routes; demo mode proven mounted/usable; production demo exclusion proven; capability gaps honest; axe zero on all required live routes. |
| Type/architecture/toolchain | Exact pinned versions; full workspace and legacy type-check; architecture rules pass; no mandatory `--if-present`; all mandatory script targets verified. |
| BDD/trace | All Phase 1 in-scope scenarios pass on real paths; every scenario ID resolves; no missing steps; no enabled scenario without assertions; counts by feature retained. |
| Regression/CI | Clean checkout `verify:phase1` PASS with all required suites, failure propagation tested, evidence includes commit/runtime/DB versions/logs/counts; `verify:all` remains at or above baseline. |
| Scope | No Phase 2 workflow claimed complete; relevant capabilities remain accurately `not_implemented`; no unresolved critical/high Phase 1 finding. |
| Review | Named non-implementer independently inspected source/artifacts, re-ran selected critical checks, checked test/gate integrity, signed limitations and phase-entry recommendation; no known P1-01–P1-12 finding remains open or mislabeled. |

**Closure decision:** status stays **In Progress** until every row has evidence. Only then record Phase 1 PASS and authorize Phase 2 entry under `06-phased-plan.md`.

The closure/status report must keep four claims separate: Phase 1 implementation gate, test/demo operation eligibility, real-data staging readiness, and production readiness. Phase 1 may pass while test/demo is permitted and real-data staging/production remain **Not Ready** because the local/test key provider is not approved production privacy infrastructure. A passing startup-guard test proves that prohibited configurations are refused; it does not prove production key custody, residency operations, or real-data readiness.

## 10. Stop conditions

Stop the affected work and keep Phase 1 open if any of these occur:

- Any authorization path falls through to allow, or an actor can provide their own authority claims.
- State, event, outbox, receipt, capacity or purge audit can be partially committed.
- A tenant-scoped query or DB policy can return or mutate another tenant’s row.
- A prohibited audience receives any PII canary, or a real-data/production process starts without approved residency.
- Any key deletion claimed as durable becomes decryptable after restart/restore, or local in-memory deletion is represented as durable shredding.
- Purge can target production/unknown DB or uses unreviewed cascade deletion.
- Login acceptance can pass with the API mocked, or browser service readiness is nondeterministic.
- Required CI command is missing, skipped, runs zero tests, swallows child failure, or silently downgrades the baseline.
- A Phase 2 behavior is implemented to satisfy a Phase 1 test without explicit scope decision.

## 11. Required Phase 1 implementation artifacts

Upon execution, retain/update:

- `implementation/PHASE-1-IMPLEMENTATION.md` — corrected task/evidence ledger, not a blanket rewrite of history.
- `implementation/PHASE-1-REMEDIATION-PLAN-v2.md` — current execution plan with dated completion evidence appended per WP.
- `docs/PHASE1_VERIFICATION_REPORT.md` — exact commit, environment, commands, counts, outcome, skipped/pending, known limits and artifact links.
- `docs/PHASE1_COMMAND_MAP.md` — exact scripts, target suites, prerequisites and output evidence.
- `02-decision-register.md` — only approved spec/architecture deviations or resolutions to ambiguities.
- Traceability output and CI evidence bundle with sanitized logs; no secrets, `.env`, PII or plaintext credentials.

