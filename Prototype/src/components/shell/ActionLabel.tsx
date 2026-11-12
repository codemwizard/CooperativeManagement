import React from 'react';

export type ActionLabelType =
  | 'VIEW ONLY'
  | 'RECORD CHANGE'
  | 'REQUEST / ASSIGNMENT'
  | 'INSTITUTIONAL FINDING OR DECISION';

interface ActionLabelProps {
  type: ActionLabelType;
  style?: React.CSSProperties;
}

const LABEL_STYLES: Record<ActionLabelType, { bg: string; text: string; border: string }> = {
  'VIEW ONLY': {
    bg: 'var(--surface-raised, #f1f5f9)',
    text: 'var(--muted, #64748b)',
    border: 'var(--line, #cbd5e1)',
  },
  'RECORD CHANGE': {
    bg: 'rgba(37, 99, 235, 0.1)',
    text: '#2563eb',
    border: '#2563eb',
  },
  'REQUEST / ASSIGNMENT': {
    bg: 'rgba(217, 119, 6, 0.1)',
    text: '#d97706',
    border: '#d97706',
  },
  'INSTITUTIONAL FINDING OR DECISION': {
    bg: 'rgba(5, 150, 105, 0.1)',
    text: '#059669',
    border: '#059669',
  },
};

export const ActionLabel: React.FC<ActionLabelProps> = ({ type, style }) => {
  const s = LABEL_STYLES[type] || LABEL_STYLES['VIEW ONLY'];
  return (
    <span
      className="action-label-badge"
      data-testid={"action-label-" + type.toLowerCase().replace(/[^a-z0-9]/g, '-')}
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '3px 8px',
        borderRadius: '4px',
        background: s.bg,
        color: s.text,
        border: "1px solid " + s.border,
        ...style,
      }}
    >
      {type}
    </span>
  );
};
