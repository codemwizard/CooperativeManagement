# Phase 1 command transaction contract

**Contract:** `phase1-command-transaction-v2`
**Status:** Owner-approved WP0 contract; WP0 is closed and WP1 is authorized. Pure model vectors are contract evidence only; PostgreSQL/API runtime proof is assigned to WP1.1–WP1.3/WP1.6 as specified in the Phase 1 remediation plan. This status does not imply implementation or runtime proof has passed.
**Authority:** Phase 1 remediation plan v2, §2 (command, receipt, canonical payload, rotation, transaction uncertainty, rejection); `03-specification-delta.md` §9; `features/09_commands_audit_and_integrity.feature` AUD-001–004, 010, 014–016; ADR-014.

## Logical command identity

The business idempotency key is `(tenant_id, command_id)`. The receipt lookup key is separate from the semantic digest input: the validated semantic HMAC envelope includes `tenant_id`, authenticated `actor_id`, `command_type`, `command_schema_version`, canonical payload and `expected_aggregate_version` where applicable; `command_id` is excluded from the digest but stored and checked as the receipt key. A committed receipt binds all identity fields, canonicalization version, HMAC digest key version, keyed digest of the validated semantic envelope, terminal result classification and schema-validated safe result. Never persist a raw command/request in a receipt; never persist an unkeyed payload digest.

Only the accepted logical command establishes this binding. Authenticated command pre-acceptance authorization denials use an append-only, server-generated `security_attempt_id` in the tenant-scoped `security_attempts` table. The insert is permitted only after trusted actor and tenant context exist; tenant is set from authenticated server context and RLS binds it to transaction-local `app.tenant_id`. The application role receives INSERT only, with no SELECT/UPDATE/DELETE. If tenant context cannot be established, do not write this table. Unauthenticated login/CSRF/authentication attempts belong to the separate WP5 authentication/security audit path and are never inserted here. Observations contain the trusted actor and tenant, observed command ID/type, server time, and a safe internal authorization-denial classification. `actor_user_id` is a controlled pseudonymous identity reference and must be protected as personal data; it is not anonymous. The table contains no semantic digest, raw payload, raw/free-text personal data, credentials, or policy explanation. `observed_command_id` is an observational command-correlation reference; no separate request/trace correlation ID is stored. The audit writer fails closed unless the validated server-side runtime profile (`WP0.11`) confirms `DATA_MODE=test` and synthetic-only data; never trust request-supplied mode/data flags; it is disabled for real data until an approved retention policy is implemented. WP1.2 tests this mode restriction and zero inserts when mode is missing/unknown/real or test data is not synthetic. WP1.6 proves the public HTTP mapping: internal `AUTHORIZATION_DENIED` classifications map to HTTP 403 `NOT_AUTHORIZED` only after the audit commit; audit/storage or unsupported-mode failure maps to HTTP 503 `COMMAND_TEMPORARILY_UNAVAILABLE`. The public response never exposes the internal classification or policy reason. Ordinary domain/business-rule rejections are not security attempts. Observations do not reserve the business key and do not affect later authorization or receipt ownership. Do not reserve command IDs before acceptance.

## Canonical semantic envelope

RFC 8785 JCS is the only canonical byte representation, version `jcs-rfc8785-v1`. Schema validation materializes defaults and rejects unknown fields before canonicalization. Duplicate JSON object keys and invalid Unicode/lone surrogates are rejected before ordinary JSON parsing. No global Unicode normalization is applied. Schema-defined normalization occurs before canonicalization. JCS defines key order, numeric rendering and array order; semantic numeric fields must restrict their domain, and identifiers/precision-sensitive decimals use strings. Omitted and explicit `null` remain distinct.

| Field | Classification for v1 | Contract effect | Decision status |
|---|---|---|---|
| tenant, actor, type, schema version | Immutable semantic inputs | Tenant, actor, type and schema are digest inputs; tenant+command ID remains the unique lookup key | Approved by owner direction, 2026-11-07 |
| expected version, target/aggregate IDs, validated payload | Immutable semantic inputs | Included in JCS digest | Required by AUD-001–004 |
| client `occurred_at` | Untrusted client assertion / request attribution | Excluded from digest; preserve only as untrusted attribution. Never use for authoritative event ordering, authorization, expiry, or retention decisions. | Approved by owner direction, 2026-11-07 |
| device identity (`deviceId`) | Untrusted client assertion / request attribution | Excluded from digest; preserve only as untrusted attribution. Never use as an authorization factor or proof of device identity. | Approved by owner direction, 2026-11-07 |
| logical correlation ID | No separate logical-correlation field in v1 envelope | Use receipt key and immutable semantic fields; future addition requires a versioned decision | Approved by owner direction, 2026-11-07 |
| request/trace correlation ID | Per-request transport/trace metadata | Excluded; retries may carry a different value without changing digest | Approved by owner direction, 2026-11-07 |
| server `recorded_at` | PostgreSQL transaction-start observation (`now()` semantics) | Excluded; name and document as transaction-start/recording time, not exact acceptance or commit time. Do not claim it is the commit timestamp. | Required by plan |
| `command_id` | Immutable logical-command identity and receipt lookup key | Excluded from digest; stored and checked as the unique `(tenant_id, command_id)` receipt key | Approved by owner direction, 2026-11-07 |

