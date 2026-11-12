# Symphony Prototype — Phase 10: Guided Journey Redesign
### Implementation Plan

---

## Vision Summary

The redesign transforms the current 19-tab `SmeHeroApp` into a **role-specific, linear journey** UI with:
- **One primary task per screen** — no combined governance + evidence + analytics walls
- **Three-column shell** — active workflow centred, outer columns used contextually (not always)
- **Dominant "Continue" progression** — the user always knows what happens next
- **Persistent record state** visible underneath — data builds up and stays visible
- **Livestock members** with encumbrance status in enrollment
- **DFI/Lender dashboard** with SME drill-down showing member livestock vs cooperative assets

The engine (`evaluate`, `actions`, `pipeline`, `dossier`, `scope`) is **untouched**. Only the presentation layer changes.

---

## Architecture Overview

```
src/
├── App.tsx                          (unchanged)
├── capture.tsx                      (unchanged)
├── index.css                        → full redesign (new design tokens + layout)
├── engine/                          (UNTOUCHED)
│   ├── actions.ts
│   ├── covenants.ts
│   ├── data.ts
│   ├── dossier.ts
│   ├── evaluate.ts
│   ├── pipeline.ts
│   ├── scope.ts
│   └── types.ts
├── components/
│   ├── core.tsx                     (unchanged — BoundaryLabel, RequirementCard, etc.)
│   ├── help/                        (unchanged)
│   ├── phase2.tsx                   (unchanged)
│   ├── shell/                       ← NEW: layout shell components
│   │   ├── JourneyShell.tsx         ← 3-column shell + role-header
│   │   ├── StepProgress.tsx         ← linear step indicator
│   │   └── ContinueBar.tsx          ← sticky bottom bar with primary CTA
│   ├── journeys/                    ← NEW: per-role journey screens
│   │   ├── cooperative/             ← secretary / chairman / treasurer / member
│   │   │   ├── CoopLogin.tsx
│   │   │   ├── CoopEnrollment.tsx   ← includes livestock + encumbrance
│   │   │   ├── CoopDashboard.tsx
│   │   │   ├── CoopEvidence.tsx
│   │   │   ├── CoopReadiness.tsx
│   │   │   └── CoopPresent.tsx
│   │   ├── fieldagent/              ← field_agent
│   │   │   ├── AgentQueue.tsx
│   │   │   └── AgentVerify.tsx
│   │   ├── lender/                  ← pfi_analyst / pfi_credit
│   │   │   ├── LenderDashboard.tsx  ← portfolio + drill-down
│   │   │   ├── LenderAssessment.tsx
│   │   │   └── LenderSMEDetail.tsx  ← member livestock view
│   │   ├── verifier/                ← verifier
│   │   │   ├── VerifierQueue.tsx
│   │   │   └── VerifierWorkbench.tsx
│   │   └── fundmanager/             ← fund_manager / ta / nabii
│   │       ├── FMDashboard.tsx
│   │       ├── FMCohort.tsx
│   │       └── FMDirectory.tsx
│   └── sme.tsx                      → REPLACED by new journey router
```

---

## Design System Changes (`index.css`)

### New Design Tokens

| Token | Value | Purpose |
|---|---|---|
| `--brand` | `hsl(152 48% 32%)` | Primary green (NABII/Symphony brand) |
| `--brand-bright` | `hsl(152 60% 44%)` | Hover / active |
| `--brand-soft` | `hsl(152 40% 95%)` | Soft tint backgrounds |
| `--surface-deep` | `hsl(220 18% 11%)` | Dark sidebar / header |
| `--surface-mid` | `hsl(220 14% 17%)` | Dark card |
| `--text-on-dark` | `hsl(0 0% 95%)` | Text on dark surfaces |
| `--step-active` | `hsl(152 60% 44%)` | Active step indicator |
| `--step-done` | `hsl(152 48% 32%)` | Completed step |
| `--step-future` | `hsl(220 10% 70%)` | Future step |
| `--continue-btn` | `hsl(152 60% 38%)` | Dominant CTA |
| `--continue-btn-hover` | `hsl(152 60% 32%)` | CTA hover |

### New Layout Classes

