# WP2.1 D-19 policy amendment status

Date: 2026-11-21

Decision D-19 in `Implementation-Plan-V4/02-decision-register.md` amends the policy boundary previously recorded under D-17. The current policy matrix is version 2 in `phase1-authorization-policy-matrix.json`: TA scope actions use one directly persisted cooperative target; generic capacity commands permit `internal_verifier`, `field_agent`, and sourced `delegate`; generic capacity commands cannot create or revoke `acting_officer`.

The original `task-evidence.json` and `policy-unit-tests.log` remain historical D-17 evidence. They are not evidence that the D-19 amendment was run on an immutable candidate and their cohort wording must not be used as the current implementation contract.

Current working-tree verification is recorded in `../wp2.3/wp2.1-matrix-verification.log`, `../wp2.3/domain-policy-command-tests.log`, and `../wp2.3/typecheck.log`. The amended matrix verifier and focused domain tests passed, but the worktree is uncommitted. No WP2.1 task record status or gate status has been changed; candidate-bound revalidation remains necessary before claiming D-19 matrix verification as an immutable predecessor artifact.
