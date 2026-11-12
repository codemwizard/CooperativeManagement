import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { executeSqlMigration } from '../migration-executor.js';

function aClient(failOnSql?: string): { client: pg.PoolClient; statements: string[] } {
  const statements: string[] = [];
  const client = {
    query: async (sql: string) => {
      statements.push(sql);
      if (sql === failOnSql) throw new Error('simulated SQL failure');
      return { rows: [] };
    },
  } as unknown as pg.PoolClient;
  return { client, statements };
}

describe('executeSqlMigration', () => {
  it('commits the SQL and migration ledger row in one transaction', async () => {
    const { client, statements } = aClient();
    await executeSqlMigration(client, '0001_kernel.sql', 'CREATE TABLE example (id INT)');
    expect(statements).toEqual([
      'BEGIN',
      'SET LOCAL search_path TO "symphony", public',
      'CREATE TABLE example (id INT)',
      'INSERT INTO "symphony".schema_migrations (name) VALUES ($1)',
      'COMMIT',
    ]);
  });

  it('rolls back a failed migration and never records it as applied', async () => {
    const { client, statements } = aClient('SELECT deliberate_failure');
    await expect(
      executeSqlMigration(client, '9999_failure.sql', 'SELECT deliberate_failure'),
    ).rejects.toMatchObject({
      message: 'Migration 9999_failure.sql failed; transaction rolled back.',
      cause: expect.objectContaining({ message: 'simulated SQL failure' }),
    });
    expect(statements).not.toContain('COMMIT');
    expect(statements).not.toContain('INSERT INTO "symphony".schema_migrations (name) VALUES ($1)');
    expect(statements.at(-1)).toBe('ROLLBACK');
  });
});
