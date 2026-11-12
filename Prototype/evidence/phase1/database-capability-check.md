# `symphony_phase1_test` database capability check

- Checked: 2026-11-07
- PostgreSQL: 18.0
- Database: `symphony_phase1_test` (separate from the configured `symphony` development database)
- Connected role: `symphony`, database owner

## Verified privileges

A transaction-only probe successfully created a schema and table, altered the table, inserted, updated and deleted a row, then rolled back. The probe left no test schema/table/row behind. The migration integration suite subsequently passed 3 files / 9 tests against the isolated database, covering concurrent clean installation, no-op replay, failure rollback/retry, schema invariants and seeds.

The role lacks `CREATEDB`, so it cannot provision another database. No claim is made that this role can create or manage database roles. It is a database owner and therefore is **not** an acceptable WP1.5 least-privilege runtime identity or WP4 purge identity.

## Replication/archiving observation

A read-only PostgreSQL query reported `wal_level=replica`, `archive_mode=off`, `pg_is_in_recovery()=false`, zero replication slots, and zero connected streaming replicas. This records only the local PostgreSQL server state at check time. It does not establish backup coverage, backup retention, external snapshot behavior, restore behavior, or crypto-erasure from backups. Those operational facts remain owned by WP3.4 before any real-data readiness claim.

No purge, destructive reset, or persistent marker was written to this database during the capability probe.
