export interface Phase0MigrationAdminIdentity {
  database_name: string;
  server_version_num: string | number;
  rolsuper: boolean;
}

export interface Phase0MigrationRoleBootstrapState {
  migrationUrlUsername: string;
  migratorCanSetWriter: boolean;
}

export interface Phase0DatabaseRoleAttributes {
  rolcanlogin: boolean;
  rolinherit: boolean;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolbypassrls: boolean;
}

export type Phase0DatabaseRoleName =
  | 'symphony_migrator'
  | 'symphony_app'
  | 'symphony_outbox_writer';

export function assertPhase0MigrationAdminIdentity(identity: Phase0MigrationAdminIdentity | undefined): void;
export function migrationRoleNeedsBootstrap(state: Phase0MigrationRoleBootstrapState): boolean;
export function migrationRoleUrl(adminUrl: string, password: string): string;
export function roleContractErrors(
  name: Phase0DatabaseRoleName,
  role: Phase0DatabaseRoleAttributes,
): string[];
