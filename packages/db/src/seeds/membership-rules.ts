/**
 * @symphony/db — seeds/membership-rules.ts
 *
 * Seeds the global default membership rule: allow_minor_members = false.
 *
 * O-21 ruling: Minor members are disabled by default.
 * Legal reviewer must advise on guardian consent before this can be enabled.
 * The rule is stored with organization_id = NULL to mark it as the global default.
 *
 * Run:
 *   tsx src/seeds/membership-rules.ts
 */

import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
const SCHEMA = process.env['DATABASE_SCHEMA'] ?? 'symphony';

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error('DATABASE_URL environment variable is required.');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seed(): Promise<void> {
  console.log('Seeding membership_rules (global defaults)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    // O-21: allow_minor_members = false (global default; organization_id = NULL)
    await client.query(
      `
      INSERT INTO ${SCHEMA}.membership_rules
        (organization_id, rule_type, rule_value, source_ref)
      VALUES (NULL, 'allow_minor_members', $1, 'O-21: Legal reviewer advisory pending; default off')
      ON CONFLICT DO NOTHING
      `,
      [JSON.stringify(false)],
    );
    console.log('  ✅ allow_minor_members = false (global default) — seeded');

    await client.query('COMMIT');
    console.log('\n✅ membership_rules seed complete.');
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

