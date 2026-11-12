# Symphony Prototype: Automatic Session Capture Spec (v1.0)

Replaces the "Interest-capture sheet" bullet in the Phase 8 instructions. Capture is fully automatic. The presenter never types or clicks anything to record data during a demo. Opinions and answers are collected after the session using `capture_questions.json` and `session_notes_template.json`.

Files: `capture_event_schema.json` (machine-checkable event schema), `capture_questions.json` (questions to ask), `session_notes_template.json` (fill in after the session).

---

## 1. Principles

1. **Invisible.** Nothing capture-related appears on demo screens. No prompts, no panels.
2. **Behaviour only.** Events record what was viewed, how long, and which controls were used. They never record typed text, PINs, or any personal data.
3. **Local only.** No network calls of any kind. No analytics libraries.
4. **Isolated.** Capture never affects the engine. A capture failure must never break the app.
5. **Survives Reset.** "Reset demo" restores the case data. It must **not** erase the capture log.
6. **Proxy, not proof.** Dwell time and revisits are signals of attention. They are not signals of demand. The questions file exists to test what they mean.

## 2. Session lifecycle

**Start.** A session starts automatically on first page load. Optional URL parameters, set by the presenter before the session, label it:

`?audience=bank|nabii|other&label=bank-1&indicator=off`

- `audience` defaults to `unlabelled`. `label` is a short code for the meeting (no names).
- `session_id` is `S-YYYYMMDD-HHMM-xxxx` (4 random hex characters), generated at start.
- `indicator=on` shows a small recording dot. Default is off. If attendees don't know interactions are logged, tell them at the start.

**End.** A session ends on the first of:
1. The chord **Ctrl+Shift+E** (one keystroke; also downloads the session JSON).
2. Tour completion (reason `tour_complete`).
3. 20 minutes without any input (reason `idle_timeout`, ended at the time of the last input).
4. `pagehide` (reason `page_hide`).
5. A new `?session` load or Reset demo (reason `reset`), which closes the current session and starts a new one. The log is kept.

Starting a new session after one has ended is automatic on the next input.

**Idle.** After 30 seconds without input, emit `idle_start`. On next input, emit `idle_end` with the idle length. Idle time is excluded from `active_ms`. Long idle on a screen usually means they are talking, so keep it as a signal.

## 3. Event base fields

Every event has these. Full schema in `capture_event_schema.json`.

| Field | Type | Notes |
|---|---|---|
| `v` | 1 | Schema version |
| `session_id` | string | |
| `seq` | integer | Starts at 1, increases by 1, no gaps |
| `t_ms` | integer | Milliseconds since session start, from `performance.now()`, never decreasing |
| `ts` | ISO 8601 UTC | Wall clock. Not the engine demo date |
| `type` | enum | See section 4 |
| `screen_id` | enum or null | See section 5 |
| `tour_id` | `bank`, `nabii` or null | Active tour |
| `tour_step` | string or null | Active step id |
| `case_id` | string or null | Selected cooperative |
| `destination_id` | `A`, `B`, `N` or null | Selected destination |
| `role` | string or null | Active role |
| `payload` | object | Per type, section 4 |

## 4. Event catalogue

Payload keys are exact and required. No extra keys are allowed.

