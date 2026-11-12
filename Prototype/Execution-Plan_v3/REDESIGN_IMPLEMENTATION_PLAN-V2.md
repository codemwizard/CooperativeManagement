# Symphony Prototype — Phase 10: Guided Journey Redesign (Revised)
### Implementation Plan — Revision 2

---

> **Status:** Revised per review feedback. Direction approved; this revision corrects layout, data boundaries, journey scope, encumbrance default, access model, governance discrepancy flow, and implementation order.

---

## Core design principles (immutable)

1. **One primary task per screen.** The user never faces governance, evidence, readiness and analytics simultaneously.
2. **Empty outer margins on ordinary screens.** The central column carries the task; left and right margins are blank by default.
3. **Compact progress, not a clickable sidebar.** Use "Step 2 of 8" text with a thin progress bar, not a persistent dark panel.
4. **Continue lives within the central workflow.** It is large and unambiguous, not a separate sticky footer bar that spans the full viewport width.
5. **Backward navigation is safe; forward navigation is gated.** A user can return to a completed step; they cannot skip required gates.
6. **Never silently upgrade an assertion.** No UI default may imply a claim that has not been made by an authorised person. This applies to encumbrance, governance, verification status and all other evidence fields.
7. **Personal data does not cross role boundaries.** Other portals see grouped asset totals, never personal information.
8. **Engine is frozen.** `src/engine/` is untouched. No changes to `engine/types.ts`. Display-only data lives in `data/` and is imported directly by UI components.

---

## Architecture

```
src/
├── App.tsx                        ← minor update: import JourneyRouter
├── capture.tsx                    FROZEN
├── index.css                      ← extend (additive only, no removals)
├── engine/                        FROZEN (all files)
├── components/
│   ├── core.tsx                   FROZEN
│   ├── help/                      FROZEN
│   ├── phase2.tsx                 FROZEN
│   ├── shell/                     NEW: layout primitives
│   │   ├── JourneyShell.tsx       ← centred column + minimal header
│   │   ├── StepIndicator.tsx      ← "Step N of M" + thin progress bar
│   │   └── index.ts
│   └── journeys/                  NEW: per-role screens
│       ├── LoginScreen.tsx        ← demo-entry screen (clearly labelled)
│       ├── cooperative/           secretary / treasurer / chairman / member
│       ├── fieldagent/            field_agent
│       ├── lender/                pfi_analyst / pfi_credit
│       ├── verifier/              verifier
│       ├── ta/                    ta (+ fund_manager on shared components)
│       ├── nabii/                 fund_manager (programme operator)
│       └── portfolio/             portfolio manager (first-class journey)
└── sme.tsx → replaced by JourneyRouter.tsx
```

**`App.tsx` change:** One import line changes (`SmeHeroApp` → `JourneyRouter`). The `CaptureProvider` wrapper and route guards (`/components`, `/capture`) are unchanged.

---

## What is and is not touched

| File / area | Status | Note |
|---|---|---|
| `src/engine/` (all 8 files) | **FROZEN** | No changes at all |
| `src/engine/types.ts` | **FROZEN** | Display-only fields do NOT go here |
| `src/capture.tsx` | **FROZEN** | CaptureProvider / CaptureAdmin unchanged |
| `src/components/core.tsx` | **FROZEN** | BoundaryLabel, RequirementCard, etc. reused as-is |
| `src/components/phase2.tsx` | **FROZEN** | FindingForm, AssuranceChain etc. reused as-is |
| `src/components/help/` | **FROZEN** | HelpProvider, TourBubble etc. reused as-is |
| `src/App.tsx` | **minor update** | Change one import; no structural change |
| `src/index.css` | **additive extend** | New tokens and layout classes appended; no deletions |
| `data/cases.json` | **additive extend** | New display fields added (see §Display-only data) |
| `src/components/sme.tsx` | **replaced** | Gutted and rebuilt as `JourneyRouter.tsx` |

---

## §Display-only data (not engine types)

