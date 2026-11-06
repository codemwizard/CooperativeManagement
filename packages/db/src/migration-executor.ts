import type pg from 'pg';

export async function executeSqlMigration(
  client: pg.PoolClient,
  filename: string,
  sql: string,
): Promise<void> {
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO "symphony", public');
    await client.query(sql);
    await client.query('INSERT INTO "symphony".schema_migrations (name) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (error: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original migration failure for diagnosis.
    }
    throw new Error(`Migration ${filename} failed; transaction rolled back.`, { cause: error });
  }
}
