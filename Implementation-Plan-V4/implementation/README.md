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
| [`PHASE-1-REMEDIATION-PLAN-v2.md`](./PHASE-1-REMEDIATION-PLAN-v2.md) | Current Phase 1 remediation plan (v2.1.11 WP1.5 implementation; based on the v2.1 execution baseline and reviewed amendments) | WP1.5 closed on candidate `d7fbf5851b11b07b65bde36f062db7b21f487947`; SHA-pinned CI run, 58-test actual-role DB suite, BDD, role finalizer, and migration evidence are recorded. Other Phase 1 work remains open. |
| [`WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md`](./WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md) | WP1.5 CI repair and closeout execution plan | WP1.5 closed on CI run `43683206104`; candidate evidence and checksums are under `evidence/phase1/wp1.5/ci/d7fbf5851b11b07b65bde36f062db7b21f487947/`. WP1.6 remains separately gated by every dependency in the graph. |
| [`PHASE-1-REMEDIATION-PLAN.md`](./PHASE-1-REMEDIATION-PLAN.md) | Phase 1 remediation (superseded history) | Original reviewed plan; retained for change history |

## Founder rulings applied (O-18 to O-21)

| Item | Ruling | Where reflected |
|---|---|---|
| O-18 | Default release trigger: `registered_current` (Act s.20(2)) | Phase 0 WP-0.4.4; `precedence_policies` seed |
| O-19 | Public register inspection on payment of prescribed fee | Phase 0 WP-0.5.3; Phase 1 WP-1.7.4; PRV-006/PRV-010 |
| O-20 | Full Act read (ss.1–60(3)(a), 74–85, Schedules); 11-digit coop registration number | Phase 0 WP-0.4.5 (`registration_number` pattern); Act seeds `text_checked` |
| O-21 | No minors by default (`allow_minor_members = false`) | Phase 0 WP-0.5.2; `membership_rules` seed |
| O-22 | Still open — missing Act pages 244–247 | Recorded in `02-decision-register.md` |

## How task completion works

Current remediation tasks close through a task record validated against `evidence/phase1/task-evidence.schema.json`, passing predecessor records in `evidence/phase1/task-dependencies.yml`, and retained command output/evidence artifacts. Each record binds behavior, exercised path, environment, commands, results, limitations and reviewer. A task cannot pass while a required sub-gate is pending; WP1.2 specifically requires both WP1.2-A and WP1.2-B. The current validator enforces the WP0 closure records and graph structure; task owners must preserve the exact command, exit code, test counts and artifact paths for downstream WP1+ acceptance.

Checkboxes remain only in legacy Phase 0/Phase 1 implementation documents that still use them. In those documents, `[ ]` means not started and `[x]` means the legacy checklist item was marked done; a checkbox is not a current remediation completion record or evidence of a passing gate.

Gate checks at the bottom of each phase document must ALL be ✅ before the next phase begins.

For independent review, start at [`../../docs/phase1/INDEPENDENT_REVIEW_GUIDE.md`](../../docs/phase1/INDEPENDENT_REVIEW_GUIDE.md) and [`../../evidence/phase1/review-document-index.json`](../../evidence/phase1/review-document-index.json). The index resolves the current source/evidence set and identifies unavailable historical raw output explicitly.

