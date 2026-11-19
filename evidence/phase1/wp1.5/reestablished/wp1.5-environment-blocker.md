# WP1.5 local verification blocker

The following required current-candidate checks were not run:

- `node tools/bootstrap_wp1_5_database.mjs`
- `npm run db:migrate:test`
- `npm run test:db --workspace @symphony/db`
- `npm run test:bdd:wp1.5`
- `node tools/finalize_wp1_5_database.mjs`
- The candidate-bound GitHub Actions workflow and its uploaded artifact verification.

The Codex sandbox reports npm `11.19.0` because its PowerShell shim cannot access the user-level npm CLI under AppData; the owner reports the interactive desktop shell returns `12.2.0`. This sandbox-specific npm result is not evidence that the desktop lacks npm 12.2.0. `Get-Command docker` returned no command. The process environment did not contain `PHASE1_TEST_ADMIN_DATABASE_URL`, `PHASE1_TEST_MIGRATOR_DATABASE_URL`, or `PHASE1_TEST_APP_DATABASE_URL`. No `.env` content or credentials were opened. Without a provisioned isolated PostgreSQL 18 service and required identities, the actual role/RLS, migration, outbox and BDD claims cannot be verified here. This is an environment blocker, not a passing result or a failure of the product behavior.

