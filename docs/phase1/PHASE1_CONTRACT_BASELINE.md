# Phase 1 contract baseline (WP0)

**Baseline version:** `phase1-baseline-v2-owner-approved-assumed`  
**Status:** Owner approval assumed by explicit user direction on 2026-11-07; WP0 remains open pending evidence and review. WP1 remains blocked.  
**Project decision owner:** User/project owner; signature assumed granted by explicit direction, not cryptographically signed in this file.  
**Independent Phase 1 closure reviewer:** Independent AI review is permitted by owner direction; a separate reviewer must still inspect the exact candidate and evidence.  
**Signed:** Owner approval assumed by explicit user direction; not represented as a verified electronic signature.

## Source baseline and limits

Normative implementation sources: `/Implementation-Plan-V4/03-specification-delta.md`, `/Implementation-Plan-V4/03b-evidence-standing-model.md`, `/Implementation-Plan-V4/04-architecture.md`, `/Implementation-Plan-V4/05-tdd-strategy.md`, `/Implementation-Plan-V4/06-phased-plan.md`, `/Implementation-Plan-V4/09-ui-ux-implementation.md`, `/Implementation-Plan-V4/AI-Secure-Coding-Policy.md`, ADR-001–ADR-022 in `02-decision-register.md`, and the ten canonical feature files in `Implementation-Plan-V4/features/`. The execution constraints and WP0 acceptance list are in `implementation/PHASE-1-REMEDIATION-PLAN-v2.md`. Repository-root `features/` and existing test suites are current runnable copies, but a copy is not proof that a scenario is implemented through the required application path.

ADR-005 (TypeScript/PostgreSQL 18/Fastify/Zod/Kysely + SQL) and ADR-006 (pure domain) establish architecture. ADR-014 permits the local key provider now and OpenBao later; it does not prove production key custody or backup-safe shredding. ADR-015 is Proposed/legal status unverified. ADR-016's current approved project mode is test data only with purge-to-seed and residency controls. ADR-022 selects the raw `pg` forward-only migration runner. These statuses are not upgraded by this baseline.

## Phase 0 exact evidence and current candidate check

- Historical Phase 0 PASS is commit `c70d3f439907e5ff37aee3953704e29d899e0032`, GitHub Actions run `42201289720`, documented in `docs/PHASE0_VERIFICATION_REPORT.md` and `docs/PHASE0_COMMAND_MAP.md`.
- On 2026-11-07, the implementer verified the existing `symphony_phase1_test` PostgreSQL 18.0 database. The `symphony` owner role lacks `CREATEDB` (it cannot provision another database or create roles under that privilege), but can create/alter schema objects and insert/update/delete rows inside the owned test database. A transaction-only schema/table/ALTER/DML privilege probe was rolled back. The Phase 0 migration suite then passed (3 files / 9 tests), followed by the full `npm run verify:phase0` gate on the dirty working tree based on `c25b616fa2e0f75b14327d87747880a227cbb8b2`; evidence is `evidence/phase1/phase0-candidate-verification.md`.
- The full dirty-tree gate passed on 2026-11-07 with the active Node 26.7.0/npm 12.2.0 pins, PostgreSQL 18.0, 71 domain tests, 9 migration tests, 49 BDD scenarios / 224 steps, 1 a11y test, and 261 legacy Vitest tests. The earlier dirty-tree pass under npm 11.19.0 remains historical and is retained separately. The candidate is still uncommitted/dirty; rerun the full gate on the exact clean candidate commit before WP0.13 closure. Preserve user-owned `CI-Results/` contents unchanged.

## Approved decisions versus remaining evidence

The following source-level requirements are fixed for implementation: command ID is tenant-scoped; command state/event/outbox/receipt are atomic; offline commands distinguish occurred/recorded time; 72-hour temporary credential default; test data only; global catalogue and tenant records require isolation; domain remains pure TypeScript; current key provider is local/test; real-data/production readiness requires approved residency and non-test key provider; no PII or credentials in events/logs/receipts; unresolved legal interpretation remains configurable and `needs_legal_validation`.

The user explicitly directed that all owner signatures and legal validations be assumed granted (2026-11-07). This records an approval assumption, not a cryptographic signature or independent legal-source re-review. The approved technical direction is recorded in `Implementation-Plan-V4/implementation/PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md` and the individual contracts. The remaining blockers below are implementation inputs and evidence; approval does not make them pass.

