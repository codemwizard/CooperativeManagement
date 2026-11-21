import { createHmac, randomUUID } from 'node:crypto';
import {
  CommandBus,
  type CommandDigestKeyProvider,
} from '@symphony/domain';
import {
  PostgresCapacityDelegationPolicyStore,
  PostgresCommandReceiptStore,
  PostgresCommandTransactionRunner,
  PostgresRepository,
  PostgresSecurityAttemptWriter,
  createCapacityDelegationHandlers,
  createDb,
  validateSecurityAttemptRuntimeProfile,
  type AuthorityMutationAggregate,
} from '@symphony/db';
import { capacityDelegationCommandResultDataSchemas } from '@symphony/contracts';

class EnvironmentDigestKeyProvider implements CommandDigestKeyProvider {
  readonly #key: Buffer;
  constructor(encoded: string) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('COMMAND_DIGEST_HMAC_KEY must be base64 key material.');
    this.#key = Buffer.from(encoded, 'base64');
    if (this.#key.length < 32 || this.#key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
      throw new Error('COMMAND_DIGEST_HMAC_KEY must decode to at least 32 bytes.');
    }
  }
  activeVersion(): string { return 'command-digest-hmac-v1'; }
  async hmac(version: string, canonicalBytes: Uint8Array): Promise<Uint8Array> {
    if (version !== this.activeVersion()) throw new Error('Command digest key version is unavailable.');
    return createHmac('sha256', this.#key).update(canonicalBytes).digest();
  }
}

export interface PostgresCommandComposition {
  readonly bus: CommandBus<AuthorityMutationAggregate>;
  readonly handlers: ReturnType<typeof createCapacityDelegationHandlers>;
  close(): Promise<void>;
}

/** Production command facade: every adapter uses the restricted app DB URL. */
export function createPostgresCommandComposition(environment: NodeJS.ProcessEnv): PostgresCommandComposition {
  const databaseUrl = environment['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the command API.');
  const digestKey = environment['COMMAND_DIGEST_HMAC_KEY'];
  if (!digestKey) throw new Error('COMMAND_DIGEST_HMAC_KEY is required for the command API.');
  const db = createDb(databaseUrl, { max: 10 });
  const recoveryDb = createDb(databaseUrl, { max: 2 });
  const policyStore = new PostgresCapacityDelegationPolicyStore();
  const handlers = createCapacityDelegationHandlers(policyStore);
  const bus = new CommandBus<AuthorityMutationAggregate>({
    repository: new PostgresRepository<AuthorityMutationAggregate>(db, 'authority_mutation'),
    receiptStore: new PostgresCommandReceiptStore(capacityDelegationCommandResultDataSchemas),
    policyStore,
    clock: { now: () => new Date().toISOString() },
    idGen: { generate: randomUUID },
    transactionRunner: new PostgresCommandTransactionRunner(db, { recoveryDb }),
    securityAttemptWriter: new PostgresSecurityAttemptWriter(
      db, validateSecurityAttemptRuntimeProfile(environment),
    ),
    digestKeyProvider: new EnvironmentDigestKeyProvider(digestKey),
    resultDataSchemas: capacityDelegationCommandResultDataSchemas,
  });
  return {
    bus,
    handlers,
    async close() { await Promise.all([db.destroy(), recoveryDb.destroy()]); },
  };
}
