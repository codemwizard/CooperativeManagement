# Phase 1 Remediation Roadmap from REM-WP1.6

**Status:** Corrected execution sequence and ownership boundary  
**Authority:** This document resolves the sequencing conflicts between `06-phased-plan.md`, `remediation/Prototype_V4_Phase0_Phase1_Review_and_Remediation_Plan.md`, `PHASE-1-REMEDIATION-PLAN-v2.md`, the task dependency graph, and the REM-WP1.6 implementation plan. It does not change the product requirements or claim any task complete.

## 1. Roadmap interpretation

`06-phased-plan.md` defines product landmarks (the original project Phases 0–10). The remediation plan defines engineering work packages `REM-WP0`–`REM-WP8` that repair the Phase 1 implementation and prove it. These are different numbering systems. A later-numbered remediation workstream may be scheduled before `REM-WP1.6` when its output is a genuine technical prerequisite. Conversely, a work package must not be made a predecessor merely because another task mentions it.

The original Phase 1 landmark is the kernel, identity, default roles/capacities, privacy controls, and shell gate. Phase 2 is the cooperative enrolment/evidence walking skeleton. The original Phase 6 landmark is validation runs, findings, and next actions. These product milestones are not interchangeable with remediation workstream labels such as REM-WP5 (authentication) or REM-WP6 (workspace).

The same unqualified WP numbers were also reused for different deliverables, which caused a second source of ambiguity. Canonical IDs are defined in [`task-id-registry.json`](../task-id-registry.json): original product tasks use `IMP-Px-WPy.z`; remediation tasks use `REM-WPy.z`. The executable graph contains only remediation nodes, each with its plan ID, title, and source document.

| Identifier | Original `06-phased-plan.md` meaning | Current remediation-plan meaning |
|---|---|---|
| IMP-P1-WP1.6 | Authorization engine, default role/position/capacity catalogue, capacity grants and delegations | REM-WP1.6: API application composition, `POST /commands`, product-path BDD |
| IMP-P1-WP1.7 | PII vault, local KeyProvider, blind index, consent, masking and retention table | REM-WP1.7: current-authority authorization of persisted reconciliation-inbox operations |

Do not infer a remediation task's goal from the identically numbered original milestone. Use the canonical ID, title and source in the registry and the current graph for `REM-WP0`–`REM-WP8` execution.

The review/remediation source requires the kernel and authority guarantees to be true on PostgreSQL and in the actual application path before Phase 1 can close. It does not require implementing later Phase 2 or Phase 6 product capabilities as a condition of REM-WP1.6.

## 2. Corrected sequence after REM-WP1.5

Complete each item only when its own task record and candidate-bound evidence pass. Independent work may proceed in parallel only where the dependency graph allows it.

### 2.1 Work schedulable from the current closed records

The passing records through REM-WP1.5 make the following work eligible to be scheduled now. “Eligible” means all graph predecessors have passing records; it does not mean the work has started or completed.

| Scheduling order | Work package(s) | Why it is schedulable now | Next dependency consequence |
|---:|---|---|---|
| First planned specification and policy-matrix freeze | REM-WP2.1 default-deny policy matrix | Its sole predecessor, REM-WP0.4, is closed. | Do not change production policy code until the action/actor matrix and completeness check are approved. REM-WP2.2 follows after REM-WP2.1 passes. |
| May start in parallel now | REM-WP5.1 authentication API contract and server composition | Its graph predecessors REM-WP0.9, REM-WP0.10, REM-WP0.11 and REM-WP1.1 are closed. | REM-WP5.2 follows REM-WP5.1 and REM-WP1.2. Neither task waits for REM-WP2.2. |
| May proceed in parallel by their own predecessors | REM-WP3.1 audience serialization; REM-WP3.2 identifier vault; REM-WP3.3 consent/retention; REM-WP4.1 purge target guard; REM-WP6.1 workspace shell; REM-WP7.1 CI gate command contract | Their graph predecessors are among the closed REM-WP0 and REM-WP1.1–REM-WP1.5 records. | Each enables its own downstream work only after its task record passes. |
| Already completed | REM-WP3.6 generic field encryption | Its candidate-bound task record passes. | Satisfies the encryption prerequisite of REM-WP1.4 and REM-WP3.2. |

Then follow the graph: complete REM-WP2.2 after REM-WP1.1, REM-WP1.2, REM-WP1.5 and REM-WP2.1 pass; complete REM-WP5.2 after REM-WP5.1 and REM-WP1.2; complete REM-WP5.3 after REM-WP0.10 and REM-WP5.2. REM-WP5.3 derives account and tenant from the authenticated session and does not wait for cooperative authority loading in REM-WP2.2. REM-WP1.6 is scheduled only after its seven direct predecessors and its explicit API contract dispositions are satisfied. REM-WP1.7 may proceed after REM-WP1.4, REM-WP1.5 and REM-WP2.2 pass; it is not a REM-WP1.6 predecessor. These are scheduled work packages; their task records are created when their implementation and gates are actually completed.

