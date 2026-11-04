import React, { useState } from 'react';
import type { CaseState } from '../../../engine/types';
import { StepIndicator } from '../../shell/StepIndicator';
import { CoopRegister } from './CoopRegister';
import { CoopRegulatory } from './CoopRegulatory';
import { CoopMembers } from './CoopMembers';
import { CoopGovernance } from './CoopGovernance';
import { CoopHistory } from './CoopHistory';
import { CoopBaseline } from './CoopBaseline';
import { CoopClaims } from './CoopClaims';

interface CreateAccountJourneyProps {
  initialCase?: CaseState;
  onExit: () => void;
}

export const CreateAccountJourney: React.FC<CreateAccountJourneyProps> = ({
  initialCase,
  onExit,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [caseData, setCaseData] = useState<CaseState>(() => {
    if (initialCase) return { ...initialCase };
    return {
      id: 'case-new-reg',
      name: 'New Enterprise Cooperative',
      district: 'Chibombo',
      province: 'Central',
      activity: 'Soybeans & Maize Production',
      status: 'prospect',
      evidence: {},
    } as unknown as CaseState;
  });

  const handleUpdateCase = (updater: (prev: CaseState) => CaseState) => {
    setCaseData(prev => updater(prev));
  };

  const handleStepAdvance = (next: number) => {
    setCurrentStep(next);
  };

  return (
    <div className="journey-shell" data-testid="create-account-journey">
      <header className="journey-header">
        <div className="journey-header-left">
          <span className="journey-brand">Symphony</span>
          <span className="journey-role-badge">Cooperative Registration Flow</span>
        </div>
        <div className="journey-header-right">
          <button
            type="button"
            className="journey-exit-btn"
            onClick={onExit}
            data-testid="create-account-exit-header"
          >
            Exit to Sign-In
          </button>
        </div>
      </header>

      <main className="journey-main">
        <div className="journey-container">
          <div data-testid="coop-field-agent-identity" style={{
            padding: '8px 14px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--action)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            color: 'var(--action)',
            marginBottom: '12px',
          }}>
            Assisted by: Cooperative Field Agent (cfa.banda)
            · <em>Authorized for physical field data collection</em>
            · <em>Not a Programme &amp; Field Support role</em>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <StepIndicator
              step={currentStep}
              totalSteps={8}
              categoryLabel="COOPERATIVE REGISTRATION"
            />
          </div>

          {/* STEP 1: Registration (Registration Evidence hidden) */}
          {currentStep === 1 && (
            <CoopRegister
              caseState={caseData}
              role="coop_field_agent"
              hideEvidence={true}
              onNext={() => handleStepAdvance(2)}
              onSaveExit={onExit}
              onUpdateCase={handleUpdateCase}
            />
          )}

          {/* STEP 2: Regulatory Standing */}
          {currentStep === 2 && (
            <CoopRegulatory
              caseState={caseData}
              role="coop_field_agent"
              onNext={() => handleStepAdvance(3)}
              onBack={() => setCurrentStep(1)}
              onSaveExit={onExit}
            />
          )}

          {/* STEP 3: Member Roster Enrolment */}
          {currentStep === 3 && (
            <CoopMembers
              caseState={caseData as any}
              role="coop_field_agent"
              onNext={() => handleStepAdvance(4)}
              onBack={() => setCurrentStep(2)}
              onSaveExit={onExit}
              onUpdateCase={handleUpdateCase}
            />
          )}

          {/* STEP 4: Governance & Officers */}
          {currentStep === 4 && (
            <CoopGovernance
              caseState={caseData as any}
              role="coop_field_agent"
              onNext={() => handleStepAdvance(5)}
              onBack={() => setCurrentStep(3)}
              onSaveExit={onExit}
              onUpdateCase={handleUpdateCase}
              onRunAction={() => ({ ok: true })}
            />
          )}

          {/* STEP 5: History */}
          {currentStep === 5 && (
            <CoopHistory
              caseState={caseData}
              role="coop_field_agent"
              onNext={() => handleStepAdvance(6)}
              onBack={() => setCurrentStep(4)}
              onSaveExit={onExit}
            />
          )}

          {/* STEP 6: Assets & Baseline */}
          {currentStep === 6 && (
            <CoopBaseline
              caseState={caseData as any}
              role="coop_field_agent"
              onNext={() => handleStepAdvance(7)}
              onBack={() => setCurrentStep(5)}
              onSaveExit={onExit}
            />
          )}

          {/* STEP 7: Claims & Evidence to be Verified */}
          {currentStep === 7 && (
            <CoopClaims
              caseState={caseData}
              onNext={() => handleStepAdvance(8)}
              onBack={() => setCurrentStep(6)}
              onSaveExit={onExit}
            />
          )}

          {/* STEP 8: Exit Screen */}
          {currentStep === 8 && (
            <div className="journey-card" data-testid="create-account-exit-step">
              <h2 className="journey-title">Registration Submitted</h2>
              <p className="journey-subtitle">
                Cooperative onboarding information has been captured and submitted to the Symphony registry.
              </p>
              <div style={{
                padding: '16px 20px',
                background: '#dcfce7',
                color: '#166534',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                fontSize: '14px',
                lineHeight: 1.5,
              }}>
                Registration submitted. A Technical Assistance Officer will schedule verification.
              </div>
              <div className="journey-actions">
                <button
                  type="button"
                  className="journey-btn-primary"
                  onClick={onExit}
                  data-testid="create-account-exit-btn"
                >
                  Exit to Sign-In
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
