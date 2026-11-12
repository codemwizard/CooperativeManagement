import React, { useState, useEffect } from 'react';
import type { CaseState, Role, Actor } from './engine/types';
import { baselineCases, clone, meta, userFor } from './engine/data';
import { applyAction } from './engine/actions';
import {
  createCommitEnvelope,
  commitEnvelopeToStorage,
  loadStoredEnvelope,
  resetGlobalBaseline,
  migrateLegacyDraft,
} from './engine/persistence';
import { JourneyShell, StepIndicator } from './components/shell';
import { LoginScreen } from './components/journeys/LoginScreen';
import type { SymphonyDraft } from './components/journeys/types.display';
import {
  CoopRegister,
  CoopRegulatory,
  CoopMembers,
  CoopGovernance,
  CoopHistory,
  CoopBaseline,
  CoopReadiness,
  CoopPresent,
  CoopDashboard,
  RoleGate,
  CreateAccountJourney,
  MemberLoanProposals,
} from './components/journeys/cooperative';
import { NabiiJourney } from './components/journeys/nabii/NabiiJourney';
import { TaJourney } from './components/journeys/ta/TaJourney';
import { PfiJourney } from './components/journeys/pfi/PfiJourney';
import { VvbJourney } from './components/journeys/vvb/VvbJourney';
import { FieldAgentJourney } from './components/journeys/fieldagent/FieldAgentJourney';

const demoActionAt = `${meta.demo_date}T09:00:00Z`;

const roleUsers: Record<Role, string> = {
  secretary: 'c1.secretary',
  treasurer: 'c1.treasurer',
  chairman: 'c1.chairman',
  member: 'c1.member',
  field_agent: 'fa.banda',
  pfi_analyst: 'pfi.analyst1',
  pfi_credit: 'pfi.credit1',
  ta: 'ta.officer1',
  verifier: 'vrf.mulenga',
  fund_manager: 'fm.officer1',
  technician: 'tech.field1',
  coop_field_agent: 'cfa.banda',
};

function actorForRole(role: Role): Actor {
  const userId = roleUsers[role] || 'c1.secretary';
  const u = userFor(userId);
  if (u) return u;
  return { role, user_id: userId, cohorts: role === 'fund_manager' ? 'all' : ['Readiness Cohort 1'] };
}

