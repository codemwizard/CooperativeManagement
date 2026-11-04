import React from 'react';
import type { CaseState, Role } from '../../../engine/types';
import type { CoopAsset } from '../types.display';

interface CoopBaselineProps {
  caseState: CaseState & { coop_assets?: CoopAsset[] };
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
}

export const CoopBaseline: React.FC<CoopBaselineProps> = ({
  caseState,
  onNext,
  onBack,
  onSaveExit,
}) => {
  const landRight = caseState.evidence?.land_right;
  const envBaseline = caseState.evidence?.environmental_baseline;
  const coopAssets: CoopAsset[] = caseState.coop_assets ?? [];

  return (
    <div className="journey-card" data-testid="coop-step-6-baseline">
      <h2 className="journey-title">Cooperative Assets & Baseline</h2>
      <p className="journey-subtitle">
        Document communal property, customary land rights, and environmental baseline metrics.
      </p>

      <div className="journey-form-group">
        <label className="journey-label">Cooperative-Owned Assets</label>
        {coopAssets.length === 0 ? (
          <div style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', color: 'var(--muted)' }}>
            No communal assets recorded.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {coopAssets.map((asset, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                <strong>{asset.type}</strong>: {asset.description}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Encumbrance: {asset.encumbrance}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="journey-form-group">
        <label className="journey-label">Land Right Status</label>
        <div style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Standing:</strong> {landRight?.level || 'supported'}</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {landRight?.limitation || 'Supplied by the cooperative. Customary title not independently verified.'}
          </div>
        </div>
      </div>

      <div className="journey-form-group">
        <label className="journey-label">Environmental Baseline</label>
        <div style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div><strong>Standing:</strong> {envBaseline?.level || 'supported'}</div>
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '12px' }}>
            Limitation: {envBaseline?.limitation || 'Supplied by the cooperative. Not independently checked.'}
          </div>
        </div>
      </div>

      <p className="journey-forward-hint">
        The next step assesses readiness against specific financial and programme destinations.
      </p>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={onNext}
          data-testid="coop-step-6-continue"
        >
          Continue to Readiness Assessment
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-6-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-6-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
