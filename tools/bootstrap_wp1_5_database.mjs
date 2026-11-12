import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import pg from 'pg';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
if (!adminUrl || process.env.DATA_MODE !== 'test') {
  throw new Error('WP1.5 role bootstrap requires PHASE1_TEST_ADMIN_DATABASE_URL and DATA_MODE=test.');
}

const admin = new URL(adminUrl);
const databaseName = decodeURIComponent(admin.pathname.slice(1));
if (!databaseName.endsWith('_test')) throw new Error('WP1.5 bootstrap only accepts a *_test database.');
const db = new pg.Client({ connectionString: adminUrl });
const password = () => randomBytes(32).toString('base64url');
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

try {
  await db.connect();
  const identity = await db.query(
    "SELECT current_database() AS db, current_user AS role, current_setting('server_version_num') AS version, r.rolsuper, r.rolcreaterole FROM pg_roles r WHERE r.rolname = current_user",
  );
  if (identity.rows[0]?.db !== databaseName || Number(identity.rows[0]?.version) < 180000) {
    throw new Error('WP1.5 bootstrap database identity or PostgreSQL version is invalid.');
  }
  if (!identity.rows[0]?.rolsuper && !identity.rows[0]?.rolcreaterole) {
    throw new Error('WP1.5 bootstrap identity cannot provision isolated test roles.');
  }
  const existing = await db.query(
    "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])",
    [['symphony_migrator', 'symphony_app', 'symphony_outbox_writer']],
  );
  if (existing.rowCount) {
    throw new Error(`WP1.5 bootstrap found pre-existing role(s): ${existing.rows.map((row) => row.rolname).join(', ')}.`);
  }

  const migratorPassword = password();
  const appPassword = password();
  await db.query(`CREATE ROLE symphony_migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoteLiteral(migratorPassword)}`);
  await db.query(`CREATE ROLE symphony_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoteLiteral(appPassword)}`);
  await db.query('CREATE ROLE symphony_outbox_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  await db.query(`GRANT CONNECT, CREATE ON DATABASE ${quoteIdentifier(databaseName)} TO symphony_migrator`);
  await db.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO symphony_app`);
  // PostgreSQL requires temporary membership for ALTER FUNCTION OWNER. The CI finalizer revokes it before the gate is recorded.
  await db.query('GRANT symphony_outbox_writer TO symphony_migrator');

  const makeUrl = (role, rolePassword) => {
    const url = new URL(adminUrl);
    url.username = role;
    url.password = rolePassword;
    return url.toString();
  };
  const envPath = process.env.GITHUB_ENV;
  if (envPath) {
    await appendFile(envPath, [
      `MIGRATION_TEST_DATABASE_URL=${makeUrl('symphony_migrator', migratorPassword)}`,
      `DATABASE_URL=${makeUrl('symphony_migrator', migratorPassword)}`,
      `PHASE1_TEST_APP_DATABASE_URL=${makeUrl('symphony_app', appPassword)}`,
    ].join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  } else {
    throw new Error('GITHUB_ENV is required; role URLs are not printed or written to workspace files.');
  }
  console.log(`WP1.5 ephemeral roles provisioned for ${databaseName}; generated credentials were written only to the CI environment.`);
} finally {
  await db.end().catch(() => undefined);
}
