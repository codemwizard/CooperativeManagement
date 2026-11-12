/**
 * @symphony/db — __tests__/postgres-repository-contract.test.ts
 *
 * Runs the repository contract suite against PostgresRepository.
 *
 * Uses local PostgreSQL 18 (Docker not available in this environment).
 *
 * The contract suite generates fresh random tenantIds inside each test.
 * For PostgreSQL, those IDs must exist in the tenants table (FK constraint).
 * We use an AutoSeedingRepository wrapper that inserts unknown tenants on demand.
 *
 * Environment:
 *   DATABASE_URL   postgresql://symphony:symphony_dev@127.0.0.1:5432/symphony
 *   DATABASE_SCHEMA symphony
 */

import { afterAll, beforeAll, describe } from 'vitest';
import { sql, type Kysely } from 'kysely';
import {
  type AggregateRoot,
  type DomainEvent,
  type OutboxMessage,
} from '@symphony/domain';
import { createDb } from '../db/client.js';
import { PostgresRepository } from '../repositories/postgres-repository.js';
import { PostgresCommandTransactionRunner } from '../repositories/postgres-command-transaction.js';
import { runRepositoryContract } from '@symphony/testkit/contract-suite/repository-contract';
import type { SymphonyDatabase } from '../types/database.js';

const DATABASE_URL = process.env['PHASE1_TEST_APP_DATABASE_URL'];
const ADMIN_DATABASE_URL = process.env['PHASE1_TEST_ADMIN_DATABASE_URL'];

// All tenantIds seeded during the suite — cleaned up in afterAll
const seededTenantIds: string[] = [];

let db: Kysely<SymphonyDatabase>;
let recoveryDb: Kysely<SymphonyDatabase>;
let adminDb: Kysely<SymphonyDatabase>;
let runner: PostgresCommandTransactionRunner;

describe.skipIf(!DATABASE_URL || !ADMIN_DATABASE_URL)('PostgresRepository contract', () => {
beforeAll(async () => {
  db = createDb(DATABASE_URL ?? '', { max: 5 });
  recoveryDb = createDb(DATABASE_URL ?? '', { max: 2 });
  adminDb = createDb(ADMIN_DATABASE_URL ?? '', { max: 2 });
  runner = new PostgresCommandTransactionRunner(db, { recoveryDb });
});

afterAll(async () => {
  if (seededTenantIds.length > 0) {
    await adminDb.transaction().execute(async (trx) => {
      await sql`ALTER TABLE symphony.domain_events DISABLE TRIGGER domain_events_immutability`.execute(trx);
      try {
        for (const tid of seededTenantIds) {
          await sql`SELECT set_config('app.tenant_id', ${sql.lit(tid)}, false)`.execute(trx);

          await trx
            .deleteFrom('symphony.event_outbox')
            .where(
              'event_id',
              'in',
              trx.selectFrom('symphony.domain_events').select('id').where('tenant_id', '=', tid),
            )
            .execute();

          await trx.deleteFrom('symphony.domain_events').where('tenant_id', '=', tid).execute();
          await trx.deleteFrom('symphony.aggregate_states').where('tenant_id', '=', tid).execute();
          await trx.deleteFrom('symphony.tenants').where('id', '=', tid).execute();
        }
      } finally {
        await sql`ALTER TABLE symphony.domain_events ENABLE TRIGGER domain_events_immutability`.execute(trx);
      }
    });
  }

  await Promise.all([db.destroy(), recoveryDb.destroy(), adminDb.destroy()]);
});

/**
 * AutoSeedingRepository wraps PostgresRepository and auto-inserts any tenant
 * that appears in an aggregate into the tenants table before saving.
 * This is needed because the contract suite generates random tenantIds
 * internally and doesn't know about the FK constraint.
 */
class AutoSeedingRepository<T extends AggregateRoot> extends PostgresRepository<T> {
  private readonly seeded = new Set<string>();

  private async ensureTenant(tenantId: string): Promise<void> {
    if (this.seeded.has(tenantId)) return;
    await adminDb
      .insertInto('symphony.tenants')
      .values({ id: tenantId, name: `contract-auto-${tenantId}` })
      .onConflict((oc) => oc.doNothing())
      .execute();
    seededTenantIds.push(tenantId);
    this.seeded.add(tenantId);
  }

  override async save(
    aggregate: T,
    expectedVersion: number,
    events: readonly DomainEvent[],
    outboxMessages: readonly OutboxMessage[],
  ): Promise<void> {
    await this.ensureTenant(aggregate.tenantId);
    return runner.run(aggregate.tenantId, (context) =>
      super.save(aggregate, expectedVersion, events, outboxMessages, context),
    );
  }

  override async load(id: string, tenantId: string): Promise<T | null> {
    return runner.run(tenantId, (context) => super.load(id, tenantId, context));
  }
}

describe('PostgresRepository', () => {
  runRepositoryContract(() => new AutoSeedingRepository(db, 'ContractAggregate'));
});
});
