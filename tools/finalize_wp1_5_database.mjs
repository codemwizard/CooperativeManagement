import pg from 'pg';

const adminUrl = process.env.PHASE1_TEST_ADMIN_DATABASE_URL;
if (!adminUrl || process.env.DATA_MODE !== 'test') {
  throw new Error('WP1.5 role finalization requires PHASE1_TEST_ADMIN_DATABASE_URL and DATA_MODE=test.');
}
const url = new URL(adminUrl);
const databaseName = decodeURIComponent(url.pathname.slice(1));
if (!databaseName.endsWith('_test')) throw new Error('WP1.5 finalization only accepts a *_test database.');

const db = new pg.Client({ connectionString: adminUrl });
try {
  await db.connect();
  await db.query('REVOKE symphony_outbox_writer FROM symphony_migrator');
  const result = await db.query(
    `SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolinherit, r.rolbypassrls,
            EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS inherits_role,
            EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.roleid = r.oid) AS has_members
     FROM pg_roles r WHERE r.rolname IN ('symphony_app','symphony_outbox_writer') ORDER BY r.rolname`,
  );
  const app = result.rows.find((row) => row.rolname === 'symphony_app');
  const writer = result.rows.find((row) => row.rolname === 'symphony_outbox_writer');
  if (!app || !app.rolcanlogin || app.rolsuper || app.rolcreatedb || app.rolcreaterole || app.rolinherit || app.rolbypassrls || app.inherits_role || app.has_members) {
    throw new Error('symphony_app final role attributes or memberships violate the WP1.5 contract.');
  }
  if (!writer || writer.rolcanlogin || writer.rolsuper || writer.rolcreatedb || writer.rolcreaterole || writer.rolinherit || writer.rolbypassrls || writer.inherits_role || writer.has_members) {
    throw new Error('symphony_outbox_writer final role attributes or memberships violate the WP1.5 contract.');
  }
  console.log(`WP1.5 role finalization verified for ${databaseName}; migrator membership was revoked.`);
} finally {
  await db.end().catch(() => undefined);
}
