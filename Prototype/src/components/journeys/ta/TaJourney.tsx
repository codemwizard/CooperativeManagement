import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { destinationById, meta } from '../../../engine/data';
import { evaluate } from '../../../engine/evaluate';
import { JourneyShell, StepIndicator } from '../../shell';
import { memberAssetSummary } from '../assetSummary';

interface TaJourneyProps {
  cases: CaseState[];
  onExit: () => void;
  onRunAction: (action: any) => { ok: boolean; error?: string };
}

export const TaJourney: React.FC<TaJourneyProps> = ({
  cases,
  onExit,
  onRunAction,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [assignmentSuccess, setAssignmentSuccess] = useState<boolean>(false);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const evaluation = evaluate(selectedCase, destinationById['A'], meta.demo_date);
  const unresolvedReqs = evaluation.requirements.filter(r => r.state === 'unresolved');
  const memberSummary = memberAssetSummary(selectedCase as any);

  const handleAssignVerification = (evidenceType: string) => {
    const res = onRunAction({
      type: 'assign_verification',
      target: { kind: 'evidence', ref: evidenceType },
      assigned_to: 'vrf.mulenga',
      scope: `TA intervention: verification of ${evidenceType}`,
    });

    if (res.ok) {
      setAssignmentSuccess(true);
    }
  };

  return (
    <JourneyShell role="ta" roleLabel="Technical Assistance Officer" onExit={onExit}>
      <StepIndicator
        step={currentStep}
        totalSteps={2}
        categoryLabel="GAP REMEDIATION & CAPACITY BUILDING"
      />

      {currentStep === 1 && (
        <div className="journey-card" data-testid="ta-queue-view">
          <h2 className="journey-title">Technical Assistance Queue</h2>
          <p className="journey-subtitle">
            Identify institutional assessment gaps in cohort enterprises and deploy capacity building or verification assignments.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {cases.map(c => {
              const evalRes = evaluate(c, destinationById['A'], meta.demo_date);
              const unresCount = evalRes.requirements.filter(r => r.state === 'unresolved').length;
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
                  data-testid={`ta-case-row-${c.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.name}</strong> ({c.district}, {c.province})
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Value chain: {c.activity} · {unresCount} unresolved requirement(s)
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: unresCount === 0 ? 'var(--verified)' : '#b76515',
                        color: '#fff',
                      }}
                    >
                      {unresCount === 0 ? 'Fully Resolved' : `${unresCount} Gaps Open`}
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
              onClick={() => {
                setAssignmentSuccess(false);
                setCurrentStep(2);
              }}
              data-testid="ta-remediate-btn"
            >
              Open Gap Remediation Workbench →
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="journey-card" data-testid="ta-workbench-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Remediation: {selectedCase.name}</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Deploy targeted interventions to close evidence and governance gaps.
              </p>
            </div>
            <button
              type="button"
              className="journey-btn-secondary"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setCurrentStep(1)}
              data-testid="ta-back-btn"
            >
              ← Back to Queue
            </button>
          </div>

          {assignmentSuccess && (
            <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--action-soft)', border: '1px solid var(--action)', borderRadius: 'var(--radius-sm)' }} data-testid="ta-assignment-success">
              <strong style={{ color: 'var(--action)' }}>✓ Verification Successfully Assigned</strong>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                Assignment recorded in audit events log. Note: Evidence level does not advance until the independent verifier submits a verified finding.
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} data-testid="member-asset-summary">
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              <strong>{memberSummary.label}:</strong> {memberSummary.livestock_item_count} items (est. ZMW {memberSummary.livestock_est_value_zmw.toLocaleString()}) · Encumbrance: {memberSummary.encumbrance_summary}
            </div>
          </div>

          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Unresolved Destination Requirements</h4>
          {unresolvedReqs.length === 0 ? (
            <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', color: 'var(--muted)' }}>
              All requirements for Destination A are satisfied.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unresolvedReqs.map(req => {
                const evType = req.evidence_ref || 'governance';
                return (
                  <div key={req.id} style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} data-testid={`unresolved-req-${req.id}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{req.title}</strong>
                        <div style={{ fontSize: '12px', color: '#b76515', marginTop: '2px' }}>
                          Reason: {req.reason || 'Evidence level below threshold'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="journey-btn-secondary"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => handleAssignVerification(evType)}
                        data-testid={`assign-verification-${req.id}`}
                      >
                        Assign Independent Verification
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Return to TA Queue
            </button>
          </div>
        </div>
      )}
    </JourneyShell>
  );
};
