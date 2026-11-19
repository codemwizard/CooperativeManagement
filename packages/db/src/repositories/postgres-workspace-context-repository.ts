import type { Pool } from 'pg';

export interface WorkspaceAuthorityFact {
  readonly sourceId: string;
  readonly kind: 'membership' | 'appointment' | 'capacity' | 'platform_role' | 'institutional_role' | 'enrolment';
  readonly authority: string;
  readonly organizationId: string | null;
  readonly organizationName: string | null;
  readonly organizationKind: 'cooperative' | 'union' | 'federation' | null;
  readonly personId: string | null;
  readonly membershipId: string | null;
  readonly scopeOrganizationIds: readonly string[];
  readonly scopeMode: 'organization' | 'tenant_organization_projections' | 'delegated_organizations' | 'enrolment';
  readonly sourceRef: string | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
}

export interface WorkspaceContextFacts {
  readonly tenantId: string;
  readonly userId: string;
  readonly resolvedAt: string;
  readonly personId: string | null;
  readonly facts: readonly WorkspaceAuthorityFact[];
}

/** Read-only trusted WP2.2 facts derived from PostgreSQL under tenant RLS. */
export class PostgresWorkspaceContextRepository {
  constructor(private readonly pool: Pool) {}

  async resolve(userId: string, tenantId: string): Promise<WorkspaceContextFacts | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const account = await client.query<{ tenant_id: string; status: string; resolved_at: Date }>(
        `SELECT u.tenant_id, u.status, transaction_timestamp() AS resolved_at
           FROM symphony.users u WHERE u.id = $1::uuid AND u.tenant_id = $2::uuid`,
        [userId, tenantId],
      );
      const accountRow = account.rows[0];
      if (!accountRow || accountRow.status !== 'active') {
        await client.query('COMMIT');
        return undefined;
      }

