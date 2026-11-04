# Gate 0 Artifact 2: Test Inventory & Execution Baseline

**Document ID:** `GATE-0-TEST-INVENTORY`  
**Execution Date:** 2026-10-13  
**Auditor:** Antigravity Autonomous Agent (Phase 0 Baseline Audit)  

---

## 1. Summary Test Execution Table

| Test Suite / Command | Tool | Exit Code | Tests Passed | Tests Failed | Tests Skipped | Duration | Status |
|---|---|---|---|---|---|---|---|
| `python tools/reference_oracle.py` | Python 3.14 | `0` | 30 checks (10 cases x 3 destinations) | 0 | 0 | 0.8s | ✅ Clean Pass |
| `npm run test` (`vitest run`) | Vitest 2.1.9 | `0` | 27 | 0 | 0 | 3.58s | ✅ Clean Pass |
| `npx tsc --noEmit` | TypeScript 5.5.3 | `0` | N/A (0 errors) | 0 | 0 | 11.2s | ✅ Clean Pass |
| `npx playwright test` | Playwright 1.48.0 | `0` | 16 | 0 | 0 | 41.1s | ✅ Clean Pass |
| `python tools/validate_help.py` | Python 3.14 | `0` | 91 help + 23 tour + 8 text checks | 0 | 0 | 0.4s | ✅ Clean Pass |
| `python tools/verify_bundle.py` | Python 3.14 | `0` | Sanitization & Term Scans | 0 | 0 | 0.6s | ✅ Clean Pass |

---

## 2. Granular Test Breakdown

### 2.1 Reference Oracle (`tools/reference_oracle.py`)
- **Output:** `OK: 10 cases x 3 destinations match expected-results.json; data integrity clean.`
- **Evaluated Cases:** `case-1` through `case-10`.
- **Evaluated Destinations:** Commercial Bank (`A`), Asset-Backed (`B`), NABII Catalytic Facility (`N`).
- **Data Integrity:** Asset separation (member moveable assets vs. cooperative balance sheet) validated clean.

### 2.2 Unit & Engine Tests (`tests/`)
- **`tests/assetSummary.test.ts` (3 tests passed, 6ms):**
  - `calculates unencumbered movable assets for case-1`
  - `calculates unencumbered movable assets for case-2`
  - `handles case with no assets or members gracefully`
- **`tests/engine.test.ts` (24 tests passed, 143ms):**
  - Engine evaluation across 10 cases against expected fixtures (10 tests)
  - Covenants evaluation across 10 cases (10 tests)
  - Pipeline progression and staging logic (4 tests)
- **Total Vitest Count:** 27 passed out of 27.

### 2.3 Static Analysis & Type Checking (`npx tsc --noEmit`)
- Strict TypeScript configuration (`noImplicitAny`, `strictNullChecks`, etc.).
- **Errors Found:** 0 errors.

### 2.4 Browser E2E Tests (`tests/`)
- **`tests/components.spec.ts` (3 tests passed):**
  - `opens the governed requirement chain and evidence drawer in two clicks` (15.0s)
  - `renders mandatory guidance and accessible help text` (14.8s)
  - `tour launcher starts, advances, and exits tours from tour data` (1.6s)
- **`tests/journey-design-changes.spec.ts` (4 tests passed):**
  - `Landing Page: prominent demo sign-in banner, USSD shortcode text, 2-column layout and coop field agent` (1.8s)
  - `Create Account Journey: 8-step wizard with agent identity and claims review` (3.7s)
  - `Cooperative Member Journey: View-only profile, self-enrolment, pending notice, and loan proposals` (3.1s)
  - `Cooperative Field Agent: routes to Cooperative Journey and blocked by RoleGate on Step 4` (2.4s)
- **`tests/journey-institutional.spec.ts` (8 tests passed):**
  - `Test 6: NABII cohort overview and drill-down` (2.4s)
  - `Test 7: TA gap remediation and verification assignment` (2.5s)
  - `Test 8 & 11: PFI discovery, personal data boundary, and role-enforced outcomes` (4.6s)
  - `Test 9: VVB Independent Verifier workbench and input validation` (2.9s)
  - `Field Agent workbench and mark_verified action` (1.7s)
  - `Test 10: Portfolio surveillance and covenant compliance` (2.5s)
  - `Test 12: Bank Vertical Slice - Chisamba Bank Story (Inspect, Call Agent, Verify, Message, Decision)` (3.5s)
  - `Test 13: NABII 4-State Pipeline Dashboard and TA Request` (2.0s)
- **`tests/journey-phase-b.spec.ts` (1 test passed):**
  - `complete 8-step cooperative transformation journey` (2.7s)
- **Total Playwright Count:** 16 passed out of 16.

---

## 3. Pre-existing Defect & Regression Assessment

- **Pre-existing Failures:** Zero (0).
- **Environmental Anomalies:** None.
- **Classification:** Current repository implementation is 100% green against its existing suite. All required work consists of closing contract gaps G1–G10, implementing the Core Evidence Spine negative harness, and formalizing durable persistence.