| Decision | Owner needed | Current state / consequence |
|---|---|---|
| D-01 command envelope, JCS/HMAC, attempt-only ID behavior and receipt races | Approved by user direction | Contract revised. Executable vectors, key retention/operations configuration and transaction proof remain. |
| D-02 reconciliation authorization and lifecycle | Approved by user direction | Policy uses current permission and tenant membership; retention is policy-configured. Actor role mapping and measured replica/backup evidence remain. |
| D-03 tenant isolation | Approved by user direction | Strict RLS/FORCE and least-privilege role contract set. 53-table policy/grant matrix and actual-role PostgreSQL tests remain. |
| D-04 authority serialization | Approved by user direction | Shared/exclusive locks on actor-tenant authority aggregate/version selected. Complete dependency/change-path inventory and both PostgreSQL serial-order tests remain. |
| D-05 purge-to-seed | Approved by user direction | Disposable marked test DB only, dedicated identity, allowlist, no CASCADE, atomic seed/audit. Exact identity/role/allowlist proof remains. |
| D-06 demo authority | Approved by user direction | Dedicated configured actors/tenant and narrow server-side allowlist. Concrete identifiers/configuration and API proof remain before provisioning. |
| D-07 privacy and legal baseline | Owner/legal approval assumed by user direction | No legal fact is inferred beyond identified source material. Full field/entity/transition/audience/lawful-basis/retention/BDD trace remains. |
| D-08 temporary credential | Approved by user direction | 72 hours, server time, single use, forced change, no runtime override. Injected-clock boundary proof remains. |
| D-09 BDD scope | Approved by user direction | Current manifest is not to be narrowed. Resolve every missing/filtered/`@wip` scenario from requirement mapping; strict run must pass. |
| D-10 session policy | Approved by user direction | Opaque server sessions, cookie/CSRF/rotation/logout/rate/revocation policy; 30-minute idle and 12-hour absolute. Boundary/API/browser proof remains; password policy still needs an explicit sourced rule. |
| D-11 runtime profiles | Approved by user direction | Four explicit profiles and one authoritative `RUNTIME_PROFILE` selector recorded in matrix v2. Startup-composition proof remains. |
| D-12 independent review model | Owner direction accepted | Plan amended to permit independent AI review. A separate reviewer must still inspect the exact candidate and artifacts; this implementation agent cannot independently review its own work. |

## WP0 contract index and versions

