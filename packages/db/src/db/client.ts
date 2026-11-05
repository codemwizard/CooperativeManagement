/**
 * @symphony/db — db/client.ts
 *
 * Creates a shared Kysely instance connected to the local PostgreSQL database.
 * Uses pg (node-postgres) as the dialect driver.
 *
 * Environment:
 *   DATABASE_URL   — full connection string
 *   DATABASE_SCHEMA — schema name (default: symphony)
 */

import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { SymphonyDatabase } from '../types/database.js';

export function createDb(connectionString: string): Kysely<SymphonyDatabase> {
  const pool = new pg.Pool({ connectionString });
  return new Kysely<SymphonyDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
}

