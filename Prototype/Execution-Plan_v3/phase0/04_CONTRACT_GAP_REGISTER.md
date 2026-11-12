# Gate 0 Artifact 4: Contract Gap Register (Repository-Verified)

**Document ID:** `GATE-0-CONTRACT-GAP-REGISTER`  
**Execution Date:** 2026-10-13  
**Auditor:** Antigravity Autonomous Agent (Phase 0 Baseline Audit)  

This register formally verifies and certifies the divergences between current repository implementation and the V10 contract specifications in `CONSOLIDATED_IMPLEMENTATION_PLAN.md`.

---

## 1. Verified Gap Catalog

| Gap ID | Severity | Plan Contract (V10) | Current Engine Reality | Code Location | Phase 1 Resolution |
|---|---|---|---|---|---|
| **G1** | 🔴 High | Finding results vocabulary: `verified_conformant`, `verified_with_qualifications`, `non_conformant`, `inconclusive`. | Engine enum has: `'verified' \| 'partially_verified' \| 'not_verified' \| 'unable_to_determine'`. | `src/engine/types.ts:69`, `data/meta.json` | Rename `Finding.result` enum and `meta.finding_results` to plan vocabulary. Update all `recordFinding` call-sites, tests, and UI render paths. |
| **G2** | 🔴 High | Assignment lifecycle has 5 states: `assigned`, `completed`, `superseded_target`, `cancelled`, `completed_superseded`. | `Assignment.status` only supports 2 states: `'assigned' \| 'completed'`. | `src/engine/types.ts:62` | Add `superseded_target`, `cancelled`, and `completed_superseded` to `Assignment.status`. Implement `superseded_target` transition upon `amend_claim` and late finding handler. |
| **G3** | 🔴 High | `record_verification_finding` with conformant outcome automatically promotes `evidence.level` to `verified`. | `recordFinding` records finding and marks assignment completed, but does **not** update `evidence.level`. A separate manual call to `mark_verified` is currently needed. | `src/engine/actions.ts:218-245` | Unify both steps into `record_verification_finding`: for `verified_conformant` and `verified_with_qualifications`, promote `evidence.level` within the action. For non-conformant/inconclusive, preserve prior level. |
| **G4** | 🟡 Medium | Canonical action names: `record_claim`, `record_agent_observation`, `evaluate_admission_checklist`. | Engine uses: `add_evidence(level:'asserted')`, `add_evidence(level:'supported')`, `record_admission`. | `src/engine/actions.ts:98-135, 268-282` | Add canonical aliases in `actions.ts` and export matching convenience dispatchers. |
| **G5** | 🟡 Medium | Mandatory uniform observation attribution: `contact_ref_id`, `observation_date`, `field_agent_id`, inspection notes. | `add_evidence(level:'supported')` does not validate `contact_ref_id` presence or format. | `src/engine/actions.ts:98-135` | Add strict payload validation in `add_evidence` / `record_agent_observation`. Fail with `CONTACT_REF_REQUIRED` if absent. |
| **G6** | 🟡 Medium | `DurableCommitEnvelope` and `DecisionEvaluationSnapshot` defined as shared domain interfaces. | Interfaces absent from `src/engine/types.ts`. Persistence logic currently lives ad-hoc in the component router. | `src/engine/types.ts` | Define `DurableCommitEnvelope` and `DecisionEvaluationSnapshot` in `src/engine/types.ts`. |
| **G7** | 🟢 Low | Lender outcomes: `approved \| more_evidence_requested \| declined \| deferred`. | Engine uses: `approved \| more_evidence_requested \| declined \| deferred`. | `src/engine/types.ts:149` | ✅ **Resolved in Plan:** Plan vocabulary now matches engine reality. `more_evidence_requested` formalized as distinct pending outcome. |
| **G8** | 🔴 High | Duplicate assignment guard: rejecting duplicate assignments on `(claim_id, version_id)`. | `assignVerification` checks `targetExists` but does not check for an existing open assignment on the same `(claim_id, version_id)`. | `src/engine/actions.ts:200-216` | Add precondition guard to `assignVerification`: return `DUPLICATE_ASSIGNMENT` error if an active assignment already exists for the target version. |
| **G9** | 🟡 Medium | Adverse observation guard: `has_discrepancy = true` leaves `asserted` claims at `asserted`. | Repeated `add_evidence` with `level: 'supported'` replaces evidence and pushes to history regardless of discrepancy flag. | `src/engine/actions.ts:98-135` | Implement conditional observation delta: non-adverse advances to `supported`; adverse strictly preserves prior level and flags discrepancy. |
| **G10** | 🟢 Low | Non-conformant finding attaches limitation tag to derived projection. | `recordFinding` does not mutate `evidence` item on non-conformant finding. | `src/engine/actions.ts:218-245` | ✅ **Accepted Design:** Maintain immutable finding in history; derive display limitation tag in UI projection. No evidence mutation needed. |

---

## 2. Gate 0 Verification Signoff
The 10 gap hypotheses in §11 of `CONSOLIDATED_IMPLEMENTATION_PLAN.md` are **certified accurate** based on direct inspection of `src/engine/types.ts` and `src/engine/actions.ts`. No unexpected engine divergence was discovered.
