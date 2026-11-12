import { sql, type Kysely } from 'kysely';
import { RetryableCommandTransactionError } from '@symphony/domain';
import type { CommandTransactionContext, CommandTransactionRecovery, CommandTransactionRunner } from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';
import type { PostgresCommandTransactionContext } from './postgres-repository.js';

/** Owns the only PostgreSQL transaction used by command-path adapters. */
export class PostgresCommandTransactionRunner implements CommandTransactionRunner {
  constructor(
    private readonly db: Kysely<SymphonyDatabase>,
    private readonly options: PostgresCommandTransactionRunnerOptions,
  ) {
    if (options.recoveryDb === db) {
      throw new TypeError('PostgresCommandTransactionRunner requires a separate recovery connection pool');
    }
  }

  async run<T>(
    tenantId: string,
    work: (context: CommandTransactionContext) => Promise<T>,
    recovery?: CommandTransactionRecovery<T>,
  ): Promise<T> {
    let uncertainReentered = false;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let workCompleted = false;
      try {
        const result = await this.db.transaction().execute(async (trx) => {
          await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
          // WP1.5 standardizes app.tenant_id; WP1.1's existing receipt/event
          // policies still read app.current_tenant_id until that migration lands.
          await sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`.execute(trx);
          const context: PostgresCommandTransactionContext = {
            transactionId: Symbol('symphony-command-transaction'),
            kyselyTransaction: trx,
          };
          const value = await work(context);
          workCompleted = true;
          await this.options.faults?.beforeCommit?.(attempt);
          return value;
        });
        await this.options.faults?.afterCommit?.(attempt);
        return result;
      } catch (error: unknown) {
        const sqlState = findErrorCode(error);
        if (sqlState === '40001' || sqlState === '40P01') {
          if (attempt < 3) {
            await (this.options.wait ?? delay)(attempt === 1 ? 25 : 50);
            continue;
          }
          throw new RetryableCommandTransactionError();
        }

        if (recovery && workCompleted && (isConnectionFailure(sqlState) || isDisconnectedClient(error))) {
          const recoveryDb = this.options.recoveryDb;
          let recovered: T | null;
          try {
            await this.options.faults?.beforeUncertainLookup?.();
            recovered = await recoveryDb.transaction().execute(async (trx) => {
              await sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
              await sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`.execute(trx);
              const context: PostgresCommandTransactionContext = {
                transactionId: Symbol('symphony-command-recovery-transaction'),
                kyselyTransaction: trx,
              };
              return recovery.resolveUncertainCommit(context);
            });
          } catch {
            throw new RetryableCommandTransactionError();
          }
          if (recovered !== null) return recovered;
          if (!uncertainReentered && attempt < 3) {
            uncertainReentered = true;
            continue;
          }
          throw new RetryableCommandTransactionError();
        }
        throw error;
      }
    }
    throw new RetryableCommandTransactionError();
  }
}

/** Test hooks model failures at the commit boundary without changing default runtime behavior. */
export interface PostgresCommandTransactionRunnerOptions {
  /** A separately pooled Kysely client, required to guarantee a fresh backend for receipt resolution. */
  readonly recoveryDb: Kysely<SymphonyDatabase>;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly faults?: {
    readonly beforeCommit?: (attempt: number) => Promise<void>;
    readonly afterCommit?: (attempt: number) => Promise<void>;
    readonly beforeUncertainLookup?: () => Promise<void>;
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { readonly code?: unknown; readonly cause?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  return candidate.cause === undefined ? undefined : findErrorCode(candidate.cause);
}

function isConnectionFailure(code: string | undefined): boolean {
  return code !== undefined && (
    code.startsWith('08') ||
    code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE' ||
    code === 'ETIMEDOUT' || code === 'ERR_STREAM_DESTROYED' || code === '57P01' ||
    code === '57P02' || code === '57P03'
  );
}

function isDisconnectedClient(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { readonly message?: unknown; readonly cause?: unknown };
  if (typeof candidate.message === 'string' && /connection (?:terminated unexpectedly|error and is not queryable)/i.test(candidate.message)) {
    return true;
  }
  return candidate.cause !== undefined && isDisconnectedClient(candidate.cause);
}
