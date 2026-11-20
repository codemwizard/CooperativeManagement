# REM-WP6.1 verified evidence display projection

**State (owner ruling D-18, 2026-11-19): display policy approved; bounded implementation and positive live path implemented; Cucumber and negative UI evidence remain.** This is a bounded read-only projection contract for BDD-UXW-004. The owner approved a closed result vocabulary and immutable finding-time official attribution. Migrations 0017–0018, the API projection, and the served Evidence Register now implement the positive path. Exact-candidate Cucumber execution and negative UI fixtures remain outstanding.

## Required persisted relationship

The projection must read a single coherent chain:

1. `verification_assignments` identifies the `evidence_item_id`, `assigned_to_user_id`, and exact `evidence_version_id`.
2. `verification_findings` must match both that assignment ID and exact evidence version ID through the existing composite relationship.
3. `evidence_versions.version_number` supplies the displayed version.
4. `evidence_items.organization_id` and the organization/tenant relationship constrain the row to the currently authorized context.
5. `verification_findings.scope` supplies the displayed scope only when present and approved for display.
6. `verification_findings.assurance_class` supplies a value that must pass an explicit allowlist mapping before presentation.
7. `verification_assignments.completed_at` and the typed verification outcome must satisfy D-18: exact `supports_claim` qualifies for positive verified presentation; exact `does_not_support_claim` and `inconclusive` are non-positive outcomes. Unknown or legacy values fail closed. Completion or nonempty text alone is not proof of successful verification.

The query and API must be read-only, tenant-scoped with the runtime application role, and bound to current persisted session identity and the independently validated organization context. No component-local object or `presentEvidence('verified_internal')` result can stand in for these rows.

## Display identity and assurance mapping

- The verifier source begins at `verification_assignments.assigned_to_user_id`, resolved through the persisted account-person and appointment relationships. Persist an immutable snapshot with the approved public-facing name and office/title, verifier person reference, appointment reference, authoritative identity/appointment source, capture/effective time, and disclosure basis. Do not expose `userId`, login email, password/authentication details, or unrelated member records. Preserve the office and appointment that applied when the finding was made after that appointment ends.
- Show the snapshot to viewers authorized for the cooperative record. If that record is classified as public, allow public access to that record under its public-access and prescribed-fee policy. This does not make every society record public: Zambia Co-operative Societies Act 1998 ss.21 and 28(2) define specific public-inspection record classes; s.59(2) covers member/delegate inspection of society records and protects another member's account absent consent or special authorization. Do not expose member accounts, household data, or unrelated private records through the verifier attribution path. Record classification and fee workflow are outside the current workspace shell and require legal mapping before production release.
- Accepted `DECISIONS.md` ADR-010 / `03-specification-delta.md` IFV-4 defines `cooperative_internal`, and frozen BDD-UXW-004 requires the fixed display label `cooperative-internal`. WP6.1 can implement that exact one-entry allowlist mapping without a new decision. Do not display arbitrary `TEXT`, normalize casing/format variations, or expand the mapping to other classes without an accepted source. ADR-011's broader taxonomy is Proposed. `02-decision-register.md` D-11 is the approved runtime-profile decision, not an assurance-class decision.
- `scope` is nullable text. A missing, blank, or unapproved scope is incomplete provenance and cannot be displayed as verified.
- The exact version must be consistent across assignment and finding. A missing assignment, finding, verifier identity, organization, scope, approved successful result or known assurance mapping fails closed.

## Successful verification result (owner-approved D-18)

`completed_at` means the assigned work was completed; it does not mean the evidence claim was supported. `assurance_class` describes who/what assurance category performed the check; it is not the outcome. D-18 approves the closed vocabulary `supports_claim`, `does_not_support_claim`, and `inconclusive`. Only exact `supports_claim` may produce a positive verified chip, and only with a completed assignment, exact evidence-version match, required scope, immutable official attribution, and the exact accepted assurance class. The other two are completed non-positive findings; unknown and legacy values fail closed. Add a typed constrained outcome field or an explicitly approved migration for existing values; never translate legacy free text to `supports_claim` by guesswork.

## Fail-closed presentation

The server returns a verified-item projection only when every required relationship and display field is present, tenant-authorized and consistent, including an explicitly approved successful finding result for the exact completed assignment/version. Otherwise it returns a non-verified/incomplete state that cannot render the verified chip. The live route fixture seeds PostgreSQL rows through a controlled admin fixture, uses the actual app-role read endpoint, expands the served record, and asserts the displayed verifier, scope, exact version and allowlisted assurance class in rendered DOM. Negative UI fixtures for adverse, unknown, missing and incomplete findings remain outstanding.

The person/account link is implemented by WP2.2. Migrations 0017–0018 add the closed typed outcome, appointment-record public name field, and append-only finding-time attribution snapshot with RLS and source-consistency validation. Legacy findings remain NULL and fail closed. The live positive browser fixture and read-only API projection are implemented. The product finding-write path does not yet populate outcome and attribution atomically; the current route reads persisted records but does not create findings. The exact-candidate live Cucumber run and negative UI fixtures remain required before UXW-004 can pass. The owner selected the official appointment record as the public-name source. Legal/product work must classify which cooperative records are public and map statutory fields/fees before enabling public access. The narrow `cooperative_internal` mapping is already supported by accepted ADR-010/IFV-4 and the frozen BDD label; it is not an unresolved decision.
