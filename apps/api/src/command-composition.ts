import { createHmac, randomUUID } from 'node:crypto';
import {
  CommandBus,
  type CommandDigestKeyProvider,
  type KeyProvider,
  type ReconciliationRetentionPolicy,
} from '@symphony/domain';
import {
  PostgresCapacityDelegationPolicyStore,
  PostgresCommandReceiptStore,
  PostgresCommandTransactionRunner,
  PostgresRepository,
  PostgresSecurityAttemptWriter,
  PostgresReconciliationInboxStore,
  createCapacityDelegationHandlers,
  createDb,
  validateSecurityAttemptRuntimeProfile,
  type AuthorityMutationAggregate,
} from '@symphony/db';
import { LocalDevKeyProvider } from '@symphony/domain/privacy/key-provider';
import {
  capacityDelegationCommandReconciliationDataSchemas,
  capacityDelegationCommandResultDataSchemas,
} from '@symphony/contracts';

export interface PostgresCommandCompositionOptions {
  /** Production deployments must inject their approved KMS-backed field encryptor. */
  readonly fieldEncryption?: Pick<KeyProvider, 'encrypt'>;
  readonly reconciliationRetentionPolicy?: ReconciliationRetentionPolicy;
}

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
export function createPostgresCommandComposition(
  environment: NodeJS.ProcessEnv,
  options: PostgresCommandCompositionOptions = {},
): PostgresCommandComposition {
  const databaseUrl = environment['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the command API.');
  const digestKey = environment['COMMAND_DIGEST_HMAC_KEY'];
  if (!digestKey) throw new Error('COMMAND_DIGEST_HMAC_KEY is required for the command API.');
  const db = createDb(databaseUrl, { max: 10 });
  const recoveryDb = createDb(databaseUrl, { max: 2 });
  const policyStore = new PostgresCapacityDelegationPolicyStore();
  const handlers = createCapacityDelegationHandlers(policyStore);
  const syntheticTest = environment['NODE_ENV'] === 'test'
    && environment['DATA_MODE'] === 'test'
    && environment['SYNTHETIC_ONLY'] === 'true';
  const fieldEncryption = options.fieldEncryption ?? (syntheticTest
    ? new LocalDevKeyProvider({
        rootKeyHex: environment['SYMPHONY_ROOT_KEY_HEX'] ?? Buffer.alloc(32, 0x71).toString('hex'),
        pepper: Buffer.from(environment['SYMPHONY_BLIND_PEPPER'] ?? 'phase1-synthetic-test-only', 'utf8'),
      })
    : undefined);
  if (!fieldEncryption) {
    throw new Error('An approved reconciliation field-encryption provider is required outside synthetic test mode.');
  }
  const reconciliationRetentionPolicy = options.reconciliationRetentionPolicy
    ?? createReconciliationRetentionPolicy(environment, syntheticTest);
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
    reconciliationInboxStore: new PostgresReconciliationInboxStore(),
    reconciliationDataSchemas: capacityDelegationCommandReconciliationDataSchemas,
    fieldEncryption,
    reconciliationRetentionPolicy,
  });
  return {
    bus,
    handlers,
    async close() { await Promise.all([db.destroy(), recoveryDb.destroy()]); },
  };
}

function createReconciliationRetentionPolicy(
  environment: NodeJS.ProcessEnv,
  syntheticTest: boolean,
): ReconciliationRetentionPolicy {
  const configuredSeconds = environment['COMMAND_RECONCILIATION_RETENTION_SECONDS'];
  // This bounded value is only a synthetic CI/test harness default. Non-test
  // environments must supply the owner-approved category retention config.
  const seconds = configuredSeconds === undefined && syntheticTest ? 3600 : Number(configuredSeconds);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error('COMMAND_RECONCILIATION_RETENTION_SECONDS must be configured as a positive integer.');
  }
  return {
    expiryFor: async ({ recordedAt }) => {
      const timestamp = Date.parse(recordedAt);
      const expiresAt = timestamp + seconds * 1000;
      if (!Number.isFinite(timestamp) || !Number.isFinite(expiresAt)) {
        throw new Error('Configured reconciliation retention expiry is invalid.');
      }
      return new Date(expiresAt).toISOString();
    },
  };
}
