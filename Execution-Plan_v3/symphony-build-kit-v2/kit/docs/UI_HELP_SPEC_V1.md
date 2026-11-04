# Symphony Prototype: UI Help and Disclosure Spec v1

**Audience:** the AI agent that maintains `SYMPHONY-EXEC-PLAN` and builds the prototype.
**Companion to:** `FUNCTIONAL_SPEC_UPDATE_V1.md`. This document adds one UI pattern and its data. It changes no engine behaviour.
**Purpose:** move explanations of definitions, rules and processes out of fixed text blocks and separate views and into tooltips, popovers and helper text. Keep drill-down views for case data, histories, lists and actions. Keep safety and positioning statements permanently visible.

## 0. How to use this document

1. Read sections 1 to 4. They define the patterns and the rule for choosing one.
2. Add the data files in section 5 and the components in section 6.
3. Apply the placement map (section 7), the removals (section 8), the capture change (section 10) and the phase changes (section 12).
4. Write the tests in section 11 before the components they test.
5. Where this document conflicts with the existing plan, this document wins. Where it is silent, `AGENT.md`, `FUNCTIONAL_SPEC_UPDATE_V1.md` and the data files apply.

Delivered with this document: `help.json`, `tours.json`, `validate_help.py`, updated `meta.json` and `roles.json`, and a revised `capture_event_schema.json` (28 event types; the screen `static_verification` is renamed `claim_view`).

## 1. Scope

**In scope:** help text for states, requirement rules, process steps, roles, labels, destinations, funnel and cohort terms, monitoring terms, dispute reasons, finding results and export formats; tour narration bubbles; required visible statements; the capture event for help use.

**Out of scope:** onboarding wizards, a glossary page, a help centre, chat or search, and any new screen. Do not add a legend view. Do not explain anything in help text that is not in `help.json`.

## 2. The four patterns

| Pattern | Trigger | Content | Limits | Interaction |
|---|---|---|---|---|
| **Tooltip** | Hover or keyboard focus on the element | A definition or a rule that is the same for every case | 30 words | Read-only. No links, no actions |
| **Popover** | Click or tap on a dedicated "i" chip, or on the element where it has no other click action | A process explanation, or a short preview of live data | 60 words | Read-only. May contain one "See more" link to an existing screen. No buttons that change state |
| **Helper text** | Shown under, or beside, the focused or selected option of a form control | The meaning of an option | 25 words | Read-only |
| **Tour bubble** | Shown by the guided tour, anchored to a UI element | Narration for one step | 45 words | Next, Back and Exit controls only |

Word limits count the rendered text. They are enforced by `validate_help.py` (H1).

## 3. Behaviour rules

**Opening and closing**
- Tooltip opens after 300 ms of hover, or immediately on keyboard focus. It closes 100 ms after pointer leave, on blur, or on Escape.
- Popover toggles on click, tap, Enter or Space. It closes on Escape, on a click or tap outside it, or when another popover opens.
- Only one popover or tooltip is open at a time. Tour bubbles are independent and suppress other bubbles while shown, except popovers the user opens explicitly.
- Focus never moves into a tooltip or a popover. A popover's "See more" link is the next tab stop after its trigger.

**Position**
- Place the bubble on the side with the most space, flip when clipped, and clamp to the viewport with an 8 px margin. It must never cover its own trigger.
- Maximum width 320 px, or the viewport width minus 16 px on a phone.

**Touch and coarse pointers**
- Hover is not available. For elements that have a tooltip and no click action (role chips, funnel headers, cohort headers, covenant names), a tap opens the tooltip as a popover.
- For elements that already have a click action (state badges, requirement rows, destination tabs, portfolio numbers), a tap performs the click action. The meaning of those elements is available from the state legend's "i" chip. Do not attach a popover to the element itself.
- The "i" chip has a 44 by 44 px touch target.

**Interplay with the two-click rule**
- A tooltip on a state badge is hover and focus only. It must never intercept, delay or replace the badge's click, which opens "How was this established?" (click 1) and then the evidence drawer (click 2). The rule is test H8.

