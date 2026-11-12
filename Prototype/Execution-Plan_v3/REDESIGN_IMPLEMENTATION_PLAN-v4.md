# Symphony Prototype — Phase 10: Guided Journey Redesign
### Revision 3 — Implementation Contract

---

> **Status:** Revision 3. Addresses all six blockers from the V2 review. This is the approved implementation contract. Phase A and Phase B may proceed on approval.

---

## 0. Engine scope determination (resolved)

The engine (`src/engine/`) is **frozen for its core logic**. However, "frozen" is not a blanket constraint that prevents the UI from calling existing engine actions. The determination is:

| Item | Classification | Consequence |
|---|---|---|
| `evaluate`, `applyAction`, `buildDossier`, `pipeline.*`, `scope.*` | **Engine logic — frozen** | No changes to function signatures or behaviour |
| `engine/types.ts` | **Frozen** | No changes. Display-only types go elsewhere |
| `engine/data.ts` | **Frozen** | No changes. `loadCases()` is unchanged |
| `add_evidence` action | **Existing, reused** | Governance discrepancy stored via this action — no engine change needed |
| `data/cases.json` | **Extended (additive)** | New display-only fields appended; existing fields untouched |
| `data/roles.json` | **Extended (additive)** | New actions added if needed; existing actions untouched |
| `src/components/journeys/types.display.ts` | **New — display layer** | All new types live here, not in engine |

**Engine actions the new journeys call:**
- `add_evidence` — to store governance discrepancy and new evidence items entered by cooperative officers
- `upload_minutes` / `signoff_minutes` — unchanged governance workflow
- `present_to_destination` — unchanged
- `record_outcome`, `record_admission`, `request_evidence`, `record_reliance` — unchanged lender workflow
- `assign_verification`, `record_verification_finding` — unchanged verifier workflow

No new action types are added to the engine in Phase 10.

---

## 1. Data-flow contract (explicit, per field)

Every field that the new UI reads or writes must have an unambiguous contract covering origin, mutation target, evidence semantics, engine consumption, cross-role visibility, and survival across navigation.

### 1A. Enterprise profile fields (name, district, province, programme, activity)

| Contract point | Value |
|---|---|
| **Origin** | `data/cases.json` → loaded by `loadCases()` → `baselineCases` |
| **Mutation target** | React state (`cases` array in `JourneyRouter`) — same as today |
| **Evidence semantics** | Not an evidence item; descriptive metadata |
| **Engine consumption** | `evaluate()` does not read these fields; `dossier` reads `caseState.name` for labelling |
| **Cross-role visibility** | All roles; no restriction |
| **Survives** | Navigation: yes (React state). Reload: yes (localStorage draft). Reset: returns to `baselineCases` |

### 1B. Members roster (`members_roster`)

| Contract point | Value |
|---|---|
| **Origin** | `data/cases.json` — new additive field (see §3) |
| **Mutation target** | Draft state in `localStorage['symphony.draft.v1']` (see §2) — React state mirrors this |
| **Evidence semantics** | Display-only. Not an `EvidenceItem`. Not read by the engine |
| **Engine consumption** | None |
| **Cross-role visibility** | Cooperative journey only. All other portals receive **grouped totals only** via a dedicated selector function (see §5) |
| **Survives** | Navigation: yes. Reload: yes (draft). Reset: returns to `data/cases.json` seed values |

### 1C. Cooperative assets (`coop_assets`)

Same contract as 1B. Display-only. Not engine state. Grouped totals visible to other portals (labelled as "Cooperative-declared assets").

### 1D. Livestock per member

Same contract as 1B. Initial `encumbrance` value is `"Not recorded"` — stored as the string literal. The UI renders this as a selected option in the dropdown, visually distinguished from a positively stated status (e.g. muted colour vs. normal weight).

### 1E. Governance officers — certificate vs current (new)

