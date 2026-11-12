/**
 * apps/workspace/src/shell/OrgHeader.tsx
 *
 * Organisation header bar: org name, enrolment status, pipeline stage.
 * WP-1.9.2
 */

import React from 'react';

interface OrgHeaderProps {
  readonly orgName: string;
  readonly enrolmentStatus: string;
  readonly pipelineStage: string;
  readonly onOpenProvenance: () => void;
}

export function OrgHeader({
  orgName,
  enrolmentStatus,
  pipelineStage,
  onOpenProvenance,
}: OrgHeaderProps): React.ReactElement {
  return (
    <header style={styles.header} role="banner">
      <div style={styles.left}>
        <span style={styles.orgName}>{orgName}</span>
        <span style={styles.divider} aria-hidden="true">|</span>
        <span style={styles.meta}>
          <span style={styles.label}>Enrolment:</span>{' '}
          {enrolmentStatus}
        </span>
        <span style={styles.divider} aria-hidden="true">|</span>
        <span style={styles.meta}>
          <span style={styles.label}>Stage:</span>{' '}
          {pipelineStage}
        </span>
      </div>
      <div style={styles.right}>
        <button
          type="button"
          style={styles.provenanceBtn}
          onClick={onOpenProvenance}
          aria-haspopup="dialog"
        >
          Provenance
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.5rem',
    background: '#2c3e6b',
    color: '#ffffff',
    gap: '1rem',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  orgName: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  divider: {
    color: 'rgba(255,255,255,0.4)',
  },
  meta: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.85)',
  },
  label: {
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  right: {
    flexShrink: 0,
  },
  provenanceBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#ffffff',
    padding: '0.375rem 0.75rem',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};

