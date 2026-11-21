# REM-WP2.5 scope and traceability closeout

**Review date:** 2026-11-21  
**Implementation base:** `4c60304c608052e67f978224a430286e33511ccc`  
**Working-tree verification:** Passed for mapped acceptance and scope reconciliation  
**Exact-candidate gate:** Pending a clean commit and candidate-bound verification

## Acceptance review

| Acceptance criterion | On-record evidence | Verification result |
| --- | --- | --- |
| Frozen Phase 1 inventory, ownership map, and requirements traceability agree | `evidence/phase1/bdd-scenarios.json`; `evidence/phase1/bdd-work-package-map.json`; `Implementation-Plan-V4/traceability-matrix.md`; `evidence/phase1/wp2.5-scope-audit.log` | Pass. Both Union TA IDs remain in the frozen inventory and mapped owners, requirement links, and feature paths agree. Total scenario count remains 41. |
| BDD-UNI-001 and BDD-UNI-002 retain their IDs and required security outcomes under D-19 direct cooperative scope | `Implementation-Plan-V4/02-decision-register.md` D-19; `features/02_identity_privacy_and_access.feature`; `evidence/phase1/wp2.5/local/2026-11-21/wp25-cucumber-report.json` | Pass. Cohort wording is removed; direct cooperative grant/read/revoke behavior, unassigned-scope denial, PII exclusion, and historical audit preservation are executable. Neither scenario is `@wip`. |
| Server authorization and privacy are exercised through persisted API paths | `evidence/phase1/wp2.5/local/2026-11-21/wp25-cucumber-stdout.log`; `wp25-cucumber-report.json`; `wp25-run-metadata.json`; `wp25-validator-summary.json` | Pass locally. Both scenarios passed (2 scenarios, 22 steps) through the live command and workspace-context HTTP routes with PostgreSQL-backed synthetic fixtures and privacy canaries. |
| TA grant/revoke serial ordering and immutable history are covered | `evidence/phase1/wp2.4/local/2026-11-21/postgres-capacity-ta-serialization.log`; WP2.5 mapped report | Pass. Retained WP2.4 PostgreSQL tests prove protected-read-first and mutation-first ordering; WP2.5 exercises the grant/read/revoke and audit history through the API. |
| Required WP1.6 product-path predecessor is passing | `evidence/phase1/wp1.6/local/2026-11-21/wp2.3-candidate-86feb09.mapped-runner.log`; `evidence/phase1/wp2.3/task-evidence.json` | Pass. Six mapped IDs, eight expanded scenarios, and 69 steps passed on candidate `86feb09f334f8c6374ea364850631b8eccbafc5a`. |
| WP2.1–WP2.4 predecessors are passing ancestors with retained command evidence | Each predecessor `evidence/phase1/wp2.1` through `wp2.4/task-evidence.json`; `evidence/phase1/wp2.5-scope-audit.log` | Pass at current review base. WP2.1's documented test-first red artifact is recognized as expected development evidence, not failed acceptance. |
| Phase 2 Feature 05 scenarios remain outside WP2.5 acceptance | `Implementation-Plan-V4/implementation/WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md` §6; `evidence/phase1/wp2.5/task-evidence.json` | Pass. No Phase 2 verification IDs are claimed. |
| Exact-candidate closure | `evidence/phase1/wp2.5/task-evidence.json`; `evidence/phase1/wp2.5-scope-audit.log` | Pending. The worktree contains uncommitted implementation and evidence changes; a clean exact candidate does not yet exist. |

## Decision and scope reconciliation

D-09 §7.1 keeps the frozen mandatory acceptance IDs controlled and prohibits deleting or silently deferring them. D-19 §7.8 establishes one direct cooperative per TA grant/revoke and no cohort aggregate. The approved owner ruling recorded in the current D-19 entry preserves BDD-UNI-001 and BDD-UNI-002, their Phase 1 status and core security outcomes, while replacing superseded cohort semantics with direct cooperative scope.

The mapped scenarios use the existing WP2.3 command contract and persisted TA scope. They demonstrate access to an assigned cooperative, denial for an unassigned cooperative, no member names/NRCs/sensitive data in the returned response, and loss of effective access after revocation while previously committed command/audit history remains unchanged. WP2.4's database barriers retain both serial orders for the protected-read race.

No cohort model was added. The recorded `agreement_ref` is provenance only; this work does not claim to determine legal validity of an agreement. The capability-gap navigation route is checked for correct scope, without claiming a new capability-gap domain dataset.

## Remaining exact closeout action

Commit the reviewed implementation and evidence updates. On that clean worktree, run:

```powershell
npm run verify:wp2.5 -- <40-character-candidate-sha>
```

The verifier must pass against the exact candidate. Until then, the local mapped acceptance has passed but the task gate remains pending. No remote CI result is claimed.
