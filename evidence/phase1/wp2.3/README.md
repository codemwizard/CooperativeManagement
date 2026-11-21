# REM-WP2.3 Capacity and delegation commands

**Status (2026-11-21):** D-19 and the amended WP2.1 matrix are implemented. Strict command schemas and PostgreSQL grant/revoke handlers are implemented with migrations `0021`–`0027`. D-20 assisted enrolment records the exact open session, typed attestations, representative and approval decision in the atomic capacity grant. D-21/D-22 define source-backed acting appointments for any active cooperative office, distinguish the authorized Chairperson/Vice-chairperson decision-maker from the official recorder, and model early ending as a separate immutable record. The trusted resolver and command policy store recognize source-backed acting-office authority only for the linked authenticated person, active cooperative membership, valid interval, exact same-cooperative evidence, and no effective supersession or ending. PostgreSQL and API integration tests exercise the supported resolver and command paths. Acting appointment/ending writes remain SELECT-only because D-16 does not register those writers in WP2.3; they remain outside its four registered capacity/TA-scope mutations and require their own command, audit, lock, and scope-version contract before runtime write access.

The six mapped WP1.6 scenarios execute through the real Fastify/PostgreSQL composition: BDD-AUD-002, 003, 005, 008, 009, and 014. The original implementation candidate `c2764c6a2f7bc684f49cc8ea877f14ccc9a341f4` passed all eight expanded scenarios and 69 steps and its closure checks passed. The status-reconciliation candidate `86feb09f334f8c6374ea364850631b8eccbafc5a` reran the mapped scenarios with the same result; its exact-candidate closure verification is pending and must pass before this evidence record reports its gate as passed. The implementation candidate is distinct from the evidence commits that retain and verify its closure record.
**Entry:** REM-WP2.2 and REM-WP2.6 must have candidate-bound passing evidence.
**Authority:** REM-WP2.1 policy matrix v2, D-19 (which amends the relevant D-17 cohort-target and generic acting-officer grant language), `docs/phase1/API_CONTRACT.md`, `docs/phase1/COMMAND_TRANSACTION_CONTRACT.md`, and the D-16 serialization specification.

## Bounded scope

Implement the four Phase 1 policy action families from the D-19 amended REM-WP2.1 matrix. The registered command discriminators are `GrantCapacity`, `RevokeCapacity` and `DelegateTaScope`; the latter has a strict `grant`/`revoke` operation discriminator.

- capacity grant;
- capacity revoke;
- TA-scope delegation grant;
- TA-scope delegation revoke.

Those policy action IDs do not by themselves determine HTTP registration. D-19 resolves the product semantics; this contract defines the registered command mapping. Do not infer command registrations from legacy service names.

Use persisted actor, tenant, organization, appointment/capacity/delegation and direct cooperative-scope facts. Persist command receipts, source mutation, immutable domain event, outbox and D-16 scope-version changes atomically through the accepted REM-WP1 transaction path and REM-WP2.6 lock service. The trusted workspace projection reads the source records; WP2.3 does not invent a second authority projection. Revocation must not modify historical findings or create a Phase 2 finding workflow.

First-class cohort creation, membership transitions, closure and historical treatment remain future work. A TA command targets one existing cooperative and does not create a cohort or imply group membership.

## Contract artifact

`capacity-delegation-command-contract.json` records the resolved command discriminators, schema version, strict request/result schemas, aggregate UUID target, actor/session/tenant provenance, allowed actor classes, direct cooperative target, effective interval and boundary semantics, duplicate/replay/revoke outcomes, event and authority read-model mapping, audit behavior, receipt semantics, affected D-16 scopes, and requirement/source trace.

Generic capacity commands accept `internal_verifier`, `field_agent` and `delegate`; `delegate` requires a documentary `sourceRef`. Generic commands reject `acting_officer`. D-20's assisted exception requires an authenticated `platform_enroller`, exact open session, persisted presence/NRC-sighting/consent-to-act attestations, and command-recorded representative approval. TA scope targets one existing cooperative and records union, delegatee, manager, agreement reference and half-open effective interval. `agreementRef` is preserved as documentary provenance only; no legal-validity check is claimed. Semantic repeats return a receipt without source/event/outbox/version writes; grant after expiry/revocation creates a new row; conflicts are terminal and non-mutating. Exact command payload/result schemas and event mapping are in `capacity-delegation-command-contract.json`.

`POST /commands` composes the three registered WP2.3 command discriminators through persisted-session authentication and the restricted PostgreSQL transaction path. The previous candidate's exact-candidate closure and WP1.6 predecessor checks passed. The updated candidate and its retained verifier outputs are recorded in `task-evidence.json`; the next mapped work is REM-WP2.4's serial-order and immutable-history proof, followed by REM-WP2.5's full Phase 1 BDD scope closure.
