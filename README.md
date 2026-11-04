> **V4 Development in progress (4 November 2026)**
> A database-backed V4 workspace is being built alongside the legacy prototype. See `Implementation-Plan-V4/` for the specification and `Implementation-Plan-V4/implementation/` for the phase plans. The legacy prototype below remains operational and governs the demo.

# Symphony Interactive Prototype

Governed state and evidence infrastructure prototype for NABII and commercial debt providers.

## Architecture Overview

Symphony is a role-specific, guided-journey prototype demonstrating how rural cooperatives move from
poorly-documented enterprises into institutionally-assessed, evidence-governed entities. Each institutional
actor (cooperative secretary, TA officer, PFI credit analyst, independent verifier, NABII fund manager,
portfolio manager, field agent) navigates a linear, single-task-per-screen journey driven by a shared
evidence engine. All journeys read and write the same CaseState, preserving audit integrity across roles.

**Engine delta (Oct 2026):** Four new actions added (`institution_message`, `request_ta_intervention`,
`record_ta_completion`, `set_discoverable`) and two new engine functions (`workflowState`, `stateDistribution`,
`blockingExceptions` in pipeline.ts). A `technician` role and `computeESGIndex()` (illustrative proprietary
methodology with IRIS+ aligned indicators) are included. All other engine invariants remain frozen.

---

## Getting Started

### Prerequisites
- Node.js 25.x
- npm 11.6.2+
- Python 3.10+ (for verification tools)

### 1. Install Dependencies

From the Prototype directory:

    cd Prototype
    npm install

### 2. Verify Reference Baseline

    npm run verify:oracle
    # OK: 10 cases x 3 destinations match expected-results.json; data integrity clean.

    npm run verify:help
    # OK: 91 help entries, 23 tour steps, 8 required visible texts.

### 3. Run Development Server

    npm run dev

Open http://localhost:5173 in your browser.

---

## Demo Sign-in

The login screen is labelled **"Demo sign-in: no authentication"** and presents a list of personas.
Select a persona to enter that role's guided journey. No password or account is needed.

Available demo personas:
- Cooperative Secretary / Treasurer / Chairman — 8-step SME transformation journey
- Field Agent — Field verification workbench (Chisamba cooperative, case-1)
- TA Officer — Gap remediation queue and workbench
- NABII Fund Manager — 4-state national pipeline dashboard + portfolio surveillance
- PFI Credit Analyst — Discovery pipeline (view only, cannot record decisions)
- PFI Credit Officer — 6-stage bank journey: Discover → Inspect → Query or Verify → Assess → Decide → Monitor
- Independent Verifier (VVB) — Assurance workbench and finding form
- Technician — Set discoverability and TA coordination

---

## Role-Specific Guided Journeys

### PFI (Bank) Vertical Slice — Chisamba Bank Story (`case-1`)

The full 6-stage bank journey is built around the Chisamba Farmers Cooperative acceptance test:

