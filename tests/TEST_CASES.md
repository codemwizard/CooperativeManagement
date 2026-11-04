# Symphony Prototype: Test Cases

All tests run against the fixtures in `data/` with `demo_date = 2026-10-06` unless stated.
Expected baseline results for every case and destination are in `tests/expected-results.json`.
Scenario expectations below were cross-checked with `tools/reference_oracle.py`.

**Conventions**
- Destination ids: `A` (Lender A), `B` (Lender B), `N` (NABII Programme Pipeline).
- "Evaluate" means call the engine's evaluate function for a case, a destination and a date.
- Actions are applied by the engine's action function with an actor `{user_id, role}`. Actions return a new case state plus an event. They never mutate the input.
- Tests T1-T7 and D1 are engine tests (unit level). T8b is a UI test.

---

## T1. Destination switch changes readiness with no change to evidence

**Given** `case-1` at baseline.
**When** you evaluate it for A, then for B, then for N, without applying any action.
**Then**
- A: `ready = false`, `unresolved = [A2, A6]`.
- B: `ready = false`, `unresolved = [B3, B4, B5, B7]`.
- N: `ready = true`, `unresolved = []`.
- A deep copy of `case.evidence` taken before the three evaluations equals `case.evidence` after them.
- No event was appended to `case.events`.

**Why it matters:** readiness is computed (invariant I4). Switching destination only changes the requirement context.

---

## T2. Closing two gaps flips Lender A only

**Given** `case-1` at baseline.
**When** these actions are applied in order:
1. `upload_minutes` by `c1.secretary` (records the minutes against `governance`).
2. `signoff_minutes` by `c1.chairman`.
3. `mark_verified` on `governance` by `fa.banda`.
4. `add_evidence` of type `farming_history` with `seasons = 2`, level `supported`, basis "Programme records", by `c1.treasurer`.

**Then**
- A: `ready = true`, `unresolved = []`.
- B: unchanged: `unresolved = [B3, B4, B5, B7]`.
- N: unchanged: `ready = true`.
- `governance.level = verified`, `verified_by = fa.banda`, `verified_on` is set, and `limitation` is non-empty.
- `governance.history` contains the prior record (level `supported`) and the original `asserted` record. Nothing was overwritten (invariant I2).
- Each of the four actions produced exactly one event, in order, with actor and timestamp.

---

## T3. A stale registration produces an exception on every destination

**Given** `case-3` at baseline (registration verified, `valid_until = 2026-09-30`).
**When** you evaluate it for A, B and N at `2026-10-06`.
**Then**
- A: `ready = false`, `exceptions = [A1]`, `unresolved = []`.
- B: `ready = false`, `exceptions = [B1]`, `unresolved = [B3, B4, B5, B7]`.
- N: `ready = false`, `exceptions = [N1]`, `unresolved = []`.
- For each exception, `evidence_ref = registration`, the effective state is `stale`, and the message cites the expiry date `2026-09-30`.

**T3b.** Evaluate the same case for A at `2026-09-29`.
**Then** `ready = true` and `exceptions = []`.

**Why it matters:** staleness is date-driven, and the same change propagates to every destination.

---

## T4. Optional early off-take evidence never changes readiness

**T4a.** **Given** `case-1` at baseline. **When** `add_evidence` of type `offtake`, level `supported`, is applied by `c1.secretary`.
**Then** requirement A10 has `state = assessment_time`, `provided_early = true`, `effective_level = supported`. A's `unresolved` is still `[A2, A6]` and `ready = false`.

**T4b.** **Given** `case-5` (ready for A). **When** an `offtake` item at level `asserted` is added.
**Then** A remains `ready = true`.

**T4c.** **Given** `case-5`. **When** an `offtake` item at level `supported` with `valid_until = 2026-01-01` (stale) is added.
**Then** A10 stays `assessment_time` (never `exception` or `unresolved`) and A remains `ready = true`.

---

## T5. Self-verification and wrong-role verification are blocked

**Given** `case-1` with a fresh governance upload by `c1.secretary` and chairman sign-off recorded.

**T5a.** **When** `mark_verified` on `governance` is attempted by actor `{user_id: c1.secretary, role: secretary}`.
**Then** the action is rejected with code `ROLE_NOT_PERMITTED`. The case state is unchanged.

**T5b.** **When** `mark_verified` is attempted by a user with role `field_agent` whose `user_id` equals the evidence's `supplied_by` (set up a fixture where a field agent supplied the item).
**Then** the action is rejected with code `SELF_VERIFICATION`. The case state is unchanged.

