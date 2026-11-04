# Symphony UI/UX Redesign Review and Proposal

*Prepared 3 November 2026 for the Symphony Prototype (`Prototype/`). Inputs: the Cooperative Onboarding, Governance and Compliance specification; the Symphony dashboard design, the Financier evidence view and the Sopact reference page; and the current React/TypeScript codebase.*

**Scope note.** Code findings come from `sme.tsx`, `phase2.tsx`, `capture.tsx`, `TourBubble.tsx` and `App.tsx`. The existing `index.css` and `core.tsx` were not re-audited for this document, so colour, spacing and typography are proposed as new tokens rather than critiqued line by line. Contrast ratios in section 3 were computed, not estimated.

---

## 1. Core architecture and discovery

### 1.1 Current structure

- **One component runs everything.** `SmeHeroApp` (roughly 1,000 lines in `sme.tsx`) holds about a dozen `useState` hooks and the whole `cases` array, and conditionally renders 19 screens. `App.tsx` checks `window.location.pathname` only for `/components` and `/capture`. No other screen has a URL, so there are no deep links, no working Back button and no shareable state.
- **Navigation is a flat strip of 19 buttons** in `ScreenShell`, shown to every persona under one `aria-label="SME journey"`. A secretary sees "NABII directory" and "Verifier workbench" beside "Dashboard".
- **Role and persona are global state.** `role`, `caseId`, `destination`, `selectedVerifier` and a single `blocked` string are shared by every screen, so a block message from Remediation can still be showing on the Lender screen.
- **Primitives are sound in concept** (`RequirementCard`, `GovernedMetricCard`, `EvidenceDrawer`, `DestinationSwitcher`, `RoleSwitcher`, `BoundaryLabel`, `VisibleStatement`, `HelpTip`/`HelpPopover`) but used inconsistently.
- **A floating tour and state legend** sit in a persistent `aside` that overlays content.

### 1.2 Personas and use cases

The specification (§4 and §16.1) and the code together imply these personas:

| Persona | Job to be done |
| --- | --- |
| Self-enroller / platform enroller | Capture identity and evidence honestly, then hand over |
| Chairman, Secretary, Treasurer | Establish authority, run meetings, keep records |
| Verifier | Review one evidence version in a stated scope and record a finding |
| PFI analyst / credit | See what the evidence supports, request more, record outcome and reliance |
| TA / fund manager | See cohort or portfolio gaps without editing anything |
| Platform admin | Provision enrollers and requirement catalogues |
| Presenter (demo only) | Run a scripted tour in front of NABII or a bank |

The prototype serves the cooperative hero path, the lender and the NABII views reasonably. The specification adds a large cooperative-side surface (by-laws, governance, meetings, committees, audit and education) that has no UI yet.

---

## 2. UX/UI bottleneck analysis

### 2.1 Critical UX flaws

1. **The wizard-and-tabs shape works against the specification.** §16 asks for a guided path that is "not a collection of disconnected tabs": resumable, with stages saveable in any order. Today there are 19 peer tabs and no sense of where the user is or what to do next.
2. **No next-action orientation.** The Financier sketch's best idea is a ranked "Next verification or support action" panel. The code has none; users infer actions from buttons scattered across cards.
3. **Status collapses to one word.** Badges show a single `effective_level` or `state`. The specification (§1, §6.4, §10) requires separate dimensions: configuration, implementation, evidence, admission versus official approval, verification, and currency. The UI cannot yet say "Admitted as supporting evidence, not yet an official cooperative record".
4. **Raw enum tokens leak to users.** `partially_verified`, `not_verified`, `relied` and `requires_independent_query` render verbatim in the claim chain, portfolio buttons and monitoring badges, and the login screen lists role keys such as `pfi_credit` and `field_agent`. §16.2 requires precise human labels.
5. **Overclaiming language remains.** "Ready for reporting" (claim chain) and a bare "verified" with no verifier, scope or version conflict with §16.2's guidance to avoid Complete, Verified without naming who and what, and Approved without authority.
6. **Test scaffolding is on screen.** Examples: "T2 governance and seasons", "Confirm own payment", and a lender "Add own finding" button with a hard-coded note. Demo-driving controls sit inside persona screens and blur real flows with the script.
7. **Blocked actions are invisible to assistive technology and easy to miss.** `blocked` renders as a plain paragraph with no `role="alert"`, no live region and no focus move, and it is shared across screens.
8. **Reset is destructive with no confirmation.** It sits beside "Event log" and runs immediately.
9. **Disabled reasons depend on tooltips.** Tooltips fail on touch and keyboard, and a native `disabled` button leaves the tab order and explains nothing.

