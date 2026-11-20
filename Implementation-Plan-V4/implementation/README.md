# Implementation Plans Index

**Location:** `Implementation-Plan-V4/implementation/`  
**Authority:** `Implementation-Plan-V4/06-phased-plan.md`

---

## Reading order and dependencies

```
Historical Phase 0 CI gate passed on 6 November 2026 (run 42201289720); the clean candidate gate was rerun on 7 November 2026. Phase 1 is In Progress.
Phase 1 Gate must pass before Phase 2 starts.
```

## Plans in this directory

| File | Phase | Gate summary |
|---|---|---|
| [`PHASE-0-IMPLEMENTATION.md`](./PHASE-0-IMPLEMENTATION.md) | 0 — Decide, prepare, baseline | CI green; baseline recorded; ADRs ratified; no feature code |
| [`PHASE-0-REMEDIATION-IMPLEMENTATION.md`](./PHASE-0-REMEDIATION-IMPLEMENTATION.md) | Phase 0 remediation — COMPLETE | Exact CI gate PASS on `c70d3f4`; Phase 1 login E2E carried forward |
| [`../../docs/PHASE0_COMMAND_MAP.md`](../../docs/PHASE0_COMMAND_MAP.md) | Phase 0 operations | Commands, prerequisites, scope, and evidence |
| [`PHASE-1-IMPLEMENTATION.md`](./PHASE-1-IMPLEMENTATION.md) | 1 — Kernel, identity, authorisation, privacy, shell | In Progress; historical WP checkboxes require re-evidence; Phase 1 gate remains open |
| [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md) | Current Phase 1 remediation baseline | REM-WP1.5 is recorded complete in `evidence/phase1/wp1.5/task-evidence.json` for its cited candidate; historical CI claims remain SHA-specific. REM-WP1.6 prerequisites are graph-defined and include WP2.3/WP2.6; see the [`post-WP1.5 roadmap`](./PHASE-1-REMEDIATION-ROADMAP-FROM-WP1.6.md) and [`REM-WP1.6 remediation plan`](./WP1.6-REMEDIATION-IMPLEMENTATION-PLAN.md). |
| [`WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md`](./WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md) | WP2/WP5 specification gates | Corrected execution edges; explicit policy, identity, capacity, race, BDD and credential/session specification gates; no production-code authorization until each task is specification-ready. |
| [`WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md`](./WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md) | Historical REM-WP1.5 CI repair and closeout record | CI run `43683206104` applies only to candidate `d7fbf5851b11b07b65bde36f062db7b21f487947`; current task status is in its evidence record and candidate reconciliation in the closure register. |
| [`WP1.5-FINAL-CLOSEOUT-IMPLEMENTATION-PLAN.md`](./WP1.5-FINAL-CLOSEOUT-IMPLEMENTATION-PLAN.md) | Historical REM-WP1.5 final-closeout work record | Use `evidence/phase1/wp1.5/task-evidence.json` for the recorded task result and `PHASE-1-CLOSURE-DECISIONS-AND-ACTIONS.md` for later candidate evidence requirements. |
| [`WP1.6-REMEDIATION-IMPLEMENTATION-PLAN.md`](./WP1.6-REMEDIATION-IMPLEMENTATION-PLAN.md) | REM-WP1.6 application composition/BDD | Full spec trace, graph-derived dependency gates, executable BDD selection, runtime security assertions, and candidate-bound closeout evidence. |
| [PHASE-1-REMEDIATION-PLAN.md](./PHASE-1-REMEDIATION-PLAN.md) | Phase 1 remediation (superseded history) | Original reviewed plan; retained for change history |

## Founder rulings applied (O-18 to O-21)

| Item | Ruling | Where reflected |
|---|---|---|
| O-18 | Default release trigger: `registered_current` (Act s.20(2)) | Phase 0 WP-0.4.4; `precedence_policies` seed |
| O-19 | Public register inspection on payment of prescribed fee | Phase 0 WP-0.5.3; Phase 1 WP-1.7.4; PRV-006/PRV-010 |
| O-20 | Full Act read (ss.1–60(3)(a), 74–85, Schedules); 11-digit coop registration number | Phase 0 WP-0.4.5 (`registration_number` pattern); Act seeds `text_checked` |
| O-21 | No minors by default (`allow_minor_members = false`) | Phase 0 WP-0.5.2; `membership_rules` seed |
| O-22 | Still open — missing Act pages 244–247 | Recorded in `02-decision-register.md` |

## How task completion works

Current remediation tasks close through a task record validated against `evidence/phase1/task-evidence.schema.json`, passing predecessor records in `evidence/phase1/task-dependencies.yml`, and retained command output/evidence artifacts. Each record binds behavior, exercised path, environment, commands, results, limitations and reviewer. A task cannot pass while a required sub-gate is pending; REM-WP1.2 specifically requires both WP1.2-A and WP1.2-B. The current validator enforces the REM-WP0 closure records, graph structure and task-ID registry; task owners must preserve the exact command, exit code, test counts and artifact paths for downstream REM-WP1+ acceptance.

Checkboxes remain only in legacy Phase 0/Phase 1 implementation documents that still use them. In those documents, `[ ]` means not started and `[x]` means the legacy checklist item was marked done; a checkbox is not a current remediation completion record or evidence of a passing gate.

Gate checks at the bottom of each phase document must ALL be ✅ before the next phase begins.

For independent review, start at [`../../docs/phase1/INDEPENDENT_REVIEW_GUIDE.md`](../../docs/phase1/INDEPENDENT_REVIEW_GUIDE.md) and [`../../evidence/phase1/review-document-index.json`](../../evidence/phase1/review-document-index.json). The index resolves the current source/evidence set and identifies unavailable historical raw output explicitly.

