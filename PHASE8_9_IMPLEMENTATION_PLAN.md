# Implementation Plan: Phase 8 & Phase 9 Completion

**Project:** Symphony Interactive Prototype  
**Working Directory:** `C:\Workspace\GitHub\Symphony\Prototype`  
**Governing Documents:** `AGENT.md`, `CAPTURE_SPEC.md`, `UI_HELP_SPEC_V1.md`, `IMPLEMENTATION_PLAN.md`

---

## 1. Executive Summary & Baseline

Phases 0 through 7 are completed and verified:
- `npm run verify:oracle`: OK (27 evaluation cases × 3 destinations match baseline).
- `npm run verify:help`: OK (91 help entries, 23 tour steps, 8 required visible statements).
- `npm run test`: 24/24 Vitest unit tests pass (`engine.test.ts`).
- `npm run test:e2e`: 15/15 Playwright integration tests pass (`components.spec.ts`, `sme-phase3.spec.ts`, `lender-phase4.spec.ts`, `facility-phase5.spec.ts`, `portfolio-phase6.spec.ts`, `nabii-phase7.spec.ts`).
- `npm run build`: `tsc --noEmit` clean, Vite production bundle generated.
- Term scan: 0 occurrences of forbidden lender names in `src/` or `dist/`.

The next logical and authorized milestone encompasses **Phase 8 (Tours, Automatic Session Capture, and Deterministic Reset)** and **Phase 9 (Production Hardening, Bundle Sanitization, and Deployment Readiness)**.

---

## 2. Phase 8: Tours, Automatic Session Capture & Deterministic Reset

### 2.1 Scope & Functional Requirements
1. **Guided Tours (Bank & NABII)**:
   - Driven strictly by `data/tours.json` (13 Bank tour steps, 10 NABII tour steps).
   - Anchored via `anchor_testid` on `expected_screen`.
   - Next, Back, Exit buttons functional without overlapping interactive targets.
   - Tour start, step, exit, and completion events recorded into capture stream.
2. **Automatic Session Capture Engine (`src/capture.tsx`)**:
   - Zero network requests; zero analytics libraries; 100% client-side memory + `localStorage`.
   - Storage key: `symphony.capture.v1`.
   - Never records user input, passwords, or PII. Only logs actions, timestamps (`t_ms`, `ts`), active screen, and roles.
   - Batching interval (2s) and flush on `pagehide` and `visibilitychange`.
   - Event schema adherence (`data/capture_event_schema.json`).
   - Hotkey `Ctrl+Shift+E` ends session and downloads `session-<id>.json`.
3. **Capture Admin Console (`/capture`)**:
   - Hidden from navigation; does not emit capture events itself.
   - Displays session list, metadata, and export buttons for:
     - `session-<id>.json` (individual session with computed summary metrics).
     - `capture-sessions.json` (all sessions).
     - `events.csv`, `screens.csv`, `sessions.csv`.
   - Confirmed "Clear capture data" action.
4. **Deterministic Reset**:
   - "Reset Demo" button restores initial case state, clears events, findings, and disputes.
   - **Critical Invariant:** Reset *never* clears `symphony.capture.v1`. It closes the current session with reason `reset` and initiates a fresh session.

### 2.2 Phase 8 Test Suite (`tests/capture-phase8.spec.ts`)
- **X4**: Sequence numbers have no gaps (`seq` 1..N), monotonic `t_ms`, and valid event types.
- **X5**: Zero non-local network requests emitted throughout tour and session operations.
- **X6**: Reset preserves existing capture records while setting case state back to baseline.
- **X7**: Typed inputs and notes never appear in event payloads or CSV/JSON exports.
- **X8**: Storage failure / quota resilience: application continues gracefully and records storage error event.
- **X9**: Metric calculations (`active_ms`, `dwell_ms`, `off_script_count`, etc.) conform to spec.
- **X10**: Exported CSV headers and columns strictly match `CAPTURE_SPEC.md` §9.

---

## 3. Phase 9: Production Hardening, Bundle Sanitization & Deployment

### 3.1 Scope & Functional Requirements
1. **Bundle Sanitization**:
   - Ensure `dist/` contains only static production assets.
   - Exclude test artifacts, test cases (`tests/`), tools (`tools/`), `forbidden_terms.json`, `capture_questions.json`, and `session_notes_template.json`.
   - Exclude development-only routes (e.g., `/components` or `/dev-components`).
2. **Security & Boundary Auditing**:
   - **X2**: Automated CI scan of both `src/` and `dist/` against `data/forbidden_terms.json`.
   - **X3**: Verify that all 20 UI views display their mandatory boundary statements (`BoundaryLabel`).
   - **H7 / H10**: Validate that no verbatim help text is embedded in code and no banned words appear in bubbles.
3. **Responsive Viewport Verification**:
   - Desktop (1440x900)
   - Tablet (768x1024)
   - Mobile (375x667)
   - Offline / system-font fallback integrity.
4. **Deployment Preparation**:
   - Verify `vercel.json` routing configuration (SPA rewrites for clean URL handling).
   - Verify static build reproducibility (`npm run build`).
   - Update `README.md` with one-command deployment instructions and production verification steps.

### 3.2 Phase 9 Test Suite (`tests/hardening-phase9.spec.ts` & CI scripts)
- Automated Playwright checks for boundary statements across all screens.
- Automated Playwright responsive viewport runs.
- Python tool `tools/verify_bundle.py` verifying file inclusions and exclusions in `dist/`.

---

## 4. Work Breakdown Structure & Implementation Steps

| Step | Task | Target Files | Dependencies |
|---|---|---|---|
| **Step 1** | Implement comprehensive Phase 8 E2E spec | `tests/capture-phase8.spec.ts` | Existing `capture.tsx`, `TourBubble.tsx` |
| **Step 2** | Polish `/capture` route and CSV export schemas | `src/capture.tsx` | `CAPTURE_SPEC.md` |
| **Step 3** | Validate reset isolation and event continuity | `src/components/sme.tsx`, `src/capture.tsx` | Step 1 |
| **Step 4** | Implement Bundle Sanitization check tool | `tools/verify_bundle.py` | `dist/` build |
| **Step 5** | Implement Phase 9 Hardening & Responsive E2E spec | `tests/hardening-phase9.spec.ts` | Step 4 |
| **Step 6** | Verify `vercel.json` SPA configuration | `vercel.json` | Vite build output |
| **Step 7** | Execute full test matrix (Oracle, Help, Vitest, E2E, Bundle) | All suites | Steps 1–6 |
| **Step 8** | Update `README.md` and `DECISIONS.md` | `README.md`, `DECISIONS.md` | Step 7 |

---

## 5. Verification Gates

- [ ] **Gate 8 (Capture & Tours)**:
  - Both Bank and NABII tours run to completion.
  - Reset preserves capture log.
  - `tests/capture-phase8.spec.ts` passes 100%.
- [ ] **Gate 9 (Hardening & Delivery)**:
  - `python tools/verify_bundle.py` reports clean bundle (no forbidden files, no excluded JSONs, no banned words).
  - `tests/hardening-phase9.spec.ts` passes across desktop, tablet, and mobile viewports.
  - All 65 requirements in `IMPLEMENTATION_PLAN.md` matrix verified.
  - Production build in `dist/` is deploy-ready for Vercel.