Member roster, livestock, and cooperative assets are **documentary evidence fields** — like `officers` today. They are stored in `data/cases.json` and imported directly by UI components. They are **never read by the engine**.

### `data/cases.json` additions

```json
{
  "members_roster": [
    {
      "id": "m-001",
      "name": "Agnes Mwale",
      "cooperative_role": "Secretary",
      "livestock": [
        {
          "species": "Cattle",
          "count": 4,
          "est_value_zmw": 32000,
          "encumbrance": "Not recorded",
          "notes": ""
        }
      ]
    }
  ],
  "coop_assets": [
    {
      "type": "Land (communal)",
      "description": "12 ha, customary title",
      "encumbrance": "Not recorded"
    }
  ]
}
```

> **Encumbrance values (all fields):** `Not recorded` | `Reported unencumbered` | `Verified unencumbered` | `Pledged` | `Under lien` | `Disputed` | `Unknown`
>
> - `Not recorded` is the **initial/default state** — it makes no claim.
> - `Reported unencumbered` means an authorised person has stated this but it has not been independently checked.
> - `Verified unencumbered` requires a completed verification finding.
> - Any other status reflects what has been established.

### UI type definitions (display layer only)

These types live in `src/components/journeys/types.display.ts` — **not** in `engine/types.ts`:

```ts
export type EncumbranceStatus =
  | 'Not recorded'
  | 'Reported unencumbered'
  | 'Verified unencumbered'
  | 'Pledged'
  | 'Under lien'
  | 'Disputed'
  | 'Unknown';

export interface LivestockItem {
  species: string;
  count: number;
  est_value_zmw: number;
  encumbrance: EncumbranceStatus;
  notes: string;
}

export interface MemberRosterItem {
  id: string;
  name: string;
  cooperative_role: string;
  livestock: LivestockItem[];
}

export interface CoopAsset {
  type: string;
  description: string;
  encumbrance: EncumbranceStatus;
}
```

### Personal data access rule

Other portals (Lender, NABII, Portfolio, TA) **never see personal information**. They see only grouped totals:

- **Member-declared assets** (aggregate): total livestock count, total estimated value, encumbrance summary (e.g. "4 items — Not recorded")
- **Cooperative-owned assets**: listed individually (land, equipment) with encumbrance
- The distinction is labelled explicitly: "Member-declared assets (not cooperative collateral)"
- No individual names, roles, household data, or personal details appear in any non-cooperative portal.

---

## §Layout: The correct shell

The outer columns are **blank by default**. The centre column carries all content.

```
┌──────────────────────────────────────────────────────────────────┐
│  Symphony  [Role badge]                              [Exit demo] │  ← thin global bar
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [empty]   COOPERATIVE REGISTRATION · Step 2 of 8    [empty]    │
│            ──────────────────────────────                        │
│            ## Tell us about the cooperative                      │
│                                                                  │
│            Start with what you have. Missing records             │
│            can be added later without blocking progress.         │
│                                                                  │
│            [Form fields]                                         │
│                                                                  │
│            The next step records regulatory status.              │
│                                                                  │
│            [  Continue  ]    Save and exit                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### CSS additions to `index.css` (additive — no deletions)

```css
/* Journey shell — centred single column */
.journey-shell          { min-height: 100vh; background: var(--bg); }
.journey-header         { display: flex; align-items: center; justify-content: space-between;
                          padding: 10px 32px; border-bottom: 1px solid var(--line);
                          background: var(--surface); }
.journey-body           { width: min(640px, calc(100% - 48px)); margin: 0 auto;
                          padding: 48px 0 80px; }