### 2.2 Accessibility defects found in the code

| Where | Defect |
| --- | --- |
| All screens | `h1` is always "Symphony"; no per-screen heading; cards use `h2` throughout, so the outline is flat and no screen announces itself |
| Portfolio tiles, funnel counts | A `button` wrapping `h2` and `strong`; funnel buttons contain only a number ("9"), so the accessible name has no context |
| Directory table | `onClick` on `tr` plus a nested button (double activation, row not keyboard-operable); no `caption`, no `scope` on headers |
| Lender screen | Outcome and requirement `select` elements have no `label`; the placeholder option stands in for one |
| `PresentModal` | `role="dialog"` and `aria-modal`, but no `aria-labelledby`, focus trap, Escape handling or focus return seen in the code |
| Tour bubble | Not a dialog or live region; steps change the screen underneath without announcing it |
| Evidence and state badges | Colour plus text is good, but shape cues are absent, which matters for colour-blind users, print and projectors |

### 2.3 Visual and performance weaknesses

- **Density without hierarchy.** Everything is a `requirement-card`, so summary, detail and action look the same and nothing reads as primary.
- **Layout stability.** Drawers and panels render inline at the end of a section (for example `StateView` appends `EvidenceDrawer` after its grid), pushing content down and leaving the user below the fold with no focus move.
- **Persistence cost.** `capture.tsx` `persist()` reads, filters and rewrites the whole `localStorage` capture array on every event.
- **One bundle.** All 19 screens ship together; nothing is code-split.

---

## 3. The autonomous design proposal

### 3.1 What the references get right and wrong

| Reference | Keep | Reject |
| --- | --- | --- |
| **Symphony dashboard mock** (4 screens) | Left-nav shell, evidence lineage and audit trail, progress timeline, next-steps list | The **62% donut and "Readiness: In Progress" pill** are a score and a verdict, which the specification forbids (§11.3). "Complete / Missing / Outdated" is a single dimension, "Verified" carries no scope, and "Status Updated: System" hides the actor |
| **Financier evidence view** | The strongest base: three count tiles, a status-chip claims table with *Evidence on file* and *Gap* columns, a ranked action panel, shape-coded chips, and the closing line that it does not score or recommend | Still one status dimension, with no version, authority or provenance. The "Without this view" card is a sales device, not a product element |
| **Sopact** | Tiles pairing a number with its baseline and delta; "answers with evidence you can check" (every figure links to its source) | The AI-assistant narrative as an authority. The specification requires AI output to be confirmed before it becomes operative (§6.2) |

### 3.2 The vision: the Evidence Readiness Workspace

A dashboard workspace, not a wizard. The base pattern is the Financier sketch's three parts (summary tiles, status-chip table, action panel), extended with the specification's separate dimensions and a provenance drawer.

**Why it outperforms the current build and the references**

- It never shows a score. Counts and gaps are the headline, and each links to the records behind it.
- Setup progress is a **non-blocking path**, so a cooperative can record a later-stage fact first (§5.1) while dependencies stay visible.
- Every row answers "who established this, in what scope, on which version, with what limitation" in one click, which makes the two-click traceability rule structural.
- Persona-scoped navigation and role-aware actions make authority visible instead of hiding it behind a disabled button.

