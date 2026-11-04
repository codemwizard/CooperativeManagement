import React from 'react';
import type { Role } from '../../engine/types';
import type { SymphonyDraft } from './types.display';

export interface LoginScreenProps {
  onSelectRole: (role: Role) => void;
  savedDraft: SymphonyDraft | null;
  onResumeDraft: () => void;
  onDiscardDraft: () => void;
  onResetDemo: () => void;
  onCreateAccount?: () => void;
}

const ROLES_LIST: Array<{ role: Role; title: string; subtitle: string; group: string }> = [
  { role: 'secretary', title: 'Cooperative Secretary', subtitle: 'Self-assessment, member roster & minutes', group: 'Cooperative Enterprise' },
  { role: 'treasurer', title: 'Cooperative Treasurer', subtitle: 'Commercial records & financial history', group: 'Cooperative Enterprise' },
  { role: 'chairman', title: 'Cooperative Chairman', subtitle: 'Governance signoff & dossier presentation', group: 'Cooperative Enterprise' },
  { role: 'member', title: 'Cooperative Member', subtitle: 'Member participation & household declarations', group: 'Cooperative Enterprise' },
  { role: 'coop_field_agent', title: 'Cooperative Field Agent', subtitle: 'Official field data collection — measurements, livestock & site surveys', group: 'Cooperative Enterprise' },

  { role: 'field_agent', title: 'Field Agent', subtitle: 'Field verification & data collection', group: 'Programme & Field Support' },
  { role: 'ta', title: 'Technical Assistance Officer', subtitle: 'Gap remediation & capacity assignments', group: 'Programme & Field Support' },
  { role: 'fund_manager', title: 'NABII Fund Manager', subtitle: 'Programme pipeline & cohort oversight', group: 'Programme & Field Support' },

  { role: 'pfi_analyst', title: 'PFI Credit Analyst', subtitle: 'Pipeline discovery & risk assessment', group: 'Institutional Assessment' },
  { role: 'pfi_credit', title: 'PFI Credit Officer', subtitle: 'Credit admission, reliance & outcome decisions', group: 'Institutional Assessment' },
  { role: 'verifier', title: 'Independent Verifier (VVB)', subtitle: 'Scope-bounded findings & assurance', group: 'Institutional Assessment' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSelectRole,
  savedDraft,
  onResumeDraft,
  onDiscardDraft,
  onResetDemo,
  onCreateAccount,
}) => {
  const [activeModal, setActiveModal] = React.useState<'none' | 'create-account' | 'terms'>('none');

  return (
    <div className="journey-shell" data-testid="login-screen">
      <header className="journey-header">
        <div className="journey-header-left">
          <span className="journey-brand">Symphony</span>
          <span className="journey-role-badge">Demo Mode: No Authentication</span>
        </div>
        <div className="journey-header-right">
          <button
            type="button"
            className="journey-exit-btn"
            onClick={onResetDemo}
            data-testid="reset-demo"
          >
            Reset demo
          </button>
        </div>
      </header>

      <main className="journey-main" style={{ padding: '16px 20px', overflowY: 'auto' }}>
        <div className="journey-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '0 12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)' }}>
              Symphony
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.4 }}>
              A role-guided transformation: making rural enterprises legible and assessment-ready for institutional finance.
            </p>

            <div
              data-testid="demo-signin-banner"
              style={{
                marginTop: '10px',
                padding: '8px 18px',
                background: 'var(--action)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'inline-block',
                letterSpacing: '0.02em',
              }}
            >
              → Demo Sign-In: Select a role below — no password required
            </div>

            <div
              data-testid="ussd-shortcode-text"
              style={{
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--muted)',
                fontStyle: 'italic',
              }}
            >
              Dial *123# for members' self-enroll directly
            </div>
          </div>

          {savedDraft && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--action)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
              }}
              data-testid="resume-draft-banner"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--action)', marginBottom: '2px' }}>
                    Active Draft Available
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                    Role: <strong>{savedDraft.draftRole}</strong> · Step: <strong>{savedDraft.draftStep} of 8</strong> ({savedDraft.draftPhase})
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="journey-btn-primary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                    onClick={onResumeDraft}
                    data-testid="resume-draft-btn"
                  >
                    Resume Draft
                  </button>
                  <button
                    type="button"
                    className="journey-btn-secondary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                    onClick={onDiscardDraft}
                    data-testid="discard-draft-btn"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2-Column Role Selection Grid */}
          <div
            data-testid="role-columns"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {/* LEFT COLUMN: Cooperative Enterprise */}
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px 0', letterSpacing: '0.04em' }}>
                Cooperative Enterprise
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ROLES_LIST.filter(r => r.group === 'Cooperative Enterprise').map(r => (
                  <button
                    key={r.role}
                    type="button"
                    className="journey-card"
                    style={{
                      padding: '10px 14px',
                      margin: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'transform 0.1s ease, border-color 0.15s ease',
                    }}
                    onClick={() => onSelectRole(r.role)}
                    data-testid={`role-btn-${r.role}`}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.3 }}>
                        {r.subtitle}
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--action)', marginLeft: '8px' }}>→</span>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: Programme & Field Support + Institutional Assessment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {['Programme & Field Support', 'Institutional Assessment'].map(groupName => (
                <div key={groupName}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px 0', letterSpacing: '0.04em' }}>
                    {groupName}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {ROLES_LIST.filter(r => r.group === groupName).map(r => (
                      <button
                        key={r.role}
                        type="button"
                        className="journey-card"
                        style={{
                          padding: '10px 14px',
                          margin: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'transform 0.1s ease, border-color 0.15s ease',
                        }}
                        onClick={() => onSelectRole(r.role)}
                        data-testid={`role-btn-${r.role}`}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                            {r.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.3 }}>
                            {r.subtitle}
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--action)', marginLeft: '8px' }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <footer style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--action)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '12px' }}
                onClick={() => {
                  if (onCreateAccount) {
                    onCreateAccount();
                  } else {
                    setActiveModal('create-account');
                  }
                }}
                data-testid="link-create-account"
              >
                Create Account
              </button>
              <span style={{ color: 'var(--muted)' }}>•</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--action)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '12px' }}
                onClick={() => setActiveModal('terms')}
                data-testid="link-terms-conditions"
              >
                Terms &amp; Conditions
              </button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '6px' }}>
              Symphony Prototype · Founder Build Plan Revision 2
            </div>
          </footer>
        </div>
      </main>

      {/* Static Modal: Create Account fallback */}
      {activeModal === 'create-account' && (
        <div className="modal-backdrop" onClick={() => setActiveModal('none')} data-testid="modal-create-account">
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Create Account</h3>
              <button
                type="button"
                className="journey-btn-secondary"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setActiveModal('none')}
                data-testid="close-modal-btn"
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', margin: '12px 0' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Account creation is not part of this demo. Registration is assisted by field agents after sign-in.
              </p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                Please select an existing demo persona from the sign-in list to explore role-specific workflows.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="journey-btn-primary"
                style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setActiveModal('none')}
                data-testid="close-modal-ok"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Static Modal: Terms & Conditions */}
      {activeModal === 'terms' && (
        <div className="modal-backdrop" onClick={() => setActiveModal('none')} data-testid="modal-terms">
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Terms &amp; Conditions</h3>
              <button
                type="button"
                className="journey-btn-secondary"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setActiveModal('none')}
                data-testid="close-modal-btn"
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text)', margin: '12px 0', maxHeight: '340px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>1. Demonstration Prototype</strong><br />
                Symphony is a prototype designed to evaluate digital governance, evidence tracing, and institutional assessment workflows for agricultural cooperatives.
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>2. Product Boundary &amp; No Guarantee</strong><br />
                Symphony provides evidence and makes it inspectable: source, provenance, limitations, and identifiable sources behind each claim. Symphony never approves, offers, or guarantees credit, grants, or financial facilities. The institution decides what it believes and whether to proceed.
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>3. Field Agent Statements</strong><br />
                Field Agent statements are traceable claims by identifiable internal sources. They do not constitute Symphony or independent third-party verification.
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Demonstration Data &amp; Privacy</strong><br />
                All cooperative records and financial figures are for demonstration purposes. Personal member and household details are strictly isolated from institutional views.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="journey-btn-primary"
                style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
                onClick={() => setActiveModal('none')}
                data-testid="close-modal-ok"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