**Accessibility**
- Tooltip: `role="tooltip"`, linked from the trigger with `aria-describedby`.
- Popover: the trigger is a `button` with `aria-expanded` and `aria-controls`. The content is a non-modal region with an accessible name from the trigger.
- Helper text: linked from the control with `aria-describedby`.
- Respect `prefers-reduced-motion` (no animation). Text contrast at least 4.5 to 1 in light and dark themes.
- No information may exist only in a bubble if it is listed in section 4 "Must stay visible".

## 4. Choosing a pattern

| Put it in | When | Examples |
|---|---|---|
| **Tooltip** | A definition or rule that is identical for every case | Evidence state meanings; chain step meanings; role descriptions; funnel stage conditions; monitoring state meanings; covenant names; boundary label meanings; intervention classes |
| **Popover** | A process, or a short preview of live data that links to a full view | Remediation steps; assessment-time requirements; fit checks; lender product parameters; readiness badge preview; export formats |
| **Helper text** | The meaning of an option in a form control | Dispute reason codes; finding result options; lender admission options |
| **Drill-down view or drawer** | Case data to navigate, a history, a list, a form, or any action | Evidence drawer; "How was this established?" chain; readiness basis; dispute panel; verifier queue and workbench; funnel stage lists; intervention queue; directory; lender admission table and outcome selection; event log; export dialog; restructure request |
| **Always visible** | A boundary or safety statement, a basis the reader must see, or an inline error | Everything in `help.json` under `required_visible_text`; the limitation line on every card; blocked-action messages; the "Symphony established or lender determines" panel |

Rule of thumb: if a user needs the information to operate the screen, or the content changes by case, it is not a bubble.

**Never a bubble:** the boundary sentence, "Assessment Ready does not constitute financing approval", "Illustrative products.", the reliance caption, the export note, and the blocked-action message. These must be in the visible text of the screen, readable without any interaction.

## 5. Data

### 5.1 `data/help.json`
Top-level keys: `version`, `note`, `limits`, `banned_words`, `entries[]`, `required_visible_text[]`, `blocked_message_format`.

Entry:
```
{ "id": "state.verified",            // unique, dotted
  "pattern": "tooltip|popover|helper",
  "screens": ["requirements", ...],  // screen ids where it is used (must exist in the capture schema screen list)
  "text": "...",                     // or "text_ref": "interventions.classes.standard"
  "see_more": { "label": "...", "target_screen": "readiness_basis" },   // popover only, optional
  "value_tokens": ["unresolved_count"]                                   // only if text uses {{value.*}}
}
```

**Tokens.** Text may contain `{{path}}` tokens resolved at render time:
- `{{meta.*}}`, `{{destinations.<id>.*}}` and `{{interventions.*}}` resolve against the data files. Array indexes use `.0`, `.1`. The `|num` filter formats an integer with thousands separators.
- `{{value.<name>}}` is supplied by the component and must be listed in the entry's `value_tokens`.
- Never type a number or product parameter into help text if it exists in a data file.

**Authoring rules** (enforced by `validate_help.py`):
- Unique ids, valid pattern, word limit per pattern, valid screen ids.
- No word in `banned_words`: `approved`, `bankable`, `creditworthy`, `score`, `rating`, `guaranteed`, `immutable`, `impossible`. This applies to help and tour text only. Outcome labels in the lender workspace may use "Approved".
- No real lender name (`data/forbidden_terms.json`).
- Plain language. State what something is or what happens. Do not market, promise, or imply a decision by Symphony.
- Entries must exist for every evidence state, requirement state, monitoring state, dispute reason, destination, covenant and intervention class in the data.

**Missing ids.** In development and tests, a component asking for a missing id throws. In production it renders nothing and never breaks the screen.

### 5.2 Required visible text
`required_visible_text[]` lists statements that must appear in the visible text of named screens. Components render them through a `VisibleStatement id="..."` component that reads `help.json`. Hard-coding the text elsewhere is forbidden (H7). The entries are:

