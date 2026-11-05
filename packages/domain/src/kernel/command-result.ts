/**
 * @symphony/domain — kernel/command-result.ts
 *
 * Standard result type for command execution across the domain.
 */

export type CommandErrorCode =
  | 'IDEMPOTENT_REPLAY'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'STALE_VERSION'
  | 'TENANT_MISMATCH'
  | 'NOT_AUTHORISED_FOR_ORGANISATION'
  | 'UNAUTHORIZED'
  | 'PRECONDITION_FAILED'
  | 'DOMAIN_VIOLATION'
  | 'NOT_FOUND';

export type CommandResult<T> =
  | {
      readonly ok: true;
      readonly aggregateVersion: number;
      readonly eventIds: readonly string[];
      readonly data: T;
    }
  | {
      readonly ok: false;
      readonly code: CommandErrorCode;
      readonly detail: string;
    };
