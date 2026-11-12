import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { destinationById, meta } from '../../../engine/data';
import { evaluate } from '../../../engine/evaluate';
import { stateDistribution, workflowState } from '../../../engine/pipeline';
import { JourneyShell, StepIndicator, ActionLabel, requirementChip, levelChip, pipelineChip, EqsCard } from '../../shell';
import { assetsByOwner } from '../assetSummary';
import { PortfolioJourney } from '../portfolio/PortfolioJourney';
import nationalSeed from '../../../../data/national_seed.json';

interface NabiiJourneyProps {
  cases: CaseState[];
  onExit: () => void;
  onRunAction: (action: any, targetCaseId?: string) => { ok: boolean; error?: string; event?: any };
}

const STATE_CONFIG = {
  assessment_ready:     { label: 'Assessment Ready',    color: '#059669', bg: 'rgba(5,150,105,0.1)',  border: '#059669' },
  evidence_progressing: { label: 'Evidence Progressing', color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  border: '#2563eb' },
  remediation_required: { label: 'Remediation Required', color: '#b45309', bg: 'rgba(180,83,9,0.1)',   border: '#b45309' },
  initial_record:       { label: 'Initial Record',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: '#6b7280' },
} as const;

export const NabiiJourney: React.FC<NabiiJourneyProps> = ({ cases, onExit, onRunAction }) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'pipeline' | 'portfolio'>('pipeline');
  const [taRequestSent, setTaRequestSent] = useState<Record<string, boolean>>({});
  const [filterState, setFilterState] = useState<string | null>(null);

  const destA = destinationById['A'];

  // Compute 4-state distribution from live cases
  const distribution = stateDistribution(cases, destA, meta.demo_date, evaluate);

  // National totals = seed (synthetic national) + 10 modelled cooperatives (live cases)
  const nationalTotal = nationalSeed.headline.total_enterprises;
  const modelled = cases.length; // 10 live cooperatives
  const syntheticExtra = nationalTotal - modelled; // rest are synthetic national

  // Aggregate distribution: live computed + seed ratios for synthetic
  const seedDist = nationalSeed.states_distribution;
  const totalSeedCount = Object.values(seedDist).reduce((a, b) => a + b, 0);
  const combined = {
    assessment_ready:     distribution.assessment_ready.count + Math.round((seedDist.assessment_ready / totalSeedCount) * syntheticExtra),
    evidence_progressing: distribution.evidence_progressing.count + Math.round((seedDist.evidence_progressing / totalSeedCount) * syntheticExtra),
    remediation_required: distribution.remediation_required.count + Math.round((seedDist.remediation_required / totalSeedCount) * syntheticExtra),
    initial_record:       distribution.initial_record.count + Math.round((seedDist.initial_record / totalSeedCount) * syntheticExtra),
  };

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const caseEval = evaluate(selectedCase, destA, meta.demo_date);
  const caseState4 = workflowState(selectedCase, destA, meta.demo_date, caseEval);
  const assetBreakdown = assetsByOwner(selectedCase);

  // Filtered cases for drilldown
  const filteredCases = filterState
    ? distribution[filterState as keyof typeof distribution].cases
    : cases;

  const handleTaRequest = (evidenceType: string) => {
    const res = onRunAction({
      type: 'request_ta_intervention',
      evidence_type: evidenceType,
      reason: 'Requires field verification and supported evidence level to progress.',
    }, selectedCase.id);
    if (res.ok) {
      setTaRequestSent(prev => ({ ...prev, [evidenceType]: true }));
    }
  };

  // Interventions for the selected case

  return (
    <JourneyShell role="fund_manager" roleLabel="NABII Fund Manager" onExit={onExit} wide={viewMode === 'pipeline' && currentStep === 2}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className={viewMode === 'pipeline' ? 'journey-btn-primary' : 'journey-btn-secondary'}
          style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}
          onClick={() => setViewMode('pipeline')}
          data-testid="tab-pipeline"
        >
          Pipeline & Cohort Oversight
        </button>
        <button
          type="button"
          className={viewMode === 'portfolio' ? 'journey-btn-primary' : 'journey-btn-secondary'}
          style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}
          onClick={() => setViewMode('portfolio')}
          data-testid="tab-portfolio"
        >
          Portfolio Surveillance & Covenants
        </button>
      </div>

      {viewMode === 'portfolio' ? (
        <PortfolioJourney cases={cases} onExit={onExit} nested={true} />
      ) : (
        <>
          <StepIndicator
            step={currentStep}
            totalSteps={3}
            categoryLabel="PROGRAMME PIPELINE OVERSIGHT"
          />

          {/* ─── STEP 1: NATIONAL PIPELINE DASHBOARD ─── */}
          {currentStep === 1 && (
            <div className="journey-card" data-testid="nabii-cohort-overview">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 className="journey-title" style={{ margin: 0 }}>National Pipeline Dashboard</h2>
                  <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                    NABII national agricultural financing pipeline · <em>Synthetic national seed + {modelled} modelled cooperatives</em>
                  </p>
                </div>
                <ActionLabel type="VIEW ONLY" />
              </div>

              {/* National Headline Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Enterprises', value: nationalTotal, sub: 'National pipeline' },
                  { label: 'Pipeline Demand', value: `ZMW ${(nationalSeed.headline.pipeline_demand_zmw / 1_000_000).toFixed(1)}M`, sub: 'Aggregate financing request' },
                  { label: 'Smallholders Reached', value: nationalSeed.headline.smallholders_reached.toLocaleString(), sub: 'Across enrolled enterprises' },
                  { label: 'Women Participation', value: `${nationalSeed.headline.women_participation_pct}%`, sub: 'Of household heads enrolled' },
                ].map((m, i) => (
                  <div key={i} style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>{m.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>{m.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* 4-State Pipeline Distribution */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>4-State Pipeline Classification (National)</h4>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {modelled} modelled · {syntheticExtra} synthetic national · Total: {nationalTotal}
                  </div>
                </div>

                {/* Stacked bar */}
                <div style={{ display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                  {Object.entries(combined).map(([state, count]) => (
                    <div
                      key={state}
                      style={{
                        width: `${(count / nationalTotal) * 100}%`,
                        background: STATE_CONFIG[state as keyof typeof STATE_CONFIG].color,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                        opacity: filterState === state || !filterState ? 1 : 0.4,
                      }}
                      title={`${STATE_CONFIG[state as keyof typeof STATE_CONFIG].label}: ${count}`}
                      onClick={() => setFilterState(filterState === state ? null : state)}
                    />
                  ))}
                </div>

                {/* 4-State Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {(Object.entries(combined) as [keyof typeof STATE_CONFIG, number][]).map(([state, count]) => {
                    const cfg = STATE_CONFIG[state];
                    const liveCount = distribution[state].count;
                    return (
                      <div
                        key={state}
                        onClick={() => setFilterState(filterState === state ? null : state)}
                        style={{
                          padding: '12px',
                          background: filterState === state ? cfg.bg : 'var(--surface-raised)',
                          borderRadius: 'var(--radius-sm)',
                          border: `2px solid ${filterState === state ? cfg.border : 'var(--line)'}`,
                          cursor: 'pointer',
                        }}
                        data-testid={`state-card-${state}`}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: cfg.color, marginBottom: '4px' }}>
                          {cfg.label}
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: cfg.color }} data-testid={state === 'assessment_ready' ? 'nabii-ready-count' : undefined}>{count}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {liveCount} modelled | {count - liveCount} national seed
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filterState && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--action)', fontWeight: 600 }}>
                    Filtered to: {STATE_CONFIG[filterState as keyof typeof STATE_CONFIG].label} ({distribution[filterState as keyof typeof distribution].cases.length} modelled)
                    <button
                      type="button"
                      onClick={() => setFilterState(null)}
                      style={{ marginLeft: '10px', fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>

              {/* Cooperative Drilldown Table */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>
                    {filterState ? `${STATE_CONFIG[filterState as keyof typeof STATE_CONFIG].label} — Cooperatives` : `10 Modelled Cooperatives`}
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{filteredCases.length} showing</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredCases.map(c => {
                    const ev = evaluate(c, destA, meta.demo_date);
                    const ws = workflowState(c, destA, meta.demo_date, ev);
                    const cfg = STATE_CONFIG[ws];
                    const assets = assetsByOwner(c);
                    return (
                      <div
                        key={c.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '3fr 1.5fr 1.5fr 1fr auto',
                          gap: '8px',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: 'var(--surface-raised)',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${selectedCaseId === c.id ? cfg.border : 'var(--line)'}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedCaseId(c.id)}
                        data-testid={`nabii-case-row-${c.id}`}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.district}, {c.province}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Pipeline demand</div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>ZMW {c.project?.request?.amount?.toLocaleString() || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Declared assets</div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>ZMW {assets.compound_declared_assets_zmw.toLocaleString()}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                            {cfg.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="journey-btn-secondary"
                          style={{ width: 'auto', padding: '4px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedCaseId(c.id); setCurrentStep(2); }}
                          data-testid={`nabii-inspect-${c.id}`}
                        >
                          Inspect →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="journey-actions">
                <button
                  type="button"
                  className="journey-btn-primary"
                  onClick={() => setCurrentStep(2)}
                  data-testid="nabii-inspect-case-btn"
                >
                  Inspect Selected Enterprise Dossier →
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: ENTERPRISE RECORD / GAP IDENTIFICATION ─── */}
          {currentStep === 2 && (() => {
            const readyN = evaluate(selectedCase, destinationById['N'], meta.demo_date).summary.ready;
            const shown = caseEval.requirements.filter(r => r.state !== 'not_applicable');
            const ps = pipelineChip(caseState4);
            const declared = assetBreakdown.compound_declared_assets_zmw || 1;
            return (
            <div className="journey-card ev-card" data-testid={`case-detail-${selectedCase.id}`}>
              <div className="ev-head">
                <div>
                  <div className="ev-eyebrow">Evidence readiness view · Programme side</div>
                  <h2 className="journey-title" style={{ margin: '4px 0 0 0' }}>{selectedCase.name}</h2>
                  <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                    {selectedCase.district}, {selectedCase.province} · Programme: {selectedCase.programme}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <ActionLabel type="VIEW ONLY" />
                  <button type="button" className="ev-btn ev-btn-sm" onClick={() => setCurrentStep(1)} data-testid="nabii-back-to-cohort">
                    ← Back to Pipeline
                  </button>
                </div>
              </div>

              <div className="ev-tiles">
                <div className="ev-tile">
                  <div className="ev-eyebrow">Pipeline state</div>
                  <div style={{ marginTop: '8px' }}>
                    <span className={`ev-chip ${ps.cls}`}><span className="ev-dot" />{ps.label}</span>
                  </div>
                  <div className="ev-sub" style={{ marginTop: '8px' }}>
                    {caseEval.summary.satisfied} of {caseEval.summary.total} requirements satisfied (Destination A) · {caseEval.summary.unresolved.length} gaps
                  </div>
                </div>
                <div className="ev-tile">
                  <div className="ev-eyebrow">Ready for Destination N</div>
                  <div style={{ marginTop: '8px' }}>
                    <span className={`ev-chip ${readyN ? 'ev-v' : 'ev-m'}`}><span className="ev-dot" />{readyN ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="ev-sub" style={{ marginTop: '8px' }}>Readiness is destination-specific.</div>
                </div>
                <div className="ev-tile" data-testid="member-asset-summary">
                  <div className="ev-eyebrow">Declared assets (combined)</div>
                  <div className="ev-big">ZMW {assetBreakdown.compound_declared_assets_zmw.toLocaleString()}</div>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '8px 0 6px', background: 'var(--line)' }}>
                    <div style={{ width: `${(assetBreakdown.members_assets.total_value_zmw / declared) * 100}%`, background: 'var(--ev-v-fg)' }} />
                    <div style={{ width: `${(assetBreakdown.cooperative_assets.total_value_zmw / declared) * 100}%`, background: 'var(--ev-m-line)' }} />
                  </div>
                  <div className="ev-sub">
                    Members' assets: ZMW {assetBreakdown.members_assets.total_value_zmw.toLocaleString()} · Cooperative-owned: ZMW {assetBreakdown.cooperative_assets.total_value_zmw.toLocaleString()}
                  </div>
                </div>
              </div>

              <EqsCard caseState={selectedCase} />

              <div className="ev-split">
                <div className="ev-main">
                  <div className="ev-panel">
                    <div className="ev-panel-head">
                      <h3 className="ev-h3">Requirements (Destination A) and intervention queue</h3>
                    </div>
                    <div className="ev-scroll">
                      <div className="ev-table ev-table-req">
                        <div className="ev-row ev-hd"><div>Requirement</div><div>Status</div><div>Evidence on file</div><div>Gap and action</div></div>
                        {shown.map(r => {
                          const chip = requirementChip(r.state);
                          const needsAction = r.state === 'unresolved' || r.state === 'exception';
                          const evidenceType = r.evidence_ref || 'unknown';
                          const isSent = taRequestSent[evidenceType];
                          return (
                            <div className="ev-row" key={r.id}>
                              <div data-label="Requirement"><span className="ev-sub">{r.id}</span> {r.title}</div>
                              <div data-label="Status"><span className={`ev-chip ${chip.cls}`}><span className="ev-dot" />{chip.label}</span></div>
                              <div data-label="Evidence on file" className={r.evidence_ref ? '' : 'ev-sub'}>
                                {r.evidence_ref ? `${r.evidence_ref}${r.effective_level ? ' · ' + r.effective_level : ''}` : 'Nothing on file'}
                              </div>
                              <div data-label="Gap and action">
                                <div className={r.state === 'satisfied' ? 'ev-sub' : ''}>
                                  {r.state === 'satisfied' ? 'None' : r.state === 'assessment_time' ? 'Checked at assessment' : (r.reason ?? (r.min_level ? `Needs ${r.min_level}${r.effective_level ? '; has ' + r.effective_level : ''}` : 'Not yet satisfied'))}
                                </div>
                                {needsAction && (
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-sm"
                                    style={{ marginTop: '6px' }}
                                    onClick={() => handleTaRequest(evidenceType)}
                                    disabled={isSent}
                                    data-testid={`nabii-ta-request-${r.id}`}
                                  >
                                    {isSent ? 'TA requested' : 'Request TA intervention'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ev-panel">
                    <div className="ev-panel-head">
                      <h3 className="ev-h3">Governed evidence record</h3>
                    </div>
                    <div className="ev-scroll">
                      <div className="ev-table ev-table-evi">
                        <div className="ev-row ev-hd"><div>Evidence</div><div>Level</div><div>Limitation</div></div>
                        {Object.entries(selectedCase.evidence || {}).map(([key, ev]) => {
                          const lc = levelChip(String(ev.level));
                          return (
                            <div className="ev-row" key={key}>
                              <div data-label="Evidence" style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</div>
                              <div data-label="Level"><span className={`ev-chip ${lc.cls}`}><span className="ev-dot" />{lc.label}</span></div>
                              <div data-label="Limitation" className="ev-sub">{ev.limitation || 'No limitation recorded'}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="ev-rail">
                  <div className="ev-panel ev-pad">
                    <h3 className="ev-h3" style={{ marginBottom: '10px' }}>Next action</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button type="button" className="ev-btn ev-btn-p" onClick={() => setCurrentStep(3)}>
                        View Province Distribution →
                      </button>
                      <button type="button" className="ev-btn" onClick={() => setCurrentStep(1)}>
                        ← Return to Pipeline
                      </button>
                    </div>
                  </div>


                </aside>
              </div>

              <div className="ev-sub" style={{ marginTop: '16px' }}>
                This view shows what the evidence supports. It does not score the applicant or make or recommend a financing decision.
              </div>
            </div>
            );
          })()}

          {/* ─── STEP 3: PROVINCIAL DISTRIBUTION ─── */}
          {currentStep === 3 && (
            <div className="journey-card" data-testid="nabii-province-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 className="journey-title" style={{ margin: 0 }}>Provincial Pipeline Distribution</h2>
                  <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                    National financing demand by province (synthetic seed + modelled cases)
                  </p>
                </div>
                <ActionLabel type="VIEW ONLY" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {nationalSeed.provinces.map((prov, i) => {
                  const share = prov.pipeline_zmw / nationalSeed.headline.pipeline_demand_zmw;
                  return (
                    <div key={i} style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{prov.province} Province</span>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>{prov.enterprises} enterprises · {prov.modelled_cases} modelled</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>ZMW {(prov.pipeline_zmw / 1_000_000).toFixed(1)}M</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'var(--line)', overflow: 'hidden' }}>
                        <div style={{ width: `${share * 100}%`, height: '100%', background: 'var(--action)' }} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                        {Math.round(share * 100)}% of national pipeline
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="journey-actions" style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="journey-btn-secondary"
                  onClick={() => setCurrentStep(2)}
                >
                  ← Back to Enterprise Record
                </button>
                <button
                  type="button"
                  className="journey-btn-secondary"
                  onClick={() => setCurrentStep(1)}
                >
                  ← Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </JourneyShell>
  );
};