| id | Text | Screens |
|---|---|---|
| `boundary.sentence` | Symphony establishes and governs readiness evidence; the financing institution establishes creditworthiness and makes the financing decision. | readiness_basis, lender_assessment, present_modal, and the header of every export |
| `readiness.not_approval` | Assessment Ready does not constitute financing approval. | readiness_basis, present_modal, destination_projection |
| `enrollment.no_prerequisites` | No bank. No programme. No loan required. | enrollment |
| `projection.line` | Same enterprise. Same project. Different requirement context. | destination_projection |
| `lender.decides` | Symphony established the state. The lender makes the decision. | lender_assessment |
| `requirements.illustrative` | Illustrative products. | requirements |
| `reliance.caption` | Reliance is your own decision. It is not an approval. | lender_assessment, verifier_workbench, directly beside the reliance control |
| `export.note` | Export of the readiness record. Not mapped to any institution's system. | lender_assessment and present_modal export dialog |

### 5.3 Blocked-action message
Every rejected action shows an inline message in the form `Blocked ({code}): {rule}`, using the code and rule text from `data/roles.json`. It stays visible until the next action or screen change. It must not be a tooltip.

### 5.4 `data/tours.json`
Fields per step: `tour_id` (`bank` or `nabii`), `step_id`, `expected_screen`, `anchor_testid`, `text` (45 words max), `advance` (`click`). The tours add the steps from section 11.1 of `FUNCTIONAL_SPEC_UPDATE_V1.md`. The anchor `data-testid` values must exist in the built UI. Reconcile any anchor that differs from the final component ids by changing `tours.json`, not by renaming a tested id. Add every anchor to `CAPTURE_TESTIDS` only if it is an interactive element.

### 5.5 Other file changes delivered
- `meta.json`: adds `boundary_labels.extended_demonstrated`, `verification_states`, `dispute_reason_codes`, `finding_results`, invariant I8.
- `roles.json`: adds roles and actions, constraint codes, and the `users` block, per `FUNCTIONAL_SPEC_UPDATE_V1.md` sections 4.3, 5.3 and 7.1.
- `capture_event_schema.json`: adds `help_open`; renames the screen `static_verification` to `claim_view`.

## 6. Components

All in `src/components/help/`. They render only from `help.json` and `tours.json`. No help string may appear in any other source file.

| Component | Props | Behaviour |
|---|---|---|
| `HelpProvider` | none | Holds the open bubble, enforces one at a time, resolves tokens, exposes `useHelp(id)`, and emits capture events |
| `HelpTip` | `id`, `children`, optional `values` | Wraps an element. Tooltip pattern. Adds `data-help-id` to the wrapped element |
| `HelpPopover` | `id`, optional `values` | Renders the "i" chip and the popover. Adds `data-help-id` |
| `HelpHint` | `id`, `controlId` | Helper text linked to a form control |
| `VisibleStatement` | `id` | Renders a required visible text. Adds `data-required-text` with the id |
| `TourBubble` | none | Reads the active tour step and anchors to its `anchor_testid`. Controls: Next, Back, Exit |
| `StateLegend` | none | A compact legend of evidence states with an "i" chip per state, built from `help.json`. It is the touch path to state meanings |

Behaviour rules for `TourBubble`: it never covers the anchor; if the anchor is missing it logs a development warning and skips the step; each step emits `tour_step`; exit emits `tour_exit`; the last step emits `tour_complete`.

## 7. Placement map

Use the entries' `screens` arrays as the source of truth. Summary:

