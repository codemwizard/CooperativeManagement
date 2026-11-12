/**
 * @symphony/db — seeds/capability-registry.ts
 *
 * Seeds the capability_registry table with all V4 modules at status 'not_implemented'.
 * Module codes align with 07-extension-framework.md.
 *
 * Run:
 *   tsx src/seeds/capability-registry.ts
 *   npm run db:seed:capabilities   (from repo root)
 */

import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
const SCHEMA = process.env['DATABASE_SCHEMA'] ?? 'symphony';

if (DATABASE_URL === undefined || DATABASE_URL === '') {
  throw new Error('DATABASE_URL environment variable is required.');
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface Capability {
  module_code: string;
  name: string;
  spec_ref: string;
}

// All V4 modules from 07-extension-framework.md — initialised as not_implemented
const CAPABILITIES: Capability[] = [
  // Core kernel
  { module_code: 'KERNEL', name: 'Command/Event Kernel', spec_ref: '04-architecture.md §3' },
  { module_code: 'AUTH', name: 'Authentication & Sessions', spec_ref: '04-architecture.md §4.2' },
  { module_code: 'CAPACITY', name: 'Capacity Grants & Delegation', spec_ref: '04-architecture.md §4.3' },

  // Enrolment
  { module_code: 'ENROL_SELF', name: 'Self-Enrolment Journey', spec_ref: 'FT-ENR-001' },
  { module_code: 'ENROL_ASSISTED', name: 'Assisted Enrolment Journey', spec_ref: 'FT-ENR-002' },
  { module_code: 'ENROL_HANDOVER', name: 'Enrolment Handover', spec_ref: 'FT-ENR-003' },

  // Identity
  { module_code: 'IDENTITY_NRC', name: 'NRC Identity Check', spec_ref: 'ID-001' },
  { module_code: 'IDENTITY_PASSPORT', name: 'Passport Identity Check', spec_ref: 'ID-002' },
  { module_code: 'IDENTITY_COMMUNITY', name: 'Community-Attested Identity', spec_ref: 'ID-003' },
  { module_code: 'IDENTITY_VAULT', name: 'PII Vault (AES-256-GCM)', spec_ref: 'ADR-010' },

  // Evidence
  { module_code: 'EVIDENCE_SUBMIT', name: 'Evidence Submission', spec_ref: 'FT-EV-001' },
  { module_code: 'EVIDENCE_ADMIT', name: 'Evidence Admission', spec_ref: 'FT-EV-002' },
  { module_code: 'EVIDENCE_VERIFY', name: 'Evidence Verification', spec_ref: 'FT-EV-003' },
  { module_code: 'EVIDENCE_DISPUTE', name: 'Evidence Dispute', spec_ref: 'FT-EV-004' },
  { module_code: 'EVIDENCE_PLATFORM_CHECK', name: 'Platform Check', spec_ref: 'FT-EV-005' },

  // By-laws
  { module_code: 'BYLAW_DRAFT', name: 'By-law Drafting', spec_ref: 'BYL-001' },
  { module_code: 'BYLAW_ADOPT', name: 'By-law Adoption (Resolution)', spec_ref: 'BYL-002' },
  { module_code: 'BYLAW_SUBMIT', name: 'Submit to Registrar', spec_ref: 'BYL-003' },
  { module_code: 'BYLAW_REGISTER', name: 'By-law Registration', spec_ref: 'BYL-004' },
  { module_code: 'BYLAW_AMEND', name: 'By-law Amendment Workflow', spec_ref: 'BYL-005' },

  // Governance
  { module_code: 'GOVERNANCE_APPOINTMENTS', name: 'Officer Appointments', spec_ref: 'GOV-001' },
  { module_code: 'GOVERNANCE_MEETINGS', name: 'Meeting Management', spec_ref: 'GOV-002' },
  { module_code: 'GOVERNANCE_RESOLUTIONS', name: 'Resolution Recording', spec_ref: 'GOV-003' },
  { module_code: 'GOVERNANCE_DUTY_MATRIX', name: 'Duty Matrix Enforcement', spec_ref: 'GOV-004' },

  // Register & public access
  { module_code: 'REGISTER_PUBLIC', name: 'Public Register Inspection', spec_ref: 'PRV-006' },
  { module_code: 'REGISTER_MEMBER', name: 'Member Register Access', spec_ref: 'PRV-007' },

  // Portfolio (PFI / institutional views)
  { module_code: 'PORTFOLIO_PFI', name: 'PFI Portfolio View', spec_ref: 'FT-PFI-001' },
  { module_code: 'PORTFOLIO_NABII', name: 'NABII Portfolio View', spec_ref: 'FT-NAB-001' },
  { module_code: 'PORTFOLIO_TA', name: 'Technical Advisor View', spec_ref: 'FT-TA-001' },
  { module_code: 'PORTFOLIO_VVB', name: 'VVB View', spec_ref: 'FT-VVB-001' },

  // Quality
  { module_code: 'QUALITY_EQS', name: 'Evidence Quality Score', spec_ref: 'QM-001' },
  { module_code: 'QUALITY_ESG', name: 'ESG Index Calculation', spec_ref: 'QM-002' },

  // Data
  { module_code: 'DATA_EXPORT', name: 'Data Export', spec_ref: 'ADR-016' },
  { module_code: 'DATA_RETENTION', name: 'Retention Policy Enforcement', spec_ref: 'ADR-015' },
  { module_code: 'DATA_CONSENT', name: 'Consent Management', spec_ref: 'PRV-010' },
];

async function seed(): Promise<void> {
  console.log('Seeding capability_registry...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    for (const cap of CAPABILITIES) {
      await client.query(
        `
        INSERT INTO ${SCHEMA}.capability_registry (module_code, name, status, spec_ref)
        VALUES ($1, $2, 'not_implemented', $3)
        ON CONFLICT (module_code) DO NOTHING
        `,
        [cap.module_code, cap.name, cap.spec_ref],
      );
    }

    await client.query('COMMIT');
    console.log(`  ✅ ${CAPABILITIES.length} capabilities seeded at status 'not_implemented'`);
    console.log('\n✅ capability_registry seed complete.');
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

