/**
 * @symphony/db — migrate.ts
 *
 * Runs all forward-only SQL migrations from the repo-root migrations/ directory.
 * Uses raw pg to execute SQL files directly (not Kysely FileMigrationProvider,
 * which requires JS/TS migration modules rather than raw SQL files).
 *
 * Tracks applied migrations in symphony.schema_migrations.
 *
 * Usage:
 *   node --loader ts-node/esm src/migrate.ts
 *   npm run migrate           (from packages/db)
 *   npm run db:migrate        (from repo root)
 *
 * Environment:
 *   DATABASE_URL     postgresql://user:pass@host:port/dbname
 *   DATABASE_SCHEMA  schema to use (default: symphony)
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// ─── Resolve paths ────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// migrations/ lives at the repo root (three levels up from packages/db/src/)
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const SCHEMA = process.env['DATABASE_SCHEMA'] ?? 'symphony';
const DATABASE_URL = process.env['DATABASE_URL'];

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error(
    'DATABASE_URL environment variable is required. ' +
      'Set it in .env or export it before running migrations.',
  );
}

// ─── Database connection ───────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function query(sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
  return pool.query(sql, params);
}

// ─── Migration tracking ───────────────────────────────────────────────────────
async function ensureMigrationsTable(): Promise<void> {
  await query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  await query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query(`SELECT name FROM ${SCHEMA}.schema_migrations ORDER BY name`);
  return new Set((result.rows as Array<{ name: string }>).map((r) => r.name));
}

async function recordMigration(name: string): Promise<void> {
  await query(`INSERT INTO ${SCHEMA}.schema_migrations (name) VALUES ($1)`, [name]);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
async function runMigrations(): Promise<void> {
  console.log(`Running migrations from: ${MIGRATIONS_DIR}`);
  console.log(`Schema: ${SCHEMA}`);
  console.log('');

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  // List all .sql files, sorted by name (lexicographic = numbered order)
  const allFiles = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = allFiles
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of sqlFiles) {
    if (applied.has(file)) {
      console.log(`  ⏭  ${file} — already applied`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = await fs.readFile(filePath, 'utf-8');

    // Execute in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET search_path TO ${SCHEMA}, public`);
      await client.query(sql);
      await client.query(
        `INSERT INTO ${SCHEMA}.schema_migrations (name) VALUES ($1)`,
        [file],
      );
      await client.query('COMMIT');
      console.log(`  ✅ ${file} — applied`);
      count++;
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      console.error(`  ❌ ${file} — FAILED`);
      console.error(err instanceof Error ? err.message : String(err));
      await pool.end();
      process.exit(1);
    } finally {
      client.release();
    }
  }

  if (count === 0) {
    console.log('No new migrations to apply — database is up to date.');
  } else {
    console.log(`\n✅ ${count} migration(s) applied successfully.`);
  }

  await pool.end();
}

runMigrations().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
