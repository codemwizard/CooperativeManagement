import React from 'react';
import type { EngineEvent } from '../../engine/types';

interface ChangeConfirmationProps {
  event: EngineEvent | null;
  title: string;
  beforeText: string;
  unchangedText: string;
  onClose: () => void;
}

export const ChangeConfirmation: React.FC<ChangeConfirmationProps> = ({
  event,
  title,
  beforeText,
  unchangedText,
  onClose,
}) => {
  if (!event) return null;

  return (
    <div
      className="journey-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      data-testid="change-confirmation-modal"
    >
      <div
        className="journey-modal-card"
        style={{
          background: 'var(--surface-raised, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '540px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{title}</h3>
          <span style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>
            Event ID: {event.id}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '4px', borderLeft: '3px solid #64748b' }}>
            <strong style={{ display: 'block', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
              Before
            </strong>
            <div>{beforeText}</div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(5, 150, 105, 0.08)', borderRadius: '4px', borderLeft: '3px solid #059669' }}>
            <strong style={{ display: 'block', color: '#059669', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
              After (Persisted Engine Event)
            </strong>
            <div>
              Action: <code>{event.action}</code> by <strong>{event.actor.user_id}</strong> ({event.actor.role}) at {event.at}
            </div>
            {Boolean(event.after) && (
              <pre style={{ margin: '6px 0 0 0', fontSize: '11px', overflowX: 'auto', background: 'rgba(0, 0, 0, 0.05)', padding: '6px', borderRadius: '4px' }}>
                {JSON.stringify(event.after, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ padding: '10px', background: 'rgba(217, 119, 6, 0.08)', borderRadius: '4px', borderLeft: '3px solid #d97706' }}>
            <strong style={{ display: 'block', color: '#d97706', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
              Unchanged (Invariants Preserved)
            </strong>
            <div>{unchangedText}</div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="journey-btn-primary"
            style={{ width: 'auto', padding: '8px 18px', fontSize: '13px' }}
            onClick={onClose}
            data-testid="change-confirmation-close-btn"
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
