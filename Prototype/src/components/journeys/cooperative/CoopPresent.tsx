import React, { useState } from 'react';
import type { CaseState, Role } from '../../../engine/types';
import { destinations } from '../../../engine/data';

interface CoopPresentProps {
  caseState: CaseState;
  role: Role;
  onBack: () => void;
  onSaveExit: () => void;
  onRunAction: (action: any) => { ok: boolean; error?: string };
}

export const CoopPresent: React.FC<CoopPresentProps> = ({
  caseState,
  onBack,
  onSaveExit,
  onRunAction,
}) => {
  const [selectedDest, setSelectedDest] = useState<string>('A');
  const [presented, setPresented] = useState<boolean>(!!caseState.presentation);

  const handlePresent = () => {
    onRunAction({
      type: 'present_to_destination',
      destination_id: selectedDest,
    });
    setPresented(true);
  };

  return (
    <div className="journey-card" data-testid="coop-step-8-present">
      <h2 className="journey-title">Present Dossier to Institution</h2>
      <p className="journey-subtitle">
        Transmit the governed enterprise record for institutional credit or programme consideration.
      </p>

      <div className="journey-form-group">
        <label className="journey-label" htmlFor="present-dest">Target Destination</label>
        <select
          id="present-dest"
          className="journey-select"
          value={selectedDest}
          onChange={e => setSelectedDest(e.target.value)}
          disabled={presented}
        >
          {destinations.map(d => (
            <option key={d.id} value={d.id}>
              {d.display_name} — {d.product}
            </option>
          ))}
        </select>
      </div>

      {presented ? (
        <div style={{ padding: '16px', background: 'var(--action-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--action)', marginBottom: '24px' }} data-testid="presentation-success">
          <strong style={{ color: 'var(--action)' }}>✓ Dossier Successfully Presented</strong>
          <div style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text)' }}>
            The dossier has been entered into the institution assessment pipeline with full audit history and limitations intact.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <button
            type="button"
            className="journey-btn-primary"
            onClick={handlePresent}
            data-testid="coop-present-btn"
          >
            Present to Institution
          </button>
        </div>
      )}

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-8-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-8-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
