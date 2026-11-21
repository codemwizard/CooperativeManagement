import type { Pool } from 'pg';
import type { VerifiedFindingProjection } from '@symphony/contracts';

interface FindingRow {
  finding_id: string;
  evidence_item_id: string;
  evidence_version_id: string;
  version_number: number;
  outcome: VerifiedFindingProjection['outcome'];
  verifier_name: string | null;
  verifier_office: string | null;
  scope: string | null;
  assurance_class: string | null;
  finding_at: Date;
  office_effective_at: Date | null;
  completed_at: Date | null;
  assignment_version_id: string;
  finding_version_id: string;
  supplier_user_id: string;
  assigned_to_user_id: string;
}

/** Read-only verified finding projection for the currently assigned, active internal verifier. */
export class PostgresVerifiedFindingRepository {
  constructor(private readonly pool: Pool) {}

  async listForAssignedVerifier(userId: string, tenantId: string, organizationId: string): Promise<VerifiedFindingProjection[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await client.query<FindingRow>(
        `SELECT f.id AS finding_id, i.id AS evidence_item_id,
                f.evidence_version_id, v.version_number, f.outcome,
                attr.public_name AS verifier_name, attr.office_title AS verifier_office,
                f.scope, f.assurance_class, f.finding_at, attr.effective_at AS office_effective_at,
                a.completed_at, a.evidence_version_id AS assignment_version_id,
                f.evidence_version_id AS finding_version_id,
                v.supplier_user_id, a.assigned_to_user_id
           FROM symphony.verification_assignments a
           JOIN symphony.evidence_items i ON i.id = a.evidence_item_id
           JOIN symphony.organizations o ON o.id = i.organization_id
           JOIN symphony.evidence_versions v ON v.id = a.evidence_version_id AND v.evidence_item_id = i.id
           JOIN symphony.verification_findings f
             ON f.assignment_id = a.id AND f.evidence_version_id = a.evidence_version_id
           LEFT JOIN symphony.verification_finding_attributions attr ON attr.finding_id = f.id
          WHERE a.assigned_to_user_id = $1::uuid
            AND o.tenant_id = $2::uuid AND o.id = $3::uuid
            AND EXISTS (
              SELECT 1
                FROM symphony.capacity_grants c
                JOIN symphony.user_person_links upl
                  ON upl.user_id = c.user_id AND upl.tenant_id = $2::uuid
                 AND upl.linked_at <= transaction_timestamp()
                 AND (upl.unlinked_at IS NULL OR upl.unlinked_at > transaction_timestamp())
                JOIN symphony.organization_memberships m
                  ON m.tenant_id = $2::uuid AND m.organization_id = c.organization_id
                 AND m.person_id = upl.person_id AND m.status = 'active'
                 AND m.joined_at <= transaction_timestamp()
                 AND (m.ended_at IS NULL OR m.ended_at > transaction_timestamp())
               WHERE c.user_id = $1::uuid AND c.organization_id = o.id
                 AND c.capacity_type = 'internal_verifier'
                 AND c.active_from <= transaction_timestamp()
                 AND (c.expires_at IS NULL OR c.expires_at > transaction_timestamp())
                 AND c.granted_at <= transaction_timestamp()
                 AND (c.revoked_at IS NULL OR c.revoked_at > transaction_timestamp())
            )
          ORDER BY f.finding_at DESC, f.id`,
        [userId, tenantId, organizationId],
      );
      await client.query('COMMIT');
      return result.rows.map((row) => {
        const complete = row.completed_at !== null
          && row.assignment_version_id === row.finding_version_id
          && row.supplier_user_id !== row.assigned_to_user_id
          && row.scope !== null && row.scope.trim().length > 0
          && row.verifier_name !== null && row.verifier_name.trim().length > 0
          && row.verifier_office !== null && row.verifier_office.trim().length > 0
          && row.office_effective_at !== null
          && row.assurance_class === 'cooperative_internal'
          && row.outcome !== null;
        return {
          findingId: row.finding_id,
          evidenceItemId: row.evidence_item_id,
          evidenceVersionId: row.evidence_version_id,
          versionNumber: row.version_number,
          outcome: row.outcome,
          verified: complete && row.outcome === 'supports_claim',
          verifierName: complete ? row.verifier_name : null,
          verifierOffice: complete ? row.verifier_office : null,
          scope: complete ? row.scope : null,
          assuranceLabel: complete ? 'cooperative-internal' : null,
          findingAt: row.finding_at.toISOString(),
          officeEffectiveAt: complete ? row.office_effective_at!.toISOString() : null,
        } satisfies VerifiedFindingProjection;
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
