# Gate 0 Artifact 5: Core Evidence Spine Acceptance Specification

**Document ID:** `GATE-0-CORE-SPINE-ACCEPTANCE-SPEC`  
**Execution Date:** 2026-10-13  
**Auditor:** Antigravity Autonomous Agent (Phase 0 Baseline Audit)  

This specification defines the exact automated test contract for validating the Core Evidence Spine across Phase 1 (`tests/contracts.test.ts`) and Phase 3 (`tests/journey-core-spine.spec.ts`).

---

## 1. Test Harness Structure

1. **Pure Engine Contract Suite (`tests/contracts.test.ts` - Phase 1):**
   - Unit tests executing against `src/engine/actions.ts` and `src/engine/evaluate.ts`.
   - Validates all 22+ state transitions, prohibited side-effects, duplicate guards, adverse observation preserves, and 5-state assignment lifecycle.
2. **Browser E2E Acceptance Suite (`tests/journey-core-spine.spec.ts` - Phase 3):**
   - Playwright test driving the complete evidence journey with Chisamba Farmers Cooperative (`case-1`).
   - Validates UI badge classification, persona switching, stepper state transitions, atomic persistence, and corruption recovery.

---

## 2. The 13 Mandatory Test Assertions & Sub-Scenarios

### Assertion 1: Initial Claim Identity
- Record livestock asset claim for Chisamba Farmers Cooperative.
- Verify: owner, source, evidence level (`asserted`), and version (`v1`).
- Verify: Prohibited from setting initial level to `supported` or `verified`.

### Assertion 2: Attributable Observation & Adverse Isolation
- **2a (Non-adverse on Asserted):** Field Agent submits corroborating inspection (`has_discrepancy = false`) with `contact_ref_id: "contact-fa-01"`. Claim advances to `supported`. Unrelated claims, cooperative assets, lender decisions, and readiness records strictly unchanged.
- **2b (Adverse on Asserted):** Adverse observation (`has_discrepancy = true`) appends to observation history, flags discrepancy, and strictly leaves claim at `asserted` (prohibited from advancing to `supported`).
- **2c (Corroborating on Supported):** Second non-adverse observation on `supported` claim appends to history and preserves `supported`.
- **2d (Adverse on Supported):** Adverse observation on `supported` claim appends to history, sets discrepancy flag, and preserves `supported` (prohibited from dropping to `asserted`).
- **2e (History Append Invariant):** Sequential observations append chronologically without overwriting prior inspection records.

### Assertion 3: Asset Ownership Separation
- Member moveable property (`members_roster[].livestock`) is never aggregated into cooperative balance sheet collateral (`coop_assets`).
- Encumbrance check renders: `"Registry check: Not performed"`.

### Assertion 4: Scoped Assignment & Duplicate Guard
- **4a:** Verification assignment references exact version (`v1`) and leaves evidence level unchanged at `supported`.
- **4b (Duplicate Assignment Guard):** Attempt to call `assign_verification` when an assignment in `assigned` already exists for `(claim_id, version_id)` is rejected with `DUPLICATE_ASSIGNMENT`.

### Assertion 5: Scoped Finding Identity
- Verification finding immutably references exact version (`v1`) with outcome `verified_conformant`.
- Promotes `evidence.level` to `verified` for version `v1` only.

### Assertion 6: Negative Verification Path & Limitation Demarcation
- `non_conformant` or `inconclusive` finding records an immutable finding record with rationale in finding history.
- Derived projection attaches display limitation tag without mutating authoritative evidence.
- Evidence level strictly preserves prior level (`asserted` or `supported`, zero silent downgrade), without creating an unrelated governance dispute.

### Assertion 7: Multi-Dimensional Qualified Verification Path
- `verified_with_qualifications` finding advances version `v1` to `verified` carrying explicit qualification caveats array.
- Derived projections render conditional admission warnings.
- Downstream rules must evaluate all 5 dimensions (`evidence_level`, `verification_outcome`, `qualifications`, `validity_state`, `dispute_state`).

### Assertion 8: Admission Separation
- Lender evidence admission checklist evaluation (`accepted`, `requires_independent_query`, `rejected`) remains strictly separate from evidence provenance and other destinations.

### Assertion 9: Decision Isolation & Snapshot Reproducibility
- Credit decision records loan outcome (`approved`, `more_evidence_requested`, `declined`, `deferred`) immutably bound to complete `DecisionEvaluationSnapshot`.
- Captures `destination_id`, evaluated checklist responses, ruleset version, and relied findings.
- When claim amends to `v2`, historical decision remains permanently bound to `v1` snapshot and active UI displays amendment notice.

### Assertion 10: Durable Persistence, Structural Validation & Fail-Closed
- **10a (Clean Reload):** Browser reload restores last committed `DurableCommitEnvelope`.
- **10b (Failed Write Rollback):** Simulated storage write failure rolls back optimistic UI, renders inline error, and publishes zero success.
- **10c (Structural Validation):** Envelope with mismatched state version / event log length is rejected as structurally invalid.
- **10d (Corrupted Envelope Recovery):** Corrupted storage fails closed and provides explicit `Reset to Seed Baseline`.

### Assertion 11: Deterministic Reset
- Global reset clears mutated case envelopes, restores seed fixtures and simulated date (`2026-10-06`), while strictly preserving `symphony.capture.v1`.

### Assertion 12: Superseded Version Handling & Late Finding
- **12a:** Amending claim to `v2` creates new unverified version while `v1` historical finding remains intact; an open assignment on `v1` transitions to `superseded_target`.
- **12b (Late Finding):** Late finding on `superseded_target` records finding on `v1` (status: `completed_superseded`), does not verify `v2`, and does not alter decisions based on `v2`.

### Assertion 13: Zero Partial Mutation
- Any rejected action aborts fail-closed with zero partial mutation of event log, state snapshot, or unrelated projections.
