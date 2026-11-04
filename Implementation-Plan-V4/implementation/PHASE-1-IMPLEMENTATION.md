# Phase 1 Implementation Plan — Kernel, Identity, Authorisation, Privacy, Shell

**Status:** Not Started (starts after Phase 0 Gate passes)  
**Version:** 1.0 — 4 November 2026  
**Authority:** `Implementation-Plan-V4/06-phased-plan.md` WP-1.1–1.9; `AI-Secure-Coding-Policy.md`  
**Gate:** Scenarios in features 09 and the privacy parts of 02 pass; roles and IFV capacity grantable and revocable with audit; no PII in any union/TA response; purge-to-seed works; `/components` accessible.

> **How to use this plan**
> Check each task box `[x]` as the task is completed. Every task that runs a test names it explicitly (file path and command). An independent verifier can re-run any named test and confirm the same result. Remove `@wip` from BDD scenarios only when the corresponding step definitions and domain code exist and are GREEN.

---

## Pre-conditions (must all be ✅ before starting WP-1.1)

- [ ] Phase 0 Gate fully passed (see `PHASE-0-IMPLEMENTATION.md`)
- [ ] `npm run verify:all` (legacy) passes at or above baseline
- [ ] `npm run verify:arch` exits 0
- [ ] `npm run db:migrate` exits 0

---

## WP-1.1 — Command bus: envelope, idempotency, optimistic concurrency, atomic commit

**REQ:** AUD-001, AUD-002, AUD-003, AUD-019 (command atomicity)  
**BDD Scenarios (feature 09):** AUD-001, AUD-002, AUD-003, AUD-004, AUD-010, AUD-016  
**Invariants:** INV-019 (command atomicity, HARD), INV-020 (idempotency, HARD)  
**Size:** L

> This is the foundation for every subsequent feature. No Phase 2+ work starts until these tests are GREEN.

### Step 1a — Write failing tests FIRST (before any implementation)

