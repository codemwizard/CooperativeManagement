/**
 * @symphony/db — SQL migrations, seeds, Kysely repository adapters
 */

export const VERSION = '0.1.0';

// Command-path transaction and persistence adapters (Phase 1 — WP1.2)
export { PostgresRepository } from './repositories/postgres-repository.js';
export { PostgresCommandReceiptStore } from './repositories/postgres-command-receipt-store.js';
export { PostgresCommandTransactionRunner } from './repositories/postgres-command-transaction.js';
export { PostgresSecurityAttemptWriter } from './repositories/postgres-security-attempt-writer.js';

// DB types (Phase 1 — WP-1.3)
export type { SymphonyDatabase } from './types/database.js';
export { createDb } from './db/client.js';

