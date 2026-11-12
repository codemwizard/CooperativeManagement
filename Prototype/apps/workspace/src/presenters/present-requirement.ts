/**
 * apps/workspace/src/presenters/present-requirement.ts
 *
 * Maps requirement/module status values to human-readable display text.
 * No snake_case enum values may appear in output (UXW-002, UXW-003).
 * WP-1.9.3
 */

/** Requirement status values as stored in the capability registry */
export type RequirementStatus =
  | 'not_implemented'
  | 'specified'
  | 'in_progress'
  | 'available';

export interface RequirementPresentation {
  readonly text: string;
  readonly isCapabilityGap: boolean;
  readonly ariaDescription: string;
}

const STATUS_MAP: Record<RequirementStatus, RequirementPresentation> = {
  not_implemented: {
    text: 'Platform capability not implemented',
    isCapabilityGap: true,
    ariaDescription: 'This feature is not yet implemented in the platform',
  },
  specified: {
    text: 'Specified — not yet built',
    isCapabilityGap: true,
    ariaDescription: 'This feature is specified but not yet built',
  },
  in_progress: {
    text: 'In progress',
    isCapabilityGap: false,
    ariaDescription: 'This feature is currently being developed',
  },
  available: {
    text: 'Available',
    isCapabilityGap: false,
    ariaDescription: 'This feature is available',
  },
};

/**
 * Returns the presentation for a given requirement status.
 * Returns a safe fallback for unknown values.
 */
export function presentRequirement(status: string): RequirementPresentation {
  const known = STATUS_MAP[status as RequirementStatus];
  if (known) return known;
  return {
    text: 'Status not available',
    isCapabilityGap: false,
    ariaDescription: 'Status information is not available',
  };
}

