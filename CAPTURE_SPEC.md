# Symphony Session Capture Specification (`CAPTURE_SPEC.md`)

## 1. Overview & Operating Model
The Session Capture system is an automated, zero-overhead diagnostic layer designed for live institutional sessions with **NABII Zambia** and **commercial debt providers (Lenders)**. It operates silently in the background, providing quantitative and qualitative demand evidence without interrupting the demo or appearing on screen-shares.

### Core Invariants:
1. **Zero Network Calls:** No external analytics, no third-party tracking, no cloud telemetry. All data is processed in-memory and persisted solely to local device storage.
2. **Zero DOM / Text Intrusion:** Never captures typed text, element text, or personal identifiable information. Only logs discrete state and interaction identifiers.
3. **Reset Isolation:** Application state resets (`Reset Demo`) wipe fixture mutations and events, but strictly preserve `localStorage` capture session logs (`symphony_capture_session_*`).
4. **Offline Export:** Instant client-side generation and download of structured `JSON` and `CSV` files directly to the presenter's machine.

---

## 2. Session Initialization & Navigation
- **Automatic Start:** A session initializes automatically on first page load.
- **URL Parameter Tagging:** Sessions are labeled without in-app clicking via query parameters:
  - Example: `?audience=bank&label=bank-1`
  - Example: `?audience=nabii&label=cohort-pilot-1`
  - Fallback defaults if omitted: `audience=unknown`, `label=demo-<timestamp>`
- **Hidden Routes & Keyboard Shortcuts:**
  - `Ctrl + Shift + E`: Ends the active session, computes summary dwell statistics, and automatically downloads the JSON session file and CSV log.
  - `/capture` or `Ctrl + Shift + N`: Opens the hidden presenter cockpit showing:
    - Live event count, active screen, and dwell times.
    - Audience-specific interview questionnaire ([capture_questions.json](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/data/capture_questions.json)).
    - Post-session notes editor ([session_notes_template.json](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/data/session_notes_template.json)).
    - Manual JSON and CSV export buttons.

---

## 3. The 26 Event Types & Schema
Every event conforms strictly to [capture_event_schema.json](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/data/capture_event_schema.json):

| Event Type | Trigger Condition | Logged Payload |
| :--- | :--- | :--- |
| `session_start` | Session initialized on load | `session_id`, `audience`, `label`, timestamp |
| `session_end` | Session closed via shortcut or `/capture` | `session_id`, total duration, event count |
| `screen_view` | Navigation between views | `screen` identifier, previous screen |
| `screen_dwell` | Exiting a screen | `screen`, `dwell_ms` |
| `idle_pause` | Inactivity exceeding 45 seconds | `screen`, `dwell_ms` (indicates audience discussion) |
| `tour_start` | Initiating Bank or NABII tour | `tour_id` (`bank_tour` / `nabii_tour`) |
| `tour_step` | Advancing a tour step | `tour_id`, `step_index`, target highlight |
| `tour_complete` | Tour finished | `tour_id`, total tour time |
| `tour_abandon` | Presenter navigated off-script | `tour_id`, abandoned step index |
| `destination_switch` | Changing destination context | `destination` (`A`, `B`, `NABII`) |
| `role_switch` | Changing active persona | `role` (`c1.secretary`, `pfi_credit`, etc.) |
| `case_select` | Choosing a cooperative case | `case_id` (`case-1` through `case-9`) |
| `how_established_click` | Clicking "How was this established?" | `requirement_id`, `evidence_ref` |
| `evidence_drawer_open` | Opening the evidence drawer | `evidence_type`, `case_id` |
| `evidence_drawer_close` | Closing the evidence drawer | `dwell_ms` inside drawer |
| `history_view` | Expanding evidence history stack | `evidence_type`, history entry count |
| `action_attempt` | Attempting a role action | `action`, `actor`, `target` |
| `action_success` | Action allowed and applied | `action`, resulting event ID |
| `action_blocked` | Action rejected by rule | `action`, rejection code (`SELF_VERIFICATION`, etc.) |
| `restructure_request` | Restructuring loan request | New amount, term, structure parameters |
| `readiness_recomputed` | Engine recomputes destination state | `destination`, `ready` (boolean), unresolved count |
| `present_modal_open` | Opening destination handoff modal | `destination`, snapshot metadata |
| `present_confirm` | Presenting frozen dossier | `destination`, presentation ID |
| `lender_evidence_admission` | PFI toggling evidence status | `requirement_id`, admission status (`accepted`/`review`) |
| `lender_outcome_select` | PFI recording explicit outcome | `outcome` (`approved`, `declined`, `deferred`, etc.) |
| `demo_reset` | Resetting prototype state | Restored baseline timestamp |

---

## 4. Structured Post-Session Discovery & Commitment Ladder
The interview protocol in [capture_questions.json](file:///Ubuntu/home/mwiza/workspaces/Symphony-Demo/Symphony/Prototype/data/capture_questions.json) separates the inquiry into:
- **8 NABII Questions (N1–N8):** Pipeline drop-offs, TA workload ownership, cluster viability, and environmental baseline mandate.
- **10 Bank Questions (B1–B10):** Uncovers actual baseline documentation (B1), first inspected screens (B2), Evidence Admission policy alignment (B3), and loan covenant monitoring (B6/B7).
- **5 Common Questions (C1–C5):** Screen utility comparison and the **C5 Commitment Ladder**:
  1. *Level 1:* No interest / polite disengagement
  2. *Level 2:* General interest / request for follow-up materials
  3. *Level 3:* Recommends meeting with colleagues / department head
  4. *Level 4:* Agrees to share institution's actual requirement checklist
  5. *Level 5:* Agrees to review a specific live pipeline or test case
  6. *Level 6:* Commits to a dated pilot step / sandbox test

---

## 5. Verification Test Suite: Tests X4–X10
| Test ID | Name | Target Specification |
| :---: | :--- | :--- |
| **X4** | Zero Outbound Network Calls | Asserts `fetch`, `XMLHttpRequest`, and `navigator.sendBeacon` are never invoked during session recording. |
| **X5** | Demo Reset Isolation | Asserts that triggering `demo_reset` restores case fixtures while keeping `symphony_capture_session_*` logs intact in `localStorage`. |
| **X6** | Event Schema Conformance | Asserts that all 26 event payloads validate against `capture_event_schema.json`. |
| **X7** | Privacy & PII Sanity | Asserts that input values, form text, and arbitrary DOM strings are never logged to event payloads. |
| **X8** | CSV Serialization Integrity | Asserts CSV export produces valid comma-separated rows with exactly the 10 defined headers. |
| **X9** | Keyboard Shortcut Trigger | Asserts pressing `Ctrl + Shift + E` dispatches session completion and triggers file download. |
| **X10** | URL Parameter Ingestion | Asserts `?audience=...&label=...` properly populates session metadata upon initialization. |
