import { useState } from 'react';
import metaData from '../../data/meta.json';
import type { CaseState, Evaluation, EvidenceItem, RequirementResult, Role } from '../engine/types';
import { HelpPopover, VisibleStatement } from './help';
import { ProvenanceDrawer } from './shell/ProvenanceDrawer';

export function BoundaryLabel({ kind }: { kind: keyof typeof metaData.boundary_labels }) {
  const helpId = kind === 'extended_demonstrated' ? 'boundary.extended_demonstrated' : kind === 'extended' ? 'boundary.extended' : 'boundary.beachhead';
  return (
    <span className="boundary-label" data-testid="boundary-label">
      {metaData.boundary_labels[kind]}
      <HelpPopover id={helpId} />
    </span>
  );
}


export function EvidenceDrawer({ evidence, evidenceType, onClose }: { evidence: EvidenceItem; evidenceType?: string; onClose: () => void }) {
  return (
    <ProvenanceDrawer
      evidence={evidence}
      evidenceType={evidenceType ?? 'evidence'}
      evidenceLabel={evidenceType ? evidenceType.replace(/_/g, ' ') : 'Evidence'}
      onClose={onClose}
      drawerTestId="evidence-drawer"
      closeTestId="close-evidence-drawer"
    />
  );
}

export function RequirementChain({
  result,
  evidence,
  evidenceType,
  onOpenEvidence,
}: {
  result: RequirementResult;
  evidence?: EvidenceItem;
  evidenceType?: string;
  onOpenEvidence: () => void;
}) {
  const steps = [
    ['requirement', result.title],
    ['applicability', result.state === 'not_applicable' ? (result.reason ?? 'Not applicable') : 'Applicable to this destination'],
    ['evidence', evidenceType ? `${evidenceType}: ${result.effective_level ?? 'none'}` : 'No evidence record linked'],
    ['verification', evidence?.verified_by ? `${evidence.verified_by} on ${evidence.verified_on}` : 'Not verified'],
    ['finding', result.reason ?? 'Computed from current evidence and destination rules.'],
    ['state', result.state],
  ];
  return (
    <section className="chain" data-testid="requirement-chain">
      {steps.map(([step, content]) => (
        <span key={step} className="chain-step" data-testid={`chain-step-${step}`}>
          <strong>{step}</strong>
          <small>{content}</small>
        </span>
      ))}
      <button type="button" onClick={onOpenEvidence} data-testid="open-evidence-drawer" disabled={!evidence}>
        Evidence
      </button>
    </section>
  );
}

export function RequirementCard({
  result,
  evidence,
  evidenceType,
}: {
  result: RequirementResult;
  evidence?: EvidenceItem;
  evidenceType?: string;
}) {
  const [showChain, setShowChain] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const basisText = evidence?.limitation ?? result.reason ?? 'No evidence record is linked to this requirement.';
  return (
    <article className="requirement-card" data-testid={`requirement-card-${result.id}`}>
      <div className="card-row">
        <h2>{result.title}</h2>
        <button type="button" className={`state-badge state-${result.effective_level ?? result.state}`} onClick={() => setShowChain(true)} data-testid={`state-badge-${result.id}`}>
          {result.effective_level ?? result.state}
        </button>
      </div>
      <p className="limitation" data-testid="limitation-line">
        {basisText}
      </p>
      <p className="requirement-state" data-testid="requirement-state">
        {result.state}
      </p>
      <button type="button" data-testid="traceability-trigger" onClick={() => setShowChain(true)}>
        How was this established?
      </button>
      {showChain ? <RequirementChain result={result} evidence={evidence} evidenceType={evidenceType} onOpenEvidence={() => setShowDrawer(true)} /> : null}
      {showDrawer && evidence ? <EvidenceDrawer evidence={evidence} evidenceType={evidenceType} onClose={() => setShowDrawer(false)} /> : null}
    </article>
  );
}

export function GovernedMetricCard({
  id,
  title,
  value,
  evidence,
  evidenceType,
  onRaiseIssue,
}: {
  id: string;
  title: string;
  value: string;
  evidence: EvidenceItem;
  evidenceType: string;
  onRaiseIssue?: () => void;
}) {
  const [showDrawer, setShowDrawer] = useState(false);
  return (
    <article className="metric-card" data-testid={`metric-card-${id}`}>
      <h2>{title}</h2>
      <button type="button" className={`state-badge state-${evidence.level}`} data-testid={`metric-state-${id}`} onClick={() => setShowDrawer(true)}>
        {value}
      </button>
      <p>{evidence.limitation}</p>
      <p>Verified by {evidence.verified_by ?? 'Not verified'}{evidence.verified_on ? ` on ${evidence.verified_on}` : ''}</p>
      <button type="button" data-testid={`metric-history-${id}`} onClick={() => setShowDrawer(true)}>
        History
      </button>
      {onRaiseIssue ? (
        <button type="button" data-testid={`metric-raise-issue-${id}`} onClick={onRaiseIssue}>
          Raise issue
        </button>
      ) : null}
      {showDrawer ? <EvidenceDrawer evidence={evidence} evidenceType={evidenceType} onClose={() => setShowDrawer(false)} /> : null}
    </article>
  );
}

