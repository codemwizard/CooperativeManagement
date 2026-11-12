/**
 * @symphony/domain — authz/__tests__/policy-table.test.ts
 *
 * Parameterised policy table tests (Task 1.6.3).
 *
 * Imports the fixture from a sibling file in this package (copied alongside
 * the test for portability) and runs decide() against each row.
 * Covers all role/capacity combinations from spec §2.1 and IFV conflict rules.
 */

import { describe, it, expect } from 'vitest';
import { decide } from '../policy-engine.js';
import type { ActorContext, PolicyTarget, PolicyContext } from '../policy-engine.js';
import policyTable from './policy-table.fixture.json' with { type: 'json' };

// ─── Fixture row type ──────────────────────────────────────────────────────────

interface TableRow {
  _?: boolean; // header/note-only row — skip
  note?: string;
  label: string;
  action: string;
  actorPosition: string | null;
  actorCapacities: string[];
  platformRoles: string[];
  suppliedBy: 'SELF' | null;
  sameTenant: boolean;
  expected: 'allow' | 'allow_with_label' | 'advise' | 'deny';
  delegation?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ORG_A = 'org-a-uuid';
const ORG_B = 'org-b-uuid';
const NOW = '2024-06-01T12:00:00Z';
const ACTOR_ID = 'actor-001';
const PAST = '2023-01-01T00:00:00Z';
const FUTURE = '2025-01-01T00:00:00Z';
const EXPIRED = '2024-01-01T00:00:00Z'; // before NOW

// ─── Filter to real test rows ─────────────────────────────────────────────────

const rows = (policyTable as TableRow[]).filter((r) => !r._);

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PolicyEngine — policy table', () => {
  it.each(rows)('$label', (row) => {
    const targetTenantId = row.sameTenant ? ORG_A : ORG_B;

    const target: PolicyTarget = {
      id: 'target-001',
      type: 'EvidenceVersion',
      tenantId: targetTenantId,
      ...(row.suppliedBy === 'SELF' ? { suppliedBy: ACTOR_ID } : {}),
    };

    const actor: ActorContext = {
      userId: ACTOR_ID,
      tenantId: ORG_A,
      platformRoles: row.platformRoles,
      appointments: row.actorPosition
        ? [{ position: row.actorPosition, tenantId: ORG_A, activeFrom: PAST, activeTo: FUTURE }]
        : [],
      capacities: row.actorCapacities.map((type) => ({
        type: type.replace('expired_', ''),
        tenantId: ORG_A,
        activeFrom: PAST,
        activeTo: type.startsWith('expired_') ? EXPIRED : FUTURE,
      })),
      delegations: row.delegation
        ? [{ type: row.delegation, tenantId: ORG_A, position: 'chairperson', activeFrom: PAST, activeTo: FUTURE }]
        : [],
    };

    const context: PolicyContext = { now: NOW };

    const result = decide(row.action, target, actor, context);
    expect(result).toBe(row.expected);
  });
});