```css
/* 3-column journey shell */
.journey-shell { display: grid; grid-template-columns: 280px 1fr 280px; min-height: 100vh; }
.journey-left   { background: var(--surface-deep); color: var(--text-on-dark); }
.journey-center { padding: 40px 48px; max-width: 760px; }
.journey-right  { padding: 24px 20px; background: var(--surface-raised); }

/* Step progress */
.step-progress  { display: flex; flex-direction: column; gap: 0; padding: 32px 20px; }
.step-item      { display: flex; align-items: center; gap: 12px; }

/* Dominant continue bar */
.continue-bar   { position: sticky; bottom: 0; padding: 20px 48px; background: white; border-top: 1px solid var(--line); }
.btn-continue   { width: 100%; height: 56px; font-size: 1.1rem; font-weight: 700; background: var(--continue-btn); color: #fff; border: none; border-radius: 10px; }
.btn-continue:hover { background: var(--continue-btn-hover); }

/* Record panel (right column) */
.record-panel   { position: sticky; top: 0; }
.record-section { margin-bottom: 20px; }
.record-label   { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
```

---

## Phase 10 Implementation Steps

### Step 1 — New Design Tokens & Layout Foundation (`index.css`)

**Scope:** Extend the existing CSS file — DO NOT remove existing classes, add the new layout system on top.

**Key additions:**
- New design tokens block under `:root`
- `.journey-shell`, `.journey-left`, `.journey-center`, `.journey-right`
- `.step-progress`, `.step-item`, `.step-dot`, `.step-label`
- `.continue-bar`, `.btn-continue`
- `.record-panel`, `.record-section`, `.record-label`, `.record-value`
- `.role-badge` (coloured pill in the header per role)
- `.journey-header` (dark top bar with logo + role badge + reset)
- Responsive: collapse to single column below 900px

**Deliverable:** Updated `src/index.css`

---

### Step 2 — Shell Components (`src/components/shell/`)

#### 2a. `JourneyShell.tsx`

```tsx
// Props:
interface JourneyShellProps {
  role: Role;
  steps: Step[];          // ordered list for the left progress panel
  activeStep: string;     // step id
  record?: ReactNode;     // what goes in the right column
  onReset: () => void;
  children: ReactNode;    // the centre content
}
```

- Renders dark left column with `StepProgress`
- Renders white centre column with `children`
- Renders right column with `record` (optional; collapses if null)
- Top header bar: Symphony logo + role badge + Reset button

#### 2b. `StepProgress.tsx`

```tsx
// Renders a vertical step list with done / active / future states
// Clicking a done step navigates back (not forward)
interface Step { id: string; label: string; status: 'done' | 'active' | 'future'; }
```

#### 2c. `ContinueBar.tsx`

```tsx
// Props:
interface ContinueBarProps {
  label: string;          // e.g. "Continue to Evidence"
  disabled?: boolean;
  onClick: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}
```

**Deliverables:** `src/components/shell/JourneyShell.tsx`, `StepProgress.tsx`, `ContinueBar.tsx`, `src/components/shell/index.ts`

---

### Step 3 — Cooperative Journey (`src/components/journeys/cooperative/`)

Role gate: `secretary | treasurer | chairman | member`

#### Steps in order:
1. **Enrollment** — cooperative profile + officers
2. **Members & Livestock** — roster with livestock categories + encumbrance
3. **Evidence** — current evidence items with tier badges
4. **Readiness** — evaluation summary per destination
5. **Present** — destination projection + presentation action

#### `CoopEnrollment.tsx`
- Shows cooperative name, district, province, programme
- Shows officers table
- **New: livestock section** — table of livestock categories with columns: `Species | Count | Estimated Value | Encumbrance | Notes`
  - Default encumbrance value: **"Unencumbered"** (editable dropdown: Unencumbered / Pledged / Under lien / Unknown)
  - Data comes from `caseState` — add a `livestock` field to case data (see Step 8)
- Continue → Members & Livestock

#### `CoopDashboard.tsx`
- Replaces the current `DashboardScreen`
- Shows 3 destination readiness cards
- Shows open gaps count + next expiry
- Shows any open lender requests as a notice
- No governance/evidence wall — just the headline KPIs

#### `CoopEvidence.tsx`
- One evidence item per row: name, tier badge (Asserted/Supported/Verified), supplied by, valid until, limitation
- Right column: short legend card (what the tiers mean)
- No remediation form on this screen — gap remediation is a separate journey step

#### `CoopReadiness.tsx`
- Requirements list with colours, grouped by Legal / Governance / Project / Fit
- Ready/Not ready verdict card
- Right column: boundary statement card (this is an assessment aid, not a credit approval)

#### `CoopPresent.tsx`
- Destination projection (A / B / N) with current readiness
- Big "Present to Lender" button
- Confirmation modal on success (dossier download)

**Deliverables:** Five files in `src/components/journeys/cooperative/`

---