| WP0 | Artifact | Version/status | Required behavior/test IDs |
|---|---|---|---|
| 0.1 | `COMMAND_TRANSACTION_CONTRACT.md`, `command-contract-vectors.json`, `wp0.1-command-id-digest-tdd.md` | Contract/model partial; receipt retention and named key custodian still unsourced | JCS/HMAC, command-ID exclusion, metadata, historical key, actor races, denial/no-binding, stale terminal receipt, uncommitted visibility, post-commit response loss and safe-result canaries pass; real PostgreSQL/API transaction proof is deferred |
| 0.2 | `RECONCILIATION_CONTRACT.md`, `reconciliation-contract-vectors.json` | Contract/model partial; deployment replica/backup facts not available in this local test setup | Actor/officer/other-tenant access, expiry boundary/tombstone disposition and fresh-ID vectors pass; durable encryption, RLS, deletion propagation and backup expiry belong to later product/operations tasks |
| 0.3 | `TENANT_ISOLATION_CONTRACT.md`, `tenant-table-inventory.json`, `tenant-table-policy-matrix.json` | WP0 table/grant contract and validator pass; no application role provisioned | All 53 migration tables classified and assigned proposed least-privilege policy; only two currently have ENABLE+FORCE RLS. Actual role grants/policy probes are deferred to WP1.5/WP7.1 |
| 0.4 | `AUTHORIZATION_CAPACITY_CONTRACT.md`, `authority-dependency-inventory.json` | Complete contract inventory/model checks pass; live serialization deferred | Eight mutable dependency classes and mutation paths specify both serial orders and WP2.4 proof ownership; PostgreSQL barrier tests are deferred |
| 0.5 | `PURGE_OPERATION_CONTRACT.md`, purge preflight model vectors | Contract/model partial; exact mixed-table row allowlist and dedicated role provisioning remain | All safety guard inputs fail before destructive SQL in pure vectors; no purge command or destructive SQL was run |
| 0.6 | `DEMO_AUTHORIZATION_CONTRACT.md`, demo authorization vectors | Contract/model passes; deployment actor/tenant values remain configuration inputs | Synthetic configured actor/tenant positive and profile/actor/tenant/purge denial vectors pass; live API route remains WP6.2 |
| 0.7 | `PRIVACY_CONTROL_CONTRACT.md`, `privacy-field-requirement-map.json` | Requirement/field/audience/basis/retention/BDD map now explicit; WP3.3 decides only mapped persistence | Missing current entities are explicitly called out; no legal claims broadened and no new schema authorized |
| 0.8 | `AUTHENTICATION_CONTRACT.md`, `wp0.8-boundary-tdd.md` | Domain rule and exact expiry unit test pass; full Phase 0 gate pass recorded | Injected-clock proof at 72-hour boundary; persistent account/session/API behavior deferred to WP5 |
| 0.9 | `API_CONTRACT.md`, `bdd-scenarios.json`, `bdd-work-package-map.json` | Complete frozen 42-ID owner/path map and gate tests pass; 17 scenario behaviors remain for owner tasks | No frozen ID removed; 17 currently missing strict-run scenarios are not a WP0.9 failure and remain mandatory at final Phase 1 gate |
| 0.10 | `AUTHENTICATION_CONTRACT.md`, pure session policy vectors | Contract/model partial; sourced rate-delay parameters and password policy are WP5 inputs | Exact forced-change route allowlist, CSRF+Origin and 30m idle/12h absolute boundary rules are tested; no session API behavior claimed |
| 0.11 | `runtime-mode-matrix.json` v2 and matrix tests | Contract/configuration checks pass; actual composition deferred | Four profile pairs, synthetic/residency/key/role/DB/demo/purge constraints reject contradictions; startup/readiness tests belong to WP1.6/WP7.1 |
| 0.12 | `evidence/phase1/task-evidence.schema.json` and example | v1 implementation/tests passing | Valid sample, missing property, invalid status, unsafe value/path; tooling result does not close other WPs |
| 0.13 | This baseline, task graph and status records | v1 draft | Every WP0.1–0.12 completion record, edge review, named reviewer, owner signature |

## Runtime/data mode matrix

| `RUNTIME_PROFILE` | `APP_ENV` | `DATA_MODE` | Database/key/residency | Demo/purge |
|---|---|---|---|---|
| `test` | `test` | `test` | Isolated disposable DB; least-privilege app role; ephemeral test key; synthetic identities | Demo disabled; purge only via dedicated purge role |
| `demo` | `development` | `test` | Disposable synthetic demo DB; least-privilege app role; development/demo key | Designated actor/tenant only; purge disabled |
| `real-data-staging` | `staging` | `real` | Approved residency; persistent least-privilege role; approved managed key provider | Demo/purge disabled |
| `production` | `production` | `real` | Approved residency; production key provider; hardened controls | Demo/purge disabled |

`RUNTIME_PROFILE` is the single authoritative selector; `APP_ENV` and `DATA_MODE` must match it. Every missing, unknown or contradictory combination is rejected before listening or connecting with a mutating role. `DATA_MODE` and `VITE_DEMO` alone are never authorization controls. Owner approval is assumed; no real personal data is authorized in the current implementation environment.

## Scope and dependency evidence

`evidence/phase1/task-dependencies.yml` captures the plan's WP0–WP8 graph and an explicit basis for every edge. Structural validation checks known tasks, cycles, missing/weak edge reasons and mandatory WP0 nodes. A target task cannot execute until every transitive predecessor has a passing common evidence record. WP0.13 requires passing WP0.1–WP0.12 records and cannot be substituted by this draft. WP3.3 fields/transitions remain conditional under the privacy mapping; unmapped items are deferred. No WP1 code is authorized by this artifact.

## WP0 sign-off

WP0 is not complete. Owner signatures and legal validations are assumed granted by explicit user direction. Required before WP1: finish the complete DB role/table/authority inventories and executable vectors; pass the full Phase 0 gate on the exact candidate with isolated PostgreSQL 18; pass and record WP0.1–WP0.12 evidence; execute the frozen BDD manifest without filtered scenarios; run structural/gate validators; complete independent review under the amended AI-permitted model; and record owner closure acceptance. The current implementation agent cannot independently review its own work.
