import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { JourneyShell, StepIndicator } from '../../shell';
import { ProvenanceDrawer } from '../../shell/ProvenanceDrawer';

interface VvbJourneyProps {
  cases: CaseState[];
  onExit: () => void;
  onReset?: () => void;
  onRunAction: (action: any) => { ok: boolean; error?: string };
}

export const VvbJourney: React.FC<VvbJourneyProps> = ({
  cases,
  onExit,
  onReset,
  onRunAction,
}) => {
  const [selectedCaseId] = useState<string>('case-1');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [assignmentId, setAssignmentId] = useState<string>('asg-reg-001');
  const [evidenceType, setEvidenceType] = useState<string>('registration');
  const [result, setResult] = useState<string>('');
  const [scope, setScope] = useState<string>('');
  const [limitation, setLimitation] = useState<string>('');
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [promotionSuccess, setPromotionSuccess] = useState<boolean>(false);
  const [lastFindingId, setLastFindingId] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState<boolean>(false);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const assignments = selectedCase.verification?.assignments || [];
  const openAssignments = assignments.filter(a => a.status === 'assigned');
  const lcAssignment = openAssignments.find(a => a.target.ref === 'livestock_count');

  // Test 9 invariant: Submit button is disabled until result, scope, and limitation are all non-empty!
  const isFormValid = result.trim() !== '' && scope.trim() !== '' && limitation.trim() !== '';

  const handleSubmitFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const res = onRunAction({
      type: 'record_verification_finding',
      assignment_id: assignmentId,
      result,
      scope,
      limitation,
      evidence_type: evidenceType,
    });

    if (res.ok) {
      setSubmissionSuccess(true);
      // Retrieve the newly created finding id or fall back to assignment ref
      const findings = selectedCase.verification?.findings || [];
      const latest = findings[findings.length - 1];
      setLastFindingId(latest ? latest.id : `fnd-${Date.now()}`);
    }
  };

  const handlePromote = () => {
    const findings = selectedCase.verification?.findings || [];
    // Find qualifying finding on this evidence
    const currentVersion = selectedCase.evidence[evidenceType]?.version_id ?? 1;
    const targetAssignmentIds = new Set(assignments.filter(a => a.target.ref === evidenceType).map(a => a.id));
    targetAssignmentIds.add(assignmentId);

    const qualifying = [...findings].reverse().find(
      f => targetAssignmentIds.has(f.assignment_id) &&
           (f.version_id === undefined || f.version_id === currentVersion) &&
           (f.result === 'verified_conformant' || f.result === 'verified_with_qualifications' || f.result === 'verified')
    );
    const fid = qualifying?.id || lastFindingId;
    if (!fid) return;

    const res = onRunAction({
      type: 'promote_evidence_level',
      evidence_type: evidenceType,
      finding_id: fid,
    });

    if (res.ok) {
      setPromotionSuccess(true);
    }
  };

  return (
    <JourneyShell
      role="verifier"
      roleLabel="Independent Verifier (VVB)"
      onExit={onExit}
      onReset={onReset}
    >
      <div
        data-testid="vvb-demo-actor"
        style={{
          fontSize: '12px',
          color: 'var(--muted)',
          marginBottom: '10px',
          padding: '8px 12px',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--action)',
        }}
      >
        Demo Actor: Chola Mulenga (Verifier, vrf.mulenga) — simulated, not authenticated.
      </div>

      <StepIndicator
        step={currentStep}
        totalSteps={2}
        categoryLabel="INDEPENDENT VERIFICATION"
      />

      {currentStep === 1 && (
        <div className="journey-card" data-testid="vvb-step-queue">
          <h2 className="journey-title">Assurance Queue & Scope Workbench</h2>
          <p className="journey-subtitle">
            Execute scope-bounded physical or documentary verifications on assigned evidence items.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Active Assignments</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Registration Assignment */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  border: assignmentId === 'asg-reg-001' ? '2px solid var(--action)' : '1px solid var(--border)',
                  background: assignmentId === 'asg-reg-001' ? 'var(--action-soft)' : 'var(--surface-raised)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setAssignmentId('asg-reg-001');
                  setEvidenceType('registration');
                  setSubmissionSuccess(false);
                  setPromotionSuccess(false);
                  setCurrentStep(2);
                }}
                data-testid="assignment-row-registration"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{selectedCase.name}</strong> — Registration Standing
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      Scope: PACRA / Registrar of Cooperatives Registry Query · Assigned: 2026-08-10
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--action)' }}>
                    Pending Finding
                  </span>
                </div>
              </div>

              {/* Livestock Count Assignment if present */}
              {lcAssignment ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    border: assignmentId === lcAssignment.id ? '2px solid var(--action)' : '1px solid var(--border)',
                    background: assignmentId === lcAssignment.id ? 'var(--action-soft)' : 'var(--surface-raised)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setAssignmentId(lcAssignment.id);
                    setEvidenceType('livestock_count');
                    setSubmissionSuccess(false);
                    setPromotionSuccess(false);
                    setCurrentStep(2);
                  }}
                  data-testid="assignment-row-livestock_count"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{selectedCase.name}</strong> — Livestock Count
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Assignment: <code>{lcAssignment.id}</code> · Scope: {lcAssignment.scope}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--action)' }}>
                      Pending Finding
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="no-lc-assignment-notice"
                  style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}
                >
                  No open assignment for livestock count evidence. Request must come from the PFI screen first.
                </div>
              )}
            </div>
          </div>

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(2)}
              data-testid="vvb-open-workbench-btn"
            >
              Open Verification Finding Form →
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="journey-card" data-testid="vvb-step-workbench">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Record Verification Finding</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Assignment: <code>{assignmentId}</code> ({selectedCase.name} · {evidenceType} · v{selectedCase.evidence[evidenceType]?.version_id ?? 1})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="journey-btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setShowProvenance(true)}
                data-testid="vvb-inspect-provenance-btn"
              >
                Inspect provenance
              </button>
              <button
                type="button"
                className="journey-btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setCurrentStep(1)}
                data-testid="vvb-back-to-queue"
              >
                ← Back to Queue
              </button>
            </div>
          </div>

          {submissionSuccess ? (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  padding: '16px',
                  background: 'var(--action-soft)',
                  border: '1px solid var(--action)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                }}
                data-testid="finding-success"
              >
                <strong style={{ color: 'var(--action)' }}>✓ Verification Finding Successfully Recorded</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Finding recorded. Evidence level has NOT changed. A separate promotion step is required.
                </div>
              </div>

              {!promotionSuccess ? (
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong>Promotion Step:</strong> Advance evidence level citing the recorded conformant finding.
                  </div>
                  <button
                    type="button"
                    className="journey-btn-primary"
                    style={{ width: 'auto' }}
                    onClick={handlePromote}
                    data-testid="confirm-promotion-btn"
                  >
                    Confirm promotion
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    borderRadius: 'var(--radius-sm)',
                    color: '#166534',
                  }}
                  data-testid="promotion-success"
                >
                  <strong>✓ Promoted to Verified.</strong>
                  {selectedCase.evidence[evidenceType]?.qualifications?.length ? (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Qualifications retained and visible in the provenance drawer.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitFinding}>
              <div className="journey-form-group">
                <label className="journey-label" htmlFor="finding-result">Verification Result</label>
                <select
                  id="finding-result"
                  className="journey-select"
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  data-testid="finding-result-select"
                >
                  <option value="">-- Select result --</option>
                  <option value="verified">Verified (Satisfied without exception)</option>
                  <option value="verified_conformant">Verified Conformant</option>
                  <option value="verified_with_qualifications">Verified With Qualifications</option>
                  <option value="supported">Supported (Evidence confirmed with limitation)</option>
                  <option value="exception">Exception (Discrepancy or failure detected)</option>
                  <option value="non_conformant">Non-conformant</option>
                  <option value="inconclusive">Inconclusive</option>
                </select>
              </div>

              <div className="journey-form-group">
                <label className="journey-label" htmlFor="finding-scope">Verification Scope</label>
                <textarea
                  id="finding-scope"
                  className="journey-textarea"
                  rows={2}
                  placeholder="e.g. Physical on-site inspection of membership register and minutes at Chibombo district office."
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  data-testid="finding-scope-input"
                />
              </div>

              <div className="journey-form-group">
                <label className="journey-label" htmlFor="finding-limitation">Audited Limitation</label>
                <textarea
                  id="finding-limitation"
                  className="journey-textarea"
                  rows={2}
                  placeholder="e.g. Sampling limited to 15 active members. National registry database offline during inspection."
                  value={limitation}
                  onChange={e => setLimitation(e.target.value)}
                  data-testid="finding-limitation-input"
                />
              </div>

              <div style={{ marginTop: '20px' }}>
                <button
                  type="submit"
                  className="journey-btn-primary"
                  disabled={!isFormValid}
                  data-testid="finding-submit-btn"
                >
                  Submit Governed Finding
                </button>
              </div>
            </form>
          )}

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Return to Verification Queue
            </button>
          </div>
        </div>
      )}

      {showProvenance && selectedCase.evidence[evidenceType] && (
        <ProvenanceDrawer
          evidenceType={evidenceType}
          evidenceLabel={evidenceType === 'livestock_count' ? 'Livestock Count' : evidenceType.replace(/_/g, ' ')}
          evidence={selectedCase.evidence[evidenceType]}
          eventLog={selectedCase.events}
          findings={selectedCase.verification?.findings || []}
          assignments={selectedCase.verification?.assignments || []}
          demoActor="Chola Mulenga (Verifier, vrf.mulenga) — simulated, not authenticated"
          onRecordFinding={() => {
            setShowProvenance(false);
            setCurrentStep(2);
          }}
          onPromote={submissionSuccess && !promotionSuccess ? handlePromote : undefined}
          onClose={() => setShowProvenance(false)}
        />
      )}
    </JourneyShell>
  );
};