### 3.3 Layout and navigation

```
+-------------------------------------------------------------------+
| Context bar: Cooperative > Destination > Acting as (persona)      |
| Boundary label (always)                         [Demo tools]       |
+----------+--------------------------------------------------------+
| Side nav | Page title (h1) + one line: what this shows            |
| (per     | [Tile] [Tile] [Tile] [Tile]   <- counts, baseline deltas |
| persona) | +------------------------------+---------------------+   |
|          | | State table (status chips)   | Next-action panel   |   |
|          | | rows expand to provenance    | Findings and owners |   |
|          | +------------------------------+---------------------+   |
+----------+--------------------------------------------------------+
| Persistent boundary statement                                     |
+-------------------------------------------------------------------+
```

**Navigation by persona** (real routes such as `/coop/:id/evidence`, `/lender/:id`, `/nabii/pipeline`):

- **Cooperative:** Overview, Identity, By-laws and requirements, Governance, Meetings and resolutions, Evidence register, Findings and next actions. These fold the specification's ten areas into seven.
- **Lender:** Cases, Case evidence view, Monitoring, Portfolio.
- **Verifier:** Queue, Workbench.
- **NABII / TA / fund manager:** Pipeline, Cohort, Directory.
- **Demo tools:** a collapsible side panel holding Reset (with confirmation), Tours, Event log and the scripted step buttons. These never appear inside persona screens.

### 3.4 The status system

Replace the single badge with an **evidence strip**: one primary chip plus compact secondary indicators.

- **Primary chip** (evidence state, using the §16.2 vocabulary): Self-declared, Supplied by cooperative, Admitted as supporting evidence, Official cooperative record, Independently verified (scope), Verification qualified, Disputed, Stale, Not evidenced.
- **Secondary indicators:** admission, official approval, verification on this exact version, currency and dispute, each detailed on hover, focus or expand.
- **Shape plus colour plus text:** filled circle (verified), half-filled (supplied, unverified), dashed outline (not evidenced), triangle (disputed), clock (stale). Meaning never depends on colour alone.
- **Rule:** a chip reading "Verified" must carry "by \[verifier\], scope, version \[n\]" in its expanded form. A single adapter, `presentEvidence(item)` returning `{label, tone, icon, a11yText, scopeText}`, is the only place enum values become words.

### 3.5 Design tokens (contrast checked)

| Token | Foreground / background | WCAG ratio |
| --- | --- | --- |
| Body text | `#14211D` on `#FFFFFF` | 16.6 : 1 |
| Muted text | `#4A5A55` on `#F3F5F4` (canvas) | 6.65 : 1 |
| Verified chip | `#0B4A5A` on `#D3EBF1` | 7.9 : 1 |
| Qualified / unverified chip | `#6B3F00` on `#FFE3B0` | 7.2 : 1 |
| Self-declared chip | `#3D3A7A` on `#E6E4F7` | 8.1 : 1 |
| Disputed chip | `#8A1C1C` on `#FBE0DE` | 7.4 : 1 |
| Primary action | `#FFFFFF` on `#14211D` | 16.6 : 1 |
| Focus ring | `#1F5FBF` on `#FFFFFF` / `#F3F5F4` | 6.1 / 5.6 : 1 |
| Dashed chip border | `#5E7A72` on `#FFFFFF` | 4.7 : 1 |

Spacing uses a 4 px grid (4, 8, 12, 16, 24, 32). Radii are 8 px for controls and 12 px for cards. The type scale is 12, 14, 16, 20, 24, 32 with tabular numerals for counts. Fonts must be self-hosted (variable woff2), not fetched from a CDN, because the prototype's zero-network requirement (X4) and offline demo rooms rule out web fonts.

---

## 4. Component-by-component specification

