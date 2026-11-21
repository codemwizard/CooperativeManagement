# REM-WP2.4 Authority Race and History Acceptance

REM-WP2.4 proves the database serial outcomes for the four supported mutation actions implemented by REM-WP2.3: capacity grant, capacity revoke, direct cooperative TA-scope grant, and direct cooperative TA-scope revoke.

The D-16 serialization contract is in [authority-scope-serialization-spec.md](authority-scope-serialization-spec.md). D-19 supersedes earlier cohort wording: each TA-scope command targets one existing cooperative. Phase 1 has no cohort aggregate, nested TA delegation, or descendant cascade. `authority-dependency-inventory.json` v3 records that accepted boundary.

The PostgreSQL command tests use the actual restricted `symphony_app` runtime connection and an independent admin connection for fixture setup, observation, and cleanup. A barrier holds `FOR SHARE`; the app-role command attempts the matching `FOR UPDATE`; PostgreSQL blocker state is observed before the reader is released. Mutation-first tests commit through the command path and then acquire a fresh protected lock/read to check persisted source state and exact versions.

Infrastructure cases already owned and proven by REM-WP2.6 are referenced, not reimplemented here: two shared readers block the writer until both release, canonical lock ordering and deduplication, cross-tenant rejection, frozen-source privileges, scope-row constraints, and rollback. REM-WP2.4 re-runs the exact WP2.6 lock suite against its candidate and binds its prior evidence SHA as a graph predecessor.

See [acceptance-matrix.md](acceptance-matrix.md) for the full criterion-to-artifact map. Exact-candidate results and limitations are recorded in [task-evidence.json](task-evidence.json) after the implementation candidate is frozen.
