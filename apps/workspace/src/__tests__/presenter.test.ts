/**
 * apps/workspace/src/__tests__/presenter.test.ts
 *
 * Presenter unit tests — WP-1.9.3
 *
 * presenterTest_noSnakeCaseInOutput: no _ in any output text
 * presenterTest_noBannedWords: "compliant", "certified" (without authority),
 *   bare "Verified" must not appear in any presenter output.
 */

import { describe, it, expect } from 'vitest';
import { presentEvidence, type EvidenceStanding } from '../presenters/present-evidence.js';
import { presentRequirement, type RequirementStatus } from '../presenters/present-requirement.js';
import { selectWorkspaceContext, type PresentedWorkspaceContext } from '../presenters/present-workspace-context.js';

const ALL_EVIDENCE_STANDINGS: EvidenceStanding[] = [
  'asserted',
  'supported',
  'awaiting_duty_submission',
  'draft_submitted',
  'approved_official',
  'verified_internal',
  'held_draft',
  'disputed',
  'pending',
  'not_applicable',
];

const ALL_REQUIREMENT_STATUSES: RequirementStatus[] = [
  'not_implemented',
  'specified',
  'in_progress',
  'available',
];

/** Collect all presenter output strings */
function allEvidenceTexts(): string[] {
  return ALL_EVIDENCE_STANDINGS.flatMap((s) => {
    const p = presentEvidence(s);
    return [p.text, p.ariaDescription];
  });
}

function allRequirementTexts(): string[] {
  return ALL_REQUIREMENT_STATUSES.flatMap((s) => {
    const p = presentRequirement(s);
    return [p.text, p.ariaDescription];
  });
}

describe('presenterTest_noSnakeCaseInOutput', () => {
  it('evidence presenter output contains no snake_case (underscore) text', () => {
    for (const text of allEvidenceTexts()) {
      expect(text, `Snake-case found in: "${text}"`).not.toMatch(/_/);
    }
  });

  it('requirement presenter output contains no snake_case (underscore) text', () => {
    for (const text of allRequirementTexts()) {
      expect(text, `Snake-case found in: "${text}"`).not.toMatch(/_/);
    }
  });
});

describe('presenterTest_noBannedWords', () => {
  const allTexts = [...allEvidenceTexts(), ...allRequirementTexts()];

  it('no output contains the word "compliant"', () => {
    for (const text of allTexts) {
      expect(text.toLowerCase(), `"compliant" found in: "${text}"`).not.toContain('compliant');
    }
  });

  it('no output contains "certified" without an authority qualifier', () => {
    // "certified" bare (not followed by " by" or " under") is banned
    for (const text of allTexts) {
      const lower = text.toLowerCase();
      if (lower.includes('certified')) {
        // Must be followed by a qualifier
        expect(
          lower,
          `Bare "certified" (without authority) found in: "${text}"`,
        ).toMatch(/certified\s+(by|under|through)/);
      }
    }
  });

  it('no output contains a bare "Verified" (title-case, without scope/verifier)', () => {
    // Bare "Verified" alone as a word is banned.
    // "Cooperative-verified" is allowed; "Verified" as a standalone word is not.
    for (const text of allTexts) {
      // Check for the word "Verified" or "verified" standing alone (not part of a compound like "Cooperative-verified")
      const bareVerified = /(?<![a-z-])verified(?![a-z-])/i;
      if (bareVerified.test(text)) {
        // It is allowed only if immediately preceded by a noun/scope (hyphenated)
        const isCompound = /\w+-verified/i.test(text);
        expect(
          isCompound,
          `Bare "Verified" found in: "${text}" — must be compound like "Cooperative-verified"`,
        ).toBe(true);
      }
    }
  });
});

describe('workspace context selection', () => {
  const context = (id: string, organizationId: string | null, paths: string[], scope: string[] = []): PresentedWorkspaceContext => ({
    id,
    persona: id.startsWith('programme_manager') ? 'programme_manager' : 'cooperative_member',
    label: id,
    organizationId,
    organizationName: null,
    scopeOrganizationIds: scope,
    scopeMode: 'organization',
    navigation: paths.map((path) => ({ label: path, path })),
  });

  it('restores a programme manager selected at the workspace root from the URL', () => {
    const member = context('cooperative_member:member-1', 'coop-1', ['overview']);
    const manager = context('programme_manager:role-1', null, ['pipeline', 'cohort']);
    expect(selectWorkspaceContext([member, manager], {
      requestedContextId: manager.id,
      pathname: '/workspace',
    })).toBe(manager);
  });

  it('selects an authorized cooperative at its root even when it is not the first context', () => {
    const firstCooperative = context('member:coop-1', 'coop-1', ['overview', 'governance']);
    const secondCooperative = context('member:coop-2', 'coop-2', ['overview', 'governance']);
    expect(selectWorkspaceContext([firstCooperative, secondCooperative], {
      cooperativeId: 'coop-2',
      pathname: '/coop/coop-2',
    })).toBe(secondCooperative);
  });

  it('does not restore a URL context that is outside the requested cooperative scope', () => {
    const firstCooperative = context('member:coop-1', 'coop-1', ['overview']);
    const secondCooperative = context('member:coop-2', 'coop-2', ['overview']);
    expect(selectWorkspaceContext([firstCooperative, secondCooperative], {
      requestedContextId: firstCooperative.id,
      cooperativeId: 'coop-2',
      pathname: '/coop/coop-2',
    })).toBe(secondCooperative);
  });
});

