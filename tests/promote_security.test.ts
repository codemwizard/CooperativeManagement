import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { loadCases, clone } from '../src/engine/data';
import type { CaseState, Role, Finding } from '../src/engine/types';

describe('Gate G-D: promote_evidence_level Security Boundary & Invariant Tests', () => {
  // Roles that are not authorized to invoke promote_evidence_level
  const unauthorizedRoles = [
    'secretary',
    'treasurer',
    'chairman',
    'member',
    'field_agent',
    'ta',
    'fund_manager',
  ];

  for (const role of unauthorizedRoles) {
    it(`D1. Role security boundary: role '${role}' is rejected by authorization gate (ROLE_NOT_PERMITTED)`, () => {
      const cs = clone(loadCases()[0]) as CaseState;
      const actor = { user_id: `test.${role}`, role: role as Role };
      const result = applyAction(
        cs,
        {
          type: 'promote_evidence_level',
          evidence_type: 'land_right',
          finding_id: 'nonexistent-finding-id',
        },
        actor,
        '2026-10-17T10:00:00Z'
      );
      expect(result.ok).toBe(false);
      expect((result as any).code).toBe('ROLE_NOT_PERMITTED');
    });
  }

  // Roles permitted by role definition but calling without qualifying finding
  const authorizedRoles = ['verifier', 'pfi_credit', 'pfi_analyst'];

  for (const role of authorizedRoles) {
    it(`D1-perm. Authorized role '${role}' without a qualifying finding returns PROMOTE_NO_QUALIFYING_FINDING`, () => {
      const cs = clone(loadCases()[0]) as CaseState;
      const actor = { user_id: `test.${role}`, role: role as Role };
      const result = applyAction(
        cs,
        {
          type: 'promote_evidence_level',
          evidence_type: 'land_right',
          finding_id: 'nonexistent-finding-id',
        },
        actor,
        '2026-10-17T10:00:00Z'
      );
      expect(result.ok).toBe(false);
      expect((result as any).code).toBe('PROMOTE_NO_QUALIFYING_FINDING');
    });
  }

  it('D2. Direct engine: finding from a superseded version cannot promote current version (PROMOTE_VERSION_MISMATCH)', () => {
    const cs = clone(loadCases()[0]) as CaseState;
    const actor = { user_id: 'vrf.mulenga', role: 'verifier' as Role };

    // Set evidence to version 2
    cs.evidence['land_right'].version_id = 2;

    // Create a conformant finding that references version 1
    const oldFinding: Finding = {
      id: 'fnd-old-v1',
      assignment_id: 'asg-test-1',
      result: 'verified_conformant',
      scope: 'customary_boundary',
      basis: ['land_right'],
      limitation: 'None',
      verifier: 'vrf.mulenga',
      recorded_on: '2026-10-16T10:00:00Z',
      version_id: 1,
    };
    cs.verification.findings.push(oldFinding);

    // Attempt promote_evidence_level citing the old finding
    const result = applyAction(
      cs,
      {
        type: 'promote_evidence_level',
        evidence_type: 'land_right',
        finding_id: 'fnd-old-v1',
      },
      actor,
      '2026-10-17T10:00:00Z'
    );

    expect(result.ok).toBe(false);
    expect((result as any).code).toBe('PROMOTE_VERSION_MISMATCH');
    // Ensure evidence level was NOT modified
    expect(cs.evidence['land_right'].level).not.toBe('verified');
  });

  it('D3. Direct engine: conformant finding blocked by co-existing non-conformant finding returns PROMOTE_CONFLICTING_FINDING', () => {
    const cs = clone(loadCases()[0]) as CaseState;
    const actor = { user_id: 'vrf.mulenga', role: 'verifier' as Role };

    cs.evidence['land_right'].version_id = 1;

    // 1. Conformant finding on version 1
    const conformantFinding: Finding = {
      id: 'fnd-conf-1',
      assignment_id: 'asg-test-1',
      result: 'verified_conformant',
      scope: 'boundary_check',
      basis: ['land_right'],
      limitation: 'None',
      verifier: 'vrf.mulenga',
      recorded_on: '2026-10-16T10:00:00Z',
      version_id: 1,
    };

    // 2. Co-existing non-conformant finding on the same version 1
    const adverseFinding: Finding = {
      id: 'fnd-adv-1',
      assignment_id: 'asg-test-2',
      result: 'non_conformant',
      scope: 'boundary_check',
      basis: ['land_right'],
      limitation: 'Boundary dispute observed',
      verifier: 'vrf.sakala',
      recorded_on: '2026-10-16T11:00:00Z',
      version_id: 1,
    };

    cs.verification.findings.push(conformantFinding, adverseFinding);

    // Attempt promote_evidence_level citing the conformant finding
    const result = applyAction(
      cs,
      {
        type: 'promote_evidence_level',
        evidence_type: 'land_right',
        finding_id: 'fnd-conf-1',
      },
      actor,
      '2026-10-17T10:00:00Z'
    );

    expect(result.ok).toBe(false);
    expect((result as any).code).toBe('PROMOTE_CONFLICTING_FINDING');
    expect(cs.evidence['land_right'].level).not.toBe('verified');
  });

  it('D4. Direct engine: non-conformant finding cannot promote evidence (PROMOTE_NO_QUALIFYING_FINDING)', () => {
    const cs = clone(loadCases()[0]) as CaseState;
    const actor = { user_id: 'vrf.mulenga', role: 'verifier' as Role };

    cs.evidence['land_right'].version_id = 1;

    const adverseFinding: Finding = {
      id: 'fnd-adv-only',
      assignment_id: 'asg-test-1',
      result: 'non_conformant',
      scope: 'boundary_check',
      basis: ['land_right'],
      limitation: 'Failed',
      verifier: 'vrf.mulenga',
      recorded_on: '2026-10-16T10:00:00Z',
      version_id: 1,
    };
    cs.verification.findings.push(adverseFinding);

    const result = applyAction(
      cs,
      {
        type: 'promote_evidence_level',
        evidence_type: 'land_right',
        finding_id: 'fnd-adv-only',
      },
      actor,
      '2026-10-17T10:00:00Z'
    );

    expect(result.ok).toBe(false);
    expect((result as any).code).toBe('PROMOTE_NO_QUALIFYING_FINDING');
    expect(cs.evidence['land_right'].level).not.toBe('verified');
  });

  it('D5. Direct engine: promote_evidence_level on nonexistent evidence type returns NO_SUCH_EVIDENCE', () => {
    const cs = clone(loadCases()[0]) as CaseState;
    const actor = { user_id: 'vrf.mulenga', role: 'verifier' as Role };

    const result = applyAction(
      cs,
      {
        type: 'promote_evidence_level',
        evidence_type: 'nonexistent_evidence_type',
        finding_id: 'fnd-any',
      },
      actor,
      '2026-10-17T10:00:00Z'
    );

    expect(result.ok).toBe(false);
    expect((result as any).code).toBe('NO_SUCH_EVIDENCE');
  });
});
