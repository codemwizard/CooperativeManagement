import { sql, type Kysely } from 'kysely';
import type { SecurityAttempt, SecurityAttemptWriter } from '@symphony/domain';
import type { SymphonyDatabase } from '../types/database.js';

declare const validatedProfileBrand: unique symbol;
export interface SecurityAttemptRuntimeProfile {
  readonly [validatedProfileBrand]: true;
  readonly dataMode: 'test';
  readonly syntheticOnly: true;
}

/** Build only from server process configuration at composition time. */
export function validateSecurityAttemptRuntimeProfile(environment: NodeJS.ProcessEnv): SecurityAttemptRuntimeProfile {
  if (environment['NODE_ENV'] !== 'test' || environment['DATA_MODE'] !== 'test' || environment['SYNTHETIC_ONLY'] !== 'true') {
    throw new Error('Security-attempt auditing requires validated synthetic test runtime configuration');
  }
  return Object.freeze({ dataMode: 'test', syntheticOnly: true }) as SecurityAttemptRuntimeProfile;
}

/** Writes denial observations on a fresh transaction, separate from command work. */
export class PostgresSecurityAttemptWriter implements SecurityAttemptWriter {
  constructor(
    private readonly db: Kysely<SymphonyDatabase>,
    private readonly profile: SecurityAttemptRuntimeProfile,
  ) {}

  async record(attempt: SecurityAttempt): Promise<void> {
    if (this.profile.dataMode !== 'test' || this.profile.syntheticOnly !== true) {
      console.error('security_audit_write_failed');
      throw new Error('Security-attempt auditing is unavailable for this runtime profile');
    }
    try {
      await this.db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.tenant_id', ${attempt.tenantId}, true)`.execute(trx);
        const result = await trx.insertInto('symphony.security_attempts').values({
          tenant_id: attempt.tenantId,
          actor_user_id: attempt.actorUserId,
          observed_command_id: attempt.observedCommandId ?? null,
          observed_command_type: attempt.observedCommandType ?? null,
          denial_code: attempt.denialCode,
        }).executeTakeFirst();
        if (result.numInsertedOrUpdatedRows !== 1n) {
          throw new Error('Security-attempt insert was not acknowledged');
        }
      });
    } catch {
      console.error('security_audit_write_failed');
      throw new Error('Security-attempt audit unavailable');
    }
  }
}
