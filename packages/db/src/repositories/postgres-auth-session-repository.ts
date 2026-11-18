import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface AuthSubject {
  readonly tenantId: string;
  readonly userStatus: string;
  readonly temporaryCredentialId: string | null;
  readonly temporarySecretHash: string | null;
  readonly temporaryExpiresAt: string | null;
  readonly passwordSecretHash: string | null;
}

export interface AuthSessionRow {
  readonly tokenHash: Buffer;
  readonly csrfHash: Buffer;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly deviceId: string | null;
  readonly temporaryCredentialId: string | null;
  readonly forcedChangeRequired: boolean;
  readonly issuedAt: string;
  readonly lastActivityAt: string;
  readonly absoluteExpiresAt: string;
  readonly revokedAt: string | null;
}

export interface LoginAttemptReservation {
  readonly attemptId: string;
  readonly delayMs: number;
}

const WINDOW_SECONDS = 900;
const DELAYS_SECONDS = [1, 2, 4, 8, 16, 32] as const;

/** PostgreSQL-backed, cross-instance auth sessions and keyed login attempt history. */
export class PostgresAuthSessionRepository {
  constructor(private readonly pool: Pool) {}

  async lookupSubject(userId: string): Promise<AuthSubject | undefined> {
    const result = await this.pool.query<{
      tenant_id: string; user_status: string; temporary_credential_id: string | null;
      temporary_secret_hash: string | null; temporary_expires_at: Date | null; password_secret_hash: string | null;
    }>('SELECT * FROM symphony.lookup_auth_subject($1::uuid)', [userId]);
    const row = result.rows[0];
    return row ? {
      tenantId: row.tenant_id,
      userStatus: row.user_status,
      temporaryCredentialId: row.temporary_credential_id,
      temporarySecretHash: row.temporary_secret_hash,
      temporaryExpiresAt: row.temporary_expires_at?.toISOString() ?? null,
      passwordSecretHash: row.password_secret_hash,
    } : undefined;
  }

  async findSession(tokenHash: Buffer): Promise<AuthSessionRow | undefined> {
    const result = await this.pool.query<{
      token_hash: Buffer; csrf_hash: Buffer; tenant_id: string | null; user_id: string | null; device_id: string | null;
      temporary_credential_id: string | null; forced_change_required: boolean; issued_at: Date; last_activity_at: Date;
      absolute_expires_at: Date; revoked_at: Date | null;
    }>('SELECT * FROM symphony.lookup_auth_session($1)', [tokenHash]);
    const row = result.rows[0];
    return row ? {
      tokenHash: row.token_hash, csrfHash: row.csrf_hash, tenantId: row.tenant_id, userId: row.user_id,
      deviceId: row.device_id, temporaryCredentialId: row.temporary_credential_id,
      forcedChangeRequired: row.forced_change_required, issuedAt: row.issued_at.toISOString(),
      lastActivityAt: row.last_activity_at.toISOString(), absoluteExpiresAt: row.absolute_expires_at.toISOString(),
      revokedAt: row.revoked_at?.toISOString() ?? null,
    } : undefined;
  }

  async createPreAuthSession(tokenHash: Buffer, csrfHash: Buffer): Promise<void> {
    await this.pool.query(
      `WITH issuance AS (SELECT clock_timestamp() AS issued_at)
       INSERT INTO symphony.auth_sessions(token_hash, csrf_hash, issued_at, last_activity_at, absolute_expires_at)
       SELECT $1, $2, issuance.issued_at, issuance.issued_at, issuance.issued_at + INTERVAL '12 hours' FROM issuance`, [tokenHash, csrfHash],
    );
  }

  async refreshCsrf(tokenHash: Buffer, csrfHash: Buffer, tenantId?: string): Promise<boolean> {
    const update = async (client: PoolClient) => (await client.query(
      `UPDATE symphony.auth_sessions
          SET csrf_hash = $2, last_activity_at = clock_timestamp()
        WHERE token_hash = $1 AND revoked_at IS NULL
          AND absolute_expires_at > clock_timestamp()
          AND (user_id IS NULL OR last_activity_at > clock_timestamp() - INTERVAL '30 minutes')`,
      [tokenHash, csrfHash],
    )).rowCount === 1;
    if (tenantId) return this.transaction(tenantId, update);
    const client = await this.pool.connect();
    try { return await update(client); } finally { client.release(); }
  }

