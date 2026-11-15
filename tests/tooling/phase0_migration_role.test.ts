import { describe, expect, it } from 'vitest';
import {
  assertPhase0MigrationAdminIdentity,
  migrationRoleNeedsBootstrap,
  migrationRoleUrl,
  roleContractErrors,
} from '../../tools/phase0-migration-role.mjs';

describe('Phase 0 migration-role bootstrap contract', () => {
  it('requires an isolated PostgreSQL 18 test database and superuser administrator', () => {
    expect(() => assertPhase0MigrationAdminIdentity({ database_name: 'symphony', server_version_num: '180000', rolsuper: true }))
      .toThrow(/_test/);
    expect(() => assertPhase0MigrationAdminIdentity({ database_name: 'symphony_test', server_version_num: '160004', rolsuper: true }))
      .toThrow(/PostgreSQL 18/);
    expect(() => assertPhase0MigrationAdminIdentity({ database_name: 'symphony_test', server_version_num: '180000', rolsuper: false }))
      .toThrow(/superuser/);
    expect(() => assertPhase0MigrationAdminIdentity({ database_name: 'symphony_phase1_test', server_version_num: '180000', rolsuper: true }))
      .not.toThrow();
  });

  it('bootstraps when the URL uses another role or the required SET membership is absent', () => {
    expect(migrationRoleNeedsBootstrap({ migrationUrlUsername: 'symphony', migratorCanSetWriter: true })).toBe(true);
    expect(migrationRoleNeedsBootstrap({ migrationUrlUsername: 'symphony_migrator', migratorCanSetWriter: false })).toBe(true);
    expect(migrationRoleNeedsBootstrap({ migrationUrlUsername: 'symphony_migrator', migratorCanSetWriter: true })).toBe(false);
  });

  it('builds the migrator URL from the isolated admin endpoint without changing its host or database', () => {
    const url = new URL(migrationRoleUrl('postgresql://postgres:admin-test@localhost:55432/symphony_phase1_test', 'generated-test-secret'));
    expect(url.username).toBe('symphony_migrator');
    expect(url.password).toBe('generated-test-secret');
    expect(url.host).toBe('localhost:55432');
    expect(url.pathname).toBe('/symphony_phase1_test');
  });

  it('rejects existing role definitions that do not match the least-privilege contract', () => {
    const role = {
      rolcanlogin: true,
      rolinherit: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolbypassrls: false,
    };
    expect(roleContractErrors('symphony_migrator', role)).toEqual([]);
    expect(roleContractErrors('symphony_app', { ...role, rolinherit: true })).toContain('symphony_app must be NOINHERIT');
    expect(roleContractErrors('symphony_outbox_writer', { ...role, rolcanlogin: true }))
      .toContain('symphony_outbox_writer must be NOLOGIN');
  });
});
