# Legacy Regression Baseline — November 2026

**Recorded:** 4 November 2026 19:56–19:57 (UTC+2)  
**Node:** v26.7.0 | **npm:** 12.2.0 | **Platform:** Windows  
**Command:** `npm run verify:all`  
**Result:** ✅ ALL PASS — zero pre-existing failures

---

## Vitest unit suite

```
Test Files  9 passed (9)
      Tests  159 passed (159)
   Start at  19:56:56
   Duration  4.62s
```

| File | Tests |
|---|---|
| tests/contracts.test.ts | 21 |
| tests/eqs_scoring.test.ts | 47 |
| tests/engine.test.ts | 24 |
| tests/evidence_transitions.test.ts | 12 |
| tests/promote_security.test.ts | 14 |
| tests/persistence_integrity.test.ts | 24 |
| tests/crypto.test.ts | 8 |
| tests/inventory_consistency.test.ts | 6 |
| tests/assetSummary.test.ts | 3 |
| **Total** | **159** |

---

## Playwright e2e suite

```
Running 31 tests using 2 workers
31 passed (48.2s)
```

All 31 tests passed across:
- `tests/components.spec.ts` (3 tests)
- `tests/journey-core-spine.spec.ts` (17 tests)
- `tests/journey-design-changes.spec.ts` (4 tests)
- `tests/journey-institutional.spec.ts` (6 tests — Tests 6–14)
- `tests/journey-phase-b.spec.ts` (1 test)

---

## Python oracle

```
OK: 10 cases x 3 destinations match expected-results.json; data integrity clean.
```

---

## Help validation

```
OK: 91 help entries, 23 tour steps, 8 required visible texts.
```

---

## Bundle validation

```
[1/3] Checking dist/ directory existence and file exclusions... OK
[2/3] Checking for forbidden financial institution terms... OK
[3/3] Checking bundle content cleanliness... OK
Bundle sanitized, zero forbidden files, zero forbidden terms.
```

---

## Pre-existing failures

**None.** The legacy suite is entirely green at baseline.

---

## Regression floor (Phase 0 contract)

The following counts are the floor. Any Phase 0 or V4 work that causes any of these to drop is a blocking failure:

| Metric | Baseline floor |
|---|---|
| Vitest tests | ≥ 159 |
| Playwright tests | ≥ 31 |
| Python oracle | `OK` |
| Help entries | ≥ 91 |
| Bundle: forbidden terms | 0 |

This baseline must remain green throughout all V4 phases until the legacy app is formally retired (Phase 8 parity gate).

