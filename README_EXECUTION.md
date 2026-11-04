# Symphony Prototype — Reproduction and Execution Guide

**Document ID:** `SYMPHONY-EXECUTION-GUIDE-V15`  
**Purpose:** Deterministic local execution and independent verification instructions for auditors and reviewers.

---

## 1. Prerequisites

- **Node.js:** `>= v20 LTS` (tested on Node v20 / v22)
- **npm:** `>= 10`
- **Python:** `>= 3.10` (required for bundle verification scanner)
- **OS:** Linux, macOS, or Windows (PowerShell)

---

## 2. Reproduction Sequence

### Step 1: Clean Installation
When extracting the repository archive, dependencies should be installed cleanly:
```bash
npm install
```
*Note: Do not run `vitest` from a pre-packaged archive without running `npm install`, as execute permissions on binary symlinks in `.bin/` depend on local environment extraction.*

### Step 2: Unit & Regression Test Suite (Vitest)
Runs all 145+ Vitest unit, regression, invariant, security, and scoring tests:
```bash
npm test
```
All tests must pass and exit code must be `0`.

### Step 3: End-to-End Test Suite (Playwright)
In a separate terminal or background job, start the local development server:
```bash
npm run dev
```
Then execute the Playwright test suite:
```bash
npx playwright test --workers=1
```
All tests must pass and exit code must be `0`.

### Step 4: Production Build
Compile and bundle the production application:
```bash
npm run build
```
Build must complete without TypeScript or bundling errors and exit code must be `0`.

### Step 5: Production Bundle Integrity Verification
Execute the bundle scanner to assert no forbidden commercial or uncalibrated terms leak into distribution assets:
```bash
python tools/verify_bundle.py
```
Scanner must exit with code `0`.

---

## 3. Verified Environment Log

| Parameter | Value |
|---|---|
| Test Framework | Vitest 1.x / Playwright |
| Runtime | Node.js v20 LTS |
| Methodology Spec | `docs/EQS_METHODOLOGY_SPECIFICATION.md` (`EQS-V1-PROVISIONAL`) |
| Invariant Traceability | `tests/TRACEABILITY_MATRIX.md` |
