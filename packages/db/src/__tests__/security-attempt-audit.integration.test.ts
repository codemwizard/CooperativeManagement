import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { createDb } from '../db/client.js';
import { PostgresSecurityAttemptWriter, validateSecurityAttemptRuntimeProfile } from '../repositories/postgres-security-attempt-writer.js';
import type { SymphonyDatabase } from '../types/database.js';

describe('WP1.2-B security-attempt audit mode guard', () => {
  it.each([
    ['missing mode', '', true],
    ['unknown mode', 'unknown', true],
    ['real-data mode', 'real', true],
    ['non-synthetic test data', 'test', false],
  ])('refuses %s before opening a database transaction', async (_label, dataMode, syntheticOnly) => {
    let transactionCalls = 0;
    const unavailableDb = {
      transaction: () => { transactionCalls += 1; throw new Error('must not be called'); },
    } as unknown as Kysely<SymphonyDatabase>;
    expect(() => validateSecurityAttemptRuntimeProfile({ NODE_ENV: 'test', DATA_MODE: dataMode, SYNTHETIC_ONLY: String(syntheticOnly) })).toThrow();
    expect(transactionCalls).toBe(0);
  });
});

const databaseUrl = process.env['MIGRATION_TEST_DATABASE_URL'];
describe.skipIf(!databaseUrl)('WP1.2-B PostgreSQL security-attempt persistence', () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = createDb(databaseUrl ?? '', { max: 1 });
  afterAll(async () => { await Promise.all([pool.end(), db.destroy()]); });

  it('commits the minimized denial record in a separate transaction', async () => {
    const identity = await pool.query<{ database_name: string; server_version_num: string }>(
      "SELECT current_database() AS database_name, current_setting('server_version_num') AS server_version_num",
    );
    expect(identity.rows[0]?.database_name.endsWith('_test')).toBe(true);
    expect(process.env['DATA_MODE']).toBe('test');
    expect(Number(identity.rows[0]?.server_version_num)).toBe(180000);
    const tenantId = randomUUID();
    const actorUserId = randomUUID();
    await pool.query('INSERT INTO symphony.tenants (id, name) VALUES ($1, $2)', [tenantId, 'synthetic-audit-test']);
    try {
      const writer = new PostgresSecurityAttemptWriter(db, validateSecurityAttemptRuntimeProfile({ NODE_ENV: 'test', DATA_MODE: 'test', SYNTHETIC_ONLY: 'true' }));
      await writer.record({
        tenantId,
        actorUserId,
        observedCommandId: randomUUID(),
        observedCommandType: 'membership.update',
        denialCode: 'READ_ONLY_ROLE',
      });
      const observed = await pool.query<{
        tenant_id: string; actor_user_id: string; observed_command_id: string;
        observed_command_type: string; denial_code: string; recorded_at: Date;
      }>(
        `SELECT tenant_id, actor_user_id, observed_command_id, observed_command_type, denial_code, recorded_at
         FROM symphony.security_attempts WHERE tenant_id = $1 AND actor_user_id = $2`,
        [tenantId, actorUserId],
      );
      expect(observed.rows).toHaveLength(1);
      expect(observed.rows[0]).toMatchObject({ tenant_id: tenantId, actor_user_id: actorUserId, observed_command_type: 'membership.update', denial_code: 'READ_ONLY_ROLE' });
      expect(observed.rows[0]?.recorded_at).toBeInstanceOf(Date);
    } finally {
      await pool.query('DELETE FROM symphony.security_attempts WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM symphony.tenants WHERE id = $1', [tenantId]);
    }
  });
});
