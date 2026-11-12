import React from 'react';
import type { Role } from '../../../engine/types';

interface RoleGateProps {
  role: Role;
  stepName: string;
  allowedRoles: Role[];
  children: React.ReactNode;
  onBack?: () => void;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  role,
  stepName,
  allowedRoles,
  children,
  onBack,
}) => {
  const isAllowed = allowedRoles.includes(role);

  if (isAllowed) {
    return <>{children}</>;
  }

  const roleNameMap: Record<string, string> = {
    treasurer: 'Cooperative Treasurer',
    member: 'Cooperative Member',
    field_agent: 'Field Agent',
    secretary: 'Cooperative Secretary',
    chairman: 'Cooperative Chairman',
  };

  return (
    <div className="journey-card" data-testid="role-gate-blocked" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '14px' }}>🔒</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
        Access Restricted: {stepName}
      </h3>
      <div style={{ display: 'inline-block', padding: '4px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '999px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
        Current Role: {roleNameMap[role] || role} (Not permitted for this step)
      </div>
      <p style={{ maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: 1.6, color: 'var(--muted)' }}>
        Governance review, statutory submissions, and institutional dossier presentation require authorization from the <strong>Cooperative Chairman</strong> or <strong>Cooperative Secretary</strong>.
      </p>
      {onBack && (
        <button
          type="button"
          className="journey-btn-secondary"
          style={{ width: 'auto', padding: '8px 20px', fontSize: '13px' }}
          onClick={onBack}
          data-testid="role-gate-back-btn"
        >
          ← Return to Member Roster
        </button>
      )}
    </div>
  );
};