export function DestinationSwitcher({
  active,
  onChange,
  testIdPrefix = 'destination-tab',
}: {
  active: 'A' | 'B' | 'N';
  onChange?: (id: 'A' | 'B' | 'N') => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="segmented" data-testid="destination-switcher">
      {(['A', 'B', 'N'] as const).map((id) => (
        <button key={id} type="button" className={active === id ? 'active' : ''} data-testid={`${testIdPrefix}-${id}`} onClick={() => onChange?.(id)}>
          {id}
        </button>
      ))}
    </div>
  );
}

export function RoleSwitcher({ active, onChange }: { active: Role; onChange: (role: Role) => void }) {
  const roles: Role[] = ['secretary', 'treasurer', 'chairman', 'member', 'field_agent', 'pfi_analyst', 'pfi_credit', 'verifier', 'ta', 'fund_manager'];
  return (
    <div className="segmented" data-testid="role-switcher">
      {roles.map((role) => (
        <button key={role} type="button" className={active === role ? 'active' : ''} data-testid={`role-${role}`} onClick={() => onChange(role)}>
          {role}
        </button>
      ))}
    </div>
  );
}

export function ComponentDemo({ evaluation, evidence }: { evaluation: Evaluation; evidence: EvidenceItem }) {
  const result = evaluation.requirements.find((requirement) => requirement.evidence_ref === 'registration') ?? evaluation.requirements[0];
  const sampleEvidence = {
    asserted: { ...evidence, level: 'asserted' as const, verified_by: null, verified_on: null, limitation: 'Stated by the cooperative. No record attached.' },
    supported: { ...evidence, level: 'supported' as const, verified_by: null, verified_on: null, limitation: 'Supplied by the cooperative. Not independently checked.' },
    verified: evidence,
    disputed: { ...evidence, level: 'supported' as const, limitation: 'Someone has recorded an objection to this evidence.' },
    stale: { ...evidence, valid_until: '2026-01-01', limitation: 'The evidence is past its validity date and must be renewed.' },
  };
  const sampleResults: RequirementResult[] = [
    { ...result, id: 'demo-asserted', title: 'Asserted sample', state: 'unresolved', effective_level: 'asserted' },
    { ...result, id: 'demo-supported', title: 'Supported sample', state: 'satisfied', effective_level: 'supported' },
    { ...result, id: 'demo-verified', title: 'Verified sample', state: 'satisfied', effective_level: 'verified' },
    { ...result, id: 'demo-disputed', title: 'Disputed sample', state: 'exception', effective_level: 'disputed', reason: 'Evidence is disputed' },
    { ...result, id: 'demo-stale', title: 'Stale sample', state: 'exception', effective_level: 'stale', reason: 'Evidence is stale' },
    { ...result, id: 'demo-assessment-time', title: 'Assessment-time sample', state: 'assessment_time', effective_level: null, evidence_ref: null },
  ];
  return (
    <main className="page-shell">
      <header className="app-header">
        <div>
          <h1>Symphony</h1>
          <BoundaryLabel kind="beachhead" />
        </div>
        <DestinationSwitcher active="A" />
      </header>
      <VisibleStatement id="requirements.illustrative" />
      <RoleSwitcher active="secretary" onChange={() => undefined} />
      <section className="component-grid">
        {sampleResults.map((sample) => (
          <RequirementCard
            key={sample.id}
            result={sample}
            evidence={sample.effective_level ? sampleEvidence[sample.effective_level as keyof typeof sampleEvidence] : undefined}
            evidenceType={sample.evidence_ref ?? undefined}
          />
        ))}
        <GovernedMetricCard id="environmental-baseline" title="Environmental baseline" value="Supported" evidence={evidence} evidenceType="registration" />
      </section>
    </main>
  );
}

export function StateTransitionCard({
  title,
  before,
  after,
  helpId,
}: {
  title: string;
  before: string;
  after: string;
  helpId?: string;
}) {
  return (
    <article className="metric-card" data-testid="state-transition-card">
      <h2>{title}</h2>
      <p>{before} to {after}</p>
      {helpId ? <HelpPopover id={helpId} /> : null}
    </article>
  );
}

export function EventLogDrawer({ caseState, onClose }: { caseState: CaseState; onClose: () => void }) {
  return (
    <aside className="drawer" data-testid="event-log-drawer" aria-label="Event log">
      <div className="drawer-header">
        <h2>Event log</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <ol>
        {caseState.events.length ? caseState.events.map((event) => <li key={event.id}>{event.action} by {event.actor.user_id} at {event.at}</li>) : <li>No events recorded</li>}
      </ol>
    </aside>
  );
}
