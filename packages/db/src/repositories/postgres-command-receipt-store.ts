import { createCommandReceiptSchema, type CommandResultDataSchemas } from '@symphony/contracts';
import type { CommandReceipt, CommandReceiptStore, CommandTransactionContext } from '@symphony/domain';
import type { Transaction } from 'kysely';
import type { SymphonyDatabase } from '../types/database.js';
import type { PostgresCommandTransactionContext } from './postgres-repository.js';

/** Strict migration-0009 mapping; raw request fields have no persistence path. */
export class PostgresCommandReceiptStore implements CommandReceiptStore {
  private readonly schema: ReturnType<typeof createCommandReceiptSchema>;

  constructor(private readonly resultDataSchemas: CommandResultDataSchemas) {
    this.schema = createCommandReceiptSchema(resultDataSchemas);
  }

  async get(commandId: string, tenantId: string, context?: CommandTransactionContext): Promise<CommandReceipt | null> {
    const trx = transactionFor(context);
    const row = await trx.selectFrom('symphony.command_receipts').selectAll()
      .where('tenant_id', '=', tenantId).where('command_id', '=', commandId).executeTakeFirst();
    if (!row) return null;
    const value: CommandReceipt = {
      tenant_id: row.tenant_id,
      command_id: row.command_id,
      actor_user_id: row.actor_user_id,
      command_type: row.command_type,
      command_schema_version: row.command_schema_version,
      canonicalization_version: row.canonicalization_version as CommandReceipt['canonicalization_version'],
      digest_key_version: row.digest_key_version,
      semantic_digest: new Uint8Array(row.semantic_digest),
      result_classification: row.result_classification,
      result_schema_version: row.result_schema_version as CommandReceipt['result_schema_version'],
      safe_result: row.safe_result,
      recorded_at: row.recorded_at.toISOString(),
    };
    return this.schema.parse(value);
  }

  async save(receipt: CommandReceipt, context?: CommandTransactionContext): Promise<void> {
    const valid = this.schema.parse(receipt);
    const trx = transactionFor(context);
    await trx.insertInto('symphony.command_receipts').values({
      tenant_id: valid.tenant_id,
      command_id: valid.command_id,
      actor_user_id: valid.actor_user_id,
      command_type: valid.command_type,
      command_schema_version: valid.command_schema_version,
      canonicalization_version: valid.canonicalization_version,
      digest_key_version: valid.digest_key_version,
      semantic_digest: Buffer.from(valid.semantic_digest),
      result_classification: valid.result_classification,
      result_schema_version: valid.result_schema_version,
      safe_result: JSON.stringify(valid.safe_result),
    }).execute();
  }
}

function transactionFor(context: CommandTransactionContext | undefined): Transaction<SymphonyDatabase> {
  if (!context || !('kyselyTransaction' in context)) {
    throw new TypeError('PostgresCommandReceiptStore requires the active PostgreSQL command transaction');
  }
  return (context as PostgresCommandTransactionContext).kyselyTransaction;
}
