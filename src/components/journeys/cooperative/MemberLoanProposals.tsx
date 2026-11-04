import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';

interface LoanProposal {
  id: string;
  lender: string;
  facilityType: string;
  amountZMW: number;
  termMonths: number;
  interestRate: string;
  purpose: string;
  status: 'pending' | 'approved' | 'declined';
}

interface MemberLoanProposalsProps {
  caseState: CaseState;
  onBack: () => void;
  onSaveExit: () => void;
  onRunAction?: (action: any) => { ok: boolean; error?: string };
}

const INITIAL_PROPOSALS: LoanProposal[] = [
  {
    id: 'prop-001',
    lender: 'National Agricultural Finance Facility',
    facilityType: 'Member Input Financing Facility',
    amountZMW: 18500,
    termMonths: 12,
    interestRate: '8.5% p.a.',
    purpose: 'Certified seed and solar-drip irrigation equipment for individual parcel',
    status: 'pending',
  },
  {
    id: 'prop-002',
    lender: 'Rural Enterprise Development Fund',
    facilityType: 'Livestock Care & Feed Storage',
    amountZMW: 12000,
    termMonths: 18,
    interestRate: '9.0% p.a.',
    purpose: 'Veterinary supplies and dry season fodder reserve',
    status: 'pending',
  },
];

export const MemberLoanProposals: React.FC<MemberLoanProposalsProps> = ({
  caseState,
  onBack,
  onSaveExit,
  onRunAction,
}) => {
  void caseState;
  const [proposals, setProposals] = useState<LoanProposal[]>(INITIAL_PROPOSALS);

  const handleDecision = (id: string, decision: 'approved' | 'declined') => {
    setProposals(prev =>
      prev.map(p => (p.id === id ? { ...p, status: decision } : p))
    );
    if (onRunAction) {
      onRunAction({
        type: 'record_admission',
        proposal_id: id,
        decision,
      });
    }
  };

  return (
    <div className="journey-card" data-testid="member-loan-proposals-step">
      <h2 className="journey-title">Bank-to-Member Loan Proposals</h2>
      <p className="journey-subtitle">
        Review financing proposals extended by institutional lenders under your cooperative membership. You may approve or decline each facility directly.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {proposals.map(p => (
          <div
            key={p.id}
            style={{
              padding: '16px 20px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
            data-testid={`loan-card-${p.id}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  {p.lender}
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {p.facilityType} · Facility Ref: <code>{p.id}</code>
                </div>
              </div>

              <div>
                {p.status === 'approved' && (
                  <span
                    data-testid={`loan-status-${p.id}`}
                    style={{
                      padding: '4px 10px',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Approved ✓
                  </span>
                )}
                {p.status === 'declined' && (
                  <span
                    data-testid={`loan-status-${p.id}`}
                    style={{
                      padding: '4px 10px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Declined ✕
                  </span>
                )}
                {p.status === 'pending' && (
                  <span
                    data-testid={`loan-status-${p.id}`}
                    style={{
                      padding: '4px 10px',
                      background: '#fef9c3',
                      color: '#854d0e',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Awaiting Member Decision
                  </span>
                )}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              padding: '10px 12px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              margin: '10px 0',
              fontSize: '12px',
            }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Loan Amount</span>
                <strong style={{ fontSize: '14px', color: 'var(--action)' }}>
                  ZMW {p.amountZMW.toLocaleString()}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Repayment Term</span>
                <strong>{p.termMonths} Months</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block' }}>Indicative Interest</span>
                <strong>{p.interestRate}</strong>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '12px' }}>
              <strong>Designated Purpose:</strong> {p.purpose}
            </div>

            {p.status === 'pending' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="journey-btn-primary"
                  style={{ width: 'auto', padding: '6px 16px', fontSize: '12px' }}
                  onClick={() => handleDecision(p.id, 'approved')}
                  data-testid={`member-approve-loan-${p.id}`}
                >
                  Approve Loan Proposal
                </button>
                <button
                  type="button"
                  className="journey-btn-secondary"
                  style={{ width: 'auto', padding: '6px 16px', fontSize: '12px' }}
                  onClick={() => handleDecision(p.id, 'declined')}
                  data-testid={`member-decline-loan-${p.id}`}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="member-loans-back"
        >
          Back to Enrolment
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="member-loans-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
