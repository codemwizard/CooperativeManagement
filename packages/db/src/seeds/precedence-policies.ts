/**
 * @symphony/db — seeds/precedence-policies.ts
 *
 * Seeds the global default precedence policy: default_release_trigger = 'registered_current'.
 *
 * O-18 ruling: By-law amendments take effect only after registration with the
 * Registrar (Act s.20(2)). This is the safer default. The alternative
 * 'submitted_to_registrar' may be configured per organisation.
 *
 * Run:
 *   tsx src/seeds/precedence-policies.ts
 */

import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
const SCHEMA = process.env['DATABASE_SCHEMA'] ?? 'symphony';

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error('DATABASE_URL environment variable is required.');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seed(): Promise<void> {
  console.log('Seeding precedence_policies (global defaults)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    // O-18: default_release_trigger = 'registered_current' (organization_id = NULL = global)
    await client.query(
      `
      INSERT INTO ${SCHEMA}.precedence_policies
        (organization_id, default_release_trigger)
      VALUES (NULL, 'registered_current')
      ON CONFLICT DO NOTHING
      `,
    );
    console.log("  ✅ default_release_trigger = 'registered_current' (global default) — seeded");

    await client.query('COMMIT');
    console.log('\n✅ precedence_policies seed complete.');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

