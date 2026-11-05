/**
 * @symphony/db — SQL migrations, seeds, Kysely repository adapters
 */

export const VERSION = '0.1.0';

// Repository adapters (Phase 1 — WP-1.1)
// export * from './repositories/postgres-repository.js';

// DB types (Phase 1 — WP-1.3)
export type { SymphonyDatabase } from './types/database.js';
export { createDb } from './db/client.js';

