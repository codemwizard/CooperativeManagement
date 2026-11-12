import React, { useState, useEffect, useRef } from 'react';
import type { Assignment, EngineEvent, EvidenceItem, Finding } from '../../engine/types';
import { meta } from '../../engine/data';
import { computeSnapshotChecksum } from '../../engine/persistence';
import { computeClaimVersionFingerprint } from '../../engine/actions';

export interface ProvenanceDrawerProps {
  evidenceType: string;
  evidenceLabel: string;
  evidence: EvidenceItem;
  eventLog?: EngineEvent[];
  findings?: Finding[];
  assignments?: Assignment[];
  demoDate?: string;
  demoActor?: string;
  onRequestVerification?: () => void;
  onRecordFinding?: () => void;
  onPromote?: () => void;
  onClose: () => void;
  drawerTestId?: string;
  closeTestId?: string;
}

export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  evidenceType,
  evidenceLabel,
  evidence,
  eventLog = [],
  findings = [],
  assignments = [],
  demoDate = meta.demo_date,
  demoActor = 'fa.banda (Demo Actor — Gift Mulenga, Cooperative Field Agent)',
  onRequestVerification,
  onRecordFinding,
  onPromote,
  onClose,
  drawerTestId = 'provenance-drawer',
  closeTestId = 'close-provenance-drawer',
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'integrity'>('summary');
  const [integrityStatus, setIntegrityStatus] = useState<string>('Not checked');
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);
  const [recomputedFingerprint, setRecomputedFingerprint] = useState<string | null>(null);
  const [envelopeCheckPassed, setEnvelopeCheckPassed] = useState<boolean | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Check verification assignments and findings
  const relevantAssignments = assignments.filter(
    (a) => a.target.kind === 'evidence' && a.target.ref === evidenceType
  );
  const relevantAssignmentIds = new Set(relevantAssignments.map((a) => a.id));
  const relevantFindings = findings.filter(
    (f) => relevantAssignmentIds.has(f.assignment_id) || (f as any).evidence_type === evidenceType
  );

  // Check conflict state
  const hasOpposingFindings =
    relevantFindings.some((f) => f.result === 'non_conformant') &&
    relevantFindings.some((f) => f.result === 'verified_conformant' || f.result === 'verified_with_qualifications');
  const isConflicted = evidence.conflict_state === 'unresolved_conflict' || hasOpposingFindings;
  const isConflictResolved = evidence.conflict_state === 'resolved';

  // Filter events related to this evidence type
  const relevantEvents = eventLog.filter((evt) => {
    const target = evt.target as Record<string, unknown> | null;
    if (!target) return false;
    return (
      target.ref === evidenceType ||
      target.evidence_type === evidenceType ||
      (target.assignment_id && relevantAssignmentIds.has(String(target.assignment_id))) ||
      (evt.action === 'promote_evidence_level' && target.evidence_type === evidenceType) ||
      (evt.action === 'resolve_finding_conflict' && target.evidence_type === evidenceType)
    );
  });

  const derivedVerificationStatus = isConflicted
    ? `Conflict: ${relevantFindings.length} divergent findings recorded`
    : relevantFindings.length > 0
    ? `${relevantFindings.length} finding(s) recorded: ${relevantFindings.map((f) => f.result).join(', ')}`
    : relevantAssignments.length > 0
    ? `Assignment open (${relevantAssignments[relevantAssignments.length - 1].status})`
    : 'Not requested';

  const handleRunIntegrityCheck = async () => {
    try {
      // 1. Claim-version fingerprint check
      const storedFingerprint = evidence.fingerprint;
      const computed = computeClaimVersionFingerprint({
        claim_id: evidence.claim_id ?? evidenceType,
        version_id: evidence.version_id ?? 1,
        description: (evidence as any).description,
        quantity: (evidence as any).quantity,
        source: (evidence as any).source,
        supplied_by: evidence.supplied_by,
        supplied_on: evidence.supplied_on,
      });
      setRecomputedFingerprint(computed);

      // 2. Envelope checksum check
      try {
        computeSnapshotChecksum({ id: 'demo', evidence: { [evidenceType]: evidence } } as any);
        setEnvelopeCheckPassed(true);
      } catch {
        setEnvelopeCheckPassed(false);
      }

      // Determine honest status (P1-7: never pretend passed when reference fingerprint missing)
      if (storedFingerprint) {
        if (storedFingerprint === computed) {
          setIntegrityStatus('Passed');
          setIntegrityMessage('✓ Local check passed: computed digest matches reference claim fingerprint.');
        } else {
          setIntegrityStatus('Failed');
          setIntegrityMessage('✗ Local check failed: computed digest does not match reference claim fingerprint.');
        }
      } else {
        setIntegrityStatus('Not comparable');
        setIntegrityMessage('No reference fingerprint stored for this record. Cannot compare.');
      }
    } catch {
      setIntegrityStatus('Error');
      setIntegrityMessage('Unable to complete local hash calculation.');
    }
  };

  const level = evidence.level ?? 'none';

  return (
    <aside
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Evidence provenance"
      data-testid={drawerTestId}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '440px',
        maxWidth: '94vw',
        background: 'var(--surface, #ffffff)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        borderLeft: '1px solid var(--border, #e2e8f0)',
      }}
    >
      {/* Header */}
      <div
        className="drawer-header"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>
            Evidence Provenance
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 700 }}>
            {evidenceLabel}
          </h2>
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          data-testid={closeTestId}
          className="journey-btn-secondary"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
        >
          Close ✕
        </button>
      </div>

      {/* Unresolved Conflict Banner (P1-8) */}
      {isConflicted && (
        <div
          data-testid="conflict-alert-banner"
          style={{
            padding: '12px 18px',
            background: '#fef2f2',
            borderLeft: '4px solid #dc2626',
            borderBottom: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span>
            <span>Unresolved Finding Conflict</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4 }}>
            Divergent verification findings exist on this evidence. Promotion to Verified is blocked until an attributable conflict resolution is recorded.
          </div>
        </div>
      )}

      {/* Conflict Resolved Banner */}
      {isConflictResolved && (
        <div
          data-testid="conflict-resolved-banner"
          style={{
            padding: '12px 18px',
            background: '#f0fdf4',
            borderLeft: '4px solid #16a34a',
            borderBottom: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✓</span>
            <span>Finding Conflict Resolved</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#14532d', lineHeight: 1.4 }}>
            An attributable resolution was recorded. Promotion eligibility restored in accordance with governed findings.
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div
        className="provenance-drawer__tabs"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          background: 'var(--surface-muted, #f8fafc)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          data-testid="tab-summary"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            borderBottom: activeTab === 'summary' ? '2px solid var(--action, #2563eb)' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'summary' ? 700 : 500,
            color: activeTab === 'summary' ? 'var(--action, #2563eb)' : 'var(--muted, #64748b)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          data-testid="tab-history"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--action, #2563eb)' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'history' ? 700 : 500,
            color: activeTab === 'history' ? 'var(--action, #2563eb)' : 'var(--muted, #64748b)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          History ({relevantFindings.length + relevantEvents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('integrity')}
          data-testid="tab-integrity"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            borderBottom: activeTab === 'integrity' ? '2px solid var(--action, #2563eb)' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'integrity' ? 700 : 500,
            color: activeTab === 'integrity' ? 'var(--action, #2563eb)' : 'var(--muted, #64748b)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Integrity (3-Layer)
        </button>
      </div>

      {/* Tab Panels */}
      <div style={{ padding: '20px', flex: 1 }}>
        {activeTab === 'summary' && (
          <div data-testid="panel-summary">
            <dl className="evidence-list" style={{ margin: 0, display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 12px', fontSize: '13px' }}>
              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Claim</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{evidenceLabel}</dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Evidence level</dt>
              <dd style={{ margin: 0 }}>
                <span
                  className={`state-${level}`}
                  data-testid="provenance-level-badge"
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {level}
                </span>
              </dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Scope</dt>
              <dd style={{ margin: 0 }}>{String(evidence.scope ?? 'Not specified')}</dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Demo Actor</dt>
              <dd style={{ margin: 0 }}>
                <span>{demoActor}</span>{' '}
                <em style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>(simulated, not authenticated)</em>
              </dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Capture date</dt>
              <dd style={{ margin: 0 }}>{String((evidence as any).capture_date ?? evidence.supplied_on ?? 'None')}</dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Demo time</dt>
              <dd style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                Demo time: {demoDate}. Timestamps are deterministic demo values.
              </dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Method</dt>
              <dd style={{ margin: 0 }}>{String((evidence as any).method ?? 'Not recorded')}</dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Limitation</dt>
              <dd style={{ margin: 0, color: '#b45309' }}>{evidence.limitation}</dd>

              <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Verification</dt>
              <dd style={{ margin: 0 }}>
                <span style={{ color: isConflicted ? '#dc2626' : 'inherit', fontWeight: isConflicted ? 700 : 400 }}>
                  {derivedVerificationStatus}
                </span>
              </dd>

              {Boolean(evidence.supporting_artefact_id) && (
                <>
                  <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Artefact ID</dt>
                  <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px' }}>
                    {String(evidence.supporting_artefact_id)}
                  </dd>
                </>
              )}

              {Boolean(evidence.artefact_hash) && (
                <>
                  <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Artefact Hash</dt>
                  <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                    {String(evidence.artefact_hash)}
                  </dd>
                </>
              )}

              {evidence.qualifications && evidence.qualifications.length > 0 && (
                <>
                  <dt style={{ fontWeight: 600, color: 'var(--muted, #64748b)' }}>Qualifications</dt>
                  <dd style={{ margin: 0, color: '#dc2626' }}>{evidence.qualifications.join('; ')}</dd>
                </>
              )}
            </dl>

            <div
              style={{
                marginTop: '24px',
                padding: '12px 14px',
                background: 'var(--surface-muted, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--muted, #64748b)',
                lineHeight: 1.5,
              }}
            >
              Synthetic demo artefact. Provenance modelled in this prototype.
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div data-testid="panel-history">
            {/* Complete Finding History Section (P1-8: No single-finding shortcut) */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--muted, #64748b)' }}>
                Verification Findings ({relevantFindings.length})
              </h4>

              {relevantFindings.length === 0 ? (
                <div style={{ color: 'var(--muted, #64748b)', fontSize: '12px', fontStyle: 'italic', padding: '6px 0' }}>
                  No independent findings recorded for this evidence item.
                </div>
              ) : (
                <div data-testid="findings-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {relevantFindings.map((f, idx) => {
                    const isConformant = f.result === 'verified_conformant';
                    const isQualified = f.result === 'verified_with_qualifications';
                    const isNonConformant = f.result === 'non_conformant';
                    const badgeBg = isConformant ? '#dcfce7' : isQualified ? '#fef3c7' : isNonConformant ? '#fee2e2' : '#f1f5f9';
                    const badgeColor = isConformant ? '#15803d' : isQualified ? '#b45309' : isNonConformant ? '#b91c1c' : '#475569';

                    return (
                      <div
                        key={f.id || `f-${idx}`}
                        data-testid={`finding-entry-${f.id}`}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--surface, #ffffff)',
                          border: '1px solid var(--border, #e2e8f0)',
                          borderLeft: `3px solid ${badgeColor}`,
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              background: badgeBg,
                              color: badgeColor,
                              fontWeight: 700,
                              fontSize: '11px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {f.result.replace(/_/g, ' ')}
                          </span>
                          <span style={{ color: 'var(--muted, #64748b)', fontSize: '11px' }}>
                            {f.recorded_on}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text, #1e293b)', fontWeight: 600 }}>
                          Verifier: {f.verifier} · Finding ID: [{f.id}]
                        </div>
                        <div style={{ color: 'var(--muted, #64748b)', marginTop: '2px' }}>
                          Scope: {f.scope}
                        </div>
                        <div style={{ color: '#b45309', marginTop: '2px' }}>
                          Limitation: {f.limitation}
                        </div>
                        {f.qualifications && f.qualifications.length > 0 && (
                          <div style={{ color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
                            Qualifications: {f.qualifications.join('; ')}
                          </div>
                        )}
                        {f.method_and_evidence_examined && (
                          <div style={{ color: 'var(--muted, #64748b)', marginTop: '2px', fontStyle: 'italic' }}>
                            Method: {f.method_and_evidence_examined}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--muted, #64748b)' }}>
              Provenance & Event History
            </h4>

            {relevantEvents.length === 0 && (!evidence.history || evidence.history.length === 0) ? (
              <div style={{ color: 'var(--muted, #64748b)', fontSize: '13px', fontStyle: 'italic', padding: '16px 0' }}>
                No domain events recorded yet for this claim.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Seed / baseline history */}
                {(evidence.history || []).map((h: any, idx: number) => (
                  <div
                    key={`hist-${idx}`}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--surface-muted, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Prior level: {h.level}</span>
                      <span style={{ color: 'var(--muted, #64748b)', fontSize: '11px' }}>{h.on}</span>
                    </div>
                    <div style={{ color: 'var(--muted, #64748b)', marginTop: '2px' }}>
                      By: {h.by ?? h.supplied_by} {h.note ? `— ${h.note}` : ''}
                    </div>
                  </div>
                ))}

                {/* Engine event log entries */}
                {relevantEvents.map((evt) => {
                  const target = evt.target as Record<string, unknown> | null;
                  return (
                    <div
                      key={evt.id}
                      data-testid={`history-entry-${evt.action}`}
                      style={{
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderLeft: '3px solid var(--action, #2563eb)',
                        borderTop: '1px solid #e2e8f0',
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        borderRadius: '0 6px 6px 0',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>
                          {evt.action === 'assign_verification' && '📋 Verification Requested'}
                          {evt.action === 'record_verification_finding' && '🔍 Verification Finding Recorded'}
                          {evt.action === 'record_finding_and_promote' && '⭐ Finding Recorded & Level Promoted'}
                          {evt.action === 'resolve_finding_conflict' && '⚖️ Finding Conflict Resolved'}
                          {evt.action === 'attach_corroborating_evidence' && '📎 Corroborating Evidence Attached'}
                          {evt.action === 'record_agent_observation' && '👁️ Agent Observation Recorded'}
                          {evt.action === 'promote_evidence_level' && '⭐ Evidence Level Promoted'}
                          {![
                            'assign_verification',
                            'record_verification_finding',
                            'record_finding_and_promote',
                            'resolve_finding_conflict',
                            'attach_corroborating_evidence',
                            'record_agent_observation',
                            'promote_evidence_level',
                          ].includes(evt.action) && String(evt.action)}
                        </span>
                        <span style={{ color: 'var(--muted, #64748b)', fontSize: '11px' }}>
                          {evt.at?.slice(0, 10)}
                        </span>
                      </div>

                      <div style={{ color: 'var(--muted, #64748b)', marginTop: '2px' }}>
                        Actor: <strong>{evt.actor.user_id}</strong> ({evt.actor.role}) · v{(evidence as any).version_id ?? 1}
                      </div>

                      {evt.action === 'assign_verification' && (
                        <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#b45309' }}>
                          — Request recorded, not a verification result
                        </div>
                      )}

                      {evt.action === 'record_verification_finding' && (
                        <div style={{ marginTop: '4px', color: '#166534' }}>
                          Result: <strong>{(evt.after as any)?.result ?? 'recorded'}</strong>
                          {(evt.after as any)?.qualifications && (
                            <div>Qualifications: {(evt.after as any).qualifications.join('; ')}</div>
                          )}
                        </div>
                      )}

                      {evt.action === 'resolve_finding_conflict' && (
                        <div style={{ marginTop: '4px', color: '#047857', fontWeight: 600 }}>
                          Disposition: {(evt.after as any)?.disposition} · Rationale: {(evt.after as any)?.rationale}
                        </div>
                      )}

                      {evt.action === 'promote_evidence_level' && (
                        <div style={{ marginTop: '4px', color: '#1d4ed8', fontWeight: 600 }}>
                          Promoted to Verified citing finding [{String(target?.finding_id ?? '')}]
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contextual role action buttons */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onRequestVerification && (
                <button
                  type="button"
                  className="journey-btn-primary"
                  onClick={onRequestVerification}
                  data-testid="drawer-request-verification-btn"
                >
                  Request verification
                </button>
              )}
              {onRecordFinding && (
                <button
                  type="button"
                  className="journey-btn-primary"
                  onClick={onRecordFinding}
                  data-testid="drawer-record-finding-btn"
                >
                  Record finding
                </button>
              )}
              {onPromote && (
                <button
                  type="button"
                  className="journey-btn-primary"
                  onClick={onPromote}
                  disabled={isConflicted}
                  data-testid="drawer-promote-btn"
                  title={isConflicted ? 'Promotion blocked: unresolved divergent findings' : undefined}
                >
                  Confirm promotion
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3-Layer Integrity Tab (P1-6 & P1-7) */}
        {activeTab === 'integrity' && (
          <div data-testid="panel-integrity">
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', marginBottom: '4px' }}>
                Overall Integrity Status:
              </div>
              <div
                data-testid="integrity-status-display"
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color:
                    integrityStatus === 'Passed'
                      ? '#166534'
                      : integrityStatus === 'Failed'
                      ? '#991b1b'
                      : integrityStatus === 'Not comparable'
                      ? '#b45309'
                      : 'var(--text, #1e293b)',
                }}
              >
                Status: {integrityStatus}
              </div>
            </div>

            <button
              type="button"
              className="journey-btn-primary"
              onClick={handleRunIntegrityCheck}
              data-testid="run-integrity-check-btn"
              style={{ width: '100%', marginBottom: '16px' }}
            >
              Run local 3-layer check
            </button>

            {integrityMessage && (
              <div
                data-testid="integrity-check-message"
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-muted, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {integrityMessage}
              </div>
            )}

            {/* Layer 1: Artefact-Byte Hash */}
            <div
              data-testid="artefact-hash-card"
              style={{
                padding: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Layer 1: Raw Document / Artefact Hash
              </div>
              <div style={{ color: 'var(--muted, #64748b)', marginBottom: '6px' }}>
                Cryptographic digest of raw physical binary / photo evidence.
              </div>
              {evidence.artefact_hash ? (
                <div>
                  <span style={{ color: '#166534', fontWeight: 600 }}>Recorded SHA-256:</span>
                  <div
                    data-testid="artefact-hash-display"
                    style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', marginTop: '2px' }}
                  >
                    {evidence.artefact_hash}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                  No physical binary hash attached to this claim item.
                </div>
              )}
            </div>

            {/* Layer 2: Claim-Version Fingerprint */}
            <div
              data-testid="claim-fingerprint-card"
              style={{
                padding: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Layer 2: Governed Claim Version Fingerprint
              </div>
              <div style={{ color: 'var(--muted, #64748b)', marginBottom: '6px' }}>
                Deterministic RFC 8785 canonical hash of versioned claim attributes.
              </div>
              {evidence.fingerprint ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Stored Reference:</span>
                    <span
                      data-testid="fingerprint-status"
                      style={{
                        fontWeight: 700,
                        color: integrityStatus === 'Passed' ? '#166534' : integrityStatus === 'Failed' ? '#991b1b' : '#64748b',
                      }}
                    >
                      {integrityStatus === 'Passed' ? 'Matched' : integrityStatus === 'Failed' ? 'Mismatched' : 'Stored'}
                    </span>
                  </div>
                  <div
                    data-testid="fingerprint-display"
                    style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', marginTop: '2px' }}
                  >
                    {evidence.fingerprint}
                  </div>
                  {recomputedFingerprint && (
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ fontWeight: 600 }}>Computed from Current State:</span>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', marginTop: '2px' }}>
                        {recomputedFingerprint}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#b45309', fontStyle: 'italic' }}>
                  No reference fingerprint stored for this record. Status: <strong>Not comparable</strong>.
                </div>
              )}
            </div>

            {/* Layer 3: Enclosing Envelope Persistence Checksum */}
            <div
              data-testid="envelope-checksum-card"
              style={{
                padding: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '12px',
              }}
            >
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Layer 3: Canonical State Envelope Checksum
              </div>
              <div style={{ color: 'var(--muted, #64748b)', marginBottom: '6px' }}>
                Local checksum-based tamper detection across snapshots and events.
              </div>
              <div>
                Status:{' '}
                <strong
                  style={{
                    color: envelopeCheckPassed === true ? '#166534' : envelopeCheckPassed === false ? '#991b1b' : '#64748b',
                  }}
                >
                  {envelopeCheckPassed === true
                    ? 'Envelope structure valid'
                    : envelopeCheckPassed === false
                    ? 'Envelope corrupt'
                    : 'Unchecked (click run)'}
                </strong>
              </div>
            </div>

            {/* Honest Disclosure Disclaimer (P1-7) */}
            <div
              data-testid="integrity-disclaimer"
              style={{
                padding: '12px 14px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              A matching check means only that the checked bytes match the expected local digest.
              It does not prove who created the artefact, whether the source was truthful, or that
              the record was not altered outside this browser session. This is a local integrity
              demonstration, not a tamper-proof or legally admissible chain of custody.
            </div>

            <div
              data-testid="provenance-trust-boundary"
              style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '8px' }}
            >
              Note: This integrity check uses a local SHA-256 checksum within browser storage. It detects
              accidental corruption. It is not an independently authenticated audit trail or timestamped
              certificate of record integrity.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
