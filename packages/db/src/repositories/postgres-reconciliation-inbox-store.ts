import type {
  CommandTransactionContext,
  EncryptedReconciliationInboxItem,
  ReconciliationLifecycle,
  ReconciliationInboxStore,
} from '@symphony/domain';
import { sql, type Transaction } from 'kysely';
import type { SymphonyDatabase } from '../types/database.js';
import type { PostgresCommandTransactionContext } from './postgres-repository.js';

export class PostgresReconciliationInboxStore implements ReconciliationInboxStore {
  async save(item: EncryptedReconciliationInboxItem, context?: CommandTransactionContext): Promise<void> {
    const trx = transactionFor(context);
    await trx.insertInto('symphony.reconciliation_inbox').values({
      reconciliation_id: item.reconciliation_id,
      tenant_id: item.tenant_id,
      payload_ciphertext: Buffer.from(item.payload_ciphertext),
      encryption_key_ref: item.encryption_key_ref,
      reason_code: item.reason_code,
      lifecycle: item.lifecycle,
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at),
      expires_at: new Date(item.expires_at),
      tombstoned_at: item.tombstoned_at === null ? null : new Date(item.tombstoned_at),
    }).execute();
  }

  async get(reconciliationId: string, tenantId: string, context?: CommandTransactionContext): Promise<EncryptedReconciliationInboxItem | null> {
    const trx = transactionFor(context);
    const row = await trx.selectFrom('symphony.reconciliation_inbox').selectAll()
      .where('reconciliation_id', '=', reconciliationId)
      .where('tenant_id', '=', tenantId)
      .executeTakeFirst();
    if (!row) return null;
    return {
      reconciliation_id: row.reconciliation_id,
      tenant_id: row.tenant_id,
      payload_ciphertext: row.payload_ciphertext === null ? new Uint8Array() : new Uint8Array(row.payload_ciphertext),
      encryption_key_ref: row.encryption_key_ref ?? '',
      reason_code: row.reason_code,
      lifecycle: row.lifecycle,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      expires_at: row.expires_at.toISOString(),
      tombstoned_at: row.tombstoned_at?.toISOString() ?? null,
    };
  }

  async transition(
    reconciliationId: string,
    tenantId: string,
    next: 'resolved' | 'superseded',
    updatedAt: string,
    context?: CommandTransactionContext,
  ): Promise<boolean> {
    const trx = transactionFor(context);
    const result = await trx.updateTable('symphony.reconciliation_inbox')
      .set({ lifecycle: next, updated_at: new Date(updatedAt) })
      .where('reconciliation_id', '=', reconciliationId)
      .where('tenant_id', '=', tenantId)
      .where('lifecycle', '=', 'open')
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }

  async expire(reconciliationId: string, tenantId: string, now: string, context?: CommandTransactionContext): Promise<boolean> {
    const trx = transactionFor(context);
    const tombstoneAt = new Date(now);
    const result = await trx.updateTable('symphony.reconciliation_inbox')
      .set({
        lifecycle: sql<ReconciliationLifecycle>`CASE WHEN lifecycle = 'open' THEN 'expired'::text ELSE lifecycle END`,
        payload_ciphertext: null,
        encryption_key_ref: null,
        updated_at: tombstoneAt,
        tombstoned_at: tombstoneAt,
      })
      .where('reconciliation_id', '=', reconciliationId)
      .where('tenant_id', '=', tenantId)
      .where('lifecycle', '!=', 'expired')
      .where('tombstoned_at', 'is', null)
      .where('expires_at', '<=', tombstoneAt)
      .executeTakeFirst();
    return result.numUpdatedRows === 1n;
  }
}

function transactionFor(context: CommandTransactionContext | undefined): Transaction<SymphonyDatabase> {
  if (!context || !('kyselyTransaction' in context)) {
    throw new TypeError('PostgresReconciliationInboxStore requires the active PostgreSQL command transaction');
  }
  return (context as PostgresCommandTransactionContext).kyselyTransaction;
}
