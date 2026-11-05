/**
 * apps/workspace/src/presenters/present-evidence.ts
 *
 * Maps evidence standing enums to human-readable display text.
 * No snake_case enum values may appear in output (UXW-002, UXW-003).
 * No banned words: "compliant", "certified" (without authority), bare "Verified".
 * WP-1.9.3
 */

/** All standing values defined by the domain model */
export type EvidenceStanding =
  | 'asserted'
  | 'supported'
  | 'awaiting_duty_submission'
  | 'draft_submitted'
  | 'approved_official'
  | 'verified_internal'
  | 'held_draft'
  | 'disputed'
  | 'pending'
  | 'not_applicable';

/** Shape of the chip icon associated with a standing value */
export type ChipShape =
  | 'half-filled'
  | 'dashed-outline'
  | 'open-square'
  | 'filled-square'
  | 'ringed-circle'
  | 'hourglass'
  | 'triangle'
  | 'circle'
  | 'dash';

export interface EvidencePresentation {
  readonly text: string;
  readonly shape: ChipShape;
  /** ARIA description — includes text and shape meaning so colour is not the sole indicator */
  readonly ariaDescription: string;
}

/** Presentation map keyed by standing value */
const STANDING_MAP: Record<EvidenceStanding, EvidencePresentation> = {
  asserted: {
    text: 'Self-declared',
    shape: 'half-filled',
    ariaDescription: 'Self-declared — not yet independently supported',
  },
  supported: {
    text: 'Supported (proof attached)',
    shape: 'half-filled',
    ariaDescription: 'Supported by attached proof, not yet officially approved',
  },
  awaiting_duty_submission: {
    text: 'Working copy, outside Secretary process',
    shape: 'dashed-outline',
    ariaDescription: 'Working copy — outside the Secretary submission process',
  },
  draft_submitted: {
    text: 'Draft, awaiting approval',
    shape: 'open-square',
    ariaDescription: 'Draft submitted, awaiting official approval',
  },
  approved_official: {
    text: 'Official cooperative record',
    shape: 'filled-square',
    ariaDescription: 'Approved as an official cooperative record',
  },
  verified_internal: {
    text: 'Cooperative-verified (internal)',
    shape: 'ringed-circle',
    ariaDescription: 'Cooperative-verified by the internal verifier',
  },
  held_draft: {
    text: 'Held as draft: by-law not amended',
    shape: 'hourglass',
    ariaDescription: 'Held as draft — the by-law has not yet been amended',
  },
  disputed: {
    text: 'Disputed',
    shape: 'triangle',
    ariaDescription: 'Disputed — under review',
  },
  pending: {
    text: 'Pending review',
    shape: 'circle',
    ariaDescription: 'Pending review by the responsible party',
  },
  not_applicable: {
    text: 'Not applicable',
    shape: 'dash',
    ariaDescription: 'Not applicable to this cooperative',
  },
};

/**
 * Returns the presentation for a given evidence standing value.
 * Returns a safe fallback for unknown values so no raw enum reaches the UI.
 */
export function presentEvidence(standing: string): EvidencePresentation {
  const known = STANDING_MAP[standing as EvidenceStanding];
  if (known) return known;
  // Unknown standing — return a safe generic presentation (no raw enum text)
  return {
    text: 'Status unavailable',
    shape: 'dash',
    ariaDescription: 'Status information is unavailable',
  };
}

