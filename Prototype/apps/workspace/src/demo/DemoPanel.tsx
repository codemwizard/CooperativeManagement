/**
 * apps/workspace/src/demo/DemoPanel.tsx
 *
 * Demo tooling — only bundled when VITE_DEMO=true.
 * Guards with import.meta.env.VITE_DEMO so the production bundle tree-shakes it.
 * WP-1.9.4
 *
 * Features:
 *  - Persona switcher (dev only)
 *  - Reset button (requires confirmation)
 *  - Demo date display
 */

import React, { useState } from 'react';

/** Only rendered when VITE_DEMO=true */
const DEMO_ENABLED = import.meta.env.VITE_DEMO === 'true';

/** Personas available in demo/test mode */
const PERSONAS = [
  'secretary',
  'internal verifier',
  'programme manager',
  'union ta',
  'self-enroller',
] as const;

type Persona = (typeof PERSONAS)[number];

interface DemoPanelProps {
  readonly currentDate?: string;
  readonly onReset?: () => void;
  readonly onPersonaChange?: (persona: Persona) => void;
}

export function DemoPanel({
  currentDate = new Date().toISOString().slice(0, 10),
  onReset,
  onPersonaChange,
}: DemoPanelProps): React.ReactElement | null {
  const [persona, setPersona] = useState<Persona>('secretary');
  const [confirmReset, setConfirmReset] = useState(false);

  if (!DEMO_ENABLED) return null;

  function handlePersonaChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value as Persona;
    setPersona(next);
    onPersonaChange?.(next);
  }

  function handleResetClick(): void {
    setConfirmReset(true);
  }

  function handleConfirmReset(): void {
    setConfirmReset(false);
    onReset?.();
  }

  function handleCancelReset(): void {
    setConfirmReset(false);
  }

  return (
    <aside
      aria-label="Demo panel — test mode only"
      style={styles.panel}
      data-testid="demo-panel"
    >
      <div style={styles.header}>
        <span style={styles.badge}>DEMO</span>
        <span style={styles.date}>Date: {currentDate}</span>
      </div>

      <div style={styles.row}>
        <label htmlFor="demo-persona-select" style={styles.label}>
          Persona:
        </label>
        <select
          id="demo-persona-select"
          value={persona}
          onChange={handlePersonaChange}
          style={styles.select}
        >
          {PERSONAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        {!confirmReset ? (
          <button type="button" onClick={handleResetClick} style={styles.resetBtn}>
            Reset data…
          </button>
        ) : (
          <span style={styles.confirmRow}>
            <span style={styles.confirmText}>Reset all seed data?</span>
            <button
              type="button"
              onClick={handleConfirmReset}
              style={styles.confirmBtn}
            >
              Yes, reset
            </button>
            <button
              type="button"
              onClick={handleCancelReset}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    </aside>
  );
}

const styles = {
  panel: {
    position: 'fixed' as const,
    bottom: '1rem',
    right: '1rem',
    background: '#1a1a2e',
    color: '#ffffff',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '0.8125rem',
    zIndex: 9999,
    minWidth: '220px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  badge: {
    background: '#e53e3e',
    color: '#fff',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    fontWeight: 700,
    fontSize: '0.6875rem',
    letterSpacing: '0.08em',
  },
  date: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.75rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    flexShrink: 0,
  },
  select: {
    background: '#2d3748',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '0.25rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.8125rem',
    flex: 1,
  },
  resetBtn: {
    background: 'rgba(229,62,62,0.2)',
    border: '1px solid rgba(229,62,62,0.5)',
    color: '#fc8181',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.8125rem',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  confirmText: {
    color: '#fc8181',
    flexShrink: 0,
  },
  confirmBtn: {
    background: '#e53e3e',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  cancelBtn: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '0.25rem',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
};

