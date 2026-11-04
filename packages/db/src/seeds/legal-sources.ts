/**
 * @symphony/db — seeds/legal-sources.ts
 *
 * Seeds the legal_sources table with the statutory instruments that govern
 * cooperative society registration in Zambia.
 *
 * Sources verified against:
 *  - Full Co-operative Societies Act No. 20 of 1998 (read O-20)
 *  - Co-operative Societies Regulations 1999, SI 26 of 1999
 *  - Cap. 397 (1970, repealed by Act No. 20 of 1998 s.85)
 *
 * Run:
 *   tsx src/seeds/legal-sources.ts
 *   npm run db:seed:legal   (from repo root)
 */

import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
const SCHEMA = process.env['DATABASE_SCHEMA'] ?? 'symphony';

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error('DATABASE_URL environment variable is required.');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface LegalSource {
  instrument_ref: string;
  title: string;
  instrument_type: string;
  legal_validation_status: string;
  notes: string;
}

const LEGAL_SOURCES: LegalSource[] = [
  {
    instrument_ref: 'ZMB-CSA-1998',
    title: 'Co-operative Societies Act No. 20 of 1998',
    instrument_type: 'statute',
    legal_validation_status: 'text_checked',
    notes:
      'Sections 1–60(3)(a), 74–85, Schedules I–II text-checked against full Act. ' +
      'Pages 244–247 (ss.60(3)(b)–73) still missing (tracked as open item O-22). ' +
      'Primary authority for cooperative registration, governance, and dissolution in Zambia.',
  },
  {
    instrument_ref: 'ZMB-SI-26-1999',
    title: 'Co-operative Societies Regulations, 1999 (SI 26 of 1999)',
    instrument_type: 'regulations',
    legal_validation_status: 'text_checked',
    notes:
      'Prescribes Forms 1–6 (including Form 2 — certificate of registration). ' +
      'Repeals the 1972 Co-operative Societies Rules. ' +
      'Governs prescribed fees, registration procedures, and inspection rights (ss.21, 28 of Act).',
  },
  {
    instrument_ref: 'ZMB-CSA-1970',
    title: 'Co-operative Societies Act, Chapter 397 (1970, repealed)',
    instrument_type: 'statute',
    legal_validation_status: 'needs_legal_validation',
    notes:
      'Repealed by Act No. 20 of 1998 (s.85). ' +
      'Do not use as authority for new cooperative registrations. ' +
      'Retained for historical reference and legacy dispute research only.',
  },
];

async function seed(): Promise<void> {
  console.log('Seeding legal_sources...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    for (const source of LEGAL_SOURCES) {
      await client.query(
        `
        INSERT INTO ${SCHEMA}.legal_sources
          (instrument_ref, title, instrument_type, legal_validation_status, notes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (instrument_ref) DO UPDATE SET
          title                   = EXCLUDED.title,
          instrument_type         = EXCLUDED.instrument_type,
          legal_validation_status = EXCLUDED.legal_validation_status,
          notes                   = EXCLUDED.notes
        `,
        [
          source.instrument_ref,
          source.title,
          source.instrument_type,
          source.legal_validation_status,
          source.notes,
        ],
      );
      console.log(`  ✅ ${source.instrument_ref} — seeded`);
    }

    await client.query('COMMIT');
    console.log('\n✅ legal_sources seed complete.');
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

