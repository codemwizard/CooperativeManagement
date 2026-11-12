import React, { useState } from 'react';
import type { CaseState, EngineEvent } from '../../../engine/types';
import { destinationById, meta } from '../../../engine/data';
import { evaluate } from '../../../engine/evaluate';
import { JourneyShell, StepIndicator, ActionLabel, ChangeConfirmation, requirementChip, levelChip, EqsCard } from '../../shell';
import { DiscoveryTable } from '../discovery/DiscoveryTable';
import { memberAssetSummary, coopAssetSummary, memberLivestockByCategory, assetsByOwner } from '../assetSummary';
import contactsData from '../../../../data/contacts_seed.json';
import verificationSeed from '../../../../data/verification_seed.json';
import { ProvenanceDrawer } from '../../shell/ProvenanceDrawer';

interface PfiJourneyProps {
  cases: CaseState[];
  role: 'pfi_analyst' | 'pfi_credit';
  onExit: () => void;
  onReset?: () => void;
  onRunAction: (action: any, targetCaseId?: string) => { ok: boolean; error?: string; event?: EngineEvent };
}

export const PfiJourney: React.FC<PfiJourneyProps> = ({
  cases,
  role,
  onExit,
  onReset,
  onRunAction,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-1');
  const [outcome, setOutcome] = useState<string>('');
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeSuccess, setOutcomeSuccess] = useState<string | null>(null);
  const [relianceRecorded, setRelianceRecorded] = useState<boolean>(false);
  const [inspectLender, setInspectLender] = useState<'A' | 'B'>('A');

  // Bank Slice state: Call Drawer & Verifications & Messages
  const [isCallDrawerOpen, setIsCallDrawerOpen] = useState<boolean>(false);
  const [isProvenanceDrawerOpen, setIsProvenanceDrawerOpen] = useState<boolean>(false);
  const [requestConfirmation, setRequestConfirmation] = useState<string | null>(null);
  const [selectedVerifier, setSelectedVerifier] = useState<string>('vrf.mulenga');
  const [verificationScope, setVerificationScope] = useState<string>('Verify member livestock count and unencumbered status');
  const [messageSubject, setMessageSubject] = useState<string>('Direct-to-Member Livestock Financing Opportunity');
  const [messageBody, setMessageBody] = useState<string>('Proposing direct-to-member financing arrangement coordinated by cooperative.');
  const [confirmationEvent, setConfirmationEvent] = useState<{
    event: EngineEvent | null;
    title: string;
    beforeText: string;
    unchangedText: string;
  } | null>(null);

  const selectedCase = cases.find(c => c.id === selectedCaseId) || cases[0];
  const isCreditOfficer = role === 'pfi_credit';

  const memberSummary = memberAssetSummary(selectedCase);
  const coopAssets = coopAssetSummary(selectedCase);
  const assetBreakdown = assetsByOwner(selectedCase);
  const livestockCategories = memberLivestockByCategory(selectedCase);

  const destinationAWithLivestock = {
    ...destinationById['A'],
    requirements: [
      ...destinationById['A'].requirements,
      {
        id: 'A-livestock',
        title: 'Livestock count verified',
        group: 'collateral_evidence',
        rule: {
          kind: 'evidence' as const,
          evidence_type: 'livestock_count',
          min_level: 'verified' as const,
        },
        applies_when: null,
        why: 'Destination-specific requirement. Satisfied when livestock count evidence reaches Verified level.',
      },
    ],
  };

  const evaluationA = evaluate(selectedCase, destinationAWithLivestock, meta.demo_date);
  const evaluationB = evaluate(selectedCase, destinationById['B'], meta.demo_date);

  // Contact for Chisamba / case-1
  const fieldAgentContact = contactsData.contacts.find(c => c.contact_id === 'cnt-fa-001') || {
    name: 'Gift Mulenga',
    role: 'Cooperative Field Agent (internal, not independent)',
    phone: '+260 97 712 3456',
    email: 'gift.mulenga@chisamba.coop.zm',
    location: 'Chisamba West Agricultural Camp',
    designated_scope: 'Livestock inventory enumeration & member field audit',
  };

  const verifierUsers = verificationSeed.verifier_users || [
    { user_id: 'vrf.mulenga', name: 'Chola Mulenga', organisation: 'Lender A verification staff', kind: 'institution_staff' },
    { user_id: 'vrf.sakala', name: 'Tendai Sakala', organisation: 'Independent verifier', kind: 'independent' },
  ];

  const handleRecordOutcome = () => {
    setOutcomeError(null);
    setOutcomeSuccess(null);

    if (!outcome) {
      setOutcomeError('Please select a credit outcome decision.');
      return;
    }

    if (!isCreditOfficer) {
      setOutcomeError('ROLE_NOT_PERMITTED: Only an authorised PFI Credit Officer may record final institutional credit decisions. PFI Credit Analysts are restricted to analysis and verification.');
      return;
    }

    const outcomeVal = outcome === 'Approved' ? 'approved' : outcome === 'Declined' ? 'declined' : 'deferred';
    const res = onRunAction({
      type: 'record_outcome',
      outcome: outcomeVal,
      destination: 'A',
      note: 'Commercial credit assessment conducted by PFI Credit Officer.',
    }, selectedCase.id);

    if (res.ok) {
      setOutcomeSuccess(`Decision recorded: ${outcome} for ${selectedCase.name}.`);
    } else {
      setOutcomeError(`Engine error: ${res.error || 'ROLE_NOT_PERMITTED'}`);
    }
  };

  const handleRecordReliance = (evidenceType: string) => {
    const res = onRunAction({
      type: 'record_reliance',
      evidence_type: evidenceType,
      finding_id: 'find-static-1',
      reliance: 'relied',
      note: 'Underwriting risk assessment reliance',
    }, selectedCase.id);
    if (res.ok) {
      setRelianceRecorded(true);
    }
  };

  const handleAssignVerification = () => {
    const targetVersion = selectedCase.evidence.livestock_count?.version_id ?? 1;
    const res = onRunAction({
      type: 'assign_verification',
      target: { kind: 'evidence', ref: 'livestock_count', version_id: targetVersion },
      assigned_to: selectedVerifier,
      scope: verificationScope,
      guard_duplicate: true,
    }, selectedCase.id);

    if (res.ok) {
      const asgId = (res.event?.after as any)?.id || (res.event?.target as any)?.id || `asg-lc-${Date.now()}`;
      const msg = `Verification request recorded — Assignment ID: ${asgId}. This is a request, not a verification result.`;
      setRequestConfirmation(msg);
      setConfirmationEvent({
        event: (res.event || {
          id: `evt-asg-${Date.now()}`,
          case_id: selectedCase.id,
          action: 'assign_verification',
          actor: { user_id: role === 'pfi_credit' ? 'pfi.credit1' : 'pfi.analyst1', role },
          at: new Date().toISOString(),
          target: { kind: 'evidence', ref: 'livestock_count' },
          before: null,
          after: { assigned_to: selectedVerifier, scope: verificationScope },
        }) as EngineEvent,
        title: 'Verification Assignment Dispatched',
        beforeText: 'Claim was unverified with asserted/supported field documentation.',
        unchangedText: `Request recorded — not a verification result. ${msg}`,
      });
    } else {
      alert(`Error assigning verification: ${res.error}`);
    }
  };

  const livestockVersion = selectedCase.evidence.livestock_count?.version_id ?? 1;
  const pfiAssignments = selectedCase.verification?.assignments || [];
  const lcAssignmentIds = new Set(pfiAssignments.filter(a => a.target.ref === 'livestock_count').map(a => a.id));
  lcAssignmentIds.add('asg-lc-001');

  const qualifyingFinding = (selectedCase.verification?.findings || []).slice().reverse().find(
    f => lcAssignmentIds.has(f.assignment_id) &&
         (f.version_id === undefined || f.version_id === livestockVersion) &&
         (f.result === 'verified_conformant' || f.result === 'verified_with_qualifications' || f.result === 'verified')
  );

  const handlePromoteLivestock = (findingId: string) => {
    onRunAction({
      type: 'promote_evidence_level',
      evidence_type: 'livestock_count',
      finding_id: findingId,
    }, selectedCase.id);
  };

  const handleSendInstitutionMessage = () => {
    const res = onRunAction({
      type: 'institution_message',
      subject: messageSubject,
      body: messageBody,
      message_type: 'product_proposal',
      proposed_structure: 'Direct loan to individual members with cooperative coordinating collection and aggregation.',
    }, selectedCase.id);

    if (res.ok) {
      setConfirmationEvent({
        event: (res.event || {
          id: `evt-msg-${Date.now()}`,
          case_id: selectedCase.id,
          action: 'institution_message',
          actor: { user_id: role === 'pfi_credit' ? 'pfi.credit1' : 'pfi.analyst1', role },
          at: new Date().toISOString(),
          target: { case_id: selectedCase.id },
          before: null,
          after: { subject: messageSubject },
        }) as EngineEvent,
        title: 'Inquiry Sent to Cooperative',
        beforeText: 'No previous formal proposal sent regarding direct-to-member facility.',
        unchangedText: 'This inquiry is not an approval, an offer, or a change to regulatory readiness.',
      });
    } else {
      alert(`Error sending message: ${res.error}`);
    }
  };

  const stepTitles = [
    'Discover',
    'Inspect',
    'Query or verify',
    'Assess',
    'Decide',
    'Monitor',
  ];

  return (
    <JourneyShell
      role={role}
      roleLabel={isCreditOfficer ? 'PFI Credit Officer' : 'PFI Credit Analyst'}
      onExit={onExit}
      onReset={onReset}
      wide={currentStep === 2}
    >
      <StepIndicator
        step={currentStep}
        totalSteps={6}
        categoryLabel={stepTitles[currentStep - 1]?.toUpperCase()}
      />

      {/* Stepper Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {stepTitles.map((title, idx) => (
          <button
            key={title}
            type="button"
            onClick={() => setCurrentStep(idx + 1)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: currentStep === idx + 1 ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: currentStep === idx + 1 ? '1px solid var(--action)' : '1px solid var(--line)',
              background: currentStep === idx + 1 ? 'var(--action-soft)' : 'var(--surface-raised)',
              color: currentStep === idx + 1 ? 'var(--action)' : 'var(--muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {idx + 1}. {title}
          </button>
        ))}
      </div>

      {/* STEP 1: DISCOVER */}
      {currentStep === 1 && (
        <div className="journey-card" data-testid="pfi-discovery-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Credit Pipeline & Discovery</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Discover rural enterprises presenting dossiers for commercial agricultural financing.
              </p>
            </div>
            <ActionLabel type="VIEW ONLY" />
          </div>

          {/* L0 Aggregate Declared Assets with Composition Bar */}
          <div style={{ padding: '14px', marginBottom: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Level 0 Portfolio Asset Composition (Selected: {selectedCase.name})
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              Total Declared Assets: ZMW {assetBreakdown.compound_declared_assets_zmw.toLocaleString()}
            </div>
            <div style={{ display: 'flex', height: '12px', borderRadius: '4px', overflow: 'hidden', margin: '8px 0', background: 'var(--line)' }}>
              <div style={{ width: `${(assetBreakdown.members_assets.total_value_zmw / (assetBreakdown.compound_declared_assets_zmw || 1)) * 100}%`, background: '#2563eb' }} title="Members' Personal Assets" />
              <div style={{ width: `${(assetBreakdown.cooperative_assets.total_value_zmw / (assetBreakdown.compound_declared_assets_zmw || 1)) * 100}%`, background: '#059669' }} title="Cooperative Fixed Assets" />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)' }}>
              <span><strong style={{ color: '#2563eb' }}>■</strong> Members' Assets: ZMW {assetBreakdown.members_assets.total_value_zmw.toLocaleString()} ({assetBreakdown.members_assets.total_livestock_count} livestock)</span>
              <span><strong style={{ color: '#059669' }}>■</strong> Cooperative-Owned: ZMW {assetBreakdown.cooperative_assets.total_value_zmw.toLocaleString()} ({assetBreakdown.cooperative_assets.items.length} fixed facilities)</span>
            </div>
          </div>

          <DiscoveryTable
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={id => {
              setSelectedCaseId(id);
            }}
            defaultDestinationId="A"
          />

          <div className="journey-actions" style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(4)}
              data-testid="pfi-step-assess"
            >
              Assess Enterprise Dossier →
            </button>
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(2)}
              data-testid="pfi-step-inspect"
            >
              Inspect Enterprise (Chisamba Story) →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: INSPECT */}
      {currentStep === 2 && (() => {
        const inspected = inspectLender === 'A' ? evaluationA : evaluationB;
        const shown = inspected.requirements.filter(r => r.state !== 'not_applicable');
        const tile = (letter: 'A' | 'B', ev: typeof evaluationA) => (
          <div className="ev-tile">
            <div className="ev-eyebrow">Lender {letter} requirements</div>
            <div className="ev-big">{ev.summary.satisfied} <span className="ev-big-of">of {ev.summary.satisfied + ev.summary.unresolved.length + ev.summary.exceptions.length} assessable met</span></div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className="ev-chip ev-v"><span className="ev-dot" />{ev.summary.satisfied} met</span>
              <span className="ev-chip ev-u"><span className="ev-dot" />{ev.summary.unresolved.length + ev.summary.exceptions.length} open</span>
            </div>
          </div>
        );
        return (
        <div className="journey-card ev-card" data-testid="pfi-inspect-step">
          <div className="ev-head">
            <div>
              <div className="ev-eyebrow">Evidence readiness view · Lender side</div>
              <h2 className="journey-title" style={{ margin: '4px 0 0 0' }}>Inspect Enterprise: {selectedCase.name}</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                {selectedCase.district}, {selectedCase.province}
              </p>
            </div>
            <ActionLabel type="VIEW ONLY" />
          </div>

          <div className="ev-tiles">
            {tile('A', evaluationA)}
            {tile('B', evaluationB)}
            <div className="ev-tile">
              <div className="ev-eyebrow">Declared assets</div>
              <div className="ev-big">ZMW {assetBreakdown.compound_declared_assets_zmw.toLocaleString()}</div>
              <div className="ev-sub">Members' personal property is shown separately from cooperative-owned assets.</div>
            </div>
          </div>

          <EqsCard caseState={selectedCase} />

          <div className="ev-split">
            <div className="ev-main">
              <div className="ev-panel">
                <div className="ev-panel-head">
                  <h3 className="ev-h3">Requirements checked against Lender {inspectLender}</h3>
                  <div className="ev-seg" role="group" aria-label="Choose lender">
                    <button type="button" className={inspectLender === 'A' ? 'on' : ''} aria-pressed={inspectLender === 'A'} onClick={() => setInspectLender('A')}>Lender A</button>
                    <button type="button" className={inspectLender === 'B' ? 'on' : ''} aria-pressed={inspectLender === 'B'} onClick={() => setInspectLender('B')}>Lender B</button>
                  </div>
                </div>
                <div className="ev-scroll">
                  <div className="ev-table ev-table-req">
                    <div className="ev-row ev-hd"><div>Requirement</div><div>Status</div><div>Evidence on file</div><div>Gap</div></div>
                    {shown.map(r => {
                      const chip = requirementChip(r.state);
                      return (
                        <div className="ev-row" key={r.id}>
                          <div data-label="Requirement">{r.title}</div>
                          <div data-label="Status">
                            <span className={`ev-chip ${chip.cls}`} data-state={r.state}>
                              <span className="ev-dot" />{chip.label}
                            </span>
                            <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
                              {r.state}
                            </span>
                          </div>
                          <div data-label="Evidence on file" className={r.evidence_ref ? '' : 'ev-sub'}>{r.evidence_ref ? `${r.evidence_ref}${r.effective_level ? ' · ' + r.effective_level : ''}` : 'Nothing on file'}</div>
                          <div data-label="Gap" className={r.state === 'satisfied' ? 'ev-sub' : ''}>{r.state === 'satisfied' ? 'None' : r.state === 'assessment_time' ? 'Checked at assessment' : (r.reason ?? (r.min_level ? `Needs ${r.min_level}${r.effective_level ? '; has ' + r.effective_level : ''}` : 'Not yet satisfied'))}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="ev-panel" data-testid="member-asset-summary">
                <div className="ev-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="ev-h3">Members' personal property</h3>
                  <button
                    type="button"
                    className="ev-btn"
                    style={{ fontSize: '12px', padding: '4px 10px', width: 'auto' }}
                    onClick={() => setIsProvenanceDrawerOpen(true)}
                    data-testid="inspect-provenance-livestock_count"
                  >
                    Inspect provenance
                  </button>
                </div>
                <p className="ev-sub" style={{ margin: '0 0 8px 0', padding: '0 20px' }}>{assetBreakdown.members_assets.label}</p>
                <div className="ev-scroll">
                  <div className="ev-table ev-table-live">
                    <div className="ev-row ev-hd"><div>Category</div><div>Count</div><div>Est. value</div><div>Status</div><div>Reported</div><div>Registry check</div></div>
                    {livestockCategories.map((cat, idx) => {
                      const lc = levelChip(cat.evidence_level);
                      const notDone = /not performed/i.test(cat.registry_check);
                      return (
                        <div className="ev-row" key={idx}>
                          <div data-label="Category"><strong>{cat.category}</strong></div>
                          <div data-label="Count">{cat.total_count} head</div>
                          <div data-label="Est. value">ZMW {cat.est_value_zmw.toLocaleString()}</div>
                          <div data-label="Status"><span className={`ev-chip ${lc.cls}`}><span className="ev-dot" />{lc.label}</span></div>
                          <div data-label="Reported">{cat.reported_encumbrance}</div>
                          <div data-label="Registry check"><span className={`ev-chip ${notDone ? 'ev-m' : 'ev-v'}`}><span className="ev-dot" />{cat.registry_check}</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="ev-sub" style={{ padding: '10px 20px 14px' }}>
                  Recorded by Field Agent Gift Mulenga on 2026-09-15 · Internal enumeration, not independent
                </div>
              </div>

              <div className="ev-panel">
                <div className="ev-panel-head">
                  <h3 className="ev-h3">Cooperative-owned assets</h3>
                </div>
                <p className="ev-sub" style={{ margin: '0 0 8px 0', padding: '0 20px' }}>{assetBreakdown.cooperative_assets.label}</p>
                {coopAssets.length > 0 ? (
                  <ul style={{ margin: 0, padding: '0 20px 16px 38px', fontSize: '14px' }}>
                    {coopAssets.map((a, i) => (
                      <li key={i}>{a.type}: {a.description} ({a.encumbrance})</li>
                    ))}
                  </ul>
                ) : (
                  <div className="ev-sub" style={{ padding: '0 20px 16px' }}>No cooperative-owned fixed real estate recorded.</div>
                )}
              </div>
            </div>

            <aside className="ev-rail">
              <div className="ev-panel ev-pad">
                <h3 className="ev-h3" style={{ marginBottom: '10px' }}>Next verification or support action</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button type="button" className="ev-btn ev-btn-p" onClick={() => setCurrentStep(3)}>
                    Proceed to Query or Verify →
                  </button>
                  <button type="button" className="ev-btn" onClick={() => setIsCallDrawerOpen(true)} data-testid="call-agent-btn">
                    Call field agent directly
                  </button>
                  <button type="button" className="ev-btn" onClick={() => setCurrentStep(1)}>
                    ← Back to Discovery
                  </button>
                </div>
              </div>

              {isCallDrawerOpen && (
                <div className="ev-panel ev-pad ev-call" data-testid="call-drawer">
                  <h3 className="ev-h3" style={{ marginBottom: '6px' }}>
                    Active call: {fieldAgentContact.name} ({fieldAgentContact.phone})
                  </h3>
                  <div className="ev-note">
                    Note: The call does not change the claim's evidence level.
                  </div>
                  <p style={{ margin: '8px 0 10px', fontSize: '13px' }}>
                    Call discussion: Verified livestock count methodology, dipping records, and seasonal grazing camp allocation.
                  </p>
                  <button type="button" className="ev-btn" onClick={() => setIsCallDrawerOpen(false)} data-testid="close-call-btn">
                    End Call / Close
                  </button>
                </div>
              )}

              <div className="ev-panel ev-pad">
                <h3 className="ev-h3" style={{ marginBottom: '6px' }}>Field enumeration provenance</h3>
                <div style={{ fontSize: '14px' }}>
                  <strong>Field Agent:</strong> {fieldAgentContact.name} ({fieldAgentContact.role})
                </div>
                <div className="ev-sub" style={{ marginTop: '4px' }}>
                  {fieldAgentContact.phone} · {fieldAgentContact.email} · {fieldAgentContact.location}
                </div>
              </div>

              <div className="ev-panel ev-pad">
                <h3 className="ev-h3" style={{ marginBottom: '6px' }}>Alternative opportunity</h3>
                <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                  Under Lender B, asset information shows substantial livestock. Members' livestock is separate from cooperative-owned assets. This is a possible <em>direct-to-member opportunity</em>, not cooperative collateral.
                </div>
              </div>
            </aside>
          </div>

          <div className="ev-sub" style={{ marginTop: '16px' }}>
            This view shows what the evidence supports. It does not score the applicant or make or recommend a financing decision.
          </div>
        </div>
        );
      })()}

      {currentStep === 3 && (
        <div className="journey-card" data-testid="pfi-verify-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Query, Verify & Propose Facility</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Initiate formal claim verification and propose alternative direct-to-member arrangements.
              </p>
            </div>
            <ActionLabel type="REQUEST / ASSIGNMENT" />
          </div>

          {/* Section 1: Initiate verification from the claim */}
          <div style={{ padding: '16px', marginBottom: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>5. Initiate Verification of Livestock Claim (assign_verification)</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--muted)' }}>
              Request independent or institutional verification of the member livestock claim. The verifier will record method, evidence examined, and finding.
            </p>

            <div className="journey-form-group" style={{ marginBottom: '12px' }}>
              <label className="journey-label">Select Authorized Verifier</label>
              <select
                className="journey-select"
                value={selectedVerifier}
                onChange={e => setSelectedVerifier(e.target.value)}
                data-testid="verifier-select"
              >
                {verifierUsers.map(v => (
                  <option key={v.user_id} value={v.user_id}>
                    {v.name} ({v.organisation}) [{v.kind === 'institution_staff' ? 'Internal Bank Staff' : 'External Independent'}]
                  </option>
                ))}
              </select>
            </div>

            <div className="journey-form-group" style={{ marginBottom: '12px' }}>
              <label className="journey-label">Verification Scope & Instructions</label>
              <input
                type="text"
                className="journey-input"
                value={verificationScope}
                onChange={e => setVerificationScope(e.target.value)}
                data-testid="verification-scope-input"
              />
            </div>

            <button
              type="button"
              className="journey-btn-primary"
              onClick={handleAssignVerification}
              data-testid="assign-verification-btn"
            >
              Dispatch Verification Request (assign_verification)
            </button>

            {requestConfirmation && (
              <div
                data-testid="request-confirmation-inline"
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  background: 'var(--action-soft)',
                  border: '1px solid var(--action)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                }}
              >
                {requestConfirmation}
              </div>
            )}
          </div>

          {/* Section 2: Put the opportunity in motion (institution_message) */}
          <div style={{ padding: '16px', marginBottom: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>6. Put Opportunity in Motion: Send Inquiry to Cooperative (institution_message)</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--muted)' }}>
              Propose a direct-to-member financing arrangement with the cooperative helping coordinate collection. It will appear in the cooperative's portal view.
            </p>

            <div className="journey-form-group" style={{ marginBottom: '12px' }}>
              <label className="journey-label">Subject</label>
              <input
                type="text"
                className="journey-input"
                value={messageSubject}
                onChange={e => setMessageSubject(e.target.value)}
                data-testid="message-subject-input"
              />
            </div>

            <div className="journey-form-group" style={{ marginBottom: '12px' }}>
              <label className="journey-label">Message Content</label>
              <textarea
                className="journey-input"
                rows={3}
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                data-testid="message-body-input"
              />
            </div>

            <button
              type="button"
              className="journey-btn-primary"
              onClick={handleSendInstitutionMessage}
              data-testid="send-proposal-btn"
            >
              Transmit Inquiry to Cooperative (institution_message)
            </button>
          </div>

          <div className="journey-actions" style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(2)}
            >
              ← Back to Inspect
            </button>
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(4)}
            >
              Proceed to Assess →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: ASSESS */}
      {currentStep === 4 && (
        <div className="journey-card" data-testid="pfi-assess-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>{selectedCase.name}</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                District: {selectedCase.district}, {selectedCase.province} · Financing Request: ZMW {selectedCase.project?.request?.amount?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ActionLabel type="INSTITUTIONAL FINDING OR DECISION" />
              <button
                type="button"
                className="journey-btn-secondary"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                onClick={() => setCurrentStep(1)}
                data-testid="pfi-back-to-discovery"
              >
                ← Back to Discovery
              </button>
            </div>
          </div>

          {/* Grouped Member Asset Summary (Guaranteed NO individual names) */}
          <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} data-testid="member-asset-summary">
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Asset Declarations (Aggregated)</h4>
            <div style={{ fontSize: '13px' }}>
              <strong>{memberSummary.label}:</strong> {memberSummary.livestock_item_count} items (est. ZMW {memberSummary.livestock_est_value_zmw.toLocaleString()})
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              Most Conservative Encumbrance: <strong>{memberSummary.encumbrance_summary}</strong>
            </div>
            {coopAssets.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                Cooperative Real Assets: {coopAssets.map(a => `${a.type} (${a.description}) [${a.encumbrance}]`).join(', ')}
              </div>
            )}
          </div>

          {/* Proprietary Evidence Quality Score (EQS) */}
          <div style={{ marginBottom: '16px' }}>
            <EqsCard caseState={selectedCase} />
          </div>

          {/* Institutional Readiness Overview */}
          <div style={{ marginBottom: '20px', padding: '14px', background: evaluationA.summary.ready ? 'var(--action-soft)' : 'rgba(183, 101, 21, 0.08)', borderRadius: 'var(--radius-sm)', border: `1px solid ${evaluationA.summary.ready ? 'var(--action)' : '#b76515'}` }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: evaluationA.summary.ready ? 'var(--action)' : 'var(--asserted)' }}>
              Evaluation Status: {evaluationA.summary.ready ? 'Satisfied for Destination A' : 'Unresolved Gaps Present'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              {evaluationA.summary.satisfied} of {evaluationA.summary.total} requirements satisfied · {evaluationA.summary.unresolved.length} unresolved
            </div>
          </div>

          {/* Institutional Credit Reliance & Outcome Decisions */}
          <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Formal Credit Assessment</h4>

            {relianceRecorded && (
              <div style={{ marginBottom: '12px', color: 'var(--verified)', fontSize: '12px', fontWeight: 600 }}>
                ✓ Institutional Reliance Recorded
              </div>
            )}

            {isCreditOfficer && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className="journey-btn-secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => handleRecordReliance('registration')}
                  data-testid="record-reliance-btn"
                >
                  Record Formal Reliance on Registration Evidence
                </button>
              </div>
            )}

            <div className="journey-form-group">
              <label className="journey-label" htmlFor="outcome-select">Credit Outcome Decision</label>
              <select
                id="outcome-select"
                className="journey-select"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                data-testid="pfi-outcome-select"
              >
                <option value="">-- Select Decision Outcome --</option>
                <option value="Approved">Approved</option>
                <option value="Conditional">Conditional Approval</option>
                <option value="Declined">Declined</option>
              </select>
            </div>

            {outcomeError && (
              <div className="journey-discrepancy-card" style={{ margin: '12px 0' }} data-testid="pfi-outcome-error">
                <div className="journey-discrepancy-title">Permission Constraint</div>
                <div className="journey-discrepancy-text">{outcomeError}</div>
              </div>
            )}

            {outcomeSuccess && (
              <div style={{ margin: '12px 0', padding: '12px', background: 'var(--action-soft)', borderRadius: 'var(--radius-sm)', color: 'var(--action)', fontWeight: 600, fontSize: '13px' }} data-testid="pfi-outcome-success">
                ✓ {outcomeSuccess}
              </div>
            )}

            <button
              type="button"
              className="journey-btn-primary"
              onClick={handleRecordOutcome}
              data-testid="pfi-submit-outcome-btn"
            >
              Record Credit Decision
            </button>
          </div>

          <div className="journey-actions" style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(3)}
            >
              ← Back to Query & Verify
            </button>
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(5)}
            >
              Proceed to Decide →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: DECIDE */}
      {currentStep === 5 && (
        <div className="journey-card" data-testid="pfi-decide-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Decide: Credit Committee & Approval Status</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Summary of institutional credit underwriting, conditions precedent, and formal commitments.
              </p>
            </div>
            <ActionLabel type="INSTITUTIONAL FINDING OR DECISION" />
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Recorded Credit Committee Outcomes</h4>
            {selectedCase.lender.outcomes.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                {selectedCase.lender.outcomes.map((out, idx) => (
                  <li key={idx}>
                    <strong>{out.outcome.toUpperCase()}</strong> by {out.recorded_by} on {out.recorded_on} {out.note ? `(${out.note})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                No formal outcome recorded yet. Return to Assess to record a committee determination.
              </div>
            )}
          </div>

          <div className="journey-actions" style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(4)}
            >
              ← Back to Assess
            </button>
            <button
              type="button"
              className="journey-btn-primary"
              onClick={() => setCurrentStep(6)}
            >
              Proceed to Monitor →
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: MONITOR */}
      {currentStep === 6 && (
        <div className="journey-card" data-testid="pfi-monitor-step">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="journey-title" style={{ margin: 0 }}>Monitor: Active Facility & Ongoing Covenants</h2>
              <p className="journey-subtitle" style={{ margin: '4px 0 0 0' }}>
                Track loan performance, ongoing verification covenanted milestones, and communications.
              </p>
            </div>
            <ActionLabel type="VIEW ONLY" />
          </div>

          <div style={{ padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Active Communications & Inquiries</h4>
            {selectedCase.institution_messages && selectedCase.institution_messages.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                {selectedCase.institution_messages.map((m, idx) => (
                  <li key={idx}>
                    <strong>{m.subject}</strong> ({m.status}) · {m.sent_at}
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{m.body}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No messages exchanged yet with cooperative.</div>
            )}
          </div>

          <div className="journey-actions">
            <button
              type="button"
              className="journey-btn-secondary"
              onClick={() => setCurrentStep(5)}
            >
              ← Back to Decide
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationEvent && (
        <ChangeConfirmation
          event={confirmationEvent.event}
          title={confirmationEvent.title}
          beforeText={confirmationEvent.beforeText}
          unchangedText={confirmationEvent.unchangedText}
          onClose={() => setConfirmationEvent(null)}
        />
      )}

      {isProvenanceDrawerOpen && selectedCase.evidence.livestock_count && (
        <ProvenanceDrawer
          evidenceType="livestock_count"
          evidenceLabel="Livestock Count"
          evidence={selectedCase.evidence.livestock_count}
          eventLog={selectedCase.events}
          findings={selectedCase.verification?.findings || []}
          assignments={selectedCase.verification?.assignments || []}
          demoActor={isCreditOfficer ? 'pfi.credit1 (Demo Actor — PFI Credit Officer)' : 'pfi.analyst1 (Demo Actor — PFI Credit Analyst)'}
          onRequestVerification={() => {
            setIsProvenanceDrawerOpen(false);
            setCurrentStep(3);
          }}
          onPromote={isCreditOfficer && qualifyingFinding ? () => handlePromoteLivestock(qualifyingFinding.id) : undefined}
          onClose={() => setIsProvenanceDrawerOpen(false)}
        />
      )}
    </JourneyShell>
  );
};
