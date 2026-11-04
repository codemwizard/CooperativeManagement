# Gate 0 Artifact 3: Implementation Inventory

**Document ID:** `GATE-0-IMPLEMENTATION-INVENTORY`  
**Execution Date:** 2026-10-13  
**Auditor:** Antigravity Autonomous Agent (Phase 0 Baseline Audit)  

---

## 1. Engine Modules (`src/engine/`)

| Module | Size (Bytes) | Role / Purpose | Status / Notes |
|---|---|---|---|
| `actions.ts` | 22,779 | Pure state engine reducers, precondition checks, action handlers | Active. Contains 22 supported actions; requires G1–G5, G8–G9 contract alignment in Phase 1. |
| `covenants.ts` | 983 | Post-financing facility covenant checks | Active. Clean evaluation of due/received covenant items. |
| `data.ts` | 1,787 | Fixture loading and utility helpers (`clone`, `userFor`, `claims`) | Active. In-memory data management for seed entities. |
| `dossier.ts` | 3,773 | Dossier export generation | Active. Prepares exportable evidence package. |
| `esg.ts` | 7,998 | ESG indicator calculations (GIIN IRIS+ aligned) | Present but **Deferred to Phase 5** per plan sequencing. |
| `evaluate.ts` | 5,931 | Destination requirement evaluation and readiness logic | Active. Evaluates requirements for destinations A, B, and N. |
| `pipeline.ts` | 8,468 | NABII pipeline classification (4 stages) and cohort metrics | Active. Drives pipeline distribution and readiness views. |
| `scope.ts` | 761 | Client-side persona visibility and data masking | Active. Implements simulated privacy boundaries. |
| `types.ts` | 6,427 | Core TypeScript domain contracts | Active. Target for Phase 1 contract closure. |

---

## 2. Component Layer & Routes (`src/`)

| Path | Purpose | Active Status |
|---|---|---|
| `src/App.tsx` | Main root component shell | Active |
| `src/JourneyRouter.tsx` | Central stateful journey router managing tab state and case selection | Active |
| `src/capture.tsx` | Interaction telemetry recording (28 allowlisted events) | Active |
| `src/components/core.tsx` | Core shared UI elements (RequirementChain, EvidenceDrawer, HelpContext) | Active |
| `src/components/journeys/cooperative/` | 8-step SME journey, member registration, loan application | Active |
| `src/components/journeys/fieldagent/` | Field agent observation workbench and tag inspection | Active |
| `src/components/journeys/pfi/` | Commercial lender discovery, admission stepper, credit decision | Active |
| `src/components/journeys/vvb/` | VVB Independent Verifier workbench and finding recording | Active |
| `src/components/journeys/nabii/` | NABII fund manager pipeline dashboard and TA assignment | Active |
| `src/components/journeys/portfolio/` | Facility monitoring console and covenant compliance | Active |
| `src/components/journeys/ta/` | SBGI technical assistance intervention workbench | Active |
| `src/components/help/` | Guided tours, contextual help tooltips | Active |
| `src/components/shell/` | Application header, role switcher, navigation drawer | Active |
| `src/views/` | Directory | **Inactive / Empty** (Routing is handled via `src/components/journeys/`) |

---

## 3. Authoritative Fixture Data (`data/`)

| Fixture File | Size (Bytes) | Role / Authority Boundary |
|---|---|---|
| `data/cases.json` | 61,500+ | Authoritative seed cohort (`case-1` through `case-10`). |
| `data/destinations.json` | 12,000+ | Criteria and covenants for Commercial Bank (`A`), Asset-Backed (`B`), Catalytic (`N`). |
| `data/meta.json` | 4,500+ | Enum definitions (`finding_results`, `evidence_levels`, mandatory limitations). |
| `data/roles.json` | 3,200+ | Permitted actions by actor role. |
| `data/contacts_seed.json` | 2,100+ | Controlled fictional contact reference catalog. |
| `data/verification_seed.json` | 5,400+ | Verifier assignments and findings baseline. |
| `data/esg_index.json` | 8,900+ | ESG indicator definitions and IRIS+ codes. |
| `data/expected-results.json` | 6,700+ | Oracle reference truth matrix for 10 cases x 3 destinations. |
