# Symphony Domain Transition Pack

- `docs/DOMAIN_STATE_TRANSITION_SPEC.md`: domain state machines, command catalogue, invariants, PostgreSQL/Supabase boundary and rollout gates.
- `docs/RELATIONAL_ERD.md`: logical ERD and relationship semantics.
- `db/migrations/0001_initial.sql`: PostgreSQL-first schema baseline.
- `contracts/test_domain_contracts.py`: executable Python reference oracle.
- `contracts/SCENARIO_CATALOG.md`: 20 scenario contracts.

Run from this directory:

```bash
python -m unittest discover -s contracts -v
```

The Python tests are an executable reference oracle, not database integration tests. The same SC IDs must be implemented against application command handlers and PostgreSQL before acceptance.

Apply only to a disposable PostgreSQL database after review:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_initial.sql
```

This migration is a design baseline, not production-ready. Review composite tenant constraints, grants, migration/rollback strategy, command handlers, transaction atomicity and integration tests. Cross-row workflow rules (self-verification, appointment authority, resolution effectiveness, idempotency and atomic event/outbox writes) require trusted command handlers. The immutable triggers do not protect against database owners/superusers. Evidence binaries belong in tenant-scoped object storage; SQL stores opaque keys and hashes. Supabase RLS is deliberately not in this first migration; implement and test it during the Supabase port, separately from action authorization.

Next gate: approve domain/authority semantics, review ERD/SQL, pass reference oracle, then add PostgreSQL integration tests before UI-to-database wiring.
