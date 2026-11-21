# Prototype-14 Remediation and Re-synchronization

**Status:** In progress on `codex/prototype14-remediation-resync`.
**Baseline:** `main` at `5c6eb42912405c60198a461b999bba64363dc0be`.
**Purpose:** Reconcile implementation sequencing, task ownership, BDD acceptance and evidence tooling before additional WP1.6 command implementation.

This plan corrects the seven process findings in the Prototype-14 review. It does not authorize new business semantics, mark tasks complete, or claim a gate passed. The dependency graph is the machine source for technical ordering; task evidence records completed work; the BDD map owns scenario responsibility and product path; canonical feature sources define acceptance. All four must agree.

## 1. Root cause and scope boundary

The previous decomposition allowed REM-WP1.6 to begin without the registered product command it must compose. REM-WP2.3 creates the Phase 1 authority commands, while the D-16 serialization infrastructure currently described under REM-WP2.4 is needed before those mutations can safely persist. The corrected sequence therefore inserts an infrastructure task before WP2.3 and keeps WP2.4 for race and history proof after the mutation path exists.

REM-WP6.1 remains a separate read-only workspace path. Its prerequisites remain REM-WP0.9, REM-WP2.2 and REM-WP5.3. WP2.3 is not a WP6.1 predecessor unless workspace scope is explicitly changed.

## 2. Seven findings and dispositions

### 2.1 Missing product-command dependency

REM-WP1.6 requires the actual registered command, strict command schema and transaction-backed product behavior. Add REM-WP2.3 and REM-WP2.6 to its prerequisite chain. Update the graph, roadmap, readiness plan, WP1.6 plan and verifier together. AUD-014 remains in the WP1.6 focused acceptance because its mapped path includes `POST /commands`.

### 2.2 WP2.3 scope and command identity

WP2.1 freezes four policy action families: capacity grant/revoke and TA-scope grant/revoke. These policy IDs do not define HTTP command IDs, schema versions, aggregates or payload/result schemas. WP2.3 owns the command contract for the four in-scope families, unless an explicit owner decision narrows the Phase 1 scope. Before production code, create `evidence/phase1/wp2.3/capacity-delegation-command-contract.json`, trace every field to approved sources, and record unresolved product semantics in the decision register. Do not infer registrations from legacy service names.

### 2.3 Serialization prerequisite inversion

Create REM-WP2.6 for the D-16 scope-version schema, bootstrap, RLS/privileges, lock acquisition service, supported-writer boundary and frozen-source enforcement. WP2.6 depends on REM-WP0.4, REM-WP2.1 and REM-WP2.2. WP2.3 depends on REM-WP2.2 and REM-WP2.6. REM-WP2.4 retains both serial orders, race barriers, revocation behavior and immutable-history proof and depends on WP2.3 and WP2.6.

The existing D-16 specification remains normative. Its infrastructure sections must identify WP2.6 as implementation owner; its race-evidence section remains WP2.4 acceptance. No WP2.3 or WP2.4 gate is passed by editing the graph or specification.

### 2.4 BDD ownership and product-path consistency

- AUD-002/003 retain separate WP1.3 PostgreSQL replay proof and WP1.6 HTTP proof. WP2.3 owns the registered command used by those paths.
- AUD-002/003/005/008/009/014 remain mandatory and are now marked `@wip` in the runnable feature because their current fixture/steps do not yet establish the mapped registered-command HTTP path. The aggregate and focused validators must continue to fail until those scenarios pass; the marker is not a completion or scope disposition.
- AUD-014 remains owned by WP2.1, WP2.2 and WP1.6 and must be selected in focused WP1.6 runs.
- AUD-008 must use a registered Phase 1 command from the approved WP2.3 contract. Unknown/unregistered commands cannot prove a role-policy denial. Its owners and path include WP2.1, WP2.2, WP2.3 and WP1.6.
- AUD-009 must make payload-schema rejection and any event-derived standing assertion independently observable. A strict-schema rejection alone does not prove the projection derives from events.
- AUD-005 uses the API contract response code `NOT_AUTHORIZED`. Its owner map names the persistence/audit, tenant isolation, trusted identity, command, session and HTTP proof slices. The scenario specifies distinct tenants so its `TENANT_MISMATCH` assertion has a defined meaning. Its current step still targets an evidence item through a domain command-bus fixture, so the runnable scenario remains `@wip` until the registered command's legitimate Org B target and actual `POST /commands` path are reconciled.

No scenario is removed or marked passed as part of this reconciliation.

### 2.5 Canonical and runnable feature synchronization

