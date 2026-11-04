import React from 'react';
import type { CaseState, Role } from '../../../engine/types';
import type { MemberRosterItem } from '../types.display';
import { assetsByOwner, memberLivestockByCategory } from '../assetSummary';
import { ActionLabel, EqsCard } from '../../shell';
import { computeEvidenceQualityScore } from '../../../engine/eqs';

interface CoopDashboardProps {
  caseState: CaseState & { members_roster?: MemberRosterItem[] };
  role: Role;
  onStartJourney: (step?: number) => void;
  onExit: () => void;
}

export const CoopDashboard: React.FC<CoopDashboardProps> = ({
  caseState,
  role,
  onStartJourney,
  onExit,
}) => {
  const roster: MemberRosterItem[] = caseState.members_roster || [];
  const isEmpty = roster.length === 0;

  const assetData = assetsByOwner(caseState);
  const livestockCategories = memberLivestockByCategory(caseState);
  const eqs = computeEvidenceQualityScore(caseState);

  const totalDeclared = assetData.compound_declared_assets_zmw || 1;
  const memberVal = assetData.members_assets.total_value_zmw;
  const coopVal = assetData.cooperative_assets.total_value_zmw;
  const memberSharePct = Math.round((memberVal / totalDeclared) * 100);
  const coopSharePct = 100 - memberSharePct;

  const isFieldAgent = role === 'field_agent';

  return (
    <div className="journey-card" data-testid="coop-dashboard" style={{ padding: '24px', maxWidth: '1080px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="journey-title" style={{ margin: 0, fontSize: '24px' }}>
              {((caseState as any).cooperative_name || caseState.name || 'Cooperative Enterprise') as string}
            </h2>
            <ActionLabel type="VIEW ONLY" />
          </div>
          <p className="journey-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
            {(caseState as any).registration_no ? `Registration: ${(caseState as any).registration_no} · ` : ''}
            Role: <strong>{role}</strong> · Status: {isEmpty ? 'Greenfield / Unenrolled' : 'Enrolled Roster'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="journey-btn-primary"
            style={{ width: 'auto', padding: '10px 18px', fontSize: '13px' }}
            onClick={() => onStartJourney(isEmpty ? 3 : 1)}
            data-testid="coop-enter-journey-btn"
          >
            {isEmpty ? 'Add First Member →' : 'Open Transformation Journey →'}
          </button>
        </div>
      </div>

      {/* Product Boundary Banner */}
      <div style={{ padding: '10px 14px', background: 'var(--surface-muted, #f1f5f9)', borderLeft: '4px solid var(--action)', borderRadius: '4px', marginBottom: '24px', fontSize: '12px', color: 'var(--text)' }}>
        <strong>Product Boundary:</strong> Symphony makes evidence traceable and legible to institutional lenders. Symphony never approves, offers, or guarantees financial facilities.
        {isFieldAgent && ' As a Field Agent, you are authorized to enrol members and record asset observations.'}
      </div>

      {isEmpty ? (
        /* Empty Dashboard State */
        <div data-testid="coop-dashboard-empty" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px 0' }}>Cooperative Roster is Empty</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '520px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: 1.5 }}>
            To begin the institutional readiness transformation, enrol your cooperative members and record declared livestock and farm assets.
          </p>
          <button
            type="button"
            className="journey-btn-primary"
            style={{ width: 'auto', padding: '12px 24px', fontSize: '15px' }}
            onClick={() => onStartJourney(3)}
            data-testid="coop-add-first-member-btn"
          >
            + Add First Member
          </button>

          <div style={{ marginTop: '36px', textAlign: 'left', maxWidth: '640px', margin: '36px auto 0 auto', padding: '16px 20px', background: 'var(--surface-muted, #f1f5f9)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px 0' }}>Onboarding Roadmap</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: 1.7, color: 'var(--text)' }}>
              <li><strong>Member Roster:</strong> Enrol farmers with 4-block profile and livestock inventory.</li>
              <li><strong>Cooperative Profile:</strong> Verify statutory registration and legal mandate.</li>
              <li><strong>Governance &amp; Minutes:</strong> Record current executive officers and upload signed meeting minutes.</li>
              <li><strong>Readiness Assessment:</strong> Review Lender A &amp; Lender B institutional requirements.</li>
            </ol>
          </div>
        </div>
      ) : (
        /* Populated Dashboard State */
        <div data-testid="coop-dashboard-populated">
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>Enrolled Members</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '6px 0' }}>{roster.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--action)' }}>Active roster verified by Field Agent</div>
            </div>

            <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>Evidence Quality Score</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '6px 0' }}>{eqs.overall_score}/100</div>
              <div style={{ fontSize: '12px', color: 'var(--action)' }}>Grade {eqs.grade} · Confidence {eqs.confidence.rating}</div>
            </div>

            <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>Total Declared Assets</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: '6px 0' }}>
                ZMW {totalDeclared.toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Split: Members vs. Cooperative</div>
            </div>

            <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>Institutional Pipeline</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '10px 0' }}>
                Lender A &amp; B
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Requires governance signoff</div>
            </div>
          </div>

          {/* Asset Breakdown Panel */}
          <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Asset Composition (Split by Ownership)</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Level 2 Drill-down</span>
            </div>

            {/* Composition Bar */}
            <div style={{ height: '14px', borderRadius: '7px', background: '#e2e8f0', display: 'flex', overflow: 'hidden', marginBottom: '12px' }}>
              <div
                style={{ width: `${memberSharePct}%`, background: '#2563eb', transition: 'width 0.3s' }}
                title={`Members' Personal Livestock: ${memberSharePct}%`}
              />
              <div
                style={{ width: `${coopSharePct}%`, background: '#059669', transition: 'width 0.3s' }}
                title={`Cooperative-Owned Assets: ${coopSharePct}%`}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#2563eb', borderRadius: '2px', marginRight: '6px' }} />
                <strong>Members' Personal Livestock:</strong> ZMW {memberVal.toLocaleString()} ({memberSharePct}%)
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '16px' }}>
                  Personal property of members. Not cooperative collateral.
                </div>
              </div>
              <div>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#059669', borderRadius: '2px', marginRight: '6px' }} />
                <strong>Cooperative-Owned Assets:</strong> ZMW {coopVal.toLocaleString()} ({coopSharePct}%)
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '16px' }}>
                  Cooperative balance sheet property.
                </div>
              </div>
            </div>

            {/* Livestock by Category Table */}
            {livestockCategories.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Members' Livestock Categories (Cross-Member Aggregation)
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px' }}>Livestock Category</th>
                      <th style={{ padding: '8px' }}>Total Head</th>
                      <th style={{ padding: '8px' }}>Reported Encumbrance Status</th>
                      <th style={{ padding: '8px' }}>Official Registry Search</th>
                      <th style={{ padding: '8px' }}>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {livestockCategories.map(cat => (
                      <tr key={cat.category} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{cat.category}</td>
                        <td style={{ padding: '8px' }}>{cat.total_count}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontSize: '12px' }}>
                            {cat.reported_encumbrance}
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: 'var(--muted)', fontSize: '12px' }}>{cat.registry_check}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{cat.recorded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Figures shown from field enumeration (demo artefact). Valuation stated separately by cooperative.
                </div>
              </div>
            )}
          </div>

          {/* Proprietary Evidence Quality Score (EQS) & TA Gaps */}
          <EqsCard caseState={caseState} />

          {/* Bottom Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              className="journey-btn-secondary"
              style={{ width: 'auto', padding: '10px 18px', fontSize: '13px' }}
              onClick={onExit}
            >
              ← Switch Persona / Exit
            </button>
            <button
              type="button"
              className="journey-btn-primary"
              style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}
              onClick={() => onStartJourney(1)}
              data-testid="coop-continue-transformation-btn"
            >
              Continue 8-Step Transformation →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
