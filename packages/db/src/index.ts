/**
 * @symphony/db — SQL migrations, seeds, Kysely repository adapters
 */

export const VERSION = '0.1.0';

// Command-path transaction and persistence adapters (Phase 1 — WP1.2)
export { PostgresRepository } from './repositories/postgres-repository.js';
export { PostgresCommandReceiptStore } from './repositories/postgres-command-receipt-store.js';
export { PostgresReconciliationInboxStore } from './repositories/postgres-reconciliation-inbox-store.js';
export { PostgresCommandTransactionRunner } from './repositories/postgres-command-transaction.js';
export { acquireAuthorityScopeLocks, authorityScopeKey } from './repositories/postgres-authority-scope-locks.js';
export { checkAuthorityScopeReadiness } from './repositories/postgres-authority-scope-readiness.js';
export type { AuthorityLockMode, AuthorityScopeKey, AuthorityScopeLockRequest, AuthorityScopeLockSet, AuthorityScopeType, Phase1AuthorityAction } from './repositories/postgres-authority-scope-locks.js';
export { PostgresSecurityAttemptWriter, validateSecurityAttemptRuntimeProfile } from './repositories/postgres-security-attempt-writer.js';
export type { SecurityAttemptRuntimeProfile } from './repositories/postgres-security-attempt-writer.js';
export { PostgresCredentialRepository, PasswordCredentialAlreadyEstablishedError, TemporaryCredentialUnavailableError } from './repositories/postgres-credential-repository.js';
export type { EstablishPasswordInput, IssueTemporaryCredentialInput, TemporaryCredentialRow } from './repositories/postgres-credential-repository.js';
export { PostgresAuthSessionRepository } from './repositories/postgres-auth-session-repository.js';
export type { AuthSessionRow, AuthSubject, LoginAttemptReservation } from './repositories/postgres-auth-session-repository.js';
export { PostgresWorkspaceContextRepository } from './repositories/postgres-workspace-context-repository.js';
export { PostgresVerifiedFindingRepository } from './repositories/postgres-verified-finding-repository.js';
export type { WorkspaceAuthorityFact, WorkspaceContextFacts } from './repositories/postgres-workspace-context-repository.js';

// DB types (Phase 1 — WP-1.3)
export type { SymphonyDatabase } from './types/database.js';
export { createDb } from './db/client.js';

