# REM-WP2.4 Authority Scope Serialization Specification

**Specification:** `phase1-authority-scope-serialization-v1`
**Status:** Normative technical reconciliation for REM-WP2.4; no implementation or race-test pass is claimed.
**Decision:** D-16 in `Implementation-Plan-V4/02-decision-register.md` §7.5. This refines D-04's approved serial outcomes without changing the Phase 1/Phase 2 boundary.
**Authority:** `docs/phase1/AUTHORIZATION_CAPACITY_CONTRACT.md` v3; `evidence/phase1/authority-dependency-inventory.json` v2; `evidence/phase1/task-dependencies.yml`; REM-WP2.3 and REM-WP2.4 in `WP2-WP5-IMPLEMENTATION-READINESS-PLAN.md`.

## 1. Reconciliation ruling

1. Retain the actor/tenant authority aggregate required by D-04 as exactly one `actor_tenant` scope row in `symphony.authority_scope_versions`. Do not keep a second actor/tenant version table or aggregate lock representation. It remains an aggregate over one actor in one tenant, keyed by `(tenant_id, actor_user_id)`.
2. The existing command-target aggregate lock is a separate business-state lock and remains first when the command targets an aggregate. The authority-scope table is the single source of serialization versions for authority facts.
3. Protected read/command operations acquire `FOR SHARE` on all relevant authority-scope rows. Authority mutations acquire `FOR UPDATE` on those same rows. Both hold their locks through transaction end. Shared readers can proceed together; a conflicting authority mutation waits. A command that begins after a committed revocation reads the post-revocation source facts and denies.
4. Phase 1 lock order is: command target aggregate, `global_policy`, `organization`, `tenant`, `actor_tenant`, `actor`. Person/shared-identity is not a Phase 1 scope and never appears in the Phase 1 lock list.
5. Scope versions are incremented only for scope rows whose authority facts are changed by the transaction, exactly once per changed scope. A read-only protected command does not increment authority versions. Source DML and scope-version increments commit or roll back together.
6. Capacity and delegation grant/revoke are supported Phase 1 mutation paths owned by REM-WP2.3 and race-proved by REM-WP2.4. Membership, platform role/catalogue, appointment/source status, organization/cohort reassignment, and policy/configuration mutation are runtime-frozen for Phase 1. No Phase 1 authorization rule depends on person/shared-identity conflict; that is original Phase 2 work under IMP-P2-WP2.7.
7. Scope-row provisioning follows the same phase boundary as its source facts. `symphony_app` may ensure only tenant-owned `tenant`, `organization`, and `actor_tenant` rows. The fixed `global_policy` singleton and any required global `actor` rows must already exist from the trusted migration/bootstrap process; the runtime role verifies them and fails closed if absent. Runtime does not bypass RLS or use another role to provision them.

## 2. Exact table DDL

The following PostgreSQL 18 migration is normative. It is applied only after the `symphony` schema and separate migration/runtime roles exist. It must run through the ordered migration runner, never as an image initialization hook.

```sql
CREATE TABLE symphony.authority_scope_versions (
  scope_type text NOT NULL,
  tenant_id uuid,
  scope_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT authority_scope_versions_identity UNIQUE NULLS NOT DISTINCT (scope_type, tenant_id, scope_id),
  CONSTRAINT authority_scope_versions_version_nonnegative CHECK (version >= 0),
  CONSTRAINT authority_scope_versions_scope_shape CHECK (
    (scope_type = 'global_policy' AND tenant_id IS NULL AND scope_id = '00000000-0000-0000-0000-000000000001'::uuid)
    OR (scope_type = 'tenant' AND tenant_id IS NOT NULL AND scope_id = tenant_id)
    OR (scope_type = 'organization' AND tenant_id IS NOT NULL)
    OR (scope_type = 'actor_tenant' AND tenant_id IS NOT NULL)
    OR (scope_type = 'actor' AND tenant_id IS NULL)
  )
);

CREATE FUNCTION symphony.guard_authority_scope_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, symphony
AS $$
BEGIN
  IF NEW.scope_type IS DISTINCT FROM OLD.scope_type
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.scope_id IS DISTINCT FROM OLD.scope_id THEN
    RAISE EXCEPTION 'authority scope identity is immutable';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'authority scope version must advance by exactly one';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION symphony.guard_authority_scope_version_update() FROM PUBLIC;
CREATE TRIGGER authority_scope_versions_version_guard
BEFORE UPDATE ON symphony.authority_scope_versions
FOR EACH ROW EXECUTE FUNCTION symphony.guard_authority_scope_version_update();

ALTER TABLE symphony.authority_scope_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE symphony.authority_scope_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY authority_scope_versions_select ON symphony.authority_scope_versions
  FOR SELECT TO symphony_app
  USING (
    scope_type = 'global_policy'
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    OR (scope_type = 'actor' AND scope_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid)
  );
CREATE POLICY authority_scope_versions_insert ON symphony.authority_scope_versions
  FOR INSERT TO symphony_app
  WITH CHECK (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
CREATE POLICY authority_scope_versions_update ON symphony.authority_scope_versions
  FOR UPDATE TO symphony_app
  USING (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    scope_type NOT IN ('global_policy', 'actor')
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

REVOKE ALL ON symphony.authority_scope_versions FROM PUBLIC, symphony_app;
GRANT SELECT, INSERT (scope_type, tenant_id, scope_id), UPDATE (version)
  ON symphony.authority_scope_versions TO symphony_app;
REVOKE DELETE, TRUNCATE ON symphony.authority_scope_versions FROM symphony_app;
```

