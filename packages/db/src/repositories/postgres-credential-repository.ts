import type { Pool, PoolClient } from 'pg';

export interface TemporaryCredentialRow {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly secretHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly revokedAt: string | null;
}

export interface IssueTemporaryCredentialInput {
  readonly credentialId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly secretHash: string;
}

export interface EstablishPasswordInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly temporaryCredentialId: string;
  readonly passwordHash: string;
}

export class TemporaryCredentialUnavailableError extends Error {
  constructor() {
    super('Temporary credential is unavailable');
    this.name = 'TemporaryCredentialUnavailableError';
  }
}

export class PasswordCredentialAlreadyEstablishedError extends Error {
  constructor() {
    super('Permanent password credential is already established');
    this.name = 'PasswordCredentialAlreadyEstablishedError';
  }
}

/** PostgreSQL persistence for the distinct REM-WP5.2 credential lifecycles. */
export class PostgresCredentialRepository {
  constructor(private readonly pool: Pool) {}

  async issueTemporaryCredential(input: IssueTemporaryCredentialInput): Promise<TemporaryCredentialRow> {
    return this.transaction(input.tenantId, async (client) => {
      await lockUserLifecycle(client, input.tenantId, input.userId);
      const user = await client.query<{ id: string }>(
        'SELECT id FROM symphony.users WHERE id = $1 AND tenant_id = $2',
        [input.userId, input.tenantId],
      );
      if (user.rowCount !== 1) throw new Error('Credential subject is unavailable');
      const existingPassword = await client.query(
        'SELECT 1 FROM symphony.password_credentials WHERE tenant_id = $1 AND user_id = $2',
        [input.tenantId, input.userId],
      );
      if (existingPassword.rowCount !== 0) throw new PasswordCredentialAlreadyEstablishedError();

      await client.query(
        `UPDATE symphony.temporary_credentials
         SET revoked_at = clock_timestamp()
         WHERE tenant_id = $1 AND user_id = $2 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [input.tenantId, input.userId],
      );

      const inserted = await client.query<{
        id: string; tenant_id: string; user_id: string; secret_hash: string;
        issued_at: Date; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null;
      }>(
        `WITH issuance AS (SELECT clock_timestamp() AS issued_at)
         INSERT INTO symphony.temporary_credentials
           (id, tenant_id, user_id, secret_hash, issued_at, expires_at)
         SELECT $1, $2, $3, $4, issuance.issued_at, issuance.issued_at + INTERVAL '72 hours'
         FROM issuance
         RETURNING id, tenant_id, user_id, secret_hash, issued_at, expires_at, consumed_at, revoked_at`,
        [input.credentialId, input.tenantId, input.userId, input.secretHash],
      );
      return this.mapTemporaryCredential(inserted.rows[0]!);
    });
  }

  async findCurrentTemporaryCredential(tenantId: string, userId: string): Promise<TemporaryCredentialRow | undefined> {
    return this.transaction(tenantId, async (client) => {
      const result = await client.query<{
        id: string; tenant_id: string; user_id: string; secret_hash: string;
        issued_at: Date; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null;
      }>(
        `SELECT id, tenant_id, user_id, secret_hash, issued_at, expires_at, consumed_at, revoked_at
         FROM symphony.temporary_credentials
         WHERE tenant_id = $1 AND user_id = $2 AND consumed_at IS NULL AND revoked_at IS NULL
         ORDER BY issued_at DESC LIMIT 1`,
        [tenantId, userId],
      );
      return result.rows[0] ? this.mapTemporaryCredential(result.rows[0]) : undefined;
    });
  }

  /** Consumes the temporary credential and creates the permanent password in one transaction. */
  async establishPermanentPassword(input: EstablishPasswordInput): Promise<void> {
    await this.transaction(input.tenantId, async (client) => {
      await lockUserLifecycle(client, input.tenantId, input.userId);
      const user = await client.query(
        'SELECT id FROM symphony.users WHERE id = $1 AND tenant_id = $2',
        [input.userId, input.tenantId],
      );
      if (user.rowCount !== 1) throw new TemporaryCredentialUnavailableError();

      const consumed = await client.query(
        `UPDATE symphony.temporary_credentials
         SET consumed_at = clock_timestamp()
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3
           AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp()`,
        [input.temporaryCredentialId, input.tenantId, input.userId],
      );
      if (consumed.rowCount !== 1) throw new TemporaryCredentialUnavailableError();

      try {
        await client.query(
          `INSERT INTO symphony.password_credentials (tenant_id, user_id, secret_hash)
           VALUES ($1, $2, $3)`,
          [input.tenantId, input.userId, input.passwordHash],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new PasswordCredentialAlreadyEstablishedError();
        throw error;
      }
    });
  }

  async findPermanentPasswordHash(tenantId: string, userId: string): Promise<string | undefined> {
    return this.transaction(tenantId, async (client) => {
      const result = await client.query<{ secret_hash: string }>(
        'SELECT secret_hash FROM symphony.password_credentials WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, userId],
      );
      return result.rows[0]?.secret_hash;
    });
  }

  private async transaction<T>(tenantId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapTemporaryCredential(row: {
    id: string; tenant_id: string; user_id: string; secret_hash: string;
    issued_at: Date; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null;
  }): TemporaryCredentialRow {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      secretHash: row.secret_hash,
      issuedAt: row.issued_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      consumedAt: row.consumed_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
    };
  }
}

/** Shared credential lifecycle serialization without UPDATE privilege on frozen users. */
async function lockUserLifecycle(client: PoolClient, tenantId: string, userId: string): Promise<void> {
  await client.query(
    `SELECT pg_advisory_xact_lock(
       hashtextextended('symphony.user-lifecycle:' || $1::text || ':' || $2::text, 0)
     )`,
    [tenantId, userId],
  );
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
