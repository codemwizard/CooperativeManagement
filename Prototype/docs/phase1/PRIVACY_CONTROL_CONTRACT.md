# Phase 1 privacy and legal-assumption contract

**Contract:** `phase1-privacy-control-v1`  
**Status:** Engineering approach and legal-review approval assumed granted at user direction, 2026-11-07; requirement-to-entity/transition/BDD trace and implementation evidence remain pending.
**Authority:** ADR-014/015/016; `03-specification-delta.md` §§8, 13; PRV-001–011; decision register O-4/O-5/O-6/O-10; Phase 1 WP0.7 and WP3.3.

Technical minimization, encryption, masking, no-PII events/logs, audience boundaries and residency refusal are mandatory engineering controls. Per the user's explicit instruction, owner signatures and legal validation for the approved Phase 1 baseline are assumed granted as of 2026-11-07. This assumption is not independent verification of a legal source or a claim that implementation is compliant. Preserve `needs_legal_validation` on any legal interpretation not individually identified and validated in the source pack; no untraced conclusion is added.

## WP3.3 persistence scope map

| Candidate state/transition | Source and scenario | What acceptance proves | WP0 disposition |
|---|---|---|---|
| Consent exists before PII entry; purpose is `cooperative_record_keeping` | PRV-001; BDD-PRV-001 | Reject add-member without consent, accept after consent | A minimal consent fact may be needed; exact required evidence fields are not settled; map before migration |
| Consent withdrawal is recorded and triggers retention evaluation | PRV-001/005; BDD-PRV-002 | Withdrawal flag and retention evaluation start; identifier masking follows lawful-purpose policy | Minimal transition may be needed; retention duration and legal effect remain pending |
| Public inspection eligibility and fee policy | PRV-006; BDD-PRV-008 and BDD-PRV-018/019 | Read-only inspection and privacy-preserving audit; any fee value comes from reviewed policy | Keep policy configurable/`needs_legal_validation`; persist only version/reference if an accepted scenario requires it |
| Retention period, expiry and exceptions | PRV-005/008; BDD-PRV-007 | Personal fields become inaccessible while pseudonymous transaction facts remain; conflicts are surfaced | Two-year membership floor is cited in `03`; O-10 exceptions/legal advice open; no scheduler or broad legal rules engine |
| Legal source validation metadata | `03` §13 and decision register O-6; associated legal-catalogue scenarios | Source, version, status and reviewer are traceable; only source-backed validated entries may be treated as approved | Approval is assumed by owner instruction; source-level provenance and row-by-row trace still need evidence |
| Lawful-basis/consent purpose catalogue | O-4 and PRV-001/006 | Only the scenario's named purpose/data action is accepted | Purpose list requires owner/legal review; defer generic basis histories and consent portal |

The completed WP0 requirement-to-field/command/audience/basis/retention/BDD trace is `evidence/phase1/privacy-field-requirement-map.json`. It explicitly distinguishes existing candidate schema from missing member-register/inspection entities and identifies exact scenario-listed candidate fields where no current entity exists. This is not approval to create every candidate entity: each persisted field and transition must remain tied to the specified acceptance behavior and BDD ID and be the minimum representation needed to prove it. Any unmapped item is deferred. The `03` source states membership data has a two-year floor and transaction facts may remain pseudonymized; these remain source-referenced contract assumptions. The owner/legal approval assumption does not supply missing source pages or substitute for row-by-row trace evidence.

Deferred unless a mapped accepted requirement requires otherwise: generalized consent management, broad lawful-basis histories, consent portal, scheduled retention platform, legal rules engine, and unmapped retention transitions. The complete WP3.3 row-by-row entity/field/command/transition/test map is not yet accepted; no WP3.3 migration is authorized.