  async createAuthenticatedSession(input: {
    preAuthTokenHash: Buffer; tokenHash: Buffer; csrfHash: Buffer; tenantId: string; userId: string;
    deviceId: string; temporaryCredentialId: string | null; forcedChangeRequired: boolean;
  }): Promise<void> {
    await this.transaction(input.tenantId, async (client) => {
      const validTemp = input.temporaryCredentialId === null ? true : (await client.query(
        `SELECT 1 FROM symphony.temporary_credentials WHERE id=$1 AND tenant_id=$2 AND user_id=$3
         AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE`,
        [input.temporaryCredentialId, input.tenantId, input.userId],
      )).rowCount === 1;
      if (!validTemp) throw new Error('Authentication credential unavailable');
      const rotated = await client.query(
        `UPDATE symphony.auth_sessions SET revoked_at=clock_timestamp()
          WHERE token_hash=$1 AND user_id IS NULL AND revoked_at IS NULL
            AND absolute_expires_at > clock_timestamp()
            AND last_activity_at > clock_timestamp()-INTERVAL '30 minutes'`, [input.preAuthTokenHash],
      );
      if (rotated.rowCount !== 1) throw new Error('Pre-authentication session is unavailable');
      await client.query(
        `WITH issuance AS (SELECT clock_timestamp() AS issued_at)
         INSERT INTO symphony.auth_sessions
          (token_hash,csrf_hash,tenant_id,user_id,device_id,temporary_credential_id,forced_change_required,issued_at,last_activity_at,absolute_expires_at)
         SELECT $1,$2,$3,$4,$5,$6,$7,issuance.issued_at,issuance.issued_at,issuance.issued_at+INTERVAL '12 hours' FROM issuance`,
        [input.tokenHash,input.csrfHash,input.tenantId,input.userId,input.deviceId,input.temporaryCredentialId,input.forcedChangeRequired],
      );
      if (input.temporaryCredentialId !== null) {
        await client.query(
          `INSERT INTO symphony.authentication_events(user_id,method,result,device_id)
           VALUES($1,'first_login','success',$2)`,
          [input.userId,input.deviceId],
        );
      }
    });
  }

  async touchSession(tokenHash: Buffer, tenantId: string): Promise<boolean> {
    return this.transaction(tenantId, async (client) => {
      const result = await client.query(
        `UPDATE symphony.auth_sessions SET last_activity_at=clock_timestamp()
          WHERE token_hash=$1 AND tenant_id=$2 AND revoked_at IS NULL
            AND absolute_expires_at > clock_timestamp()
            AND last_activity_at > clock_timestamp()-INTERVAL '30 minutes'`, [tokenHash,tenantId],
      );
      return result.rowCount === 1;
    });
  }

  async revokeSession(tokenHash: Buffer, tenantId: string): Promise<void> {
    await this.transaction(tenantId, async (client) => {
      await client.query(
        'UPDATE symphony.auth_sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1 AND tenant_id=$2 AND revoked_at IS NULL',
        [tokenHash,tenantId],
      );
    });
  }

  async updatePermanentPasswordHash(tenantId: string, userId: string, passwordHash: string): Promise<void> {
    await this.transaction(tenantId, async (client) => {
      await client.query(
        `UPDATE symphony.password_credentials SET secret_hash=$3,hash_version='argon2id-v1',updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND user_id=$2`, [tenantId,userId,passwordHash],
      );
    });
  }

