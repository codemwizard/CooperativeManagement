import { ComponentDemo } from './components/core';
import { HelpProvider, StateLegend, TourBubble } from './components/help';
import { JourneyRouter } from './JourneyRouter';
import { CaptureAdmin, CaptureProvider } from './capture';
import { baselineCases, destinationById, meta } from './engine/data';
import { evaluate } from './engine/evaluate';

export default function App() {
  const caseState = baselineCases[0];
  const evaluation = evaluate(caseState, destinationById.A, meta.demo_date);
  const evidence = caseState.evidence.registration;
  const isComponents = window.location.pathname === '/components';
  const isCapture = window.location.pathname === '/capture';

  if (isCapture) {
    return (
      <CaptureProvider>
        <CaptureAdmin />
      </CaptureProvider>
    );
  }

  return isComponents ? (
    <CaptureProvider>
      <HelpProvider>
        <ComponentDemo evaluation={evaluation} evidence={evidence} />
        <aside className="floating-panel">
          <StateLegend />
          <TourBubble />
        </aside>
      </HelpProvider>
    </CaptureProvider>
  ) : (
    <CaptureProvider>
      <JourneyRouter />
    </CaptureProvider>
  );
}
