# Gate 0 Artifact 6: Scope and Dependency Proposal

**Document ID:** `GATE-0-SCOPE-DEPENDENCY-PROPOSAL`  
**Execution Date:** 2026-10-13  
**Auditor:** Antigravity Autonomous Agent (Phase 0 Baseline Audit)  

---

## 1. Executive Gate 0 Conclusion

The repository audit is complete. 
- All existing tests pass (10/10 oracle cases, 27/27 vitest tests, 16/16 Playwright tests, zero TypeScript errors).
- Zero code modifications were made during Phase 0, strictly preserving investigative discipline.
- The 10 contract gaps cataloged in §11 of `CONSOLIDATED_IMPLEMENTATION_PLAN.md` are confirmed accurate.
- **Gate 0 is certified PASSED.**
- Authorization condition for Phase 1 is satisfied.

---

## 2. Proposed Phase 1 Module Boundaries & Sequence

Phase 1 focuses exclusively on **Domain, State, and Evidence Contracts** in pure TypeScript, without modifying component UI or external integrations.

### 2.1 File Edit Scope for Phase 1
1. **`src/engine/types.ts`:**
   - Define `DurableCommitEnvelope` with `baseline_version`, `state_version`, `state_snapshot`, `event_log`, and `checksum`.
   - Define `DecisionEvaluationSnapshot` with `destination_id`, `evaluation_ruleset_version`, full `admission_evaluation` with `checklist_responses`, `relied_findings`, and `governance_state.resolution_supplied`.
   - Update `Finding.result` enum to plan vocabulary: `'verified_conformant' | 'verified_with_qualifications' | 'non_conformant' | 'inconclusive'`.
   - Update `Assignment.status` to 5-state lifecycle: `'assigned' | 'completed' | 'superseded_target' | 'cancelled' | 'completed_superseded'`.
2. **`data/meta.json`:**
   - Update `finding_results` array to match plan vocabulary.
3. **`src/engine/actions.ts`:**
   - Implement duplicate assignment guard in `assignVerification` (Gap G8).
   - Implement 5-state assignment lifecycle transitions (`superseded_target` on claim amendment, late finding on superseded targets, explicit cancellation).
   - Unify evidence promotion into `record_verification_finding`: promote `evidence.level` to `verified` for conformant findings; preserve prior level for non-conformant/inconclusive (Gap G3).
   - Implement adverse observation guard in `record_agent_observation` / `addEvidence` (Gap G9).
   - Validate mandatory `contact_ref_id` on observations (Gap G5).
   - Export canonical aliases: `record_claim`, `record_agent_observation`, `evaluate_admission_checklist` (Gap G4).
4. **`tests/contracts.test.ts` (New File):**
   - Implement comprehensive pure-contract test suite covering all 13 assertions, prohibited side-effects, and negative edge cases.

---

## 3. Explicit Deferrals & Dependencies

- **ESG Index Calculation (`src/engine/esg.ts`):** Retained as deferred to Phase 5.
- **UI Journey Components:** Locked until Phase 3 and Phase 4.
- **Cross-Tab Synchronization:** Explicitly out of scope (single-tab operating assumption disclosed).
- **Server Authentication:** Explicitly out of scope (simulated actor model).

---

## 4. Phase 1 Acceptance Gate (Gate 1)
- `npx vitest run tests/contracts.test.ts` passes 100% green.
- `npx tsc --noEmit` exits with code 0.
- `python tools/reference_oracle.py` continues to print `OK`.
- Zero regressions in existing 27 vitest tests.
