import React from 'react';
import type { CaseState, Role } from '../../../engine/types';

interface CoopHistoryProps {
  caseState: CaseState;
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
}

export const CoopHistory: React.FC<CoopHistoryProps> = ({
  caseState,
  onNext,
  onBack,
  onSaveExit,
}) => {
  const farmingHistory = caseState.evidence?.farming_history;
  const incomeRecords = caseState.evidence?.income_records;

  const seasonsStr = farmingHistory && typeof farmingHistory.seasons === 'number'
    ? String(farmingHistory.seasons)
    : '1';
  const basisStr = farmingHistory && typeof farmingHistory.basis === 'string'
    ? farmingHistory.basis
    : 'Programme records and member testimony';

  return (
    <div className="journey-card" data-testid="coop-step-5-history">
      <h2 className="journey-title">Operating & Farming History</h2>
      <p className="journey-subtitle">
        Document past production cycles, yield history, and commercial offtake performance.
      </p>

      <div className="journey-form-group">
        <label className="journey-label">Farming Seasons Record</label>
        <div style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Completed Seasons:</strong> {seasonsStr} season(s)</div>
          <div><strong>Basis:</strong> {basisStr}</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {farmingHistory?.limitation || 'Supplied by the cooperative. Not independently checked.'}
          </div>
        </div>
      </div>

      <div className="journey-form-group">
        <label className="journey-label">Commercial Revenue & Income Records</label>
        <div style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Level:</strong> {incomeRecords?.level || 'supported'}</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {incomeRecords?.limitation || 'Supplied by the cooperative. Not independently checked.'}
          </div>
        </div>
      </div>

      <p className="journey-forward-hint">
        The next step captures cooperative-owned assets, land title, and production baseline.
      </p>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={onNext}
          data-testid="coop-step-5-continue"
        >
          Continue to Cooperative Baseline
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-5-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-5-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