### 2.2 Readiness of the next implementation plan

`REM-WP2.1` is the next planned implementation task, but its existing row and WP2 workstream text are not yet a complete, frozen implementation specification. They describe the intended default-deny behavior and TDD approach, while deferring the decisive action/actor matrix to a fixture that has not yet been completed. The current `policy-table.fixture.json` is illustrative coverage, not the required exhaustive approved matrix; `policy-engine.ts` still accepts arbitrary action strings and falls through to `allow`.

Before changing production policy code, prepare and approve the bounded `REM-WP2.1` task specification with: (1) the complete canonical Phase 1 policy action IDs and target/resource types, traced to command/API contracts and BDD requirements; (2) an explicit decision row for every applicable action and actor class from the approved platform-role, position, capacity, delegation and institutional-role catalogues; (3) expected decision and source for tenant/scope, appointment/capacity/delegation effective-time boundaries, revocation and read-only precedence cases; (4) an explicit rule that unknown, malformed or untrusted action/authority input denies; (5) a fixture-completeness assertion that fails for any omitted required cell; and (6) the exact red test command/output to retain before implementation, followed by the green focused suite and typecheck. Person-identity conflict is carried to original Phase 2 Feature 05 unless a named Phase 1 action and normative source establish that it is required in Phase 1. Keep persistence, race serialization and product-path BDD assigned to their graph owners (`REM-WP2.2`–`REM-WP2.5`); the `REM-WP2.1` gate is the pure policy decision boundary. Until this specification and fixture are frozen, `REM-WP2.1` is next to schedule for specification work, not ready for production-code implementation.

| Sequence | Work | Entry condition | Why this order is correct |
|---:|---|---|---|
| 1 | REM-WP2.1 default-deny policy specification and matrix freeze | REM-WP0.4 | Specification work first; no production policy-code change until the canonical matrix and completeness verifier are approved. |
| 2 | REM-WP2.2 persisted trusted cooperative authority loading | REM-WP1.1, REM-WP1.2, REM-WP1.5, REM-WP2.1 | Supplies trusted account/tenant/organization and cooperative authority to protected commands. Person linkage is included only if the frozen Phase 1 action catalogue requires it. It is a prerequisite of REM-WP1.6 and REM-WP1.7, not of authentication-only password change. |
| 3 (parallel workstreams) | REM-WP5.1 authentication API/server composition; REM-WP5.2 persisted credentials after REM-WP5.1; REM-WP2.3–REM-WP2.5 after their graph predecessors | Their graph predecessors | REM-WP5.1 and REM-WP5.2 do not wait for REM-WP2.2. REM-WP2.5 waits for REM-WP1.6 because BDD-AUD-014 requires the actual `POST /commands` path. |
| 4 | REM-WP5.3 persisted sessions and forced-change authorization | REM-WP0.10, REM-WP5.2 | Uses authenticated account/tenant from the persisted session. No cooperative authority dependency is required. |
| 5 | REM-WP1.6 command API composition and owned BDD | REM-WP1.1–REM-WP1.5, REM-WP2.2, REM-WP5.3; plus approved `occurredAt` and API response-contract dispositions | Now the endpoint can be exercised through real persisted sessions, trusted authority, PostgreSQL, the restricted application role, and the accepted command transaction. The seven graph predecessors are necessary but not sufficient: close the explicit pre-implementation API-contract decisions in the REM-WP1.6 plan before implementing affected request behavior. D-13 is not a technical start dependency, but remains a BDD and Phase 1 closeout blocker. |
| Parallel after REM-WP1.4, REM-WP1.5 and REM-WP2.2 | REM-WP1.7 reconciliation-inbox authorization | REM-WP1.4, REM-WP1.5, REM-WP2.2 | It may proceed independently of REM-WP1.6. It consumes persisted inbox records and current authority, but is not needed to accept/record a command at `POST /commands`; no inbox read/takeover endpoint is part of REM-WP1.6. |
| Parallel by own predecessors | REM-WP3.1–REM-WP3.6, REM-WP4.1–REM-WP4.3, REM-WP5.4–REM-WP5.5, REM-WP6.1–REM-WP6.3 and REM-WP7.1 | Their graph predecessors | These finish privacy, purge, browser auth, workspace and CI setup. Do not serialize them behind REM-WP1.6 unless a real graph edge requires it. |
| 6 | REM-WP7.2 integrated Phase 1 CI gate | REM-WP1.6, REM-WP1.7, REM-WP2.5, REM-WP3.5, REM-WP4.3, REM-WP5.5, REM-WP6.3, REM-WP7.1 | Runs the complete 41-scenario Phase 1 acceptance gate on one exact candidate, including inbox authorization. BDD-AUD-016 is excluded by D-13 Option A and remains assigned to original Phase 6 WP6.2. |
| 7 | REM-WP8 independent Phase 1 closure review | REM-WP0.13 and REM-WP7.2 | Independent reviewer checks retained evidence for the exact integrated candidate. Only then is the Phase 1 remediation gate closed and the original Phase 2 landmark eligible to start. |