`Implementation-Plan-V4/features/` is the canonical acceptance source and `features/` is the runnable tree. All ten pairs differed at the Prototype-14 baseline. This pass reconciles the known Feature 01 authentication response, Feature 09 denial vocabulary/background, and Feature 10 nine-persona content. The new parity checker allows only runnable `@wip` execution-status tags and a leading UTF-8 BOM. Run it as part of the Phase 1 contract gate; any remaining content or inventory difference fails. Preserve `@wip` until the owning product path and complete assertions pass.

### 2.6 One dependency and evidence boundary

The graph defines WP1.6's predecessor set; the verifier derives it from the graph and validates the complete transitive closure. BDD ownership remains the source for focused scenario selection. The runner must support strict WP1.6 selection and preserve JSON reports and raw logs at a candidate-specific path. The default aggregate remains the full frozen manifest and fails on missing, duplicate, skipped, pending, undefined or WIP mandatory scenarios.

### 2.7 Cohort lifecycle and historical evidence

WP2.3/WP2.4 do not implicitly implement cohort creation, lifecycle transitions, closure or historical treatment. Those behaviors remain outside their acceptance unless a separately approved task assigns them. The current readiness plan records first-class cohort lifecycle as future work; this plan makes that boundary explicit. Re-run any revocation/history proof against current behavior; old logs describing historical finding mutation are not valid evidence.

## 3. Corrected dependency sequence

| Task | Depends on | Deliverable |
|---|---|---|
| REM-WP2.1 | REM-WP0.4 | Frozen Phase 1 policy matrix and pure policy evidence |
| REM-WP2.2 | REM-WP1.1, REM-WP1.2, REM-WP1.5, REM-WP2.1 | Trusted persisted authority resolution |
| REM-WP2.6 | REM-WP0.4, REM-WP2.1, REM-WP2.2 | D-16 serialization infrastructure and frozen-writer enforcement |
| REM-WP2.3 | REM-WP2.2, REM-WP2.6 | Approved capacity/delegation command contract and PostgreSQL mutation path |
| REM-WP2.4 | REM-WP0.4, REM-WP2.1, REM-WP2.2, REM-WP2.3, REM-WP2.6 | Barrier-based serial-order, revocation and immutable-history proof |
| REM-WP1.6 | REM-WP1.1–REM-WP1.5, REM-WP2.2, REM-WP2.3, REM-WP2.6, REM-WP5.3 | Persisted-session `POST /commands` composition and mapped BDD proof |
| REM-WP2.5 | REM-WP2.1–REM-WP2.4, REM-WP1.6 | BDD scope/evidence reconciliation |
| REM-WP7.2 | Its full graph predecessor set | Integrated frozen Phase 1 gate on one candidate |
| REM-WP8 | REM-WP7.2 candidate evidence | Independent closure review |

WP6.1 remains separately scheduled after WP0.9, WP2.2 and WP5.3; WP6.3 remains downstream of WP6.1.

## 4. Execution and closeout controls

1. Reconcile the graph, task descriptions, roadmap, readiness plan, WP1.6 plan, D-16 ownership, BDD map and canonical features before implementing the new command path.
2. Record the exact WP2.3 command schema and any unresolved product semantics before code. No HTTP command name is inferred from a policy action ID.
3. Implement WP2.6, then WP2.3, then WP2.4, then WP1.6, then WP2.5. Their exact-candidate verifiers must check real evidence and dependency ancestry.
4. Preserve WIP and frozen scenario counts. Remove WIP only when a scenario's owning product path passes.
5. Retain red/green outputs, raw Cucumber JSON/logs, database role/version/migrations and candidate SHA. A source/test pass is not an independent review or a gate pass.
6. Keep WP6.1 work and evidence on its separate accepted path; do not make it wait on authority mutation commands.

## 5. Current limits

REM-WP2.6 implementation now includes `migrations/0019_authority_scope_versions.sql` and `0020_authority_scope_frozen_lock_policy.sql`, the typed resolver/lock service, transaction-local actor identity, runtime readiness validation, frozen-source privilege reconciliation, and PostgreSQL acceptance tests. Local PostgreSQL 18 migration and full DB suites pass, as do Phase 1 contract and TypeScript checks. Raw logs are under `evidence/phase1/wp2.6/local/2026-11-20/`; exact-candidate closure is recorded separately in `evidence/phase1/wp2.6/task-evidence.json` after the WP2.6 verifier passes. The repository has no centralized authority command registry yet; REM-WP2.3 must define and validate supported capacity/delegation writer registrations before any such DML is enabled.

No WP2.3 command contract or implementation is present. Do not create command registrations or HTTP payloads until `evidence/phase1/wp2.3/capacity-delegation-command-contract.json` is approved and populated from the frozen action matrix. No cohort-lifecycle implementation is authorized by this plan. The feature parity verifier has been added but has not yet been run. Tasks remain pending until their owning verifiers pass on immutable candidates.
