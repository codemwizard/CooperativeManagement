import React, { useState } from 'react';
import type { CaseState } from '../../engine/types';
import { computeEvidenceQualityScore, type EvidenceQualityScoreResult } from '../../engine/eqs';

export interface EqsCardProps {
  caseState: CaseState;
  showModalButton?: boolean;
}

export const EqsCard: React.FC<EqsCardProps> = ({ caseState, showModalButton = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const eqs: EvidenceQualityScoreResult = computeEvidenceQualityScore(caseState);

  const gradeColor =
    eqs.grade === 'A'
      ? '#15803d'
      : eqs.grade === 'B'
      ? '#2563eb'
      : eqs.grade === 'C'
      ? '#b45309'
      : eqs.grade === 'D'
      ? '#b91c1c'
      : '#64748b';

  const gradeBg =
    eqs.grade === 'A'
      ? '#dcfce7'
      : eqs.grade === 'B'
      ? '#dbeafe'
      : eqs.grade === 'C'
      ? '#fef3c7'
      : eqs.grade === 'D'
      ? '#fee2e2'
      : '#f1f5f9';

  const confidenceColor =
    eqs.confidence_rating === 'High'
      ? '#15803d'
      : eqs.confidence_rating === 'Medium'
      ? '#2563eb'
      : '#b45309';

  return (
    <div
      data-testid="eqs-card"
      style={{
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #64748b)', fontWeight: 700 }}>
            Proprietary Evaluation
          </div>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 700, color: 'var(--text, #1e293b)' }}>
            Evidence Quality Score (EQS)
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            data-testid="eqs-grade-badge"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: gradeBg,
              color: gradeColor,
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            {eqs.grade === 'N/A' ? 'N/A' : `Grade ${eqs.grade}`}
          </span>
          <span
            data-testid="eqs-provisional-label"
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              padding: '2px 6px',
              borderRadius: '4px',
              background: '#fef9c3',
              color: '#854d0e',
              textTransform: 'uppercase',
            }}
          >
            Prototype / Provisional
          </span>
          <span
            data-testid="eqs-confidence-badge"
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              background: '#f1f5f9',
              color: confidenceColor,
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            {eqs.confidence_rating} Confidence
          </span>
          <div
            data-testid="eqs-composite-score"
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: gradeColor,
              marginLeft: '4px',
            }}
          >
            {eqs.composite_score !== null ? (
              <>
                {eqs.composite_score}<span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>/100</span>
              </>
            ) : (
              <span style={{ fontSize: '15px', color: '#b45309' }}>Unevaluable</span>
            )}
          </div>
        </div>
      </div>

      {/* 3-Pillar Scorecard (B3) */}
      <div
        data-testid="eqs-pillars-scorecard"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {(['environmental', 'social', 'governance'] as const).map((pillar) => {
          const p = eqs.pillars[pillar];
          const displayName = pillar.charAt(0).toUpperCase() + pillar.slice(1);
          return (
            <div
              key={pillar}
              data-testid={`eqs-pillar-${pillar}`}
              style={{
                background: 'var(--surface-muted, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text, #1e293b)' }}>{displayName}</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                  {p.applicable_count}/{p.total_count} criteria
                </span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: p.evaluable ? '#0f172a' : '#b45309', marginBottom: '4px' }}>
                {p.evaluable ? (
                  <>
                    {p.score}<span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>/100</span>
                  </>
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>
                    Unevaluable — no applicable criteria for this case
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                {p.summary}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4-Metric Grid with concealed weights (B2) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        {eqs.metrics.map((m) => {
          const levelBg =
            m.evidence_level === 'verified'
              ? '#dcfce7'
              : m.evidence_level === 'supported'
              ? '#dbeafe'
              : m.evidence_level === 'asserted'
              ? '#fef3c7'
              : '#f1f5f9';
          const levelColor =
            m.evidence_level === 'verified'
              ? '#15803d'
              : m.evidence_level === 'supported'
              ? '#1d4ed8'
              : m.evidence_level === 'asserted'
              ? '#b45309'
              : '#64748b';

          return (
            <div
              key={m.code}
              data-testid={`eqs-metric-${m.code}`}
              style={{
                background: 'var(--surface-muted, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: '#0f172a' }}>{m.code} · {m.dimension}</strong>
                <span
                  style={{
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: levelBg,
                    color: levelColor,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {m.evidence_level}
                </span>
              </div>
              <div style={{ color: 'var(--muted, #64748b)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.name}>
                {m.name}
              </div>
              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#475569', textTransform: 'capitalize' }}>
                  Status: {m.evidence_level}
                </span>
                <strong style={{ color: levelColor }}>
                  {Math.round(m.raw_score * 100)}%
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exception Alerts if present */}
      {eqs.exception_alerts.length > 0 && (
        <div
          data-testid="eqs-exception-alerts"
          style={{
            padding: '8px 12px',
            background: '#fffbeb',
            borderLeft: '3px solid #f59e0b',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#92400e',
            marginBottom: '12px',
          }}
        >
          <strong>Exceptions & Discrepancies ({eqs.exception_alerts.length}):</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {eqs.exception_alerts.slice(0, 2).map((alert, idx) => (
              <li key={idx}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Proprietary Methodology Disclaimer (B2) */}
      <div
        data-testid="eqs-methodology-disclaimer"
        style={{ fontSize: '11px', color: 'var(--muted, #64748b)', fontStyle: 'italic', marginBottom: '10px' }}
      >
        Proprietary illustrative methodology. Scoring weights and calibration parameters are governed internally and are not disclosed. <strong>[PROVISIONAL]</strong> Scoring constants and calibration parameters are prototype design choices, not empirically validated. This score must not be used as a validated measure of ESG performance, lender creditworthiness, or real-world risk. Provisional methodology — not for production decisions.
      </div>

      {/* Footer & Expand button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
        <span style={{ color: 'var(--muted, #64748b)' }}>
          Grounded in governed records · Not an automated credit score
        </span>
        {showModalButton && (
          <button
            type="button"
            className="journey-btn-secondary"
            onClick={() => setIsModalOpen(true)}
            data-testid="view-eqs-details-btn"
            style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
          >
            View EQS Methodology & Guardrails →
          </button>
        )}
      </div>

      {/* Detailed Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="EQS Methodology and Guardrails"
          data-testid="eqs-details-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Proprietary Evidence Quality Score (EQS)
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="journey-btn-secondary"
                data-testid="close-eqs-modal-btn"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Methodology Statement</div>
              <div style={{ color: '#475569', lineHeight: 1.5 }}>
                {eqs.methodology_disclaimer}
              </div>
              <div
                data-testid="eqs-methodology-disclaimer"
                style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}
              >
                Proprietary illustrative methodology. Scoring weights and calibration parameters are governed internally and are not disclosed. <strong>[PROVISIONAL]</strong> Scoring constants and calibration parameters are prototype design choices, not empirically validated. This score must not be used as a validated measure of ESG performance, lender creditworthiness, or real-world risk. Provisional methodology — not for production decisions.
              </div>
            </div>

            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', margin: '16px 0 8px 0' }}>
              Evidence Quality Score — E/S/G Indicator Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {eqs.metrics.map((m) => (
                <div key={m.code} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>[{m.code}] {m.name}</span>
                    <span>Raw: {Math.round(m.raw_score * 100)}% · Level: {m.evidence_level}</span>
                  </div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>{m.notes}</div>
                  <div style={{ color: '#b45309', marginTop: '4px', fontStyle: 'italic' }}>
                    Guardrail: {m.anti_inference_guardrail}
                  </div>
                </div>
              ))}
            </div>

            <div
              data-testid="eqs-anti-inference-guardrails"
              style={{
                padding: '12px 14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
                lineHeight: 1.5,
              }}
            >
              <strong>Strict Anti-Inference Guardrails:</strong>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {eqs.anti_inference_guardrails.map((g, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{g}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
