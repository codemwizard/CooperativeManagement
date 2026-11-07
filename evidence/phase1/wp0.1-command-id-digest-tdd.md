# WP0.1 TDD evidence: command ID lookup key is excluded from the semantic digest

- Date: 2026-11-07
- Scope: Pure command-contract oracle and fixed RFC 8785/JCS + HMAC-SHA-256 vector. This is not PostgreSQL transaction evidence.
- Normative requirement: `Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md` §2, receipt identity: `(tenant_id, command_id)` is the lookup key; digest input excludes `command_id` and contains tenant, authenticated actor, command type/schema, validated payload and expected aggregate version when applicable.

## Red

Temporarily restored `command_id` to the oracle's HMAC input while retaining the new assertion that changing only the lookup ID does not alter the digest:

```text
node node_modules/vitest/vitest.mjs run tests/tooling/phase1_contracts.test.ts -t "excludes command_id lookup identity"
```

Result: **failed as required**. Changing `command-01` to `command-02` changed the digest from the approved fixture value `e0c4a76a...` to `0d6fb83f...`. This reproduced the incorrect behavior.

## Green

Removed `command_id` from `SEMANTIC_FIELDS`, while keeping it required by the command input and using `(tenant_id, command_id)` as the attempt model's separate receipt map key. The same focused command then passed: **1 passed, 48 skipped**. The complete focused WP0 tooling suite subsequently passed: **77 tests**.

The fixed canonical semantic JSON omits `command_id`; its fixture HMAC is `e0c4a76ac4635a61968674d91793825452fa0efa1a163b72beaadd6ff0bb3f8e`. Historical-key verification was recomputed against that same semantic profile. The test suite also proves metadata exclusion, semantic-field sensitivity, duplicate-key/invalid-Unicode rejection, retained historical-key lookup, denial without reservation, authorized stale-conflict receipt behavior, and distinct tenant-scoped lookup keys.

Follow-up test-first additions cover schema-default materialization (omitted default equals explicit default in canonical bytes), omitted-vs-null distinction, unknown/required field rejection, unavailable receipt schema/canonicalization version fail-closed behavior, and uncertain-commit resolution from authoritative receipt state. The first runs failed because these contract functions did not exist; the implementations were added and the focused cases then passed.

## Limitations / remaining WP0.1 input

Pure model evidence does not prove concurrent PostgreSQL reservation, transaction rollback, uncertain-commit query behavior, or HTTP response redaction; those exact paths are deferred to WP1.1–WP1.3/WP1.6. The WP0 retention rule is no time-based deletion until an approved `command_receipts` category policy defines expiry; therefore historical keys/canonicalizers cannot retire while any receipt references them. The Project Owner is accountable for version availability/retirement approval; a named human custodian and recovery path are required before any non-test key provider is deployed.
