import React from 'react';

interface StepIndicatorProps {
  step: number;
  totalSteps: number;
  categoryLabel?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  totalSteps,
  categoryLabel = 'COOPERATIVE REGISTRATION',
}) => {
  const percent = Math.min(100, Math.max(0, Math.round((step / totalSteps) * 100)));

  return (
    <div className="journey-step-indicator" data-testid="journey-step-indicator">
      <div className="journey-step-meta">
        <span>
          {categoryLabel} · Step {step} of {totalSteps}
        </span>
        <span data-testid="journey-step-percent">{percent}%</span>
      </div>
      <div className="journey-progress-track">
        <div
          className="journey-progress-fill"
          style={{ width: `${percent}%` }}
          data-testid="journey-progress-fill"
        />
      </div>
    </div>
  );
};
