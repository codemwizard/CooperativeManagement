import React, { useState } from 'react';
import type { CaseState, Role } from '../../../engine/types';
import { EvidenceProvenance } from '../../shell/EvidenceProvenance';

interface CoopRegisterProps {
  caseState: CaseState;
  role: Role;
  onNext: () => void;
  onSaveExit: () => void;
  onUpdateCase: (updater: (prev: CaseState) => CaseState) => void;
  hideEvidence?: boolean;
  readOnly?: boolean;
}

export const CoopRegister: React.FC<CoopRegisterProps> = ({
  caseState,
  onNext,
  onSaveExit,
  onUpdateCase,
  hideEvidence = false,
  readOnly = false,
}) => {
  const [name, setName] = useState(caseState.name || '');
  const [district, setDistrict] = useState(caseState.district || '');
  const [province, setProvince] = useState(caseState.province || '');
  const [activity, setActivity] = useState(caseState.activity || '');

  const regEvidence = caseState.evidence?.registration;
  const regNumber = regEvidence && typeof regEvidence.registration_number === 'string'
    ? regEvidence.registration_number
    : 'CS/2011/1007';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readOnly) {
      onUpdateCase(prev => ({
        ...prev,
        name,
        district,
        province,
        activity,
      }));
    }
    onNext();
  };

  return (
    <div className="journey-card" data-testid="coop-step-1-register">
      {readOnly && (
        <div
          data-testid="view-only-badge"
          style={{
            padding: '4px 10px',
            background: '#e2e8f0',
            color: '#475569',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'inline-block',
            marginBottom: '10px',
            letterSpacing: '0.04em',
          }}
        >
          VIEW ONLY
        </div>
      )}

      <h2 className="journey-title">Cooperative Profile &amp; Registration</h2>
      <p className="journey-subtitle">
        Record the verified legal identity and operating jurisdiction of the cooperative enterprise.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="journey-form-group">
          <label className="journey-label" htmlFor="coop-name">Cooperative Name</label>
          <input
            id="coop-name"
            className="journey-input"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            disabled={readOnly}
            data-testid="coop-step-1-name"
          />
        </div>

        <div className="journey-form-group">
          <label className="journey-label" htmlFor="coop-district">District</label>
          <input
            id="coop-district"
            className="journey-input"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            required
            disabled={readOnly}
            data-testid="coop-step-1-district"
          />
        </div>

        <div className="journey-form-group">
          <label className="journey-label" htmlFor="coop-province">Province</label>
          <input
            id="coop-province"
            className="journey-input"
            value={province}
            onChange={e => setProvince(e.target.value)}
            required
            disabled={readOnly}
            data-testid="coop-step-1-province"
          />
        </div>

        <div className="journey-form-group">
          <label className="journey-label" htmlFor="coop-activity">Primary Value Chain / Activity</label>
          <input
            id="coop-activity"
            className="journey-input"
            value={activity}
            onChange={e => setActivity(e.target.value)}
            required
            disabled={readOnly}
            data-testid="coop-step-1-activity"
          />
        </div>

        {!hideEvidence && regEvidence && (
          <div className="journey-evidence-drawer" data-testid="coop-step-1-evidence-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div>
                <strong>Registration Evidence:</strong> Level: <code>{regEvidence.level}</code>
                <span> | Certificate No: <code>{regNumber}</code></span>
              </div>
              <EvidenceProvenance source="certified_app" collectedBy="cfa.banda" />
            </div>
            <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
              Limitation: {regEvidence.limitation}
            </div>
          </div>
        )}

        <p className="journey-forward-hint">
          The next step establishes regulatory compliance and local standing.
        </p>

        <div className="journey-actions">
          <button
            type="submit"
            className="journey-btn-primary"
            data-testid="coop-step-1-continue"
          >
            Continue to Regulatory Standing
          </button>
          <button
            type="button"
            className="journey-link-secondary"
            onClick={onSaveExit}
            data-testid="coop-step-1-save-exit"
          >
            Save and exit
          </button>
        </div>
      </form>
    </div>
  );
};