### 4.1 App shell and navigation

- **Layout and spacing:** CSS grid, `240px 1fr`. The side nav collapses to a top drawer below 960 px and a bottom bar below 640 px. Sticky 48 px context bar; content max-width 1200 px.
- **Typography:** nav items 14/20 medium; page title 24/32 semibold, one `h1` per route; the "what this shows" line is 14 muted.
- **States:** the current route has a 3 px left indicator, `aria-current="page"` and heavier weight (not colour alone). Hover tints the background; focus shows a 2 px ring with 2 px offset.
- **Accessibility:** `<nav aria-label="Primary">`; a skip-to-content link is the first tab stop; route changes move focus to the `h1` and update `document.title`.

### 4.2 Context bar (cooperative, destination, persona)

- **Layout and spacing:** flex row, 12 px gap, three labelled selects, boundary label right-aligned.
- **Typography:** labels 12 uppercase with 0.04em tracking; values 14 semibold.
- **States:** switching persona shows "Acting as Chairman (c1.chairman)" in a polite live region and re-scopes the nav immediately.
- **Accessibility:** a real `<label>` per select; the effect of a persona change on available actions is announced.

### 4.3 Summary tile

- **Layout and spacing:** 4-up grid (2-up tablet, 1-up phone); number, caption, optional "baseline to now" delta line.
- **Typography:** value 32/36 semibold tabular; caption 14.
- **States:** the whole tile is one link with a visible chevron; hover darkens the border (120 ms); a loading skeleton keeps the tile's height.
- **Accessibility:** an `<a>` whose name includes the label ("9 cooperatives enrolled, open list"), not a `<button>` wrapping headings.

### 4.4 Status chip

- **Layout and spacing:** inline-flex, 24 px high, 14 px icon, 8 px horizontal padding.
- **Typography:** 12/16 semibold; text always present.
- **States:** static by default; the interactive variant (opens the provenance drawer) adds a pointer and the focus ring.
- **Accessibility:** the visible text is the name; the adapter's long-form `a11yText` is exposed on the row via `aria-label`, not on the chip.

### 4.5 State table (claims and requirements)

- **Layout and spacing:** columns Claim, Status strip, Evidence on file, Gap, Owner and next step; sticky header. Below 720 px each row becomes a card with the same facts stacked.
- **Typography:** header 12 uppercase muted; cells 14/20; gap text wraps and is never truncated.
- **States:** row hover tint; an expanded row shows the provenance drawer inline; sortable headers show `aria-sort`; the empty state says what is missing and who can add it.
- **Accessibility:** a real `<table>` with `<caption>` and `scope="col"`; one button per row (no clickable `<tr>`); expand and collapse use `aria-expanded` and `aria-controls`; Tab order stays logical.

### 4.6 Provenance drawer ("How was this established?")

- **Layout and spacing:** right-side panel, 440 px (full-width sheet on phone). Sections: Supplied, Admitted, Officially approved, Verified (scope and version), Disputes, History, Limitation.
- **Typography:** section heads 14 semibold; values 14; timestamps 12 muted tabular.
- **States:** 150 ms slide (respecting `prefers-reduced-motion`); a loading skeleton; "Not yet recorded" is shown explicitly for every empty section.
- **Accessibility:** `role="dialog"` with `aria-labelledby`, focus trap, Escape closes and focus returns to the triggering row; the page behind is `inert`.

### 4.7 Next-action panel

- **Layout and spacing:** vertical stack of at most four actions, one primary (dark) and the rest outline; each shows owner role and the authority needed.
- **Typography:** action label 14 semibold; owner and authority 12 muted.
- **States:** unavailable actions stay focusable, carry `aria-disabled="true"` and show the reason in text beneath (for example "Needs Chairman authority"), not only in a tooltip.
- **Accessibility:** a list of buttons with `aria-describedby` pointing at the reason; results post to a polite live region.

