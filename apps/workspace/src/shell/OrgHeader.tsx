/**
 * apps/workspace/src/shell/OrgHeader.tsx
 *
 * Organisation header bar: org name, enrolment status, pipeline stage.
 * WP-1.9.2
 */

import React from 'react';

interface OrgHeaderProps {
  /** Supplied only from a trusted workspace context; omitted while unresolved. */
  readonly orgName?: string;
  readonly enrolmentStatus?: string;
  readonly pipelineStage?: string;
  readonly provenanceButtonRef?: React.RefObject<HTMLButtonElement>;
  readonly onOpenProvenance: () => void;
}

export function OrgHeader({
  orgName,
  enrolmentStatus,
  pipelineStage,
  provenanceButtonRef,
  onOpenProvenance,
}: OrgHeaderProps): React.ReactElement {
  return (
    <header style={styles.header} role="banner">
      <div style={styles.left}>
        {orgName && <span style={styles.orgName}>{orgName}</span>}
        {orgName && (enrolmentStatus || pipelineStage) && <span style={styles.divider} aria-hidden="true">|</span>}
        {enrolmentStatus && (
          <span style={styles.meta}>
            <span style={styles.label}>Enrolment:</span>{' '}
            {enrolmentStatus}
          </span>
        )}
        {enrolmentStatus && pipelineStage && <span style={styles.divider} aria-hidden="true">|</span>}
        {pipelineStage && (
          <span style={styles.meta}>
            <span style={styles.label}>Stage:</span>{' '}
            {pipelineStage}
          </span>
        )}
      </div>
      <div style={styles.right}>
        <button
          ref={provenanceButtonRef}
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