| Contract point | Value |
|---|---|
| **Origin** | `data/cases.json` → `officers` (existing: `{chairman, secretary, treasurer}`) + new `certificate_officers` field (see §3) |
| **Prerequisite** | **At least one member must be enrolled in `members_roster` (Step 3) before current officers are determined (Step 4).** Current officers are determined from enrolled members and inherit their `member_id`. If no members are enrolled, there are no member IDs to assign or compare, so officer determination cannot proceed. |
| **Mutation target** | `applyAction(caseState, {type: 'add_evidence', evidence_type: 'governance_officers', level: 'asserted', item: { certificate_entries, current_entries, comparison_result }, limitation: '...' }, actor, at)` |
| **Evidence semantics** | A governed `EvidenceItem` stored under `caseState.evidence.governance_officers`. Level is `asserted` when entered by a cooperative officer; may be upgraded to `supported` if documentary confirmation is uploaded |
| **Engine consumption** | `evaluate()` evaluates `governance_officers` against the `governance` requirement (if the destination's requirement references it). The `addEvidence` function already handles this — no engine change |
| **Cross-role visibility** | `caseState.evidence.governance_officers` is visible to all roles with access to that case. The limitation text explains that this is a self-reported comparison and not independently verified |
| **Survives** | Navigation: yes. Reload: yes (persisted to `caseState.events` via `applyAction`). Reset: returns to `baselineCases` (which has no `governance_officers` evidence item for case-1 initially) |

### 1F. Encumbrance status

| Contract point | Value |
|---|---|
| **Type** | `EncumbranceStatus` in `types.display.ts` — not in `engine/types.ts` |
| **Initial value in data** | `"Not recorded"` (stored in `data/cases.json` as the literal string) |
| **Initial UI state** | The dropdown/select control shows `"Not recorded"` as the selected option, styled with muted foreground to distinguish it from a positively asserted value |
| **Mutation** | Cooperative officer selects a different value → stored in draft state. If the change is material (e.g. "Pledged"), the officer is prompted to upload a supporting document |
| **Engine consumption** | None. Encumbrance is not evaluated by `evaluate()` |
| **Cross-role visibility** | Grouped aggregate in other portals. Shown as: "Member-declared assets: N items, estimated ZMW X, encumbrance: [most conservative status in group]" |

### 1G. Readiness

| Contract point | Value |
|---|---|
| **Origin** | `evaluate(caseState, destinationById[dest], meta.demo_date)` — computed, never typed in |
| **Mutation target** | Never directly mutated. Changes only when `caseState.evidence` changes via `applyAction` |
| **Evidence semantics** | Derived result, not an evidence item |
| **Engine consumption** | IS the engine output. Invariant I4 applies |
| **Cross-role visibility** | All roles. NABII and portfolio views call `evaluate()` on the same `caseState` |
| **Survives** | Not stored; recomputed from `caseState` on every render |
| **Scoping** | Always scoped to a specific destination. No role may present it as a universal "ready" status |

### 1H. Historical events (`caseState.events`)

| Contract point | Value |
|---|---|
| **Origin** | `[]` initially; populated by `applyAction` returning `{ok: true, event}` |
| **Mutation** | Every call to `applyAction` appends one event. Events are never deleted |
| **Survives** | Navigation: yes. Reload: yes (events live in the `caseState` in React state, mirrored to draft in localStorage). Reset: clears all events — returns to `baselineCases[i].events = []` |
| **Workshop / follow-up distinction** | See §2 |

---

## 2. Persistence and session semantics

### Demo persistence model

All state is React `useState` within the current browser session. **True cross-session persistence uses `localStorage`.**

```
localStorage['symphony.draft.v1'] = {
  cases: CaseState[],          // current mutable engine state
  draftPhase: 'initial' | 'workshop_complete' | 'followup_complete',
  draftCaseId: string,
  draftRole: Role,
  draftStep: number,
  savedAt: string,             // ISO timestamp
}
```

Three distinct actions interact with this store:

| Action | What happens |
|---|---|
| **Auto-save** | On every step advance, draft is written to localStorage |
| **"Save and exit"** | Draft is written to localStorage; user is returned to the login screen; React state is NOT reset |
| **"Reset demo"** | `localStorage['symphony.draft.v1']` is deleted; React state is reset to `baselineCases`; capture session is reset; user is returned to login |
| **"Reset current step"** | Clears only the form fields in the current step; does not affect other steps, draft, or engine state |

On app load, if a draft exists in localStorage and no reset has been triggered, the JourneyRouter offers: **"Resume draft"** or **"Start fresh"**.

### Workshop-to-follow-up model (demo simulation)

The `draftPhase` field models the operating mode without requiring a real multi-device handoff:

| `draftPhase` | Meaning | Steps covered |
|---|---|---|
| `'initial'` | No data entered yet | — |
| `'workshop_complete'` | Steps 1–4 done (assisted session) | Registration, Regulatory, Member Enrollment, Governance |
| `'followup_complete'` | Steps 5–8 done | Operating History, Baseline Assets, Readiness, Present |

The event log records every `applyAction` call with its timestamp. Because all demo events share `meta.demo_date`, the session boundary is **labelled in the UI** ("Workshop session" / "Follow-up session") based on `draftPhase` at the time each action was recorded — not by wall-clock time.

The "workshop-to-follow-up" E2E test validates that:
1. Steps 1–4 are completed → `draftPhase` advances to `'workshop_complete'`
2. A simulated "exit" occurs (navigate to login)
3. "Resume draft" is selected → user is placed at Step 5
4. Steps 5–8 are completed → `draftPhase` advances to `'followup_complete'`
5. The event log contains events from both phases
6. No duplicate enterprise is created (same `caseState.id` throughout)

This is explicitly a **demo simulation** — not an operational handoff mechanism. It is labelled as such in the UI and in the README.

---

## 3. Data additions to `data/cases.json`

New fields are additive. Existing fields are untouched. All new fields are display-only except `certificate_officers` (which seeds the governance comparison).

```jsonc
{
  // Existing fields: id, name, district, province, programme, activity,
  // members, project, evidence, events, financing, presentation, officers

  // NEW: pre-seeded certificate officers (different from current for case-1)
  "certificate_officers": [
    { "member_id": "mbr-001",    "office": "Chairman",  "name": "Joseph Mwale" },
    { "member_id": "m-cert-002", "office": "Secretary", "name": "Agnes Phiri"  },  // ← deliberately different from current secretary
    { "member_id": "mbr-003",    "office": "Treasurer", "name": "Grace Tembo"  }
  ],

  // NEW: current officers (drawn from enrolled members roster with concrete member IDs)
  "current_officers": [
    { "member_id": "mbr-001", "office": "Chairman",  "name": "Joseph Mwale" },
    { "member_id": "mbr-002", "office": "Secretary", "name": "Mary Phiri"   },  // ← different ID (mbr-002 vs m-cert-002) AND name
    { "member_id": "mbr-003", "office": "Treasurer", "name": "Grace Tembo"  }
  ],

  // NEW: member roster (display-only; minimum 1 enrolled member required before officers determined)
  "members_roster": [
    {
      "member_id": "mbr-001",
      "name": "Joseph Mwale",
      "cooperative_role": "Chairman",
      "livestock": [
        { "species": "Cattle", "count": 6, "est_value_zmw": 48000, "encumbrance": "Not recorded", "notes": "" }
      ]
    },
    {
      "member_id": "mbr-002",
      "name": "Mary Phiri",
      "cooperative_role": "Secretary",
      "livestock": [
        { "species": "Goats", "count": 12, "est_value_zmw": 9600, "encumbrance": "Not recorded", "notes": "" }
      ]
    },
    {
      "member_id": "mbr-003",
      "name": "Grace Tembo",
      "cooperative_role": "Treasurer",
      "livestock": []
    },
    {
      "member_id": "mbr-004",
      "name": "Agnes Mwale",
      "cooperative_role": "Member",
      "livestock": [
        { "species": "Cattle", "count": 4, "est_value_zmw": 32000, "encumbrance": "Not recorded", "notes": "" }
      ]
    }
  ],

  // NEW: cooperative-owned assets (display-only)
  "coop_assets": [
    { "type": "Land (communal)", "description": "12 ha, customary title", "encumbrance": "Not recorded" },
    { "type": "Irrigation pump", "description": "1 × diesel pump",        "encumbrance": "Not recorded" }
  ]
}
```

> **Note on `certificate_officers` vs `current_officers`:** These are initial seed values in `data/cases.json`. When the governance step is completed in the UI, the result of the comparison is stored as a governed evidence item (`governance_officers`) via `applyAction`. The seed values are not re-read after that.

---

## 4. Officer comparison — precise specification

### Prerequisite rule (Member enrollment preceding officer determination)

At least one member must be enrolled in the member roster (Step 3: `CoopMembers.tsx`) before current officers can be established (Step 4: `CoopGovernance.tsx`). Current officers are chosen from or mapped to the enrolled membership roster, which assigns them a concrete `member_id` (e.g. `mbr-001`, `mbr-002`, `mbr-003`). If no members are enrolled in the roster, there are no member IDs in existence to compare against, and the user is prevented from proceeding to or completing officer determination until at least one member is enrolled.

### Comparison algorithm

1. For each office (`Chairman`, `Secretary`, `Treasurer`):
   a. Retrieve the current officer from the enrolled member selection, which provides their `current_member_id` and `name`.
   b. Compare against the certificate officer entry for that office:
      - **If there is no `member_id` on either record (null, empty, or unrecorded)**: flag as a discrepancy (`discrepancy_type: 'no_id_recorded'`). The discrepancy card displays: *"Member ID missing on certificate or current record."*
      - **If both records have a `member_id`, but the IDs are different (`certificate_member_id !== current_member_id`)**: flag as an officer discrepancy (`discrepancy_type: 'person_discrepancy'`).
      - **If `member_id` matches, but names differ**: flag as a name discrepancy (`discrepancy_type: 'name_discrepancy'`).
      - **If both `member_id` and name match**: no discrepancy (`discrepancy_type: 'none'`).

2. Any certificate officer not matched to a current office, or current officer not matched on certificate, is flagged as `discrepancy_type: 'not_on_certificate'`.

3. Output: a structured comparison result stored under `governance_officers` evidence item:

```ts
{
  certificate_entries: OfficerEntry[],   // exactly as entered/seeded
  current_entries: OfficerEntry[],       // exactly as entered/seeded
  comparison_result: Array<{
    office: string;
    certificate_member_id: string | null;
    current_member_id: string | null;
    id_match: boolean;
    name_match: boolean;
    discrepancy_type: 'none' | 'name_discrepancy' | 'person_discrepancy' | 'not_on_certificate' | 'no_id_recorded';
    note: string;
  }>;
  has_discrepancy: boolean;
}
```

### What the discrepancy flag means

The flag is a **record discrepancy**, not an adjudication. It does not:
- Establish which record is authoritative
- Automatically block a destination requirement
- Imply that any officer is unauthorised

The flag means: "The names and/or identifiers on the registration certificate differ from the current officers as recorded at the workshop. This is an unresolved discrepancy. It is preserved as-is."

### Storage

```ts
applyAction(caseState, {
  type: 'add_evidence',
  evidence_type: 'governance_officers',
  level: 'asserted',
  item: { certificate_entries, current_entries, comparison_result, has_discrepancy },
  limitation: has_discrepancy
    ? 'Officer records compared by ID where available. Discrepancy detected. Not independently resolved.'
    : 'Officer records compared by ID where available. No discrepancy detected. Not independently verified.',
}, actor(role), demoActionAt)
```

### Destination-specific blocking

Whether a discrepancy blocks a requirement is determined by the **destination's requirement rules** and evaluated by `evaluate()`. The UI does not add its own blocking logic. If destination A's governance requirement evaluates to `unresolved` because the `governance_officers` evidence is at level `asserted` and the minimum required level is `supported`, the requirement is shown as unresolved — because `evaluate()` says so, not because the UI detected a discrepancy.

### Minutes / signoff

The existing `upload_minutes` (secretary only) and `signoff_minutes` (chairman only) actions are preserved. The governance step flow is:

1. Enter certificate officers (secretary)
2. Enter current officers (secretary)
3. System compares → discrepancy card shown if applicable
4. Secretary uploads minutes → `add_evidence('governance', 'supported', ...)`
5. Chairman signs off → `signoff_minutes`
6. Evidence level for `governance` advances to `supported`

The `governance_officers` evidence item records the comparison. The `governance` evidence item records the minutes. These are separate evidence types.

---

## 5. Personal data access boundary

### Rule

Member names, individual livestock details, and household information are **not transmitted to any non-cooperative portal**. This is enforced at the **data-access layer** — not only at the rendering layer.

### Mechanism

A selector function in `src/components/journeys/assetSummary.ts` computes grouped totals. Other portal components **import only from this selector** — they never receive the raw `members_roster` array.

```ts
// src/components/journeys/assetSummary.ts
export function memberAssetSummary(caseState: CaseState & { members_roster?: MemberRosterItem[] }) {
  const roster = caseState.members_roster ?? [];
  const allLivestock = roster.flatMap(m => m.livestock);
  const totalCount = allLivestock.reduce((sum, l) => sum + l.count, 0);
  const totalValue = allLivestock.reduce((sum, l) => sum + l.est_value_zmw, 0);
  const encumbranceStatuses = [...new Set(allLivestock.map(l => l.encumbrance))];
  const mostConservative = conservativeEncumbrance(encumbranceStatuses);
  return {
    livestock_item_count: totalCount,
    livestock_est_value_zmw: totalValue,
    encumbrance_summary: mostConservative,
    label: 'Member-declared assets (personal property — not cooperative collateral)',
  };
}

export function coopAssetSummary(caseState: CaseState & { coop_assets?: CoopAsset[] }) {
  return (caseState.coop_assets ?? []).map(a => ({
    type: a.type,
    description: a.description,
    encumbrance: a.encumbrance,
  }));
}
// No function exports raw member names or livestock records
```

### `conservativeEncumbrance` ordering

`Pledged` > `Under lien` > `Disputed` > `Unknown` > `Reported unencumbered` > `Verified unencumbered` > `Not recorded`

The most conservative status in the group is shown in the aggregate summary.

### Access map

| Data | Cooperative journey | Field agent | TA | NABII | PFI | VVB | Portfolio |
|---|---|---|---|---|---|---|---|
| Member names | **Yes** | **Yes** (own cases) | No | No | No | No | No |
| Member livestock detail | **Yes** | **Yes** (own cases) | No | No | No | No | No |
| Member asset summary (totals) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Cooperative-owned assets (detail) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Encumbrance per item | **Yes** | **Yes** | No | No | No | No | No |
| Encumbrance aggregate | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

Enforcement: UI portal components receive `CaseState` but import **only** `memberAssetSummary` and `coopAssetSummary`. The `members_roster` raw array is never passed as a prop to any non-cooperative component.

---

## 6. Role / action matrix

All consequential actions. Source of enforcement is noted.

| Action | Permitted roles | Enforcement source |
|---|---|---|
| `add_evidence` | secretary, treasurer, chairman | `roles.json` → `canRole()` in `actions.ts` |
| `upload_minutes` | secretary | `roles.json` → `canRole()` |
| `signoff_minutes` | chairman | `roles.json` → `canRole()` |
| `mark_verified` | field_agent | `roles.json` → `canRole()` |
| `restructure_request` | secretary, chairman | `roles.json` → `canRole()` |
| `present_to_destination` | chairman | `roles.json` → `canRole()` |
| `assign_verification` | pfi_credit, pfi_analyst, ta | `roles.json` → `canRole()` |
| `record_verification_finding` | verifier | `roles.json` → `canRole()` |
| `record_reliance` | pfi_credit | `roles.json` → `canRole()` |
| `record_outcome` | pfi_credit | `roles.json` → `canRole()` |
| `record_admission` | pfi_analyst, pfi_credit | `roles.json` → `canRole()` |
| `request_evidence` | pfi_analyst, pfi_credit | `roles.json` → `canRole()` |
| `raise_dispute` | pfi_analyst, pfi_credit, verifier, ta, field_agent | `roles.json` → `canRole()` |
| `view_cohort` | ta, fund_manager | `roles.json` → `canRole()` (scope check via `assertCaseVisible`) |
| **View raw member roster** | secretary, treasurer, chairman, member, field_agent | UI route guard — simulated permission (labelled as such) |
| **View member asset summary** | all roles | Unrestricted — aggregated and anonymised |
| **Advance workflow step** | role-appropriate (per journey) | UI step guard — simulated |

> **Simulated permissions** are explicitly labelled in code comments and in the README. They are not enforced by the engine. They are UI routing constraints that a real deployment would replace with authenticated session controls.

---

## 7. Readiness scoping (corrected)

Readiness is always `evaluate(caseState, destinationById[dest], meta.demo_date)`. It is never a universal property of the enterprise.

### Display rule

- Show: `"Assessment-ready for [destination.display_name]"` — never `"Assessment-ready"` alone.
- In discovery and NABII views: show readiness per destination, not a single flag.
- In portfolio: show readiness for the destination relevant to that financing relationship.

### Test expected outcomes

E2E tests for readiness **derive expected outcomes from `evaluate()` called against the oracle data**, not from assertions baked into the test. The pattern is:

```ts
// In test setup — compute expected result from oracle
const expected = evaluate(loadCases()[0], destinationById['A'], meta.demo_date);
// Then assert the UI shows what evaluate() returned
await expect(page.getByTestId('readiness-verdict-A')).toContainText(
  expected.summary.ready ? 'Assessment-ready for' : 'Not yet ready for'
);
```

This ensures the test cannot silently pass by arranging data to satisfy the assertion without reflecting the real evaluation.

---

## 8. Internal inconsistencies resolved

### 8A. Encumbrance — semantic state vs UI control

- **Semantic state:** `"Not recorded"` is the stored value (string literal in `data/cases.json` and draft state).
- **UI control:** A `<select>` element. The first option is `<option value="Not recorded">Not recorded</option>`, rendered in muted foreground colour (`color: var(--muted)`). This communicates "no positive claim made" without leaving the field blank or implying an unsupported assertion.
- The stored value is always `"Not recorded"` until the user explicitly selects a different option. There is no silent default.

### 8B. `JourneyRouter` file path

- **Final path:** `src/JourneyRouter.tsx` (top-level `src/`, not under `components/`)
- **`src/components/sme.tsx`:** **Deleted.** Not retained, not renamed, not wrapped.
- **`src/App.tsx` change:** Replace `import { SmeHeroApp } from './components/sme'` with `import { JourneyRouter } from './JourneyRouter'`. Replace `<SmeHeroApp />` with `<JourneyRouter />`. All other App.tsx content is unchanged.

### 8C. Role name standardisation

| Context | Identifier |
|---|---|
| `engine/types.ts` Role union | `'field_agent'` |
| `src/components/journeys/` folder | `fieldagent/` (no underscore — filesystem convention) |
| Journey route key in `JourneyRouter` | `'fieldagent'` |
| `data-testid` prefix | `fieldagent-` |
| Display label | `"Field Agent"` |

Same pattern applies to `fund_manager` → folder `nabii/` or `fundmanager/` as appropriate to the journey (NABII journey is `nabii/`; shared components are in `fundmanager/`).

### 8D. Save / reset distinctions (three distinct operations)

| Operation | Trigger | Effect on draft | Effect on engine state | Effect on capture |
|---|---|---|---|---|
| **Auto-save** | Each step advance | Written to `localStorage['symphony.draft.v1']` | No change | `capture.emit('step_advance')` |
| **"Save and exit"** | User taps button | Written to localStorage | No change | `capture.emit('save_exit')` |
| **"Reset current step"** | User taps in-form link | Clears current step fields in React state | No change | No capture event |
| **"Reset demo"** | User taps global control | `localStorage['symphony.draft.v1']` deleted | Reset to `baselineCases` | `capture.resetSession()` |

`data-testid="reset-demo"` maps to "Reset demo". The test `"reset-demo returns every role to its Step 1"` means: after reset-demo, every role's login leads to Step 1 with `baselineCases` data. It does not mean the role selector is cleared.

### 8E. Test migration: retired vs. behaviour-preserved

| Old test ID | Old behaviour | Status | New coverage |
|---|---|---|---|
| `screen-tab-enrollment` | Navigate to tab | **Retired** (tab nav removed) | `journey-step-1-register` tests the same enrollment content |
| `screen-tab-sme_dashboard` | Navigate to tab | **Retired** | Readiness KPIs covered by `journey-step-7-readiness` |
| `screen-tab-gap_remediation` | Navigate to tab | **Retired** | Evidence entry covered by `journey-step-4-history` and `journey-step-5-members` |
| `screen-tab-lender_assessment` | Navigate to tab | **Retired** | PFI assessment behaviour covered by `pfi-step-assess` |
| `screen-tab-verifier_queue` | Navigate to tab | **Retired** | VVB queue covered by `vvb-step-queue` |
| `screen-tab-verifier_workbench` | Navigate to tab | **Retired** | VVB workbench covered by `vvb-step-workbench` |

**Underlying behaviours that MUST remain covered** regardless of selector change:
- Evidence level transitions (asserted → supported → verified)
- `ROLE_NOT_PERMITTED` enforcement for `record_outcome` by non-`pfi_credit` roles
- `SELF_VERIFICATION` enforcement
- `SIGNOFF_REQUIRED` for governance
- Lender outcome not pre-selected
- Verifier finding form starts empty and Submit is disabled until complete

---

## 9. Shell and layout

*(Corrected from V2 — outer columns are empty by default)*

```
┌────────────────────────────────────────────────────────────────────┐
│  Symphony  ·  [Role badge]                          [Exit demo]    │  thin header
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [margin]      COOPERATIVE REGISTRATION · Step 3 of 8  [margin]   │  step label
│  [margin]      ━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░  37%   [margin]   │  progress bar
│                                                                    │
│  [margin]      ## Establish governance                  [margin]   │
│  [margin]                                               [margin]   │
│  [margin]      [Certificate officers form]              [margin]   │
│  [margin]                                               [margin]   │
│  [margin]      [Current officers form]                  [margin]   │
│  [margin]                                               [margin]   │
│  [margin]      [Discrepancy card — if applicable]       [margin]   │
│                                                                    │
│  [margin]      The next step captures operating history. [margin]  │  forward hint
│  [margin]                                               [margin]   │
│  [margin]      [  Continue to Operating History  ]      [margin]   │  primary CTA
│  [margin]      Save and exit                            [margin]   │  secondary link
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Central column width:** `min(640px, calc(100% - 48px))`, centred with `margin: 0 auto`.
**Outer columns:** Empty. No panels, no sidebar, no contextual cards by default.
**Progress bar:** Thin (3px), fills left-to-right as steps advance.
**Continue button:** Full-width within the central column (not full-viewport-width). `max-width: 320px` on wide screens.
**"Save and exit":** Plain text link, below the Continue button.
**Header:** `Symphony` wordmark + role badge + `[Exit demo]` right-aligned. Compact. Not sticky by default (sticky only when content scrolls past header).

**Exception: evidence drawer.** When a user opens an existing evidence item's detail on the Readiness step, it appears as an **inline expandable section** below the requirement row — not a separate column or floating panel.

---

## 10. SME Journey — 8 steps

| Step | Component | `data-testid` prefix | Step name & primary responsibility |
|---|---|---|---|
| 1 | `CoopRegister.tsx` | `coop-step-1-` | Registration: Cooperative profile & registration number |
| 2 | `CoopRegulatory.tsx` | `coop-step-2-` | Regulatory: Standing, compliance documents & filings |
| 3 | `CoopMembers.tsx` | `coop-step-3-` | Members: Member roster enrollment (min. 1 member enrolled required) |
| 4 | `CoopGovernance.tsx` | `coop-step-4-` | Governance: Officers determined from roster, certificate comparison & minutes |
| 5 | `CoopHistory.tsx` | `coop-step-5-` | History: Operating, farming and financial records |
| 6 | `CoopBaseline.tsx` | `coop-step-6-` | Baseline: Cooperative assets, production capacity & environmental profile |
| 7 | `CoopReadiness.tsx` | `coop-step-7-` | Readiness: Destination-specific assessment & evaluation |
| 8 | `CoopPresent.tsx` | `coop-step-8-` | Present: Submission/presentation of dossier to institution |

Steps 1–4 are the **workshop phase**. Steps 5–8 are the **follow-up phase**. The step indicator does not label phases; the `draftPhase` field in draft state records the transition.

---

## 11. Implementation phases

### Phase A — Shell and design contract

Deliverables:
- `src/index.css` — additive CSS only (tokens + layout classes from §9)
- `src/components/shell/JourneyShell.tsx` — centred column, thin header, role badge
- `src/components/shell/StepIndicator.tsx` — "Step N of M" + progress bar
- `src/components/shell/index.ts`
- `src/components/journeys/types.display.ts` — display-only types
- `src/components/journeys/assetSummary.ts` — `memberAssetSummary`, `coopAssetSummary`
- `data/cases.json` — additive fields for case-1 only (others seeded with minimal `members_roster: []`, `coop_assets: []`, `certificate_officers`, `current_officers` matching to avoid false discrepancy)

Acceptance: render the shell with a placeholder step. Confirm: empty outer margins, compact progress indicator, Continue within central column.

### Phase B — One complete SME slice

Deliverables:
- `src/components/journeys/cooperative/` — all 8 step components
- `src/components/journeys/LoginScreen.tsx`
- `src/JourneyRouter.tsx` — cooperative branch only (other roles render a "Journey not yet available" placeholder with `data-testid="journey-placeholder"`)
- `src/App.tsx` — one import change
- Draft persistence in `localStorage['symphony.draft.v1']`

Phase B acceptance criteria:
- [ ] Login → Secretary → Step 1 (Register) — `data-testid="coop-step-1-register"`
- [ ] Step 3 (Members): Enroll at least one member with `member_id`; validation blocks advancing if roster is empty
- [ ] Step 4 (Governance): Officers determined from enrolled roster with `member_id`; certificate form and current officers form appear separately
- [ ] case-1 discrepancy: Secretary ID `m-cert-002` (certificate) vs `mbr-002` (current) → discrepancy card shown with both names and IDs; `has_discrepancy: true`
- [ ] `governance_officers` evidence item stored in `caseState.evidence` via `add_evidence` action
- [ ] No governance-officers evidence item until Step 4 is submitted (not pre-seeded)
- [ ] Livestock encumbrance dropdown initial value: `"Not recorded"` (muted display)
- [ ] Evidence item `limitation` text is visible on every evidence row — never hidden
- [ ] `evaluate()` result determines readiness badge — not a hard-coded string
- [ ] "Save and exit" → localStorage written → login screen shown → "Resume draft" reloads Step 5
- [ ] "Reset demo" → localStorage cleared → `baselineCases` restored → login shown
- [ ] `data-testid="reset-demo"` preserved and functional

### Phase C — Institutional journeys

Order: NABII → TA → PFI → VVB → Portfolio → Discovery (shared component).

Each journey uses `JourneyShell` and `StepIndicator`. Each calls only existing engine actions via `runActionForCase`. No new engine action types introduced.

### Phase D — Behavioural equivalence and documentation

---

## 12. E2E test classification and specifications

Each test is classified: **[E]** = verifies existing engine contract; **[U]** = verifies new UI behaviour; **[S]** = verifies simulated demo scenario.

| # | Classification | Test | Observable check |
|---|---|---|---|
| 1 | [E] | **Weak cooperative → governed record** | case-1 evidence items show `limitation` text; no item is silently at a higher level than supplied; `governance_officers` item has `has_discrepancy: true` after Step 4; `evaluate()` result for destination A matches the oracle | 
| 2 | [S] | **Save and resume** | After "Save and exit" at Step 4, localStorage contains `draftStep: 4`; on reload + "Resume draft", user lands on Step 4; same `caseState.id` throughout; no second case entry created |
| 3 | [S] | **Workshop-to-follow-up continuity** | Steps 1–4 complete → `draftPhase: 'workshop_complete'` in localStorage; navigate to login; "Resume draft" → Step 5; Steps 5–8 complete → `draftPhase: 'followup_complete'`; event log length > 0 and contains events from both phases; single `caseState.id` |
| 4 | [U] | **Governance discrepancy — deterministic** | Enroll members on Step 3; on Step 4 enter `member_id: 'm-cert-002'` on certificate form vs current officer `member_id: 'mbr-002'`; submit; discrepancy card appears with `data-testid="governance-discrepancy-card"`; card text contains both entries; `caseState.evidence.governance_officers.item.has_discrepancy === true`; no external call made (verifiable by absence of any `fetch`/`XHR` in Playwright network log for this action) |
| 5 | [E] | **Destination-specific readiness** | After Step 7 (readiness), readiness badge for destination A matches `evaluate(caseState, destinationById['A'], meta.demo_date).summary.ready`; readiness badge for destination B matches the B evaluation; both use the same `caseState`; no duplication of enterprise |
| 6 | [U] | **NABII drill-down** | NABII overview count for "Assessment-ready" state equals `cases.filter(c => evaluate(c, destA, demoDate).summary.ready).length`; selecting the state opens the list; selecting case-1 opens its record with `data-testid="case-detail-case-1"` |
| 7 | [E][S] | **TA intervention** | TA officer records an intervention on case-1 governance gap; `assign_verification` action is called (verified via event log); the `governance_officers` evidence level does NOT change unless a verifier subsequently records a finding via `record_verification_finding`; `evaluate()` result changes only if the new evidence satisfies the requirement threshold |
| 8 | [E][U] | **PFI discovery and decision** | PFI analyst filters by destination A + province Central → case-1 appears; asset summary shows `memberAssetSummary` output (no individual names); PFI credit selects outcome "Approved" → `record_outcome` succeeds; `pfi_analyst` attempting `record_outcome` → blocked with `ROLE_NOT_PERMITTED` |
| 9 | [E] | **VVB scope** | Verifier submits finding on `registration` assignment → `caseState.verification.findings` has new entry; finding `assignment_id` matches the registration assignment only; `governance` evidence item is unchanged; Submit button is disabled until `result`, `scope`, and `limitation` fields are all non-empty |
| 10 | [E][S] | **Portfolio continuity** | Portfolio view shows case-1 with initial evaluation; a new finding is added via `record_verification_finding`; portfolio view updates to reflect new finding; `caseState.events` length is greater than before; previous events are still present |
| 11 | [E][U] | **Access control** | PFI journey component receives `memberAssetSummary` output — `data-testid="member-asset-summary"` exists but no element with `data-testid="member-name"` or `data-testid="member-livestock-detail"` is present; `pfi_analyst` cannot trigger `record_outcome` (engine blocks); field_agent cannot navigate to `pfi-step-assess` (UI route guard blocks with `data-testid="journey-placeholder"`) |
| 12 | [U] | **Navigation regression** | Each of 10 roles: login → lands on correct Step 1 (not a generic dashboard); backward button from Step 4 → Step 3 with fields intact; attempting to reach Step 4 without enrolling at least one member on Step 3 → blocked by form validation on Step 3; `data-testid="reset-demo"` from any step → login screen with `baselineCases` |

**Responsive test (viewport):**
- 320px: central column fills viewport, Continue button full-width, progress bar visible, no horizontal scroll
- 768px: central column `min(640px, calc(100% - 48px))`, outer margins visible
- 1440px: outer margins are blank (no panels, no sidebar visible)

Playwright `page.setViewportSize()` is used — not a manual assertion.

---

## 13. `DECISIONS.md` additions (Phase D)

| # | Decision | Rationale |
|---|---|---|
| 24 | Role-specific linear journeys with one task per screen replace the 19-tab nav | Users experience an institutional progression, not an application menu |
| 25 | Display-only fields (`members_roster`, `coop_assets`, `certificate_officers`, `current_officers`) live in `data/cases.json`; display types live in `types.display.ts`; `engine/types.ts` is untouched | Engine boundary preserved; display concerns separated |
| 26 | Initial encumbrance is stored as `"Not recorded"` and displayed as a selected-but-muted option | Prevents the UI from implying a claim no authorised person has made |
| 27 | Member enrollment precedes officer determination (Step 3 before Step 4); at least one member must be enrolled before officers can be determined; comparison compares by `member_id` | Guarantees member IDs exist for current officers; flags discrepancy if no ID exists or IDs differ |
| 28 | Governance discrepancy is stored as a governed evidence item via `add_evidence('governance_officers', 'asserted', ...)` | The discrepancy enters the engine event log and can be evaluated by `evaluate()` against destination requirements |
| 29 | `memberAssetSummary()` and `coopAssetSummary()` are the only functions other-portal components may import for member/asset data | Enforces the personal-data boundary at the import level, not only at the rendering level |
| 30 | Portfolio management is a first-class journey | A portfolio manager's task flow is distinct from any single institution's assessment |
| 31 | Persistence is browser-session localStorage. "Save and exit" writes draft; "Resume draft" restores it. This is a demo simulation, not a durable server-side handoff | Limitation is labelled in UI and README |
| 32 | `src/components/sme.tsx` is deleted; `src/JourneyRouter.tsx` replaces it | Single authoritative entry point for role-dispatch; no wrapper retained |

---

## 14. Acceptance checklist (all phases)

- [ ] Role selected on login → lands on role's Step 1
- [ ] Outer margins are visually empty at 1440px viewport
- [ ] Progress shown as "Step N of M" + thin bar, not a sidebar
- [ ] Continue is within the central column
- [ ] Member enrollment (Step 3) precedes governance (Step 4); at least one member must be enrolled before officers are determined
- [ ] Governance: two separate forms; comparison by `member_id`; discrepancy stored via `add_evidence`
- [ ] Encumbrance initial state: `"Not recorded"` stored and displayed (muted)
- [ ] No individual member names appear in PFI, NABII, VVB or Portfolio views
- [ ] Readiness always shown with destination context ("for [destination.display_name]")
- [ ] Draft persists to `localStorage['symphony.draft.v1']`; "Resume draft" restores correct step
- [ ] "Reset demo" clears draft and engine state; `data-testid="reset-demo"` functional from any step
- [ ] `npm run verify:oracle` passes
- [ ] `npm run verify:all` passes (boundary labels on every screen)
- [ ] `npx vitest run` passes
- [ ] All 12 classified E2E tests pass
- [ ] `npm run verify:bundle` passes (no forbidden terms)
- [ ] Responsive: 320px (no horizontal scroll), 768px (margins visible), 1440px (empty outer columns)
- [ ] `src/components/sme.tsx` is deleted; no imports reference it
