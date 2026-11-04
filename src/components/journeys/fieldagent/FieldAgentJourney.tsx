import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { JourneyShell, StepIndicator } from '../../shell';
import type { MemberRosterItem } from '../types.display';

interface FieldAgentJourneyProps {
  cases: CaseState[];
  onExit: () => void;
  onRunAction: (action: any) => { ok: boolean; error?: string };
}

export const FieldAgentJourney: React.FC<FieldAgentJourneyProps> = ({
  cases,
  onExit,
  onRunAction,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const roster: MemberRosterItem[] = (selectedCase as any).members_roster ?? [];

  const handleMarkVerified = (evidenceType: string) => {
    setVerifySuccess(null);
    setVerifyError(null);

    const res = onRunAction({
      type: 'mark_verified',
      evidence_type: evidenceType,
      limitation: 'Field verified on-site by accredited field extension agent.',
    });

    if (res.ok) {
      setVerifySuccess(`Evidence '${evidenceType}' successfully verified in the field.`);
    } else {
      setVerifyError(`Engine constraint: ${res.error || 'CANNOT_VERIFY'}`);
    }
  };

  return (
    <JourneyShell
      role="field_agent"
      roleLabel="Field Agent"
      onExit={onExit}
    >
      <StepIndicator
        step={currentStep}
        totalSteps={2}
        categoryLabel="FIELD ENUMERATION & VERIFICATION"
      />

      {currentStep === 1 && (
        <div className="journey-card" data-testid="fieldagent-caselist-view">
          <h2 className="journey-title">Assigned Field Cooperatives</h2>
          <p className="journey-subtitle">
            Field data collection, physical verification of assets, and primary member roster enumeration.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {cases.map(c => {
              const isSelected = c.id === selectedCaseId;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--action)' : '1px solid var(--line)',
                    background: isSelected ? 'var(--action-soft)' : 'var(--surface-raised)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedCaseId(c.id)}
                  data-testid={`fieldagent-case-${c.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.name}</strong> ({c.district}, {c.province})
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Value chain: {c.activity} · {c.members} members
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--action)', fontWeight: 600 }}>
                      Inspect Field Records →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(2)}
              data-testid="fieldagent-open-case-btn"
            >
              Open Field Verification Workbench →
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="journey-card" data-testid="fieldagent-workbench-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Field Workbench: {selectedCase.name}</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                District: {selectedCase.district} · Enumerated Members: {roster.length}
              </p>
            </div>
            <button
              type="button"
              className="journey-btn-secondary"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setCurrentStep(1)}
              data-testid="fieldagent-back-btn"
            >
              ← Back to List
            </button>
          </div>

          {verifySuccess && (
            <div style={{ padding: '12px', background: 'var(--action-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--action)', fontWeight: 600, fontSize: '13px', marginBottom: '16px' }}>
              ✓ {verifySuccess}
            </div>
          )}

          {verifyError && (
            <div className="journey-discrepancy-card" style={{ marginBottom: '16px' }}>
              <div className="journey-discrepancy-title">Verification Blocked</div>
              <div className="journey-discrepancy-text">{verifyError}</div>
            </div>
          )}

          {/* Member Roster (Field Agent has legitimate access per §5 Access Map) */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Enumerated Member Roster ({roster.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {roster.map(m => (
                <div key={m.member_id} style={{ padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px' }}>
                  <strong>{m.name}</strong> ({m.member_id} · {m.cooperative_role})
                  {m.livestock && m.livestock.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      Declared: {m.livestock.map(l => `${l.count} ${l.species} (Encumbrance: ${l.encumbrance})`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Verification Action */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Field Verification of Evidence</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(selectedCase.evidence || {}).map(([key, ev]) => (
                <div key={key} style={{ padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Current Level: <code>{ev.level}</code> · Supplied by: {ev.supplied_by}
                    </div>
                  </div>
                  {ev.level !== 'verified' && (
                    <button
                      type="button"
                      className="journey-btn-secondary"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleMarkVerified(key)}
                      data-testid={`fieldagent-verify-${key}`}
                    >
                      Field Verify
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Return to Cooperative List
            </button>
          </div>
        </div>
      )}
    </JourneyShell>
  );
};
