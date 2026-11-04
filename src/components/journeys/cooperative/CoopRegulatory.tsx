import React from 'react';
import type { CaseState, Role } from '../../../engine/types';

interface CoopRegulatoryProps {
  caseState: CaseState;
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
}

export const CoopRegulatory: React.FC<CoopRegulatoryProps> = ({
  caseState,
  onNext,
  onBack,
  onSaveExit,
}) => {
  const localLetter = caseState.evidence?.local_letter;
  const regEvidence = caseState.evidence?.registration;
  const regNum = regEvidence && typeof regEvidence.registration_number === 'string'
    ? regEvidence.registration_number
    : 'CS/2011/1007';

  return (
    <div className="journey-card" data-testid="coop-step-2-regulatory">
      <h2 className="journey-title">Regulatory Compliance & Local Standing</h2>
      <p className="journey-subtitle">
        Document statutory registration under the Registrar of Cooperatives and local council standing.
      </p>

      <div className="journey-form-group">
        <label className="journey-label">Statutory Status</label>
        <div style={{ padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Registrar of Cooperatives:</strong> Registered Active ({regNum})</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {regEvidence?.limitation || 'Supplied by cooperative.'}
          </div>
        </div>
      </div>

      <div className="journey-form-group">
        <label className="journey-label">Local Traditional / Civic Authority Standing</label>
        <div style={{ padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Local Headman / Council Letter:</strong> {localLetter?.level || 'supported'}</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {localLetter?.limitation || 'Supplied by the cooperative. Not independently checked.'}
          </div>
        </div>
      </div>

      <p className="journey-forward-hint">
        The next step captures the cooperative member roster before establishing governance officers.
      </p>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={onNext}
          data-testid="coop-step-2-continue"
        >
          Continue to Member Roster
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-2-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-2-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