  async rotateAuthenticatedSession(input: {
    previousTokenHash: Buffer; nextTokenHash: Buffer; nextCsrfHash: Buffer; tenantId: string;
  }): Promise<boolean> {
    return this.transaction(input.tenantId, async (client) => {
      const current = await client.query<{
        user_id: string; device_id: string; temporary_credential_id: string | null; forced_change_required: boolean;
        issued_at: Date; last_activity_at: Date; absolute_expires_at: Date;
      }>(`SELECT user_id,device_id,temporary_credential_id,forced_change_required,issued_at,last_activity_at,absolute_expires_at
           FROM symphony.auth_sessions WHERE token_hash=$1 AND tenant_id=$2 AND revoked_at IS NULL
             AND absolute_expires_at > clock_timestamp()
             AND last_activity_at > clock_timestamp()-INTERVAL '30 minutes' FOR UPDATE`,
      [input.previousTokenHash,input.tenantId]);
      const row = current.rows[0];
      if (!row) return false;
      const revoked = await client.query(
        `UPDATE symphony.auth_sessions SET revoked_at=clock_timestamp()
          WHERE token_hash=$1 AND tenant_id=$2 AND revoked_at IS NULL`, [input.previousTokenHash,input.tenantId],
      );
      if (revoked.rowCount !== 1) return false;
      await client.query(
        `INSERT INTO symphony.auth_sessions
          (token_hash,csrf_hash,tenant_id,user_id,device_id,temporary_credential_id,forced_change_required,issued_at,last_activity_at,absolute_expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [input.nextTokenHash,input.nextCsrfHash,input.tenantId,row.user_id,row.device_id,row.temporary_credential_id,
          row.forced_change_required,row.issued_at,row.last_activity_at,row.absolute_expires_at],
      );
      return true;
    });
  }

  async establishPasswordAndRevokeSessions(input: {
    tenantId: string; userId: string; temporaryCredentialId: string; passwordHash: string;
  }): Promise<void> {
    await this.transaction(input.tenantId, async (client) => {
      await client.query('SELECT id FROM symphony.users WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [input.userId,input.tenantId]);
      const consumed = await client.query(
        `UPDATE symphony.temporary_credentials SET consumed_at=clock_timestamp()
          WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > clock_timestamp()`, [input.temporaryCredentialId,input.tenantId,input.userId],
      );
      if (consumed.rowCount !== 1) throw new Error('Temporary credential unavailable');
      await client.query(
        'INSERT INTO symphony.password_credentials(tenant_id,user_id,secret_hash) VALUES($1,$2,$3)',
        [input.tenantId,input.userId,input.passwordHash],
      );
      await client.query(
        `UPDATE symphony.auth_sessions SET revoked_at=clock_timestamp()
          WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`, [input.tenantId,input.userId],
      );
    });
  }

  async reserveAttempt(accountHmac: Buffer, sourceHmac: Buffer): Promise<LoginAttemptReservation> {
    const attemptId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockIdentities(client, accountHmac, sourceHmac);
      await client.query(
        `WITH expired AS (
           SELECT ctid FROM symphony.auth_attempt_events
            WHERE occurred_at <= clock_timestamp()-INTERVAL '${WINDOW_SECONDS} seconds'
            LIMIT 500
         ) DELETE FROM symphony.auth_attempt_events e USING expired WHERE e.ctid=expired.ctid`,
      );
      const counts = await client.query<{ dimension: string; total: number }>(
        `SELECT dimension, count(*)::int AS total FROM symphony.auth_attempt_events
          WHERE occurred_at > clock_timestamp()-INTERVAL '${WINDOW_SECONDS} seconds'
            AND ((dimension='account' AND identity_hmac=$1) OR (dimension='trusted_source' AND identity_hmac=$2))
          GROUP BY dimension`, [accountHmac,sourceHmac],
      );
      let delayMs = 0;
      for (const row of counts.rows) {
        const priorFailures = row.total;
        if (priorFailures >= 5) delayMs = Math.max(delayMs, DELAYS_SECONDS[Math.min(priorFailures - 5, DELAYS_SECONDS.length - 1)]! * 1000);
      }
      await client.query(
        `INSERT INTO symphony.auth_attempt_events(attempt_id,dimension,identity_hmac,state)
         VALUES($1,'account',$2,'reserved'),($1,'trusted_source',$3,'reserved')`, [attemptId,accountHmac,sourceHmac],
      );
      await client.query('COMMIT');
      return { attemptId, delayMs };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async finishAttempt(input: { attemptId: string; accountHmac: Buffer; sourceHmac: Buffer; success: boolean }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockIdentities(client, input.accountHmac, input.sourceHmac);
      if (input.success) {
        await client.query("DELETE FROM symphony.auth_attempt_events WHERE dimension='account' AND identity_hmac=$1", [input.accountHmac]);
        await client.query("DELETE FROM symphony.auth_attempt_events WHERE attempt_id=$1 AND dimension='trusted_source' AND state='reserved'", [input.attemptId]);
      } else {
        await client.query("UPDATE symphony.auth_attempt_events SET state='failed', occurred_at=clock_timestamp() WHERE attempt_id=$1", [input.attemptId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async abandonAttempt(input: { attemptId: string; accountHmac: Buffer; sourceHmac: Buffer }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockIdentities(client,input.accountHmac,input.sourceHmac);
      await client.query("DELETE FROM symphony.auth_attempt_events WHERE attempt_id=$1 AND state='reserved'",[input.attemptId]);
      await client.query('COMMIT');
    } catch(error) {
      await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    } finally {client.release();}
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.pool.query('SELECT 1');
    return result.rowCount === 1;
  }

  private async lockIdentities(client: PoolClient, accountHmac: Buffer, sourceHmac: Buffer): Promise<void> {
    const lockKeys = [accountHmac.toString('hex'), sourceHmac.toString('hex')].sort();
    for (const key of lockKeys) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  }

  private async transaction<T>(tenantId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}
