1. migrations/0022_wp2_3_ta_semantic_identity.sql:R9

**Applied migration rewritten**

[ADR-022](DECISIONS.md) requires applied migrations to stay immutable. [The migration runner](packages/db/src/migrate.ts:80-88) skips recorded filenames, so existing databases rely on the separate repair.

2. migrations/0034_preserve_legacy_ta_semantic_identity.sql:R17-18

**Redundant TA index rebuild locks reads**

The repair rebuilds `ta_scope_active_semantic_key` even when its predicate already matches. The regular index drop blocks delegation reads until the rebuild commits.

3. packages/db/src/__tests__/migration-runner.integration.test.ts:R307-309

**Existing TA index upgrade untested**

The test runs the current TA identity migration before the repair. It never tests a recorded migration whose original index still includes legacy rows.

4. ‎evidence/phase1/wp2.5/verify-exact-candidate.mjs‎
Line 13
Diff line number	Diff line change
  assert.match(changed, /^evidence\/phase1\/wp2\.5\//, `post-candidate change is outside WP2.5 evidence: ${changed}`);
devin-ai-integration[bot] commented 4 minutes ago
@devin-ai-integration[bot]
devin-ai-integration[bot]
3m ago
🟡 Sibling evidence blocks closure verification

On the clean PR head, the WP2.5 verifier rejects WP5.4 evidence, and the WP5.4 verifier rejects WP5.5 evidence. Both recorded commands fail before checking their results, even though no implementation files changed after the candidate.

Learn more
All three work packages share implementation candidate 76bec16. The WP2.5 task record and WP5.4 task record give verifier commands that take the candidate SHA but derive the evidence commit from the current checkout. The retained final logs were produced on earlier partial evidence commits. The WP5.5 verifier already recognizes all three work packages as evidence-only follow-ups.

Example: Run the recorded commands on clean PR head 5d8b314. WP2.5 aborts on the WP5.4 API log, and WP5.4 aborts on the WP5.5 API log. Neither abort requires a change to the tested implementation.

Recommended fix: Apply the bounded three-package evidence allowlist consistently, or make the intended historical evidence checkout explicit and executable in each recorded rerun procedure. Keep the check that rejects changes to implementation and test sources

5. ‎evidence/phase1/wp2.5/task-evidence.json‎
Line 9
Diff line number	Diff line change
    "gate_verified": "passed"
devin-ai-integration[bot] commented 5 minutes ago
@devin-ai-integration[bot]
devin-ai-integration[bot]
4m ago
🟡 Premature authorization scope gate closure

The WP2.5 record sets gate_verified to passed without a passing WP1.6 task record. The scope audit checks WP1.6’s mapped HTTP scenarios, but skips its gate.

Learn more
The dependency graph lists WP1.6 as a direct predecessor of WP2.5. The Phase 1 execution rule requires a passing completion record for each predecessor. The exact-candidate verifier checks the mapped HTTP run and delegates to a scope audit, whose predecessor loop expressly skips WP1.6. The WP1.6 plan records mapped acceptance, not standalone closure.

Example: The six mapped WP1.6 scenario IDs pass under WP2.3, but there is no WP1.6 task record. WP2.5 still records a final gate pass.

Recommended fix: Keep WP2.5 pending until WP1.6 has its own passing candidate-bound task record. In the final verifier, check every direct predecessor from the graph, including WP1.6, while retaining the mapped HTTP run as separate behavior evidence.

6. evidence/phase1/wp2.5/verify-exact-candidate.mjs:12
**Closure replay needs historical checkouts**
The WP2.5 verifier rejects WP5.4 evidence at PR HEAD. The [WP5.4 verifier](evidence/phase1/wp5.4/verify-exact-candidate.mjs:12-14) likewise rejects WP5.5 evidence. The recorded passes name earlier evidence commits, but the task commands omit the required checkout.

---

evidence/phase1/wp2.5/verify-exact-candidate.mjs:37
**Mixed runs in authorization evidence**
The [scope audit](tools/verify_wp2_5_scope.mjs:109-127) still checks the November 21 dirty-worktree summary. The exact-candidate verifier checks the new summary but only verifies that the new Cucumber report exists.

---

Implementation-Plan-V4/implementation/WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md:3
**Conflicting work package gate statuses**
The current-status index lists WP2.5, WP5.4 and WP5.5 as pending. Their task records now list them as passed and name the immutable candidate.

## Bugs
1. evidence/phase1/wp2.5/verify-exact-candidate.mjs:R48-54

**Authorization gate skips mandatory predecessor**

The WP2.5 verifier accepts the WP1.6 HTTP test log without a passing WP1.6 gate record. [The scope audit](tools/verify_wp2_5_scope.mjs:143-158) skips that predecessor, so WP2.5 closes before its required command API gate.

The [dependency graph](evidence/phase1/task-dependencies.yml) lists WP1.6 as a direct WP2.5 predecessor. The retained HTTP run supplies mapped acceptance for WP1.6, but [the WP1.5 closeout note](Implementation-Plan-V4/implementation/WP1.5-CI-REMEDIATION-AND-CLOSEOUT-PLAN.md:3) explicitly distinguishes that run from a standalone WP1.6 gate record. The delegated [scope audit](tools/verify_wp2_5_scope.mjs:143-158) excludes WP1.6 from the checks for passing predecessor records and candidate ancestry. The [WP2.5 task record](evidence/phase1/wp2.5/task-evidence.json:4-11) now records a passed gate anyway.

**Example:** The six mapped WP1.6 scenarios pass through the HTTP API, but WP1.6 still has no passing closure record. WP2.5 reports a closed gate even though its graph predecessor has only scenario evidence.

**Recommended fix:** Keep WP2.5 pending until WP1.6 has a passing candidate-bound gate record. Make the exact-candidate verifier check the graph-defined predecessor records and ancestry, while retaining the HTTP run as a separate acceptance check.

2. evidence/phase1/wp5.5/task-evidence.json:R10

**Login regression gate closes early**

The WP5.5 record marks the gate passed without evidence for the three carried-forward Playwright login checks or `verify:trace`. The [remediation plan](Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md) requires both in addition to the tagged login scenario.

The [WP5.5 acceptance row](Implementation-Plan-V4/implementation/PHASE-1-REMEDIATION-PLAN-v2.md) requires tagged BDD, Playwright, and traceability verification. The [Phase 1 implementation plan](Implementation-Plan-V4/implementation/PHASE-1-IMPLEMENTATION.md) identifies the carried-forward browser failures as the three cases in [the login suite](tests/workspace/login.spec.ts). The [WP5.5 verifier](evidence/phase1/wp5.5/verify-exact-candidate.mjs:37-64) checks the retained focused scenario and the existence of listed artifacts, but does not require either of the missing results.

**Example:** The temporary-credential journey passes and structural validation passes. The verifier still records a closed gate without a passing browser result for all three carried-forward cases or a trace verification result.

**Recommended fix:** Keep WP5.5 pending until the candidate has passing trace output and Playwright evidence for all three carried-forward cases. Require both artifacts and their passing results in the exact-candidate verifier.

