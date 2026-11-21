# REM-WP1.6 command registry trace

## Finding

The frozen REM-WP1.6 plan requires a registered supported command and its strict payload/result schemas before application-route composition. D-19 and the WP2.3 contract now select `GrantCapacity`, `RevokeCapacity`, and the `DelegateTaScope` grant/revoke discriminator as supported Phase 1 commands. WP2.3 provides their strict schemas, PostgreSQL handlers and event/receipt mapping. The remaining WP1.6 work is to compose the approved registry/handlers into the production `POST /commands` route and prove authenticated HTTP behavior.

## Sources checked

- `Implementation-Plan-V4/implementation/WP1.6-REMEDIATION-IMPLEMENTATION-PLAN.md`, WP1.6-A step 3, WP1.6-C steps 4–8, and WP1.6-D step 1.
- `docs/phase1/API_CONTRACT.md`, Command API section: request `type` and `schemaVersion` must identify a registered strict command; each supported command must target exactly one UUID aggregate.
- `packages/contracts/src/capacity-delegation-command.ts`: D-19 command discriminators and strict command payload/result schemas are now defined and exported.
- `evidence/phase1/wp2.3/capacity-delegation-command-contract.json`: the owner-approved command mapping and persistence semantics.
- `packages/domain/src/authz/policy-engine.ts`: the corresponding four policy action IDs remain distinct from the command discriminators.
- `packages/domain/src/kernel/command-bus.ts`: generic transaction/receipt processing requires the caller to provide the actual handler, policy store, schemas, and trusted principal.
- `packages/testkit/src/step-definitions/kernel-steps.ts`: `AmendClaim` is used in a cross-tenant denial fixture. It is not a registered product command and the feature specification assigns claim amendment to Phase 2; it cannot be promoted as a Phase 1 supported command by test usage alone.

## Required disposition

Production `POST /commands` composition must use the approved WP2.3 schemas and handlers, supply only the authenticated session's actor and tenant, and preserve the cooperative target in the semantic digest. It must not route a legacy `AmendClaim` fixture as a product command or bypass the WP2.3 mutation boundary.

Until WP1.6 completes that composition and its API/BDD tests, AUD-002/003 cannot be proven through the product HTTP route, and AUD-014 cannot prove that forged authority claims have no effect on a supported command.