The ordered REM-WP2.4 migration/bootstrap seeds the single `global_policy` sentinel row at version 0. It also seeds version-0 `actor` rows for every actor represented by a global actor fact in the frozen Phase 1 catalogue. The deployment/bootstrap process uses the migration/bootstrap owner, outside serving traffic, and verifies exactly one global sentinel plus one row for each required actor tuple before enabling the runtime. Since platform-role assignment is frozen during Phase 1, adding/removing a globally scoped actor requires a reviewed offline migration/deployment that changes the source and corresponding scope-row set together. It is not an application request or an ordinary app-role insert. If a required row is absent, runtime authorization returns a generic fail-closed error and performs no protected source read/write, receipt, event or outbox mutation. Bootstrap validation fails before the service is marked ready if the singleton or required actor rows are absent or duplicated.

For non-global rows, `symphony_app` may create only `tenant`, `organization`, and `actor_tenant` tuples whose `tenant_id` matches the transaction-local authenticated tenant. It derives every tuple from persisted tenant/organization/actor context, not request-supplied IDs. The `scope_shape` CHECK and INSERT RLS policy reject any other shape or tenant. No privileged fallback or retry under the migration owner is permitted.

`scope_type` and canonical tuple encodings are exact:

| Scope type | Canonical unique tuple `(scope_type, tenant_id, scope_id)` | Meaning |
|---|---|---|
| `global_policy` | `(global_policy, NULL, 00000000-0000-0000-0000-000000000001)` | Global policy/configuration read scope. The fixed UUID is a reserved sentinel and is not a tenant, actor or organization ID. Phase 1 policy mutation remains frozen. |
| `organization` | `(organization, tenant UUID, organization UUID)` | Organization in its owning tenant; ownership must be verified from persisted rows. |
| `tenant` | `(tenant, tenant UUID, same tenant UUID)` | Tenant membership/lifecycle scope. |
| `actor_tenant` | `(actor_tenant, tenant UUID, actor UUID)` | The retained D-04 aggregate: one actor's authority in one tenant. |
| `actor` | `(actor, NULL, actor UUID)` | Global actor status/platform-role scope, frozen against Phase 1 runtime mutation. |

The log/debug encoding is exactly `scope_type|tenant_id-or-~|scope_id`, using lowercase PostgreSQL UUID text and `~` only for a null tenant. Examples: `organization|<tenant-uuid>|<organization-uuid>`, `actor_tenant|<tenant-uuid>|<actor-uuid>`, `global_policy|~|00000000-0000-0000-0000-000000000001`. The unique tuple, not the concatenated string, is the database identity. Application code derives tuple fields only from authenticated context and persisted rows; client-provided scope IDs/keys are rejected. The database CHECK rejects invalid shape; resolver tests prove tenant ownership and actor binding.

The trigger rejects changes to the scope tuple and any version update other than `OLD.version + 1`; `updated_at` is assigned by PostgreSQL. Inserts default version to zero. The runtime API accepts neither field. RLS is both ENABLED and FORCED. Before resolver access, the transaction sets local `app.tenant_id` and `app.actor_user_id` from the authenticated server principal. Tenant/organization/actor_tenant rows are visible only to the transaction tenant; global actor row only to that actor; the fixed global policy row is read-only for `symphony_app`.

## 3. Database roles and mutation enforcement