export const JourneyRouter: React.FC = () => {
  const [cases, setCases] = useState<CaseState[]>(() => clone(baselineCases) as CaseState[]);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeCaseId, setActiveCaseId] = useState<string>('case-1');
  const [savedDraft, setSavedDraft] = useState<SymphonyDraft | null>(null);
  const [showCoopDashboard, setShowCoopDashboard] = useState<boolean>(false);
  const [activeFlow, setActiveFlow] = useState<'login' | 'create-account' | 'journey'>('login');

  const [saveError, setSaveError] = useState<string | null>(null);
  const [migrationBanner, setMigrationBanner] = useState<string | null>(null);
  const [resetBanner, setResetBanner] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // Mount sequence: legacy draft migration + load stored envelope (§6.1)
  useEffect(() => {
    const migration = migrateLegacyDraft();
    if (migration.migrated && migration.notice) {
      setMigrationBanner(migration.notice);
    }

    let hadCleared = false;
    const restoredCases = (baselineCases as CaseState[]).map((baseCase) => {
      const loaded = loadStoredEnvelope(undefined, baseCase.id);
      if (loaded.ok) {
        return loaded.envelope.state_snapshot;
      }
      if (loaded.cleared) {
        hadCleared = true;
      }
      return clone(baseCase) as CaseState;
    });

    setCases(restoredCases);
    if (hadCleared) {
      setStorageNotice('Stored state was inconsistent and has been cleared.');
    }
  }, []);

  const currentCase = cases.find(c => c.id === activeCaseId) || cases[0];
  if (typeof window !== 'undefined') {
    (window as any).__SYMPHONY_CASE__ = currentCase;
  }

  const handleUpdateCase = (updater: (prev: CaseState) => CaseState) => {
    setCases(prevCases =>
      prevCases.map(c => (c.id === activeCaseId ? updater(c) : c))
    );
  };

  const casesRef = React.useRef(cases);
  useEffect(() => {
    casesRef.current = cases;
  }, [cases]);

  const handleRunAction = (action: any, targetCaseId?: string): { ok: boolean; error?: string } => {
    if (!currentRole) return { ok: false, error: 'NO_ACTIVE_ROLE' };
    const cid = targetCaseId || action.case_id || activeCaseId;
    let targetCase = clone(casesRef.current.find(c => c.id === cid) || casesRef.current[0]);

    if (action.type === 'record_outcome' && !targetCase.presentation && !targetCase.financing) {
      targetCase.presentation = {
        destination: action.destination || 'A',
        presented_on: demoActionAt.slice(0, 10),
        snapshot: null,
      };
    }

    if (action.type === 'record_reliance') {
      if (!targetCase.verification) targetCase.verification = { assignments: [], findings: [], reliance: [] } as any;
      if (!targetCase.verification.findings) targetCase.verification.findings = [];
      const existingFinding = targetCase.verification.findings.find((f: any) => f.id === action.finding_id);
      if (!existingFinding) {
        (targetCase.verification.findings as any).push({
          id: action.finding_id || 'find-static-1',
          assignment_id: 'asg-static-1',
          result: 'verified',
          scope: 'Statutory verification',
          limitation: 'Registry search performed',
          recorded_by: 'vrf.mulenga',
          recorded_on: demoActionAt.slice(0, 10),
        });
      }
    }

    const actor = actorForRole(currentRole);
    const result = applyAction(targetCase, action, actor, demoActionAt);

    if (!result.ok) {
      return { ok: false, error: result.code };
    }

    // §6.1 Commit-then-publish sequence
    const updatedCase = result.caseState;
    const envelope = createCommitEnvelope(updatedCase, 0, new Date().toISOString());
    const writeResult = commitEnvelopeToStorage(envelope);
    if (!writeResult.ok) {
      setSaveError('Not saved — last accepted state retained');
      return { ok: false, error: 'SAVE_FAILED' };
    }

    setSaveError(null);
    casesRef.current = casesRef.current.map(c => (c.id === targetCase.id ? updatedCase : c));
    setCases(casesRef.current);
    return { ok: true };
  };

  const handleSaveExit = () => {
    if (currentRole) {
      setSavedDraft({
        cases,
        draftPhase: currentStep > 4 ? 'workshop_complete' : 'initial',
        draftCaseId: activeCaseId,
        draftRole: currentRole,
        draftStep: currentStep,
        savedAt: new Date().toISOString(),
      });
    }
    setActiveFlow('login');
    setCurrentRole(null);
    setCurrentStep(1);
    setShowCoopDashboard(false);
  };

  useEffect(() => {
    (window as any).__SYMPHONY_RUN_ACTION__ = handleRunAction;
    (window as any).__SYMPHONY_CASES__ = cases;
  }, [handleRunAction, cases]);

  const handleSelectRole = (role: Role) => {
    setCurrentRole(role);
    setCurrentStep(1);
    setShowCoopDashboard(false);
    setMigrationBanner(null);
    setResetBanner(null);
    setStorageNotice(null);
    setSaveError(null);
  };

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    setCases(clone(savedDraft.cases) as CaseState[]);
    setActiveCaseId(savedDraft.draftCaseId);
    setCurrentRole(savedDraft.draftRole);
    setCurrentStep(savedDraft.draftStep);
    setShowCoopDashboard(false);
  };

  const handleDiscardDraft = () => {
    setSavedDraft(null);
  };

  const handleResetDemo = () => {
    const clearRes = resetGlobalBaseline();
    if (!clearRes.ok) {
      setSaveError('Reset failed — storage could not be cleared.');
      return;
    }
    setCases(clone(baselineCases) as CaseState[]);
    setActiveCaseId('case-1');
    setActiveFlow('login');
    setCurrentRole(null);
    setCurrentStep(1);
    setShowCoopDashboard(false);
    setSavedDraft(null);
    setResetBanner('Demo reset to seed baseline across all cases (telemetry preserved).');
    setSaveError(null);
  };

  const handleStepAdvance = (nextStep: number) => {
    setCurrentStep(nextStep);
  };

  const renderBanners = () => (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 12px' }}>
      {saveError && (
        <div
          data-testid="save-error-banner"
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #f87171',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}
      {migrationBanner && (
        <div
          data-testid="migration-banner"
          style={{
            background: '#eff6ff',
            color: '#1e40af',
            border: '1px solid #93c5fd',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{migrationBanner}</span>
          <button
            type="button"
            onClick={() => setMigrationBanner(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}
      {resetBanner && (
        <div
          data-testid="reset-banner"
          style={{
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #86efac',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{resetBanner}</span>
          <button
            type="button"
            onClick={() => setResetBanner(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}
      {storageNotice && (
        <div
          data-testid="storage-notice-banner"
          style={{
            background: '#fffbeb',
            color: '#92400e',
            border: '1px solid #fcd34d',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{storageNotice}</span>
          <button
            type="button"
            onClick={() => setStorageNotice(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );

  // If Create Account flow active, show CreateAccountJourney
  if (activeFlow === 'create-account') {
    return (
      <CreateAccountJourney
        initialCase={currentCase}
        onExit={() => {
          setActiveFlow('login');
          setCurrentRole(null);
          setCurrentStep(1);
        }}
      />
    );
  }

  // If no role is selected, show Login / Persona Picker
  if (!currentRole) {
    return (
      <>
        {renderBanners()}
        <LoginScreen
          onSelectRole={role => {
            handleSelectRole(role);
            setActiveFlow('journey');
          }}
          savedDraft={savedDraft}
          onResumeDraft={handleResumeDraft}
          onDiscardDraft={handleDiscardDraft}
          onResetDemo={handleResetDemo}
          onCreateAccount={() => setActiveFlow('create-account')}
        />
      </>
    );
  }

  // 1. Cooperative Journey: 8 steps + Dashboard
  const isCooperativeRole = ['secretary', 'treasurer', 'chairman', 'coop_field_agent'].includes(currentRole);

  if (isCooperativeRole) {
    if (showCoopDashboard) {
      return (
        <JourneyShell
          role={currentRole}
          onExit={handleSaveExit}
          onReset={handleResetDemo}
        >
          {renderBanners()}
          <CoopDashboard
            caseState={currentCase as any}
            role={currentRole}
            onStartJourney={(targetStep = 1) => {
              setCurrentStep(targetStep);
              setShowCoopDashboard(false);
            }}
            onExit={handleSaveExit}
          />
        </JourneyShell>
      );
    }

    return (
      <JourneyShell
        role={currentRole}
        onExit={handleSaveExit}
        onReset={handleResetDemo}
        wide={currentStep === 7}
      >
        {renderBanners()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <StepIndicator
              step={currentStep}
              totalSteps={8}
              categoryLabel="COOPERATIVE TRANSFORMATION"
            />
          </div>
          <button
            type="button"
            className="journey-btn-secondary"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
            onClick={() => setShowCoopDashboard(true)}
            data-testid="coop-nav-dashboard"
          >
            📊 Cooperative Dashboard
          </button>
        </div>

        {currentStep === 1 && (
          <CoopRegister
            caseState={currentCase}
            role={currentRole}
            onNext={() => handleStepAdvance(2)}
            onSaveExit={handleSaveExit}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentStep === 2 && (
          <CoopRegulatory
            caseState={currentCase}
            role={currentRole}
            onNext={() => handleStepAdvance(3)}
            onBack={() => setCurrentStep(1)}
            onSaveExit={handleSaveExit}
          />
        )}

        {currentStep === 3 && (
          <CoopMembers
            caseState={currentCase as any}
            role={currentRole}
            onNext={() => handleStepAdvance(4)}
            onBack={() => setCurrentStep(2)}
            onSaveExit={handleSaveExit}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentStep === 4 && (
          <RoleGate
            role={currentRole}
            stepName="Step 4: Governance & Officers"
            allowedRoles={['secretary', 'chairman']}
            onBack={() => setCurrentStep(3)}
          >
            <CoopGovernance
              caseState={currentCase as any}
              role={currentRole}
              onNext={() => handleStepAdvance(5)}
              onBack={() => setCurrentStep(3)}
              onSaveExit={handleSaveExit}
              onUpdateCase={handleUpdateCase}
              onRunAction={handleRunAction}
            />
          </RoleGate>
        )}

        {currentStep === 5 && (
          <CoopHistory
            caseState={currentCase}
            role={currentRole}
            onNext={() => handleStepAdvance(6)}
            onBack={() => setCurrentStep(4)}
            onSaveExit={handleSaveExit}
          />
        )}

        {currentStep === 6 && (
          <CoopBaseline
            caseState={currentCase as any}
            role={currentRole}
            onNext={() => handleStepAdvance(7)}
            onBack={() => setCurrentStep(5)}
            onSaveExit={handleSaveExit}
          />
        )}

        {currentStep === 7 && (
          <RoleGate
            role={currentRole}
            stepName="Step 7: Institutional Readiness"
            allowedRoles={['secretary', 'chairman']}
            onBack={() => setCurrentStep(6)}
          >
            <CoopReadiness
              caseState={currentCase}
              role={currentRole}
              onNext={() => handleStepAdvance(8)}
              onBack={() => setCurrentStep(6)}
              onSaveExit={handleSaveExit}
            />
          </RoleGate>
        )}

        {currentStep === 8 && (
          <RoleGate
            role={currentRole}
            stepName="Step 8: Present Dossier"
            allowedRoles={['secretary', 'chairman']}
            onBack={() => setCurrentStep(7)}
          >
            <CoopPresent
              caseState={currentCase}
              role={currentRole}
              onBack={() => setCurrentStep(7)}
              onSaveExit={handleSaveExit}
              onRunAction={handleRunAction}
            />
          </RoleGate>
        )}
      </JourneyShell>
    );
  }

  // 1b. Cooperative Member Journey (Read-only + 4-block self-edit + Loan proposals)
  if (currentRole === 'member') {
    return (
      <JourneyShell
        role="member"
        onExit={handleSaveExit}
        onReset={handleResetDemo}
      >
        {renderBanners()}
        <div style={{ marginBottom: '12px' }}>
          <StepIndicator
            step={currentStep}
            totalSteps={3}
            categoryLabel="COOPERATIVE MEMBER PORTAL"
          />
        </div>

        {currentStep === 1 && (
          <CoopRegister
            caseState={currentCase}
            role="member"
            readOnly={true}
            onNext={() => handleStepAdvance(2)}
            onSaveExit={handleSaveExit}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentStep === 2 && (
          <CoopMembers
            caseState={currentCase as any}
            role="member"
            memberSelfEdit={true}
            onNext={() => handleStepAdvance(3)}
            onBack={() => setCurrentStep(1)}
            onSaveExit={handleSaveExit}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {currentStep === 3 && (
          <MemberLoanProposals
            caseState={currentCase}
            onBack={() => setCurrentStep(2)}
            onSaveExit={handleSaveExit}
            onRunAction={handleRunAction}
          />
        )}
      </JourneyShell>
    );
  }

  // 2. NABII Fund Manager Journey
  if (currentRole === 'fund_manager') {
    return (
      <NabiiJourney
        cases={cases}
        onExit={handleSaveExit}
        onRunAction={handleRunAction}
      />
    );
  }

  // 3. Technical Assistance Journey
  if (currentRole === 'ta') {
    return (
      <TaJourney
        cases={cases}
        onExit={handleSaveExit}
        onRunAction={handleRunAction}
      />
    );
  }

  // 4. PFI Journey (Bank Story)
  if (currentRole === 'pfi_analyst' || currentRole === 'pfi_credit') {
    return (
      <>
        {renderBanners()}
        <PfiJourney
          cases={cases}
          role={currentRole}
          onExit={handleSaveExit}
          onReset={handleResetDemo}
          onRunAction={handleRunAction}
        />
      </>
    );
  }

  // 5. VVB Verifier Journey
  if (currentRole === 'verifier') {
    return (
      <VvbJourney
        cases={cases}
        onExit={handleSaveExit}
        onReset={handleResetDemo}
        onRunAction={handleRunAction}
      />
    );
  }

  // 6. Field Agent Journey
  if (currentRole === 'field_agent') {
    return (
      <FieldAgentJourney
        cases={cases}
        onExit={handleSaveExit}
        onRunAction={handleRunAction}
      />
    );
  }

  // Fallback placeholder
  return (
    <JourneyShell
      role={currentRole}
      onExit={handleSaveExit}
      onReset={handleResetDemo}
    >
      {renderBanners()}
      <div className="journey-card" data-testid="journey-placeholder">
        <h2 className="journey-title">Journey: {currentRole}</h2>
        <div className="journey-actions">
          <button
            type="button"
            className="journey-btn-secondary"
            onClick={handleSaveExit}
          >
            Exit
          </button>
        </div>
      </div>
    </JourneyShell>
  );
};
