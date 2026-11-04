import React, { useState } from 'react';
import type { CaseState, Role } from '../../../engine/types';
import type { MemberRosterItem, EncumbranceStatus, LivestockItem } from '../types.display';
import { ActionLabel } from '../../shell/ActionLabel';
import { EvidenceProvenance } from '../../shell/EvidenceProvenance';

interface ExtendedMemberRosterItem extends MemberRosterItem {
  gender?: string;
  age?: number;
  is_head_of_household?: boolean;
  special_considerations?: string;
  land_status?: string;
  farm_size_ha?: number;
  financial_service?: string;
  education?: string;
  primary_language?: string;
  device?: string;
  household_size?: number;
  water_source?: string;
  energy_source?: string;
  is_field_agent?: boolean;
}

interface CoopMembersProps {
  caseState: CaseState & { members_roster?: ExtendedMemberRosterItem[] };
  role: Role;
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
  onUpdateCase: (updater: (prev: CaseState) => CaseState) => void;
  memberSelfEdit?: boolean;
}

export const CoopMembers: React.FC<CoopMembersProps> = ({
  caseState,
  role,
  onNext,
  onBack,
  onSaveExit,
  onUpdateCase,
  memberSelfEdit = false,
}) => {
  void role;
  const roster: ExtendedMemberRosterItem[] = (caseState.members_roster as ExtendedMemberRosterItem[]) ?? [];

  // Form states - Block 1: Identity & Inclusivity
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Member');
  const [newGender, setNewGender] = useState('Female');
  const [newAge, setNewAge] = useState<number>(28);
  const [isHead, setIsHead] = useState<boolean>(true);
  const [specialConsiderations, setSpecialConsiderations] = useState('');

  // Block 2: Land & Asset (including Livestock)
  const [landStatus, setLandStatus] = useState('Customary');
  const [farmSizeHa, setFarmSizeHa] = useState<number>(3.5);
  const [finService, setFinService] = useState('Mobile Money');
  const [species, setSpecies] = useState('Cattle');
  const [count, setCount] = useState<number>(0);
  const [estValue, setEstValue] = useState<number>(0);
  const [encumbrance, setEncumbrance] = useState<EncumbranceStatus>('Not recorded');

  // Block 3: Education & Digital
  const [education, setEducation] = useState('Secondary');
  const [language, setLanguage] = useState('Bemba');
  const [device, setDevice] = useState('Smartphone');

  // Block 4: Community Welfare
  const [householdSize, setHouseholdSize] = useState<number>(5);
  const [waterSource, setWaterSource] = useState('Borehole');
  const [energySource, setEnergySource] = useState('Solar + Charcoal');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selfEnrolSubmitted, setSelfEnrolSubmitted] = useState<boolean>(false);

  // Computed youth status
  const isYouth = newAge > 0 && newAge < 35;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('Member name is required.');
      return;
    }

    const nextId = `mbr-${String(roster.length + 1).padStart(3, '0')}`;
    const livestockList: LivestockItem[] = count > 0 ? [{
      species,
      count,
      est_value_zmw: estValue,
      encumbrance,
    }] : [];

    const isFA = newRole === 'Field Agent';

    const newMember: ExtendedMemberRosterItem = {
      member_id: nextId,
      name: newName.trim(),
      cooperative_role: newRole,
      gender: newGender,
      age: newAge,
      is_head_of_household: isHead,
      special_considerations: specialConsiderations.trim() || undefined,
      land_status: landStatus,
      farm_size_ha: farmSizeHa,
      financial_service: finService,
      education,
      primary_language: language,
      device,
      household_size: householdSize,
      water_source: waterSource,
      energy_source: energySource,
      is_field_agent: isFA,
      livestock: livestockList,
    };

    onUpdateCase(prev => {
      const prevRoster = ((prev as any).members_roster ?? []) as ExtendedMemberRosterItem[];
      return {
        ...prev,
        members_roster: [...prevRoster, newMember],
      } as CaseState;
    });

    setNewName('');
    setCount(0);
    setEstValue(0);
    setEncumbrance('Not recorded');
    setSpecialConsiderations('');
    setErrorMsg(null);
    if (memberSelfEdit) setSelfEnrolSubmitted(true);
  };

  const handleToggleFieldAgent = (memberId: string) => {
    onUpdateCase(prev => {
      const prevRoster = ((prev as any).members_roster ?? []) as ExtendedMemberRosterItem[];
      return {
        ...prev,
        members_roster: prevRoster.map(m => {
          if (m.member_id === memberId) {
            const nextIsFA = !m.is_field_agent;
            return {
              ...m,
              is_field_agent: nextIsFA,
              cooperative_role: nextIsFA ? 'Field Agent' : 'Member',
            };
          }
          return m;
        }),
      } as CaseState;
    });
  };

  const handleContinue = () => {
    if (roster.length === 0) {
      setErrorMsg('At least one member must be enrolled before proceeding to governance.');
      return;
    }
    setErrorMsg(null);
    onNext();
  };

  return (
    <div className="journey-card" data-testid="coop-step-3-members">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 className="journey-title" style={{ margin: 0 }}>4-Block Member Roster Enrolment</h2>
        <ActionLabel type="RECORD CHANGE" />
      </div>
      <p className="journey-subtitle">
        Enrol cooperative members across 4 standard blocks: Identity &amp; Inclusivity, Land &amp; Asset, Education &amp; Digital, and Community Welfare.
      </p>

      {errorMsg && (
        <div className="journey-discrepancy-card" data-testid="coop-members-error">
          <div className="journey-discrepancy-title">Prerequisite Required</div>
          <div className="journey-discrepancy-text">{errorMsg}</div>
        </div>
      )}

      {/* Enrolled Members List */}
      <div className="journey-form-group" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label className="journey-label" style={{ margin: 0 }}>
            Enrolled Members Roster ({roster.length})
          </label>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Youth under 35: {roster.filter(m => (m.age || 0) > 0 && (m.age || 0) < 35).length} · Female heads: {roster.filter(m => m.gender === 'Female' && m.is_head_of_household).length}
          </span>
        </div>

        {Boolean(caseState.members_roster_note) && (
          <div
            data-testid="members-roster-scope-note"
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--muted)',
              marginBottom: '10px',
              fontStyle: 'italic',
            }}
          >
            {String(caseState.members_roster_note)}
          </div>
        )}

        {roster.length === 0 ? (
          <div style={{ padding: '20px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', color: 'var(--muted)', textAlign: 'center' }} data-testid="coop-roster-empty">
            No members enrolled yet. Fill the 4-block enrolment form below to add your first member.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} data-testid="coop-roster-list">
            {roster.map(m => {
              const memberIsYouth = (m.age || 0) > 0 && (m.age || 0) < 35;
              return (
                <div
                  key={m.member_id}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface-raised)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                  data-testid={`member-row-${m.member_id}`}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong data-testid="member-name" style={{ fontSize: '14px' }}>{m.name}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '12px' }}>({m.member_id})</span>
                      <span style={{ padding: '2px 8px', background: '#e2e8f0', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {m.cooperative_role}
                      </span>
                      {memberIsYouth && (
                        <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }} data-testid="youth-flag-badge">
                          Youth &lt; 35
                        </span>
                      )}
                      {m.is_head_of_household && (
                        <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '11px' }}>
                          Household Head
                        </span>
                      )}
                      {m.is_field_agent && (
                        <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }} data-testid="field-agent-badge">
                          Field Agent (Internal Verifier)
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                      {m.gender} {m.age ? `· Age ${m.age}` : ''} {m.land_status ? `· Land: ${m.land_status}` : ''} {m.education ? `· ${m.education}` : ''} {m.device ? `· ${m.device}` : ''}
                    </div>

                    {m.livestock && m.livestock.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '6px' }} data-testid="member-livestock-detail">
                        🐄 <strong>Declared Livestock:</strong> {m.livestock.map(l => `${l.count} ${l.species} (ZMW ${l.est_value_zmw.toLocaleString()}) [Encumbrance: ${l.encumbrance}]`).join(', ')}
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          Personal property of member. Reported encumbrance as stated; official registry search not performed.
                        </span>
                      </div>
                    )}

                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {m.is_field_agent
                          ? 'Assisted by: cfa.banda (Field Agent) — Certified App'
                          : m.device === 'Feature phone'
                          ? 'Self-registered via *123# — Uncertified'
                          : 'Assisted by: cfa.banda (Field Agent) — Certified App'}
                      </span>
                      <EvidenceProvenance
                        source={m.device === 'Feature phone' ? 'self_declared' : 'certified_app'}
                        collectedBy="cfa.banda"
                      />
                    </div>

                    {m.is_field_agent && (
                      <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
                        Notice: Field Agent checks are internal claims. Field Agent cannot verify their own livestock (Rule I1).
                      </div>
                    )}
                  </div>

                  {!memberSelfEdit && (
                    <div style={{ marginLeft: '12px' }}>
                      <button
                        type="button"
                        className="journey-btn-secondary"
                        style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => handleToggleFieldAgent(m.member_id)}
                        data-testid={`toggle-fa-${m.member_id}`}
                      >
                        {m.is_field_agent ? 'Revoke Agent Role' : 'Assign Field Agent'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4-Block Enrolment Form */}
      <form onSubmit={handleAddMember} style={{ padding: '20px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            {memberSelfEdit ? 'Member Self-Enrolment & Declaration' : 'Enrol New Member'}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {memberSelfEdit ? 'Self-Declaration via Member Portal' : 'Assisted by Field Agent'}
          </span>
        </div>

        {/* BLOCK 1: Identity & Inclusivity */}
        <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} data-testid="block-identity">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--action)', fontWeight: 700 }}>
            Block 1: Identity &amp; Inclusivity
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: memberSelfEdit ? '2fr 1fr' : '2fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
            <div>
              <label className="journey-label" htmlFor="new-member-name">Full Name *</label>
              <input
                id="new-member-name"
                className="journey-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Agnes Mwale"
                data-testid="coop-member-input-name"
              />
            </div>
            {!memberSelfEdit && (
              <div>
                <label className="journey-label" htmlFor="new-member-role">Cooperative Role</label>
                <select
                  id="new-member-role"
                  className="journey-select"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  data-testid="coop-member-select-role"
                >
                  <option value="Member">Member</option>
                  <option value="Chairman">Chairman</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Treasurer">Treasurer</option>
                  <option value="Field Agent">Field Agent</option>
                </select>
              </div>
            )}
            <div>
              <label className="journey-label" htmlFor="new-member-gender">Gender</label>
              <select
                id="new-member-gender"
                className="journey-select"
                value={newGender}
                onChange={e => setNewGender(e.target.value)}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px' }}>
            <div>
              <label className="journey-label" htmlFor="new-member-age">Age (Years)</label>
              <input
                id="new-member-age"
                type="number"
                min="18"
                max="100"
                className="journey-input"
                value={newAge}
                onChange={e => setNewAge(parseInt(e.target.value) || 0)}
              />
              {isYouth && (
                <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '2px', fontWeight: 600 }}>
                  ✓ Youth-led (&lt;35 yrs)
                </div>
              )}
            </div>
            <div>
              <label className="journey-label">Household Head</label>
              <select
                className="journey-select"
                value={isHead ? 'yes' : 'no'}
                onChange={e => setIsHead(e.target.value === 'yes')}
              >
                <option value="yes">Yes (Head)</option>
                <option value="no">No (Dependent)</option>
              </select>
            </div>
            <div>
              <label className="journey-label" htmlFor="new-member-special">Voluntary Self-Identification (Optional)</label>
              <input
                id="new-member-special"
                className="journey-input"
                value={specialConsiderations}
                onChange={e => setSpecialConsiderations(e.target.value)}
                placeholder="e.g. Disability consideration, displaced household"
              />
            </div>
          </div>
        </div>

        {/* BLOCK 2: Land & Asset (including Livestock) */}
        <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} data-testid="block-land-asset">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--action)', fontWeight: 700 }}>
            Block 2: Land &amp; Asset (Livestock Declaration)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
            <div>
              <label className="journey-label">Land Tenure Status</label>
              <select
                className="journey-select"
                value={landStatus}
                onChange={e => setLandStatus(e.target.value)}
              >
                <option value="Customary">Customary Tenure</option>
                <option value="Titled">State Titled Leasehold</option>
                <option value="Rented">Rented / Tenancy</option>
                <option value="None">None (Landless)</option>
              </select>
            </div>
            <div>
              <label className="journey-label">Farm Size (Hectares)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="journey-input"
                value={farmSizeHa}
                onChange={e => setFarmSizeHa(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="journey-label">Financial Access</label>
              <select
                className="journey-select"
                value={finService}
                onChange={e => setFinService(e.target.value)}
              >
                <option value="Mobile Money">Mobile Money (Registered)</option>
                <option value="Bank Account">Commercial Bank Account</option>
                <option value="None">None (Cash Only)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <div>
              <label className="journey-label">Livestock Species</label>
              <select
                className="journey-select"
                value={species}
                onChange={e => setSpecies(e.target.value)}
              >
                <option value="Cattle">Cattle</option>
                <option value="Goats">Goats</option>
                <option value="Pigs">Pigs</option>
                <option value="Poultry">Poultry</option>
              </select>
            </div>
            <div>
              <label className="journey-label">Head Count</label>
              <input
                type="number"
                min="0"
                className="journey-input"
                value={count}
                onChange={e => setCount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="journey-label">Est. Value (ZMW)</label>
              <input
                type="number"
                min="0"
                className="journey-input"
                value={estValue}
                onChange={e => setEstValue(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="journey-label">Reported Encumbrance</label>
              <select
                className={`journey-select ${encumbrance === 'Not recorded' ? 'journey-select-muted' : ''}`}
                value={encumbrance}
                onChange={e => setEncumbrance(e.target.value as EncumbranceStatus)}
                data-testid="coop-member-encumbrance-select"
              >
                <option value="Not recorded" className="journey-select-muted">Not recorded</option>
                <option value="Reported unencumbered">Reported unencumbered</option>
                <option value="Verified unencumbered">Verified unencumbered</option>
                <option value="Unknown">Unknown</option>
                <option value="Under lien">Under lien</option>
                <option value="Pledged">Pledged</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
            Note: Encumbrance defaults to "Not recorded" per Rule R26. "Unregistered" and "unencumbered" are not synonyms. Registry check not performed.
          </div>
        </div>

        {/* BLOCK 3: Education & Digital */}
        <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} data-testid="block-education-digital">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--action)', fontWeight: 700 }}>
            Block 3: Education &amp; Digital Access
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="journey-label">Highest Education</label>
              <select
                className="journey-select"
                value={education}
                onChange={e => setEducation(e.target.value)}
              >
                <option value="Primary">Primary School</option>
                <option value="Secondary">Secondary School</option>
                <option value="Tertiary">Tertiary / Vocational</option>
                <option value="None">None</option>
              </select>
            </div>
            <div>
              <label className="journey-label">Primary Language</label>
              <select
                className="journey-select"
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="Bemba">Bemba</option>
                <option value="English">English</option>
                <option value="Nyanja">Nyanja</option>
                <option value="Tonga">Tonga</option>
                <option value="Lozi">Lozi</option>
              </select>
            </div>
            <div>
              <label className="journey-label">Primary Device</label>
              <select
                className="journey-select"
                value={device}
                onChange={e => setDevice(e.target.value)}
              >
                <option value="Smartphone">Smartphone</option>
                <option value="Feature phone">Feature phone (USSD/SMS)</option>
                <option value="None">None</option>
              </select>
            </div>
          </div>
        </div>

        {/* BLOCK 4: Community Welfare */}
        <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} data-testid="block-welfare">
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--action)', fontWeight: 700 }}>
            Block 4: Community Welfare
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="journey-label">Household Size (Persons)</label>
              <input
                type="number"
                min="1"
                className="journey-input"
                value={householdSize}
                onChange={e => setHouseholdSize(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="journey-label">Primary Water Source</label>
              <select
                className="journey-select"
                value={waterSource}
                onChange={e => setWaterSource(e.target.value)}
              >
                <option value="Borehole">Protected Borehole</option>
                <option value="Piped">Piped Water</option>
                <option value="Protected Well">Protected Well</option>
                <option value="River / Stream">River / Stream</option>
              </select>
            </div>
            <div>
              <label className="journey-label">Energy Source (Cooking/Lighting)</label>
              <select
                className="journey-select"
                value={energySource}
                onChange={e => setEnergySource(e.target.value)}
              >
                <option value="Solar + Charcoal">Solar + Charcoal</option>
                <option value="Solar Home System">Solar Home System</option>
                <option value="Grid Electricity">Grid Electricity</option>
                <option value="Firewood Only">Firewood Only</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="journey-btn-secondary"
          style={{ width: 'auto', padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
          data-testid="coop-member-add-btn"
        >
          {memberSelfEdit ? 'Save My Information' : '+ Add Member to Roster'}
        </button>

        {selfEnrolSubmitted && (
          <div
            data-testid="self-enrol-pending-notice"
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              background: '#dcfce7',
              color: '#166534',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Your information has been submitted for review. A Field Agent will assess and approve your record.
          </div>
        )}
      </form>

      <p className="journey-forward-hint" style={{ marginTop: '20px' }}>
        The next step determines governance officers from enrolled members and compares against registration certificates.
      </p>

      <div className="journey-actions">
        <button
          type="button"
          className="journey-btn-primary"
          onClick={handleContinue}
          disabled={roster.length === 0}
          data-testid="coop-step-3-continue"
        >
          {memberSelfEdit ? 'Continue to Loan Proposals' : 'Continue to Governance & Officers'}
        </button>
        <button
          type="button"
          className="journey-btn-secondary"
          onClick={onBack}
          data-testid="coop-step-3-back"
        >
          Back
        </button>
        <button
          type="button"
          className="journey-link-secondary"
          onClick={onSaveExit}
          data-testid="coop-step-3-save-exit"
        >
          Save and exit
        </button>
      </div>
    </div>
  );
};