- [ ] **1.1.1** Create `packages/domain/src/kernel/__tests__/command-bus.test.ts` with the following FAILING test cases (use `testkit`'s `FakeClock` and `SequentialIds`):

  | Test name | Expected behaviour | Test method |
  |---|---|---|
  | `repeatedCommandId_doesNotApplyTwice` | A command with an already-seen `commandId` returns the stored result without re-applying | Vitest unit |
  | `staleExpectedVersion_isRejected` | A command with `expectedVersion` ≠ current aggregate version is rejected; state is unchanged | Vitest unit |
  | `dbFailure_rollsBackAll` | Simulated DB error after domain step leaves state, event and outbox tables unchanged | Vitest + in-memory repo |
  | `concurrentCommands_onlyOneWins` | Two commands with the same `expectedVersion` — only the first to commit succeeds | Vitest + PostgreSQL (L4) |
  | `crossTenantCommand_isRejected` | A command for `tenantId=A` processed by an actor from `tenantId=B` is rejected | Vitest unit |
  | `unauthorisedCommand_mutatesNothing` | A command whose policy decision is `deny` leaves no state, event or outbox record | Vitest + in-memory repo |

  Run: `npx vitest run packages/domain/src/kernel/__tests__/command-bus.test.ts`  
  _Expected output: 6 FAILED (all red — no implementation yet)._  
  _Verifier check: all 6 tests fail with "not implemented" or type errors, not runtime panics._

- [ ] **1.1.2** Create `packages/domain/src/kernel/command-envelope.ts` defining the `CommandEnvelope<TPayload>` type:
  ```typescript
  export interface CommandEnvelope<TPayload> {
    readonly commandId: string;       // idempotency key (client-generated UUID)
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly occurredAt: string;      // ISO 8601, when the action happened
    readonly recordedAt: string;      // ISO 8601, when the server saw it
    readonly deviceId: string;
    readonly expectedVersion: number;
    readonly correlationId: string;
    readonly type: string;
    readonly payload: TPayload;
  }
  ```
  No `any`. Verify: `npx tsc --build --noEmit` exits 0.

- [ ] **1.1.3** Create `packages/domain/src/kernel/command-result.ts` defining:
  ```typescript
  export type CommandResult<T> =
    | { ok: true; aggregateVersion: number; eventIds: readonly string[]; data: T }
    | { ok: false; code: CommandErrorCode; detail: string };

  export type CommandErrorCode =
    | 'IDEMPOTENT_REPLAY'
    | 'STALE_VERSION'
    | 'TENANT_MISMATCH'
    | 'UNAUTHORIZED'
    | 'PRECONDITION_FAILED'
    | 'DOMAIN_VIOLATION'
    | 'NOT_FOUND';
  ```
  No `any`.

- [ ] **1.1.4** Create `packages/domain/src/kernel/ports.ts` defining interfaces (not implementations):
  - `Repository<T>` — `load(id, tenantId): Promise<T | null>`, `save(aggregate, expectedVersion, events, outboxMessages): Promise<void>`
  - `Clock` — `now(): string`
  - `IdGen` — `generate(): string`
  - `PolicyStore` — `decide(action, target, actor, context): Promise<PolicyDecision>`
  - `KeyProvider` — `encrypt(plaintext, keyRef): Promise<Buffer>`, `decrypt(ciphertext, keyRef): Promise<Buffer>`, `hmac(value, pepper): Promise<Buffer>`
  
  _Verifier check: `npx tsc --build --noEmit` on `domain` exits 0._

- [ ] **1.1.5** Implement `packages/domain/src/kernel/command-bus.ts`:
  - Load `CommandReceipt` by `commandId`; if found, return stored result (`IDEMPOTENT_REPLAY`)
  - Verify `tenantId` matches; if not, return `TENANT_MISMATCH`
  - Load aggregate + version via `Repository`
  - Call `PolicyStore.decide()` → if `deny`, return `UNAUTHORIZED` (no mutation)
  - Validate preconditions (domain-level checks)
  - Apply domain transition → produces new state + domain events
  - Call `repository.save(newState, expectedVersion, events, outbox)` atomically
  - If `save` throws `OptimisticConcurrencyError`, return `STALE_VERSION`
  - Return `{ ok: true, aggregateVersion, eventIds }`
  
  Run: `npx vitest run packages/domain/src/kernel/__tests__/command-bus.test.ts`  
  _Expected output: 4 of 6 PASSED (the 2 PostgreSQL tests remain red until L4 step)._

- [ ] **1.1.6** Create `packages/testkit/src/repositories/in-memory-repository.ts` implementing `Repository<T>` using a `Map`. Throws `OptimisticConcurrencyError` on version mismatch.  
  Run: `npx vitest run packages/domain/src/kernel/__tests__/command-bus.test.ts`  
  _Expected output: all 6 that use in-memory repo are PASSED. The PostgreSQL concurrency test remains `@wip`._

- [ ] **1.1.7** Create `packages/db/src/repositories/postgres-repository.ts` implementing `Repository<T>` using Kysely + PostgreSQL. The `save` method wraps state + event + outbox in a single Kysely transaction. Use Testcontainers for integration tests.  
  
  Write `packages/db/src/__tests__/postgres-repository.test.ts` with:
  - `concurrentVersions_onlyOneCommits` — start two transactions simultaneously with the same `expectedVersion`; assert only one succeeds
  - `rollbackOnEventInsertFailure` — force event insert to fail; assert state row is absent
  
  Run: `npx vitest run packages/db/src/__tests__/postgres-repository.test.ts`  
  _Expected output: 2 PASSED._  
  _Verifier check: Testcontainers starts a PostgreSQL container; both tests pass._

- [ ] **1.1.8** Enable BDD scenarios for WP-1.1. Remove `@wip` from AUD-001, AUD-002, AUD-003 in `features/09_commands_audit_and_integrity.feature`. Write step definitions in `packages/testkit/src/step-definitions/kernel-steps.ts`.  
  
  Run: `npm run test:bdd -- --tags "@AUD-001 or @AUD-002 or @AUD-003"`  
  _Expected output: 3 scenarios PASSED._  
  _Verifier check: Cucumber output shows ✓ for each step in all 3 scenarios._

**Gate 1.1:** All 6 unit/command tests PASSED; 2 PostgreSQL integration tests PASSED; AUD-001, AUD-002, AUD-003 BDD scenarios GREEN; `verify:arch` still passes; legacy `verify:all` still passes.

---

## WP-1.2 — Tenancy and isolation

**REQ:** AUD-004  
**BDD Scenarios:** AUD-005, AUD-006  
**Invariants:** INV-001 (tenant isolation, HARD)  
**Size:** M

### Tasks

- [ ] **1.2.1** Write failing tests in `packages/domain/src/kernel/__tests__/tenant-isolation.test.ts`:
  - `commandForAnotherTenant_isRejected` — actor from tenant A cannot issue commands to tenant B aggregate
  - `repositoryLoad_neverReturnsAnotherTenantsRecord` — `load` with tenant A never returns a record owned by tenant B, even if the aggregate ID matches
  - `eventsFromAnotherTenant_notVisible` — event query scoped to tenant A never returns tenant B events
  
  Run: `npx vitest run packages/domain/src/kernel/__tests__/tenant-isolation.test.ts`  
  _Expected output: 3 FAILED (red)._

- [ ] **1.2.2** Implement tenant-scoped `load` in `postgres-repository.ts`: all SELECT queries include `WHERE tenant_id = $tenantId`. Add a Row-Level Security policy on `domain_events` and `command_receipts` as a defence-in-depth layer (not the primary control).  
  
  Run: `npx vitest run packages/domain/src/kernel/__tests__/tenant-isolation.test.ts`  
  _Expected output: 3 PASSED._

- [ ] **1.2.3** Remove `@wip` from AUD-005, AUD-006 in `features/09_commands_audit_and_integrity.feature`. Write step definitions.  
  
  Run: `npm run test:bdd -- --tags "@AUD-004 or @AUD-005 or @AUD-006"`  
  _Expected output: 3 scenarios PASSED._

**Gate 1.2:** Tenant isolation tests PASSED; AUD-004, AUD-005, AUD-006 BDD GREEN.

---

## WP-1.3 — Event store (append-only), outbox worker stub

**REQ:** AUD-001  
**BDD Scenarios:** AUD-010, AUD-016  
**Invariants:** INV-018 (events append-only, HARD)  
**Size:** M

### Tasks

- [ ] **1.3.1** Write failing tests in `packages/db/src/__tests__/event-store.test.ts`:
  - `appendedEvent_cannotBeUpdated` — INSERT an event then attempt UPDATE; expect database exception
  - `appendedEvent_cannotBeDeleted` — INSERT an event then attempt DELETE; expect database exception
  - `outboxRecord_deliveredAtSetOnce` — set `delivered_at` once; second SET throws or is ignored

  Run: `npx vitest run packages/db/src/__tests__/event-store.test.ts`  
  _Expected output: 3 FAILED (red)._

- [ ] **1.3.2** Confirm immutability triggers exist on `domain_events` (created in WP-0.4.2). Run the failing tests.  
  _Expected output after trigger verification: 3 PASSED._

- [ ] **1.3.3** Create `packages/api/src/outbox-worker.ts` as a stub that polls `event_outbox` for undelivered records and marks them `delivered`. Worker is not started in Phase 1 (no consumers); only the polling query and the atomic mark are implemented.  
  
  Write `packages/api/src/__tests__/outbox-worker.test.ts`:
  - `undeliveredRecord_isPolled` — insert an outbox record; call poll; expect it appears in the result
  - `deliveredRecord_isNotReturned` — insert a delivered record; call poll; expect it is excluded
  
  Run: `npx vitest run packages/api/src/__tests__/outbox-worker.test.ts`  
  _Expected output: 2 PASSED._

- [ ] **1.3.4** Remove `@wip` from AUD-010, AUD-016 in `features/09_commands_audit_and_integrity.feature`.  
  
  Run: `npm run test:bdd -- --tags "@AUD-010 or @AUD-016"`  
  _Expected output: 2 scenarios PASSED._

**Gate 1.3:** Immutability tests PASSED; outbox worker tests PASSED; AUD-010, AUD-016 BDD GREEN.

---

## WP-1.4 — testkit: in-memory repository and repository contract suite

**REQ:** `05-tdd-strategy.md` §4 (L4 repository contract)  
**BDD Scenarios:** none (infrastructure)  
**Size:** M

### Tasks

- [ ] **1.4.1** Write the repository contract suite `packages/testkit/src/contract-suite/repository-contract.ts`. This is a parameterised test suite that accepts a `Repository` factory and runs the same tests against any implementation:
  - `save_thenLoad_returnsSameData`
  - `save_withWrongVersion_throws`
  - `save_thenLoad_forDifferentTenant_returnsNull`
  - `save_eventAndOutbox_inSameTransaction`
  - `load_nonExistent_returnsNull`
  
  _Verifier check: suite file compiles._

- [ ] **1.4.2** Run the contract suite against the in-memory repository:  
  `npx vitest run packages/testkit/src/__tests__/in-memory-repository-contract.test.ts`  
  _Expected output: 5 PASSED._

- [ ] **1.4.3** Run the contract suite against the PostgreSQL repository (Testcontainers):  
  `npx vitest run packages/db/src/__tests__/postgres-repository-contract.test.ts`  
  _Expected output: 5 PASSED._

**Gate 1.4:** Repository contract suite exists; passes against both implementations; 10 total tests PASSED.

---

## WP-1.5 — Authentication: users, sessions, temporary credentials, authentication events

**REQ:** ENR-010, ENR-004  
**BDD Scenarios:** ENR-003, ENR-004 (from feature 01, partial), PRV-001, PRV-002 (feature 02)  
**Invariants:** INV-021 (client cannot assert verified/authority, HARD)  
**Size:** M

### Tasks

- [ ] **1.5.1** Write failing tests in `packages/domain/src/identity/__tests__/auth.test.ts`:
  - `temporaryCredential_isHashedArgon2id` — credential stored as Argon2id hash; plaintext never retrievable
  - `temporaryCredential_singleUse` — second login with same temp credential is rejected with `CREDENTIAL_ALREADY_USED`
  - `temporaryCredential_isExpiredAfterDefault72h` — presenting a credential 73 hours after issue returns `CREDENTIAL_EXPIRED`
  - `firstLogin_requiresPasswordChange` — login with temp credential forces password-change flag; subsequent commands require a new password first
  - `authenticationEvent_containsNoPII` — the `authentication_events` row for a successful login contains no NRC, name or email string
  - `credential_neverAppearsInEventPayload` — command receipt for `ChangePassword` has no password field in its `payload` column

  Run: `npx vitest run packages/domain/src/identity/__tests__/auth.test.ts`  
  _Expected output: 6 FAILED (red)._

- [ ] **1.5.2** Implement `packages/domain/src/identity/auth-service.ts`:
  - Use `argon2id` via the `argon2` npm package for credential hashing
  - `issueTemporaryCredential(userId, ttlHours)` — hash + expiry; never store plaintext
  - `verifyCredential(userId, plaintext)` — check hash + expiry + used flag
  - On first login: set `forced_change_required = true`; emit `TemporaryCredentialUsed` event
  - `AuthenticationEvent` payload: `{ userId, method, result, deviceId, occurredAt }` — no PII
  
  _AI-Secure-Coding-Policy check before proceeding:_
  - ✅ Input validated (credential not empty, ttlHours > 0)
  - ✅ No `any` types
  - ✅ No plaintext credential in events or logs
  - ✅ Errors classified (`CREDENTIAL_EXPIRED`, `CREDENTIAL_ALREADY_USED`, `INVALID_CREDENTIAL`)
  
  Run: `npx vitest run packages/domain/src/identity/__tests__/auth.test.ts`  
  _Expected output: 6 PASSED._

- [ ] **1.5.3** Create `packages/api/src/routes/auth.ts` with Fastify routes:
  - `POST /auth/login` — Zod-validated body `{ userId, credential, deviceId }`. Returns `{ sessionToken, forcedChangeRequired }`. No credential in response body.
  - `POST /auth/change-password` — Zod-validated body `{ userId, currentCredential, newPassword }`. Requires auth.
  
  Write `packages/api/src/__tests__/auth-routes.test.ts` using Supertest:
  - `POST /auth/login with valid temp cred` → 200; session token in response
  - `POST /auth/login with expired cred` → 401; error code `CREDENTIAL_EXPIRED`
  - `POST /auth/login twice with same temp cred` → second call returns 401 `CREDENTIAL_ALREADY_USED`
  - `Response body contains no NRC pattern` — scan response for `\d{6}\/\d{2}\/\d`
  
  Run: `npx vitest run packages/api/src/__tests__/auth-routes.test.ts`  
  _Expected output: 4 PASSED._

- [ ] **1.5.4** Remove `@wip` from ENR-003, ENR-004 and PRV-001, PRV-002 in features 01 and 02.  
  
  Run: `npm run test:bdd -- --tags "@ENR-003 or @ENR-004 or @PRV-001 or @PRV-002"`  
  _Expected output: scenarios PASSED._

**Gate 1.5:** 6 auth unit tests PASSED; 4 API tests PASSED; relevant BDD scenarios GREEN; no plaintext credential ever stored or logged.

---

## WP-1.6 — Authorisation engine: roles, capacities, IFV, delegations

**REQ:** VER-001, VER-007, UNI-001  
**BDD Scenarios:** VER-001, VER-002, VER-003, VER-004, VER-015 (feature 05); AUD-008, AUD-009 (feature 09)  
**Invariants:** INV-011 (no self-verification, HARD), INV-024 (read-only institutions cannot mutate, HARD)  
**Size:** L

### Tasks

- [ ] **1.6.1** Write failing tests in `packages/domain/src/authz/__tests__/policy.test.ts`:
  - `grantCapacity_IFV_allowedByChairperson` — Chairperson can grant `internal_verifier` capacity
  - `grantCapacity_IFV_deniedToSecretary` — Secretary cannot grant IFV capacity
  - `IFV_cannotVerifyOwnSuppliedVersion` — `decide('RecordFinding', version, ifvUser)` where ifvUser is the supplier → `deny`
  - `IFV_boundToOrganisation_cannotActOnAnother` — IFV for org A trying to act on org B version → `deny`
  - `institutionalRole_cannotWriteEvidence` — `pfi_analyst` attempting `AddEvidence` → `deny`
  - `revokedCapacity_isNoLongerEffective` — after revocation at time T, calls at T+1 return `deny`
  - `delegation_extendsCapacity` — a delegated capacity is effective within its scope and expiry
  
  Run: `npx vitest run packages/domain/src/authz/__tests__/policy.test.ts`  
  _Expected output: 7 FAILED (red)._

- [ ] **1.6.2** Implement `packages/domain/src/authz/policy-engine.ts` as a pure function:
  ```typescript
  decide(
    action: string,
    target: PolicyTarget,
    actor: ActorContext,
    context: PolicyContext
  ): PolicyDecision
  ```
  Where `PolicyDecision = 'allow' | 'allow_with_label' | 'advise' | 'deny'`  
  
  Input types must NOT use `any`. `ActorContext` includes: `userId`, `tenantId`, `platformRoles`, `capacities` (with org scope + expiry), `appointments` (current), `delegations`.  
  
  Run: `npx vitest run packages/domain/src/authz/__tests__/policy.test.ts`  
  _Expected output: 7 PASSED._

- [ ] **1.6.3** Write policy table tests `packages/domain/src/authz/__tests__/policy-table.test.ts` using `test.each` from JSON fixture `packages/testkit/src/fixtures/policy-table.json`. Fixture covers:
  - Every IFV conflict rule (supplier, collector, admitter — HARD, POLICY)
  - Every default role/capacity seeded in `03` §2.1
  - `union_ta` / `institution` read-only rules
  
  Run: `npx vitest run packages/domain/src/authz/__tests__/policy-table.test.ts`  
  _Expected output: N PASSED (N = number of fixture rows)._  
  _Verifier check: fixture has ≥ 20 rows covering all role/capacity combinations listed in `03` §2.1._

- [ ] **1.6.4** Create `packages/domain/src/authz/capacity-service.ts` implementing:
  - `GrantCapacity` command handler — validates granter authority, records `CapacityGranted` event
  - `RevokeCapacity` command handler — records `CapacityRevoked` event; revocation annotates past findings
  
  Run: `npx vitest run packages/domain/src/authz/__tests__/capacity-service.test.ts`  
  _Expected output: 4 PASSED (grant allowed, grant denied, revoke, revoke-annotates-finding)._

- [ ] **1.6.5** Remove `@wip` from VER-001, VER-002, VER-003, VER-004, VER-015, AUD-008, AUD-009.  
  
  Run: `npm run test:bdd -- --tags "@VER-001 or @VER-002 or @VER-003 or @VER-004 or @VER-015 or @AUD-008 or @AUD-009"`  
  _Expected output: 7 scenarios PASSED._

**Gate 1.6:** 7 policy unit tests PASSED; ≥20 policy table tests PASSED; 4 capacity-service tests PASSED; 7 BDD scenarios GREEN. `verify:arch` confirms no DB import in `packages/domain`.

---

## WP-1.7 — PII vault, KeyProvider, blind index, consent, masking serialiser, retention policy

**REQ:** PRV-001, PRV-002, PRV-003, PRV-004, PRV-005, PRV-008, PRV-009, PRV-010  
**BDD Scenarios:** PRV-003, PRV-004, PRV-005, PRV-006, PRV-007 (feature 02)  
**Invariants:** INV-014 (disputes retained, PII erasure carve-out, HARD)  
**Size:** L

> [!CAUTION]
> PII protection is foundational. The system must never store personal identifiers unencrypted or allow them to appear in event payloads, logs, or institutional responses. Establish and test these boundaries before any member data is handled.

### Tasks

- [ ] **1.7.1** Write failing tests in `packages/domain/src/privacy/__tests__/pii-vault.test.ts`:
  - `encrypt_thenDecrypt_returnsSamePlaintext` — AES-256-GCM round-trip
  - `differentPersonKeys_producesDifferentCiphertext` — same plaintext, different key refs → different ciphertexts
  - `blindIndex_matchesSamePlaintext` — HMAC of "John" matches HMAC of "John"; HMAC of "John" does not match "JOHN" (normalise before HMAC)
  - `blindIndex_differentPepper_doesNotMatch` — different pepper → different blind index
  - `cryptoShred_keyDeleted_ciphertextUnreadable` — after `deleteKey(keyRef)`, `decrypt` throws `KEY_DELETED`
  - `nrcPattern_neverInEventPayload` — after storing a person with NRC, assert no event payload matches `\d{6}\/\d{2}\/\d`
  - `nrcPattern_neverInLog` — log scrubber test: insert NRC into test logger, assert scrubber catches it
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/pii-vault.test.ts`  
  _Expected output: 7 FAILED (red)._

- [ ] **1.7.2** Implement `packages/domain/src/privacy/key-provider.ts` interface + `LocalDevKeyProvider`:
  - Generates per-person data keys; wraps them with a local root key (from env, never hardcoded)
  - `encrypt(plaintext, keyRef)` → AES-256-GCM ciphertext + IV + auth tag
  - `decrypt(ciphertext, keyRef)` → plaintext
  - `hmac(value, pepper)` → HMAC-SHA-256
  - `deleteKey(keyRef)` → marks key as deleted; subsequent decrypt throws `KEY_DELETED`
  
  _AI-Secure-Coding-Policy check:_
  - ✅ Root key from environment variable only — never hardcoded
  - ✅ No `any` types
  - ✅ Errors classified (`KEY_DELETED`, `DECRYPT_FAILED`, `KEY_NOT_FOUND`)
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/pii-vault.test.ts`  
  _Expected output: 7 PASSED._

- [ ] **1.7.3** Create `packages/domain/src/privacy/consent-service.ts` implementing:
  - `RecordConsent` command — records `consent_records` row with `lawful_basis` (from O-19: `legal_obligation` for statutory register fields; `consent` for other PII)
  - `WithdrawConsent` command — sets `withdrawn_at`; triggers retention-policy evaluation
  - Public register fields (name, address, occupation, date registered) use `lawful_basis = 'legal_obligation'` and are never covered by `WithdrawConsent` alone

  Write `packages/domain/src/privacy/__tests__/consent.test.ts`:
  - `recordConsent_before_PII_entry` — consent must exist before PII is stored; command without consent returns `PRECONDITION_FAILED`
  - `withdrawConsent_triggersRetentionEvaluation` — withdrawal event triggers retention policy lookup
  - `publicRegisterFields_useLegalObligation_notConsent` — name/address/occupation/date fields have basis `legal_obligation`
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/consent.test.ts`  
  _Expected output: 3 PASSED._

- [ ] **1.7.4** Create `packages/api/src/serialisers/masking-serialiser.ts` that strips or masks fields based on the viewer's role:
  - `union_ta`, `institution` roles → all `person_identifier` fields replaced with `[MASKED]`; member PII removed
  - Cooperative officials → see their own records; other members masked per `PRV-003`
  - Public inspection → statutory fields only: name, address, occupation, date registered (O-19)
  
  Write `packages/api/src/__tests__/masking-serialiser.test.ts`:
  - `unionRole_response_containsNoPII` — assert no string matching `\d{6}\/\d{2}\/\d` or email pattern in union response
  - `institutionalRole_response_containsNoPII` — same for lender role
  - `cooperativeOfficer_response_containsOwnData` — officer sees their own record
  - `publicInspection_showsOnlyStatutoryFields` — fields beyond name/address/occupation/date are absent
  
  Run: `npx vitest run packages/api/src/__tests__/masking-serialiser.test.ts`  
  _Expected output: 4 PASSED._

- [ ] **1.7.5** Write `packages/domain/src/privacy/__tests__/retention.test.ts`:
  - `memberDataRetention_twoYearFloor` — retention policy for membership data enforces 2-year floor post-cessation (O-23 / Act ss.34, 37(6))
  - `cryptoShred_keepsTransactionFacts` — after shred, transaction rows remain under pseudonymous id; personal fields return `KEY_DELETED`
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/retention.test.ts`  
  _Expected output: 2 PASSED._

- [ ] **1.7.6** Remove `@wip` from PRV-003, PRV-004, PRV-005, PRV-006, PRV-007 in `features/02_identity_privacy_and_access.feature`.  
  
  Run: `npm run test:bdd -- --tags "@PRV-003 or @PRV-004 or @PRV-005 or @PRV-006 or @PRV-007"`  
  _Expected output: 5 scenarios PASSED._

**Gate 1.7:** 7 PII vault tests PASSED; 3 consent tests PASSED; 4 masking serialiser tests PASSED; 2 retention tests PASSED; 5 BDD scenarios GREEN. Assert: no NRC pattern in any event payload or log line.

---

## WP-1.8 — Test-data mode: purge-to-seed, residency switch, identifier guard

**REQ:** PRV-007  
**BDD Scenarios:** PRV-009, PRV-010, PRV-011 (feature 02)  
**Size:** M

### Tasks

- [ ] **1.8.1** Write failing tests in `packages/domain/src/privacy/__tests__/test-data-mode.test.ts`:
  - `testMode_rejectsRealNRC` — `DATA_MODE=test`; submit `123456/78/1`; expect `INVALID_TEST_IDENTIFIER`
  - `testMode_acceptsSyntheticNRC` — `DATA_MODE=test`; submit `TS0001/01/1`; expect accepted
  - `testMode_rejectsRealCoopRegNumber` — a real 11-digit number starting with a non-test prefix is rejected in test mode
  - `testMode_acceptsSyntheticCoopRegNumber` — `00000000001` (11 digits, test corpus range) is accepted
  - `realMode_outsideApprovedRegion_refusesToStart` — `DATA_MODE=real` without `DATA_RESIDENCY_REGION` on approved list throws at startup
  - `purgeToSeed_removesAllTenantData` — after `purge_to_seed()`, all cooperative, member and evidence rows are absent; seed rows present; purge audit record exists
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/test-data-mode.test.ts`  
  _Expected output: 6 FAILED (red)._

- [ ] **1.8.2** Implement `packages/domain/src/privacy/data-mode-guard.ts`:
  - `validateIdentifier(identifier, type, mode)` — in test mode, checks synthetic pattern; in real mode, NRC check is advisory only (PRV-009)
  - `enforceResidency(mode, region)` — in real mode, throws if region not in approved list
  
  Implement `npm run purge:seed` script: truncates all tenant data tables; re-runs seeds; writes purge audit record.
  
  Run: `npx vitest run packages/domain/src/privacy/__tests__/test-data-mode.test.ts`  
  _Expected output: 6 PASSED._

- [ ] **1.8.3** Remove `@wip` from PRV-009, PRV-010, PRV-011.  
  
  Run: `npm run test:bdd -- --tags "@PRV-009 or @PRV-010 or @PRV-011"`  
  _Expected output: 3 scenarios PASSED._

**Gate 1.8:** 6 data-mode tests PASSED; `npm run purge:seed` works; PRV-009–011 BDD GREEN.

---

## WP-1.9 — Workspace shell, routing, context bar, persona navigation, DemoPanel, shell screens

**REQ:** UXW-001, UXW-002, UXW-003, UXW-004, EXT-001  
**BDD Scenarios:** UXW-001..005 from feature 10 (workspace); UXW-015 (audience labels)  
**Size:** L

### Tasks

- [ ] **1.9.1** Set up `apps/workspace` as a Vite + React + React Router app. Add `npm run dev:workspace` and `npm run build:workspace` scripts.  
  _Verifier check: `npm run dev:workspace` starts on port 5174 (or configured port); no compile errors._

- [ ] **1.9.2** Create the workspace shell layout with:
  - Left navigation by area: Identity, Enrolment and authority, By-laws and requirements, Governance, People and appointments, Meetings and resolutions, Committees, Audit and education, Evidence register, Findings and next actions
  - Organisation header bar with organisation name, enrolment status, and pipeline stage
  - Right-hand provenance drawer (skeleton — full implementation Phase 2)
  - Every area shows the **capability-gap chip** when the backing module is `not_implemented` (from `capability_registry`)
  
  _Verifier check: `npm run dev:workspace` renders the shell; left navigation shows all areas._

- [ ] **1.9.3** Create `apps/workspace/src/presenters/present-evidence.ts` and `apps/workspace/src/presenters/present-requirement.ts` as the ONLY place that maps internal status enums to display vocabulary. Add a test:
  - `presenterTest_noSnakeCaseInOutput` — assert no string containing `_` reaches the rendered HTML of a StatusChip
  - `presenterTest_noBannedWords` — assert "compliant", "certified" (without authority), bare "verified" do not appear
  
  Run: `npx vitest run apps/workspace/src/__tests__/presenter.test.ts`  
  _Expected output: 2 PASSED._

- [ ] **1.9.4** Create the `DemoPanel` component, mounted ONLY when `VITE_DEMO=true`. Includes: persona switcher (dev only), reset button, demo date display.  
  _Verifier check: in production build (`VITE_DEMO=false`), `DemoPanel` component is absent from the bundle (check with `npm run build:workspace` then `grep -r "DemoPanel" dist/`)._

- [ ] **1.9.5** Create the `/login` route with form fields: email/userId, password. On submit, calls `POST /auth/login`. Redirects to `/workspace` on success; shows error on failure.  
  
  Write Playwright test `tests/workspace/login.spec.ts`:
  - `validCredentials_redirectsToWorkspace`
  - `invalidCredentials_showsErrorMessage`
  - `temporaryCredential_promptsPasswordChange`
  
  Run: `npx playwright test tests/workspace/login.spec.ts`  
  _Expected output: 3 PASSED._

- [ ] **1.9.6** Create the capability registry display in the workspace. Each left-nav area that is not yet implemented shows a `CapabilityGap` chip with the module name and status `not_implemented`.  
  
  Run a11y check: `npm run test:a11y`  
  _Expected output: 0 axe violations._

- [ ] **1.9.7** Remove `@wip` from UXW-001, UXW-002, UXW-003, UXW-004, UXW-015 in `features/10_workspace_and_capabilities.feature`.  
  
  Run: `npm run test:bdd -- --tags "@UXW-001 or @UXW-002 or @UXW-003 or @UXW-004 or @UXW-015"`  
  _Expected output: 5 scenarios PASSED._

**Gate 1.9:** Shell renders; login route works; presenter tests PASSED; `DemoPanel` absent from production bundle; 3 Playwright login tests PASSED; 5 BDD scenarios GREEN; 0 axe violations.

---

## Phase 1 Gate

Verify ALL of the following before marking Phase 1 complete:

- [ ] **BDD:** `npm run test:bdd -- --tags "not @wip"` exits 0 — all enabled scenarios GREEN
  - Feature 09: AUD-001..006, AUD-008..010, AUD-016
  - Feature 02: PRV-001..007, PRV-009..011
  - Feature 05: VER-001..004, VER-015
  - Feature 10: UXW-001..004, UXW-015
  - Feature 01 (partial): ENR-003, ENR-004

- [ ] **Legacy:** `npm run verify:all` passes at or above baseline counts

- [ ] **Architecture:** `npm run verify:arch` exits 0 — `packages/domain` has no forbidden imports

- [ ] **Types:** `npx tsc --build --noEmit` exits 0 on the full project

- [ ] **Traceability:** `npm run verify:trace` exits 0 — no orphaned REQs or WPs

- [ ] **Privacy assertions:**
  - `npx vitest run packages/domain/src/privacy` — all tests PASSED
  - Scan: `grep -rE "\d{6}/\d{2}/\d" packages/ apps/` — 0 matches in production source (only in test fixture comments)

- [ ] **UI:** `npm run test:a11y` exits 0 — 0 axe violations on `/components` and `/login`

- [ ] **Playwright:** `npx playwright test tests/workspace/login.spec.ts` — 3 PASSED

- [ ] **IFV capacity:** Demonstrated by running BDD scenario VER-001 with both grant and revoke paths

- [ ] **Purge-to-seed:** `npm run purge:seed` runs without error; `npm run verify:all` still passes after purge

- [ ] **No feature-code from Phase 2:** No Phase 2 domain code (enrolment state machine, evidence model, IFV workflow) exists in any file

**Phase 1 is complete when all gate checks above are ✅.**

---

## Appendix: Test scripts summary for Phase 1

| Script | What it runs | Phase 1 scope |
|---|---|---|
| `npm run test:unit` | Vitest on `packages/domain/**` | All domain unit and policy tests |
| `npm run test:command` | Vitest on domain command handlers with in-memory repos | WP-1.1, 1.2, 1.5, 1.6, 1.7, 1.8 |
| `npm run test:db` | Vitest + Testcontainers on `packages/db/**` | WP-1.1 (PostgreSQL concurrency), WP-1.3, WP-1.4 |
| `npm run test:api` | Supertest on `apps/api/**` | WP-1.5 (auth routes), WP-1.7 (masking) |
| `npm run test:bdd` | Cucumber.js on enabled (non-`@wip`) scenarios | Incremental — per WP as `@wip` is removed |
| `npm run test:ui` | Playwright on `tests/workspace/**` | WP-1.9 (login, shell) |
| `npm run test:a11y` | `@axe-core/playwright` on workspace routes | WP-0.9, WP-1.9 |
| `npm run verify:arch` | dependency-cruiser on all packages | Continuous |
| `npm run verify:trace` | Traceability tool | Continuous |
| `npm run verify:all` | Legacy Vitest + Playwright + Python oracle | Continuous — must stay green |
| `npm run verify:v4` | All of the above Phase 1 scripts combined | Phase 1 gate |

## Appendix: AI-Secure-Coding-Policy compliance checklist per WP

Before marking any WP done, the agent MUST confirm in writing:

| Requirement | WP confirmed ✅ |
|---|---|
| Input validation present | 1.1 / 1.5 / 1.6 / 1.7 / 1.8 / 1.9 |
| Parameterised queries (Kysely; no string concatenation) | 1.1 / 1.2 / 1.3 / 1.7 |
| Transaction boundaries explicit | 1.1 / 1.3 |
| Error classification (typed codes, not generic `catch`) | 1.1 / 1.5 / 1.6 / 1.7 / 1.8 |
| Structured logging (no PII) | 1.5 / 1.7 |
| Type safety (`any` prohibited) | All WPs |
| Resource limits (query limits, pagination) | 1.3 (outbox polling batch size) |

