/**
 * apps/workspace/src/shell/CapabilityGapPage.tsx
 *
 * Placeholder page shown for every area not yet implemented.
 * WP-1.9.6
 */

import React from 'react';

interface CapabilityGapPageProps {
  readonly module: string;
}

export function CapabilityGapPage({ module }: CapabilityGapPageProps): React.ReactElement {
  return (
    <div>
      <h1>{module}</h1>
      <div
        style={styles.gap}
        aria-label={`${module}: platform capability not implemented`}
        data-testid="capability-gap-chip"
      >
        <span style={styles.chipIcon} aria-hidden="true">⚠</span>
        <span>
          <strong>{module}:</strong> platform capability not implemented
        </span>
      </div>
      <p style={styles.note}>
        This area is on the roadmap. No invented flow is offered.
      </p>
    </div>
  );
}

const styles = {
  gap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '0.25rem',
    background: '#fff8e1',
    color: '#7a4f00',
    border: '1px solid #ffe082',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginTop: '1rem',
  },
  chipIcon: {
    fontSize: '1rem',
  },
  note: {
    color: '#6c757d',
    fontSize: '0.875rem',
    marginTop: '1rem',
  },
};

