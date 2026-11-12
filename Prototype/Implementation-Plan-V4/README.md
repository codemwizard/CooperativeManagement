# Symphony Implementation Plan V4 — Specification, Behaviour and Test Pack

**Status:** Draft v2 (round 2 rulings incorporated) · **Date:** 3 November 2026 · **Supersedes:** `THREE_WEEK_BUILD_PLAN.md` (revision 2) for all scope beyond the demo sprint.
**Inputs:** Cooperative Onboarding, Governance and Compliance Requirements Specification · Domain Transition Pack v0.1.0 · UI/UX Redesign Proposal · founder decisions of 3 November 2026 · prototype source as read on 3 November 2026.

## 1. What this pack is

V4 turns Symphony from a static, browser-state demo into a database-driven product, starting with **the cooperative process** (enrolment, identity, by-laws, governance, meetings, evidence, internal verification). Operational and ESG/evidence-quality metrics are specified as modules that plug into the same model later, so they never force a redesign.

The pack is written for **Spec-Driven Development (SDD), Behaviour-Driven Development (BDD) and Test-Driven Development (TDD)** working as one loop:

```
 SPEC (what must be true)            03-specification-delta.md  (REQ-xxx, ADR-xxx)
   │  every REQ has ≥1 scenario
   ▼
 BEHAVIOUR (examples, Gherkin)       features/*.feature          (BDD-xxx, tagged to REQ/INV/SC)
   │  every scenario is executable
   ▼
 TESTS (red → green → refactor)      05-tdd-strategy.md          (unit, policy-table, command, DB, BDD, UI)
   │  code exists only to turn a named test green
   ▼
 CODE + MIGRATIONS                   04-architecture.md, 06-phased-plan.md (WP-x.y)
   │
   └── traceability gate (`npm run verify:trace`) fails the build if any REQ, scenario or WP is orphaned
```

## 2. Reading order

| # | File | Purpose |
|---|---|---|
| 01 | `01-current-state-and-readiness-gap.md` | What the project has, what the upgrade requires, and what must exist before Phase 1 starts |
| 02 | `02-decision-register.md` | Founder decisions as ADRs, how each was applied, **plain-language answers to the questions you asked me to explain**, and **conflicts that need your ruling** |
| 03 | `03-specification-delta.md` | The specification (SDD): glossary, roles and capacities incl. the **Internal Field Verifier**, enrolment, precedence, privacy, invariant classes, REQ catalogue |
| 03b | `03b-evidence-standing-model.md` | **Evidence states by role, pipeline stage and organisation relationship**: claim, record and issued-document tracks, Duty Matrix, audience standing |
| 04 | `04-architecture.md` | Target architecture, repo layout, persistence, authorisation, privacy engineering, offline-tolerant commands, migration approach |
| 05 | `05-tdd-strategy.md` | Test pyramid, red-green workflow, harnesses, traceability gate, Definition of Done |
| 06 | `06-phased-plan.md` | Phases, work packages, exit gates, legacy parity ledger |
| 07 | `07-extension-framework.md` | How operational and ESG/evidence-quality modules are developed later without redesign |
| 08 | `08-eqs-and-esg-index-preservation.md` | Record of how the ESG Index and EQS work today and where they are heading |
| 09 | `09-ui-ux-implementation.md` | How the UI/UX redesign proposal is adopted: routes, status vocabulary, components, gates |
| — | `traceability-matrix.md` | REQ → scenario → invariant/SC → legacy test → phase |
| — | `features/*.feature` | 10 Gherkin feature files (about 180 scenarios) |

## 3. Authority and freeze status

Under the founder's authority to unfreeze (3 November 2026), **every earlier freeze is lifted by ADR-001**: the V3 architecture freeze, the R25/R33 engine-type freeze and the Week-3 re-freeze. What stays in force is listed in ADR-001 (honesty rules, no real lender names, personal-data boundary R29, and the invariants classed HARD in `03`).

## 4. Identifier scheme

`REQ-<AREA>-nnn` requirement · `BDD-<AREA>-nnn` scenario · `ADR-nnn` decision · `INV-nnn` / `SC-nnn` from the Domain Transition Pack · `WP-p.n` work package · `CAP-nnn` platform capability · `FND-nnn` validation-finding rule. Areas: `ENR` enrolment, `ID` identity, `PRV` privacy, `BYL` by-laws/requirements, `GOV` governance, `MTG` meetings/resolutions, `EVD` evidence, `VER` internal verifier, `AUD` audit trail/commands, `UXW` workspace, `EXT` extension, `UNI` union/TA scope.

## 5. How to start

1. Read `02` §6.7 (the 1998 Act checked against the pack) and answer O-18 to O-21; the most important is O-18, because the Act says a by-law amendment takes effect only once registered.
2. Review `03b` §3–§4: the claim-entry table and Duty Matrix are my proposals from your examples.
3. Phase 0 (`06`) can then begin; it contains no feature code.

## 6. What I did not verify

I did not run the legacy test suites, read `cases.json`, `eqs.ts`, `esg.ts`, `capture.tsx`, `CreateAccountJourney.tsx` or the PFI/VVB/NABII journeys, or confirm that Docker/PostgreSQL exist on the build machine. The legal statements in the founder's notes are **not** verified law (see `02` §6, C7: the PDF supplied first was the repealed 1970 Act, Cap. 397). I have since read sections 1–41 of the 1998 Act (uploaded) and SI 26 of 1999 (`02` §6.7); sections 42–85 and the Schedule are missing (O-20). Nothing is legally validated. The by-law file in the pack is used for guidance only, as instructed; fixtures are synthetic.
