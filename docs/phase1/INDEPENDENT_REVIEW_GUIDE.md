# Phase 1 independent review guide

**Process version:** `phase1-independent-review-v1`  
**Normative entry:** [`review-document-index.json`](../../evidence/phase1/review-document-index.json)  
**Purpose:** Enable a reviewer who did not implement the candidate to locate the full specification, trace each requirement to its contract/task/evidence, reproduce gate claims, and record a review that can be audited later.

## Independence standard

Independence is procedural: the reviewer uses a separate AI session or reviewer, starts from a clean checkout of the exact candidate commit, receives this guide and the document index rather than the implementer's conclusions, and inspects primary source documents, source changes, raw test output, database evidence and generated artifacts directly. The reviewer may use the same repository evidence as the implementer; the review is independent only if conclusions are formed separately from primary evidence. The reviewer records its own findings, citations (repository-relative path plus section/line or artifact selector), reproduction results, limitations and disposition. A session ID, verbal assurance, checklist tick or copied summary is not a review artifact.

The implementation agent must not write the reviewer conclusion, mark its own work independently reviewed, or present a review that shares the implementation context as independent. The reviewer may be an AI system as owner-authorized, but must be in a clean context without the implementation chat, patch rationale, or prewritten verdict. Supply the exact candidate SHA in a separate review request/packet together with the index; do not steer the reviewer with expected findings.

## Review procedure

1. Obtain the exact candidate SHA from a separate review request/packet supplied by the project owner or review coordinator. The SHA must not be embedded in the candidate's checked-in document index, because that would make the index self-referential. Check out the supplied SHA in a clean worktree; confirm it with `git rev-parse HEAD` and `git status --porcelain`, and record both outputs in the review record. If the packet SHA and checkout disagree, stop the review.
2. Read the index first. Follow `review_order`; do not substitute a later summary for a normative source. For every required path, confirm it exists at the candidate commit. If missing, mark it missing and explain the impact; never silently infer content from a reference.
3. From the clean candidate checkout, run `node tools/create_phase1_review_manifest.mjs <full-candidate-commit-sha>` using the exact SHA from the separate review packet. This refuses a wrong SHA or dirty tree, requires every indexed path to exist, and writes a new immutable SHA-256 manifest under `evidence/phase1/reviews/<candidate-short-sha>/`. Compare the generated path set and file hashes with the checked-in index and supplied packet. The index defines the canonical path set; hashes are candidate-specific because source files change across commits.
4. Inspect every `implementation_diff_files` entry in the generated manifest, including relevant surrounding code, tests, configuration and migrations. Trace requirement → canonical feature/scenario → specification/ADR → remediation-plan work package → contract → task/dependency/evidence record → implementation diff → raw verification output. Follow each cross-reference and report broken, circular, ambiguous or stale links.
5. Inspect raw artifacts, not only task `behavior_proved` text. For runtime claims, verify the actual command, candidate SHA, tool/service versions, database role/profile, test counts, skip/pending counts, exit code, and artifact content. Confirm tests execute through the path claimed (domain, PostgreSQL, API composition, or browser-to-API).
6. Reproduce the required document validators and relevant candidate checks from the index in a clean environment. Do not alter the candidate. Record every command, exit code, output artifact path, and any environmental limitation. A failed prerequisite or unavailable service is a finding, not a pass.
7. Compare plan, contracts, dependency graph, task manifest, BDD map, and evidence claims as one connected contract set. Verify each graph edge has a real prerequisite; check that no task claims completion based on a mock when its acceptance requires PostgreSQL/API/browser evidence.
8. Record each finding with severity, precise file/section, violated invariant, reproducible evidence, required correction, affected task/gate, and whether it blocks authorization or only a later runtime acceptance.
9. Save the signed/reviewer-attributed report under `evidence/phase1/reviews/` using `phase1-review-<candidate-short-sha>-<reviewer>-vN.md`. Include reviewer model/version, clean-context statement, candidate SHA, index hash, reviewed paths, commands and raw output links, findings, disposition, limitations, and whether the candidate meets the requested gate. Do not overwrite a prior report.
10. Update the review ledger in the index only in a separate follow-up commit; preserve the reviewed candidate SHA and report unchanged. A candidate with a changed source commit requires a new review or an explicitly scoped delta review against the new SHA.

## Required review packet contents

The checked-in index lists the normative source set and evidence set. Every review packet must additionally contain:

- Candidate commit SHA and clean-worktree record.
- Candidate-specific SHA-256 manifest for every indexed file.
- Complete CI/test output, including failed and skipped checks, or the exact artifact location and immutable run identifier.
- Phase 0 carry-forward evidence and the current Phase 1 task/dependency/BDD maps.
- The actual prior REM-WP0 independent review report at `docs/Independent-Review-Report-Phase-1_Remediation-Plan_v2.md`, its exact candidate SHA, owner disposition, and referenced primary evidence.
- The raw stdout for the historical `node tools/phase1-contracts.js` run. The current index marks it as not retained; `tasks.json` records only the command/result summary. Do not describe a new run on a different commit as the original output.
- The new independent review report and any follow-up disposition.

## No silent evidence substitution

If a referenced artifact is absent, report its exact index key and expected repository path. Do not replace it with a developer summary, session ID, screenshot of a status line, unpinned latest branch, or successful rerun on a different commit. Historical evidence remains historical; new candidate evidence must identify its own SHA. This rule applies equally to Phase 0 carry-forward items and Phase 1 runtime proof.
