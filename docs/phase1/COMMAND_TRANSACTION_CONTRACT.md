# Phase 1 command transaction contract

**Contract:** `phase1-command-transaction-v1`  
**Status:** Owner-approved contract baseline (approval assumed at user direction, 2026-11-07); pure model vectors partially pass; DB/API runtime proof remains pending before WP1.
**Authority:** Phase 1 remediation plan v2, §2 (command, receipt, canonical payload, rotation, transaction uncertainty, rejection); `03-specification-delta.md` §9; `features/09_commands_audit_and_integrity.feature` AUD-001–004, 010, 014–016; ADR-014.

## Logical command identity

The business idempotency key is `(tenant_id, command_id)`. The receipt lookup key is separate from the semantic digest input: the validated semantic HMAC envelope includes `tenant_id`, authenticated `actor_id`, `command_type`, `command_schema_version`, canonical payload and `expected_aggregate_version` where applicable; `command_id` is excluded from the digest but stored and checked as the receipt key. A committed receipt binds all identity fields, canonicalization version, HMAC digest key version, keyed digest of the validated semantic envelope, terminal result classification and schema-validated safe result. Never persist a raw command/request in a receipt; never persist an unkeyed payload digest.

Only the accepted logical command establishes this binding. Pre-acceptance denials use an append-only, server-generated `security_attempt_id`. Security-attempt observations may contain trusted actor/tenant, observed command ID/type, time, keyed digest and a safe denial code, but no raw payload or PII. They do not reserve the business key and do not affect later authorization or receipt ownership. Do not reserve command IDs before acceptance.

## Canonical semantic envelope

RFC 8785 JCS is the only canonical byte representation, version `jcs-rfc8785-v1`. Schema validation materializes defaults and rejects unknown fields before canonicalization. Duplicate JSON object keys and invalid Unicode/lone surrogates are rejected before ordinary JSON parsing. No global Unicode normalization is applied. Schema-defined normalization occurs before canonicalization. JCS defines key order, numeric rendering and array order; semantic numeric fields must restrict their domain, and identifiers/precision-sensitive decimals use strings. Omitted and explicit `null` remain distinct.

| Field | Classification for v1 | Contract effect | Decision status |
|---|---|---|---|
| tenant, actor, type, schema version | Immutable semantic inputs | Tenant, actor, type and schema are digest inputs; tenant+command ID remains the unique lookup key | Approved by owner direction, 2026-11-07 |
| expected version, target/aggregate IDs, validated payload | Immutable semantic inputs | Included in JCS digest | Required by AUD-001–004 |
| client `occurred_at` | Request/audit metadata | Excluded from digest; preserve for attribution, and store server acceptance/commit timestamps separately | Approved by owner direction, 2026-11-07 |
| device identity | Request/audit metadata | Excluded from digest; preserve for attribution only | Approved by owner direction, 2026-11-07 |
| logical correlation ID | No separate logical-correlation field in v1 envelope | Use receipt key and immutable semantic fields; future addition requires a versioned decision | Approved by owner direction, 2026-11-07 |
| request/trace correlation ID | Per-request transport/trace metadata | Excluded; retries may carry a different value without changing digest | Approved by owner direction, 2026-11-07 |
| server `recorded_at` | Per-request server observation | Excluded | Required by plan |
| `command_id` | Immutable logical-command identity and receipt lookup key | Excluded from digest; stored and checked as the unique `(tenant_id, command_id)` receipt key | Approved by owner direction, 2026-11-07 |

Changing any immutable field for an existing key is key reuse and is rejected without disclosing the stored result. A schema/canonicalization version must remain available throughout receipt retention. Missing historical schema, canonicalizer or HMAC verification key fails closed with an operationally classified error; it must never execute as a new command.

## Receipt and transaction visibility

Receipt reservation, business state, domain events, outbox rows and final safe result are one PostgreSQL transaction. A reservation is not a replayable terminal receipt until the transaction commits; no pending or partial result is visible. The database commit is authoritative if the response is lost. A retry uses the same logical ID and resolves the committed result or proceeds only if the prior owner rolled back. Ambiguous commits are resolved by querying/retrying under the same key. Deadlock/serialization retries are bounded and never mint a new command ID.

Replay requires a currently authenticated actor/session and matching tenant ownership. Only the original actor receives the committed safe result. Replay does not rerun the mutation and does not require current mutation authority; changed actor, tenant, schema or digest receives a non-disclosing denial. A deterministic accepted terminal evaluation, including a stale-version conflict, stores a safe terminal result atomically with its reconciliation inbox record, while aggregate/event/outbox state remains unchanged.

## Receipt retention and historical-key custody

Command receipts use the per-category retention policy key `command_receipts`. The supplied source package has no numeric receipt-retention duration, so WP0 sets no invented TTL: until an approved policy entry defines a finite period, receipts are retained without time-based deletion and the HMAC verification key/canonicalizer versions used by any retained receipt cannot be retired. A future finite policy must identify its approved duration, expire/delete receipts only under that policy, and retain each historical key/canonicalizer until evidence shows no retained receipt references it. Missing historical material fails closed and alerts; it never permits execution as a new command.

The **Project Owner** is accountable for ensuring version availability and approving any retirement. Before a non-test key provider is provisioned, the Project Owner must name the human custodian/delegate and record the secure recovery path; the current local test key is not a custody or production-readiness claim. No key material is stored in receipts, repository artifacts or logs.

## Security-attempt and receipt race table

The following outcomes are normative for the approved attempt-ID-only model. They require executable tests before WP1.

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

## Contract-vector coverage before WP1

The current executable model vectors pin JCS ordering/number behavior, duplicate-key and invalid-Unicode rejection, semantic-field versus request-metadata classification, historical HMAC key lookup, and the seven sequential attempt/receipt outcomes in `evidence/phase1/command-contract-vectors.json`. They are a pure contract model, not a production canonicalizer, PostgreSQL race, transaction rollback, audit-channel or uncertain-commit test. Remaining required vectors include schema default materialization/unknown-field rejection, historical schema/canonicalizer lookup, actual audit failure, invisible reservation/rollback, post-commit response loss, ambiguous commit, concurrent owner contention, stale terminal receipt and redaction through the real DB/API path. No canonicalization implementation is authorized by this WP0 document.
