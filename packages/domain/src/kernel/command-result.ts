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
  | 'DOMAIN_CONFLICT'
  | 'NOT_FOUND'
  | 'COMMAND_TEMPORARILY_UNAVAILABLE';

export type CommandResult<T> =
  | {
      readonly ok: true;
      /** Transport metadata; never persisted in the immutable receipt. */
      readonly replayed?: true;
      readonly aggregateVersion: number;
      readonly eventIds: readonly string[];
      readonly data: T;
    }
  | {
      readonly ok: false;
      /** Present only when a previously committed terminal receipt was replayed. */
      readonly replayed?: true;
      readonly code: CommandErrorCode;
      readonly detail: string;
    };
