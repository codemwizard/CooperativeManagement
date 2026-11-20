# REM-WP2.3 Capacity and delegation commands

**Status:** Not implemented; no task-evidence record or pass is claimed.
**Entry:** REM-WP2.2 and REM-WP2.6 must have candidate-bound passing evidence.
**Authority:** REM-WP2.1 policy matrix, D-17, `docs/phase1/API_CONTRACT.md`, `docs/phase1/COMMAND_TRANSACTION_CONTRACT.md`, and the D-16 serialization specification.

## Bounded scope

Specify and implement the four Phase 1 policy action families from the frozen REM-WP2.1 matrix:

- capacity grant;
- capacity revoke;
- TA-scope delegation grant;
- TA-scope delegation revoke.

Those policy action IDs do not determine the HTTP command discriminator, schema version, aggregate target, payload/result schema, event names, projection keys or repeat-operation outcomes. Resolve each from approved contracts and record any missing product decision before implementation. Do not infer command registrations from legacy service names.

Use persisted actor, tenant, organization, appointment/capacity/delegation and cohort facts. Persist receipts, source mutation, immutable event, projection, outbox and D-16 scope-version changes atomically through the accepted REM-WP1 transaction path and REM-WP2.6 lock service. Revocation must not modify historical findings or create a Phase 2 finding workflow.

First-class cohort creation, status transitions, closure and historical treatment remain future work; this task may target an existing persisted cohort only after its eligibility semantics are specified by approved sources. No cohort-lifecycle behavior is implied by the TA-scope grant/revoke action family.

## Required contract artifact

Before production implementation, create `capacity-delegation-command-contract.json` with, for each command: stable discriminator, schema version, strict request and result schemas, aggregate UUID target, actor/session/tenant provenance, allowed actor classes, organization/cohort scope, effective interval and boundary semantics, duplicate/replay/revoke outcomes, event and projection mapping, audit behavior, receipt semantics, affected D-16 scopes, and requirement/source trace.

This README is a task boundary, not the command contract and not a completion record.
