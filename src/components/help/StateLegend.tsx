import { HelpPopover } from './HelpPopover';

const states = ['asserted', 'supported', 'verified', 'disputed', 'stale'];

export function StateLegend() {
  return (
    <div className="state-legend" data-testid="state-legend">
      {states.map((state) => (
        <span key={state} className={`state-pill state-${state}`}>
          {state}
          <HelpPopover id={`state.${state}`} />
        </span>
      ))}
    </div>
  );
}
