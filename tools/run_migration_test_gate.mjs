import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import {
  assertPhase0MigrationAdminIdentity,
  migrationRoleNeedsBootstrap,
  migrationRoleUrl,
  roleContractErrors,
} from './phase0-migration-role.mjs';

const { Client } = pg;
const roleNames = ['symphony_migrator', 'symphony_app', 'symphony_outbox_writer'];
const env = { ...process.env };
const adminUrl = env.PHASE1_TEST_ADMIN_DATABASE_URL;
const configuredMigrationUrl = env.MIGRATION_TEST_DATABASE_URL;
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const safePassword = () => randomBytes(32).toString('base64url');

if (env.DATA_MODE !== 'test' || !adminUrl || !configuredMigrationUrl) {
  console.error('Migration test gate requires DATA_MODE=test and both isolated administrator and migration database URLs.');
  process.exit(1);
}

let admin;
let childStatus = 1;
let bootstrapNeeded = false;
let temporaryPassword;
let previousPasswordVerifier;
let migratorExisted = false;
let membershipAdded = false;
const createdRoles = [];
const temporaryDatabaseGrants = [];
let fatalError;

try {
  const adminIdentityUrl = new URL(adminUrl);
  const configuredDbUrl = new URL(configuredMigrationUrl);
  const adminDatabaseName = decodeURIComponent(adminIdentityUrl.pathname.replace(/^\//, ''));
  const configuredDatabaseName = decodeURIComponent(configuredDbUrl.pathname.replace(/^\//, ''));
  if (!adminDatabaseName.endsWith('_test') || configuredDatabaseName !== adminDatabaseName) {
    throw new Error('Refusing migration test setup: both database URLs must identify the same *_test database.');
  }

  admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const identityResult = await admin.query(
    `SELECT current_database() AS database_name,
            current_setting('server_version_num') AS server_version_num,
            role.rolsuper
     FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user`,
  );
  assertPhase0MigrationAdminIdentity(identityResult.rows[0]);
  if (identityResult.rows[0].database_name !== adminDatabaseName) {
    throw new Error('Administrator URL database does not match the requested isolated test database.');
  }

  const rolesResult = await admin.query(
    `SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls,
            CASE
              WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'symphony_migrator')
               AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'symphony_outbox_writer')
              THEN pg_catalog.pg_has_role('symphony_migrator', 'symphony_outbox_writer', 'SET')
              ELSE false
            END AS migrator_can_set_writer,
            (SELECT rolpassword FROM pg_catalog.pg_authid WHERE rolname = 'symphony_migrator') AS migrator_password_verifier
     FROM pg_catalog.pg_roles
     WHERE rolname = ANY($1::text[])`,
    [roleNames],
  );
  const rolesByName = new Map(rolesResult.rows.map((row) => [row.rolname, row]));
  for (const name of roleNames) {
    const role = rolesByName.get(name);
    if (role) {
      const errors = roleContractErrors(name, role);
      if (errors.length) throw new Error(`Existing database role contract is invalid: ${errors.join('; ')}.`);
    }
  }

  const migratorRole = rolesByName.get('symphony_migrator');
  migratorExisted = Boolean(migratorRole);
  const canSetWriter = migratorRole?.migrator_can_set_writer === true;
  const missingRole = roleNames.some((name) => !rolesByName.has(name));
  const requiredPrivileges = migratorRole
    ? await admin.query(
      `SELECT has_database_privilege('symphony_migrator', current_database(), 'CONNECT') AS can_connect,
              has_database_privilege('symphony_migrator', current_database(), 'CREATE') AS can_create`,
    )
    : { rows: [{ can_connect: false, can_create: false }] };
  bootstrapNeeded = migrationRoleNeedsBootstrap({
    migrationUrlUsername: decodeURIComponent(configuredDbUrl.username),
    migratorCanSetWriter: canSetWriter,
  }) || missingRole || requiredPrivileges.rows[0]?.can_connect !== true || requiredPrivileges.rows[0]?.can_create !== true;

  if (bootstrapNeeded) {
    for (const name of roleNames) {
      if (rolesByName.has(name)) continue;
      if (name === 'symphony_migrator') {
        temporaryPassword = safePassword();
        await admin.query(`CREATE ROLE symphony_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoteLiteral(temporaryPassword)}`);
      } else if (name === 'symphony_app') {
        await admin.query(`CREATE ROLE symphony_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoteLiteral(safePassword())}`);
      } else {
        await admin.query('CREATE ROLE symphony_outbox_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
      }
      createdRoles.push(name);
    }

    if (migratorExisted) {
      const verifier = migratorRole.migrator_password_verifier;
      previousPasswordVerifier = verifier === null ? null : verifier;
      temporaryPassword = safePassword();
      await admin.query(`ALTER ROLE symphony_migrator PASSWORD ${temporaryPassword === null ? 'NULL' : quoteLiteral(temporaryPassword)}`);
    }
    if (!canSetWriter) {
      await admin.query('GRANT symphony_outbox_writer TO symphony_migrator');
      membershipAdded = true;
    }

    for (const privilege of ['CONNECT', 'CREATE']) {
      const check = await admin.query('SELECT has_database_privilege($1, current_database(), $2) AS allowed', ['symphony_migrator', privilege]);
      if (check.rows[0]?.allowed !== true) {
        await admin.query(`GRANT ${privilege} ON DATABASE ${quoteIdentifier(adminDatabaseName)} TO symphony_migrator`);
        temporaryDatabaseGrants.push(privilege);
      }
    }
  }

  const migrationUrl = bootstrapNeeded
    ? migrationRoleUrl(adminUrl, temporaryPassword ?? safePassword())
    : configuredMigrationUrl;
  if (bootstrapNeeded && !temporaryPassword) {
    throw new Error('Cannot provision a temporary migrator credential for the isolated migration test gate.');
  }

  const npmCli = env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = npmCli
    ? [npmCli, 'run', 'test:migrations', '--workspace', '@symphony/db']
    : ['run', 'test:migrations', '--workspace', '@symphony/db'];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...env, MIGRATION_TEST_DATABASE_URL: migrationUrl },
    stdio: 'inherit',
    shell: !npmCli && process.platform === 'win32',
  });
  if (result.error) throw result.error;
  childStatus = result.status ?? 1;
} catch (error) {
  fatalError = error;
} finally {
  if (admin) {
    const cleanupErrors = [];
    const cleanup = async (operation) => {
      try { await operation(); } catch (error) { cleanupErrors.push(error); }
    };
    if (membershipAdded) await cleanup(() => admin.query('REVOKE symphony_outbox_writer FROM symphony_migrator'));
    const databaseName = decodeURIComponent(new URL(adminUrl).pathname.replace(/^\//, ''));
    for (const privilege of temporaryDatabaseGrants.reverse()) {
      await cleanup(() => admin.query(`REVOKE ${privilege} ON DATABASE ${quoteIdentifier(databaseName)} FROM symphony_migrator`));
    }
    if (migratorExisted && temporaryPassword !== undefined) {
      const restoredPassword = previousPasswordVerifier === null ? 'NULL' : quoteLiteral(previousPasswordVerifier);
      await cleanup(() => admin.query(`ALTER ROLE symphony_migrator PASSWORD ${restoredPassword}`));
    }
    for (const role of [...createdRoles].reverse()) {
      await cleanup(() => admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`));
    }
    if (cleanupErrors.length) {
      const details = cleanupErrors.map((error) => error instanceof Error ? error.message : String(error)).join('; ');
      fatalError = fatalError
        ? new Error(`${fatalError instanceof Error ? fatalError.message : String(fatalError)}; cleanup also failed: ${details}`)
        : new Error(`Migration test role cleanup failed: ${details}`);
    }
    await admin.end().catch((cleanupError) => { fatalError ??= cleanupError; });
  }
}

if (fatalError) {
  console.error(`Migration test gate failed: ${fatalError instanceof Error ? fatalError.message : String(fatalError)}`);
  process.exit(1);
}
process.exitCode = childStatus;