- The migration/bootstrap owner owns the table and trigger, seeds the fixed global policy row and required global actor rows, and validates those seeds before runtime readiness. It is never used for application requests or as an application fallback.
- `symphony_app` gets exactly the column grants and RLS policies shown in §2: SELECT; INSERT of tuple columns only (version defaults to zero); UPDATE of version only (trigger requires exactly +1 and sets the timestamp). It gets no DELETE/TRUNCATE; the global policy and actor rows cannot be inserted or updated by this role. The version trigger makes arbitrary caller-supplied version values impossible, though transaction/application tests must additionally prove increments occur only with supported source mutations.
- On frozen source tables (membership/tenant assignment, platform role/catalogue, appointment/source-status, organization/cohort reassignment, policy/configuration), explicitly revoke INSERT, UPDATE, DELETE, and TRUNCATE from `symphony_app`; grant only resolver reads. Verify grants while connected as `symphony_app`, not the migration owner.
- On supported capacity/delegation source tables, grant only DML required by REM-WP2.3. The application command path must acquire all required version locks before source DML, update source and each affected version in one transaction, and be the only registered Phase 1 writer. No HTTP route accepts scope keys, actor/tenant IDs, authority versions, or role claims from clients.
- Contract/startup validation enumerates command registrations and database grants. It fails if a frozen source has a runtime mutation path, `symphony_app` has direct DML on a frozen source, a supported writer omits a scope, or runtime uses an owner/migrator role.
## 4. Lock acquisition and transaction protocol

1. Authenticate the actor and resolve tenant from persisted session. Resolve target organization and all source identifiers from tenant-scoped persisted data; never accept lock identity from request fields.
2. Acquire the existing command-target aggregate lock, if there is one, before any authority lock. Receipt lookup/replay follows the command transaction contract; an existing replay does not re-run authorization or mutate scopes.
3. Build a complete, deduplicated scope set from the inventory mapping and trusted persisted rows. A command that can mutate authority uses mutation mode for the entire set (all `FOR UPDATE`), not a late lock upgrade. A read/protected command uses all `FOR SHARE`.
4. Provisioning and locking are separate passes because the INSERT RLS policy deliberately rejects `global_policy` and `actor` rows:
   a. Sort the complete scope set by the fixed rank in §1, then `COALESCE(tenant_id::text, '') COLLATE "C"`, then `scope_id::text COLLATE "C"`.
   b. Verify that every required `global_policy` or `actor` tuple already exists. If any is absent, fail closed before reading authority source rows or writing business state. These rows are provisioned only by the ordered migration/bootstrap process in §2/§3.
   c. For only `tenant`, `organization`, and `actor_tenant` tuples, issue `INSERT ... ON CONFLICT (scope_type, tenant_id, scope_id) DO NOTHING` individually in the same canonical order. This operation is authorized by the app-role INSERT policy only when each tuple's tenant matches the authenticated transaction tenant. A rejected row, RLS error, or cross-tenant tuple aborts the transaction; it must not trigger an owner-role retry.
   d. After provisioning/verification completes, acquire the complete scope lock set with SELECT ... FOR SHARE or SELECT ... FOR UPDATE, in canonical order, and check that exactly one row was returned for every requested tuple. A missing row fails closed. Acquire every required lock before reading mutable authority source tables. No helper may lazily request a lower-ranked key after any authority lock is held.
5. Read source facts and effective-time data after locking. Evaluate authorization from this snapshot, record the decision basis and versions, then perform the command/source writes. For authority mutation, increment exactly once every changed scope row using `SET version = version + 1`; do not increment unrelated locks.
6. Commit source writes and scope version increments atomically with the command receipt/event/outbox transaction. On any error, roll back both source and version writes. A conflict, denial, or failed mutation does not increment a scope version.
7. Retry only `40001` and `40P01`, at most three total transaction attempts, reusing the same command ID and semantic envelope. Recompute the complete scope set and reacquire in canonical order on every new transaction. Do not retry validation, authorization, or deterministic business denials.

## 5. Dependency-to-scope and writer matrix

The JSON inventory v2 is the machine-readable source of truth. This summarized matrix is for review navigation and must remain identical to it.

