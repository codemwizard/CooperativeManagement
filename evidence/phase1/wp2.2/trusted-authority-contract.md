# REM-WP2.2 trusted workspace authority contract

## Purpose and authority boundary

REM-WP2.2 supplies a read-only, tenant-scoped projection of persisted identity and authority facts to the authenticated workspace. It does not authenticate users, accept a persona from the browser, make authorization decisions for commands, or write membership/authority records. The API derives the actor and tenant exclusively from the persisted WP5.3 session. The resolver reads PostgreSQL under `symphony_app`, sets transaction-local `app.tenant_id`, and uses one repeatable-read snapshot.

## Identity relationships

- `users.id` is the authentication account identifier. A user row does not itself mean cooperative membership or an official role.
- `persons.id` is the stable human/domain identity, independent from login credentials and PII. `user_person_links` connects one active account to at most one current person per tenant, with a source reference and the linking account. A person may later be linked to another account after the prior link is ended.
- `organizations.id` identifies an organization within `tenant_id`; migration 0016 classifies it as cooperative, union, or federation.
- `organization_memberships` connects a person to a cooperative and carries its own effective interval and source. Membership is the Cooperative member workflow context; it is not a login account or an officer position.
- `appointments.position_id` references the stable `position_catalog`. A Secretary workflow comes from a current appointment for the linked person and a current cooperative membership. It is distinct from the Secretary's person and account identities.
- `capacity_grants` represent operational capacities (for example, internal verifier) and are projected only when the linked person has current membership in that cooperative.

An authenticated user can have zero, one, or several current workflow contexts. A person with active cooperative membership receives a Cooperative member context even if no appointment exists. Multiple roles remain separate contexts for the same account; selecting a context changes presentation only and grants no new authority.

## Institutional scope

- Programme manager is a persisted tenant-scoped platform role. The owner direction grants universal read-only projection visibility to organizations in the same tenant. No cross-tenant projection is returned. Persisted `ta_delegation` scope is separately returned for TA delegation workflows.
- Union TA is a persisted institutional assignment on a union/federation, and its cooperative target scope is returned only through an active delegation whose programme manager still has the required role and persisted matching TA-delegation scope. All rows must be in the same tenant and within their effective interval.
- The current scope record names cooperative organizations directly. A cohort aggregate/lifecycle and grant/revoke commands are deferred to WP2.3/WP2.4; this resolver does not infer a cohort from arbitrary client data.
- Self-enroller context comes only from an open persisted enrolment session.

## API and privacy

`GET /workspace/context` is authenticated, private/no-store and returns only UUIDs, organization display names/kinds, typed authority facts, source-row IDs/references, effective times and bounded organization scopes. It does not return account email, person PII, household details, or arbitrary database enum text. Unknown or inactive catalogue positions and capacities are omitted. Inactive account, wrong tenant, expired/revoked facts and missing account-person linkage fail closed or yield no corresponding context. More than one current account-person link is treated as an integrity error.

The workspace maps only the enumerated fact types/codes to fixed context labels and fixed route lists, including separate Chairperson, Vice-Chairperson, Secretary and Treasurer contexts for current appointments. Organization route parameters are accepted only if the selected persisted context includes that organization in its permitted scope.

## Persistence and migration

Migration `0016_trusted_authority_context.sql` creates the five tenant-scoped read models and a global, select-only position catalogue. Each tenant table uses forced RLS with a restrictive `app.tenant_id` predicate. The runtime role has SELECT only; owner-authorized commands and lifecycle management are outside WP2.2. Historic appointment position IDs are retained as inactive `legacy-unmapped-*` catalogue entries so they cannot accidentally confer a recognized office.

The PostgreSQL-backed API integration verifies account/person mapping, membership, recognized and expired appointments/capacities, programme-manager projection/delegation, Union-TA delegation, self-enroller session, session-derived actor identity, no email projection, and forced-password-change denial. The current restricted-role tenant policy inventory includes 45 tenant-scoped tables; the newly added WP6.1 finding-attribution table requires fresh actual-role verification on the candidate before this predecessor evidence can pass exact-candidate closure.

## Limitations and follow-ups

- This is a read model. Member activity and household write workflows, member enrollment/link lifecycle commands, and authority grant/revoke commands are not implemented here.
- Universal programme-manager projection scope is the owner-directed interim rule. It should be narrowed through explicit agreements/organization scopes before production multi-party programme deployment.
- Union TA scope currently targets direct cooperative IDs; a first-class cohort entity is not present.
- Public display identity for official verifiers and the exact successful-verification vocabulary belong to WP6.3 and remain unresolved. This API does not expose verifier names or verification results.
- Account-person link provenance is recorded as a source reference and linker ID; command-level approval/audit workflow is deferred to the relevant enrollment/authority command work.
