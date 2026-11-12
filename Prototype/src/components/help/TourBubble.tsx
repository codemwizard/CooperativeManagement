import { useEffect, useRef, useState } from 'react';
import toursData from '../../../data/tours.json';
import { useCapture, type CaptureScreen } from '../../capture';

export function TourBubble({
  tourId = 'bank',
  stepIndex = 0,
  onScreenChange,
}: {
  tourId?: 'bank' | 'nabii';
  stepIndex?: number;
  onScreenChange?: (screen: CaptureScreen) => void;
}) {
  const [activeTour, setActiveTour] = useState<'bank' | 'nabii' | null>(null);
  const [activeIndex, setActiveIndex] = useState(stepIndex);
  const capture = useCapture();
  const tourStartedAt = useRef(0);
  const selectedTour = activeTour ?? tourId;
  const steps = toursData.steps.filter((step) => step.tour_id === selectedTour);
  const step = steps[activeIndex] ?? steps[0];
  useEffect(() => {
    if (!activeTour || !step) return;
    capture?.setTourContext(activeTour, step.step_id);
    onScreenChange?.(step.expected_screen as CaptureScreen);
    capture?.emit('tour_step', { step_id: step.step_id, step_index: activeIndex + 1, step_total: steps.length, direction: 'next' }, { tour_id: activeTour, tour_step: step.step_id });
  }, [activeIndex, activeTour, capture, onScreenChange, step, steps.length]);
  if (!step) return null;
  if (!activeTour) {
    return (
      <aside className="tour-bubble" data-testid="tour-launcher">
        <div className="tour-actions">
          <button type="button" data-testid="start-bank-tour" onClick={() => {
            tourStartedAt.current = performance.now();
            setActiveTour('bank');
            setActiveIndex(0);
            capture?.emit('tour_start', { tour_id: 'bank', step_total: toursData.steps.filter((item) => item.tour_id === 'bank').length }, { tour_id: 'bank', tour_step: null });
          }}>
            Bank tour
          </button>
          <button type="button" data-testid="start-nabii-tour" onClick={() => {
            tourStartedAt.current = performance.now();
            setActiveTour('nabii');
            setActiveIndex(0);
            capture?.emit('tour_start', { tour_id: 'nabii', step_total: toursData.steps.filter((item) => item.tour_id === 'nabii').length }, { tour_id: 'nabii', tour_step: null });
          }}>
            NABII tour
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="tour-bubble" data-testid="tour-bubble" data-tour={selectedTour} data-anchor={step.anchor_testid}>
      <p>{step.text}</p>
      <div className="tour-actions">
        <button type="button" data-testid="tour-back" disabled={activeIndex === 0} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}>Back</button>
        <button
          type="button"
          data-testid="tour-next"
          onClick={() => {
            if (activeIndex >= steps.length - 1) {
              capture?.emit('tour_complete', { duration_ms: Math.round(performance.now() - tourStartedAt.current) });
              capture?.endSession('tour_complete');
              capture?.setTourContext(null);
              setActiveTour(null);
              return;
            }
            setActiveIndex((current) => Math.min(steps.length - 1, current + 1));
          }}
        >
          {activeIndex >= steps.length - 1 ? 'Finish' : 'Next'}
        </button>
        <button type="button" data-testid="tour-exit" onClick={() => {
          capture?.emit('tour_exit', { step_id: step.step_id, step_index: activeIndex + 1, completed_fraction: (activeIndex + 1) / steps.length });
          capture?.setTourContext(null);
          setActiveTour(null);
        }}>Exit</button>
      </div>
    </aside>
  );
}