This sequence is a topological schedule, not a requirement that every numbered task be run serially. REM-WP5.1–REM-WP5.3 and REM-WP2.1–REM-WP2.4 can advance independently where their graph edges permit. REM-WP1.6 requires both the persisted cooperative authority from REM-WP2.2 and the authenticated session boundary from REM-WP5.3. REM-WP5.3 itself does not depend on REM-WP2.2. REM-WP1.7 may proceed after REM-WP1.4, REM-WP1.5 and REM-WP2.2 pass; the command submission endpoint does not perform inbox authorization or expose inbox operations. REM-WP7.2 waits for both REM-WP1.6 and REM-WP1.7.

## 3. REM-WP1.6 boundary and predecessor decision

REM-WP1.6 has **seven** direct predecessors: REM-WP1.1, REM-WP1.2, REM-WP1.3, REM-WP1.4, REM-WP1.5, REM-WP2.2, and REM-WP5.3. The dependency graph must be the sole source for the executable start gate.

- Keep REM-WP1.4 as a predecessor because a stale accepted command must return the already-persisted safe terminal result and opaque reconciliation reference.
- Keep REM-WP1.5 because the route must execute through the restricted app role and actual tenant RLS boundary.
- Keep REM-WP2.2 and REM-WP5.3 because removing either would force an untrusted/caller-supplied principal or a session bypass in the real API test.
- Remove REM-WP1.7 as a predecessor. REM-WP1.6 may return the safe conflict receipt/reference produced by REM-WP1.4, but must not read, mutate, resolve, supersede, or authorize access to the inbox. Those operations belong solely to REM-WP1.7.

REM-WP1.6's own BDD scope is limited to the product capabilities and scenarios assigned to it by the Phase 1 owner map. D-13 is resolved by the owner on 2026-11-17: Option A preserves the original product roadmap and assigns `BDD-AUD-016` to original Phase 6 WP6.2. The Phase 1 manifest v2 contains 41 scenarios; the Phase 1 owner map no longer assigns BDD-AUD-016, and `evidence/phase6/` retains its separate manifest and owner path. The scenario remains tagged `@phase6`, keeps REQ-AUD-007/INV-017 traceability, and is not deleted, stubbed, or claimed passed. The Phase 1 runner is manifest-driven and excludes `@phase6`; the original Phase 6 gate will execute the Phase 6 manifest through the real validation-run and rule-update path when IMP-P6-WP6.2 is implemented.

## 4. Later product landmarks and carry-forward

After Phase 1 closure, the original roadmap resumes in landmark order. These are not prerequisites of REM-WP1.6:

1. **Original Phase 2:** cooperative enrolment, certificate/activation, evidence core, `computeStanding`, IFV workflow, and their workspace screens. Bring forward only accepted kernel, tenancy, authority, privacy, and API contracts; implement Phase 2 product capabilities here.
2. **Original Phase 3:** by-law versions, legal catalogue, precedence, requirement definitions and dimensions. Keep legal entries advisory/configurable until the recorded legal validation gate is satisfied.
3. **Original Phase 4:** governance profiles, appointments, positions, committees and history.
4. **Original Phase 5:** meetings, minutes duty process, quorum snapshots, resolutions and action items.
5. **Original Phase 6:** validation runs with immutable rule-version snapshots, findings, next-action ranking, audit/education/annual-return records and requirement projections. `IMP-P6-WP6.2` owns BDD-AUD-016; execute it from `evidence/phase6/bdd-scenarios.json` against the real validation and rule-update product paths. This follows the owner-approved D-13 Option A ruling and does not add validation-run work to Phase 1.
6. **Original Phases 7–10:** extension/EQS preservation, legacy parity/retirement, hardening/offline/deployment, then guided journeys after workspace stability.

Any Phase 0 carry-forward remains bound to its owner: actual candidate evidence and runtime versions, approved contract and traceability baseline, role/RLS proof, command atomicity/replay, authority serialization, runtime-profile enforcement, and the no-mock product-path rules. Do not re-run a passed task merely because a later aggregate gate is run; re-run only when candidate changes invalidate its evidence or the task contract requires it.

## 5. Closure rule

REM-WP1.6 passing is not Phase 1 closure. Phase 1 closes only after its 41-scenario manifest and all other integrated remediation gates pass, REM-WP7.2 retains exact-candidate CI evidence, and REM-WP8 independently reviews that evidence. BDD-AUD-016 is not a Phase 1 closure criterion; it remains required under original Phase 6 WP6.2. Original Phase 2 begins only after the Phase 1 closure decision. No Phase 2–6 capability is to be pulled into REM-WP1.6 merely to make the old feature grouping appear complete.
