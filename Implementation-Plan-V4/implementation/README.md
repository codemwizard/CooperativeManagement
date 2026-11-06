# Implementation Plans Index

**Location:** `Implementation-Plan-V4/implementation/`  
**Authority:** `Implementation-Plan-V4/06-phased-plan.md`

---

## Reading order and dependencies

```
Phase 0 Gate must pass before Phase 1 starts.
Phase 1 Gate must pass before Phase 2 starts.
```

## Plans in this directory

| File | Phase | Gate summary |
|---|---|---|
| [`PHASE-0-IMPLEMENTATION.md`](./PHASE-0-IMPLEMENTATION.md) | 0 — Decide, prepare, baseline | CI green; baseline recorded; ADRs ratified; no feature code |
| [`PHASE-0-REMEDIATION-IMPLEMENTATION.md`](./PHASE-0-REMEDIATION-IMPLEMENTATION.md) | Phase 0 remediation | Bounded P0-01–P0-05 foundation repair; fixed Phase 0 closure gate; Phase 1 work excluded |
| [`PHASE-1-IMPLEMENTATION.md`](./PHASE-1-IMPLEMENTATION.md) | 1 — Kernel, identity, authorisation, privacy, shell | BDD features 09/02/05/10 enabled; PII protected; legacy still green |

## Founder rulings applied (O-18 to O-21)

| Item | Ruling | Where reflected |
|---|---|---|
| O-18 | Default release trigger: `registered_current` (Act s.20(2)) | Phase 0 WP-0.4.4; `precedence_policies` seed |
| O-19 | Public register inspection on payment of prescribed fee | Phase 0 WP-0.5.3; Phase 1 WP-1.7.4; PRV-006/PRV-010 |
| O-20 | Full Act read (ss.1–60(3)(a), 74–85, Schedules); 11-digit coop registration number | Phase 0 WP-0.4.5 (`registration_number` pattern); Act seeds `text_checked` |
| O-21 | No minors by default (`allow_minor_members = false`) | Phase 0 WP-0.5.2; `membership_rules` seed |
| O-22 | Still open — missing Act pages 244–247 | Recorded in `02-decision-register.md` |

## How task completion works

Each task has a checkbox:
- `[ ]` = not started
- `[x]` = completed and verified

**Check the box when the task is done**, not at the end of the phase. Each task names the exact test command to run. An independent verifier can re-run any named command to confirm the same result.

Gate checks at the bottom of each phase document must ALL be ✅ before the next phase begins.