1. **Discover** — National pipeline with L0 asset composition bar (members' vs cooperative-owned).
2. **Inspect** — L2 asset split: Members' livestock by category (Beef cattle, Dairy cows, Goats) and
   cooperative-owned fixed assets shown in separate panels. No individual member names shown (R29).
3. **Query or Verify** — Dispatch `assign_verification` to an internal or external verifier; send
   `institution_message` to the cooperative. Both trigger a ChangeConfirmation modal showing Before/After/Unchanged.
4. **Assess** — Symphony ESG Index (proprietary illustrative score with IRIS+ aligned metrics), readiness
   evaluation, institutional reliance button, and credit outcome decision.
5. **Decide** — Review recorded credit committee outcomes.
6. **Monitor** — View active inquiries sent to the cooperative.

**Design rule:** The bank decides, not Symphony. No action changes readiness or evidence level.

### NABII Vertical Slice — 4-State Pipeline Dashboard

The NABII Fund Manager dashboard shows:

- **National headline metrics** — 50 total enterprises, ZMW 14.2M demand, 7,200 smallholders, 54% women participation
- **4-State classification** — Assessment Ready / Evidence Progressing / Remediation Required / Initial Record
  (live computed from 10 modelled cooperatives + synthetic national seed)
- **Interactive stacked bar + state cards** — Click to filter the 10 cooperatives by pipeline state
- **Enterprise record (Step 2)** — Pipeline state badge, L0 asset composition, Symphony ESG Index,
  gap identification with TA request buttons (`request_ta_intervention`), governed evidence record
- **Provincial distribution (Step 3)** — National pipeline breakdown by province

### Demo Persistence
- Save and exit: Writes current progress to `localStorage[symphony.draft.v1]`.
- Resume draft: Login screen detects a saved draft and offers a resume banner.
- Reset demo: Clears draft and restores baseline fixtures.

### Personal Data Boundary (R29)
Non-cooperative portals (NABII, TA, PFI, VVB, Portfolio) never receive individual member names or
household livestock details. They consume only aggregated totals via `memberAssetSummary()`,
`coopAssetSummary()`, and `memberLivestockByCategory()` (showing livestock by species category across
all members, not per person).

---

## Running Tests

### Unit and Engine Tests (Vitest)

    npm test
    # 27/27 tests pass: engine.test.ts (24) + assetSummary.test.ts (3)

### End-to-End Tests (Playwright — 12 tests)

    npm run test:e2e
    # 12/12 pass — 3 component shell + 8 institutional journey + 1 cooperative journey

Individual test files:
    npx playwright test tests/journey-institutional.spec.ts
    npx playwright test tests/journey-phase-b.spec.ts
    npx playwright test tests/components.spec.ts

### All Verification Suites

    npm run verify:all
    # Runs in order: verify:oracle, verify:help, verify:bundle, npm test, npm run test:e2e

---

## Verification Tools

Command                  What it checks
npm run verify:oracle    10 seed cases x 3 destinations match tests/expected-results.json
npm run verify:help      91 help entries, 23 tour steps, 8 required visible texts
npm run verify:bundle    dist/ contains zero forbidden files, zero forbidden lender terms
npm test                 Engine logic, evidence levels, role enforcement, oracle parity
npm run test:e2e         12 Playwright end-to-end tests across all journeys

---

## Build for Production

    npm run build
    # Outputs: dist/index.html + dist/assets/ (JS ~335 kB, gzip ~85 kB)

---

## Deployment to Vercel

### Via Vercel Web Dashboard
1. Import the git repository.
2. Set **Root Directory** to `Prototype`.
3. Set **Framework Preset** to `Vite`.
4. Click **Deploy**.

### Via Vercel CLI (from the repository root)

    npx vercel --prod

When prompted, set the root directory to `Prototype`. The build command
(`tsc --noEmit && vite build`) and output directory (`dist`) are already
configured in `vite.config.ts` and `package.json`.

### Environment Notes
- No server-side environment variables required. The prototype is fully static.
- All demo state lives in `localStorage`. No backend or database needed.
- The `/capture` admin route is client-side only and safe in the deployed build.

---

## Project Structure

    Prototype/
    |-- data/
    |   |-- cases.json               10 seed cooperative cases (case-1 to case-10)
    |   |-- destinations.json        Requirements for Destinations A, B, N
    |   |-- roles.json               Role-action permissions + demo user registry
    |   |-- contacts_seed.json       Fictional contact directory (Field Agent Gift Mulenga)
    |   |-- verification_seed.json   Verifier users and claim seed data
    |   |-- national_seed.json       Synthetic national pipeline aggregates (50 enterprises)
    |   |-- iris_mapping.json        GIIN IRIS+ aligned metric catalog (PI4060, OI6213, PI1540, PI2822)
    |   |-- esg_index.json           Symphony ESG Index methodology weights and tier thresholds
    |-- src/
    |   |-- engine/
    |   |   |-- types.ts             CaseState, EngineEvent, Role, Actor, TaIntervention, InstitutionMessage
    |   |   |-- actions.ts           applyAction() + all action handlers
    |   |   |-- evaluate.ts          Requirement evaluation against evidence
    |   |   |-- pipeline.ts          workflowState(), stateDistribution(), blockingExceptions(), funnel()
    |   |   |-- esg.ts               computeESGIndex() — proprietary illustrative score
    |   |   |-- data.ts              Seed data loaders, destinationById, meta, userFor()
    |   |   |-- scope.ts             visibleCases(), assertCaseVisible()
    |   |   |-- covenants.ts         monitoringState(), covenantsCheck()
    |   |   |-- dossier.ts           presentToDossier()
    |   |-- components/
    |   |   |-- shell/
    |   |   |   |-- JourneyShell.tsx     Layout wrapper + exit button
    |   |   |   |-- StepIndicator.tsx    Progress bar
    |   |   |   |-- ActionLabel.tsx      VIEW ONLY / RECORD CHANGE / REQUEST / INSTITUTIONAL FINDING labels
    |   |   |   |-- ChangeConfirmation.tsx  Before/After/Unchanged modal
    |   |   |-- journeys/
    |   |       |-- types.display.ts     Display-only type definitions
    |   |       |-- assetSummary.ts      memberAssetSummary(), coopAssetSummary(), memberLivestockByCategory(), assetsByOwner()
    |   |       |-- cooperative/         8-step SME journey components
    |   |       |-- nabii/               NabiiJourney — 4-state pipeline dashboard
    |   |       |-- ta/                  TaJourney — gap remediation
    |   |       |-- pfi/                 PfiJourney — 6-stage bank journey
    |   |       |-- vvb/                 VvbJourney — independent verifier workbench
    |   |       |-- fieldagent/          FieldAgentJourney — livestock enumeration
    |   |       |-- portfolio/           PortfolioJourney — surveillance and covenants
    |   |       |-- discovery/           DiscoveryTable — shared pipeline table
    |   |-- JourneyRouter.tsx            Role-dispatch entry point + handleRunAction
    |   |-- App.tsx                      Root mount
    |-- tests/
    |   |-- engine.test.ts               Engine contract tests (27 Vitest)
    |   |-- assetSummary.test.ts         Asset aggregation unit tests
    |   |-- journey-phase-b.spec.ts      Cooperative 8-step E2E (Playwright)
    |   |-- journey-institutional.spec.ts Institutional journeys E2E (12 Playwright tests)
    |   |-- expected-results.json        Oracle: expected evaluation results per case
    |-- tools/                           verify:oracle, verify:help, verify:bundle scripts
    |-- DECISIONS.md                     Architectural decision log (Decisions 1-35)
    |-- THREE_WEEK_BUILD_PLAN.md         Current authoritative build plan
    |-- playwright.config.ts

---

## Key Design Decisions

See DECISIONS.md for the full log. Highlights relevant to the Oct 2026 build:

- **D33:** V3 architecture freeze lifted (scoped delta only — new actions, roles, pipeline functions).
- **D34:** Symphony ESG Index is a proprietary illustrative score; IRIS+ aligned indicator labels only
  (not "compliant"); a household whose head is under 35 is a youth-led household.
- **D35:** Bank decides, never Symphony; action labels on every consequential screen; `assign_verification`
  and `institution_message` do not change readiness; Lender B option (a) — computed result shown.
- **D29:** `memberAssetSummary()` and `coopAssetSummary()` are the only data paths to external portals.
- **D31:** Draft persistence is `localStorage`-only, labelled as a demo simulation.
- **D32:** `src/components/sme.tsx` removed; `JourneyRouter.tsx` is the single role-dispatch entry point.
