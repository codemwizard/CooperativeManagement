const rawUrl = process.env.MIGRATION_TEST_DATABASE_URL;
if (!rawUrl) {
  console.error('MIGRATION_TEST_DATABASE_URL is required for the migration integration gate.');
  process.exit(1);
}

try {
  const parsed = new URL(rawUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName.endsWith('_test')) {
    console.error('Migration integration gate requires a database name ending in _test.');
    process.exit(1);
  }
  if (process.env.DATA_MODE !== 'test') {
    console.error('Migration integration gate requires DATA_MODE=test.');
    process.exit(1);
  }
  console.log(`Migration test database configured: ${databaseName}`);
} catch {
  console.error('MIGRATION_TEST_DATABASE_URL is not a valid PostgreSQL URL.');
  process.exit(1);
}