.journey-step-label     { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em;
                          text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.journey-progress-bar   { height: 3px; background: var(--line); border-radius: 2px; margin-bottom: 36px; }
.journey-progress-fill  { height: 100%; background: var(--action); border-radius: 2px;
                          transition: width 0.3s ease; }
.journey-title          { font-size: 1.75rem; font-weight: 800; margin: 0 0 8px; }
.journey-subtitle       { color: var(--muted); margin: 0 0 32px; line-height: 1.5; }
.journey-hint           { color: var(--muted); margin: 24px 0 0; font-size: 0.9rem; line-height: 1.5; }

/* Primary action — within the flow, not a floating bar */
.btn-primary            { display: block; width: 100%; max-width: 320px; height: 52px;
                          margin-top: 32px; border: none; border-radius: 8px;
                          background: var(--action); color: #fff;
                          font-size: 1rem; font-weight: 700; cursor: pointer; }
.btn-primary:hover      { background: var(--action-bright, hsl(152 60% 32%)); }
.btn-primary:disabled   { opacity: 0.45; cursor: not-allowed; }
.btn-secondary-link     { margin-top: 12px; background: none; border: none; padding: 0;
                          color: var(--muted); font-size: 0.9rem; cursor: pointer;
                          text-decoration: underline; }

/* Role badge in header */
.role-badge             { display: inline-flex; align-items: center; gap: 6px;
                          padding: 4px 10px; border-radius: 999px;
                          background: var(--action-soft); color: var(--action);
                          font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }

/* Demo label */
.demo-label             { font-size: 0.7rem; color: var(--muted); padding: 2px 8px;
                          border: 1px solid var(--line); border-radius: 4px; }
```

---

## §Governance discrepancy: deterministic, not AI

The system flags officer discrepancies through **manual data entry comparison** — two separate forms:

1. **Certificate officers form:** The user manually types the names as they appear on the registration certificate.
2. **Current officers form:** The user manually types the names of officers currently serving at the workshop.

The engine deterministically compares the two sets. A discrepancy flag appears if any officer name on the certificate differs from (or is absent from) the current officers list.

**No AI inference.** The flag is a structural comparison of text the user entered — identical in logic to how `evaluate` compares evidence levels to minimum requirements.

This lives at **Step 3 — Establish governance** in the cooperative journey.

---

## §SME Journey (8 steps, workshop-to-follow-up model)

Role gate: `secretary | treasurer | chairman | member`

The journey explicitly models three operating modes:
- **Workshop-assisted:** Steps 1–3 completed in an assisted session with a field agent or TA officer present.
- **Cooperative-led completion:** Steps 4–6 can be done by the cooperative's officers in the following week (phone/offline handoff).
- **Ongoing updates:** Step 6 (baseline) and evidence can be updated after the initial record is submitted.

The journey does **not** show all 8 steps as a sidebar. It shows "Step N of 8" + a thin progress bar.

| Step | Screen | What the audience sees |
|---|---|---|
| 1 | **Register the enterprise** | A weak enterprise can be onboarded without a complete paper pack |
| 2 | **Regulatory status** | Expired and missing records are captured honestly; gaps are exposed, not hidden |
| 3 | **Governance** | Certificate officers vs current officers → deterministic discrepancy flag |
| 4 | **Operating history** | Fragmented transaction evidence becomes an organised timeline |
| 5 | **Enrol members** | Membership list + member-declared livestock (with `Not recorded` encumbrance) |
| 6 | **Capture baseline** | ESG and project indicators with source and measurement date |
| 7 | **Review readiness** | Requirements and gaps evaluated against selected destination |
| 8 | **Present the record** | NABII sees what improved, what remains unresolved, what support is needed |

### Step 1: Register the enterprise (`CoopRegister.tsx`)

- Cooperative name, district, province, programme
- Activity and project name
- Number of members (approximate)
- **"You do not need complete paperwork to register. Missing items are recorded as gaps, not blocks."** — visible statement

### Step 2: Regulatory status (`CoopRegulatory.tsx`)

- Registration number (or "Not available")
- Registration date and expiry date
- Certificate status: `Present and current` | `Present but expired` | `Not available`
- Any expired or missing items displayed as evidence gaps — not errors that block progress
- Limitation text is set by the role and shown, not hidden

### Step 3: Governance (`CoopGovernance.tsx`)

Two forms:
1. **Certificate officers** — names exactly as they appear on the registration certificate (may be blank if certificate is not available)
2. **Current officers** — names of officers present at the workshop today

Comparison runs deterministically on submit. If any name differs or is absent, a discrepancy card appears:

```
⚠ Discrepancy detected
Certificate records Agnes Mwale as Secretary.
Current record shows Beatrice Chanda.
This will be noted in the enterprise record and must be resolved before lenders assess governance.
```

No AI. No auto-resolution. The discrepancy is stored as a governance evidence item at level `asserted`.

### Step 4: Operating history (`CoopHistory.tsx`)

- Income records: seasons count, basis, currency
- Farming history: crops, hectares, seasons
- Evidence level is set to `asserted` from self-declaration; upgrades to `supported` when documents are uploaded
- Each item shows its limitation text

### Step 5: Enrol members (`CoopMembers.tsx`)

- Member list: name, role, add livestock categories
- Livestock per member: species, count, estimated value, encumbrance (`Not recorded` by default)
- **The form does not pre-fill encumbrance.** The field is blank until the member or officer explicitly sets a value.
- "Member livestock is personal property, not cooperative collateral. It is recorded here because it may be relevant to household resilience assessments."

### Step 6: Capture baseline (`CoopBaseline.tsx`)

- ESG indicators: land area, water source, environmental certificate
- Project indicators: hectares, irrigation, expected yield
- Each field has: value, unit, source, measurement date, limitation
- Indicators with no data show as "Not yet captured" — not zero

### Step 7: Review readiness (`CoopReadiness.tsx`)

- Destination selector (A / B / N)
- Requirements list grouped by Legal / Governance / Project / Fit
- Ready/not-ready verdict
- Unresolved gaps with suggested next actions
- Boundary statement: "This is a structured evidence record, not a credit assessment or approval."

### Step 8: Present the record (`CoopPresent.tsx`)

- Destination projection with readiness status
- "Present readiness record" action
- Post-presentation: confirmation + dossier export
- Summary of what remains unresolved — visible to NABII and TA, not hidden on presentation

---

## §Field Agent Journey (`fieldagent/`)

Role gate: `field_agent`

Steps:
1. **Assignment queue** — cases assigned to this agent, with open tasks listed
2. **Evidence collection** — select a case, submit evidence for a specific requirement, set limitation text
3. **Follow-up status** — cases awaiting agent visit vs completed

---

## §TA / SBGI Journey (`ta/`)

Role gate: `ta`

**Separated from NABII.** TA operates around intervention assignment and outcomes.

Steps:
1. **Intervention queue** — enterprises in the TA provider's scope with open gaps
2. **Select enterprise** — inspect current readiness, open gaps, existing evidence
3. **Record assignment** — what intervention was assigned, by whom, target requirement
4. **Record completion evidence** — what was done, what evidence was produced, limitation text
5. **Reassess readiness** — does the new evidence change the evaluation? (engine does the check — TA completion does not auto-satisfy a requirement)

TA completion is **visible to NABII** and, where authorised, to the relevant PFI. A TA completion note does not constitute independent verification.

---

## §NABII Journey (`nabii/`)

Role gate: `fund_manager` (programme operator)

Separated from TA. NABII manages the pipeline — it does not assign interventions.

Steps:
1. **Programme overview** — distribution of enterprises across defined states (registered, gap-closed, assessment-ready, financed, monitoring)
2. **Cohort view** — select a state → list of enterprises in that state → select one → open record
3. **Identify needs** — which enterprises have open gaps that TA or field agents could address
4. **Coordinate support** — link to TA queue (read-only view of TA assignments from NABII perspective)
5. **Discoverable pipeline** — enterprises that are assessment-ready and have not yet been presented to a destination

From Step 2 onwards: selecting an enterprise opens its record. NABII sees the same evidence record the cooperative built. Gaps are visible. The state must match the evaluation result — NABII cannot manually override a readiness verdict.

---

## §PFI Journey (`lender/`)

Role gate: `pfi_analyst | pfi_credit`

Organised around: **Discover → Inspect → Query or verify → Assess → Decide → Monitor**

Steps:
1. **Discover** — list of enterprises that are assessment-ready or have been presented to this institution. (Not limited to enterprises that have already been pushed to the PFI — this is the product thesis.)
2. **Inspect record** — evidence tiers, sourcing, limitations, verification history
3. **Asset summary** — cooperative-owned assets + member-declared asset totals (no PII; no individual names)
4. **Query or verify** — request more evidence or raise a request for independent query
5. **Assess** — requirements against the selected destination, with reliance controls for `pfi_credit`
6. **Decide** — outcome recorded by lender (never pre-selected by Symphony)
7. **Monitor** — post-financing covenant tracking (for financed cases)

---

## §VVB Journey (`verifier/`)

Role gate: `verifier`

1. **Assignment queue** — assignments for this verifier, showing case, claim/evidence type, scope
2. **Workbench** — defined claim + scope + source evidence is shown before any form appears. The finding form starts empty; Submit is disabled until result, basis and limitation are all completed.

Verification applies to a defined claim and scope only. A finding on `registration` does not constitute a finding on `governance`.

---

## §Portfolio Manager Journey (`portfolio/`)

Role gate: shared (may be used by `pfi_credit`, `fund_manager` or a dedicated portfolio role)

This is a **first-class journey**, not a sub-screen of another role.

Steps:
1. **Select portfolio** — which programme, cohort or institution
2. **Review state and change** — enterprise states, evidence changes since last review, new findings
3. **Investigate exception** — select an enterprise with a flag or dispute → open record
4. **Assign follow-up** — link to TA queue or field agent assignment
5. **Review evidence** — new evidence since last portfolio review
6. **Report** — export portfolio state (existing dossier export, applied at portfolio level)

Reuses the same enterprise records. No parallel portfolio-specific data model.

---

## §SME Discovery Marketplace (minimal journey)

This is a **capability demonstration**, not a full application. It proves the product thesis that an enterprise can be relevant to multiple institutions from a single record.

Steps:
1. **Define criteria** — destination type, province, programme, minimum readiness state
2. **Find matching enterprises** — list with readiness summary, evidence tier summary, open gaps count
3. **Inspect record** — same evidence record, with boundary statement
4. **Request engagement** — a logged request (no live workflow needed in Phase 10)

This is accessible from the NABII, PFI and Portfolio journeys as a shared component — not a separate top-level login role in Phase 10.

---

## §Login screen (demo-entry, clearly labelled)

Full-page centred card. Label reads: **"Symphony Demo — Select a persona to begin"**

Role tiles are grouped:
- **Cooperative Officers:** Secretary, Treasurer, Chairman, Member
- **Programme Support:** Field Agent, TA Officer
- **Financial Institutions:** PFI Analyst, PFI Credit Officer
- **Independent:** Verifier
- **Platform:** Fund Manager / NABII

Case selector below role tiles. "Enter as [Role]" button.

The screen carries a visible note: **"This is a demo entry screen. In a live deployment, access is controlled by institutional authentication."**

`data-testid="demo-login-screen"` — preserved for Playwright.

---

## §Implementation phases (thin vertical slice first)

### Phase A — Lock the design contract

**Goal:** Agree on the exact shell, step indicator, Continue placement and exception branching before any journey screen is built.

Deliverables:
- `src/index.css` — additive CSS additions only
- `src/components/shell/JourneyShell.tsx` — centred column, thin header, role badge, reset
- `src/components/shell/StepIndicator.tsx` — "Step N of M" + progress bar
- `src/components/journeys/types.display.ts` — display-only types (no engine changes)
- `data/cases.json` — additive fields: `members_roster`, `coop_assets` (with `Not recorded` encumbrance defaults)

Acceptance: render the shell with a placeholder step and confirm the layout matches the design principle (empty margins, centred content, Continue within flow).

### Phase B — One complete SME slice

**Goal:** Take the fictional cooperative (Chisamba Farmers, case-1) through all 8 steps. Validate the actual experience before multiplying screens.

Deliverables:
- `src/components/journeys/cooperative/` — all 8 step components
- `src/components/journeys/LoginScreen.tsx`
- `src/components/journeys/JourneyRouter.tsx` — cooperative branch only
- `src/App.tsx` — one-line import change
- `data/cases.json` — governance discrepancy seed data for case-1 (certificate officers ≠ current officers)

Acceptance criteria for Phase B:
- [ ] Login → Cooperative → lands on Step 1 (Register)
- [ ] Governance step shows certificate officers form + current officers form separately
- [ ] Mismatched names produce a deterministic discrepancy card (no AI)
- [ ] Livestock encumbrance field starts blank ("Not recorded") — no pre-fill
- [ ] Evidence items show their limitation text; nothing is silently upgraded
- [ ] Readiness step evaluates correctly via existing `evaluate()` — no engine changes
- [ ] "Save and exit" preserves entered data in React state
- [ ] Reset returns to Step 1 with baseline data

### Phase C — Add institutional journeys

**Goal:** Implement NABII, TA, PFI, VVB, Portfolio and Discovery flows. Each uses the shared shell and the existing engine.

Deliverables (in order):
1. `nabii/` — 5 steps
2. `ta/` — 5 steps
3. `lender/` — 7 steps
4. `verifier/` — 2 steps
5. `portfolio/` — 6 steps
6. Discovery as a shared component (usable from NABII, PFI, Portfolio)
7. `JourneyRouter.tsx` — all role branches wired

Acceptance criteria for Phase C:
- [ ] NABII aggregate counts reconcile with cohort list; selecting a state opens the correct enterprise list
- [ ] TA completion updates the gap record but does **not** auto-satisfy the requirement in the engine
- [ ] PFI asset view shows only grouped totals — no individual member names or personal data
- [ ] VVB workbench: finding form starts empty; Submit disabled until complete; finding scoped to its claim
- [ ] Portfolio: later findings are reflected in portfolio view without erasing prior history
- [ ] Discovery: filtering by destination + province + readiness returns the correct subset

### Phase D — Behavioural equivalence and documentation

**Goal:** Prove the redesign preserves all engine behaviours; update tests and docs.

Deliverables:
- Updated Playwright test files (test ID migration + 12 new behavioural tests)
- `DECISIONS.md` — entries 24–29
- `README.md` — updated journey map and test commands

---

## §Test suite

### Preserved test IDs

`data-testid="reset-demo"`, `data-testid="active-role"`, `data-testid="active-case"` are **preserved**.

### Test ID migration

| Old (removed) | New |
|---|---|
| `screen-tab-enrollment` | `journey-step-1-register` |
| `screen-tab-sme_dashboard` | `journey-step-7-readiness` |
| `screen-tab-gap_remediation` | `journey-step-4-history` |
| `screen-tab-lender_assessment` | `pfi-step-assess` |
| `screen-tab-verifier_queue` | `vvb-step-queue` |
| `screen-tab-verifier_workbench` | `vvb-step-workbench` |
| `screen-tab-nabii_pipeline` | `nabii-step-overview` |
| `screen-tab-nabii_cohort` | `nabii-step-cohort` |

### 12 required behavioural E2E tests

1. **Weak cooperative → governed record** — Chisamba retains its expired certificate, governance discrepancy and fragmented evidence; the UI exposes every gap without silently correcting any of it.

2. **Save and resume** — user leaves enrollment midway; returns to the same step with all entered data intact; no duplicate enterprise is created.

3. **Workshop-to-follow-up continuity** — initial registration (Steps 1–3) is completed; cooperative later completes Steps 4–6 independently; both phases are linked to the same record; the event log reflects both sessions.

4. **Governance discrepancy (deterministic)** — enter "Agnes Mwale" as Secretary on the certificate form; enter "Beatrice Chanda" as Secretary on the current officers form; submit; verify the discrepancy card appears with both names; verify no AI call is made; verify the evidence item is stored at level `asserted` with the appropriate limitation.

5. **Destination-specific readiness** — same evidence state for case-1 produces `ready` for destination A and `not ready` for destination B (or whichever the data supports); no duplication of the underlying enterprise record.

6. **NABII drill-down** — aggregate count in the overview matches the number of enterprises in the cohort list; filtering by province produces the correct subset; selecting an enterprise opens the correct record (not a generic placeholder).

7. **TA intervention** — TA officer assigns an intervention to case-1's governance gap; records completion evidence; the gap record is updated; the `evaluate()` result changes only if the new evidence satisfies the rule (engine decides, not TA action).

8. **PFI discovery and decision** — PFI analyst discovers case-1 via criteria filter; inspects the evidence record; raises an evidence request; PFI credit officer records outcome "Approved"; outcome is stored; Symphony does not pre-select or imply the outcome.

9. **VVB scope** — verifier submits a finding on `registration`; verify the finding has `assignment_id` matching the registration assignment; verify it does not affect the governance evidence item; verify Submit was disabled until all fields were complete.

10. **Portfolio continuity** — a new finding is added after the initial portfolio review; the portfolio view reflects the updated state; the previous finding history is still present in the event log; no history is erased.

11. **Access control** — `pfi_analyst` viewing the lender asset summary sees grouped totals only (no individual names); attempting to access `record_outcome` as `pfi_analyst` (not `pfi_credit`) is blocked with the correct error code (`ROLE_NOT_PERMITTED`); verifier cannot see the lender assessment screen.

12. **Navigation regression** — every role lands on its own first step after login; backward navigation from Step 3 returns to Step 2 with data intact; the user cannot reach Step 5 without completing Step 4's required fields; `reset-demo` returns every role to its Step 1.

### Preserved verification commands

Run in this order as part of Phase D acceptance:

```sh
npm run verify:oracle
npm run verify:help
npm run verify:bundle
npm run verify:all
npx vitest run
npx playwright test
```

These are the repository-defined commands. Do not substitute alternatives.

---

## §DECISIONS.md additions (Phase D)

| # | Decision | Rationale |
|---|---|---|
| 24 | Role-specific linear journeys replace the 19-tab global nav | One task per screen; the user experiences a progression, not an application menu |
| 25 | Display-only data (`members_roster`, `coop_assets`) lives in `data/cases.json`, not `engine/types.ts` | Engine boundary is preserved; display types are defined in `components/journeys/types.display.ts` |
| 26 | Encumbrance default is "Not recorded" | Silently defaulting to "Unencumbered" would imply a claim no authorised person has made |
| 27 | Governance discrepancy is detected by deterministic text comparison between two manually entered officer sets | No AI inference; the flag is a structural comparison of user-entered data |
| 28 | Personal data (member names, household details) does not appear in any non-cooperative portal | Other portals see only grouped asset totals labelled as member-declared, not cooperative collateral |
| 29 | Portfolio management is a first-class journey, not a sub-screen | A portfolio manager's task flow (review → investigate → assign → report) is distinct from any single institution's assessment flow |

---

## Success criteria

- [ ] Role selected on login → lands on role's Step 1 (never on a generic dashboard or the old tab layout)
- [ ] Outer margins are empty on all data-entry and progression screens
- [ ] Progress shows as "Step N of M" + thin bar, not a clickable sidebar
- [ ] Continue button is within the central column, not a separate full-width sticky bar
- [ ] Governance discrepancy is flagged deterministically from two manually entered forms
- [ ] Livestock encumbrance initial value is blank/"Not recorded" — no pre-fill
- [ ] No individual member names appear in PFI, NABII or Portfolio views
- [ ] Engine invariants pass: `npm run verify:oracle`
- [ ] Boundary labels present: `npm run verify:all`
- [ ] All 12 behavioural E2E tests pass
- [ ] Vitest unit tests pass: `npx vitest run`
- [ ] Bundle clean: `npm run verify:bundle`
- [ ] App is fully responsive at 320px, 768px, 1440px
