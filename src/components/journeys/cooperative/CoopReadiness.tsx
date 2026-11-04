import React, { useState } from 'react';
import type { CaseState, Role } from '../../../engine/types';
import { evaluate } from '../../../engine/evaluate';
import { destinations, meta } from '../../../engine/data';
import { requirementChip } from '../../shell';

interface CoopReadinessProps {
  caseState: CaseState;
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
}

export const CoopReadiness: React.FC<CoopReadinessProps> = ({
  caseState,
  onNext,
  onBack,
  onSaveExit,
}) => {
  const [selectedDestId, setSelectedDestId] = useState<string>('A');
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  const destination = destinations.find(d => d.id === selectedDestId) || destinations[0];
  const evaluation = evaluate(caseState, destination, meta.demo_date);
  const isReady = evaluation.summary.ready;
  const shown = evaluation.requirements.filter(r => r.state !== 'not_applicable');
  const notApplicableCount = evaluation.requirements.length - shown.length;
  const openCount = evaluation.summary.unresolved.length + evaluation.summary.exceptions.length;
  const allDestinations = destinations.map(d => ({
    id: d.id,
    name: d.display_name,
    ready: evaluate(caseState, d, meta.demo_date).summary.ready,
  }));

  return (
    <div className="journey-card ev-card" data-testid="coop-step-7-readiness">
      <div className="ev-head">
        <div>
          <div className="ev-eyebrow">Evidence readiness view · Cooperative side</div>
          <h2 className="journey-title" style={{ margin: '4px 0 0 0' }}>Institutional Readiness Assessment</h2>
          <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
            Your dossier against specific institutional requirements. Readiness is always destination-specific.
          </p>
        </div>
        <div>
          <label className="ev-eyebrow" htmlFor="dest-select" style={{ display: 'block', marginBottom: '4px' }}>Financing or programme destination</label>
          <select
            id="dest-select"
            className="journey-select"
            value={selectedDestId}
            onChange={e => setSelectedDestId(e.target.value)}
            data-testid="coop-dest-select"
          >
            {destinations.map(d => (
              <option key={d.id} value={d.id}>
                {d.display_name} ({d.product})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ev-tiles">
        <div className="ev-tile">
          <div className="ev-eyebrow">Selected destination</div>
          <div style={{ marginTop: '8px' }}>
            <span className={`ev-chip ${isReady ? 'ev-v' : 'ev-u'}`}><span className="ev-dot" />{isReady ? 'Assessment-ready' : 'Not yet ready'}</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '10px' }} data-testid={`readiness-verdict-${selectedDestId}`}>
            {isReady ? `Assessment-ready for ${destination.display_name}` : `Not yet ready for ${destination.display_name}`}
          </div>
        </div>
        <div className="ev-tile">
          <div className="ev-eyebrow">Requirements</div>
          <div className="ev-big">{evaluation.summary.satisfied} <span className="ev-big-of">of {evaluation.summary.total} satisfied</span></div>
          <div className="ev-sub" style={{ marginTop: '6px' }}>{openCount} unresolved{notApplicableCount > 0 ? ` · ${notApplicableCount} not applicable here` : ''}</div>
        </div>
        <div className="ev-tile">
          <div className="ev-eyebrow">Across destinations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {allDestinations.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span>{d.name}</span>
                <span className={`ev-chip ${d.ready ? 'ev-v' : 'ev-m'}`}><span className="ev-dot" />{d.ready ? 'Ready' : 'Not ready'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ev-split">
        <div className="ev-main">
          <div className="ev-panel">
            <div className="ev-panel-head">
              <h3 className="ev-h3">Requirements for {destination.display_name}</h3>
            </div>
            <div className="ev-scroll">
              <div className="ev-table ev-table-cr">
                <div className="ev-row ev-hd"><div>Requirement</div><div>Status</div><div>Evidence on file</div><div>Gap</div><div /></div>
                {shown.map(req => {
                  const chip = requirementChip(req.state);
                  const isExpanded = expandedReq === req.id;
                  const evidence = req.evidence_ref ? caseState.evidence?.[req.evidence_ref] : null;
                  return (
                    <div key={req.id}>
                      <div className="ev-row">
                        <div data-label="Requirement">{req.title}</div>
                        <div data-label="Status"><span className={`ev-chip ${chip.cls}`}><span className="ev-dot" />{chip.label}</span></div>
                        <div data-label="Evidence on file" className={req.evidence_ref ? '' : 'ev-sub'}>
                          {req.evidence_ref ? `${req.evidence_ref}${req.effective_level ? ' · ' + req.effective_level : ''}` : 'Nothing on file'}
                        </div>
                        <div data-label="Gap" className={req.state === 'satisfied' ? 'ev-sub' : ''}>
                          {req.state === 'satisfied' ? 'None' : req.state === 'assessment_time' ? 'Checked at assessment' : (req.reason ?? (req.min_level ? `Needs ${req.min_level}${req.effective_level ? '; has ' + req.effective_level : ''}` : 'Not yet satisfied'))}
                        </div>
                        <div>
                          <button
                            type="button"
                            className="ev-btn ev-btn-sm"
                            onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                            aria-expanded={isExpanded}
                            data-testid={`req-toggle-${req.id}`}
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="journey-evidence-drawer" style={{ margin: '0 20px 12px' }} data-testid={`req-drawer-${req.id}`}>
                          <div><strong>Requirement ID:</strong> {req.id}</div>
                          <div><strong>Min Level:</strong> {req.min_level || 'N/A'} | <strong>Effective Level:</strong> {req.effective_level || 'none'}</div>
                          {req.reason && <div style={{ color: 'var(--asserted)' }}>Reason: {req.reason}</div>}
                          {evidence && (
                            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}>
                              Limitation: {evidence.limitation || 'No limitation recorded.'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="ev-rail">
          <div className="ev-panel ev-pad">
            <h3 className="ev-h3" style={{ marginBottom: '10px' }}>Next step</h3>
            <p className="ev-sub" style={{ margin: '0 0 10px 0' }}>
              The next step submits the governed dossier to the target institution.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" className="ev-btn ev-btn-p" onClick={onNext} data-testid="coop-step-7-continue">
                Continue to Present Dossier
              </button>
              <button type="button" className="ev-btn" onClick={onBack} data-testid="coop-step-7-back">
                Back
              </button>
              <button type="button" className="journey-link-secondary" onClick={onSaveExit} data-testid="coop-step-7-save-exit">
                Save and exit
              </button>
            </div>
          </div>

          {caseState.institution_messages && caseState.institution_messages.length > 0 && (
            <div className="ev-panel ev-pad" data-testid="coop-institutional-messages">
              <h3 className="ev-h3" style={{ marginBottom: '6px' }}>
                Institutional inquiries received ({caseState.institution_messages.length})
              </h3>
              <p className="ev-sub" style={{ margin: '0 0 10px 0' }}>
                Commercial banks or funders reviewing your enterprise have sent direct inquiries proposing facilities.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {caseState.institution_messages.map((msg, i) => (
                  <div key={i} style={{ padding: '10px', background: 'var(--surface-raised)', borderRadius: '4px', border: '1px solid var(--line)' }} data-testid={`institution-message-${i}`}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{msg.subject}</div>
                    <div className="ev-sub">From: {msg.sender_institution} ({msg.sent_at?.slice(0, 10)})</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>{msg.body}</div>
                    {msg.proposed_structure && (
                      <div className="ev-sub" style={{ marginTop: '4px' }}>
                        <strong>Proposed Structure:</strong> {msg.proposed_structure}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="ev-sub" style={{ marginTop: '16px' }}>
        This view shows what the evidence supports. It does not score the enterprise or make or recommend a financing decision.
      </div>
    </div>
  );
};