**T5c.** **When** `mark_verified` on `governance` is attempted by `fa.banda` before any `signoff_minutes` event exists.
**Then** rejected with code `SIGNOFF_REQUIRED`.

**T5d.** **When** a treasurer who recorded a payment tries `confirm_payment` on that payment.
**Then** rejected with code `SELF_CONFIRMATION`.

**T5e.** **When** a `pfi_credit` or `verifier` user tries any action that modifies SME evidence.
**Then** rejected with code `READ_ONLY_ROLE`.

Every rejection returns the rule text (for the UI to display the rule that blocked the action).

---

## T6. Restructuring the request closes a fit check but not evidence gaps

**Given** `case-1` at baseline.

**T6a.** **When** `restructure_request` by `c1.chairman` sets `{structure: per_group, amount_per_group: 25000, groups: 6, term_months: 9}`.
**Then**
- B: `unresolved = [B3, B4, B5]` (B7 is now satisfied).
- A: `unresolved = [A2, A6, A11]` (A11 now fails, because the request is no longer a single facility).
- `case.evidence` is unchanged. A `restructure_request` event is recorded.

**T6b.** **When** instead the per-group amount is `60000` (outside 10,000-50,000).
**Then** B7 remains unresolved.

**T6c.** **When** instead the term is `18` months (outside 6-12).
**Then** B7 remains unresolved.

**Why it matters:** fit checks cannot be closed with evidence, and restructuring one product's request can break the fit for another.

---

## T7. One state, opposite results at two lenders

**Given** `case-9` and `case-1` at baseline.
**Then**
- `case-9`: B `ready = true`; A `ready = false` with `unresolved = [A2, A4, A5, A6, A11]`; N `ready = true`.
- `case-1`: A not ready, B not ready (as T1).
- The requirement results for B in `case-9` all have non-null `evidence_ref` except B7 (fit) and B8 (assessment-time, no evidence).

---

## T8a. Every state traces to its basis (engine level)

For every case, destination and requirement result in the baseline:
- If `evidence_ref` is non-null it resolves to an item in `case.evidence`.
- Every evidence item with level `supported` or `verified` has a non-empty `limitation`.
- Every item with level `verified` has `verified_by` set, `verified_on` set, and `verified_by != supplied_by`.
- Every `registration` item at level `verified` carries the registration limitation text from `meta.mandatory_limitations`.
- Results with `state` of `unresolved` for evidence rules where an item exists show the effective level and the minimum level required.

## T8b. Every state reaches its evidence in two clicks (UI level)

For each screen that shows a requirement state or metric card:
- From the state label, one click opens "How was this established?" and a second click opens the evidence drawer showing: type, supplied by, supplied on, verified by (or "Not verified"), verified on, limitation, history.
- For portfolio numbers: click the number (1), land on a filtered project list; click a project (2), land on that project's requirement view. The evidence drawer is then one more click, so the rule here is "two clicks to a project, three to evidence".
- No state label is plain text without a click target.

Automate with Playwright against the built app.

---

## D1. Seed data integrity

Run on `data/cases.json`:
- No `verified` item has `verified_by == supplied_by`.
- Every `supported` or `verified` item has a non-empty `limitation`.
- Every case has `project_definition` evidence.
- `case-3` registration `valid_until` is before `demo_date`; every other case's is after.
- Every `financing.covenants[].id` exists in the corresponding destination's `covenants`.

---

## X1. Monitoring state

Using `meta.monitoring_due_window_days = 14` and `demo_date = 2026-10-06`:
- `case-6` monitoring = `current` (next covenant due 2026-12-15).
- `case-7` monitoring = `overdue` (quarterly cash statement due 2026-09-15, not received).
- Boundary: for a covenant due 2026-10-20 and not received, state = `due`. For one due 2026-10-21, state = `current`. For one due 2026-10-05 and not received, state = `overdue`. A received covenant is never due or overdue.
- A case's monitoring state is the worst of its covenants (overdue beats due beats current).

## X2. No real lender names

Scan every string in the built application (UI text, seed data, exports, page titles, source maps, comments in shipped files) against `data/forbidden_terms.json`, case-insensitive. Zero matches outside `data/forbidden_terms.json` and the kit documents. "NABII" is allowed.

## X3. Boundary labels

Every screen declares one of the labels in `meta.boundary_labels`. Screens for stages 1-9 show "Beachhead". Stages 10-16 show "Same state, extended". The static verification screen shows "Same state, extended: illustrative. Not built."

---

## Reset test

After running T2 in the UI, pressing Reset restores `case-1` to its baseline evidence, clears all events, and clears any presentation or outcome. Evaluating after reset reproduces the T1 results exactly.
