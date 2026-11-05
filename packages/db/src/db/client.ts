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

export interface DbPoolOptions {
  /** Maximum number of connections in the pool (default: 10). Set to 1 for tests. */
  max?: number;
}

export function createDb(connectionString: string, options?: DbPoolOptions): Kysely<SymphonyDatabase> {
  const pool = new pg.Pool({
    connectionString,
    max: options?.max,
  });
  return new Kysely<SymphonyDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
}

