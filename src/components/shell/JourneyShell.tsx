import React from 'react';
import type { Role } from '../../engine/types';

interface JourneyShellProps {
  role: Role;
  roleLabel?: string;
  onExit?: () => void;
  onReset?: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  chairman: 'Chairman',
  member: 'Member',
  field_agent: 'Field Agent',
  ta: 'Technical Assistance',
  pfi_analyst: 'PFI Analyst',
  pfi_credit: 'PFI Credit Officer',
  verifier: 'Independent Verifier',
  fund_manager: 'Fund Manager',
  technician: 'Field Technician',
  coop_field_agent: 'Cooperative Field Agent',
};

export const JourneyShell: React.FC<JourneyShellProps> = ({
  role,
  roleLabel,
  onExit,
  onReset,
  children,
  wide = false,
}) => {
  const displayRole = roleLabel || ROLE_DISPLAY_NAMES[role] || role;

  return (
    <div className="journey-shell" data-testid="journey-shell">
      <header className="journey-header" data-testid="journey-header">
        <div className="journey-header-left">
          <span className="journey-brand">Symphony</span>
          <span className="journey-role-badge" data-testid="journey-role-badge">
            {displayRole}
          </span>
        </div>
        <div className="journey-header-right">
          {onReset && (
            <button
              type="button"
              className="journey-exit-btn"
              onClick={onReset}
              data-testid="reset-demo"
              style={{ marginRight: '8px' }}
            >
              Reset demo
            </button>
          )}
          {onExit && (
            <button
              type="button"
              className="journey-exit-btn"
              onClick={onExit}
              data-testid="journey-exit-demo"
            >
              Exit demo
            </button>
          )}
        </div>
      </header>

      <main className="journey-main">
        <div className={`journey-container${wide ? ' journey-container--wide' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