      const linked = await client.query<{ person_id: string }>(
        `SELECT person_id FROM symphony.user_person_links
          WHERE tenant_id = $1::uuid AND user_id = $2::uuid
            AND linked_at <= transaction_timestamp()
            AND (unlinked_at IS NULL OR unlinked_at > transaction_timestamp())
          ORDER BY linked_at DESC, id`, [tenantId, userId],
      );
      if (linked.rows.length > 1) throw new Error('Ambiguous active user-person relationship.');
      const personId = linked.rows[0]?.person_id ?? null;
      const facts: WorkspaceAuthorityFact[] = [];
      const approvedPositionCodes = ['chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'director', 'committee_chair', 'committee_member'];
      const approvedCapacityCodes = ['internal_verifier', 'field_agent', 'delegate', 'acting_officer'];

      if (personId) {
        const memberships = await client.query<{
          id: string; organization_id: string; organization_name: string; organization_kind: WorkspaceAuthorityFact['organizationKind'];
          source_ref: string; joined_at: Date; ended_at: Date | null;
        }>(
          `SELECT m.id, m.organization_id, o.name AS organization_name,
                  o.organization_kind, m.source_ref, m.joined_at, m.ended_at
             FROM symphony.organization_memberships m
             JOIN symphony.organizations o ON o.id = m.organization_id AND o.tenant_id = m.tenant_id
            WHERE m.tenant_id = $1::uuid AND m.person_id = $2::uuid AND m.status = 'active'
              AND o.organization_kind = 'cooperative'
              AND m.joined_at <= transaction_timestamp()
              AND (m.ended_at IS NULL OR m.ended_at > transaction_timestamp())
            ORDER BY o.name COLLATE "C", m.id`, [tenantId, personId],
        );
        const membershipsByOrganization = new Map(memberships.rows.map((row) => [row.organization_id, row]));
        for (const row of memberships.rows) facts.push({
          sourceId: row.id, kind: 'membership', authority: 'member', organizationId: row.organization_id,
          organizationName: row.organization_name, organizationKind: row.organization_kind, personId,
          membershipId: row.id, scopeOrganizationIds: [row.organization_id], scopeMode: 'organization',
          sourceRef: row.source_ref, effectiveAt: row.joined_at.toISOString(), expiresAt: row.ended_at?.toISOString() ?? null,
        });

        const appointments = await client.query<{
          id: string; organization_id: string; organization_name: string; organization_kind: WorkspaceAuthorityFact['organizationKind'];
          position_code: string; started_at: Date; ended_at: Date | null; source_ref: string | null; membership_id: string;
        }>(
          `SELECT a.id, a.organization_id, o.name AS organization_name, o.organization_kind,
                  p.code AS position_code, a.started_at, a.ended_at, a.source_ref, m.id AS membership_id
             FROM symphony.appointments a
             JOIN symphony.position_catalog p ON p.id = a.position_id AND p.active
             JOIN symphony.organizations o ON o.id = a.organization_id AND o.tenant_id = $1::uuid
               AND o.organization_kind = 'cooperative'
             JOIN symphony.organization_memberships m ON m.organization_id = a.organization_id
               AND m.person_id = a.person_id AND m.tenant_id = $1::uuid AND m.status = 'active'
               AND m.joined_at <= transaction_timestamp() AND (m.ended_at IS NULL OR m.ended_at > transaction_timestamp())
            WHERE a.person_id = $2::uuid AND a.started_at <= transaction_timestamp()
              AND p.code = ANY($3::text[])
              AND (a.ended_at IS NULL OR a.ended_at > transaction_timestamp())
            ORDER BY o.name COLLATE "C", p.code COLLATE "C", a.id`, [tenantId, personId, approvedPositionCodes],
        );
        for (const row of appointments.rows) facts.push({
          sourceId: row.id, kind: 'appointment', authority: row.position_code, organizationId: row.organization_id,
          organizationName: row.organization_name, organizationKind: row.organization_kind, personId,
          membershipId: row.membership_id, scopeOrganizationIds: [row.organization_id], scopeMode: 'organization',
          sourceRef: row.source_ref, effectiveAt: row.started_at.toISOString(), expiresAt: row.ended_at?.toISOString() ?? null,
        });

        const capacities = await client.query<{
          id: string; organization_id: string; organization_name: string; organization_kind: WorkspaceAuthorityFact['organizationKind'];
          capacity_type: string; granted_at: Date; revoked_at: Date | null;
        }>(
          `SELECT c.id, c.organization_id, o.name AS organization_name, o.organization_kind,
                  c.capacity_type, c.granted_at, c.revoked_at
             FROM symphony.capacity_grants c
             JOIN symphony.organizations o ON o.id = c.organization_id AND o.tenant_id = $1::uuid
               AND o.organization_kind = 'cooperative'
             JOIN symphony.organization_memberships m ON m.organization_id = c.organization_id
               AND m.person_id = $3::uuid AND m.tenant_id = $1::uuid AND m.status = 'active'
               AND m.joined_at <= transaction_timestamp() AND (m.ended_at IS NULL OR m.ended_at > transaction_timestamp())
            WHERE c.user_id = $2::uuid AND c.granted_at <= transaction_timestamp()
              AND c.capacity_type = ANY($4::text[])
              AND (c.revoked_at IS NULL OR c.revoked_at > transaction_timestamp())
            ORDER BY o.name COLLATE "C", c.capacity_type COLLATE "C", c.id`, [tenantId, userId, personId, approvedCapacityCodes],
        );
        for (const row of capacities.rows) facts.push({
          sourceId: row.id, kind: 'capacity', authority: row.capacity_type, organizationId: row.organization_id,
          organizationName: row.organization_name, organizationKind: row.organization_kind, personId,
          membershipId: membershipsByOrganization.get(row.organization_id)?.id ?? null,
          scopeOrganizationIds: [row.organization_id], scopeMode: 'organization', sourceRef: null,
          effectiveAt: row.granted_at.toISOString(), expiresAt: row.revoked_at?.toISOString() ?? null,
        });
      }

      const platformRoles = await client.query<{ id: string; code: string; granted_at: Date }>(
        `SELECT a.id, r.code, a.granted_at
           FROM symphony.user_role_assignments a
           JOIN symphony.platform_roles r ON r.id = a.platform_role_id
          WHERE a.tenant_id = $1::uuid AND a.user_id = $2::uuid AND a.granted_at <= transaction_timestamp()
            AND (a.revoked_at IS NULL OR a.revoked_at > transaction_timestamp())
          ORDER BY r.code COLLATE "C", a.id`, [tenantId, userId],
      );
      const isProgrammeManager = platformRoles.rows.some((row) => row.code === 'programme_manager');
      const projectionOrganizations = isProgrammeManager
        ? await client.query<{ id: string }>(
          `SELECT id FROM symphony.organizations WHERE tenant_id = $1::uuid ORDER BY id`, [tenantId],
        )
        : { rows: [] as { id: string }[] };
      for (const row of platformRoles.rows) if (row.code === 'programme_manager') facts.push({
        sourceId: row.id, kind: 'platform_role', authority: row.code, organizationId: null, organizationName: null,
        organizationKind: null, personId, membershipId: null,
        scopeOrganizationIds: projectionOrganizations.rows.map((organization) => organization.id),
        scopeMode: 'tenant_organization_projections', sourceRef: null, effectiveAt: row.granted_at.toISOString(), expiresAt: null,
      });

      for (const row of platformRoles.rows) if (row.code === 'programme_manager') {
        const scopes = await client.query<{
          id: string; target_organization_id: string; organization_name: string;
          granted_at: Date; expires_at: Date | null; source_ref: string;
        }>(
          `SELECT s.id, s.target_organization_id, o.name AS organization_name,
                  s.granted_at, s.expires_at, s.source_ref
             FROM symphony.programme_manager_scopes s
             JOIN symphony.organizations o ON o.id = s.target_organization_id AND o.tenant_id = s.tenant_id
            WHERE s.tenant_id = $1::uuid AND s.programme_manager_user_id = $2::uuid
              AND s.scope_kind = 'ta_delegation' AND s.granted_at <= transaction_timestamp()
              AND (s.expires_at IS NULL OR s.expires_at > transaction_timestamp())
              AND (s.revoked_at IS NULL OR s.revoked_at > transaction_timestamp())
            ORDER BY o.name COLLATE "C", s.id`, [tenantId, userId],
        );
        for (const scope of scopes.rows) facts.push({
          sourceId: scope.id, kind: 'platform_role', authority: 'programme_manager_ta_delegation_scope',
          organizationId: scope.target_organization_id, organizationName: scope.organization_name,
          organizationKind: 'cooperative', personId, membershipId: null,
          scopeOrganizationIds: [scope.target_organization_id], scopeMode: 'organization',
          sourceRef: scope.source_ref, effectiveAt: scope.granted_at.toISOString(), expiresAt: scope.expires_at?.toISOString() ?? null,
        });
      }

      const institutional = await client.query<{
        id: string; role_code: string; institution_organization_id: string; institution_name: string;
        institution_kind: 'union' | 'federation';
        granted_at: Date; expires_at: Date | null; source_ref: string; target_organization_ids: string[];
      }>(
        `SELECT a.id, a.role_code, a.institution_organization_id, i.name AS institution_name,
                i.organization_kind AS institution_kind,
                a.granted_at, a.expires_at, a.source_ref,
                COALESCE(array_agg(DISTINCT d.target_organization_id ORDER BY d.target_organization_id)
                  FILTER (WHERE d.id IS NOT NULL), ARRAY[]::uuid[])::text[] AS target_organization_ids
           FROM symphony.institutional_role_assignments a
           JOIN symphony.organizations i ON i.id = a.institution_organization_id AND i.tenant_id = a.tenant_id
             AND i.organization_kind IN ('union', 'federation')
           JOIN symphony.ta_scope_delegations d ON d.tenant_id = a.tenant_id
             AND d.delegatee_user_id = a.user_id AND d.union_organization_id = a.institution_organization_id
             AND d.granted_at <= transaction_timestamp()
             AND (d.expires_at IS NULL OR d.expires_at > transaction_timestamp())
             AND (d.revoked_at IS NULL OR d.revoked_at > transaction_timestamp())
           JOIN symphony.user_role_assignments manager_role ON manager_role.tenant_id = d.tenant_id
             AND manager_role.user_id = d.programme_manager_user_id
             AND manager_role.granted_at <= transaction_timestamp()
             AND (manager_role.revoked_at IS NULL OR manager_role.revoked_at > transaction_timestamp())
           JOIN symphony.platform_roles manager_role_type ON manager_role_type.id = manager_role.platform_role_id
             AND manager_role_type.code = 'programme_manager'
           JOIN symphony.programme_manager_scopes manager_scope ON manager_scope.tenant_id = d.tenant_id
             AND manager_scope.programme_manager_user_id = d.programme_manager_user_id
             AND manager_scope.target_organization_id = d.target_organization_id
             AND manager_scope.scope_kind = 'ta_delegation'
             AND manager_scope.granted_at <= transaction_timestamp()
             AND (manager_scope.expires_at IS NULL OR manager_scope.expires_at > transaction_timestamp())
             AND (manager_scope.revoked_at IS NULL OR manager_scope.revoked_at > transaction_timestamp())
           JOIN symphony.organizations target ON target.id = d.target_organization_id
             AND target.tenant_id = d.tenant_id AND target.organization_kind = 'cooperative'
          WHERE a.tenant_id = $1::uuid AND a.user_id = $2::uuid AND a.role_code = 'union_ta'
            AND a.granted_at <= transaction_timestamp()
            AND (a.expires_at IS NULL OR a.expires_at > transaction_timestamp())
            AND (a.revoked_at IS NULL OR a.revoked_at > transaction_timestamp())
          GROUP BY a.id, i.name, i.organization_kind ORDER BY a.id`, [tenantId, userId],
      );
      for (const row of institutional.rows) facts.push({
        sourceId: row.id, kind: 'institutional_role', authority: row.role_code,
        organizationId: row.institution_organization_id, organizationName: row.institution_name,
        organizationKind: row.institution_kind, personId, membershipId: null,
        scopeOrganizationIds: row.target_organization_ids, scopeMode: 'delegated_organizations',
        sourceRef: row.source_ref, effectiveAt: row.granted_at.toISOString(), expiresAt: row.expires_at?.toISOString() ?? null,
      });

      const enrolments = await client.query<{
        id: string; organization_id: string; organization_name: string; started_at: Date;
      }>(
        `SELECT e.id, e.organization_id, o.name AS organization_name, e.started_at
           FROM symphony.enrolment_sessions e
           JOIN symphony.organizations o ON o.id = e.organization_id AND o.tenant_id = e.tenant_id
             AND o.organization_kind = 'cooperative'
          WHERE e.tenant_id = $1::uuid AND e.enroller_user_id = $2::uuid AND e.started_at <= transaction_timestamp()
            AND e.closed_at IS NULL ORDER BY o.name COLLATE "C", e.id`, [tenantId, userId],
      );
      for (const row of enrolments.rows) facts.push({
        sourceId: row.id, kind: 'enrolment', authority: 'self_enroller', organizationId: row.organization_id,
        organizationName: row.organization_name, organizationKind: 'cooperative', personId, membershipId: null,
        scopeOrganizationIds: [row.organization_id], scopeMode: 'enrolment', sourceRef: null,
        effectiveAt: row.started_at.toISOString(), expiresAt: null,
      });

      await client.query('COMMIT');
      return {
        tenantId, userId, resolvedAt: accountRow.resolved_at.toISOString(), personId,
        facts: facts.sort((a, b) => a.kind.localeCompare(b.kind, 'en')
          || (a.organizationName ?? '').localeCompare(b.organizationName ?? '', 'en')
          || a.authority.localeCompare(b.authority, 'en') || a.sourceId.localeCompare(b.sourceId, 'en')),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