| Dependency | Phase 1 disposition | Scope rows | Writer / enforcement |
|---|---|---|---|
| Tenant membership | Frozen | `tenant`, `actor_tenant` | No Phase 1 mutation command; app-role DML denied. |
| Platform role assignment/catalogue | Frozen | `actor`, `actor_tenant`, `global_policy` | No Phase 1 mutation command; app-role DML denied. |
| Appointment/source status | Frozen | `organization`, `tenant`, `actor_tenant` | No Phase 1 mutation command; app-role DML denied. |
| Capacity grant/revoke/scope correction | Supported | `organization`, `tenant`, `actor_tenant` for each affected actor; add `actor` only for an action whose frozen REM-WP2.1 matrix row explicitly consumes a global actor fact | REM-WP2.3 commands; both race orders required in REM-WP2.4. The action matrix must identify such a row before its WP2.3 command is specified; implementation may not omit a declared dependency to reduce locks. |
| Delegation grant/revoke/scope change | Supported | `organization`, `tenant`, and `actor_tenant` for grantor, delegate, and every ancestor/descendant whose effective authority changes | REM-WP2.3 commands; resolve full affected chain before locking; both race orders required in REM-WP2.4. |
| Organization/cohort reassignment | Frozen | `organization`, `tenant` | No Phase 1 mutation command; app-role DML denied. Delegation-specific scope change remains owned by delegation command. |
| Person/shared-identity/ineligibility conflict | Phase 2 only | No Phase 1 scope row | Original IMP-P2-WP2.7 defines its own contract and PostgreSQL race evidence. |
| Policy/configuration version | Frozen during Phase 1 serving | `global_policy` or `tenant` for reads as applicable | No Phase 1 policy editor; app-role DML denied. Change requires reviewed offline migration/candidate. |

The REM-WP2.1 action catalogue is the final authority for whether a capacity rule consumes a global `actor` scope. WP2.1 must freeze the action-by-action dependency row before WP2.3 specifies that command. A command may not be implemented until every applicable row is explicit, and WP2.4 must reject a command-to-scope map that omits any declared dependency. If no applicable row consumes global actor status, the command omits that lock; if a row does, it includes the `actor` scope. This prevents both speculative locks and lock reduction that changes authorization semantics.

## 6. Required PostgreSQL TDD/BDD evidence

TDD creates a red test that detects the current unlocked/stale-read behavior before introducing the scope table or locks. The red test must demonstrate a stale authorization result or a missing scope-version update, not merely a missing file or compile error. Use an isolated PostgreSQL 18 database, actual `symphony_app` for application operations, a migration owner only for fixture setup, two independent connections, explicit test barriers, and fresh-connection assertions.

Required cases:

1. For each supported capacity and delegation mutation, protected-command-first: the command holds `FOR SHARE`; mutation's `FOR UPDATE` is visibly blocked; command commits before mutation; mutation then commits and increments each affected scope once.
2. For each supported capacity and delegation mutation, mutation-first: mutation locks `FOR UPDATE`, changes source and increments version, commits; the later protected command obtains `FOR SHARE`, reads current source/version, and denies or allows according to the new fact.
3. Two protected commands can concurrently hold `FOR SHARE` on the same scope; an authority mutation cannot pass until both commit/rollback.
4. Delegation parent revoke locks every effective descendant actor/tenant scope in canonical order. Reversed caller input order yields the same lock acquisition order and does not deadlock.
5. Multi-organization/multi-tenant scope inputs are deduplicated and sorted. A cross-tenant organization key is rejected before source reads/writes.
6. Every frozen source is unwritable as `symphony_app`; every corresponding mutation command/route registration fails the completeness/startup validator. Scope-row provisioning is also tested: tenant/organization/actor_tenant inserts succeed only for trusted same-tenant tuples; attempts to insert global_policy/actor rows or cross-tenant rows fail under the actual app role; missing global/actor rows fail closed; bootstrap-owner seeds pass uniqueness and completeness checks.
7. App role cannot delete/truncate or directly insert nonzero-version scope rows; malformed scope types/keys fail database CHECK; version update other than exactly +1 fails; timestamp is database-generated.
8. Failure after source DML but before version update rolls back the source write. Failure after version increment but before receipt/outbox commit rolls back the version and every command write.
9. Expiry/effective-time boundaries are tested with injected transaction time; elapsed expiry does not create a version update unless a persisted authority fact changes.
10. Phase 1 creates no person/shared-identity scope row or lock. The inventory validator rejects one being added without an explicit roadmap/D-04 amendment.

Closeout evidence includes migration DDL and rollback/retry logs; red and green raw outputs; privilege probes as actual app and migration roles; two-connection barrier traces; each serial-order result; version-before/after snapshots; command registry freeze proof; candidate SHA; and task record. Mocks, one connection, test-owner execution of product operations, sleeps without barriers, or asserted status labels without fresh database state do not pass.