| Type | When emitted | Payload |
|---|---|---|
| `session_start` | Session begins | `audience`, `label`, `app_version`, `viewport {w,h}`, `device_class` (desktop, tablet, phone), `demo_date` |
| `session_end` | Session ends | `reason`, `duration_ms`, `active_ms` |
| `screen_view` | A screen becomes active | `previous_screen`, `via` (initial, nav, tour, drilldown, link, back) |
| `screen_leave` | A screen stops being active | `dwell_ms`, `active_ms` |
| `idle_start` | 30 s without input | `threshold_ms` |
| `idle_end` | Input after idle | `idle_ms` |
| `visibility` | Tab hidden or shown | `state` |
| `tour_start` | A tour starts | `tour_id`, `step_total` |
| `tour_step` | A tour step is shown | `step_id`, `step_index`, `step_total`, `direction` (next, back, jump) |
| `tour_exit` | Tour abandoned | `step_id`, `step_index`, `completed_fraction` |
| `tour_complete` | Last step finished | `duration_ms` |
| `off_script` | In a tour, the viewer opens a screen other than the step's expected screen | `expected_screen`, `actual_screen` |
| `ui_click` | Click on an element with `data-testid` | `testid` only. Never the element text |
| `help_open` | A tooltip, popover or helper text is opened (see `UI_HELP_SPEC_V1.md` section 10) | `help_id`, `pattern`, `via`. Never the help text |
| `destination_switch` | Destination changed | `from`, `to` |
| `role_switch` | Role changed | `from`, `to` |
| `case_select` | Cooperative changed | `from`, `to` |
| `action_result` | Any engine action attempted | `action`, `ok`, `code` (or null), `changed_requirements[]` |
| `readiness_change` | An action changes a destination's ready flag or unresolved list | `destination_id`, `before`, `after`, `unresolved_before[]`, `unresolved_after[]` |
| `traceability_open` | "How was this established?" or evidence drawer opened | `level` (chain, evidence), `requirement_id`, `evidence_type`, `clicks_from_state` |
| `drilldown` | Click from a portfolio or pipeline number into a list or project | `from`, `to`, `clicks` |
| `outcome_recorded` | A lender outcome is recorded | `outcome` |
| `evidence_admission` | Lender admission toggle changed | `requirement_id`, `status` |
| `evidence_request` | Lender requests more evidence | `requirement_id` |
| `reset_demo` | Reset pressed | none |
| `export` | A capture export is downloaded | `format` |
| `error` | An application error is caught | `message` (max 200 characters), `source` |

**Emission rules**
- `action_result` is emitted for every attempted engine action, including blocked ones. Blocked attempts show which rules the audience tried to test.
- `readiness_change` is derived by comparing the engine's evaluation before and after the action, not by the UI.
- `ui_click` is emitted only for elements with a `data-testid` from an allow-list, defined in code as `CAPTURE_TESTIDS`. Elements without one are never logged.
- The capture module subscribes to engine events. It never calls the engine to change state.

## 5. Screen registry

`screen_id` must be one of: `login`, `enrollment`, `sme_dashboard`, `org_state`, `project_state`, `requirements`, `gap_remediation`, `readiness_basis`, `destination_projection`, `present_modal`, `lender_assessment`, `facility_monitoring`, `portfolio`, `claim_view`, `nabii_pipeline`, `nabii_cohort`, `nabii_directory`, `verifier_queue`, `verifier_workbench`, `tour_launcher`.

If the final screen list differs, update this registry and `capture_event_schema.json` together. The capture admin route is never logged.

## 6. What is never captured

- Text typed into any input, including PIN, names, and notes.
- Element text, URLs with identifiers beyond the route, or clipboard content.
- Any identifier of a person or a device. `user_agent` is reduced to `device_class`.
- Audio, video or screenshots.

## 7. Storage and limits

- Key `symphony.capture.v1` in `localStorage`. Reset demo must not touch this key.
- If `localStorage` is unavailable or full, keep events in memory and continue silently. Emit one `error` event with `source: "storage"`.
- Write in batches every 2 seconds and on `pagehide` and `visibilitychange`.
- Limit 20,000 events per session. At the limit, stop logging and emit one final `error` with `source: "cap"`.
- All timestamps and counters are produced by the capture module. The engine never reads them.

## 8. Derived metrics (computed at export)

Computed from events only. Put them in the JSON export under `summary`, and in the CSVs below.

**Per screen**
`views`, `revisits` (views minus 1), `first_view_t_ms`, `total_dwell_ms`, `total_active_ms`, `mean_active_ms`, `max_single_active_ms`, `entered_via_tour`, `entered_via_nav`.

**Per session**
- `duration_ms`, `active_ms`, `idle_gap_count` (gaps over 30 s), `idle_total_ms`, `longest_idle_ms`
- `tours_started`, `tours_completed`, `tour_exit_step`
- `off_script_count` and `off_script_ratio` (off-script events divided by tour steps)
- `destination_switches` (count and from/to pairs), `role_switches`
- `blocked_actions` by `code`, `successful_actions`
- `traceability_opens`, `max_drill_clicks`
- `outcomes_recorded`, `resets`
- `time_to_first_traceability_open_ms`
- `top_screens_by_active` (top 5), `screens_never_viewed` (from the registry)
- `help_open_by_id` (counts) and `top_help_ids` (top 5): which concepts needed explaining

**Interpretation notes** (also keep in the README)
- High active dwell with revisits suggests attention. Long idle on a screen suggests discussion. Neither is intent.
- Many blocked actions suggests the audience tested the rules. This is a positive signal for the governance story.
- Off-script screens suggest what they wanted to see that the script did not show.
- Compare automatic screen ranking with answers to question C3 (stated versus revealed interest).