| Screen id | Help entry groups used |
|---|---|
| `login` | `role.*` |
| `enrollment` | `role.*`, visible `enrollment.no_prerequisites` |
| `sme_dashboard`, `org_state`, `project_state` | `state.*`, `readiness.*`, `boundary.*`, `role.*`, state legend |
| `requirements` | `state.*`, `req.*`, `rule.*`, `destination.*`, `boundary.*`, visible `requirements.illustrative` |
| `gap_remediation` | `step.*`, `rule.fit`, `role.*` |
| `readiness_basis` | `chain.*`, `readiness.*`, `state.*`, `req.*`, visible `boundary.sentence`, `readiness.not_approval` |
| `destination_projection` | `readiness.*`, `destination.*`, `step.restructure_request`, `step.present`, visible `projection.line`, `readiness.not_approval` |
| `present_modal` | `step.present`, `export.formats`, visible `boundary.sentence`, `readiness.not_approval`, `export.note` |
| `lender_assessment` | `state.*`, `req.*`, `rule.provided_early`, `lender.admission.*`, `dispute.reason.*`, `verification.*`, `reliance.help`, `export.formats`, visible `boundary.sentence`, `lender.decides`, `reliance.caption`, `export.note` |
| `facility_monitoring` | `monitoring.*`, `covenant.*`, `boundary.extended` |
| `portfolio` | `portfolio.*`, `monitoring.*`, `boundary.extended` |
| `claim_view`, `verifier_queue`, `verifier_workbench` | `finding.result.*`, `verification.*`, `reliance.help`, `boundary.extended_demonstrated`, visible `reliance.caption` |
| `nabii_pipeline` | `funnel.*`, `intervention.*`, `cohort.gaps_closed`, `destination.N` |
| `nabii_cohort` | `cohort.*`, `intervention.*` |
| `nabii_directory` | `intervention.*` |

## 8. Removals and replacements in the implementation plan

- **Remove** the "Before Symphony / After Symphony" time-saving panel from the lender workspace. It makes an unverified claim about the bank's process. Bank question B1 establishes the real baseline.
- **Remove** any explanatory paragraph that duplicates a help entry, and any glossary, legend or permissions page. The state legend component replaces the legend.
- **Replace** the static `InstitutionalBoundaryBanner` copy with `VisibleStatement id="boundary.sentence"`. The banner stays visible.
- **Replace** hard-coded labels in `BoundaryLabel` with the labels in `meta.json`, with the tooltip from `boundary.*`.
- **Keep** the limitation line on every card (invariant I3). A one-line limitation summary is visible on the card. The full text is in the evidence drawer.

## 9. Interaction details for specific elements

- **Readiness badge:** shows "Assessment Ready" or "Not yet ready". Next to it, an "i" chip opens `readiness.preview` (with values from the engine) or `readiness.ready` / `readiness.not_ready`. Its "See the full basis" link opens `readiness_basis`.
- **Destination tabs:** hover or focus shows the `destination.<id>` content as a tooltip on pointer devices, and a popover opened from an "i" chip on touch. Clicking the tab switches destination as before.
- **Roles:** the role switcher shows `role.<id>` as a tooltip on each option. Disabled buttons show the constraint rule as a tooltip and, when clicked, the visible blocked-action message.
- **Funnel and cohort headers:** tooltips from `funnel.*` and `cohort.*`. The numbers beneath them are clickable drill-downs.
- **Covenant rows:** the covenant name carries the `covenant.<id>` tooltip. The row's state chip carries the `monitoring.<state>` tooltip.
- **Form controls:** dispute reasons, finding results and lender admission options show helper text for the focused or selected option.

## 10. Capture

Add one event, `help_open`, defined in the revised `capture_event_schema.json`:

| Type | When | Payload |
|---|---|---|
| `help_open` | A tooltip, popover or helper text is opened | `help_id`, `pattern` (`tooltip`, `popover`, `helper`, `tour`), `via` (`hover`, `focus`, `tap`, `key`) |

Rules:
- A tooltip counts as opened only after its 300 ms delay has elapsed or on keyboard focus.
- Emit at most one `help_open` per `help_id` per 5 seconds within a session.
- Tour bubbles emit `tour_step` only. The `tour` value of `pattern` is reserved and must not be emitted.
- The payload contains the id only, never the help text, and never any typed text (X7 unchanged).
- Add to `CAPTURE_SPEC.md` section 4 and section 8: per-session `help_open_by_id` counts and the top five help ids opened. These show which concepts the audience needed explained.

## 11. Tests

Add to `tests/TEST_CASES.md`. All Playwright tests run against the built app.