### Step 4 — Lender Journey (`src/components/journeys/lender/`)

Role gate: `pfi_analyst | pfi_credit`

#### Steps:
1. **Portfolio Dashboard** — pipeline table of all cases
2. **Case Assessment** — for a selected case: requirements, reliance, decisions
3. **SME Detail** — drill-down: member list + **their personal livestock**

#### `LenderDashboard.tsx`
- Table: Cooperative | District | Readiness | Open Requests | Action
- Click row → `LenderAssessment`
- Distinct from cooperative assets — shows per-member summary

#### `LenderAssessment.tsx`
- Mirrors existing `LenderAssessmentScreen` but in the new shell
- pfi_analyst: read-only; pfi_credit: can record admissions/requests/outcomes

#### `LenderSMEDetail.tsx`
- **Key new feature:** Shows the SME (cooperative) members list
- Each member row is expandable: name, role, livestock with encumbrance
- Clear header: "Member Livestock (not cooperative assets)"
- Separate section: Cooperative Assets (land, equipment, etc.)
- Right column: total livestock value summary card

**Deliverables:** Three files in `src/components/journeys/lender/`

---

### Step 5 — Verifier Journey (`src/components/journeys/verifier/`)

Mirrors existing `VerifierQueueScreen` + `VerifierWorkbenchScreen` but in the new shell.

- `VerifierQueue.tsx`: Assignment cards list, one "Open" button per card
- `VerifierWorkbench.tsx`: Finding form (starts empty, Submit disabled until all fields complete)

**Deliverables:** Two files in `src/components/journeys/verifier/`

---

### Step 6 — Field Agent Journey (`src/components/journeys/fieldagent/`)

- `AgentQueue.tsx`: Cases assigned to this agent
- `AgentVerify.tsx`: Evidence submission form for a specific case

**Deliverables:** Two files in `src/components/journeys/fieldagent/`

---

### Step 7 — Fund Manager / NABII Journey (`src/components/journeys/fundmanager/`)

- `FMDashboard.tsx`: Pipeline + funnel
- `FMCohort.tsx`: Cohort readiness progression
- `FMDirectory.tsx`: All cooperatives searchable directory

**Deliverables:** Three files in `src/components/journeys/fundmanager/`

---

### Step 8 — Data Extension: Livestock & Member Roster

#### 8a. Extend `data/cases.json`

Add a `members_roster` array and `livestock` array to each case:

```json
{
  "members_roster": [
    {
      "id": "m-001",
      "name": "Agnes Mwale",
      "role": "secretary",
      "livestock": [
        { "species": "Cattle", "count": 4, "est_value_zmw": 32000, "encumbrance": "Unencumbered", "notes": "" },
        { "species": "Goats",  "count": 8, "est_value_zmw": 6400,  "encumbrance": "Unencumbered", "notes": "" }
      ]
    }
  ],
  "coop_assets": [
    { "type": "Land (communal)", "description": "12 ha, customary title", "encumbrance": "Unencumbered" },
    { "type": "Irrigation pump", "description": "1 × diesel pump", "encumbrance": "Unencumbered" }
  ]
}
```

> **Invariant preserved:** `members_roster` and `coop_assets` are documentary fields only. The engine does not consume them. They are display-only, just like `officers`.

#### 8b. Extend `engine/types.ts`

```ts
export interface LivestockItem {
  species: string;
  count: number;
  est_value_zmw: number;
  encumbrance: 'Unencumbered' | 'Pledged' | 'Under lien' | 'Unknown';
  notes: string;
}

export interface MemberRosterItem {
  id: string;
  name: string;
  role: string;
  livestock: LivestockItem[];
}

export interface CoopAsset {
  type: string;
  description: string;
  encumbrance: string;
}
```

Add to `CaseState`:
```ts
members_roster?: MemberRosterItem[];
coop_assets?: CoopAsset[];
```

**Deliverables:** Updated `data/cases.json`, updated `src/engine/types.ts`

---

### Step 9 — Journey Router (`src/components/sme.tsx` replacement)

Replace the monolithic `SmeHeroApp` with a **`JourneyRouter`** that:

1. Reads `role` from state (set on login screen)
2. Routes to the correct journey component based on role group:

```ts
const ROLE_JOURNEY: Record<Role, 'cooperative' | 'fieldagent' | 'lender' | 'verifier' | 'fundmanager'> = {
  secretary:    'cooperative',
  treasurer:    'cooperative',
  chairman:     'cooperative',
  member:       'cooperative',
  field_agent:  'fieldagent',
  pfi_analyst:  'lender',
  pfi_credit:   'lender',
  verifier:     'verifier',
  ta:           'fundmanager',
  fund_manager: 'fundmanager',
};
```