### 4.8 Findings list (validation findings)

- **Layout and spacing:** grouped by severity (informational, attention required, material gap, blocking for a named transition). Each card shows rule, observed versus expected, source and responsible role.
- **Typography:** title 14 semibold; explanation 14; source 12 muted.
- **States:** open, in progress, resolved with an evidence link. "Blocking" always names the transition it blocks.
- **Accessibility:** a `<section>` with an `h2` per group; severity is conveyed in text and icon; counts are announced.

### 4.9 Setup path (replaces the wizard)

- **Layout and spacing:** a horizontal stepper on desktop and vertical on mobile, six groups: Identity, By-laws, Governance, Meetings, Compliance, Evidence.
- **Typography:** step label 14 semibold; state line 12 ("Not started", "In progress", "Has findings", "Evidenced").
- **States:** every step is reachable at any time; unmet dependencies show a note, never a lock; progress is saved per step.
- **Accessibility:** an ordered list; each step is a link, with `aria-current="step"` on the current one; no percentage is announced.

### 4.10 Dispute panel and banner

- **Layout and spacing:** a banner at the top of the affected requirement linking to a panel with reason, note, raiser and status.
- **Typography:** banner 14 semibold with warning icon and text.
- **States:** raise, withdraw and resolve; only permitted actions are enabled and the others state why; resolved disputes stay visible in history.
- **Accessibility:** the banner is `role="status"`; the form uses labelled fields, `aria-invalid` with error text, and a 200-character counter.

### 4.11 Verifier workbench and finding form

- **Layout and spacing:** two columns, with the target and evidence version on the left and the finding form on the right. The exact version examined is shown prominently.
- **Typography:** labels 14 above inputs.
- **States:** the result select starts empty; submit stays disabled until result, scope and limitation are filled; a recorded finding becomes read-only.
- **Accessibility:** every field has a `<label>`; the disabled submit explains what is missing via `aria-describedby`.

### 4.12 Lender decision and reliance controls

- **Layout and spacing:** one "Lender decision" card, visually separate from "Symphony established" so authorship is clear.
- **Typography:** plain-word options (Approved, Declined, Deferred, More evidence requested), shown as lender-recorded decisions.
- **States:** never pre-selected; a recorded decision shows who recorded it and when; reliance requires an existing finding and the lender role.
- **Accessibility:** a radio group inside a `<fieldset>` with a `<legend>`; confirmation is announced in a live region.

### 4.13 Pipeline, cohort and directory

- **Layout and spacing:** the funnel is a horizontal list of count links with a case list beneath; the directory is a sortable, filterable table with filters above (programme, province, district, readiness, gaps closed).
- **Typography:** counts 24 tabular; table text 14.
- **States:** filters persist in the URL query string; a scoped TA user sees an "Outside your cohort" state if they reach another case.
- **Accessibility:** funnel counts are links with full names ("5 cooperatives ready for a lender"); filter changes announce the new result count.

### 4.14 Blocked-action messages and toasts

- **Layout and spacing:** inline at the action first, with an optional toast; never a page-global string.
- **Typography:** one plain-English sentence, with the rule code in small monospace beneath.
- **States:** persists until dismissed or the next successful action in the same context.
- **Accessibility:** `role="alert"` for blocks, `role="status"` for successes; focus is not stolen.

### 4.15 Tour overlay and help

- **Layout and spacing:** a docked panel with Back, Next, Exit and a step count, anchored to a highlighted target.
- **Typography:** step text 14/22.
- **States:** each step navigates by route; Exit returns the user to where they were.
- **Accessibility:** a non-modal `role="dialog"` with `aria-live="polite"` step announcements; help popovers open on click and on Enter or Space, close on Escape, and are never hover-only.

---

## 5. Migration and implementation roadmap

### 5.1 Step-by-step refactor

