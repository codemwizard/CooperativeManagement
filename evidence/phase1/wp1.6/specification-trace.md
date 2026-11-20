# REM-WP1.6 command registry trace

## Finding

The frozen REM-WP1.6 plan requires a registered supported command and its strict payload/result schemas before application-route composition. The repository currently defines the generic `CommandBus`, receipt and transaction ports, but contains no product command registry or registered REM-WP1.6 command with a product aggregate transition.

## Sources checked

- `Implementation-Plan-V4/implementation/WP1.6-REMEDIATION-IMPLEMENTATION-PLAN.md`, WP1.6-A step 3, WP1.6-C steps 4–8, and WP1.6-D step 1.
- `docs/phase1/API_CONTRACT.md`, Command API section: request `type` and `schemaVersion` must identify a registered strict command; each supported command must target exactly one UUID aggregate.
- `packages/contracts/src/index.ts`: `command.ts` remains unexported and does not exist as a shared HTTP command contract.
- `packages/domain/src/authz/policy-engine.ts`: the frozen command-like actions are `capacity.grant`, `capacity.revoke`, `ta_scope.grant`, and `ta_scope.revoke`; this is a policy model, not a business command registry or aggregate handler.
- `packages/domain/src/kernel/command-bus.ts`: generic transaction/receipt processing requires the caller to provide the actual handler, policy store, schemas, and trusted principal.
- `packages/testkit/src/step-definitions/kernel-steps.ts`: `AmendClaim` is used in a cross-tenant denial fixture. It is not a registered product command and the feature specification assigns claim amendment to Phase 2; it cannot be promoted as a Phase 1 supported command by test usage alone.

## Required disposition

Before implementing the production `POST /commands` registration, the project owner must identify the existing approved Phase 1 command to support and its canonical payload schema, aggregate target/type, result schema, and authorized policy action. Selecting `AmendClaim`, a capacity mutation, or a test-only counter would add unsupported business behavior or bypass the WP2.3 mutation boundary. No such selection is present in the cited approved contracts or decision records.

The generic route/parser contract and HTTP tests can be implemented once this command registration is identified. Until then, AUD-002/003 cannot be proven through a registered product command, and AUD-014 cannot prove that forged authority claims have no effect on a supported command.
