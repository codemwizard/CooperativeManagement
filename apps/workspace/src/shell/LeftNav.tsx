/**
 * apps/workspace/src/shell/LeftNav.tsx
 *
 * Left navigation with the 10 workspace areas.
 * Each area shows a CapabilityGap chip until implemented.
 * WP-1.9.2 / WP-1.9.6
 */

import React from 'react';
import { NavLink } from 'react-router-dom';

/** All navigation areas defined by the spec */
export const NAV_AREAS = [
  { label: 'Overview', path: '/workspace/overview' },
  { label: 'Identity', path: '/workspace/identity' },
  { label: 'Enrolment and authority', path: '/workspace/enrolment' },
  { label: 'By-laws and requirements', path: '/workspace/bylaws' },
  { label: 'Governance', path: '/workspace/governance' },
  { label: 'People and appointments', path: '/workspace/people' },
  { label: 'Meetings and resolutions', path: '/workspace/meetings' },
  { label: 'Committees', path: '/workspace/committees' },
  { label: 'Audit and education', path: '/workspace/audit' },
  { label: 'Evidence register', path: '/workspace/evidence' },
  { label: 'Findings and next actions', path: '/workspace/findings' },
] as const;

export function LeftNav(): React.ReactElement {
  return (
    <nav
      aria-label="Primary navigation"
      style={styles.nav}
    >
      <ul style={styles.list} role="list">
        {NAV_AREAS.map((area) => (
          <li key={area.path} style={styles.item}>
            <NavLink
              to={area.path}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.linkActive : {}),
              })}
            >
              <span>{area.label}</span>
              <CapabilityGapChip module={area.label} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * CapabilityGap chip — shown for every area not yet implemented.
 * WP-1.9.6: visible on each left-nav area that is not yet implemented.
 */
export function CapabilityGapChip({ module }: { module: string }): React.ReactElement {
  return (
    <span
      aria-label={`${module}: platform capability not implemented`}
      style={styles.chip}
      data-testid="capability-gap-chip"
    >
      Not implemented
    </span>
  );
}

const styles = {
  nav: {
    width: '240px',
    minWidth: '240px',
    background: '#ffffff',
    borderRight: '1px solid #dee2e6',
    padding: '1rem 0',
    overflowY: 'auto' as const,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    margin: 0,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.625rem 1rem',
    textDecoration: 'none',
    color: '#495057',
    fontSize: '0.875rem',
    gap: '0.5rem',
  },
  linkActive: {
    background: '#e8ecf5',
    color: '#2c3e6b',
    fontWeight: 600,
  },
  chip: {
    display: 'inline-block',
    padding: '0.125rem 0.375rem',
    borderRadius: '9999px',
    background: '#fff8e1',
    color: '#7a4f00',
    fontSize: '0.6875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
};

