# BDD-AUD-005 contract and execution record

## Public denial contract

For a command whose submitted tenant differs from the authenticated server principal's tenant, the command bus returns exactly:

```json
{"ok":false,"code":"UNAUTHORIZED","detail":"Not authorized"}
```

This is the existing product behavior in `packages/domain/src/kernel/command-bus.ts`: the tenant mismatch is not disclosed in the public response. The same branch writes the more specific `TENANT_MISMATCH` denial code through `SecurityAttemptWriter`, scoped to the trusted principal's tenant. The previous feature expected `NOT_AUTHORISED_FOR_ORGANISATION`, which does not describe this trusted-principal mismatch and would expose a more specific denial than the implementation's privacy-preserving command contract. The normative requirement represented by `REQ-AUD-004` is denial, tenant isolation, and audit; it does not mandate that public code.

The feature expectation was therefore corrected to `UNAUTHORIZED`. The persisted audit assertion retains `TENANT_MISMATCH`; these two values intentionally serve different audiences. No implementation behavior was weakened to satisfy the feature.

## Required product path exercised

The `BDD-AUD-005` step now requires `PHASE1_TEST_ADMIN_DATABASE_URL`, `PHASE1_TEST_APP_DATABASE_URL`, and the validated test/synthetic runtime profile. It fails if these are absent; it has no in-memory fallback for this scenario.

The step creates isolated Org A and Org B tenants, an authenticated Org A user, and a real Org B evidence row. It asserts that:

1. the application's authenticated database role is `symphony_app`;
2. the command handler does not run and the bus returns the generic public denial;
3. with transaction-local Org A tenant context, `symphony_app` cannot select Org B's evidence through the tenant-filtered organization join protected by RLS;
4. the privileged fixture observer sees the Org B evidence row and its version count unchanged;
5. exactly one append-only security-attempt row exists for the command, with Org A's tenant, the authenticated actor, command ID/type, and internal `TENANT_MISMATCH` denial;
6. fixture rows and audit data are removed in the Cucumber `After` hook, with cleanup failure causing scenario failure.

The focused executable command is `npm run test:bdd:wp1.5`. CI runs it in the DB integration job after clean migration and actual-role DB integration checks, and retains its raw output with the other WP1.5 logs.

## Trace links

- Feature: `features/09_commands_audit_and_integrity.feature`, scenario `BDD-AUD-005`.
- Scenario source/proof statement: `evidence/phase1/bdd-scenarios.json`.
- Owner/path/assertion rule: `evidence/phase1/bdd-work-package-map.json`.
- Command response and audit behavior: `packages/domain/src/kernel/command-bus.ts`.
- Database audit writer: `packages/db/src/repositories/postgres-security-attempt-writer.ts`.
- Real-role scenario steps and cleanup: `packages/testkit/src/step-definitions/kernel-steps.ts`.