| ID | Level | Test | Pass condition |
|---|---|---|---|
| **H1** | Data | Run `python3 tools/validate_help.py` and expose it as `npm run verify:help` | Prints OK. Fails the test run otherwise |
| **H2** | UI | Visit every screen. Collect all `data-help-id` and `data-required-text` attributes | Every id exists in `help.json`. Every entry's `screens` array matches where it is actually used (no entry unused, no screen using an id not listed for it) |
| **H3** | UI | Keyboard: focus each trigger of each pattern | Tooltip opens on focus. Popover opens with Enter or Space and `aria-expanded` is true. Escape closes. Focus is never trapped. A "See more" link is the next tab stop |
| **H4** | UI | Touch emulation (`hasTouch`, coarse pointer) | A tap on a tooltip-only element opens it as a popover. A tap on a badge performs its click action and does not open a bubble. The state legend's "i" chip shows the state meaning. Tap outside closes |
| **H5** | UI | For each `required_visible_text` entry and screen | The text is in the rendered, visible text of that screen with no hover or click, not inside a closed popover, not `aria-hidden`, and not clipped. `reliance.caption` is adjacent to the reliance control |
| **H5b** | UI | Trigger a rejected action (for example `ROLE_NOT_PERMITTED`) | The message `Blocked ({code}): {rule}` is visible inline with the code and rule text from `roles.json` |
| **H6** | UI | Run both tours from reset | Every step's `anchor_testid` exists and is visible on its `expected_screen`. The bubble does not cover the anchor. Next, Back and Exit work. Both tours complete without a console error |
| **H7** | Source | Scan all source files except `help.json` and `tours.json` | No file contains the exact text, after whitespace normalisation and case folding, of any help entry, tour step or required visible text |
| **H8** | UI | On a requirement state badge with a tooltip: hover, then click | Click 1 opens "How was this established?". Click 2 opens the evidence drawer. The tooltip does not block or delay either |
| **H9** | UI | Open a mix of tooltips, popovers and helper text during a tour run | Each emits one `help_open` event that validates against the schema, with no text in its payload. Re-opening the same id within 5 seconds emits nothing new |
| **H10** | UI | Scan rendered bubble text across all screens | No banned word, no real lender name |
| **H11** | UI | For each requirement card on `requirements` and `lender_assessment` | A one-line limitation is visible on the card without opening anything |

Regression: the 27 baseline results, T1 to T8a, D1, X1 to X10 and the tests in `FUNCTIONAL_SPEC_UPDATE_V1.md` must still pass.

## 12. Changes to the implementation plan

- **Phase 2 (components):** add the `src/components/help/` set (section 6) and the `StateLegend`. Add `data-help-id` and `data-required-text` attributes. The Phase 2 gate adds H1 to H4, H8.
- **Phase 3 (SME):** place help per section 7. Replace static explanation text with help entries and `VisibleStatement`. Gate adds H5 and H11 for the SME screens.
- **Phase 4 (lender workspace):** place help and `VisibleStatement`s. Remove the time-saving panel. Gate adds H5, H5b, H11.
- **Phases 5 to 7:** place help per section 7. Phase 7 adds `intervention.*`, `funnel.*` and `cohort.*` entries.
- **Phase 8 (tours and capture):** drive both tours from `tours.json`. Add `help_open` capture. Gate adds H6, H9.
- **Phase 9:** run H7 and H10, `validate_help.py`, and the full suite.
- **Architecture freeze note:** the new components are listed in section 6. No new screens are added by this document. The screen id `static_verification` becomes `claim_view`.

## 13. Acceptance criteria

1. `validate_help.py` passes, and all of H1 to H11 pass.
2. No help text is defined in any component or source file.
3. Every statement in section 5.2 is visible on its screens without any interaction.
4. All meanings of states, rules, steps, roles, destinations and terms are available as bubbles on desktop (hover, focus), touch (tap, legend chip) and keyboard.
5. The two-click rule still holds from any state badge.
6. No bubble contains a banned word, a real lender name, a score, or a statement that implies a decision by Symphony.
7. The time-saving panel and any static legend or glossary view are removed from the plan.

## 14. Defaults chosen here

Do not change without approval:
- Tooltip delay 300 ms, close delay 100 ms, popover width 320 px.
- Badges never carry popovers. Their meanings are in the legend and tooltips.
- Help text lives in `help.json` and is the only place for explanatory strings.
- Tour bubbles do not emit `help_open`.
- The screen id `claim_view` replaces `static_verification` in the capture schema, help entries and plan.
