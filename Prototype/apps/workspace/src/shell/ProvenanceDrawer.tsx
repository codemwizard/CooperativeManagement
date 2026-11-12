/**
 * apps/workspace/src/shell/ProvenanceDrawer.tsx
 *
 * Right-hand provenance drawer skeleton.
 * Full implementation is Phase 2+. This skeleton satisfies WP-1.9.2.
 * WP-1.9.2
 */

import React, { useEffect, useRef } from 'react';

interface ProvenanceDrawerProps {
  readonly onClose: () => void;
}

export function ProvenanceDrawer({ onClose }: ProvenanceDrawerProps): React.ReactElement {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trap focus and handle Escape
  useEffect(() => {
    closeRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-label="Provenance"
      aria-modal="true"
      style={styles.drawer}
    >
      <div style={styles.header}>
        <h2 style={styles.title}>Provenance</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close provenance drawer"
          style={styles.closeBtn}
        >
          ✕
        </button>
      </div>
      <div style={styles.body}>
        <p style={styles.placeholder}>
          Select a row to see provenance details.
        </p>
        <p style={styles.phase}>
          <em>Full provenance drawer: Phase 2</em>
        </p>
      </div>
    </aside>
  );
}

const styles = {
  drawer: {
    width: '320px',
    minWidth: '320px',
    background: '#ffffff',
    borderLeft: '1px solid #dee2e6',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    borderBottom: '1px solid #dee2e6',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
    color: '#495057',
  },
  body: {
    padding: '1rem',
    flex: 1,
    overflow: 'auto',
  },
  placeholder: {
    color: '#6c757d',
    fontSize: '0.875rem',
  },
  phase: {
    color: '#adb5bd',
    fontSize: '0.75rem',
    marginTop: '1rem',
  },
};

