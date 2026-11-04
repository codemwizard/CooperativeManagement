import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { ProvenanceDrawer } from '../../shell/ProvenanceDrawer';

interface CoopClaimsProps {
  caseState: CaseState;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
}

export const CoopClaims: React.FC<CoopClaimsProps> = ({
  caseState,
  onNext,
  onBack,
  onSaveExit,
}) => {
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const evidenceMap = caseState.evidence || {};
  const evidenceEntries = Object.entries(evidenceMap);

  return (
    <div className="journey-card" data-testid="coop-claims-step">
      <h2 className="journey-title">Claims — Evidence to be Verified</h2>
      <p className="journey-subtitle">
        Review all registered claims and evidentiary artefacts submitted for independent verification and institutional assessment.
      </p>

      <div style={{ marginBottom: '24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-raised)' }}>
              <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Evidence Type</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Description / Identifier</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Level</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Provenance</th>
              <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>Verification Status</th>
            </tr>
          </thead>
          <tbody>
            {evidenceEntries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>
                  No evidence records registered yet.
                </td>
              </tr>
            ) : (
              evidenceEntries.map(([key, evItem]) => {
                const item = evItem as any;
                const level = item.level || 'asserted';
                const isVerified = level === 'verified';

                return (
                  <tr key={key} style={{ borderBottom: '1px solid var(--border)' }} data-testid={`claim-row-${key}`}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                      <code>{key}</code>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                      {item.registration_number || item.description || item.limitation || 'Official cooperative record'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: isVerified ? '#dcfce7' : '#fef9c3',
                        color: isVerified ? '#166534' : '#854d0e',
                      }}>
                        {level}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        type="button"
                        className="journey-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', width: 'auto' }}
                        onClick={() => setSelectedClaim(key)}
                        data-testid={`inspect-provenance-${key}`}
                      >
                        Inspect provenance
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isVerified ? (
                        <span style={{ color: '#166534', fontWeight: 700 }} data-testid={`status-${key}`}>
                          Verified ✓
                        </span>
                      ) : (
                        <span style={{ color: 'var(--action)', fontWeight: 600 }} data-testid={`status-${key}`}>
                          Pending Verification
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedClaim && evidenceMap[selectedClaim] && (
        <ProvenanceDrawer
          evidenceType={selectedClaim}
          evidenceLabel={selectedClaim === 'livestock_count' ? 'Livestock Count' : selectedClaim.replace(/_/g, ' ')}
          evidence={evidenceMap[selectedClaim]}
          eventLog={caseState.events}
          findings={caseState.verification?.findings || []}
          assignments={caseState.verification?.assignments || []}
          demoActor="fa.banda (Demo Actor — Gift Mulenga, Cooperative Field Agent)"
          onClose={() => setSelectedClaim(null)}
        />
      )}

      <div style={{
        padding: '14px 18px',
        background: 'var(--surface-raised)',
        borderRadius: 'var(--radius-sm)',
        borderLeft: '4px solid var(--action)',
        marginBottom: '20px',
        fontSize: '13px',
      }}>
        <strong>Independent Assessment Standard:</strong> All asserted claims remain unweighted until an independent verifier or institutional credit team reviews source provenance and signs off.
      </div>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={onNext}
          data-testid="coop-claims-submit"
        >
          Submit Claims for Verification
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-claims-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-claims-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
