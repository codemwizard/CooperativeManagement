# Exact WP1.2 Plan Review Diffs

Base: 6ce5b0d8d88d2cd8ae057f9ebb93858c28eeb8c1
Target: 103b5162111344ffa10c981ccaec564b172179eb
Format: literal unified diff with zero context lines. `+` lines are additions; `-` lines are removals.

```diff
diff --git a/Implementation-Plan-V4/implementation/PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md b/Implementation-Plan-V4/implementation/PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md
index 2382c0d..9ca7961 100644
--- a/Implementation-Plan-V4/implementation/PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md
+++ b/Implementation-Plan-V4/implementation/PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md
@@ -3 +3 @@
-**Status:** WP0 closed on 2026-11-07; Independent Review complete; owner closure permission granted; WP1 authorized to begin.  
+**Status:** WP0 closed on 2026-11-07; WP1.1 implementation and npm 12.2.0 PostgreSQL migration gate passed against symphony_phase1_test on 2026-11-09; its task evidence still requires a source commit pin before WP1.2 may start.
@@ -9 +9 @@
-The focused WP0 contract suite passes (94 tests), the structural validator accepts the evidence schema/dependency graph and WP0 contract inventories, and the full Phase 0 baseline gate passed 100% on the clean candidate commit `f1fa5f9413747c0ac3cbd73413179101d33f653e` across all 12 stages. Independent review has been completed and accepted, and the project owner has explicitly granted closure permission. WP0 is closed and WP1 implementation is authorized to begin with WP1.1.
+The focused WP0 contract suite passes (94 tests), the structural validator accepts the evidence schema/dependency graph and WP0 contract inventories, and the full Phase 0 baseline gate passed 100% on the clean candidate commit `f1fa5f9413747c0ac3cbd73413179101d33f653e` across all 12 stages. Independent review has been completed and accepted, and the project owner has explicitly granted closure permission. WP0 is closed. WP1.1 receipt schema, versioned digest, forward migration, focused domain tests, type/architecture/contract checks, and the npm 12.2.0 PostgreSQL integration gate are complete; the task record is `evidence/phase1/wp1.1/task-evidence.json` and the current migration output is `evidence/phase1/wp1.1/migration-test-npm12.2.log`. The migration gate passed 3 files / 11 tests against the isolated `symphony_phase1_test` database using the configured Symphony credentials, with no credential stored in the evidence. WP1.1 owns receipt migration 0009 only. The corrected plan assigns `security_attempts` creation and audit persistence to WP1.2 migration 0010 and RLS/grants to WP1.5 migration 0011. WP1.2 starts only after WP1.1 task evidence is pinned to the implementation commit. This is a predecessor evidence action, not a product-code blocker.
@@ -16 +16 @@ Current status of closure gates:
-- **WP0.13 Sign-off:** Complete; validator confirms zero unmet blockers (`WP0.13 is eligible for owner sign-off`). WP1.1 has zero unmet predecessor blockers.
+- **WP0.13 Sign-off:** Closed; current validator reports owner approval and candidate pass recorded. WP1.1 `integration_test` and `gate_verified` are passed under npm 12.2.0 using `symphony_phase1_test`; the evidence commit pin remains pending. WP1.2 may start after the pin and must retain its PostgreSQL fault/rollback/audit evidence.
diff --git a/Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md b/Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md
index 8659065..2b1cacb 100644
--- a/Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md
+++ b/Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md
@@ -1 +1 @@
-# Phase 1 Remediation Implementation Plan — v2.1 targeted amendment
+# Phase 1 Remediation Implementation Plan — v2.1.3 WP1.2 review amendments
@@ -3 +3 @@
-**Status:** WP0 contract/design gate closed on 2026-11-07; owner closure permission granted; WP1 authorized to begin. The prior independent review report is retained at `docs/Independent-Review-Report-Phase-1_Remediation-Plan_v2.md` and is indexed for review. Phase 1 In Progress.
+**Status:** WP0 contract/design gate closed on 2026-11-07; WP1.1 implementation and required checks passed and its evidence is pinned to source commit `98eb5571ca29ded9afbef191678c7bfdf92b023c`. WP1.2 is specified and its task evidence envelope is registered, but implementation has not started. WP1.2 may now start subject to its listed predecessor/dependency gates. The prior independent review report is retained at `docs/Independent-Review-Report-Phase-1_Remediation-Plan_v2.md` and is indexed for review. Phase 1 In Progress.
@@ -9 +9 @@
-**Revision note:** v2 supersedes the initial remediation plan for execution. v2.1 is the execution baseline; this targeted amendment (2026-11-08) incorporates the independent review disposition without changing Phase 1 scope. The v1 document remains historical. WP0 design/contract gate is closed and WP1 implementation is authorized; implementation and PostgreSQL proof deferred to Phase 1 remain mandatory and are not waived. The earlier `PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md` WP0 exit register is superseded only for the specific closure-boundary interpretation recorded in §3 and the baseline; its historical record is preserved.
+**Revision note:** v2 supersedes the initial remediation plan for execution. v2.1 is the execution baseline; the 2026-11-08 targeted amendment incorporated the independent review disposition without changing Phase 1 scope. v2.1.1 (2026-11-09) resolves the WP1.1/WP1.2 migration ownership conflict and corrects WP0.13 status reporting. WP1.1 checks completed on 2026-11-09 under npm 12.2.0 against `symphony_phase1_test`; the evidence now pins source commit `98eb5571ca29ded9afbef191678c7bfdf92b023c`. v2.1.2 (2026-11-09) clarified WP1.2 carry-forward and WP1.5 role/RLS dependency. v2.1.3 (2026-11-09) resolves inbox sequencing, makes policy/authority reads part of the transaction context, tightens audit schema/error mapping, adds two machine-validated sub-gates, and updates review/dependency procedures. The v1 document and prior v2.1 reviews remain historical. WP0 design/contract gate is closed and WP1 implementation is authorized; implementation and PostgreSQL proof deferred to Phase 1 remain mandatory and are not waived. The earlier `PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md` WP0 exit register is superseded only for the specific closure-boundary interpretation recorded in §3 and the baseline; its historical record is preserved.
@@ -21 +21 @@
-The execution plan is **v2.1 targeted amendment** (this file); v1 and the initial v2 plan are historical. The WP0 baseline is [`phase1-baseline-v2.1-owner-approved-closed`](../../docs/phase1/PHASE1_CONTRACT_BASELINE.md). Current contract identifiers are: HTTP API `phase1-http-api-v2`; command transaction `phase1-command-transaction-v2`; authorization/capacity `phase1-authorization-capacity-v2`; tenant isolation `phase1-tenant-isolation-v2`; reconciliation `phase1-reconciliation-v2`; authentication `phase1-authentication-v2`; purge `phase1-purge-operation-v2`; demo authorization `phase1-demo-authorization-v1`; privacy controls `phase1-privacy-control-v1`. The v2 versions supersede the corresponding v1 contract texts for the amended semantics; demo/privacy v1 remain current because this review did not amend them. The canonical document and evidence set is `evidence/phase1/review-document-index.json`; candidate-specific hashes and changed source/test files are generated by `tools/create_phase1_review_manifest.mjs`.
+The execution plan is **v2.1.3 WP1.2 review amendments** (this file); v1, initial v2, v2.1, and v2.1.1 are historical versions. The WP0 baseline is [`phase1-baseline-v2.1-owner-approved-closed`](../../docs/phase1/PHASE1_CONTRACT_BASELINE.md). Current contract identifiers are: HTTP API `phase1-http-api-v2`; command transaction `phase1-command-transaction-v2`; authorization/capacity `phase1-authorization-capacity-v2`; tenant isolation `phase1-tenant-isolation-v2`; reconciliation `phase1-reconciliation-v2`; authentication `phase1-authentication-v2`; purge `phase1-purge-operation-v2`; demo authorization `phase1-demo-authorization-v1`; privacy controls `phase1-privacy-control-v1`. The v2 versions supersede the corresponding v1 contract texts for the amended semantics; demo/privacy v1 remain current because this review did not amend them. The canonical document and evidence set is `evidence/phase1/review-document-index.json`; candidate-specific hashes and changed source/test files are generated by `tools/create_phase1_review_manifest.mjs`.
@@ -201 +201 @@ tasks:
-  WP4.2: [WP4.1, WP1.2]
+  WP4.2: [WP4.1]
@@ -216 +216 @@ tasks:
-Dependency review rationale: `WP1.4` is persistence and depends only on tenant isolation and generic field encryption; `WP1.7` owns actor/officer authorization and must wait for WP2.2. `WP3.6` is the generic encryption operation, split from WP3.2 identifier vault/blind-index functionality. WP2.1 is pure domain policy and loses the unnecessary WP1.5 edge. WP4.1 remains preflight/inventory and loses the unnecessary WP1.2 edge; WP4.2 retains the transaction prerequisite for destructive execution. `WP1.6` requires WP5.3 for real persisted-session middleware, in addition to WP2.2 trusted authority. Remaining edges continue to require a specific technical dependency and are validated by the graph checker; chronology alone is not a valid reason.
+Dependency review rationale: `WP1.4` is persistence and depends on tenant isolation and generic field encryption; `WP1.7` owns actor/officer authorization and must wait for WP2.2. `WP3.6` is the generic encryption operation, split from WP3.2 identifier vault/blind-index functionality. WP2.1 is pure domain policy and has no WP1.5/database dependency. WP4.1 is preflight/inventory only and has no WP1.2 dependency. WP4.2 is a separate privileged purge/reseed operation with its own transaction boundary and does not reuse the command adapter; it depends on WP4.1 only. `WP1.6` requires WP5.3 for real persisted-session middleware, in addition to WP2.2 trusted authority. Remaining edges must each state a technical prerequisite; chronology alone is not valid.
@@ -297,3 +297,3 @@ The workstream is a sequence of independently gated tasks. Do not hand the entir
-| WP1.2 Transaction boundary | Make aggregate, event, outbox and receipt writes share caller-owned transaction; completed receipt insert is unique. Persist pre-acceptance security-attempt observations separately. | Add `packages/db/src/__tests__/command-transaction.integration.test.ts` and `packages/db/src/__tests__/security-attempt-audit.integration.test.ts`; expected red: any transaction fault leaves a partial receipt/state/event/outbox/inbox set, or denied command is accepted when security-attempt audit insert fails. Commands: `npm run test:db --workspace @symphony/db -- src/__tests__/command-transaction.integration.test.ts`; same command with `src/__tests__/security-attempt-audit.integration.test.ts`. | PostgreSQL transaction adapter and audit writer only. Green: both focused commands under the isolated PG18 fixture + `npm run verify:arch`. |
-| WP1.3 Idempotency/concurrency/uncertain commit | Implement winner/loser duplicate behavior, optimistic concurrency and bounded transaction retry per accepted contract. | Add `packages/db/src/__tests__/command-bus-concurrency.integration.test.ts`; expected red: duplicate event/result, lost-response retry ambiguity, changed actor/type/payload acceptance, stale-version overwrite, or replayed terminal conflict returning a different status/result or creating a second inbox row. Command: `npx vitest run packages/db/src/__tests__/command-bus-concurrency.integration.test.ts`. Use barriers, not sleeps. | PostgreSQL command bus only. Green: successful replay returns 200; VERSION_CONFLICT first evaluation and replay both return 409 with identical safe body/reconciliation ID and only replay carries `replayed: true`; exactly one inbox row/event/outbox set; fresh-connection receipt resolves uncertainty; bounded retry never duplicates effect. |
-| WP1.4 Reconciliation persistence | Store only stale/conflicting inputs in the encrypted inbox; enforce lifecycle, retention, RLS and explicit tenant predicates. Use WP3.6 generic field encryption. No actor/officer authorization decision may be inferred from client claims. | Add persistence tests proving encrypted storage, receipt/event/outbox/log separation, tenant policy, fresh IDs, expiry/tombstone, and no raw payload leakage. | Persistence/access repository boundary only. Green: PostgreSQL tests under the least-privilege role prove storage/lifecycle and tenant isolation. |
+| WP1.2 Transaction boundary | Carry forward WP1.1 migration `0009` and its `@symphony/contracts` receipt/result schemas, semantic digest and version rules. Update DB row types/adapter to the WP1.1 receipt columns; never persist raw command payload. The domain transaction context includes receipt lookup/replay, aggregate lock/read, policy/authority reads and locks, pure handler execution, and receipt/state/event/outbox writes. The PostgreSQL adapter owns one transaction and passes the same domain context throughout; domain code must not import Kysely/PostgreSQL types. Remove command-path session-scoped `app.current_tenant_id`; use transaction-local `app.tenant_id`. Add authenticated-denial observations in migration `0010_security_attempts.sql`. | Before implementation, add red `packages/domain/src/kernel/__tests__/command-bus-transaction.test.ts` and PostgreSQL integration tests. A transaction-identity double proves every command-path read/write, including policy/authority, receives the same context. Inject failure after receipt, state, event and outbox writes; a fresh connection must see no rows. No inbox assertions in WP1.2; WP1.4 owns inbox persistence/atomicity. For a trusted authenticated denial, assert separate audit commit precedes HTTP 403 `NOT_AUTHORIZED`; audit failure returns HTTP 503 `COMMAND_TEMPORARILY_UNAVAILABLE` with no business receipt/mutation. Assert no audit row for unauthenticated requests, missing trusted actor/tenant, domain/business-rule rejection, or any record containing payload, PII, policy explanation or exception details. Report WP1.2-A accepted-command transaction and WP1.2-B security-attempt audit separately. Commands: `npm run test:unit --workspace @symphony/domain -- src/kernel/__tests__/command-bus-transaction.test.ts`; `npm run test:db --workspace @symphony/db -- src/__tests__/command-transaction.integration.test.ts`; `npm run test:db --workspace @symphony/db -- src/__tests__/security-attempt-audit.integration.test.ts`; `npm run test:db:migrations` with `MIGRATION_TEST_DATABASE_URL` set to the isolated migration-test database. | Scope includes command-bus/port handoff, transaction-bound policy/authority port, PostgreSQL adapter, WP1.1 receipt DB mapping/writer, migration 0010 and audit writer. Migration 0010 grants no product-role access. Use isolated PostgreSQL 18 migration/test credentials; make no app-role/RLS claim. Green requires both sub-gates and all four focused suites passed with exact commands/counts/artifacts, `npm run typecheck:v4`, and `npm run verify:arch`. The task record cannot pass unless both WP1.2-A and WP1.2-B pass. WP1.5 owns app-role grants/RLS; WP1.4 owns inbox persistence/atomicity. |
+| WP1.3 Idempotency/concurrency/uncertain commit | Implement successful-command winner/loser replay, key-reuse denial, optimistic aggregate concurrency, bounded retry and uncertain-commit resolution per the accepted receipt contract. Do not claim accepted terminal `VERSION_CONFLICT` behavior or inbox persistence; WP1.4 owns that complete behavior. | Add `packages/db/src/__tests__/command-bus-concurrency.integration.test.ts`; expected red: duplicate effects, lost-response ambiguity, changed actor/type/semantic-envelope acceptance, stale aggregate overwrite, or replay reading uncommitted/incorrect receipt data. Use barriers, not sleeps. Do not assert inbox state or public terminal-conflict responses. | PostgreSQL command bus only. Green: identical successful replay returns the committed safe result without duplicate state/event/outbox effects; changed actor/envelope is denied without disclosure; a competing expected-version write cannot overwrite newer state and leaves no partial effects; fresh-connection lookup resolves uncertain commit; bounded retries never duplicate effects. WP1.4 separately proves the complete accepted `VERSION_CONFLICT` receipt-plus-inbox transaction; WP1.6 proves its API status/body/replay metadata. |
+| WP1.4 Reconciliation persistence | Store only stale/conflicting inputs in the encrypted inbox; enforce lifecycle, retention, RLS and explicit tenant predicates. Use WP3.6 generic field encryption. No actor/officer authorization decision may be inferred from client claims. Own accepted terminal `VERSION_CONFLICT`: safe terminal receipt and encrypted inbox row commit together, with no successful state/event/outbox mutation. | Add persistence tests proving encrypted storage, receipt/inbox atomicity including failure after inbox insertion, event/outbox/state absence on terminal conflict, lifecycle/retention/tombstone behavior, tenant policy, fresh IDs, and no raw payload leakage. | Persistence/access repository boundary only. Green: PostgreSQL tests under the least-privilege role prove storage/lifecycle and tenant isolation; terminal conflict produces exactly one safe receipt and inbox item atomically. Requires WP1.2/1.3, WP1.5, WP3.6. WP1.6 later proves the public HTTP response and replay metadata. |
@@ -301 +301 @@ The workstream is a sequence of independently gated tasks. Do not hand the entir
-| WP1.5 Tenant isolation | Apply explicit filters, transaction-local context, RLS and role grants to classified tables, including tenant-scoped INSERT-only `security_attempts`. | Add `packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts`; prove missing/wrong context, INSERT for mismatched tenant, SELECT/UPDATE/DELETE on security attempts, or pooled reuse cannot expose or mutate cross-tenant rows. | PostgreSQL policies and repository filters only. Green: same command under non-owner/non-superuser role + repository contract suite. |
+| WP1.5 Tenant isolation | Apply migration `0011_tenant_rls_app_role.sql`, explicit filters, transaction-local context, RLS and role grants to classified tables, including tenant-scoped INSERT-only `security_attempts` introduced by WP1.2. | Add `packages/db/src/__tests__/tenant-rls-app-role.integration.test.ts`; prove missing/wrong context, INSERT for mismatched tenant, SELECT/UPDATE/DELETE on security attempts, or pooled reuse cannot expose or mutate cross-tenant rows. | PostgreSQL policies and repository filters only. Green: same command under non-owner/non-superuser role + repository contract suite. |
@@ -310 +310,3 @@ This section removes implementation choices that would otherwise be guessed whil
-The current `migrations/0001_kernel.sql` receipt definition is a legacy shape and is not the WP1 contract: it uses a globally unique `command_id`, stores raw `payload`, and lacks the approved semantic digest/version fields. Preserve its historical migration. Add `migrations/0009_command_receipts_v2.sql` for the receipt and security-attempt schemas and `migrations/0010_tenant_rls_app_role.sql` for the table policy/grant rollout. Both are forward-only. Migration 0009 must begin by checking for any legacy `command_receipts` rows and abort transactionally with an actionable error if one exists. WP1 does not transform, relabel, copy, or delete legacy receipts. A non-empty legacy case requires a separately approved and tested data-migration plan before applying 0009. The CI fixture must apply migrations to a clean disposable database; it must not clear a shared or developer database to satisfy this precondition. For the empty legacy table, 0009 removes the old single-column `command_id` primary key, renames `type` to `command_type`, drops the old `payload`, `occurred_at`, `device_id`, `expected_version`, and `result` columns, then adds the fields and composite key specified below. Every operation is transactional and has a migration test for clean install, expected legacy shape, and abort/no-change behavior when the legacy table is non-empty. The new receipt contract is:
+WP1.1 owns the versioned command receipt schema, digest, validator and migration 0009 only. `security_attempts` table creation and authenticated-denial persistence belong to WP1.2; its RLS, role grants and inventory acceptance belong to WP1.5. This boundary is reflected in the WP1 task table and dependency graph.
+
+The current `migrations/0001_kernel.sql` receipt definition is a legacy shape and is not the WP1 contract: it uses a globally unique `command_id`, stores raw `payload`, and lacks the approved semantic digest/version fields. Preserve its historical migration. Add `migrations/0009_command_receipts_v2.sql` for the receipt schema only, `migrations/0010_security_attempts.sql` for the authenticated-denial audit table and its WP1.2 persistence path, and `migrations/0011_tenant_rls_app_role.sql` for the table policy/grant rollout in WP1.5. These are forward-only. Migration 0009 must begin by checking for any legacy `command_receipts` rows and abort transactionally with an actionable error if one exists. WP1 does not transform, relabel, copy, or delete legacy receipts. A non-empty legacy case requires a separately approved and tested data-migration plan before applying 0009. The CI fixture must apply migrations to a clean disposable database; it must not clear a shared or developer database to satisfy this precondition. For the empty legacy table, 0009 removes the old single-column `command_id` primary key, renames `type` to `command_type`, drops the old `payload`, `occurred_at`, `device_id`, `expected_version`, and `result` columns, then adds the fields and composite key specified below. Every operation is transactional and has a migration test for clean install, expected legacy shape, and abort/no-change behavior when the legacy table is non-empty. The new receipt contract is:
@@ -335 +337,19 @@ WP1.1 tests must fail for each missing/incorrect column or constraint, raw-paylo
-The same 0009 migration creates `symphony.security_attempts` as a separate append-only tenant table with exactly: `security_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES symphony.tenants(id)`, `actor_user_id UUID NOT NULL`, nullable observational `observed_command_id UUID` and `observed_command_type TEXT`, nullable `semantic_digest BYTEA` constrained to 32 bytes when present, `denial_code TEXT NOT NULL` constrained to the WP1 shared enum `UNAUTHORIZED | NOT_AUTHORISED_FOR_ORGANISATION | TENANT_MISMATCH | READ_ONLY_ROLE | DOMAIN_VIOLATION`, and server-generated `recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()`. There is no business-command uniqueness constraint and it never reserves `(tenant_id, command_id)`. It stores no request body, payload, raw policy explanation, PII, credential, token, request correlation, or raw exception. Rows have no automatic expiry until an approved retention policy exists. The app role may INSERT only; it cannot SELECT/UPDATE/DELETE. Migration 0010 applies ENABLE+FORCE RLS and a `WITH CHECK` policy requiring `tenant_id` to equal transaction-local `app.tenant_id`; add an append-only trigger as defense in depth. WP1.5 matrix/inventory updates must classify this new tenant table, raising the expected migrated-table count from 53 to 54, and keep all other table classifications unchanged absent a separately reviewed migration.
+#### WP1.2 carry-forward from WP1.1 and transaction boundary
+
+WP1.2 must consume, not redefine, the WP1.1 accepted receipt contract. Use the exported command-receipt/result schemas and semantic-digest/version behavior from `packages/contracts` and `packages/domain`; do not create a second canonicalizer, result union, digest format, or compatibility shortcut. Update `packages/db/src/types/database.ts` and the receipt writer/reader mapping to the actual migration 0009 columns: `tenant_id`, `command_id`, `actor_user_id`, `command_type`, `command_schema_version`, `canonicalization_version`, `digest_key_version`, `semantic_digest`, `result_classification`, `result_schema_version`, `safe_result`, and `recorded_at`. The mapping must reject unsupported stored versions and validate `safe_result` before replay; it must never reintroduce or write the removed raw `payload`, `expected_version`, `device_id`, or legacy `result` columns.
+
+WP1.2 changes the command-bus/repository transaction boundary because the current repository opens a transaction inside PostgresRepository.save() and the current CommandBus saves its receipt after that call returns. The PostgreSQL command adapter is the single transaction owner and passes one domain-level transaction context through receipt lookup/replay, aggregate locks/reads, policy/authority reads and locks, then receipt/state/event/outbox writes. Transaction-aware repository and policy ports receive that context; domain contracts do not import Kysely or PostgreSQL types. Domain handlers remain pure. No command-path operation may open a second pooled connection, nested transaction, or independent commit. Remove session-scoped set_config(app.current_tenant_id, ..., false) from the command path and use transaction-local set_config(app.tenant_id, authenticatedTenantId, true); aggregate reads may not escape this transaction. A transaction-bound policy/repository test double records context identity and proves every read/write uses the same context. PostgreSQL tests inject faults after the four WP1.2 writes, verify fresh-connection rollback, and verify tenant context is absent after commit and rollback. Inbox is outside WP1.2; WP1.4 adds it to this boundary and owns terminal-conflict atomicity. WP1.2 establishes a transaction context for future authority locking but does not implement WP2.2/WP2.4 authority models or claim their completion.
+
+The `security_attempts` writer is a separate pre-acceptance audit path. Only an authenticated authorization denial with trusted actor and tenant context may produce a row; ordinary domain/business-rule rejection is not a security attempt. Roll back any command transaction before attempting the audit insert in a new transaction. A committed audit row precedes the shared non-disclosing HTTP 403 `NOT_AUTHORIZED`; audit-write failure returns retryable HTTP 503 `COMMAND_TEMPORARILY_UNAVAILABLE` with no business receipt or protected state/event/outbox mutation. A retry re-evaluates current authorization; the observation never reserves `(tenant_id, command_id)`. Unauthenticated requests or missing trusted actor/tenant context are excluded and remain owned by WP5.3. Migration 0010 creates the table/constraints only, with no ordinary application grants. WP1.2 uses migration/test credentials and makes no RLS claim; WP1.5 owns the app-role INSERT-only grant, RLS, pool-context proof and append-only enforcement.
+
+Migration 0010 creates `symphony.security_attempts` as a separate append-only tenant table with exactly: `security_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES symphony.tenants(id)`, `actor_user_id UUID NOT NULL`, nullable observational `observed_command_id UUID` and `observed_command_type TEXT`, `denial_code TEXT NOT NULL` constrained to `UNAUTHORIZED | NOT_AUTHORISED_FOR_ORGANISATION | TENANT_MISMATCH | READ_ONLY_ROLE`, and server-generated `recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Do not store a semantic digest; no forensic/correlation need justifies a digest-key-version or canonicalization lifecycle. There is no business-command uniqueness constraint and the table never reserves `(tenant_id, command_id)`. Store no request body, payload, digest, raw policy explanation, PII, credential, token, request correlation, or raw exception. Rows have no automatic expiry until an approved retention policy exists; this indefinite synthetic-test-only evidence does not authorize use with real personal data. WP1.2 uses the table; WP1.5 creates `0011_tenant_rls_app_role.sql`, applies ENABLE+FORCE RLS and a `WITH CHECK` policy binding tenant to transaction-local `app.tenant_id`, grants INSERT only to the ordinary app role, and adds append-only enforcement. WP1.5 updates the table inventory from 53 to 54 without changing other classifications absent a separately reviewed migration.
+
+
+Internal audit classifications map to the single public authorization response as follows:
+
+| Internal denial classification | Public response |
+|---|---|
+| `UNAUTHORIZED` | HTTP 403 `NOT_AUTHORIZED` |
+| `NOT_AUTHORISED_FOR_ORGANISATION` | HTTP 403 `NOT_AUTHORIZED` |
+| `TENANT_MISMATCH` | HTTP 403 `NOT_AUTHORIZED` |
+| `READ_ONLY_ROLE` | HTTP 403 `NOT_AUTHORIZED` |
@@ -337 +357 @@ The same 0009 migration creates `symphony.security_attempts` as a separate appen
-For a pre-acceptance authorization denial, roll back the business transaction first, then attempt to INSERT and commit the separate security-attempt row using a new transaction with the same authenticated tenant context. The INSERT does not use `RETURNING` because the app role has no SELECT grant; successful row count is the persistence acknowledgment. Return the normal non-disclosing 403 only after the audit insert commits. If audit persistence fails, return the shared retryable 503 response, create no command receipt, and perform no protected mutation; emit only a structured `security_audit_write_failed` operational signal without request data, SQL, credentials or PII. Do not audit unauthenticated requests in this tenant table because trusted tenant/actor context is unavailable; authentication route audit is owned by WP5.3. Test inspection uses migration/admin credentials only, never an application SELECT grant.
+For a pre-acceptance authorization denial, roll back the business transaction first, then insert and commit the audit row in a new transaction using the authenticated tenant context. Do not use `RETURNING` because the app role has no SELECT grant; use successful insert row count as the persistence acknowledgment. Map each accepted internal authorization-denial classification to HTTP 403 `NOT_AUTHORIZED`; do not return domain errors, policy reasons, role configuration, or internal denial classifications publicly. Return 403 only after the audit insert commits. If audit persistence fails, return HTTP 503 `COMMAND_TEMPORARILY_UNAVAILABLE`, create no command receipt, and perform no protected mutation; emit only `security_audit_write_failed` without request data, SQL, credentials, or PII. Do not audit unauthenticated requests or requests without trusted actor/tenant context; authentication-route audit belongs to WP5.3. Test inspection uses migration/admin credentials, never app SELECT.
@@ -341 +361 @@ For a pre-acceptance authorization denial, roll back the business transaction fi
-The transaction owner is the PostgreSQL command adapter. It acquires one connection, begins one transaction, sets tenant context with transaction-local `set_config('app.tenant_id', authenticatedTenantId, true)`, and performs all receipt/state/event/outbox/inbox work through that transaction handle. It first looks up the receipt; if absent, it obtains the transaction advisory lock `pg_advisory_xact_lock(hashtextextended('symphony.aggregate:' || tenant_id::text || ':' || aggregate_id::text, 0))`, then re-reads the receipt before loading the aggregate with `SELECT ... FOR UPDATE`. This serializes both existing and not-yet-created aggregate IDs across command transactions; hash collisions may reduce concurrency but cannot weaken isolation. All app command writers must use this lock protocol, with the conditional aggregate-version write retained as a second guard. Each WP1 command mutates exactly one aggregate. No repository operation may silently obtain a second pool connection. Authorization is evaluated after trusted tenant context is set and within the transaction; the authority lock ordering contract in WP0.4/WP2.4 remains mandatory for mutable authorization dependencies. Rollback is attempted on every pre-commit error; the original failure is rethrown if rollback also fails, and the connection is always released. Domain handlers are pure and may not perform database, network, or other external side effects.
+The transaction owner is the PostgreSQL command adapter. It acquires one connection, begins one transaction, sets transaction-local tenant context with `set_config('app.tenant_id', authenticatedTenantId, true)`, and passes the same domain transaction context to receipt lookup/replay, aggregate lock/read, policy/authority reads and required locks, then receipt/state/event/outbox writes. WP1.4 later adds inbox writes on this same handle. It first looks up the receipt; if absent, it obtains `pg_advisory_xact_lock(hashtextextended('symphony.aggregate:' || tenant_id::text || ':' || aggregate_id::text, 0))`, then re-reads the receipt before loading the aggregate with `SELECT ... FOR UPDATE`. This serializes existing and not-yet-created aggregate IDs; hash collisions may reduce concurrency but cannot weaken isolation. All app command writers use this lock protocol, with conditional aggregate-version writes retained as a second guard. Each WP1 command mutates one aggregate. No repository may obtain another pool connection. Authorization is evaluated inside this transaction after trusted tenant context is set; WP0.4/WP2.4 authority-lock rules remain mandatory for mutable dependencies. Roll back on every pre-commit error, preserve the original error if rollback also fails, and always release the connection. Domain handlers remain pure and perform no database, network, or other external side effects.
@@ -405,5 +425,5 @@ WP0 is closed. The following rows are accepted carry-forward work, not reopening
-2. Add PostgreSQL tests under an explicit test application role with isolated test schema/database and no ambient developer DB assumptions. Test role setup must itself assert no superuser/owner/`BYPASSRLS` privileges.
-3. Assert actual rows directly after every scenario: aggregate version/state, `domain_events`, `event_outbox`, `command_receipts`, reconciliation inbox, and attempted/refused security audit where specified. Include assertions that pre-acceptance denials do not create business receipts and authorized stale/conflict attempts persist only the safe terminal receipt/inbox. Do not infer persistence from a returned result.
-4. Inject deterministic failures at completed-receipt insert, state write, event insert, outbox insert, reconciliation-inbox insert and commit boundary; fresh connections verify rollback. There is no placeholder receipt or result-update step. Inject security-attempt audit write failures; prove denied requests never mutate, return only the ratified generic retryable service-unavailable outcome when mandatory audit cannot commit, and succeed in recording the denial on retry after recovery. Verify accepted commands remain governed by the receipt transaction and are never accepted by bypassing authorization because audit storage failed.
-5. Use barriers/latches (never sleeps) for identical duplicate, actor mismatch, payload mismatch and competing expected-version tests.
-6. Complete WP1.2 then WP1.3 before WP1.5; keep transaction ownership explicit so repositories use the caller transaction.
+2. Run WP1.2 business/audit integration tests against an isolated disposable PostgreSQL 18 test database using migration/test credentials and `DATA_MODE=test`; this verifies transaction behavior only and must not claim app-role/RLS coverage. WP1.5/WP1.4 tests that claim tenant isolation or app access must use the actual dedicated non-owner, non-superuser, non-`BYPASSRLS` application role and assert its attributes.
+3. Assert actual PostgreSQL rows directly by task scope. WP1.2 asserts aggregate state, `domain_events`, `event_outbox`, `command_receipts`, and `security_attempts`; it asserts pre-acceptance denials create no receipt/mutation. WP1.2 must not query or assert inbox rows. WP1.3 asserts successful receipt replay/concurrency without terminal-conflict inbox behavior. WP1.4 asserts the complete terminal-conflict receipt/inbox result and all related state absence. Never infer persistence from a returned result.
+4. In WP1.2 inject deterministic failures at receipt insert, state write, event insert, outbox insert, and commit boundary; fresh connections verify rollback. There is no placeholder receipt or result-update step. WP1.4 separately injects failure after inbox insertion and proves receipt plus inbox rollback together. WP1.2-B injects audit-write failure; prove no business receipt or mutation, HTTP 503 retryable result, and successful durable denial recording after recovery. Accepted commands are never authorized by audit failure.
+5. Use barriers/latches (never sleeps) for WP1.3 identical successful-command duplicates, actor mismatch, semantic-envelope mismatch and competing expected-version writes. WP1.4 adds barriers for terminal-conflict receipt/inbox behavior after its prerequisites pass.
+6. Complete WP1.2-A and WP1.2-B as separate sub-gates before WP1.3. The adapter passes one domain transaction context to repository and policy/authority ports; repositories cannot open independent transactions. Complete WP1.3 before WP1.5.
@@ -415 +435 @@ WP0 is closed. The following rows are accepted carry-forward work, not reopening
-**Acceptance:** receipt/reconciliation contracts are approved; successful/rejected semantics match feature 09; fault tests prove all-or-nothing persistence; concurrent replay gives one event set and a stable safe result; RLS tests use least-privilege role and prove no context leakage; architecture gate remains clean; each atomic task has its own retained evidence.
+**Acceptance:** receipt/reconciliation contracts are approved; successful/rejected semantics match feature 09; WP1.2-A and WP1.2-B each have separate passing evidence; fault tests prove their scoped all-or-nothing persistence; WP1.3 proves concurrent receipt behavior without inbox claims; WP1.4 proves terminal conflict receipt/inbox atomicity; WP1.5 RLS tests use the least-privilege role and prove no context leakage; architecture gate remains clean; every atomic task has retained evidence.
diff --git a/Implementation-Plan-V4/implementation/README.md b/Implementation-Plan-V4/implementation/README.md
index ccae1e9..2ad5fad 100644
--- a/Implementation-Plan-V4/implementation/README.md
+++ b/Implementation-Plan-V4/implementation/README.md
@@ -23 +23 @@ Phase 1 Gate must pass before Phase 2 starts.
-| [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md) | Phase 1 remediation (v2.1 execution baseline with 8 Nov targeted review amendment) | WP0 contract/design gate closed; WP1 authorized; downstream runtime proof remains required. Includes replay/concurrency, RLS, privacy, purge, session and reviewer-document index links. |
+| [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md) | Phase 1 remediation (v2.1.3 WP1.2 review amendments; based on the v2.1 execution baseline and 8 Nov targeted review) | WP0 contract/design gate closed; WP1.1 checks passed with npm 12.2.0 PostgreSQL proof; predecessor evidence must be commit-pinned before WP1.2 starts. WP1.2 explicitly consumes the WP1.1 receipt contract, makes command-bus writes atomic, excludes WP1.4 inbox acceptance, and defers app-role RLS/grants to WP1.5. Downstream runtime proof remains required. Includes replay/concurrency, privacy, purge, session and reviewer-document index links. |
@@ -38,3 +38 @@ Phase 1 Gate must pass before Phase 2 starts.
-Each task has a checkbox:
-- `[ ]` = not started
-- `[x]` = completed and verified
+Current remediation tasks close through a task record validated against `evidence/phase1/task-evidence.schema.json`, passing predecessor records in `evidence/phase1/task-dependencies.yml`, and retained command output/evidence artifacts. Each record binds behavior, exercised path, environment, commands, results, limitations and reviewer. A task cannot pass while a required sub-gate is pending; WP1.2 specifically requires both WP1.2-A and WP1.2-B. The current validator enforces the WP0 closure records and graph structure; task owners must preserve the exact command, exit code, test counts and artifact paths for downstream WP1+ acceptance.
@@ -42 +40 @@ Each task has a checkbox:
-**Check the box when the task is done**, not at the end of the phase. Each task names the exact test command to run. An independent verifier can re-run any named command to confirm the same result.
+Checkboxes remain only in legacy Phase 0/Phase 1 implementation documents that still use them. In those documents, `[ ]` means not started and `[x]` means the legacy checklist item was marked done; a checkbox is not a current remediation completion record or evidence of a passing gate.
diff --git a/docs/phase1/COMMAND_TRANSACTION_CONTRACT.md b/docs/phase1/COMMAND_TRANSACTION_CONTRACT.md
index fe39861..4646004 100644
--- a/docs/phase1/COMMAND_TRANSACTION_CONTRACT.md
+++ b/docs/phase1/COMMAND_TRANSACTION_CONTRACT.md
@@ -11 +11 @@ The business idempotency key is `(tenant_id, command_id)`. The receipt lookup ke
-Only the accepted logical command establishes this binding. Authenticated command pre-acceptance denials use an append-only, server-generated `security_attempt_id` in the tenant-scoped `security_attempts` table. The insert is permitted only after trusted actor and tenant context exist; tenant is set from authenticated server context and RLS binds it to transaction-local `app.tenant_id`. The application role receives INSERT only, with no SELECT/UPDATE/DELETE. If tenant context cannot be established, do not write this table. Unauthenticated login/CSRF/authentication attempts belong to the separate WP5 authentication/security audit path and are never inserted here. Observations may contain trusted actor/tenant, observed command ID/type, time, keyed digest and a safe denial code, but no raw payload or PII. They do not reserve the business key and do not affect later authorization or receipt ownership. Do not reserve command IDs before acceptance.
+Only the accepted logical command establishes this binding. Authenticated command pre-acceptance authorization denials use an append-only, server-generated `security_attempt_id` in the tenant-scoped `security_attempts` table. The insert is permitted only after trusted actor and tenant context exist; tenant is set from authenticated server context and RLS binds it to transaction-local `app.tenant_id`. The application role receives INSERT only, with no SELECT/UPDATE/DELETE. If tenant context cannot be established, do not write this table. Unauthenticated login/CSRF/authentication attempts belong to the separate WP5 authentication/security audit path and are never inserted here. Observations contain only trusted actor/tenant, observed command ID/type, server time, and a safe internal authorization-denial classification; they contain no semantic digest, raw payload, policy explanation, or PII. Internal authorization classifications map to the single public response HTTP 403 `NOT_AUTHORIZED`; the public response never exposes the internal classification or policy reason. Ordinary domain/business-rule rejections are not security attempts. Observations do not reserve the business key and do not affect later authorization or receipt ownership. Do not reserve command IDs before acceptance.
diff --git a/docs/phase1/INDEPENDENT_REVIEW_GUIDE.md b/docs/phase1/INDEPENDENT_REVIEW_GUIDE.md
index b7297ca..81d4af3 100644
--- a/docs/phase1/INDEPENDENT_REVIEW_GUIDE.md
+++ b/docs/phase1/INDEPENDENT_REVIEW_GUIDE.md
@@ -11 +11 @@ Independence is procedural: the reviewer uses a separate AI session or reviewer,
-The implementation agent must not write the reviewer conclusion, mark its own work independently reviewed, or present a review that shares the implementation context as independent. The reviewer may be an AI system as owner-authorized, but must be in a clean context without the implementation chat, patch rationale, or prewritten verdict. Supply the exact candidate SHA and the index; do not steer the reviewer with expected findings.
+The implementation agent must not write the reviewer conclusion, mark its own work independently reviewed, or present a review that shares the implementation context as independent. The reviewer may be an AI system as owner-authorized, but must be in a clean context without the implementation chat, patch rationale, or prewritten verdict. Supply the exact candidate SHA in a separate review request/packet together with the index; do not steer the reviewer with expected findings.
@@ -15 +15 @@ The implementation agent must not write the reviewer conclusion, mark its own wo
-1. Check out the exact candidate SHA from `evidence/phase1/review-document-index.json` in a clean worktree. Confirm the worktree is clean and record `git rev-parse HEAD` and `git status --porcelain` in the review record.
+1. Obtain the exact candidate SHA from a separate review request/packet supplied by the project owner or review coordinator. The SHA must not be embedded in the candidate's checked-in document index, because that would make the index self-referential. Check out the supplied SHA in a clean worktree; confirm it with `git rev-parse HEAD` and `git status --porcelain`, and record both outputs in the review record. If the packet SHA and checkout disagree, stop the review.
@@ -17 +17 @@ The implementation agent must not write the reviewer conclusion, mark its own wo
-3. From the clean candidate checkout, run `node tools/create_phase1_review_manifest.mjs <full-candidate-commit-sha>`. This refuses a wrong SHA or dirty tree, requires every indexed path to exist, and writes a new immutable SHA-256 manifest under `evidence/phase1/reviews/<candidate-short-sha>/`. Compare the generated path set and file hashes with the checked-in index and supplied packet. The index defines the canonical path set; hashes are candidate-specific because source files change across commits.
+3. From the clean candidate checkout, run `node tools/create_phase1_review_manifest.mjs <full-candidate-commit-sha>` using the exact SHA from the separate review packet. This refuses a wrong SHA or dirty tree, requires every indexed path to exist, and writes a new immutable SHA-256 manifest under `evidence/phase1/reviews/<candidate-short-sha>/`. Compare the generated path set and file hashes with the checked-in index and supplied packet. The index defines the canonical path set; hashes are candidate-specific because source files change across commits.
diff --git a/evidence/phase1/review-document-index.json b/evidence/phase1/review-document-index.json
index 8934b1c..0d27b4c 100644
--- a/evidence/phase1/review-document-index.json
+++ b/evidence/phase1/review-document-index.json
@@ -6 +6 @@
-    "commit": "MUST_BE_SET_TO_EXACT_CANDIDATE_SHA",
+    "commit": null,
@@ -8 +8,2 @@
-    "candidate_hash_manifest": "evidence/phase1/reviews/<candidate-short-sha>/sha256-manifest.json"
+    "candidate_hash_manifest": "evidence/phase1/reviews/<candidate-short-sha>/sha256-manifest.json",
+    "commit_source": "Exact SHA must be supplied in a separate review request/packet; do not embed candidate SHA in the candidate index."
@@ -10 +11 @@
-  "review_order": ["project_authority", "requirements_and_features", "plan_and_contracts", "dependencies_and_tasks", "evidence_and_results", "implementation_and_tests", "review_disposition"],
+  "review_order": ["project_authority","requirements_and_features","plan_and_contracts","dependencies_and_tasks","evidence_and_results","implementation_and_tests","review_disposition"],
@@ -18,2 +19,2 @@
-    {"id":"project_authority","path":"Implementation-Plan-V4/implementation/PHASE-1-IMPLEMENTATION.md","role":"Historical Phase 1 implementation outline; reconcile against current v2.1 plan"},
-    {"id":"project_authority","path":"Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN.md","role":"Historical initial remediation plan; superseded by v2.1 targeted amendment"},
+    {"id":"project_authority","path":"Implementation-Plan-V4/implementation/PHASE-1-IMPLEMENTATION.md","role":"Historical Phase 1 implementation outline; reconcile against current v2.1.3 plan"},
+    {"id":"project_authority","path":"Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN.md","role":"Historical initial remediation plan; superseded by the v2.1 targeted amendment and current v2.1.3 execution plan"},
@@ -52 +53 @@
-    {"id":"plan_and_contracts","path":"Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md","role":"Current Phase 1 execution baseline; v2.1 targeted amendment"},
+    {"id":"plan_and_contracts","path":"Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md","role":"Current Phase 1 execution baseline; v2.1.3 WP1.2 carry-forward clarification"},
@@ -106 +107,29 @@
-    {"id":"review_disposition","path":"evidence/phase1/reviews/phase1-v2.1-review-disposition.md","role":"Disposition of supplied 2026-11-08 review findings"}
+    {"id":"implementation_and_tests","path":"migrations/0009_command_receipts_v2.sql","role":"WP1.1 forward migration for the composite, versioned command receipt schema only"},
+    {"id":"implementation_and_tests","path":"packages/contracts/src/command-receipt.ts","role":"Strict shared receipt and command-result schemas and types"},
+    {"id":"implementation_and_tests","path":"packages/contracts/src/index.ts","role":"Shared contract exports including WP1.1 receipt schemas"},
+    {"id":"implementation_and_tests","path":"packages/domain/src/kernel/command-digest.ts","role":"WP1.1 RFC 8785 semantic projection, versioned HMAC operation, and constant-time digest verification"},
+    {"id":"implementation_and_tests","path":"packages/domain/src/kernel/ports.ts","role":"Versioned command digest key-provider port, separate from field encryption"},
+    {"id":"implementation_and_tests","path":"packages/domain/src/index.ts","role":"Domain package exports including the WP1.1 digest operation"},
+    {"id":"implementation_and_tests","path":"packages/domain/src/kernel/__tests__/command-digest.test.ts","role":"WP1.1 approved canonicalization/HMAC vectors, metadata exclusion, key version and fail-closed tests"},
+    {"id":"implementation_and_tests","path":"packages/domain/src/kernel/__tests__/command-receipt-contract.test.ts","role":"WP1.1 receipt and safe-result schema red/green tests"},
+    {"id":"implementation_and_tests","path":"packages/db/src/__tests__/migration-runner.integration.test.ts","role":"WP1.1 PostgreSQL catalog and non-empty legacy receipt refusal tests"},
+    {"id":"implementation_and_tests","path":"packages/domain/package.json","role":"Pinned workspace dependency on the RFC 8785 canonicalization implementation"},
+    {"id":"implementation_and_tests","path":"package.json","role":"Root toolchain pin and scripts; canonicalizer dependency is owned by the domain workspace"},
+    {"id":"implementation_and_tests","path":"package-lock.json","role":"Resolved dependency versions and integrity data for canonicalization packages"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/task-evidence.json","role":"WP1.1 closed task record; implementation, focused checks, PostgreSQL integration and task gate passed"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.2/task-evidence.json","role":"WP1.2 pre-implementation evidence envelope; commands not run and WP1.2-A/WP1.2-B pending"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/domain-tests.log","role":"Raw WP1.1 domain contract and digest test output"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/migration-test.log","role":"Raw PostgreSQL migration test output for WP1.1"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/typecheck-v4.log","role":"Raw repository typecheck output for WP1.1 candidate"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/verify-arch.log","role":"Raw architecture dependency validation output for WP1.1 candidate"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/phase1-contracts.log","role":"Raw Phase 1 contract-validator tests and current WP0.13/WP1 gate status output"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/npm-version-npm12.2.txt","role":"Direct npm CLI version output: 12.2.0"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/domain-tests-npm12.2.log","role":"WP1.1 focused domain tests rerun under npm 12.2.0"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/migration-test-npm12.2.log","role":"WP1.1 PostgreSQL migration gate rerun under npm 12.2.0 against isolated symphony_phase1_test; 3 files / 11 tests passed"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/typecheck-v4-npm12.2.log","role":"Workspace typecheck rerun under npm 12.2.0"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/verify-arch-npm12.2.log","role":"Architecture check rerun under npm 12.2.0"},
+    {"id":"evidence_and_results","path":"evidence/phase1/wp1.1/phase1-contracts-npm12.2.log","role":"Phase 1 contract validator rerun under npm 12.2.0 after gate-status correction"},
+    {"id":"review_disposition","path":"evidence/phase1/reviews/phase1-v2.1-review-disposition.md","role":"Disposition of supplied 2026-11-08 review findings"},
+    {"id":"review_disposition","path":"evidence/phase1/reviews/phase1-review-6ce5b0d8d88d-gemini-3.8-flash-v1.md","role":"Historical independent Phase 1 plan review for candidate 6ce5b0d88d; accepted/implementation authorized; does not review later amendments"},
+    {"id":"review_disposition","path":"evidence/phase1/reviews/6ce5b0d8d/sha256-manifest.json","role":"Immutable historical candidate manifest for 6ce5b0d88d; not evidence for later source or document versions"},
+    {"id":"review_disposition","path":"evidence/phase1/reviews/wp1.2-plan-review-disposition.md","role":"Disposition and implementation mapping for the supplied 2026-11-09 WP1.2 review"}
@@ -114 +143,2 @@
-    {"id":"independent_review_report","path":"evidence/phase1/reviews/phase1-review-<candidate-short-sha>-<reviewer>-vN.md","status":"required_per_review","required_for":"Review verdict and findings"}
+    {"id":"independent_review_report","path":"evidence/phase1/reviews/phase1-review-<candidate-short-sha>-<reviewer>-vN.md","status":"required_per_review","required_for":"Review verdict and findings"},
+    {"id":"wp1.2_plan_review_attachment","path":"C:\\Users\\User\\.codex\\attachments\\e3091cad-de2d-4f24-b3c4-1a44ff7e4ee1\\Pasted text.txt","sha256":"f75367a7425c8d74fad5e63f58236babc0bf8d1cbe83a43ebb0d47dac8fa4b2f","status":"provided_outside_repository; disposition captured in evidence/phase1/reviews/wp1.2-plan-review-disposition.md","required_for":"Source wording for the WP1.2 plan review findings and requested corrections"}
@@ -123 +153,3 @@
-  "review_ledger": []
+  "review_ledger": [
+    {"candidate_sha":"6ce5b0d8d88d2cd8ae057f9ebb93858c28eeb8c1","review_report":"evidence/phase1/reviews/phase1-review-6ce5b0d8d88d-gemini-3.8-flash-v1.md","candidate_manifest":"evidence/phase1/reviews/6ce5b0d8d88d/sha256-manifest.json","review_date":"2026-11-08","reviewer":"gemini-3.8-flash","disposition":"ACCEPTED / PHASE 1 IMPLEMENTATION AUTHORIZED","historical":true,"note":"Review applies only to candidate 6ce5b0d88d and its 94-document manifest; later plan/index versions require a new candidate manifest and review."}
+  ]
diff --git a/evidence/phase1/reviews/wp1.2-plan-review-disposition.md b/evidence/phase1/reviews/wp1.2-plan-review-disposition.md
new file mode 100644
index 0000000..6fbb044
--- /dev/null
+++ b/evidence/phase1/reviews/wp1.2-plan-review-disposition.md
@@ -0,0 +1,21 @@
+# WP1.2 remediation plan review disposition
+
+**Source:** User-provided review attachment dated 2026-11-09; SHA-256 `f75367a7425c8d74fad5e63f58236babc0bf8d1cbe83a43ebb0d47dac8fa4b2f`.
+**Disposition:** Targeted plan, process, and review-evidence amendments. The v2.1.2 plan was normative when reviewed; current amended execution plan is v2.1.3. No WP0 architecture decision is reopened.
+**Historical review:** The independent review report and manifest for candidate `6ce5b0d8d88d2cd8ae057f9ebb93858c28eeb8c1` remain immutable historical artifacts. They do not attest to the current amended plan or later candidate.
+
+| Finding | Disposition | Current proof / owner |
+|---|---|---|
+| WP1.2/WP1.3/WP1.4 inbox sequencing conflict | WP1.2 owns successful-command atomicity; WP1.3 proves receipt replay/concurrency without terminal inbox behavior; WP1.4 owns the terminal `VERSION_CONFLICT` receipt-plus-inbox transaction and insertion-failure rollback; WP1.6 owns the public API result/replay contract. | `Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md` WP1 task table and TDD sequence. Global terminal-conflict contract remains unchanged. |
+| Policy and authority reads outside transaction | The WP1.2 domain transaction context now explicitly includes receipt lookup/replay, aggregate lock/read, policy/authority reads and required locks, pure handler execution, and all accepted-command writes. Domain interfaces remain database-agnostic. The session-scoped tenant setter is forbidden on the command path; transaction-local `app.tenant_id` is required. | Plan WP1.2 carry-forward and transaction rules; WP1.2-A context-identity and PostgreSQL context-cleanup tests. WP2.2/WP2.4 authority models remain separately owned. |
+| Security-attempt schema and public error semantics | `DOMAIN_VIOLATION` is excluded; semantic digest is omitted absent an approved need; the table contains no payload/digest/policy details. Internal authorization classifications map to HTTP 403 `NOT_AUTHORIZED`; audit storage failure maps to retryable HTTP 503 `COMMAND_TEMPORARILY_UNAVAILABLE`. Indefinite retention is synthetic-test-only and not approval for real personal data. | Plan WP1.2 and `docs/phase1/COMMAND_TRANSACTION_CONTRACT.md`; WP1.2-B negative and failure-path assertions. |
+| Reproducible tests and migrations | WP1.2 names workspace-native domain and DB commands and includes `npm run test:db:migrations` using isolated `MIGRATION_TEST_DATABASE_URL`; migration replay, rollback/retry, no-op replay and preservation of migration 0009 receipt structure are explicit. | Plan WP1.2 exact green gate; test logs are required in the eventual WP1.2 record. |
+| Separate accepted-command and audit sub-gates | WP1.2-A and WP1.2-B are separately recorded. The common task-evidence schema requires both; an overall WP1.2 gate cannot validate as passed unless both sub-gates and their commands pass. | `evidence/phase1/task-evidence.schema.json` and focused schema validation in `tests/tooling/phase1_contracts.test.ts`. |
+| WP4.2 dependency | Removed WP4.2 → WP1.2 because purge/reseed owns a separate privileged transaction and does not reuse the command adapter. WP4.2 retains only its WP4.1 prerequisite. | Embedded plan graph and `evidence/phase1/task-dependencies.yml`. |
+| WP1.1 predecessor binding | WP1.1 implementation/evidence is committed, then its record is pinned to that exact source commit. The absence of a contemporaneous red-phase transcript remains stated as a historical evidence limitation; no test-first chronology claim is added. | `evidence/phase1/wp1.1/task-evidence.json`; commit SHA recorded after the WP1.1 commit. |
+| README completion protocol | Current remediation task completion is described using evidence records, dependency gates, and retained outputs. Checkbox instructions are limited to legacy phase documents and explicitly do not establish a current task pass. | `Implementation-Plan-V4/implementation/README.md`. |
+| Review SHA and ledger | Candidate SHA is supplied separately in the review request/packet, not embedded in the candidate index. The prior `6ce5b0d...` report and manifest are indexed as historical with their disposition. A new candidate manifest is generated only after the amended source is committed and clean; no new independent review is claimed here. | `docs/phase1/INDEPENDENT_REVIEW_GUIDE.md`; `evidence/phase1/review-document-index.json`; historical report and manifest paths. |
+
+**Current execution boundary:** WP1.1 source and its passed checks are committed at `98eb5571ca29ded9afbef191678c7bfdf92b023c`, and the WP1.1 record pins that exact immutable source commit. The WP1.2 plan amendments, dependency edge, review index entry, and pending task-evidence envelope are present. WP1.2 implementation is now authorized to start subject to its dependency gates. A candidate manifest must be generated only after the final plan/evidence commit is clean; it binds the reviewed documents to that SHA and is not itself an independent review.
+
+**Not claimed:** no WP1.2 product implementation, runtime pass, or new independent review is claimed by this disposition. The WP1.2 record is explicitly a pre-implementation envelope: all commands are `not_run`, both sub-gates are `pending`, and its planned log paths are not evidence until the runs create them.
diff --git a/evidence/phase1/task-dependencies.yml b/evidence/phase1/task-dependencies.yml
index ff0c2b8..3176544 100644
--- a/evidence/phase1/task-dependencies.yml
+++ b/evidence/phase1/task-dependencies.yml
@@ -32 +32 @@
-    "WP1.2": { "depends_on": ["WP1.1", "WP0.3"], "edge_reasons": { "WP1.1": "Transaction integration persists the receipt shape established by WP1.1.", "WP0.3": "PostgreSQL integration must execute using the approved least-privilege role and RLS context." } },
+    "WP1.2": { "depends_on": ["WP1.1", "WP0.3"], "edge_reasons": { "WP1.1": "The transaction adapter and receipt DB mapping must carry forward migration 0009, its versioned safe-result contract, and its tenant-scoped uniqueness; WP1.2 adds the separate pre-acceptance security-attempt path.", "WP0.3": "WP0.3 fixes the tenant-role/RLS contract that the adapter must preserve. WP1.2 exercises transaction behavior with isolated migration/test credentials and claims no app-role or RLS proof; WP1.5 owns those runtime grants and policies." } },
@@ -50 +50 @@
-    "WP4.2": { "depends_on": ["WP4.1", "WP1.2"], "edge_reasons": { "WP4.1": "Execution may begin only after target guards and table allowlist are proven.", "WP1.2": "The purge operation must use atomic database transactions." } },
+    "WP4.2": { "depends_on": ["WP4.1"], "edge_reasons": { "WP4.1": "The guarded purge/reseed operation starts after its target guards and table allowlist are proven; it owns a separate privileged database transaction and does not reuse the WP1.2 command transaction adapter." } },
diff --git a/evidence/phase1/task-evidence.schema.json b/evidence/phase1/task-evidence.schema.json
index e07c12e..76308b2 100644
--- a/evidence/phase1/task-evidence.schema.json
+++ b/evidence/phase1/task-evidence.schema.json
@@ -50,0 +51,29 @@
+    "sub_gates": {
+      "description": "Required separately reported WP1.2 acceptance sub-gates. Each must cite its exact commands and repository-relative output artifacts.",
+      "type": "array",
+      "minItems": 2,
+      "maxItems": 2,
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "required": ["gate_id", "status", "commands"],
+        "properties": {
+          "gate_id": { "enum": ["WP1.2-A", "WP1.2-B"] },
+          "status": { "enum": ["passed", "failed", "pending", "blocked"] },
+          "commands": {
+            "type": "array",
+            "minItems": 1,
+            "items": {
+              "type": "object",
+              "additionalProperties": false,
+              "required": ["command", "result", "artifact"],
+              "properties": {
+                "command": { "type": "string", "minLength": 1, "maxLength": 240 },
+                "result": { "enum": ["passed", "failed", "blocked", "not_run"] },
+                "artifact": { "type": "string", "pattern": "^(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+$" }
+              }
+            }
+          }
+        }
+      }
+    },
@@ -82 +111,29 @@
-  }
+  },
+  "allOf": [
+    {
+      "if": { "properties": { "task_id": { "const": "WP1.2" } }, "required": ["task_id"] },
+      "then": {
+        "required": ["sub_gates"],
+        "properties": {
+          "sub_gates": {
+            "allOf": [
+              { "contains": { "properties": { "gate_id": { "const": "WP1.2-A" } }, "required": ["gate_id"] }, "minContains": 1, "maxContains": 1 },
+              { "contains": { "properties": { "gate_id": { "const": "WP1.2-B" } }, "required": ["gate_id"] }, "minContains": 1, "maxContains": 1 }
+            ]
+          }
+        }
+      }
+    },
+    {
+      "if": {
+        "properties": {
+          "task_id": { "const": "WP1.2" },
+          "status": { "properties": { "gate_verified": { "const": "passed" } }, "required": ["gate_verified"] }
+        },
+        "required": ["task_id", "status"]
+      },
+      "then": {
+        "properties": { "sub_gates": { "items": { "properties": { "status": { "const": "passed" }, "commands": { "items": { "properties": { "result": { "const": "passed" } } } } } } } }
+      }
+    }
+  ]
diff --git a/evidence/phase1/wp1.2/task-evidence.json b/evidence/phase1/wp1.2/task-evidence.json
new file mode 100644
index 0000000..8afe346
--- /dev/null
+++ b/evidence/phase1/wp1.2/task-evidence.json
@@ -0,0 +1,91 @@
+{
+  "schema_version": 1,
+  "task_id": "WP1.2",
+  "status": {
+    "implementation": "not_started",
+    "unit_test": "pending",
+    "integration_test": "pending",
+    "bdd_ui_test": "not_applicable",
+    "gate_verified": "pending"
+  },
+  "commit": "working-tree",
+  "environment": {
+    "node": "v26.7.0",
+    "npm": "12.2.0",
+    "postgres": "18.0",
+    "database_role": "isolated migration/test credentials; application-role/RLS claims excluded",
+    "data_mode": "test",
+    "key_provider": "local-test"
+  },
+  "commands": [
+    {
+      "command": "npm run test:unit --workspace @symphony/domain -- src/kernel/__tests__/command-bus-transaction.test.ts",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/domain-transaction-tests.log"
+    },
+    {
+      "command": "npm run test:db --workspace @symphony/db -- src/__tests__/command-transaction.integration.test.ts",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/command-transaction-tests.log"
+    },
+    {
+      "command": "npm run test:db --workspace @symphony/db -- src/__tests__/security-attempt-audit.integration.test.ts",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/security-audit-tests.log"
+    },
+    {
+      "command": "npm run test:db:migrations with isolated MIGRATION_TEST_DATABASE_URL",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/migration-tests.log"
+    },
+    {
+      "command": "npm run typecheck:v4",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/typecheck-v4.log"
+    },
+    {
+      "command": "npm run verify:arch",
+      "result": "not_run",
+      "artifact": "evidence/phase1/wp1.2/verify-arch.log"
+    }
+  ],
+  "sub_gates": [
+    {
+      "gate_id": "WP1.2-A",
+      "status": "pending",
+      "commands": [
+        {
+          "command": "Accepted-command transaction atomicity, same-context policy/authority access, and rollback/retry integration tests",
+          "result": "not_run",
+          "artifact": "evidence/phase1/wp1.2/wp1.2-a-accepted-command-gate.log"
+        }
+      ]
+    },
+    {
+      "gate_id": "WP1.2-B",
+      "status": "pending",
+      "commands": [
+        {
+          "command": "Authenticated-denial security-attempt audit commit ordering, privacy, and audit-storage-failure tests",
+          "result": "not_run",
+          "artifact": "evidence/phase1/wp1.2/wp1.2-b-security-audit-gate.log"
+        }
+      ]
+    }
+  ],
+  "claims": {
+    "behavior_proved": "No WP1.2 behavior is claimed as implemented or proven. This is the pre-implementation evidence envelope; all listed commands and both sub-gates are pending.",
+    "path_proved": "None. Execute and retain each focused suite, migration run, typecheck, and architecture check listed above after implementation.",
+    "configuration_proved": "The required future test configuration is Node v26.7.0, npm 12.2.0, PostgreSQL 18.0, isolated test data, and local test keys. No database URL or credential is recorded.",
+    "coverage_limitations": [
+      "No WP1.2 implementation, runtime evidence, or independent review has been performed.",
+      "WP1.2-A accepted-command atomicity and WP1.2-B security-attempt auditing must both pass before the overall task can pass.",
+      "Application-role grants/RLS belong to WP1.5; terminal-conflict inbox behavior belongs to WP1.4; API composition belongs to WP1.6."
+    ]
+  },
+  "limitations": [
+    "This record is a planned task envelope only; not_run is not a passing result and planned artifact paths do not yet exist."
+  ],
+  "unresolved_decisions": [],
+  "reviewer": "Not reviewed; implementation has not started."
+}
```