## 9. Exports

Available from the hidden route `/capture` (not linked from any screen) and by Ctrl+Shift+E.

| Export | Content |
|---|---|
| Session JSON | `{ session, events[], summary }` for one session |
| All sessions JSON | Array of the above |
| `events.csv` | One row per event |
| `screens.csv` | One row per session and screen, with the per-screen metrics |
| `sessions.csv` | One row per session with the per-session metrics |

**events.csv columns:** `session_id, seq, t_ms, ts, type, screen_id, tour_id, tour_step, case_id, destination_id, role, payload_json`
**screens.csv columns:** `session_id, screen_id, views, revisits, first_view_t_ms, total_dwell_ms, total_active_ms, mean_active_ms, max_single_active_ms, entered_via_tour, entered_via_nav`
**sessions.csv columns:** `session_id, audience, label, started_at, duration_ms, active_ms, tours_started, tours_completed, tour_exit_step, off_script_count, destination_switches, role_switches, blocked_actions, successful_actions, traceability_opens, max_drill_clicks, outcomes_recorded, resets, idle_gap_count, longest_idle_ms, time_to_first_traceability_open_ms`

CSV rules: UTF-8, comma-separated, one header row, `payload_json` quoted with doubled quotes. Every export emits an `export` event.

The `/capture` route also has a "Clear capture data" button behind a confirmation. It is the only code path that deletes capture data.

## 10. Tests

Add to the test plan. All engine-independent unless stated.

| ID | Test | Pass condition |
|---|---|---|
| **X4** | Schema conformance | Every event emitted during the Phase 3 and tour Playwright runs validates against `capture_event_schema.json`; `seq` has no gaps; `t_ms` never decreases; `session_end` is last |
| **X5** | No network | During a full tour, Playwright records zero requests other than same-origin static assets. The built bundle contains no `fetch`, `XMLHttpRequest`, `sendBeacon` or `WebSocket` call to any non-same-origin URL |
| **X6** | Reset isolation | After a tour, pressing Reset leaves `symphony.capture.v1` intact, closes the session with reason `reset`, and starts a new session. The engine state equals baseline |
| **X7** | No typed text or personal data | Type text into every input in the UI. No event or export contains it. `ui_click` payloads contain only allow-listed test ids |
| **X8** | Failure tolerance | With `localStorage` throwing on every call, the full tour completes with no uncaught exception, and an `error` event with `source: "storage"` is held in memory |
| **X9** | Derived metrics | A fixed fixture event stream produces exactly the expected `summary` values (write the fixture and expected values before the metrics code) |
| **X10** | Export formats | CSV headers match section 9 exactly. JSON export re-validates against the schema |

## 11. Changes to the main instruction file (AGENT.md)

1. **Phase 2 component list:** add `CaptureProvider` (context and hooks, no UI). Add a rule that interactive elements participating in capture carry a `data-testid`. Add an allow-list `CAPTURE_TESTIDS`.
2. **Phase 8:** replace the Interest-capture bullet with:

   > **Automatic session capture** per `CAPTURE_SPEC.md`: event schema, session lifecycle, local storage, derived metrics, exports at `/capture` and Ctrl+Shift+E. No visible capture UI in the demo. No manual note-taking in the application. No network calls. Reset must not delete capture data.

3. **Phase 8 gate:** add tests X4 to X10.
4. **Section 2 (hard rules):** add "Capture isolation: capture code never changes engine state, never records typed text, and never makes network calls."
5. **Files you are given:** add `CAPTURE_SPEC.md`, `data/capture_event_schema.json`, `data/capture_questions.json`, `data/session_notes_template.json`.
6. **Test X2:** do not scan `capture_questions.json` for forbidden terms as application content, but confirm the built bundle does not include it. The question and notes files are presenter material, not shipped.

## 12. Post-session workflow (presenter)

1. Before the session: open the app with `?audience=...&label=...`. Tell attendees interactions are logged on this device with no names.
2. Run the demo. Do not take notes.
3. After the demo, ask the questions in `suggested_order` for that audience, ending with C5.
4. Within 15 minutes, copy `session_notes_template.json`, fill it in (roles only, short quotes under 20 words), and save it as `notes-<session_id>.json`.
5. Press Ctrl+Shift+E to end the session and download the JSON.
6. Compare: automatic screen ranking against C3, blocked actions against B3 and B8, commitment level against follow-up actions actually taken.
7. Keep session JSON and notes together and off shared folders.