3. Each journey owns its own step list + step state
4. `capture` context wired to new screen IDs via the existing `CaptureProvider`
5. Engine state (`cases`, `setCases`, `runAction`, `reset`) hoisted to `JourneyRouter` — all journey components receive the same props interface

**Deliverables:** Updated `src/components/sme.tsx` (or new `src/JourneyRouter.tsx`)

---

### Step 10 — Login Screen Redesign

Full-page login with:
- Centred card, Symphony logo, dark background
- Role selector as large clickable tiles (icon + label + description)
- Case selector below role tiles
- Dominant "Enter as [Role]" button

Roles are grouped visually:
- Cooperative Officers (secretary, treasurer, chairman, member)
- Programme Support (field_agent, ta)
- Financial Institutions (pfi_analyst, pfi_credit)
- Independent (verifier)
- Platform (fund_manager)

**Deliverable:** New `src/components/journeys/LoginScreen.tsx`

---

### Step 11 — E2E Tests Update (`tests/`)

Existing tests use `data-testid="screen-tab-*"` for navigation. These must be updated:

| Old | New |
|---|---|
| `screen-tab-enrollment` | `journey-step-enrollment` |
| `screen-tab-sme_dashboard` | `journey-step-dashboard` |
| `screen-tab-gap_remediation` | `journey-step-evidence` |
| `screen-tab-lender_assessment` | `journey-step-assessment` |
| `screen-tab-verifier_queue` | `journey-step-queue` |
| `screen-tab-verifier_workbench` | `journey-step-workbench` |

Update affected tests in:
- `tests/e2e/` (all Playwright specs)
- `tests/hardening-phase9.spec.ts` (boundary label + responsive tests)
- `tests/capture-phase8.spec.ts` (capture session tests)

**Note:** `data-testid="reset-demo"`, `data-testid="active-role"`, `data-testid="active-case"` must be preserved.

**Deliverable:** Updated Playwright test files

---

### Step 12 — `DECISIONS.md` + `README.md` Updates

New DECISIONS entries:
- **Decision 24:** Role-specific linear journeys replace the global 19-tab nav. Rationale: one primary task per screen aligns with the commercial demonstration goal.
- **Decision 25:** Livestock + encumbrance data is a documentary display field. The engine does not evaluate it. Default "Unencumbered" is set at UI layer, never persisted to engine state.
- **Decision 26:** DFI member livestock view explicitly labels "Member Livestock (not cooperative assets)" to preserve the legal separation between personal and cooperative property.

---

## Implementation Order & Dependencies

```
Step 1 (CSS)
    ↓
Step 2 (Shell components)     ← depends on Step 1
    ↓
Step 8 (Data extension)       ← can run in parallel with Step 2
    ↓
Steps 3–7 (Journey screens)   ← depend on Step 2 + Step 8
    ↓
Step 9 (Journey Router)       ← depends on Steps 3–7
    ↓
Step 10 (Login Redesign)      ← depends on Step 9
    ↓
Step 11 (Tests)               ← depends on Steps 9–10
    ↓
Step 12 (Docs)                ← last
```

---

## What Is NOT Changed

| Item | Status |
|---|---|
| `src/engine/` (all files) | **Frozen** |
| `src/capture.tsx` | **Frozen** |
| `src/App.tsx` | Minor update only (import new router) |
| `src/components/core.tsx` | **Frozen** |
| `src/components/phase2.tsx` | **Frozen** |
| `src/components/help/` | **Frozen** |
| Engine invariants: "never silently upgrade an assertion" | **Enforced** |
| Boundary label discipline | **Preserved** (BoundaryLabel used in JourneyShell header) |
| `data-testid="reset-demo"` | **Preserved** |

---

## Success Criteria

- [ ] Role selected on login → lands on role-specific step 1 (never on a generic dashboard)
- [ ] Each screen has exactly one primary action (the "Continue" button)
- [ ] Cooperative enrollment includes livestock table with default "Unencumbered"
- [ ] Lender drill-down shows member livestock clearly labelled as personal (not coop assets)
- [ ] All engine invariants pass: `npm run verify:oracle`
- [ ] All boundary labels present: `npm run verify:all`
- [ ] All existing E2E tests pass with updated test IDs
- [ ] Vitest unit tests pass: `npx vitest run`
- [ ] No forbidden terms in bundle: `npm run verify:bundle`
- [ ] App is fully responsive at 320px, 768px, 1440px