Changing any immutable field for an existing key is key reuse and is rejected without disclosing the stored result. A schema/canonicalization version must remain available throughout receipt retention. Missing historical schema, canonicalizer or HMAC verification key fails closed with an operationally classified error; it must never execute as a new command.

## Receipt and transaction visibility

The complete receipt, business state, domain events, outbox rows and any terminal reconciliation inbox row are one PostgreSQL transaction. WP1 inserts a complete receipt only after authorization and deterministic result evaluation, then performs the state/event/outbox/inbox writes before commit. The receipt uses the composite primary key `(tenant_id, command_id)` and is invisible until commit; no pending/placeholder receipt is permitted. A failure rolls back every write. The database commit is authoritative if the response is lost. Deadlock/serialization retries are bounded and never mint a new command ID. WP1 retry behavior is fixed at three total transaction attempts for SQLSTATE `40001` and `40P01` only; all attempts retain the same logical ID and semantic envelope. Unique receipt-key contention is resolved by reading/verifying the committed receipt, not generic retry. On uncertain COMMIT, query the same key on a fresh connection; only re-enter the transaction if the lookup proves no receipt exists and the database is healthy. If outcome cannot be established, return retryable service unavailable and require client retry with the same ID. See the plan §5 for exact retry schedule and required fault-injection proof.

Replay requires a currently authenticated actor/session and matching tenant ownership. Only the original actor receives the committed safe result. Replay does not rerun the mutation and does not require current mutation authority; changed actor, tenant, schema or digest receives a non-disclosing denial. A deterministic accepted terminal evaluation, including a stale-version conflict, stores a safe terminal result atomically with its reconciliation inbox record, while aggregate/event/outbox state remains unchanged.

## Receipt retention and historical-key custody

Command receipts use the per-category retention policy key `command_receipts`. The supplied source package has no numeric receipt-retention duration. Therefore the current explicit default is indefinite retention (no time-based deletion) until a finite policy is approved and implemented. This is a material retention choice, not an unspecified TTL. It applies to the test-only profile, which contains synthetic data only; owner acceptance of this test-profile default is recorded with the approved baseline. No real-data staging or production readiness claim is allowed while retention remains indefinite/unresolved. The HMAC verification key and canonicalizer versions used by any retained receipt cannot be retired. A future finite policy must identify its approved duration, delete only under that policy, and retain each historical key/canonicalizer until evidence shows no retained receipt references it. Missing historical material fails closed and alerts; it never permits execution as a new command.

The **Project Owner** is accountable for ensuring version availability and approving any retirement. Before a non-test key provider is provisioned, the Project Owner must name the human custodian/delegate and record the secure recovery path; the current local test key is not a custody or production-readiness claim. No key material is stored in receipts, repository artifacts or logs.

## Security-attempt and receipt race table

The following outcomes are normative for the approved attempt-ID-only model. Their contract vectors are WP0 evidence; real PostgreSQL/API execution is required in the owning WP1 tasks and does not reopen WP0.

| Situation | Required outcome |
|---|---|
| Same actor, same command, concurrent submission | One transaction wins; the other resolves to the committed receipt. |
| Same actor, changed semantic payload | Reject key reuse; never overwrite or reinterpret the result. |
| Different actor, same ID | Reject without exposing receipt contents. |
| Denied attempt followed by authorized attempt | Re-evaluate authorization; denial does not reserve the ID. |
| Authorized command racing a denied attempt | Authorized command may commit if it passes D-04 linearization; denial does not bind the ID. |
| Transaction fails before commit / client disconnects during commit | Before commit: no business receipt, mutation, or outbox event. During uncertain commit: same-ID retry resolves the committed receipt if commit succeeded. |

Accepted processing never bypasses authorization because the security-attempt audit channel failed. The audit failure affects whether a denied attempt can be acknowledged as durably recorded, not business acceptance.

## HMAC rotation and operations

Use HMAC-SHA-256 with a distinct key from field encryption. Store only the key version in the receipt. New receipts use the active key; retries compute using the receipt's historical key version and compare in constant time. Retain historical verification keys at least as long as the maximum receipt retention. Retire a version only after evidence that no retained receipt needs it, approval by the named operational owner, and a documented recovery procedure. Missing key material alerts and fails closed. No key bytes appear in rows, logs or evidence.

Receipt retention duration, key custodian/operations owner, approved retirement authority and recovery path are operational configuration/evidence items still to be established. Do not invent a retention duration or claim rotation is operationally ready until recorded.

## Contract vectors and downstream WP1 acceptance

The executable model vectors in `evidence/phase1/command-contract-vectors.json` are a pure contract model, not a production canonicalizer, PostgreSQL race, transaction rollback, audit-channel or uncertain-commit test. WP1.1 proves versioned schema/default handling and historical schema/canonicalizer/key lookup; WP1.2–WP1.3 prove transaction visibility, rollback, post-commit response loss, ambiguous commit and contention; WP1.6 proves real API redaction. These are downstream implementation acceptance tests under the closed WP0 contract, not prerequisites that reopen WP0.
