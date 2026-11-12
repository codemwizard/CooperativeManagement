import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { meta } from '../../../engine/data';
import { monitoringState, covenantState } from '../../../engine/covenants';
import { JourneyShell, StepIndicator } from '../../shell';

interface PortfolioJourneyProps {
  cases: CaseState[];
  onExit: () => void;
  onSelectCase?: (caseId: string) => void;
  nested?: boolean;
}

export const PortfolioJourney: React.FC<PortfolioJourneyProps> = ({
  cases,
  onExit,
  nested = false,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Financed cases
  const financedCases = cases.filter(c => c.financing !== null);
  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  
  const innerContent = (
    <>
      <StepIndicator
        step={currentStep}
        totalSteps={2}
        categoryLabel="PORTFOLIO PERFORMANCE & COVENANTS"
      />

      {currentStep === 1 && (
        <div className="journey-card" data-testid="portfolio-overview-step">
          <h2 className="journey-title">Active Facility Portfolio</h2>
          <p className="journey-subtitle">
            Continuous covenant compliance, environmental monitoring, and post-disbursement surveillance.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Total Facilities</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{financedCases.length}</div>
            </div>
            <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Compliant (Current)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--verified)' }}>
                {financedCases.filter(c => monitoringState(c, meta.demo_date, meta.monitoring_due_window_days) === 'current').length}
              </div>
            </div>
            <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Action Required (Due/Overdue)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--asserted)' }}>
                {financedCases.filter(c => {
                  const s = monitoringState(c, meta.demo_date, meta.monitoring_due_window_days);
                  return s === 'due' || s === 'overdue';
                }).length}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {cases.map(c => {
              const state = monitoringState(c, meta.demo_date, meta.monitoring_due_window_days);
              const isSelected = c.id === selectedCaseId;
              const hasFinancing = c.financing !== null;

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
                  data-testid={`portfolio-case-row-${c.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.name}</strong> ({c.district}, {c.province})
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {hasFinancing ? `Facility ZMW ${c.financing?.facility.amount?.toLocaleString()} · Status: ${state}` : 'Pipeline dossier (Pre-disbursement)'}
                      </div>
                    </div>
                    {hasFinancing && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: state === 'current' ? 'var(--verified)' : '#b76515',
                          color: '#fff',
                        }}
                        data-testid={`monitoring-badge-${c.id}`}
                      >
                        {state?.toUpperCase()}
                      </span>
                    )}
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
              data-testid="portfolio-inspect-btn"
            >
              Inspect Covenants & Audit Trail →
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="journey-card" data-testid="portfolio-detail-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>{selectedCase.name} — Facility Covenants</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Surveillance Window: {meta.monitoring_due_window_days} days · Demo Date: {meta.demo_date}
              </p>
            </div>
            <button
              type="button"
              className="journey-btn-secondary"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setCurrentStep(1)}
              data-testid="portfolio-back-btn"
            >
              ← Back to Portfolio
            </button>
          </div>

          {selectedCase.financing ? (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Active Covenants</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedCase.financing.covenants.map(cov => {
                  const cState = covenantState(cov, meta.demo_date, meta.monitoring_due_window_days);
                  return (
                    <div
                      key={cov.id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      data-testid={`covenant-row-${cov.id}`}
                    >
                      <div>
                        <strong>{cov.id.replace('_', ' ').toUpperCase()}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          Due: {cov.due_date} · Received: {cov.received ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: cState === 'current' ? 'var(--action-soft)' : 'rgba(183, 101, 21, 0.12)',
                          color: cState === 'current' ? 'var(--action)' : 'var(--asserted)',
                        }}
                      >
                        {cState.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', color: 'var(--muted)', marginBottom: '20px' }}>
              No active financing recorded for this enterprise.
            </div>
          )}

          {/* Historical Audit Event Stream (§1H & Test 10) */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
              Governed Event Stream ({selectedCase.events?.length || 0} events)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }} data-testid="portfolio-events-list">
              {(selectedCase.events || []).length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No historical events recorded yet.</div>
              ) : (
                selectedCase.events.map((ev, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                    <strong>{ev.action}</strong> by <code>{ev.actor.user_id}</code> at {ev.at.slice(0, 19).replace('T', ' ')}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Return to Portfolio Overview
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (nested) {
    return innerContent;
  }

  return (
    <JourneyShell
      role="fund_manager"
      roleLabel="Portfolio Manager"
      onExit={onExit}
    >
      {innerContent}
    </JourneyShell>
  );
};
