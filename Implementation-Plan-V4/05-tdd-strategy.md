# 05 — TDD and BDD Strategy

Specification (`03`, `03b`) → scenarios (`features/`) → failing tests → code. Nothing is implemented without a failing test that names a requirement.

## 1. The loop

1. **Pick a work package** (`06`). It lists REQ and scenario IDs.
2. **Enable its scenarios** (remove `@wip`). They fail because steps or code are missing.
3. **Write the lowest-level failing tests first** (policy tables, domain functions), then command tests, then repository/DB tests, then let the BDD steps bind to the API facade.
4. **Make it pass with the least code**, then refactor with the suite green.
5. **Gate:** `npm run verify:v4` (lint, types, architecture, unit, policy, command, DB, BDD, trace, a11y) green and the legacy `verify:all` still green.
6. **Merge only when the traceability gate passes.**

Rules: no production code without a failing test; no weakened test to make a build pass (change tests only by changing the spec first, with an ADR note); every bug gets a regression test before the fix.

## 2. Test pyramid

| Level | Scope | Tooling | Speed | Examples |
|---|---|---|---|---|
| L0 Static | Types, lint, architecture rules | `tsc`, ESLint, dependency-cruiser | seconds | `domain` imports nothing outside itself; `workspace` never imports `pg` |
| L1 Domain unit | Pure functions, state machines, `computeStanding`, precedence, combination rules | Vitest, fast-check | ms | Standing never rises without a version-naming event |
| L2 Policy tables | Spec tables executed row by row | Vitest `test.each` from JSON fixtures generated from `03b` tables | ms | Every Duty Matrix row; every audience label cell |
| L3 Command tests | Application services with in-memory repositories | Vitest + `testkit` | ms | Idempotency, concurrency, atomic rollback, authorisation decisions |
| L4 Repository contract | Same suite against in-memory and PostgreSQL | Vitest + Testcontainers | seconds | Immutability triggers, composite FKs, partial unique indexes, exclusion constraint toggle |
| L5 BDD | Gherkin scenarios through the API facade | Cucumber.js | seconds | All `features/*.feature` |
| L6 API/e2e | HTTP, auth, masking, sessions | Supertest/Playwright API | seconds | PII absent from union responses |
| L7 UI | Persona flows, keyboard path, a11y | Playwright + axe | tens of seconds | `@ui` scenarios, contrast, snake_case scan |
| L8 Non-functional | Concurrency, migration, privacy, purge | Vitest + scripts | varies | Parallel commands, up-migration on a populated DB, log scrubber, purge-to-seed |

Target: L0–L3 under 60 seconds on a laptop; L4–L5 under five minutes in CI.

## 3. Tagging and traceability

Every scenario carries tags: `@REQ-…` (one or more), `@BDD-AREA-nnn`, `@phase<n>`, class tags `@hard` / `@policy` / `@gate`, optional `@INV-nnn` / `@SC-nnn`, `@advisory` / `@blocking` for dual-mode scenarios, `@ui`, `@wip`.

`npm run verify:trace` fails when: a REQ in `03`/`03b` has no scenario; a scenario references an unknown REQ; a `@hard` invariant has no scenario; a scenario has no step definition (and is not `@wip`); a work package lists IDs that do not exist. The matrix in `traceability-matrix.md` is generated, not hand-maintained, once the tool exists (WP-0.7).

## 4. Dual-mode (advisory vs blocking) testing

Every POLICY scenario has an `@advisory` variant (default: record, label, raise finding) and a `@blocking` variant (reject the transition). Step definitions set `SetEnforcementMode` before the action. HARD scenarios run once and must be identical in both modes.

## 5. Fixtures and builders

`testkit` provides builders, not shared mutable fixtures: `aCooperative()`, `aSelfEnroller()`, `anEnroller().withSession()`, `aChairperson()`, `aSecretary()`, `aTreasurer()`, `anInternalVerifier()`, `aFieldAgent()`, `aMember()`, `anEvidenceVersion()`, `aMeeting()`, `aByLawWithClauses()`. Time and ids are injected (`FakeClock`, `SequentialIds`). Fixtures use **synthetic** by-laws shaped like the illustrative example (clause structure, quorum fractions, notice periods), not its text, and synthetic NRC-like values from the reserved range. Real documents never enter tests.

## 6. Replacing the Python oracle

The pack's Python oracle stays as a historical reference only. SC-001…SC-020 are re-expressed as BDD scenarios against real code (`traceability-matrix.md`, SC rows). A thin CI job still runs the Python oracle to keep the original expectations visible, but it gates nothing.

## 7. Legacy suites during transition

| Suite | Status |
|---|---|
| Legacy Vitest (159) and Playwright (31), `verify:all`, bundle check, help check | Required CI job until legacy retirement (Phase 8 exit + parity). Baseline recorded in WP-0.6 |
| 30 expected results | Re-run in the new stack in Phase 8 through the level projection; must match exactly |
| Legacy invariants (promotion, version mismatch, dispute, conflict, read-only) | Each is mapped to a V4 scenario in the matrix; the V4 scenario must exist before the legacy test is retired |
| Legacy defects (`01` §4) | Each has a V4 regression scenario asserting the correct behaviour |

## 8. Privacy and security tests

- Response snapshots per role assert no identifier pattern for union/TA/institution/member-of-other-organisation.
- Log and event scrubber test fails on NRC-shaped strings.
- Blind-index test: duplicate detected without decrypting; different pepper yields different index.
- Crypto-shred test: after shredding, the person is unreadable and transaction facts remain under the pseudonymous id.
- Temp-credential tests: single use, expiry, forced change, no credential in logs.
- Test-mode guard: non-synthetic identifier rejected; `DATA_MODE=real` refuses to start outside an approved region.
- Purge-to-seed: all tenant data gone, seed set intact, purge audit written.

## 9. Coverage and quality gates

- `domain`: ≥ 90% branch coverage; mutation testing (Stryker) on `computeStanding`, precedence and authorisation modules, score ≥ 80%.
- Property tests: standing monotonicity, version reset, idempotency under replay, event ordering.
- Every migration has an up test on an empty and a seeded database.
- UI: axe violations 0; contrast test on all token pairs; snake_case/banned-phrase/score scans.

## 10. Definition of Ready and Done (per work package)

**Ready:** REQ and scenario IDs listed; spec sections unambiguous (open items resolved or defaulted); fixtures identified; dependencies done.
**Done:** all listed scenarios pass in both modes where applicable; unit/policy/contract tests added; migrations tested; docs updated (spec, ADR, glossary if terms changed); capability registry entry updated; trace gate green; legacy `verify:all` green; no `@wip` left on the package's scenarios; changelog line written.

## 11. Scripts (to be created in Phase 0)

`test:unit`, `test:policy`, `test:command`, `test:db`, `test:bdd`, `test:api`, `test:ui`, `test:nonfunctional`, `verify:trace`, `verify:arch`, `verify:v4` (all of the above), `purge:seed`, `db:migrate`, `db:seed`.
