import React, { useState } from 'react';
import type { CaseState, Role } from '../../../engine/types';
import type { MemberRosterItem, OfficerEntry, OfficerComparisonItem } from '../types.display';

interface CoopGovernanceProps {
  caseState: CaseState & {
    certificate_officers?: OfficerEntry[];
    current_officers?: OfficerEntry[];
    members_roster?: MemberRosterItem[];
  };
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
  onUpdateCase: (updater: (prev: CaseState) => CaseState) => void;
  onRunAction: (action: any) => { ok: boolean; error?: string };
}

export const CoopGovernance: React.FC<CoopGovernanceProps> = ({
  caseState,
  role,
  onNext,
  onBack,
  onSaveExit,
  onUpdateCase,
  onRunAction,
}) => {
  const roster = caseState.members_roster ?? [];

  // Default initial certificate officers from seed or standard fallback
  const initialCertOfficers: OfficerEntry[] = caseState.certificate_officers && caseState.certificate_officers.length > 0
    ? caseState.certificate_officers
    : [
        { member_id: 'mbr-001', office: 'Chairman', name: 'Joseph Mwale' },
        { member_id: 'm-cert-002', office: 'Secretary', name: 'Agnes Phiri' },
        { member_id: 'mbr-003', office: 'Treasurer', name: 'Grace Tembo' },
      ];

  // Default current officers from seed or enrolled roster
  const initialCurrentOfficers: OfficerEntry[] = caseState.current_officers && caseState.current_officers.length > 0
    ? caseState.current_officers
    : [
        { member_id: roster[0]?.member_id || null, office: 'Chairman', name: roster[0]?.name || '' },
        { member_id: roster[1]?.member_id || null, office: 'Secretary', name: roster[1]?.name || '' },
        { member_id: roster[2]?.member_id || null, office: 'Treasurer', name: roster[2]?.name || '' },
      ];

  const [certOfficers, setCertOfficers] = useState<OfficerEntry[]>(initialCertOfficers);
  const [currOfficers, setCurrOfficers] = useState<OfficerEntry[]>(initialCurrentOfficers);
  const [minutesUploaded, setMinutesUploaded] = useState<boolean>(caseState.evidence?.governance?.level === 'supported');

  // Compare officers by member_id
  const runComparison = (): { comparison: OfficerComparisonItem[]; hasDiscrepancy: boolean } => {
    const comparison: OfficerComparisonItem[] = [];
    let hasDiscrepancy = false;

    const offices = ['Chairman', 'Secretary', 'Treasurer'];
    for (const office of offices) {
      const cert = certOfficers.find(o => o.office === office);
      const curr = currOfficers.find(o => o.office === office);

      const certId = cert?.member_id ?? null;
      const currId = curr?.member_id ?? null;
      const certName = (cert?.name || '').trim();
      const currName = (curr?.name || '').trim();

      if (!certId || !currId) {
        comparison.push({
          office,
          certificate_member_id: certId,
          current_member_id: currId,
          id_match: false,
          name_match: certName.toLowerCase() === currName.toLowerCase(),
          discrepancy_type: 'no_id_recorded',
          note: `Member ID missing on ${!certId ? 'certificate' : 'current'} record for ${office}.`,
        });
        hasDiscrepancy = true;
      } else if (certId !== currId) {
        comparison.push({
          office,
          certificate_member_id: certId,
          current_member_id: currId,
          id_match: false,
          name_match: certName.toLowerCase() === currName.toLowerCase(),
          discrepancy_type: 'person_discrepancy',
          note: `Officer discrepancy: Certificate states ${certName} (${certId}) but current roster states ${currName} (${currId}).`,
        });
        hasDiscrepancy = true;
      } else if (certName.toLowerCase() !== currName.toLowerCase()) {
        comparison.push({
          office,
          certificate_member_id: certId,
          current_member_id: currId,
          id_match: true,
          name_match: false,
          discrepancy_type: 'name_discrepancy',
          note: `Name difference with matching ID (${currId}): '${certName}' vs '${currName}'.`,
        });
        hasDiscrepancy = true;
      } else {
        comparison.push({
          office,
          certificate_member_id: certId,
          current_member_id: currId,
          id_match: true,
          name_match: true,
          discrepancy_type: 'none',
          note: 'Full match on ID and name.',
        });
      }
    }

    return { comparison, hasDiscrepancy };
  };

  const { comparison, hasDiscrepancy } = runComparison();

  // Defensive prerequisite check: Enforce at least one enrolled member
  if (roster.length === 0) {
    return (
      <div className="journey-card" data-testid="coop-step-4-governance">
        <h2 className="journey-title">Establish Governance & Officers</h2>
        <div className="journey-discrepancy-card" data-testid="governance-prerequisite-error">
          <div className="journey-discrepancy-title">Prerequisite Required</div>
          <div className="journey-discrepancy-text">
            At least one member must be enrolled before governance officers can be determined. There are currently no enrolled members to assign to officer positions.
          </div>
        </div>
        <div className="journey-actions">
          <button
            type="button"
            className="journey-btn-primary"
            onClick={onBack}
            data-testid="coop-step-4-return-to-members"
          >
            ← Return to Step 3 (Member Roster)
          </button>
        </div>
      </div>
    );
  }


  const handleUpdateCurrentOfficer = (office: string, memberId: string) => {
    const member = roster.find(m => m.member_id === memberId);
    setCurrOfficers(prev => prev.map(o => o.office === office ? {
      ...o,
      member_id: memberId,
      name: member?.name || o.name,
    } : o));
  };

  const handleSaveGovernance = () => {
    const limitationText = hasDiscrepancy
      ? 'Officer records compared by ID where available. Discrepancy detected. Not independently resolved.'
      : 'Officer records compared by ID where available. No discrepancy detected. Not independently verified.';

    onRunAction({
      type: 'add_evidence',
      evidence_type: 'governance_officers',
      level: 'asserted',
      item: {
        certificate_entries: certOfficers,
        current_entries: currOfficers,
        comparison_result: comparison,
        has_discrepancy: hasDiscrepancy,
      },
      limitation: limitationText,
    });

    onUpdateCase(prev => ({
      ...prev,
      certificate_officers: certOfficers,
      current_officers: currOfficers,
    }));
  };

  const handleUploadMinutes = () => {
    onRunAction({
      type: 'upload_minutes',
      limitation: 'Cooperative meeting minutes uploaded. Not independently checked.',
    });
    setMinutesUploaded(true);
  };

  const handleSignoffMinutes = () => {
    onRunAction({
      type: 'signoff_minutes',
    });
  };

  return (
    <div className="journey-card" data-testid="coop-step-4-governance">
      <h2 className="journey-title">Establish Governance & Officers</h2>
      <p className="journey-subtitle">
        Current officers are determined from enrolled members and compared against registration certificate records.
      </p>

      {/* Certificate Officers Form */}
      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} data-testid="certificate-officers-form">
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Registration Certificate Officers (Historical Record)</h4>
        {certOfficers.map((cert, idx) => (
          <div key={cert.office} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label className="journey-label">{cert.office}</label>
            </div>
            <div>
              <input
                className="journey-input"
                value={cert.member_id || ''}
                placeholder="Member ID"
                onChange={e => {
                  const val = e.target.value;
                  setCertOfficers(prev => prev.map((o, i) => i === idx ? { ...o, member_id: val } : o));
                }}
                data-testid={`cert-officer-id-${cert.office.toLowerCase()}`}
              />
            </div>
            <div>
              <input
                className="journey-input"
                value={cert.name}
                placeholder="Full Name"
                onChange={e => {
                  const val = e.target.value;
                  setCertOfficers(prev => prev.map((o, i) => i === idx ? { ...o, name: val } : o));
                }}
                data-testid={`cert-officer-name-${cert.office.toLowerCase()}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Current Officers Form */}
      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} data-testid="current-officers-form">
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Current Officers (Selected from Enrolled Membership)</h4>
        {currOfficers.map((curr) => (
          <div key={curr.office} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label className="journey-label">{curr.office}</label>
            </div>
            <div>
              <select
                className="journey-select"
                value={curr.member_id || ''}
                onChange={e => handleUpdateCurrentOfficer(curr.office, e.target.value)}
                data-testid={`curr-officer-select-${curr.office.toLowerCase()}`}
              >
                <option value="">-- Select enrolled member --</option>
                {roster.map(m => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Deterministic Discrepancy Card */}
      {hasDiscrepancy && (
        <div className="journey-discrepancy-card" data-testid="governance-discrepancy-card">
          <div className="journey-discrepancy-title">Discrepancy Detected in Governance Officers</div>
          <div className="journey-discrepancy-text">
            {comparison.filter(c => c.discrepancy_type !== 'none').map(c => (
              <div key={c.office} style={{ marginBottom: '6px' }}>
                <strong>{c.office}:</strong> {c.note}
              </div>
            ))}
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>
              Note: Unresolved discrepancies are preserved as self-reported evidence (asserted level) and submitted without modification.
            </div>
          </div>
        </div>
      )}

      {/* Minutes & Signoff Section */}
      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Meeting Minutes & Officer Sign-off</h4>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="journey-btn-secondary"
            onClick={handleUploadMinutes}
            data-testid="upload-minutes-btn"
          >
            {minutesUploaded ? '✓ Minutes Uploaded (Supported)' : 'Upload AGM Minutes'}
          </button>
          {role === 'chairman' && (
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={handleSignoffMinutes}
              data-testid="signoff-minutes-btn"
            >
              Chairman Sign-off
            </button>
          )}
        </div>
      </div>

      <p className="journey-forward-hint">
        The next step captures operating history, farming production, and revenue records.
      </p>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={() => {
            handleSaveGovernance();
            onNext();
          }}
          data-testid="coop-step-4-continue"
        >
          Continue to Operating History
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-4-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-4-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