1. **Freeze behaviour first.** Keep the existing Playwright specs green as the safety net, and keep a stable `data-testid` contract so markup can change underneath them.
2. **Add routing.** Adopt React Router or TanStack Router and move each screen to a route. Replace the `screens[]` tab strip with persona-scoped navigation built from one `navByRole` map. This gives deep links, Back and Forward, and testable URLs.
3. **Split `sme.tsx` by feature:** `features/cooperative`, `features/lender`, `features/verifier`, `features/nabii`, `features/demo`. Lift `cases`, `role`, `caseId` and `destination` into a small store (Zustand, or a reducer plus context). Scope `blocked` to the action that produced it.
4. **Introduce design tokens** as CSS custom properties (`tokens.css`) using the palette in section 3.5. If Tailwind is adopted, map its theme to the same tokens.
5. **Build the primitives once**, in this order: `StatusChip` with the `presentEvidence` adapter, `SummaryTile`, `StateTable`, `ProvenanceDrawer`, `ActionPanel`, `FindingCard`, `SetupPath`. Render enum values only through the adapter, and add a test that fails on snake\_case in rendered text.
6. **Adopt accessible building blocks.** Use Radix UI or React Aria for Dialog, Popover, Tooltip, Select, Tabs and RadioGroup instead of custom implementations, for focus traps, ARIA wiring and keyboard behaviour.
7. **Move demo scaffolding out.** Create a `DemoPanel` that owns Reset (with confirmation), Tours, the Event log and the scripted step buttons, so persona screens contain only real flows.
8. **Rebuild screens in priority order:** Cooperative Overview and Evidence register (the dashboard pattern), then the Lender case view, the Verifier workbench, the NABII pipeline and directory, and finally the specification's new areas (by-laws, governance, meetings) as the domain model lands.
9. **Add the specification's missing dimensions to the view-model** before the UI needs them: admission versus official approval, version identity on findings, requirement status dimensions (configuration, implementation, evidence, capability), and validation findings with severity. Keep them as view-model types so the UI is ready when the relational backend arrives.
10. **Performance pass.** Code-split routes with `React.lazy`; batch or debounce capture persistence (write on idle or every N events) instead of rewriting the log per event; keep `evaluationMap` memoised and move heavy derivations into selectors.
11. **Quality gates.** Add `eslint-plugin-jsx-a11y`, `@axe-core/playwright` on every route, a keyboard-only Playwright path through each persona's core flow, a contrast test over the token pairs, screenshot checks at 375, 768 and 1440 px, and a test that no rendered text contains a score, a percentage readiness value or an unscoped "Verified".

### 5.2 Library suggestions

| Need | Suggestion | Why |
| --- | --- | --- |
| Routing | React Router or TanStack Router | URLs per screen, persona-guarded routes |
| Accessible primitives | Radix UI or React Aria | Focus management, ARIA, keyboard support |
| State | Zustand, or a reducer plus context | Replaces the dozen-hook root component |
| Tables | TanStack Table (headless) | Sorting and filtering without losing semantic markup |
| Styling | CSS variables, optionally Tailwind mapped to them | One token source, small bundle |
| Fonts | Self-hosted variable woff2 | Meets the zero-network, offline requirement |

### 5.3 Risks and open items

- **Do not copy the reference donut or the "Readiness: In Progress" pill.** They contradict the specification's no-score rule and Symphony's own invariants.
- **Several specification areas have no engine support yet** (by-laws, governance profiles, meetings, committees, appointments, admission versus official approval). Their screens need view-model stubs, and the specification's §20 lists 15 decisions that must not be guessed. Until those are decided, such screens should show "Platform capability not implemented" rather than invented flows.
- **Earlier Phase 4 to 9 questions are still open:** whether Approved stays a lender outcome, whether the `roles.json` additions stay, when claim reporting counts as ready, and whether the covenant-to-evidence mapping stays. They affect the lender and claim screens in this redesign, and a ruling would let those specifications be tightened.
