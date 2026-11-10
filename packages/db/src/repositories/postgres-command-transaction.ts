import { sql, type Kysely } from 'kysely';
import type { CommandTransactionContext, CommandTransactionRunner } from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';
import type { PostgresCommandTransactionContext } from './postgres-repository.js';

/** Owns the only PostgreSQL transaction used by command-path adapters. */
export class PostgresCommandTransactionRunner implements CommandTransactionRunner {
  constructor(private readonly db: Kysely<SymphonyDatabase>) {}

  run<T>(tenantId: string, work: (context: CommandTransactionContext) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
      const context: PostgresCommandTransactionContext = {
        transactionId: Symbol('symphony-command-transaction'),
        kyselyTransaction: trx,
      };
      return work(context);
    });
  }
}
