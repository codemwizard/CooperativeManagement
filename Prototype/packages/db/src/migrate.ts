/**
 * @symphony/db — migrate.ts
 * Applies forward-only SQL files with a PostgreSQL session advisory lock.
 * Kysely remains the repository/query adapter; raw pg executes the SQL files.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertMigrationSchema, isMigrationFilename, quoteMigrationSchema } from './migration-safety.js';
import { executeSqlMigration } from './migration-executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const SCHEMA = assertMigrationSchema(process.env['DATABASE_SCHEMA'] ?? 'symphony');
const QUOTED_SCHEMA = quoteMigrationSchema(SCHEMA);
const DATABASE_URL = process.env['DATABASE_URL'];

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error('DATABASE_URL environment variable is required to run migrations.');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const LOCK_NAMESPACE = 'symphony.forward_sql_migrations';

async function ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${QUOTED_SCHEMA}`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${QUOTED_SCHEMA}.schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function readMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((name) => name.endsWith('.sql')).sort();
  const invalid = sqlFiles.filter((name) => !isMigrationFilename(name));
  if (invalid.length > 0) {
    throw new Error(`Invalid migration filename(s): ${invalid.join(', ')}`);
  }
  if (sqlFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}`);
  }
  return sqlFiles;
}

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  let lockHeld = false;
  try {
    // A session lock spans all per-migration transactions. Waiters re-read the
    // ledger only after the current runner commits and releases this lock.
    await client.query('SELECT pg_advisory_lock(hashtext($1), hashtext($2))', [
      LOCK_NAMESPACE,
      SCHEMA,
    ]);
    lockHeld = true;

    console.log(`Running migrations from: ${MIGRATIONS_DIR}`);
    console.log(`Schema: ${SCHEMA}`);
    console.log('');

    await ensureMigrationsTable(client);
    const sqlFiles = await readMigrationFiles();
    const appliedResult = await client.query<{ name: string }>(
      `SELECT name FROM ${QUOTED_SCHEMA}.schema_migrations ORDER BY name`,
    );
    const applied = new Set(appliedResult.rows.map((row) => row.name));
    const unknownApplied = [...applied].filter((name) => !sqlFiles.includes(name));
    if (unknownApplied.length > 0) {
      throw new Error(
        `Migration history contains files absent from this checkout: ${unknownApplied.join(', ')}`,
      );
    }

    let count = 0;
    for (const file of sqlFiles) {
      if (applied.has(file)) {
        console.log(`  ⏭  ${file} — already applied`);
        continue;
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await executeSqlMigration(client, file, sql);
      console.log(`  ✅ ${file} — applied`);
      count++;
    }

    if (count === 0) {
      console.log('No new migrations to apply — database is up to date.');
    } else {
      console.log(`\n✅ ${count} migration(s) applied successfully.`);
    }
  } finally {
    if (lockHeld) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))', [
          LOCK_NAMESPACE,
          SCHEMA,
        ]);
      } catch {
        // Closing the connection releases a session-scoped advisory lock.
      }
    }
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error('Migration runner failed:', error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.cause instanceof Error) {
    console.error('Cause:', error.cause.message);
  }
  process.exitCode = 1;
});
