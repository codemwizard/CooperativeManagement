# WP6.1 Cooperative Officeholder Persona Catalogue

**Status:** Owner-directed additions recorded 2026-11-19. These definitions extend BDD-UXW-001 from six to nine persisted workflow contexts. They are UI/workflow definitions, not new authorization grants.

## Definition

A workspace persona is the named, product-facing workflow and navigation presented for a currently authenticated account in one persisted organization and authority context. It is derived from WP2.2 facts: active membership, office appointment, capacity, institutional role, platform role, or open enrolment session. A persona is not the person (`person_id`), login account (`userId`), tenant (`tenantId`), legal position/appointment, or authorization decision. Selecting a persona changes the displayed workflow only. Every data access and command must continue to authorize against current server-side facts.

One person may receive more than one persona when separate active appointments or capacities support them. This does not merge their authority. A missing, expired, revoked, unknown, or cross-organization appointment produces no officeholder context.

## Officeholder personas

### Chairperson (position code `chairperson`; commonly called Chairman)

**Source:** current appointment for the linked person to position `chairperson`, current cooperative membership, and effective interval from WP2.2. The code/display spelling follows the project's governance catalogue.

**Workflow:** cooperative governance oversight, convening/chairing meetings, recording resolutions and decisions, reviewing the governance and by-law requirements, and following official records and findings. These workflow areas are capability shells where the related product module is not implemented.

**Navigation:** Overview; Governance; Meetings and resolutions; By-laws and requirements; Evidence register; Findings and next actions.

**Authority limit:** the persona does not itself authorize approval, interpretation, capacity grants/revocations, or any other command. The relevant command policy must separately recognize the persisted Chairperson appointment and scope.

### Vice-Chairperson

**Source:** current appointment for the linked person to position `vice_chairperson`, current cooperative membership, and effective interval from WP2.2.

**Workflow:** deputy governance work, meeting and resolution work, by-law interpretation/review, official records and findings. This context remains distinct from Chairperson. Acting for the Chairperson in a particular duty requires the policy/appointment/delegation conditions for that duty; selection never implies substitution authority.

**Navigation:** Overview; Governance; Meetings and resolutions; By-laws and requirements; Evidence register; Findings and next actions.

**Authority limit:** same presentation areas as Chairperson do not mean identical authority. The persisted appointment and applicable action policy determine what the Vice-Chairperson may do.

### Treasurer

**Source:** current appointment for the linked person to position `treasurer`, current cooperative membership, and effective interval from WP2.2.

**Workflow:** financial-record oversight, preparing or supplying financial evidence, meeting/resolution follow-up, and addressing financial findings and next actions. The domain sources identify financial statements as Treasurer work and include Treasurer action items from minutes.

**Navigation:** Overview; Financial records; Meetings and resolutions; Evidence register; Findings and next actions.

**Capability status:** Financial records is an explicit capability-gap route. This persona does not claim that financial data entry, ledgers, accounts, or persistence have been implemented.

**Authority limit:** a Treasurer may supply evidence and perform actions allowed by separately approved policy. The Treasurer does not gain Chairperson/Vice-Chairperson approval authority from this persona. Existing requirements explicitly label a Treasurer's minutes approval as outside the Chairperson/Vice-Chairperson approval duty.

## Nine accepted workflow contexts

1. Cooperative member — active cooperative membership.
2. Chairperson — current `chairperson` appointment plus active membership.
3. Vice-Chairperson — current `vice_chairperson` appointment plus active membership.
4. Secretary — current `secretary` appointment plus active membership.
5. Treasurer — current `treasurer` appointment plus active membership.
6. Internal verifier — current organization-scoped `internal_verifier` capacity and active membership.
7. Programme manager — persisted platform role with the owner-directed interim same-tenant read projection.
8. Union TA — current institutional assignment and a valid persisted delegation chain.
9. Self-enroller — open persisted enrolment session.

## Source mapping

Definitions trace to:

- `Implementation-Plan-V4/03-specification-delta.md` §2.1: office-position catalogue and mandatory workflow-role baseline; §13: statutory source table, including s.42(1).
- `features/04_duty_process_records.feature`: official approval and duty-process distinctions.
- `features/06_bylaws_precedence_and_requirements.feature`: Chairperson/Vice-Chairperson approval of provision interpretation.
- `features/07_governance_positions_and_appointments.feature`: appointment history, eligibility, position-combination constraints and source requirements.
- `features/08_meetings_and_resolutions.feature`: meeting convening, Treasurer evidence/action duties, and limits on Treasurer approval duty.
- `migrations/0016_trusted_authority_context.sql`: versioned `position_catalog` codes and display labels.
- `evidence/phase1/wp2.2/trusted-authority-contract.md`: persisted authority resolution and fail-closed scope rules.

The Feature 10 UXW-001 outline, BDD scenario manifest, owner map, route tests, task evidence, and closure-plan references must all use the same nine-context catalogue. The WP6.1 live Cucumber runner must execute the expanded outline examples; existing Playwright checks remain supporting evidence.
