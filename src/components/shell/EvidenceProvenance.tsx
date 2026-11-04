import React from 'react';

export type ProvenanceSource =
  | 'certified_app'
  | 'external_app'
  | 'self_declared'
  | 'field_agent_assisted'
  | 'ta_programme';

export const PROVENANCE_LABELS: Record<ProvenanceSource, string> = {
  certified_app: '🟢 Certified App',
  external_app: '🟡 External (Uncertified)',
  self_declared: '🟠 Self-Declared',
  field_agent_assisted: '🔵 Field Agent Assisted',
  ta_programme: '🔵 TA Programme',
};

export interface EvidenceProvenanceProps {
  source: ProvenanceSource;
  collectedBy?: string;
  collectedOn?: string;
  style?: React.CSSProperties;
}

/** @deprecated Use ProvenanceDrawer instead */
export const EvidenceProvenance: React.FC<EvidenceProvenanceProps> = ({
  source,
  collectedBy,
  collectedOn,
  style,
}) => {
  const label = PROVENANCE_LABELS[source] || source;
  const extra = [collectedBy, collectedOn].filter(Boolean).join(' · ');

  return (
    <span
      data-testid={`provenance-${source}`}
      className={`provenance-badge provenance-badge--${source}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        lineHeight: 1.4,
        ...style,
      }}
    >
      <span>{label}</span>
      {extra && <span style={{ opacity: 0.85 }}>({extra})</span>}
    </span>
  );
};
